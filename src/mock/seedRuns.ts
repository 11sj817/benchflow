import type {
  Attachment,
  Execution,
  ExecutionEnv,
  Measurement,
  MeasureParam,
  RunResult,
  StepResult,
  TestCase,
} from '@/types'
import { makeClock } from './clock'
import { cases, plans } from './seedCore'

const clock = makeClock()
const { at } = clock

function autoValue(p: MeasureParam): number {
  if (p.min != null && p.max != null) return Number((p.min + (p.max - p.min) * 0.35).toFixed(2))
  if (p.max != null) return Number((p.max * 0.8).toFixed(2))
  if (p.min != null) return Number((p.min * 1.01).toFixed(2))
  return p.target ?? 1
}

function judge(value: number | null, p: MeasureParam): RunResult {
  if (value === null || Number.isNaN(value)) return 'PENDING'
  if (p.min != null && value < p.min) return 'FAIL'
  if (p.max != null && value > p.max) return 'FAIL'
  return 'PASS'
}

interface BuiltRun {
  measurements: Measurement[]
  stepResults: StepResult[]
  result: RunResult
}

function buildRun(c: TestCase, values: Record<string, number | null>, forced?: RunResult): BuiltRun {
  const measurements: Measurement[] = []
  const stepResults: StepResult[] = []
  let hasFail = false
  let hasValue = false

  c.steps.forEach((s) => {
    if (s.param) {
      const raw = values[s.id]
      const value = raw === undefined ? autoValue(s.param) : raw
      const verdict = forced === 'SKIPPED' || forced === 'BLOCKED' ? forced : judge(value, s.param)
      if (value !== null) hasValue = true
      if (verdict === 'FAIL') hasFail = true
      measurements.push({
        id: `MS-${s.id}`,
        param: s.param.name,
        unit: s.param.unit,
        value,
        min: s.param.min,
        max: s.param.max,
        result: verdict,
      })
      stepResults.push({ stepId: s.id, result: verdict })
    } else {
      stepResults.push({ stepId: s.id, result: forced === 'SKIPPED' || forced === 'BLOCKED' ? forced : 'PASS' })
    }
  })

  const result: RunResult = forced ?? (hasFail ? 'FAIL' : hasValue ? 'PASS' : 'PENDING')
  if (forced) {
    stepResults.forEach((s) => {
      s.result = forced
    })
  }
  return { measurements, stepResults, result }
}

const att = (id: string, name: string, kind: Attachment['kind'], size: number, note?: string): Attachment => ({
  id,
  name,
  kind,
  size,
  addedAt: at(0, 9),
  note,
})

interface Spec {
  code: string
  caseId: string
  planId: string
  daysAgo: number
  hour?: number
  testerId?: string
  values?: Record<string, number | null>
  forced?: RunResult
  note?: string
  conditions?: string
  attachments?: Attachment[]
  env?: Partial<ExecutionEnv>
}

