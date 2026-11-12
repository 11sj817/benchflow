import type { Measurement, RunResult, StepResult, TestStep } from '@/types'

/**
 * 测量判定与执行结果评估的唯一实现。
 * PC 执行详情、移动端记录、平板工位必须调用这里的纯函数，
 * 避免界面各自计算导致 PASS / FAIL / PENDING 不一致。
 */

export type JudgedResult = RunResult

export function judgeValue(
  value: number | null | undefined,
  min?: number | null,
  max?: number | null,
): JudgedResult {
  if (value === null || value === undefined || Number.isNaN(value)) return 'PENDING'
  if (min !== null && min !== undefined && value < min) return 'FAIL'
  if (max !== null && max !== undefined && value > max) return 'FAIL'
  return 'PASS'
}

export interface MissingMeasurement {
  stepId: string
  stepName: string
  param: string
  unit: string
}

export interface PendingManualStep {
  stepId: string
  stepName: string
}

export interface FailedMeasurement {
  param: string
  value: number
  unit: string
  min: number | null
  max: number | null
  stepId: string
}

export interface MeasurementEvaluation {
  result: RunResult
  passCount: number
  failCount: number
  pendingCount: number
  requiredCount: number
  completedRequired: number
  failed: FailedMeasurement[]
  missing: MissingMeasurement[]
  pendingManual: PendingManualStep[]
  failedManual: PendingManualStep[]
  blockedSteps: PendingManualStep[]
  skippedSteps: PendingManualStep[]
  isComplete: boolean
}

export interface EvaluateExecutionInput {
  caseSteps: TestStep[]
  measurements: Measurement[]
  stepResults: StepResult[]
  /** 仅在人工强制标记整条执行时传入；日常录入不要传，否则会掩盖未完成项。 */
  forced?: RunResult | null
}

const findMeasurement = (measurements: Measurement[], step: TestStep) =>
  measurements.find((m) => m.id === `MS-${step.id}`) ??
  measurements.find((m) => m.param === step.param?.name)

export function evaluateExecution(input: EvaluateExecutionInput): MeasurementEvaluation {
  const { caseSteps, measurements, stepResults, forced } = input
  const failed: FailedMeasurement[] = []
  const missing: MissingMeasurement[] = []
  const pendingManual: PendingManualStep[] = []
  const failedManual: PendingManualStep[] = []
  const blockedSteps: PendingManualStep[] = []
  const skippedSteps: PendingManualStep[] = []

  let passCount = 0
  let requiredCount = 0
  let completedRequired = 0

  caseSteps.forEach((step) => {
    if (step.param) {
      const measurement = findMeasurement(measurements, step)
      const value = measurement?.value ?? null
      const min = measurement?.min ?? step.param.min ?? null
      const max = measurement?.max ?? step.param.max ?? null
      const verdict = judgeValue(value, min, max)
      const required = step.param.required

      if (required) requiredCount += 1
      if (verdict === 'PASS') passCount += 1

      if (verdict === 'FAIL') {
        failed.push({
          param: step.param.name,
          value: value as number,
          unit: step.param.unit,
          min,
          max,
          stepId: step.id,
        })
      } else if (verdict === 'PENDING') {
        if (required) {
          missing.push({
            stepId: step.id,
            stepName: step.name,
            param: step.param.name,
            unit: step.param.unit,
          })
        }
      } else if (required) {
        completedRequired += 1
      }
      return
    }

    const stepResult = stepResults.find((s) => s.stepId === step.id)?.result ?? 'PENDING'
    if (stepResult === 'PASS') {
      return
    }
    if (stepResult === 'FAIL') {
      failedManual.push({ stepId: step.id, stepName: step.name })
      return
    }
    if (stepResult === 'BLOCKED') {
      blockedSteps.push({ stepId: step.id, stepName: step.name })
      return
    }
    if (stepResult === 'SKIPPED') {
      skippedSteps.push({ stepId: step.id, stepName: step.name })
      return
    }
    pendingManual.push({ stepId: step.id, stepName: step.name })
  })

  const failCount = failed.length + failedManual.length
  const pendingCount = missing.length + pendingManual.length
  const isComplete = pendingCount === 0

  let result: RunResult
  if (forced) {
    result = forced
  } else if (failCount > 0) {
    result = 'FAIL'
  } else if (pendingCount > 0) {
    result = 'PENDING'
  } else if (blockedSteps.length > 0) {
    result = 'BLOCKED'
  } else if (skippedSteps.length > 0 && passCount === 0) {
    result = 'SKIPPED'
  } else {
    result = 'PASS'
  }

  return {
    result,
    passCount,
    failCount,
    pendingCount,
    requiredCount,
    completedRequired,
    failed,
    missing,
    pendingManual,
    failedManual,
    blockedSteps,
    skippedSteps,
    isComplete,
  }
}

/** 页面展示用的简短原因，避免每个页面各写一套文案。 */
export function describeEvaluation(evaluation: MeasurementEvaluation): string {
  if (evaluation.failed.length > 0) {
    return `存在 ${evaluation.failed.length} 项超限：${evaluation.failed
      .map((item) => `${item.param} ${item.value}${item.unit}`)
      .join('、')}`
  }
  if (evaluation.failedManual.length > 0) {
    return `存在 ${evaluation.failedManual.length} 个人工步骤判定为 FAIL`
  }
  if (evaluation.missing.length > 0) {
    return `还有 ${evaluation.missing.length} 个必填测量项未录入：${evaluation.missing
      .map((item) => item.param)
      .join('、')}`
  }
  if (evaluation.pendingManual.length > 0) {
    return `还有 ${evaluation.pendingManual.length} 个人工步骤未判定`
  }
  if (evaluation.blockedSteps.length > 0) return '存在 BLOCKED 步骤，整条执行不能判定为 PASS'
  if (evaluation.skippedSteps.length > 0) return '存在 SKIPPED 步骤，请确认是否可接受'
  return '全部必填项已完成，可提交执行结果'
}
