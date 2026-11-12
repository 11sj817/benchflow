import type {
  CaseStatus,
  PlanStatus,
  Priority,
  RunResult,
  TestCase,
  TestCategory,
  TestPlan,
  TestStep,
} from '@/types'
import { db, mutate } from './db'
import { getActor } from './actor'
import { nextCode, nextPlanCode, uid } from '@/utils/id'

const nowIso = () => new Date().toISOString()

export interface TestCaseInput {
  name: string
  category: TestCategory
  purpose: string
  precondition: string
  environment: string
  steps: TestStep[]
  priority: Priority
  productIds: string[]
  tags: string[]
}

const bumpVersion = (version: string): string => {
  const match = /^v(\d+)\.(\d+)$/.exec(version)
  if (!match) return 'v1.1'
  return `v${match[1]}.${Number(match[2]) + 1}`
}

export const testCaseService = {
  list(): TestCase[] {
    return db.cases
  },

  get(id: string): TestCase | undefined {
    return db.cases.find((c) => c.id === id)
  },

  create(input: TestCaseInput, status: CaseStatus = 'draft'): TestCase {
    const actor = getActor()
    const code = nextCode('TC-', db.cases.map((c) => c.code))
    const testCase: TestCase = {
      id: code,
      code,
      ...input,
      status,
      version: 'v1.0',
      revisions: [
        { version: 'v1.0', at: nowIso(), by: actor.id, summary: status === 'published' ? '创建并发布' : '创建草稿' },
      ],
      ownerId: actor.id,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    mutate(
      (draft) => {
        draft.cases.unshift(testCase)
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'create',
        entity: 'case',
        entityId: testCase.id,
        entityLabel: testCase.name,
        summary: `创建测试用例 ${code}`,
        projectId: db.products.find((p) => input.productIds.includes(p.id))?.projectId,
      },
    )
    return testCase
  },

  update(id: string, patch: Partial<TestCaseInput>, options?: { publish?: boolean; summary?: string }): void {
    const actor = getActor()
    const target = db.cases.find((c) => c.id === id)
    if (!target) return
    const publish = options?.publish ?? false
    mutate(
      (draft) => {
        const row = draft.cases.find((c) => c.id === id)
        if (!row) return
        Object.assign(row, patch)
        if (publish) {
          row.version = bumpVersion(row.version)
          row.status = 'published'
        }
        row.revisions.unshift({
          version: row.version,
          at: nowIso(),
          by: actor.id,
          summary: options?.summary ?? (publish ? '编辑并发布新版本' : '保存草稿'),
        })
        row.updatedAt = nowIso()
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'update',
        entity: 'case',
        entityId: id,
        entityLabel: target.name,
        summary: publish ? `发布用例 ${target.code} ${bumpVersion(target.version)}` : `保存用例草稿 ${target.code}`,
      },
    )
  },

  duplicate(id: string): TestCase | undefined {
    const source = db.cases.find((c) => c.id === id)
    if (!source) return undefined
    const actor = getActor()
    const code = nextCode('TC-', db.cases.map((c) => c.code))
    const copy: TestCase = {
      ...JSON.parse(JSON.stringify(source)),
      id: code,
      code,
      name: `${source.name}（副本）`,
      status: 'draft',
      version: 'v1.0',
      revisions: [{ version: 'v1.0', at: nowIso(), by: actor.id, summary: `复制自 ${source.code}` }],
      ownerId: actor.id,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    copy.steps = copy.steps.map((s: TestStep) => ({ ...s, id: uid('S') }))
    mutate(
      (draft) => {
        draft.cases.unshift(copy)
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'create',
        entity: 'case',
        entityId: copy.id,
        entityLabel: copy.name,
        summary: `复制用例 ${source.code} → ${code}`,
      },
    )
    return copy
  },

  setStatus(id: string, status: CaseStatus): void {
    const actor = getActor()
    const target = db.cases.find((c) => c.id === id)
    if (!target) return
    mutate(
      (draft) => {
        const row = draft.cases.find((c) => c.id === id)
        if (row) {
          row.status = status
          row.updatedAt = nowIso()
        }
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'status',
        entity: 'case',
        entityId: id,
        entityLabel: target.name,
        summary: `用例状态变更为 ${status}`,
      },
    )
  },

  remove(id: string): void {
    const target = db.cases.find((c) => c.id === id)
    if (!target) return
    const usedByPlans = db.plans.filter((p) => p.caseIds.includes(id))
    if (usedByPlans.length > 0) {
      throw new Error(`该用例已被 ${usedByPlans.map((p) => p.code).join('、')} 引用，不能删除，建议改为「已停用」。`)
    }
    const actor = getActor()
    mutate(
      (draft) => {
        draft.cases = draft.cases.filter((c) => c.id !== id)
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'delete',
        entity: 'case',
        entityId: id,
        entityLabel: target.name,
        summary: `删除用例 ${target.code}`,
      },
    )
  },
}

export interface TestPlanInput {
  name: string
  projectId: string
  productId: string
  hardwareVersionId: string
  firmwareVersionId?: string
  requirementIds: string[]
  caseIds: string[]
  assigneeIds: string[]
  startDate: string
  endDate: string
  deviceIds: string[]
  acceptance: string
  note: string
}

export interface PlanProgress {
  totalCases: number
  executedCases: number
  pass: number
  fail: number
  blocked: number
  pending: number
  rate: number
}

export const testPlanService = {
  list(): TestPlan[] {
    return db.plans
  },

  get(id: string): TestPlan | undefined {
    return db.plans.find((p) => p.id === id)
  },

  create(input: TestPlanInput): TestPlan {
    const actor = getActor()
    const project = db.projects.find((p) => p.id === input.projectId)
    const code = nextPlanCode(project?.code ?? 'P-0000', db.plans.map((p) => p.code))
    const plan: TestPlan = {
      id: code,
      code,
      ...input,
      status: 'draft',
      createdBy: actor.id,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    mutate(
      (draft) => {
        draft.plans.unshift(plan)
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'create',
        entity: 'plan',
        entityId: plan.id,
        entityLabel: plan.name,
        summary: `创建测试计划 ${code}`,
        projectId: input.projectId,
      },
    )
    return plan
  },

  update(id: string, patch: Partial<TestPlanInput & { status: PlanStatus }>): void {
    const actor = getActor()
    const target = db.plans.find((p) => p.id === id)
    if (!target) return
    mutate(
      (draft) => {
        const row = draft.plans.find((p) => p.id === id)
        if (!row) return
        Object.assign(row, patch)
        row.updatedAt = nowIso()
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'update',
        entity: 'plan',
        entityId: id,
        entityLabel: target.name,
        summary: `更新测试计划 ${target.code}`,
        projectId: target.projectId,
      },
    )
  },

  setStatus(id: string, status: PlanStatus): void {
    const actor = getActor()
    const target = db.plans.find((p) => p.id === id)
    if (!target) return
    mutate(
      (draft) => {
        const row = draft.plans.find((p) => p.id === id)
        if (row) {
          row.status = status
          row.updatedAt = nowIso()
        }
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'status',
        entity: 'plan',
        entityId: id,
        entityLabel: target.name,
        summary: `计划状态：${target.status} → ${status}`,
        projectId: target.projectId,
      },
    )
  },

  remove(id: string): void {
    const target = db.plans.find((p) => p.id === id)
    if (!target) return
    const runs = db.executions.filter((e) => e.planId === id)
    if (runs.length > 0) {
      throw new Error(`该计划已产生 ${runs.length} 条执行记录，不能删除，可改为「已取消」。`)
    }
    const actor = getActor()
    mutate(
      (draft) => {
        draft.plans = draft.plans.filter((p) => p.id !== id)
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'delete',
        entity: 'plan',
        entityId: id,
        entityLabel: target.name,
        summary: `删除测试计划 ${target.code}`,
        projectId: target.projectId,
      },
    )
  },

  cases(id: string): TestCase[] {
    const plan = db.plans.find((p) => p.id === id)
    if (!plan) return []
    return plan.caseIds.map((caseId) => db.cases.find((c) => c.id === caseId)).filter(Boolean) as TestCase[]
  },

  runs(id: string) {
    return db.executions.filter((e) => e.planId === id)
  },

  progress(id: string): PlanProgress {
    const plan = db.plans.find((p) => p.id === id)
    if (!plan) return { totalCases: 0, executedCases: 0, pass: 0, fail: 0, blocked: 0, pending: 0, rate: 0 }
    const runs = db.executions.filter((e) => e.planId === id)
    const latestByCase = new Map<string, RunResult>()
    runs
      .slice()
      .sort((a, b) => (a.startedAt < b.startedAt ? -1 : 1))
      .forEach((run) => latestByCase.set(run.caseId, run.result))
    const values = plan.caseIds.map((caseId) => latestByCase.get(caseId) ?? 'PENDING')
    const pass = values.filter((v) => v === 'PASS').length
    const fail = values.filter((v) => v === 'FAIL').length
    const blocked = values.filter((v) => v === 'BLOCKED' || v === 'SKIPPED').length
    const executed = values.filter((v) => v !== 'PENDING').length
    return {
      totalCases: plan.caseIds.length,
      executedCases: executed,
      pass,
      fail,
      blocked,
      pending: plan.caseIds.length - executed,
      rate: executed ? Math.round((pass / executed) * 1000) / 10 : 0,
    }
  },
}