const specs: Spec[] = [
  { code: 'RUN-0001', caseId: 'TC-1001', planId: 'TP-2401-01', daysAgo: 50, hour: 9, values: { 'S-1001-1': 11.94, 'S-1001-2': 95.2, 'S-1001-3': 12.02 } },
  { code: 'RUN-0002', caseId: 'TC-1002', planId: 'TP-2401-01', daysAgo: 49, hour: 11, values: { 'S-1002-1': 46, 'S-1002-2': 44, 'S-1002-3': 32, 'S-1002-4': 45 }, attachments: [att('ATT-0002', 'ripple_v11_full.csv', 'csv', 184320, '满载纹波原始采样')] },
  { code: 'RUN-0003', caseId: 'TC-1003', planId: 'TP-2401-01', daysAgo: 48, hour: 14, testerId: 'M-002', values: { 'S-1003-1': 95.4, 'S-1003-2': 96.1 } },
  { code: 'RUN-0004', caseId: 'TC-1004', planId: 'TP-2401-01', daysAgo: 47, hour: 10, values: { 'S-1004-1': 7.8, 'S-1004-2': 17 }, note: '冷启动过冲明显超限，已复现 3 次。', attachments: [att('ATT-0004', 'startup_overshoot_v11.png', 'png', 524288, '启动过冲波形')] },
  { code: 'RUN-0005', caseId: 'TC-1005', planId: 'TP-2401-01', daysAgo: 46, hour: 15, values: { 'S-1005-1': 13.4, 'S-1005-2': 8.5, 'S-1005-3': 2.4 }, note: '保护响应显著超限，需固件侧排查。' },
  { code: 'RUN-0006', caseId: 'TC-1006', planId: 'TP-2401-01', daysAgo: 45, hour: 9, values: { 'S-1006-1': 16.8, 'S-1006-2': 2.1 } },
  { code: 'RUN-0007', caseId: 'TC-1003', planId: 'TP-2401-01', daysAgo: 44, hour: 11, testerId: 'M-002', values: { 'S-1003-1': 95.1, 'S-1003-2': 96.0 }, note: '更换电流探头后复测。' },
  { code: 'RUN-0008', caseId: 'TC-1001', planId: 'TP-2401-01', daysAgo: 43, hour: 14 },
  { code: 'RUN-0009', caseId: 'TC-1002', planId: 'TP-2401-01', daysAgo: 42, hour: 10, values: { 'S-1002-1': 44, 'S-1002-2': 42, 'S-1002-3': 30, 'S-1002-4': 43 } },
  { code: 'RUN-0010', caseId: 'TC-1006', planId: 'TP-2401-01', daysAgo: 41, hour: 16, testerId: 'M-002' },
  { code: 'RUN-0011', caseId: 'TC-1004', planId: 'TP-2401-01', daysAgo: 40, hour: 9, values: { 'S-1004-1': 7.2, 'S-1004-2': 17 }, note: '复现过冲问题，排除测试方法影响。' },
  { code: 'RUN-0012', caseId: 'TC-1005', planId: 'TP-2401-01', daysAgo: 39, hour: 11, values: { 'S-1005-1': 13.6, 'S-1005-2': 8.2, 'S-1005-3': 2.6 } },
  { code: 'RUN-0013', caseId: 'TC-1002', planId: 'TP-2401-01', daysAgo: 38, hour: 15, testerId: 'M-002', values: { 'S-1002-1': 47, 'S-1002-2': 45, 'S-1002-3': 33, 'S-1002-4': 46 }, note: '接近限值，建议持续跟踪。' },
  { code: 'RUN-0014', caseId: 'TC-1007', planId: 'TP-2401-01', daysAgo: 37, hour: 10, values: { 'S-1007-1': 92, 'S-1007-2': 88, 'S-1007-3': 25.4 }, note: '计划外温升摸底：MOS 壳温 92℃，超限。', attachments: [att('ATT-0014', 'thermal_run_0014.csv', 'csv', 96256, '热电偶 1Hz 记录')] },
  { code: 'RUN-0015', caseId: 'TC-1006', planId: 'TP-2401-01', daysAgo: 37, hour: 16 },
  { code: 'RUN-0016', caseId: 'TC-1008', planId: 'TP-2401-01', daysAgo: 36, hour: 9, forced: 'SKIPPED', note: '高低温箱被 P-2402 样机占用，本轮跳过。' },
  { code: 'RUN-0017', caseId: 'TC-1002', planId: 'TP-2401-01', daysAgo: 35, hour: 13, values: { 'S-1002-1': 65, 'S-1002-2': 58, 'S-1002-3': 36, 'S-1002-4': 61 }, note: '更换第二台样机复测，满载纹波 65mV 明显超标。', attachments: [att('ATT-0017', 'ripple_v11_65mv.png', 'png', 688128, '满载纹波 65mV 波形'), att('ATT-0017b', 'ripple_v11_65mv.csv', 'csv', 204800)] },
  { code: 'RUN-0018', caseId: 'TC-4001', planId: 'TP-2404-01', daysAgo: 25, hour: 10, testerId: 'M-005', values: { 'S-4001-1': 0.18, 'S-4001-2': 0.26, 'S-4001-3': 0.12 } },
  { code: 'RUN-0019', caseId: 'TC-1002', planId: 'TP-2401-02', daysAgo: 8, hour: 10, values: { 'S-1002-1': 42, 'S-1002-2': 38, 'S-1002-3': 26, 'S-1002-4': 39 }, note: 'V1.2 整改后首次回归，纹波余量 8mV。', attachments: [att('ATT-0019', 'ripple_v12_42mv.png', 'png', 701440)] },
  { code: 'RUN-0020', caseId: 'TC-3001', planId: 'TP-2403-01', daysAgo: 6, hour: 14, values: { 'S-3001-1': 0.8, 'S-3001-2': 41 }, note: '满负载工况持续丢帧，CAN 分析仪记录到错误帧。', attachments: [att('ATT-0020', 'can_trace_100k.asc', 'log', 1258291)] },
  { code: 'RUN-0021', caseId: 'TC-3002', planId: 'TP-2403-01', daysAgo: 5, hour: 9 },
  { code: 'RUN-0022', caseId: 'TC-1004', planId: 'TP-2401-02', daysAgo: 5, hour: 11, values: { 'S-1004-1': 3.1, 'S-1004-2': 16 } },
  { code: 'RUN-0023', caseId: 'TC-1005', planId: 'TP-2401-02', daysAgo: 3, hour: 15, values: { 'S-1005-1': 13.2, 'S-1005-2': 3.1, 'S-1005-3': 1.8 } },
  { code: 'RUN-0024', caseId: 'TC-3001', planId: 'TP-2403-01', daysAgo: 1, hour: 10, values: { 'S-3001-1': 0.4, 'S-3001-2': 44 }, note: '波特率降至 1Mbps 后丢帧率下降，仍需定位根因。' },
  { code: 'RUN-0025', caseId: 'TC-1002', planId: 'TP-2401-02', daysAgo: 2, hour: 14, values: { 'S-1002-1': 41, 'S-1002-2': 37, 'S-1002-3': 25, 'S-1002-4': 38 } },
  { code: 'RUN-0026', caseId: 'TC-1003', planId: 'TP-2401-02', daysAgo: 2, hour: 9, testerId: 'M-002', values: { 'S-1003-1': 95.6, 'S-1003-2': 96.2 } },
  { code: 'RUN-0027', caseId: 'TC-1001', planId: 'TP-2401-02', daysAgo: 1, hour: 16 },
  { code: 'RUN-0028', caseId: 'TC-1002', planId: 'TP-2401-02', daysAgo: 0, hour: 9, values: { 'S-1002-1': 40, 'S-1002-2': 36, 'S-1002-3': 24, 'S-1002-4': 37 }, note: '交付基线数据采集完成。' },
]

