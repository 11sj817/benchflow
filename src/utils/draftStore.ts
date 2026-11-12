export interface DraftEnvelope<T> {
  version: number
  savedAt: string
  data: T
}

const PREFIX = 'benchflow.draft.'

/**
 * 本地草稿存储：用于移动端分步记录与工位模式的中断恢复。
 * 与业务数据分离，避免草稿污染正式执行记录。
 */
export function saveDraft<T>(key: string, data: T, version = 1): DraftEnvelope<T> | null {
  try {
    const envelope: DraftEnvelope<T> = { version, savedAt: new Date().toISOString(), data }
    localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(envelope))
    return envelope
  } catch (error) {
    console.warn('[BenchFlow] 草稿保存失败', error)
    return null
  }
}

export function readDraft<T>(key: string, version = 1): DraftEnvelope<T> | null {
  try {
    const raw = localStorage.getItem(`${PREFIX}${key}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DraftEnvelope<T>
    if (!parsed || parsed.version !== version || !parsed.data) return null
    return parsed
  } catch {
    return null
  }
}

export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(`${PREFIX}${key}`)
  } catch {
    // ignore
  }
}

export function draftAgeLabel(savedAt: string): string {
  const diff = Date.now() - new Date(savedAt).getTime()
  if (!Number.isFinite(diff) || diff < 0) return '刚刚'
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  return `${Math.floor(hours / 24)} 天前`
}

export const DRAFT_PREFIX = PREFIX
