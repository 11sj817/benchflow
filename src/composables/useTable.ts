import { computed, ref, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'

export type SortOrder = 'ascending' | 'descending' | null

export interface SortState {
  prop: string | null
  order: SortOrder
}

export interface TableOptions<T> {
  pageSize?: number
  accessors?: Record<string, (row: T) => string | number | null | undefined>
}

/**
 * 表格分页 / 排序组合式函数。
 * 数据仍在页面 computed 中筛选，useTable 只负责排序与分页，避免重复逻辑。
 */
export function useTable<T>(source: ComputedRef<T[]> | Ref<T[]>, options: TableOptions<T> = {}) {
  const page = ref(1)
  const pageSize = ref(options.pageSize ?? 10)
  const sort = ref<SortState>({ prop: null, order: null })

  const sorted = computed<T[]>(() => {
    const rows = [...source.value]
    const { prop, order } = sort.value
    if (!prop || !order) return rows
    const accessor = options.accessors?.[prop]
    const dir = order === 'ascending' ? 1 : -1
    return rows.sort((a, b) => {
      const rawA = accessor ? accessor(a) : (a as Record<string, unknown>)[prop]
      const rawB = accessor ? accessor(b) : (b as Record<string, unknown>)[prop]
      if (rawA === rawB) return 0
      if (rawA === null || rawA === undefined || rawA === '') return 1
      if (rawB === null || rawB === undefined || rawB === '') return -1
      if (typeof rawA === 'number' && typeof rawB === 'number') return (rawA - rawB) * dir
      return String(rawA).localeCompare(String(rawB), 'zh-CN') * dir
    })
  })

  const total = computed(() => sorted.value.length)
  const maxPage = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
  const paged = computed(() => sorted.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))

  const onSortChange = (payload: { prop: string | null; order: SortOrder }) => {
    sort.value = { prop: payload.prop, order: payload.order }
    page.value = 1
  }

  const resetPage = () => {
    page.value = 1
  }

  watch(total, () => {
    if (page.value > maxPage.value) page.value = maxPage.value
  })

  return { page, pageSize, total, paged, sorted, sort, onSortChange, resetPage, maxPage }
}
