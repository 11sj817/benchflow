import { describe, expect, it } from 'vitest'
import { boxStats, cpk, histogram, mean, percentile, stdDev } from '@/utils/stats'

describe('统计与过程能力', () => {
  const sample = Array.from({ length: 30 }, (_, i) => 30 + (i % 10))

  it('均值与样本标准差', () => {
    expect(mean([2, 4, 6])).toBe(4)
    expect(stdDev([2, 4, 6])).toBeCloseTo(2, 5)
    expect(stdDev([5])).toBe(0)
  })

  it('样本量不足时不给出 Cpk 结论', () => {
    const result = cpk([40, 42, 44, 41], null, 50)
    expect(result.applicable).toBe(false)
    expect(result.reasons.join('')).toContain('样本量')
    expect(result.n).toBe(4)
  })

  it('样本充足且单侧上限时计算 CPU=Cpk', () => {
    const result = cpk(sample, null, 50)
    expect(result.applicable).toBe(true)
    expect(result.cp).toBeNull()
    expect(result.cpu).toBeCloseTo(result.cpk ?? 0, 6)
    expect(result.cpk).toBeGreaterThan(0)
  })

  it('双侧规格计算 Cp 与 Cpk，并识别偏移', () => {
    const result = cpk(sample, 20, 50)
    expect(result.applicable).toBe(true)
    expect(result.cp).not.toBeNull()
    expect(result.cpk).toBeCloseTo(Math.min(result.cpu ?? 0, result.cpl ?? 0), 6)
  })

  it('无规格限与零变异都被判定为不适用', () => {
    expect(cpk(sample).applicable).toBe(false)
    expect(cpk(new Array(30).fill(42), null, 50).applicable).toBe(false)
  })

  it('直方图计数总和等于样本量', () => {
    const bins = histogram(sample, 8)
    expect(bins).toHaveLength(8)
    expect(bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(sample.length)
  })

  it('箱线统计四分位与离群点', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 100]
    const box = boxStats(values)
    expect(box.median).toBe(6)
    expect(box.outliers).toContain(100)
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5)
  })
})
