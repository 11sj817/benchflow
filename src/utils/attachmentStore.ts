export const ATTACHMENT_LIMIT_BYTES = 2 * 1024 * 1024
export const ATTACHMENT_DB = 'benchflow.attachments'
export const ATTACHMENT_STORE = 'files'

export interface StoredAttachment {
  id: string
  name: string
  size: number
  type: string
  kind: 'image' | 'audio' | 'csv' | 'file'
  blob: Blob
  createdAt: string
}

export interface AttachmentMeta {
  id: string
  name: string
  size: number
  type: string
  kind: StoredAttachment['kind']
  createdAt: string
}

export function isAttachmentStoreSupported(): boolean {
  return typeof indexedDB !== 'undefined'
}

export function attachmentKind(file: { name: string; type: string }): StoredAttachment['kind'] {
  if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(file.name)) return 'image'
  if (file.type.startsWith('audio/') || /\.(webm|mp3|wav|m4a|ogg)$/i.test(file.name)) return 'audio'
  if (/\.csv$/i.test(file.name)) return 'csv'
  return 'file'
}

export function validateAttachment(file: { name: string; size: number; type?: string }): { ok: boolean; error?: string } {
  if (!file.name.trim()) return { ok: false, error: '文件名不能为空' }
  if (file.size <= 0) return { ok: false, error: '文件内容为空' }
  if (file.size > ATTACHMENT_LIMIT_BYTES) {
    return {
      ok: false,
      error: `单个附件需 ≤ ${(ATTACHMENT_LIMIT_BYTES / 1024 / 1024).toFixed(0)} MB（当前 ${(file.size / 1024 / 1024).toFixed(1)} MB）`,
    }
  }
  const kind = attachmentKind({ name: file.name, type: file.type ?? '' })
  if (kind === 'file' && !/\.(csv|txt|log|json|pdf|zip|xlsx?)$/i.test(file.name)) {
    return { ok: false, error: '演示环境仅支持图片、音频、CSV/日志、PDF 与 ZIP 附件' }
  }
  return { ok: true }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isAttachmentStoreSupported()) {
      reject(new Error('当前浏览器不支持 IndexedDB，无法本地保存附件'))
      return
    }
    const request = indexedDB.open(ATTACHMENT_DB, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(ATTACHMENT_STORE)) {
        db.createObjectStore(ATTACHMENT_STORE, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('无法打开附件存储'))
  })
}

export async function saveAttachment(input: {
  name: string
  size?: number
  type?: string
  blob: Blob
}): Promise<AttachmentMeta> {
  const validation = validateAttachment({
    name: input.name,
    size: input.size ?? input.blob.size,
    type: input.type ?? input.blob.type,
  })
  if (!validation.ok) throw new Error(validation.error)
  const db = await openDb()
  const id = `ATT-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
  const record: StoredAttachment = {
    id,
    name: input.name,
    size: input.blob.size,
    type: input.type ?? input.blob.type,
    kind: attachmentKind({ name: input.name, type: input.type ?? input.blob.type }),
    blob: input.blob,
    createdAt: new Date().toISOString(),
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(ATTACHMENT_STORE, 'readwrite')
    tx.objectStore(ATTACHMENT_STORE).put(record)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('附件写入失败'))
  })
  db.close()
  return {
    id: record.id,
    name: record.name,
    size: record.size,
    type: record.type,
    kind: record.kind,
    createdAt: record.createdAt,
  }
}

export async function saveFileAttachment(file: File): Promise<AttachmentMeta> {
  return saveAttachment({ name: file.name, size: file.size, type: file.type, blob: file })
}

export async function getAttachment(id: string): Promise<StoredAttachment | undefined> {
  if (!isAttachmentStoreSupported()) return undefined
  const db = await openDb()
  const result = await new Promise<StoredAttachment | undefined>((resolve, reject) => {
    const tx = db.transaction(ATTACHMENT_STORE, 'readonly')
    const request = tx.objectStore(ATTACHMENT_STORE).get(id)
    request.onsuccess = () => resolve(request.result as StoredAttachment | undefined)
    request.onerror = () => reject(request.error ?? new Error('附件读取失败'))
  })
  db.close()
  return result
}

export async function getAttachments(ids: string[]): Promise<StoredAttachment[]> {
  const rows: StoredAttachment[] = []
  for (const id of ids) {
    const row = await getAttachment(id)
    if (row) rows.push(row)
  }
  return rows
}

export async function deleteAttachment(id: string): Promise<void> {
  if (!isAttachmentStoreSupported()) return
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(ATTACHMENT_STORE, 'readwrite')
    tx.objectStore(ATTACHMENT_STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('附件删除失败'))
  })
  db.close()
}

export async function deleteAttachments(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => deleteAttachment(id)))
}
