import { beforeEach, describe, expect, it } from 'vitest'
import { db, loadDb, mutate, resetDb, storageUsage } from '@/services/db'
import { defectService } from '@/services/defectService'
import { executionService, judgeValue } from '@/services/executionService'
import { STORAGE_KEY } from '@/mock/seed'

function installMemoryStorage() {
  const store = new Map<string, string>()
  const storage: Storage = {
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
  }
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true })
  return store
}

const store = installMemoryStorage()
const actor = { id: 'M-002', name: '张工' }

beforeEach(() => {
  store.clear()
  resetDb(actor)
})

describe('本地数据持久化', () => {
  it('写入后可以从 LocalStorage 重新载入', () => {
    mutate(
      (draft) => {
        const project = draft.projects.find((p) => p.id === 'P-2401')
        if (project) project.name = '48V-12V DC-DC 电源（持久化测试）'
      },
      {
        actorId: 'M-002',
        actorName: '张工',
        action: 'update',
        entity: 'project',
        entityId: 'P-2401',
        entityLabel: '48V-12V DC-DC 电源',
        summary: '持久化单元测试',
      },
    )

    expect(store.has(STORAGE_KEY)).toBe(true)
    // 模拟“刷新前被内存篡改但未写入存储”的场景，loadDb 应从 LocalStorage 恢复。
    const inMemory = db.projects.find((p) => p.id === 'P-2401')
    if (inMemory) inMemory.name = '仅内存中的临时名称'
    loadDb()
    expect(db.projects.find((p) => p.id === 'P-2401')?.name).toContain('持久化测试')
    expect(db.audits.some((a) => a.summary === '持久化单元测试')).toBe(true)
  })

  it('恢复初始演示数据会覆盖本地修改并记录审计', () => {
    mutate((draft) => {
      if (draft.projects[0]) draft.projects[0].name = '临时改名'
    })
    resetDb(actor)
    expect(db.projects.find((p) => p.id === 'P-2401')?.name).toBe('48V-12V DC-DC 电源')
    expect(db.audits[0].action).toBe('reset')
    expect(storageUsage().bytes).toBeGreaterThan(0)
  })
})

describe('测试执行判定闭环', () => {
  it('按用例阈值判定 PASS / FAIL / PENDING', () => {
    expect(judgeValue(42, null, 50)).toBe('PASS')
    expect(judgeValue(65, null, 50)).toBe('FAIL')
    expect(judgeValue(94, 94, null)).toBe('PASS')
    expect(judgeValue(93.9, 94, null)).toBe('FAIL')
    expect(judgeValue(null, 0, 10)).toBe('PENDING')
  })

  it('必填测量项缺失时禁止提交', () => {
    const run = executionService.create({
      planId: 'TP-2401-02',
      caseId: 'TC-1002',
      testerId: 'M-005',
      deviceIds: ['DEV-001'],
      environment: { temperature: 25, humidity: 48, inputVoltage: 48, load: 50, note: '' },
      conditions: '48V/50A',
      note: '',
    })
    expect(run.measurements.length).toBeGreaterThan(0)
    expect(() => executionService.finish(run.id)).toThrow(/必填测量项/)
  })

  it('失败执行的缺陷预填包含测量超限信息', () => {
    const draft = executionService.defectDraft('RUN-0017')
    expect(draft).not.toBeNull()
    expect(String(draft?.title)).toContain('纹波')
    expect(String(draft?.description)).toContain('65')
    expect(draft?.executionId).toBe('RUN-0017')
  })
})

describe('缺陷生命周期约束', () => {
  it('无验证记录时不能关闭缺陷', () => {
    expect(() => defectService.close('BUG-0019')).toThrow(/验证记录/)
  })

  it('只有已修复状态可以提交验证', () => {
    expect(() => defectService.verify('BUG-0022', { executionId: 'RUN-0020', note: 'x' })).toThrow(/已修复/)
  })

  it('验证必须使用同一用例的 PASS 执行', () => {
    defectService.transition('BUG-0022', 'resolved', '单元测试提交修复')
    expect(defectService.get('BUG-0022')?.status).toBe('resolved')
    expect(() => defectService.verify('BUG-0022', { executionId: 'RUN-0017', note: '错误用例' })).toThrow(/同一测试用例/)
    expect(() => defectService.verify('BUG-0022', { executionId: 'RUN-0020', note: '失败执行' })).toThrow(/PASS/)
  })

  it('完整闭环：修复 → PASS 回归 → 验证 → 关闭', () => {
    const run = executionService.create({
      planId: 'TP-2403-01',
      caseId: 'TC-3001',
      testerId: 'M-005',
      deviceIds: [],
      environment: { temperature: 25, humidity: 50, inputVoltage: 12, load: 1, note: '' },
      conditions: 'CAN FD 2Mbps 回归',
      note: '单元测试回归',
    })
    run.measurements.forEach((measurement) => {
      executionService.setMeasurement(run.id, measurement.id, 0.02)
    })
    expect(executionService.finish(run.id)).toBe('PASS')

    defectService.transition('BUG-0022', 'resolved', '已修复')
    defectService.verify('BUG-0022', { executionId: run.id, note: '100000 帧无丢帧' })
    expect(defectService.get('BUG-0022')?.status).toBe('verified')
    defectService.close('BUG-0022', '验证通过')
    expect(defectService.get('BUG-0022')?.status).toBe('closed')
    expect(defectService.get('BUG-0022')?.closedAt).toBeTruthy()
  })

  it('状态流转不允许跳步', () => {
    expect(() => defectService.transition('BUG-0023', 'closed')).toThrow(/不允许/)
  })
})
