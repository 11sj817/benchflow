/** 统计计算：全部为纯函数，便于单元测试。 */

export const mean = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length

export const stdDev = (values: number[]): number => {
  if (values.length < 2) return 0
  const m = mean(values)
  const variance = values.reduce((acc, v) => acc + (v - m) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

export const median = (values: number[]): number => {
  if (values.length === 0) return 0
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid]
}

export const percentile = (values: number[], p: number): number => {
  if (values.length === 0) return 0
  const s = [...values].sort((a, b) => a - b)
  const idx = (s.length - 1) * p
  const lower = Math.floor(idx)
  const upper = Math.ceil(idx)
  if (lower === upper) return s[lower]
  return s[lower] + (s[upper] - s[lower]) * (idx - lower)
}

export interface CpkResult {
  n: number
  mean: number
  sd: number
  cp: number | null
  cpk: number | null
  cpu: number | null
  cpl: number | null
  applicable: boolean
  reasons: string[]
  note: string
}

/**
 * 过程能力指数。仅当样本量、变异与规格条件满足时才给出数值结论；
 * 否则返回 applicable=false 并说明原因，避免误导。
 */
export function cpk(values: number[], lsl?: number | null, usl?: number | null): CpkResult {
  const n = values.length
  const m = mean(values)
  const sd = stdDev(values)
  const reasons: string[] = []
  if (n < 25) reasons.push(`样本量 n=${n} < 25，不足以估计过程能力`)
  if (sd === 0) reasons.push('样本标准差为 0，过程无变异或数据退化')
  if ((lsl === null || lsl === undefined) && (usl === null || usl === undefined)) reasons.push('缺少规格上下限')
  const applicable = reasons.length === 0
  let cp: number | null = null
  let cpu: number | null = null
  let cpl: number | null = null
  let cpkValue: number | null = null
  if (applicable && lsl != null && usl != null) {
    cp = Math.abs(usl - lsl) / (6 * sd)
    cpu = (usl - m) / (3 * sd)
    cpl = (m - lsl) / (3 * sd)
    cpkValue = Math.min(cpu, cpl)
  } else if (sd > 0 && (lsl != null || usl != null)) {
    cpu = usl != null ? (usl - m) / (3 * sd) : null
    cpl = lsl != null ? (m - lsl) / (3 * sd) : null
    cpkValue = Math.min(cpu ?? Infinity, cpl ?? Infinity)
    if (!Number.isFinite(cpkValue)) cpkValue = null
  }
  return {
    n,
    mean: m,
    sd,
    cp,
    cpk: cpkValue,
    cpu,
    cpl,
    applicable,
    reasons,
    note: applicable
      ? '计算假设：过程受控、数据近似正态、样本为连续生产条件下的独立观测。'
      : '仅展示描述性统计；Cpk 结论需在补充样本并确认过程受控后给出。',
  }
}

export interface HistogramBin {
  from: number
  to: number
  count: number
}

export function histogram(values: number[], binCount = 8): HistogramBin[] {
  if (values.length === 0) return []
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (min === max) return [{ from: min, to: max, count: values.length }]
  const width = (max - min) / binCount
  const bins: HistogramBin[] = Array.from({ length: binCount }, (_, i) => ({
    from: min + i * width,
    to: min + (i + 1) * width,
    count: 0,
  }))
  values.forEach((v) => {
    let idx = Math.floor((v - min) / width)
    if (idx >= binCount) idx = binCount - 1
    if (idx < 0) idx = 0
    bins[idx].count += 1
  })
  return bins
}

export interface BoxStats {
  min: number
  q1: number
  median: number
  q3: number
  max: number
  outliers: number[]
}

export function boxStats(values: number[]): BoxStats {
  if (values.length === 0) return { min: 0, q1: 0, median: 0, q3: 0, max: 0, outliers: [] }
  const q1 = percentile(values, 0.25)
  const q3 = percentile(values, 0.75)
  const iqr = q3 - q1
  const lowFence = q1 - 1.5 * iqr
  const highFence = q3 + 1.5 * iqr
  const inside = values.filter((v) => v >= lowFence && v <= highFence)
  return {
    min: Math.min(...inside),
    q1,
    median: median(values),
    q3,
    max: Math.max(...inside),
    outliers: values.filter((v) => v < lowFence || v > highFence),
  }
}

export const ratio = (part: number, total: number): number => (total === 0 ? 0 : Math.round((part / total) * 1000) / 10)

export function groupBy<T, K extends string>(rows: T[], keyFn: (row: T) => K): Record<K, T[]> {
  return rows.reduce<Record<K, T[]>>(
    (acc, row) => {
      const key = keyFn(row)
      if (!acc[key]) acc[key] = []
      acc[key].push(row)
      return acc
    },
    {} as Record<K, T[]>,
  )
}

export function unique<T>(rows: T[]): T[] {
  return Array.from(new Set(rows))
}
