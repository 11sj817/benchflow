import type {
  Attachment,
  Dataset,
  DatasetCategory,
  Device,
  DeviceCategory,
  DeviceStatus,
  FileKind,
  Template,
  TemplateParam,
  TemplateStep,
  TestCategory,
} from '@/types'
import { db, mutate } from './db'
import { getActor } from './actor'
import { parseCsv, readFileText } from '@/utils/csv'
import { nextCode, uid } from '@/utils/id'

const nowIso = () => new Date().toISOString()
const today = () => new Date().toISOString().slice(0, 10)

export interface DeviceInput {
  name: string
  category: DeviceCategory
  model: string
  serial: string
  vendor: string
  station: string
  ownerId: string
  calibrationDate: string
  calibrationDue: string
  status: DeviceStatus
  attachments: Attachment[]
}

export type CalibrationState = 'valid' | 'due_soon' | 'expired'

export const deviceService = {
  list(): Device[] {
    return db.devices
  },

  get(id: string): Device | undefined {
    return db.devices.find((d) => d.id === id)
  },

  create(input: DeviceInput): Device {
    const actor = getActor()
    const device: Device = {
      id: uid('DEV'),
      code: nextCode('DEV-', db.devices.map((d) => d.code), 3),
      ...input,
      usage: [],
      repairs: [],
      createdAt: nowIso(),
    }
    mutate(
      (draft) => {
        draft.devices.unshift(device)
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'create',
        entity: 'device',
        entityId: device.id,
        entityLabel: device.name,
        summary: `新增设备 ${device.code} · ${device.model}`,
      },
    )
    return device
  },

  update(id: string, patch: Partial<DeviceInput>): void {
    const actor = getActor()
    const target = db.devices.find((d) => d.id === id)
    if (!target) return
    mutate(
      (draft) => {
        const row = draft.devices.find((d) => d.id === id)
        if (row) Object.assign(row, patch)
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'update',
        entity: 'device',
        entityId: id,
        entityLabel: target.name,
        summary: `更新设备 ${target.code}`,
      },
    )
  },

  remove(id: string): void {
    const target = db.devices.find((d) => d.id === id)
    if (!target) return
    const used = db.executions.some((e) => e.deviceIds.includes(id)) || db.plans.some((p) => p.deviceIds.includes(id))
    if (used) throw new Error('该设备已被测试计划 / 执行记录引用，不能删除，可改为「已报废」。')
    const actor = getActor()
    mutate(
      (draft) => {
        draft.devices = draft.devices.filter((d) => d.id !== id)
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'delete',
        entity: 'device',
        entityId: id,
        entityLabel: target.name,
        summary: `删除设备 ${target.code}`,
      },
    )
  },

  addUsage(id: string, note: string, executionId?: string): void {
    const actor = getActor()
    mutate((draft) => {
      const row = draft.devices.find((d) => d.id === id)
      if (!row) return
      row.usage.unshift({ at: nowIso(), by: actor.id, executionId, note })
    })
  },

  addRepair(id: string, note: string, cost?: number): void {
    const actor = getActor()
    mutate(
      (draft) => {
        const row = draft.devices.find((d) => d.id === id)
        if (!row) return
        row.repairs.unshift({ at: nowIso(), note, cost })
        row.status = 'maintenance'
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'update',
        entity: 'device',
        entityId: id,
        entityLabel: db.devices.find((d) => d.id === id)?.name ?? id,
        summary: `登记维修：${note}`,
      },
    )
  },

  calibrationState(device: Device): CalibrationState {
    const due = new Date(device.calibrationDue).getTime()
    const now = new Date(today()).getTime()
    if (due < now) return 'expired'
    if (due - now <= 30 * 86400000) return 'due_soon'
    return 'valid'
  },

  alerts(): { device: Device; state: CalibrationState; days: number }[] {
    return db.devices
      .map((device) => {
        const days = Math.round((new Date(device.calibrationDue).getTime() - new Date(today()).getTime()) / 86400000)
        return { device, state: deviceService.calibrationState(device), days }
      })
      .filter((row) => row.state !== 'valid')
      .sort((a, b) => a.days - b.days)
  },

  usageCount(id: string): number {
    return db.executions.filter((e) => e.deviceIds.includes(id)).length
  },
}

export const MAX_INLINE_FILE = 2 * 1024 * 1024
const PREVIEW_ROWS = 30

