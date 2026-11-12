import { describe, expect, it } from 'vitest'
import { createSeedDb } from '@/mock/seed'

describe('演示数据完整性', () => {
  const db = createSeedDb()

  it('覆盖四个项目、一个完整产品版本体系与至少 20 条执行', () => {
    expect(db.projects).toHaveLength(4)
    expect(db.products.length).toBeGreaterThanOrEqual(4)
    expect(db.executions.length).toBeGreaterThanOrEqual(20)
    const dcDcVersions = db.versions.filter((v) => v.productId === 'PRD-100')
    expect(dcDcVersions.some((v) => v.version === 'PCB V1.1')).toBe(true)
    expect(dcDcVersions.some((v) => v.version === 'PCB V1.2')).toBe(true)
    expect(dcDcVersions.some((v) => v.version === 'FW V0.8')).toBe(true)
  })

  it('RUN-0017 因纹波 65mV 失败，并关联 BUG-0021', () => {
    const run = db.executions.find((e) => e.id === 'RUN-0017')
    expect(run).toBeDefined()
    expect(run?.result).toBe('FAIL')
    const ripple = run?.measurements.find((m) => m.param.includes('满载'))
    expect(ripple?.value).toBe(65)
    expect(ripple?.max).toBe(50)
    expect(run?.defectIds).toContain('BUG-0021')

    const defect = db.defects.find((d) => d.id === 'BUG-0021')
    expect(defect?.executionId).toBe('RUN-0017')
    expect(defect?.fixVersionId).toBe('VER-1003')
    expect(defect?.status).toBe('closed')
    expect(defect?.verification?.executionId).toBeTruthy()
  })

  it('BUG-0021 的回归执行必须使用同一用例且为 PASS', () => {
    const defect = db.defects.find((d) => d.id === 'BUG-0021')!
    const regression = db.executions.find((e) => e.id === defect.verification?.executionId)
    expect(regression).toBeDefined()
    expect(regression?.caseId).toBe(defect.caseId)
    expect(regression?.result).toBe('PASS')
    expect(regression?.hardwareVersionId).toBe('VER-1003')
    expect(defect.regressionExecutionIds).toContain('RUN-0019')
  })

  it('计划、用例、需求、缺陷之间不存在悬空引用', () => {
    const caseIds = new Set(db.cases.map((c) => c.id))
    const planIds = new Set(db.plans.map((p) => p.id))
    const versionIds = new Set(db.versions.map((v) => v.id))
    const projectIds = new Set(db.projects.map((p) => p.id))
    const productIds = new Set(db.products.map((p) => p.id))
    const memberIds = new Set(db.members.map((m) => m.id))
    const executionIds = new Set(db.executions.map((e) => e.id))

    db.plans.forEach((plan) => {
      plan.caseIds.forEach((id) => expect(caseIds.has(id)).toBe(true))
      expect(projectIds.has(plan.projectId)).toBe(true)
      expect(productIds.has(plan.productId)).toBe(true)
      expect(versionIds.has(plan.hardwareVersionId)).toBe(true)
      plan.assigneeIds.forEach((id) => expect(memberIds.has(id)).toBe(true))
    })

    db.executions.forEach((run) => {
      expect(caseIds.has(run.caseId)).toBe(true)
      expect(planIds.has(run.planId)).toBe(true)
      expect(versionIds.has(run.hardwareVersionId)).toBe(true)
      expect(memberIds.has(run.testerId)).toBe(true)
    })

    db.requirements.forEach((req) => {
      req.caseIds.forEach((id) => expect(caseIds.has(id)).toBe(true))
      req.defectIds.forEach((id) => expect(db.defects.some((d) => d.id === id)).toBe(true))
    })

    db.defects.forEach((defect) => {
      expect(projectIds.has(defect.projectId)).toBe(true)
      if (defect.executionId) expect(executionIds.has(defect.executionId)).toBe(true)
      if (defect.verification?.executionId) expect(executionIds.has(defect.verification.executionId)).toBe(true)
    })
  })

  it('每个用例的测量上下限配置完整，且下限不大于上限', () => {
    db.cases.forEach((testCase) => {
      testCase.steps.forEach((step) => {
        if (!step.param) return
        expect(step.param.unit.length).toBeGreaterThan(0)
        if (step.param.min != null && step.param.max != null) {
          expect(step.param.min).toBeLessThanOrEqual(step.param.max)
        }
      })
    })
  })
})
