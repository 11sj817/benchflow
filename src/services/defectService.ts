import type { Attachment, Defect, DefectStatus, Priority, Severity, TestPlan } from '@/types'
import { db, mutate } from './db'
import { getActor } from './actor'
import { nextCode } from '@/utils/id'
import { testPlanService } from './testService'

const nowIso = () => new Date().toISOString()

export interface DefectInput {
  title: string
  description: string
  severity: Severity
  priority: Priority
  projectId: string
  productId: string
  hardwareVersionId?: string
  firmwareVersionId?: string
  executionId?: string
  caseId?: string
  steps: string
  evidence: Attachment[]
  ownerId: string
}

const ALLOWED: Record<DefectStatus, DefectStatus[]> = {
  new: ['assigned', 'in_progress'],
  assigned: ['in_progress', 'new'],
  in_progress: ['resolved', 'assigned'],
  resolved: ['verified', 'in_progress', 'reopened'],
  verified: ['closed', 'reopened'],
  closed: ['reopened'],
  reopened: ['assigned', 'in_progress'],
}

const statusLabel: Record<DefectStatus, string> = {
  new: '新建',
  assigned: '待分派',
  in_progress: '处理中',
  resolved: '已修复',
  verified: '待关闭',
  closed: '已关闭',
  reopened: '已重开',
}

