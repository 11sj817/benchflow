import type { Priority, Project, ProjectStatus, ProjectType, Requirement, RequirementStatus } from '@/types'
import { db, mutate } from './db'
import { getActor } from './actor'
import { nextCode, uid } from '@/utils/id'

export interface ProjectInput {
  name: string
  description: string
  type: ProjectType
  ownerId: string
  memberIds: string[]
  startDate: string
  plannedEndDate: string
  status: ProjectStatus
  priority: Priority
  tags: string[]
}

export interface ProjectStats {
  planCount: number
  runCount: number
  passRate: number
  openDefects: number
  caseCount: number
  requirementCount: number
  coveredRequirements: number
  progress: number
}

const nowIso = () => new Date().toISOString()

export const projectService = {
  list(): Project[] {
    return db.projects
  },

  get(id: string): Project | undefined {
    return db.projects.find((p) => p.id === id)
  },

  create(input: ProjectInput): Project {
    const actor = getActor()
    const project: Project = {
      id: `P-${Date.now().toString(36).slice(-5).toUpperCase()}`,
      code: nextCode('P-', db.projects.map((p) => p.code)),
      ...input,
      actualEndDate: input.status === 'completed' ? nowIso().slice(0, 10) : undefined,
      productIds: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    project.code = nextCode('P-', db.projects.map((p) => p.code))
    project.id = project.code
    mutate(
      (draft) => {
        draft.projects.unshift(project)
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'create',
        entity: 'project',
        entityId: project.id,
        entityLabel: project.name,
        summary: `创建项目 ${project.code} · ${project.name}`,
        projectId: project.id,
      },
    )
    return project
  },

  update(id: string, patch: Partial<ProjectInput>): Project | undefined {
    const actor = getActor()
    const target = db.projects.find((p) => p.id === id)
    if (!target) return undefined
    mutate(
      (draft) => {
        const row = draft.projects.find((p) => p.id === id)
        if (!row) return
        Object.assign(row, patch)
        row.updatedAt = nowIso()
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'update',
        entity: 'project',
        entityId: id,
        entityLabel: target.name,
        summary: `更新项目 ${target.code} 基本信息`,
        projectId: id,
      },
    )
    return db.projects.find((p) => p.id === id)
  },

  setStatus(id: string, status: ProjectStatus): void {
    const actor = getActor()
    const target = db.projects.find((p) => p.id === id)
    if (!target) return
    mutate(
      (draft) => {
        const row = draft.projects.find((p) => p.id === id)
        if (!row) return
        row.status = status
        row.updatedAt = nowIso()
        if (status === 'completed') row.actualEndDate = nowIso().slice(0, 10)
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'status',
        entity: 'project',
        entityId: id,
        entityLabel: target.name,
        summary: `项目状态变更为 ${status}`,
        projectId: id,
      },
    )
  },

  /** 保护业务完整性：存在关联数据时禁止硬删除，只允许归档。 */
  remove(id: string): void {
    const target = db.projects.find((p) => p.id === id)
    if (!target) return
    const linked = [
      db.requirements.some((r) => r.projectId === id),
      db.plans.some((p) => p.projectId === id),
      db.executions.some((e) => e.projectId === id),
      db.executions.some((e) => e.projectId === id),
      db.defects.some((d) => d.projectId === id),
      db.datasets.some((d) => d.projectId === id),
      db.reports.some((r) => r.projectId === id),
    ].filter(Boolean).length
    if (linked > 0) {
      throw new Error('该项目仍包含需求 / 计划 / 执行 / 缺陷等关联数据，请使用「归档」保留追溯链。')
    }
    const actor = getActor()
    mutate(
      (draft) => {
        draft.projects = draft.projects.filter((p) => p.id !== id)
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'delete',
        entity: 'project',
        entityId: id,
        entityLabel: target.name,
        summary: `删除空项目 ${target.code}`,
      },
    )
  },

  stats(id: string): ProjectStats {
    const project = db.projects.find((p) => p.id === id)
    const planIds = db.plans.filter((p) => p.projectId === id).map((p) => p.id)
    const runs = db.executions.filter((e) => e.projectId === id)
    const finished = runs.filter((r) => r.result !== 'PENDING')
    const pass = finished.filter((r) => r.result === 'PASS').length
    const requirements = db.requirements.filter((r) => r.projectId === id)
    const casePool = new Set(planIds.flatMap((planId) => db.plans.find((p) => p.id === planId)?.caseIds ?? []))
    const covered = requirements.filter((r) => r.caseIds.some((caseId) => casePool.has(caseId))).length
    const openDefects = db.defects.filter(
      (d) => d.projectId === id && d.status !== 'closed',
    ).length
    const passRate = finished.length ? Math.round((pass / finished.length) * 1000) / 10 : 0
    const requirementCoverage = requirements.length ? covered / requirements.length : 0
    const defectScore = openDefects === 0 ? 1 : Math.max(0, 1 - openDefects / 8)
    const progress = Math.round((passRate / 100) * 55 + requirementCoverage * 30 + defectScore * 15)
    return {
      planCount: planIds.length,
      runCount: runs.length,
      passRate,
      openDefects,
      caseCount: new Set(planIds.flatMap((planId) => db.plans.find((p) => p.id === planId)?.caseIds ?? [])).size,
      requirementCount: requirements.length,
      coveredRequirements: covered,
      progress: Math.max(0, Math.min(100, progress || 0)) || (project ? 0 : 0),
    }
  },

  risks(id: string): { level: 'high' | 'medium' | 'low'; text: string }[] {
    const risks: { level: 'high' | 'medium' | 'low'; text: string }[] = []
    const openCritical = db.defects.filter(
      (d) => d.projectId === id && (d.severity === 'blocker' || d.severity === 'critical') && d.status !== 'closed',
    )
    openCritical.forEach((d) =>
      risks.push({ level: 'high', text: `${d.code} ${d.title} 仍未关闭，影响交付判定。` }),
    )
    db.defects
      .filter((d) => d.projectId === id && d.severity === 'major' && d.status !== 'closed')
      .forEach((d) =>
        risks.push({ level: 'medium', text: `${d.code} ${d.title} 仍处于处理流程，需在交付前闭环。` }),
      )
    const stats = projectService.stats(id)
    if (stats.requirementCount > stats.coveredRequirements) {
      risks.push({
        level: 'medium',
        text: `${stats.requirementCount - stats.coveredRequirements} 条需求尚无对应用例覆盖。`,
      })
    }
    const project = db.projects.find((p) => p.id === id)
    if (project && project.plannedEndDate < new Date().toISOString().slice(0, 10) && project.status !== 'completed') {
      risks.push({ level: 'high', text: '计划结束日期已过期，项目仍未完成。' })
    }
    const overdueDevices = db.devices.filter((d) => d.calibrationDue < new Date().toISOString().slice(0, 10))
    const usedDeviceIds = new Set(
      db.executions.filter((e) => e.projectId === id).flatMap((e) => e.deviceIds),
    )
    const affected = overdueDevices.filter((d) => usedDeviceIds.has(d.id))
    if (affected.length) {
      risks.push({
        level: 'medium',
        text: `${affected.map((d) => d.code).join('、')} 校准已过期，相关历史数据需评估有效性。`,
      })
    }
    if (risks.length === 0) risks.push({ level: 'low', text: '当前无阻断性风险，按计划推进。' })
    return risks
  },
}

export interface RequirementInput {
  projectId: string
  name: string
  description: string
  priority: Priority
  source: Requirement['source']
  acceptance: string
  ownerId: string
  status: RequirementStatus
  caseIds: string[]
  defectIds: string[]
  parentId?: string
}

export const requirementService = {
  list(projectId?: string): Requirement[] {
    return projectId ? db.requirements.filter((r) => r.projectId === projectId) : db.requirements
  },

  get(id: string): Requirement | undefined {
    return db.requirements.find((r) => r.id === id)
  },

  create(input: RequirementInput): Requirement {
    const actor = getActor()
    const project = db.projects.find((p) => p.id === input.projectId)
    const seq = db.requirements.filter((r) => r.projectId === input.projectId).length + 1
    const code = `${project?.code ?? 'REQ'}-${String(seq).padStart(2, '0')}`
    const requirement: Requirement = {
      id: code,
      code,
      ...input,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    mutate(
      (draft) => {
        draft.requirements.unshift(requirement)
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'create',
        entity: 'requirement',
        entityId: requirement.id,
        entityLabel: requirement.name,
        summary: `创建需求 ${code}`,
        projectId: input.projectId,
      },
    )
    return requirement
  },

  update(id: string, patch: Partial<RequirementInput>): void {
    const actor = getActor()
    const target = db.requirements.find((r) => r.id === id)
    if (!target) return
    mutate(
      (draft) => {
        const row = draft.requirements.find((r) => r.id === id)
        if (!row) return
        Object.assign(row, patch)
        row.updatedAt = nowIso()
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'update',
        entity: 'requirement',
        entityId: id,
        entityLabel: target.name,
        summary: `更新需求 ${target.code}`,
        projectId: target.projectId,
      },
    )
  },

  remove(id: string): void {
    const actor = getActor()
    const target = db.requirements.find((r) => r.id === id)
    if (!target) return
    mutate(
      (draft) => {
        draft.requirements = draft.requirements.filter((r) => r.id !== id)
        draft.requirements.forEach((r) => {
          if (r.parentId === id) r.parentId = target.parentId
        })
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'delete',
        entity: 'requirement',
        entityId: id,
        entityLabel: target.name,
        summary: `删除需求 ${target.code}`,
        projectId: target.projectId,
      },
    )
  },

  /** 需求拆分：生成子需求并继承项目、负责人与优先级。 */
  split(id: string, children: { name: string; description: string }[]): Requirement[] {
    const parent = db.requirements.find((r) => r.id === id)
    if (!parent) return []
    const created: Requirement[] = []
    const actor = getActor()
    mutate(
      (draft) => {
        children.forEach((child, index) => {
          const seq = draft.requirements.filter((r) => r.projectId === parent.projectId).length + 1 + index
          const code = `${parent.projectId.replace('P-', 'REQ-')}-${String(seq).padStart(2, '0')}`
          const requirement: Requirement = {
            id: uid('REQ'),
            code,
            projectId: parent.projectId,
            parentId: parent.id,
            name: child.name,
            description: child.description,
            priority: parent.priority,
            source: parent.source,
            acceptance: parent.acceptance,
            ownerId: parent.ownerId,
            status: 'draft',
            caseIds: [],
            defectIds: [],
            createdAt: nowIso(),
            updatedAt: nowIso(),
          }
          draft.requirements.unshift(requirement)
          created.push(requirement)
        })
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'create',
        entity: 'requirement',
        entityId: parent.id,
        entityLabel: parent.name,
        summary: `拆分需求 ${parent.code} 为 ${children.length} 条子需求`,
        projectId: parent.projectId,
      },
    )
    return created
  },

  coverage(projectId: string): {
    total: number
    covered: number
    verified: number
    uncovered: number
    rate: number
  } {
    const requirements = db.requirements.filter((r) => r.projectId === projectId)
    const runs = db.executions.filter((e) => e.projectId === projectId)
    const passedCaseIds = new Set(runs.filter((r) => r.result === 'PASS').map((r) => r.caseId))
    const executedCaseIds = new Set(runs.map((r) => r.caseId))
    let covered = 0
    let verified = 0
    requirements.forEach((requirement) => {
      const hasCase = requirement.caseIds.length > 0
      if (hasCase) covered += 1
      if (requirement.caseIds.some((caseId) => passedCaseIds.has(caseId))) verified += 1
      requirement.caseIds.forEach((caseId) => executedCaseIds.add(caseId))
    })
    return {
      total: requirements.length,
      covered,
      verified,
      uncovered: requirements.length - covered,
      rate: requirements.length ? Math.round((covered / requirements.length) * 1000) / 10 : 0,
    }
  },
}
