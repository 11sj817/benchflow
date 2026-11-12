import type {
  Attachment,
  Execution,
  ExecutionEnv,
  Measurement,
  RunResult,
  TestCase,
  TestPlan,
} from '@/types'
import { db, mutate } from './db'
import { getActor } from './actor'
import { evaluateExecution, judgeValue } from '@/utils/measurement'

export { judgeValue } from '@/utils/measurement'

const nowIso = () => new Date().toISOString()

export interface ExecutionInput {
  planId: string
  caseId: string
  testerId: string
  deviceIds: string[]
  environment: ExecutionEnv
  conditions: string
  note: string
}

function recalculate(run: Execution): RunResult {
  const testCase = db.cases.find((c) => c.id === run.caseId)
  return evaluateExecution({
    caseSteps: testCase?.steps ?? [],
    measurements: run.measurements,
    stepResults: run.stepResults,
  }).result
}

export interface ExecutionDraftInput {
  planId: string
  caseId: string
  testerId: string
  deviceIds: string[]
  environment: ExecutionEnv
  conditions: string
  note: string
}

export const executionService = {
  list(): Execution[] {
    return db.executions
  },

  get(id: string): Execution | undefined {
    return db.executions.find((e) => e.id === id)
  },

  caseOf(run: Execution): TestCase | undefined {
    return db.cases.find((c) => c.id === run.caseId)
  },

  planOf(run: Execution): TestPlan | undefined {
    return db.plans.find((p) => p.id === run.planId)
  },

  create(input: ExecutionDraftInput): Execution {
    const actor = getActor()
    const plan = db.plans.find((p) => p.id === input.planId)
    const testCase = db.cases.find((c) => c.id === input.caseId)
    if (!plan || !testCase) throw new Error('测试计划或用例不存在')
    const numericCodes = db.executions
      .map((e) => Number.parseInt(e.code.replace('RUN-', ''), 10))
      .filter((n) => Number.isFinite(n))
    const code = `RUN-${String((numericCodes.length ? Math.max(...numericCodes) : 0) + 1).padStart(4, '0')}`
    const measurements: Measurement[] = testCase.steps
      .filter((s) => s.param)
      .map((s) => ({
        id: `MS-${s.id}`,
        param: s.param!.name,
        unit: s.param!.unit,
        value: null,
        min: s.param!.min,
        max: s.param!.max,
        result: 'PENDING',
      }))
    const run: Execution = {
      id: code,
      code,
      planId: plan.id,
      projectId: plan.projectId,
      productId: plan.productId,
      hardwareVersionId: plan.hardwareVersionId,
      firmwareVersionId: plan.firmwareVersionId,
      caseId: testCase.id,
      testerId: input.testerId,
      deviceIds: input.deviceIds,
      environment: input.environment,
      conditions: input.conditions,
      measurements,
      stepResults: testCase.steps.map((s) => ({ stepId: s.id, result: 'PENDING' as RunResult })),
      result: 'PENDING',
      startedAt: nowIso(),
      attachments: [] as Attachment[],
      defectIds: [],
      note: input.note,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    mutate(
      (draft) => {
        draft.executions.unshift(run)
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'create',
        entity: 'execution',
        entityId: run.id,
        entityLabel: `${run.code} · ${testCase.name}`,
        summary: `创建执行 ${run.code}（${testCase.code}）`,
        projectId: plan.projectId,
      },
    )
    return run
  },

  setMeasurement(runId: string, measurementId: string, value: number | null, note?: string): void {
    const run = db.executions.find((e) => e.id === runId)
    if (!run) return
    const measurement = run.measurements.find((m) => m.id === measurementId)
    if (!measurement) return
    mutate((draft) => {
      const row = draft.executions.find((e) => e.id === runId)
      if (!row) return
      const rowMeasurement = row.measurements.find((m) => m.id === measurementId)
      if (!rowMeasurement) return
      rowMeasurement.value = value
      rowMeasurement.result = judgeValue(value, rowMeasurement.min, rowMeasurement.max)
      if (note !== undefined) rowMeasurement.note = note
      row.stepResults.forEach((step) => {
        if (rowMeasurement.id === `MS-${step.stepId}`) step.result = rowMeasurement.result ?? 'PENDING'
      })
      row.result = recalculate(row)
      row.updatedAt = nowIso()
    })
  },

  setStepResult(runId: string, stepId: string, result: RunResult, note?: string): void {
    const run = db.executions.find((e) => e.id === runId)
    if (!run) return
    mutate((draft) => {
      const row = draft.executions.find((e) => e.id === runId)
      if (!row) return
      const step = row.stepResults.find((s) => s.stepId === stepId)
      if (step) {
        step.result = result
        if (note !== undefined) step.note = note
      }
      row.result = recalculate(row)
      row.updatedAt = nowIso()
    })
  },

  setAttachmentList(runId: string, attachments: Attachment[]): void {
    const run = db.executions.find((e) => e.id === runId)
    if (!run) return
    mutate((draft) => {
      const row = draft.executions.find((e) => e.id === runId)
      if (row) {
        row.attachments = attachments
        row.updatedAt = nowIso()
      }
    })
  },

  addAttachment(runId: string, attachment: Attachment): void {
    const run = db.executions.find((e) => e.id === runId)
    if (!run) return
    const actor = getActor()
    mutate(
      (draft) => {
        const row = draft.executions.find((e) => e.id === runId)
        if (!row) return
        row.attachments.push(attachment)
        row.updatedAt = nowIso()
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'upload',
        entity: 'execution',
        entityId: runId,
        entityLabel: run.code,
        summary: `执行 ${run.code} 上传附件 ${attachment.name}`,
        projectId: run.projectId,
      },
    )
  },

  updateEnv(runId: string, environment: Partial<ExecutionEnv>, conditions?: string): void {
    const run = db.executions.find((e) => e.id === runId)
    if (!run) return
    mutate((draft) => {
      const row = draft.executions.find((e) => e.id === runId)
      if (!row) return
      row.environment = { ...row.environment, ...environment }
      if (conditions !== undefined) row.conditions = conditions
      row.updatedAt = nowIso()
    })
  },

  /** 提交执行：统一使用纯函数评估，必填测量与人工步骤未完成时拒绝提交。 */
  finish(runId: string, forcedResult?: RunResult): RunResult {
    const run = db.executions.find((e) => e.id === runId)
    if (!run) throw new Error('执行记录不存在')
    const testCase = db.cases.find((c) => c.id === run.caseId)
    const evaluation = evaluateExecution({
      caseSteps: testCase?.steps ?? [],
      measurements: run.measurements,
      stepResults: run.stepResults,
    })
    if (!forcedResult && !evaluation.isComplete) {
      const parts: string[] = []
      if (evaluation.missing.length > 0) {
        parts.push(`必填测量项未录入：${evaluation.missing.map((m) => m.param).join('、')}`)
      }
      if (evaluation.pendingManual.length > 0) {
        parts.push(`人工步骤未判定：${evaluation.pendingManual.map((s) => s.stepName).join('、')}`)
      }
      throw new Error(parts.join('；') || '仍有未完成项，不能提交')
    }
    const actor = getActor()
    let result: RunResult = run.result
    mutate(
      (draft) => {
        const row = draft.executions.find((e) => e.id === runId)
        if (!row) return
        if (forcedResult) {
          row.result = forcedResult
          row.stepResults.forEach((s) => {
            s.result = forcedResult
          })
        } else {
          row.result = recalculate(row)
        }
        row.finishedAt = nowIso()
        row.updatedAt = nowIso()
        result = row.result
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'update',
        entity: 'execution',
        entityId: runId,
        entityLabel: run.code,
        summary: `提交执行 ${run.code}，结果 ${forcedResult ?? run.result}`,
        projectId: run.projectId,
      },
    )
    return result
  },

  remove(runId: string): void {
    const run = db.executions.find((e) => e.id === runId)
    if (!run) return
    const linked = db.defects.filter((d) => d.executionId === runId || d.regressionExecutionIds.includes(runId))
    if (linked.length > 0) {
      throw new Error(`该执行已关联缺陷 ${linked.map((d) => d.code).join('、')}，不能删除。`)
    }
    const actor = getActor()
    mutate(
      (draft) => {
        draft.executions = draft.executions.filter((e) => e.id !== runId)
        draft.datasets.forEach((d) => {
          if (d.executionId === runId) d.executionId = undefined
        })
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'delete',
        entity: 'execution',
        entityId: runId,
        entityLabel: run.code,
        summary: `删除执行记录 ${run.code}`,
        projectId: run.projectId,
      },
    )
  },

  importMeasurements(runId: string, rows: { param: string; value: number | null; unit: string }[]): number {
    const run = db.executions.find((e) => e.id === runId)
    if (!run) return 0
    let matched = 0
    mutate((draft) => {
      const row = draft.executions.find((e) => e.id === runId)
      if (!row) return
      rows.forEach((input) => {
        const measurement = row.measurements.find(
          (m) => m.param === input.param || m.param.includes(input.param) || input.param.includes(m.param),
        )
        if (!measurement) return
        measurement.value = input.value
        measurement.result = judgeValue(input.value, measurement.min, measurement.max)
        matched += 1
      })
      row.measurements.forEach((m) => {
        const step = row.stepResults.find((s) => `MS-${s.stepId}` === m.id)
        if (step) step.result = m.result ?? 'PENDING'
      })
      row.result = recalculate(row)
      row.updatedAt = nowIso()
    })
    return matched
  },

  /** 从失败执行生成缺陷预填内容，保证执行 → 缺陷的可追溯性。 */
  defectDraft(runId: string): Record<string, unknown> | null {
    const run = db.executions.find((e) => e.id === runId)
    if (!run) return null
    const testCase = db.cases.find((c) => c.id === run.caseId)
    const overLimit = run.measurements.filter((m) => m.result === 'FAIL')
    const summary = overLimit
      .map((m) => `${m.param} ${m.value ?? '—'}${m.unit}（限值 ${m.min ?? '—'}~${m.max ?? '—'}${m.unit}）`)
      .join('；')
    return {
      title: `${testCase?.name ?? run.caseId} 未通过${overLimit.length ? `：${overLimit.map((m) => m.param).join('、')} 超限` : ''}`,
      description: `执行 ${run.code} 结果 ${run.result}。\n工况：${run.conditions}\n超限项：${summary || '见执行详情'}\n环境：${run.environment.temperature ?? '—'}℃ / ${run.environment.humidity ?? '—'}%RH。`,
      severity: overLimit.length > 1 ? 'critical' : 'major',
      priority: testCase?.priority ?? 'P1',
      projectId: run.projectId,
      productId: run.productId,
      hardwareVersionId: run.hardwareVersionId,
      firmwareVersionId: run.firmwareVersionId,
      executionId: run.id,
      caseId: run.caseId,
      steps: (testCase?.steps ?? []).map((s, i) => `${i + 1}. ${s.action}`).join('\n'),
      evidence: run.attachments,
      ownerId: testCase?.ownerId ?? run.testerId,
    }
  },
}