export const defectService = {
  list(): Defect[] {
    return db.defects
  },

  get(id: string): Defect | undefined {
    return db.defects.find((d) => d.id === id)
  },

  create(input: DefectInput): Defect {
    const actor = getActor()
    const code = nextCode('BUG-', db.defects.map((d) => d.code))
    const defect: Defect = {
      id: code,
      code,
      ...input,
      status: 'new',
      reporterId: actor.id,
      foundAt: nowIso(),
      rootCause: '',
      fixPlan: '',
      regressionExecutionIds: [],
      comments: [],
      timeline: [{ at: nowIso(), by: actor.id, action: '创建缺陷', note: input.executionId ? `由 ${input.executionId} 创建` : '' }],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    mutate(
      (draft) => {
        draft.defects.unshift(defect)
        if (input.executionId) {
          const run = draft.executions.find((e) => e.id === input.executionId)
          if (run && !run.defectIds.includes(code)) run.defectIds.push(code)
        }
        const req = draft.requirements.find((r) => r.projectId === input.projectId && r.caseIds.includes(input.caseId ?? ''))
        if (req && !req.defectIds.includes(code)) req.defectIds.push(code)
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'create',
        entity: 'defect',
        entityId: defect.id,
        entityLabel: defect.title,
        summary: `创建缺陷 ${code}`,
        projectId: input.projectId,
      },
    )
    return defect
  },

  update(id: string, patch: Partial<DefectInput & { rootCause: string; fixPlan: string; fixVersionId: string }>): void {
    const actor = getActor()
    const target = db.defects.find((d) => d.id === id)
    if (!target) return
    mutate(
      (draft) => {
        const row = draft.defects.find((d) => d.id === id)
        if (!row) return
        Object.assign(row, patch)
        row.updatedAt = nowIso()
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'update',
        entity: 'defect',
        entityId: id,
        entityLabel: target.title,
        summary: `更新缺陷 ${target.code}`,
        projectId: target.projectId,
      },
    )
  },

  assign(id: string, ownerId: string): void {
    const defect = db.defects.find((d) => d.id === id)
    if (!defect) return
    const owner = db.members.find((m) => m.id === ownerId)
    const actor = getActor()
    mutate(
      (draft) => {
        const row = draft.defects.find((d) => d.id === id)
        if (!row) return
        row.ownerId = ownerId
        row.status = row.status === 'new' ? 'assigned' : row.status
        row.timeline.push({ at: nowIso(), by: actor.id, action: `分派给 ${owner?.name ?? ownerId}` })
        row.updatedAt = nowIso()
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'update',
        entity: 'defect',
        entityId: id,
        entityLabel: defect.title,
        summary: `缺陷 ${defect.code} 分派给 ${owner?.name ?? ownerId}`,
        projectId: defect.projectId,
      },
    )
  },

  transition(id: string, to: DefectStatus, note = ''): void {
    const defect = db.defects.find((d) => d.id === id)
    if (!defect) return
    if (!ALLOWED[defect.status].includes(to)) {
      throw new Error(`不允许的状态流转：${statusLabel[defect.status]} → ${statusLabel[to]}`)
    }
    if (to === 'resolved' && (!defect.rootCause.trim() || !defect.fixPlan.trim())) {
      throw new Error('提交修复前请填写「根因分析」与「修复方案」，保证缺陷闭环可追溯。')
    }
    if (to === 'verified' && !defect.verification) {
      throw new Error('请先提交验证记录（关联回归执行）再进入待关闭状态。')
    }
    if (to === 'closed' && !defect.verification) {
      throw new Error('缺陷关闭必须存在验证记录，请先执行回归并提交验证。')
    }
    const actor = getActor()
    mutate(
      (draft) => {
        const row = draft.defects.find((d) => d.id === id)
        if (!row) return
        row.status = to
        row.timeline.push({
          at: nowIso(),
          by: actor.id,
          action: `状态：${statusLabel[defect.status]} → ${statusLabel[to]}`,
          note,
        })
        if (to === 'closed') row.closedAt = nowIso()
        row.updatedAt = nowIso()
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'status',
        entity: 'defect',
        entityId: id,
        entityLabel: defect.title,
        summary: `缺陷 ${defect.code} 状态：${statusLabel[defect.status]} → ${statusLabel[to]}`,
        projectId: defect.projectId,
      },
    )
  },

  comment(id: string, text: string, mentions: string[] = []): void {
    const defect = db.defects.find((d) => d.id === id)
    if (!defect) return
    const actor = getActor()
    mutate((draft) => {
      const row = draft.defects.find((d) => d.id === id)
      if (!row) return
      row.comments.push({ id: `CM-${Date.now().toString(36)}`, by: actor.id, at: nowIso(), text, mentions })
      row.updatedAt = nowIso()
    })
  },

  /** 提交验证记录：必须关联一次回归执行。 */
  verify(id: string, input: { executionId: string; note: string }): void {
    const defect = db.defects.find((d) => d.id === id)
    if (!defect) return
    if (defect.status !== 'resolved') {
      throw new Error('只有「已修复」状态的缺陷才能提交验证记录。')
    }
    const run = db.executions.find((e) => e.id === input.executionId)
    if (!run) throw new Error('请选择用于验证的回归执行记录。')
    if (run.caseId !== defect.caseId) throw new Error('回归执行必须使用同一测试用例，保证验证有效性。')
    if (run.result !== 'PASS') throw new Error('只有 PASS 的回归执行才能作为验证记录。')
    const actor = getActor()
    mutate(
      (draft) => {
        const row = draft.defects.find((d) => d.id === id)
        if (!row) return
        row.verification = {
          by: actor.id,
          at: nowIso(),
          executionId: input.executionId,
          note: input.note,
        }
        if (!row.regressionExecutionIds.includes(input.executionId)) {
          row.regressionExecutionIds.push(input.executionId)
        }
        row.status = 'verified'
        row.timeline.push({
          at: nowIso(),
          by: actor.id,
          action: `提交验证：${input.executionId} PASS`,
          note: input.note,
        })
        row.updatedAt = nowIso()
        const runRow = draft.executions.find((e) => e.id === input.executionId)
        if (runRow && !runRow.defectIds.includes(row.code)) runRow.defectIds.push(row.code)
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'review',
        entity: 'defect',
        entityId: id,
        entityLabel: defect.title,
        summary: `缺陷 ${defect.code} 验证通过（${input.executionId}）`,
        projectId: defect.projectId,
      },
    )
  },

  close(id: string, note = ''): void {
    const defect = db.defects.find((d) => d.id === id)
    if (!defect) return
    if (!defect.verification) throw new Error('缺陷关闭必须存在验证记录。请先执行回归并提交验证。')
    const actor = getActor()
    mutate(
      (draft) => {
        const row = draft.defects.find((d) => d.id === id)
        if (!row) return
        row.status = 'closed'
        row.closedAt = nowIso()
        row.timeline.push({
          at: nowIso(),
          by: actor.id,
          action: '关闭缺陷',
          note: note || `验证执行 ${row.verification?.executionId}`,
        })
        row.updatedAt = nowIso()
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'review',
        entity: 'defect',
        entityId: id,
        entityLabel: defect.title,
        summary: `关闭缺陷 ${defect.code}`,
        projectId: defect.projectId,
      },
    )
  },

  reopen(id: string, reason: string): void {
    const defect = db.defects.find((d) => d.id === id)
    if (!defect) return
    if (!reason.trim()) throw new Error('重开缺陷必须填写原因。')
    const actor = getActor()
    mutate(
      (draft) => {
        const row = draft.defects.find((d) => d.id === id)
        if (!row) return
        row.status = 'reopened'
        row.closedAt = undefined
        row.verification = undefined
        row.timeline.push({ at: nowIso(), by: actor.id, action: '重开缺陷', note: reason })
        row.updatedAt = nowIso()
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'status',
        entity: 'defect',
        entityId: id,
        entityLabel: defect.title,
        summary: `重开缺陷 ${defect.code}`,
        projectId: defect.projectId,
      },
    )
  },

  /** 创建回归测试计划（草稿转待执行），关联修复版本。 */
  createRegression(id: string): TestPlan {
    const defect = db.defects.find((d) => d.id === id)
    if (!defect) throw new Error('缺陷不存在')
    if (!defect.caseId) throw new Error('该缺陷未关联测试用例，无法自动创建回归计划。')
    const existing = db.plans.find(
      (p) => p.projectId === defect.projectId && p.caseIds.includes(defect.caseId!) && p.name.includes(defect.code),
    )
    if (existing) return existing
    const plan = testPlanService.create({
      name: `${defect.code} 回归验证计划`,
      projectId: defect.projectId,
      productId: defect.productId,
      hardwareVersionId: defect.fixVersionId ?? defect.hardwareVersionId ?? '',
      firmwareVersionId: defect.firmwareVersionId,
      requirementIds: [],
      caseIds: [defect.caseId],
      assigneeIds: [defect.reporterId],
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      deviceIds: ['DEV-001', 'DEV-002'],
      acceptance: `回归 ${defect.code}：同类测量项达到规格要求，且无引入新问题。`,
      note: `由 ${defect.code} 自动创建，修复版本 ${defect.fixVersionId ?? '未指定'}。`,
    })
    testPlanService.setStatus(plan.id, 'pending')
    return plan
  },

  stats(projectId?: string): {
    total: number
    open: number
    closed: number
    avgCloseDays: number
    bySeverity: Record<Severity, number>
    byStatus: Record<string, number>
  } {
    const rows = projectId ? db.defects.filter((d) => d.projectId === projectId) : db.defects
    const closed = rows.filter((d) => d.status === 'closed')
    const durations = closed
      .filter((d) => d.closedAt)
      .map((d) => (new Date(d.closedAt as string).getTime() - new Date(d.createdAt).getTime()) / 86400000)
    const bySeverity = { blocker: 0, critical: 0, major: 0, minor: 0, trivial: 0 } as Record<Severity, number>
    const byStatus: Record<string, number> = {}
    rows.forEach((d) => {
      bySeverity[d.severity] += 1
      byStatus[d.status] = (byStatus[d.status] ?? 0) + 1
    })
    return {
      total: rows.length,
      open: rows.filter((d) => d.status !== 'closed').length,
      closed: closed.length,
      avgCloseDays: durations.length ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10 : 0,
      bySeverity,
      byStatus,
    }
  },
}
