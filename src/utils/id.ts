export const uid = (prefix = 'ID'): string =>
  `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`

export function nextCode(prefix: string, existing: string[], pad = 4): string {
  const nums = existing
    .map((code) => code.replace(prefix, ''))
    .map((rest) => Number.parseInt(rest.replace(/[^0-9].*$/, ''), 10))
    .filter((n) => Number.isFinite(n))
  const max = nums.length ? Math.max(...nums) : 0
  return `${prefix}${String(max + 1).padStart(pad, '0')}`
}

/** TP-2401-01 → TP-2401-02（按项目维度递增） */
export function nextPlanCode(projectCode: string, existing: string[]): string {
  const prefix = `TP-${projectCode.replace(/^P-/, '')}-`
  const nums = existing
    .filter((code) => code.startsWith(prefix))
    .map((code) => Number.parseInt(code.slice(prefix.length), 10))
    .filter((n) => Number.isFinite(n))
  const max = nums.length ? Math.max(...nums) : 0
  return `${prefix}${String(max + 1).padStart(2, '0')}`
}

export function nextReportCode(existing: string[], year = new Date().getFullYear()): string {
  const prefix = `RPT-${year}-`
  const nums = existing
    .filter((code) => code.startsWith(prefix))
    .map((code) => Number.parseInt(code.slice(prefix.length), 10))
    .filter((n) => Number.isFinite(n))
  const max = nums.length ? Math.max(...nums) : 0
  return `${prefix}${String(max + 1).padStart(3, '0')}`
}
