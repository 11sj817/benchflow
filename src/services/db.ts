import { reactive } from 'vue'
import type { AuditAction, AuditLog, Db, EntityKind } from '@/types'
import { CHANNEL_NAME, STORAGE_KEY, createSeedDb } from '@/mock/seed'

/**
 * 本地演示数据层：
 * - LocalStorage 持久化
 * - BroadcastChannel + storage 事件实现多标签页同步（明确标注为“本地演示模式”，不是云端协同）
 * - 所有写操作走 mutate()，统一追加审计日志
 */

export const db = reactive<Db>(createSeedDb())

const WRITER_ID = `w_${Math.random().toString(36).slice(2, 10)}`
let channel: BroadcastChannel | null = null
let applyingRemote = false

export const STORAGE_LIMIT_BYTES = 5 * 1024 * 1024

export function hydrate(data: Db): void {
  applyingRemote = true
  const target = db as unknown as Record<string, unknown>
  const source = data as unknown as Record<string, unknown>
  Object.keys(source).forEach((key) => {
    target[key] = source[key]
  })
  applyingRemote = false
}

export function isHydrating(): boolean {
  return applyingRemote
}

/** 从 LocalStorage 读取；结构不匹配时回落到种子数据。 */
export function loadDb(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      hydrate(createSeedDb())
      return false
    }
    const parsed = JSON.parse(raw) as Db
    if (!parsed || typeof parsed !== 'object' || parsed.meta?.schema !== createSeedDb().meta.schema) {
      hydrate(createSeedDb())
      persist()
      return false
    }
    hydrate(parsed)
    return true
  } catch {
    hydrate(createSeedDb())
    return false
  }
}

let persistTimer: number | null = null

export function persist(immediate = true): void {
  if (applyingRemote) return
  const write = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
    } catch (error) {
      console.warn('[BenchFlow] 本地存储写入失败，数据仅保留在内存中。', error)
    }
    channel?.postMessage({ type: 'db-changed', writer: WRITER_ID, at: Date.now() })
  }
  if (immediate) {
    write()
    return
  }
  if (persistTimer) window.clearTimeout(persistTimer)
  persistTimer = window.setTimeout(write, 120)
}

export interface MutationMeta {
  actorId: string
  actorName: string
  action: AuditAction
  entity: EntityKind
  entityId: string
  entityLabel: string
  summary: string
  projectId?: string
  audit?: boolean
}

export function pushAudit(meta: MutationMeta): void {
  const log: AuditLog = {
    id: `AUD-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    at: new Date().toISOString(),
    actorId: meta.actorId,
    actorName: meta.actorName,
    action: meta.action,
    entity: meta.entity,
    entityId: meta.entityId,
    entityLabel: meta.entityLabel,
    summary: meta.summary,
    projectId: meta.projectId,
  }
  db.audits.unshift(log)
  if (db.audits.length > 500) db.audits.length = 500
}

/** 唯一的写入口：修改数据 + 修订号 + 审计 + 持久化 + 广播。 */
export function mutate(fn: (draft: Db) => void, meta?: MutationMeta): void {
  fn(db)
  db.meta.revision += 1
  if (meta && meta.audit !== false) pushAudit(meta)
  persist()
}

export function resetDb(actor: { id: string; name: string }): void {
  const seed = createSeedDb()
  hydrate(seed)
  db.meta.revision += 1
  pushAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: 'reset',
    entity: 'setting',
    entityId: 'demo-data',
    entityLabel: '本地演示数据',
    summary: '恢复初始演示数据（覆盖本地修改）',
  })
  persist()
}

export function storageUsage(): { bytes: number; ratio: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? ''
    const bytes = new Blob([raw]).size
    return { bytes, ratio: Math.min(1, bytes / STORAGE_LIMIT_BYTES) }
  } catch {
    return { bytes: 0, ratio: 0 }
  }
}

/** 启动跨标签页同步；返回取消订阅函数。 */
export function initSync(onRemoteChange?: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined

  const reload = () => {
    loadDb()
    onRemoteChange?.()
  }

  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(CHANNEL_NAME)
    channel.onmessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; writer?: string } | null
      if (data?.type === 'db-changed' && data.writer !== WRITER_ID) reload()
    }
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY && event.newValue) reload()
  }
  window.addEventListener('storage', onStorage)

  return () => {
    window.removeEventListener('storage', onStorage)
    channel?.close()
    channel = null
  }
}
