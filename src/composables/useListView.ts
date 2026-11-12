import { ref, watch } from 'vue'

export type ViewMode = 'table' | 'cards'

export interface SavedView {
  name: string
  filters: Record<string, string>
  at: string
}

const PREFIX = 'benchflow.listview.'

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore quota
  }
}

/**
 * 列表页共享的视图状态：表格/卡片、高级筛选、保存的筛选方案。
 * 每个页面用独立 key，避免相互覆盖。
 */
export function useListView(key: string) {
  const viewMode = ref<ViewMode>(readJson<ViewMode>(`${PREFIX}${key}.view`, 'table'))
  const advancedOpen = ref(readJson<boolean>(`${PREFIX}${key}.advanced`, false))
  const savedViews = ref<SavedView[]>(readJson<SavedView[]>(`${PREFIX}${key}.saved`, []))

  watch(viewMode, (value) => writeJson(`${PREFIX}${key}.view`, value))
  watch(advancedOpen, (value) => writeJson(`${PREFIX}${key}.advanced`, value))

  const saveView = (name: string, filters: Record<string, string>) => {
    const row: SavedView = { name: name.trim() || `方案 ${savedViews.value.length + 1}`, filters, at: new Date().toISOString() }
    savedViews.value = [row, ...savedViews.value.filter((item) => item.name !== row.name)].slice(0, 8)
    writeJson(`${PREFIX}${key}.saved`, savedViews.value)
    return row
  }

  const removeView = (name: string) => {
    savedViews.value = savedViews.value.filter((item) => item.name !== name)
    writeJson(`${PREFIX}${key}.saved`, savedViews.value)
  }

  const persistFilters = (filters: Record<string, string>) => {
    writeJson(`${PREFIX}${key}.filters`, filters)
  }

  const loadFilters = (): Record<string, string> => readJson<Record<string, string>>(`${PREFIX}${key}.filters`, {})

  return { viewMode, advancedOpen, savedViews, saveView, removeView, persistFilters, loadFilters }
}