const caseMap = new Map(cases.map((c) => [c.id, c]))
const planMap = new Map(plans.map((p) => [p.id, p]))

function envFor(spec: Spec): ExecutionEnv {
  return {
    temperature: 25,
    humidity: 48,
    inputVoltage: 48,
    load: 50,
    note: spec.caseId.startsWith('TC-2') ? '三相台架，水冷' : '',
    ...spec.env,
  }
}

export const executions: Execution[] = specs.map((spec) => {
  const c = caseMap.get(spec.caseId)!
  const plan = planMap.get(spec.planId)!
  const built = buildRun(c, spec.values ?? {}, spec.forced)
  const startedAt = at(spec.daysAgo, spec.hour ?? 10)
  const finishedAt = at(spec.daysAgo, (spec.hour ?? 10) + 1)
  return {
    id: spec.code,
    code: spec.code,
    planId: plan.id,
    projectId: plan.projectId,
    productId: plan.productId,
    hardwareVersionId: plan.hardwareVersionId,
    firmwareVersionId: plan.firmwareVersionId,
    caseId: c.id,
    testerId: spec.testerId ?? plan.assigneeIds[0] ?? 'M-005',
    deviceIds: plan.deviceIds.slice(0, 3),
    environment: envFor(spec),
    conditions: spec.conditions ?? (spec.caseId.startsWith('TC-1') ? '48V 输入 / 12V 输出 / 50A 满载 / 风冷' : '按用例规定工况'),
    measurements: built.measurements,
    stepResults: built.stepResults,
    result: built.result,
    startedAt,
    finishedAt,
    attachments: spec.attachments ?? [],
    defectIds: [],
    note: spec.note ?? '',
    createdAt: startedAt,
    updatedAt: finishedAt,
  }
})
