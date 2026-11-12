import { beforeEach, describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Measurement, TestStep } from '@/types'
import { evaluateExecution, judgeValue } from '@/utils/measurement'
import { parseScanPayload, buildScanPayload } from '@/utils/scanContext'
import { toMobileLink } from '@/utils/mobileLink'
import { clearDraft, readDraft, saveDraft } from '@/utils/draftStore'
import { buildSearchIndex, searchIndex } from '@/utils/search'
import { createSeedDb } from '@/mock/seed'
import { routes } from '@/router/routes'
import type { RouteRecordRaw } from 'vue-router'
import { validateAttachment, attachmentKind, ATTACHMENT_LIMIT_BYTES } from '@/utils/attachmentStore'

function installMemoryStorage() {
  const store = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      get length() {
        return store.size
      },
      clear: () => store.clear(),
      getItem: (key: string) => store.get(key) ?? null,
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      removeItem: (key: string) => {
        store.delete(key)
      },
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
    },
    configurable: true,
  })
  return store
}

const store = installMemoryStorage()

const paramStep = (required = true): TestStep => ({
  id: 'S-1',
  name: '满载纹波',
  action: '测量',
  expected: '≤50mV',
  param: { name: '输出纹波', unit: 'mV', min: null, max: 50, target: null, required },
})
const manualStep: TestStep = {
  id: 'S-2',
  name: '外观检查',
  action: '目视',
  expected: '无损伤',
  param: null,
}
const measurement = (value: number | null): Measurement => ({
  id: 'MS-S-1',
  param: '输出纹波',
  unit: 'mV',
  value,
  min: null,
  max: 50,
  result: judgeValue(value, null, 50),
})

describe('统一测量判定（2.1）', () => {
  it('必填测量缺失只能是 PENDING，不能提前 PASS', () => {
    const result = evaluateExecution({
      caseSteps: [paramStep(), manualStep],
      measurements: [measurement(null)],
      stepResults: [{ stepId: 'S-2', result: 'PASS' }],
    })
    expect(result.result).toBe('PENDING')
    expect(result.missing).toHaveLength(1)
    expect(result.isComplete).toBe(false)
  })

  it('可选测量缺失不影响 PASS', () => {
    const result = evaluateExecution({
      caseSteps: [paramStep(false), manualStep],
      measurements: [measurement(null)],
      stepResults: [{ stepId: 'S-2', result: 'PASS' }],
    })
    expect(result.result).toBe('PASS')
    expect(result.missing).toHaveLength(0)
  })

  it('超限立即 FAIL，即使还有其他未完成项', () => {
    const result = evaluateExecution({
      caseSteps: [paramStep(), manualStep],
      measurements: [measurement(65)],
      stepResults: [{ stepId: 'S-2', result: 'PENDING' }],
    })
    expect(result.result).toBe('FAIL')
    expect(result.failed[0].value).toBe(65)
  })

  it('人工步骤未完成时为 PENDING，BLOCKED 需要明确记录', () => {
    const pending = evaluateExecution({
      caseSteps: [paramStep(), manualStep],
      measurements: [measurement(42)],
      stepResults: [{ stepId: 'S-2', result: 'PENDING' }],
    })
    expect(pending.result).toBe('PENDING')
    expect(pending.pendingManual).toHaveLength(1)

    const blocked = evaluateExecution({
      caseSteps: [paramStep(), manualStep],
      measurements: [measurement(42)],
      stepResults: [{ stepId: 'S-2', result: 'BLOCKED' }],
    })
    expect(blocked.result).toBe('BLOCKED')
    expect(blocked.blockedSteps).toHaveLength(1)
  })

  it('强制 BLOCKED / SKIPPED 时保留人工结果', () => {
    expect(
      evaluateExecution({
        caseSteps: [paramStep(), manualStep],
        measurements: [measurement(null)],
        stepResults: [],
        forced: 'SKIPPED',
      }).result,
    ).toBe('SKIPPED')
  })
})

describe('扫码上下文（2.1）', () => {
  it('识别项目 / 产品 / 设备 / 计划 / 执行深链', () => {
    expect(parseScanPayload(buildScanPayload('project', 'P-2401'))).toMatchObject({ type: 'project', id: 'P-2401' })
    expect(parseScanPayload(buildScanPayload('product', 'PRD-100'))).toMatchObject({ type: 'product', id: 'PRD-100' })
    expect(parseScanPayload(buildScanPayload('device', 'DEV-001'))).toMatchObject({ type: 'device', id: 'DEV-001' })
    expect(parseScanPayload(buildScanPayload('plan', 'TP-2401-02'))).toMatchObject({ type: 'plan', id: 'TP-2401-02' })
    expect(parseScanPayload(buildScanPayload('execution', 'RUN-0017'))).toMatchObject({ type: 'execution', id: 'RUN-0017' })
  })

  it('支持网页链接、JSON 与纯编号', () => {
    expect(parseScanPayload('https://11sj817.github.io/benchflow/#/projects/P-2401')).toMatchObject({ type: 'project', id: 'P-2401' })
    expect(parseScanPayload('https://x.dev/#/mobile/executions/RUN-0017')).toMatchObject({ type: 'execution', id: 'RUN-0017' })
    expect(parseScanPayload('{"type":"device","id":"DEV-002"}')).toMatchObject({ type: 'device', id: 'DEV-002' })
    expect(parseScanPayload('DEV-003')).toMatchObject({ type: 'device', id: 'DEV-003' })
    expect(parseScanPayload('')).toBeNull()
  })
})

