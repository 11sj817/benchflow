export interface RecentItem {
  key: string
  type: 'project' | 'execution' | 'defect' | 'plan' | 'case' | 'report' | 'product' | 'device' | 'dataset'
  id: string
  title: string
  subtitle?: string
  to: string
  at: string
}

const KEY = 'benchflow.recents.v1'
const MAX_ITEMS = 12

export function loadRecents(): RecentItem[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as RecentItem[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item) => item && item.to && item.title).slice(0, MAX_ITEMS)
  } catch {
    return []
  }
}

export function rememberRecent(item: Omit<RecentItem, 'at'>): RecentItem[] {
  const current = loadRecents().filter((row) => row.to !== item.to)
  const next = [{ ...item, at: new Date().toISOString() }, ...current].slice(0, MAX_ITEMS)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // ignore quota errors
  }
  return next
}

export function clearRecents(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