const kindFromName = (name: string): FileKind => {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'csv') return 'csv'
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx'
  if (ext === 'json') return 'json'
  if (ext === 'png') return 'png'
  if (ext === 'jpg' || ext === 'jpeg') return 'jpg'
  if (ext === 'pdf') return 'pdf'
  if (ext === 'zip') return 'zip'
  return 'log'
}

export interface DatasetInput {
  name: string
  projectId: string
  category: DatasetCategory
  caseIds: string[]
  executionId?: string
  note: string
  sizeBytes: number
  previewHeaders?: string[]
  previewRows?: string[][]
  version?: string
}

export const datasetService = {
  list(): Dataset[] {
    return db.datasets
  },

  get(id: string): Dataset | undefined {
    return db.datasets.find((d) => d.id === id)
  },

  /** 解析文件并保存元信息；超过 2MB 的文件仅用于演示说明，不写入浏览器存储。 */
  async ingest(file: File, input: Omit<DatasetInput, 'name' | 'sizeBytes'>): Promise<Dataset> {
    if (file.size > MAX_INLINE_FILE) {
      throw new Error(
        `演示模式下单个文件需 ≤ ${(MAX_INLINE_FILE / 1024 / 1024).toFixed(0)} MB（当前 ${(file.size / 1024 / 1024).toFixed(1)} MB）。大型示波器波形请接入后端对象存储。`,
      )
    }
    let previewHeaders: string[] | undefined
    let previewRows: string[][] | undefined
    const kind = kindFromName(file.name)
    if (kind === 'csv') {
      const text = await readFileText(file)
      const parsed = parseCsv(text)
      previewHeaders = parsed.headers
      previewRows = parsed.rows.slice(0, PREVIEW_ROWS)
    }
    return datasetService.create({
      ...input,
      name: file.name,
      sizeBytes: file.size,
      previewHeaders,
      previewRows,
    })
  },

  create(input: DatasetInput): Dataset {
    const actor = getActor()
    const dataset: Dataset = {
      id: uid('DS'),
      code: nextCode('DS-', db.datasets.map((d) => d.code), 3),
      kind: kindFromName(input.name),
      ...input,
      version: input.version ?? 'v1',
      uploadedBy: actor.id,
      uploadedAt: nowIso(),
    }
    mutate(
      (draft) => {
        draft.datasets.unshift(dataset)
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'upload',
        entity: 'dataset',
        entityId: dataset.id,
        entityLabel: dataset.name,
        summary: `上传数据集 ${dataset.name}`,
        projectId: input.projectId,
      },
    )
    return dataset
  },

  remove(id: string): void {
    const target = db.datasets.find((d) => d.id === id)
    if (!target) return
    const actor = getActor()
    mutate(
      (draft) => {
        draft.datasets = draft.datasets.filter((d) => d.id !== id)
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'delete',
        entity: 'dataset',
        entityId: id,
        entityLabel: target.name,
        summary: `删除数据集 ${target.code}`,
        projectId: target.projectId,
      },
    )
  },

  totalBytes(): number {
    return db.datasets.reduce((sum, d) => sum + d.sizeBytes, 0)
  },
}

export interface TemplateInput {
  name: string
  category: TestCategory
  description: string
  params: TemplateParam[]
  steps: TemplateStep[]
}

export const templateService = {
  list(): Template[] {
    return db.templates
  },

  get(id: string): Template | undefined {
    return db.templates.find((t) => t.id === id)
  },

  create(input: TemplateInput): Template {
    const actor = getActor()
    const template: Template = {
      id: uid('TPL'),
      code: nextCode('TPL-', db.templates.map((t) => t.code), 3),
      ...input,
      disclaimer: '自定义模板：由团队维护，仅作为内部测试设计起点，不代表认证符合性。',
      builtin: false,
      createdAt: nowIso(),
    }
    mutate(
      (draft) => {
        draft.templates.unshift(template)
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'create',
        entity: 'case',
        entityId: template.id,
        entityLabel: template.name,
        summary: `创建测试模板 ${template.code}`,
      },
    )
    return template
  },

  duplicate(id: string): Template | undefined {
    const source = db.templates.find((t) => t.id === id)
    if (!source) return undefined
    return templateService.create({
      name: `${source.name}（副本）`,
      category: source.category,
      description: source.description,
      params: source.params,
      steps: source.steps,
    })
  },

  remove(id: string): void {
    const target = db.templates.find((t) => t.id === id)
    if (!target) return
    if (target.builtin) throw new Error('预置参考模板不能删除，可复制后修改。')
    const actor = getActor()
    mutate((draft) => {
      draft.templates = draft.templates.filter((t) => t.id !== id)
    })
    void actor
  },
}