describe('移动端路由连续性（2.1）', () => {
  const flatten = (records: RouteRecordRaw[], prefix = ''): { path: string; name?: string }[] =>
    records.flatMap((record) => {
      const path = record.path.startsWith('/') ? record.path : `${prefix}/${record.path}`.replace(/\/+/g, '/')
      const self = record.name ? [{ path, name: String(record.name) }] : []
      return [...self, ...(record.children ? flatten(record.children, path === '/' ? '' : path) : [])]
    })
  const flat = flatten(routes)

  it('移动端详情页全部存在，且位于 /mobile 下', () => {
    const names = ['mobile-project-detail', 'mobile-execution-detail', 'mobile-defect-detail', 'mobile-task-detail', 'mobile-report-detail']
    names.forEach((name) => {
      const row = flat.find((item) => item.name === name)
      expect(row, `${name} 缺失`).toBeTruthy()
      expect(row?.path.startsWith('/mobile/')).toBe(true)
    })
  })

  it('旧 PC 链接会转换为移动端路由', () => {
    expect(toMobileLink('#/projects/P-2401')).toBe('/mobile/projects/P-2401')
    expect(toMobileLink('#/test-executions/RUN-0017')).toBe('/mobile/executions/RUN-0017')
    expect(toMobileLink('#/defects/BUG-0021')).toBe('/mobile/defects/BUG-0021')
    expect(toMobileLink('#/reports/RPT-2025-001')).toBe('/mobile/reports/RPT-2025-001')
    expect(toMobileLink('#/test-plans/TP-2401-02', { preferRecord: true })).toContain('/mobile/record?planId=TP-2401-02')
  })
})

describe('移动端详情布局（2.1）', () => {
  const detailFiles = [
    'MobileProjectDetail.vue',
    'MobileExecutionDetail.vue',
    'MobileDefectDetail.vue',
    'MobileTaskDetail.vue',
    'MobileReportDetail.vue',
  ]

  it('5 个详情页存在且内部跳转保持在 /mobile', () => {
    detailFiles.forEach((file) => {
      const path = resolve(process.cwd(), 'src/views/mobile', file)
      expect(existsSync(path), `${file} 缺失`).toBe(true)
      const content = readFileSync(path, 'utf8')
      expect(content).toContain('m-detail')
      expect(content).not.toMatch(/:to="`\/(projects|test-executions|defects|reports|test-plans)/)
      expect(content).not.toMatch(/router\.push\(`\/(projects|test-executions|defects|reports|test-plans)/)
    })
  })

  it('移动布局保留 5 个底部 Tab 与安全区', () => {
    const layout = readFileSync(resolve(process.cwd(), 'src/layouts/MobileLayout.vue'), 'utf8')
    ;['工作台', '任务', '记录', '消息', '项目'].forEach((label) => expect(layout).toContain(label))
    expect(layout).toContain('safe-area-inset-bottom')
    expect(layout).toContain('isTabActive')
  })
})

describe('草稿与附件（2.1）', () => {
  beforeEach(() => store.clear())

  it('草稿可保存、版本不匹配时忽略、可清除', () => {
    const key = 'mobile-record:M-002'
    const saved = saveDraft(key, { step: 2, values: { 'S-1': 42 } }, 2)
    expect(saved).not.toBeNull()
    expect(readDraft<{ step: number }>(key, 2)?.data.step).toBe(2)
    expect(readDraft(key, 1)).toBeNull()
    clearDraft(key)
    expect(readDraft(key, 2)).toBeNull()
  })

  it('附件大小、类型与分类校验', () => {
    expect(validateAttachment({ name: 'a.png', size: 1024, type: 'image/png' }).ok).toBe(true)
    expect(validateAttachment({ name: 'a.exe', size: 1024, type: 'application/octet-stream' }).ok).toBe(false)
    expect(validateAttachment({ name: 'big.csv', size: ATTACHMENT_LIMIT_BYTES + 1, type: 'text/csv' }).ok).toBe(false)
    expect(attachmentKind({ name: 'voice.webm', type: 'audio/webm' })).toBe('audio')
  })
})

describe('全局搜索（2.1）', () => {
  const db = createSeedDb()
  const index = buildSearchIndex(db)

  it('索引覆盖 10 类业务对象', () => {
    const types = new Set(index.map((hit) => hit.type))
    expect(types.size).toBe(10)
  })

  it('可通过编号或关键词找到对象', () => {
    expect(searchIndex(index, 'RUN-0017')[0]?.type).toBe('execution')
    expect(searchIndex(index, 'BUG-0021')[0]?.type).toBe('defect')
    expect(searchIndex(index, '纹波').length).toBeGreaterThan(0)
    expect(searchIndex(index, 'DEV-001')[0]?.type).toBe('device')
    expect(searchIndex(index, '不存在的编号xyz')).toHaveLength(0)
  })
})
