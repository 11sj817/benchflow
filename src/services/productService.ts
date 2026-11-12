import type {
  ChangeCategory,
  Product,
  ProductType,
  ProductVersion,
  RunResult,
  VersionChange,
  VersionKind,
  VersionStatus,
} from '@/types'
import { db, mutate } from './db'
import { getActor } from './actor'
import { nextCode, uid } from '@/utils/id'

const nowIso = () => new Date().toISOString()

export interface ProductInput {
  name: string
  type: ProductType
  description: string
  projectId: string
  ownerId: string
}

export interface VersionInput {
  productId: string
  kind: VersionKind
  version: string
  label: string
  notes: string
  changeItems: VersionChange[]
  status: VersionStatus
  attachmentNames: string[]
}

export interface DiffRow {
  item: string
  left: string
  right: string
  category: ChangeCategory
  changed: boolean
}

export interface TestDiffRow {
  caseId: string
  caseName: string
  left: RunResult | '—'
  right: RunResult | '—'
}

export interface DefectDiffRow {
  code: string
  title: string
  left: boolean
  right: boolean
}

export interface VersionCompare {
  left: ProductVersion
  right: ProductVersion
  rows: DiffRow[]
  tests: TestDiffRow[]
  defects: DefectDiffRow[]
  summary: { changedItems: number; improved: number; regressed: number }
}

const latestRunFor = (versionId: string, caseId: string) =>
  db.executions
    .filter((e) => e.hardwareVersionId === versionId && e.caseId === caseId)
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))[0]

export const productService = {
  list(projectId?: string): Product[] {
    return projectId ? db.products.filter((p) => p.projectId === projectId) : db.products
  },

  get(id: string): Product | undefined {
    return db.products.find((p) => p.id === id)
  },

  create(input: ProductInput): Product {
    const actor = getActor()
    const product: Product = {
      id: uid('PRD'),
      code: nextCode('PRD-', db.products.map((p) => p.code), 3),
      ...input,
      createdAt: nowIso(),
    }
    mutate(
      (draft) => {
        draft.products.unshift(product)
        const project = draft.projects.find((p) => p.id === input.projectId)
        if (project && !project.productIds.includes(product.id)) project.productIds.push(product.id)
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'create',
        entity: 'product',
        entityId: product.id,
        entityLabel: product.name,
        summary: `创建产品 ${product.name}`,
        projectId: input.projectId,
      },
    )
    return product
  },

  update(id: string, patch: Partial<ProductInput>): void {
    const actor = getActor()
    const target = db.products.find((p) => p.id === id)
    if (!target) return
    mutate(
      (draft) => {
        const row = draft.products.find((p) => p.id === id)
        if (row) Object.assign(row, patch)
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'update',
        entity: 'product',
        entityId: id,
        entityLabel: target.name,
        summary: `更新产品 ${target.code}`,
        projectId: target.projectId,
      },
    )
  },

  versions(productId?: string): ProductVersion[] {
    return productId ? db.versions.filter((v) => v.productId === productId) : db.versions
  },

  getVersion(id: string): ProductVersion | undefined {
    return db.versions.find((v) => v.id === id)
  },

  createVersion(input: VersionInput): ProductVersion {
    const actor = getActor()
    const version: ProductVersion = {
      id: uid('VER'),
      ...input,
      releasedAt: input.status === 'released' ? nowIso() : undefined,
      createdBy: actor.id,
      createdAt: nowIso(),
    }
    mutate(
      (draft) => {
        draft.versions.unshift(version)
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'create',
        entity: 'version',
        entityId: version.id,
        entityLabel: `${version.label}`,
        summary: `创建版本 ${version.version}`,
        projectId: db.products.find((p) => p.id === input.productId)?.projectId,
      },
    )
    return version
  },

  updateVersion(id: string, patch: Partial<VersionInput>): void {
    const actor = getActor()
    const target = db.versions.find((v) => v.id === id)
    if (!target) return
    mutate(
      (draft) => {
        const row = draft.versions.find((v) => v.id === id)
        if (!row) return
        Object.assign(row, patch)
        if (patch.status === 'released' && !row.releasedAt) row.releasedAt = nowIso()
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'update',
        entity: 'version',
        entityId: id,
        entityLabel: target.label,
        summary: `更新版本 ${target.version}`,
        projectId: db.products.find((p) => p.id === target.productId)?.projectId,
      },
    )
  },

  removeVersion(id: string): void {
    const target = db.versions.find((v) => v.id === id)
    if (!target) return
    const linked =
      db.executions.some((e) => e.hardwareVersionId === id || e.firmwareVersionId === id) ||
      db.plans.some((p) => p.hardwareVersionId === id || p.firmwareVersionId === id) ||
      db.defects.some((d) => d.fixVersionId === id)
    if (linked) throw new Error('该版本已被测试计划 / 执行 / 缺陷引用，不能删除，可改为「已废弃」状态。')
    const actor = getActor()
    mutate(
      (draft) => {
        draft.versions = draft.versions.filter((v) => v.id !== id)
      },
      {
        actorId: actor.id,
        actorName: actor.name,
        action: 'delete',
        entity: 'version',
        entityId: id,
        entityLabel: target.label,
        summary: `删除版本 ${target.version}`,
        projectId: db.products.find((p) => p.id === target.productId)?.projectId,
      },
    )
  },

  compare(leftId: string, rightId: string): VersionCompare | null {
    const left = db.versions.find((v) => v.id === leftId)
    const right = db.versions.find((v) => v.id === rightId)
    if (!left || !right) return null

    const items = new Set<string>([
      ...left.changeItems.map((c) => c.item),
      ...right.changeItems.map((c) => c.item),
    ])
    const rows: DiffRow[] = Array.from(items).map((item) => {
      const l = left.changeItems.find((c) => c.item === item)
      const r = right.changeItems.find((c) => c.item === item)
      const leftValue = l ? l.to : '—'
      const rightValue = r ? r.to : '—'
      return {
        item,
        left: leftValue,
        right: rightValue,
        category: (r ?? l)?.category ?? 'parameter',
        changed: leftValue !== rightValue,
      }
    })

    const caseIds = Array.from(
      new Set([
        ...db.executions.filter((e) => e.hardwareVersionId === leftId).map((e) => e.caseId),
        ...db.executions.filter((e) => e.hardwareVersionId === rightId).map((e) => e.caseId),
      ]),
    )
    const tests: TestDiffRow[] = caseIds.map((caseId) => ({
      caseId,
      caseName: db.cases.find((c) => c.id === caseId)?.name ?? caseId,
      left: latestRunFor(leftId, caseId)?.result ?? '—',
      right: latestRunFor(rightId, caseId)?.result ?? '—',
    }))

    const defectCodes = new Set([
      ...db.defects.filter((d) => d.hardwareVersionId === leftId).map((d) => d.code),
      ...db.defects.filter((d) => d.hardwareVersionId === rightId).map((d) => d.code),
    ])
    const defects: DefectDiffRow[] = Array.from(defectCodes).map((code) => {
      const defect = db.defects.find((d) => d.code === code)
      return {
        code,
        title: defect?.title ?? code,
        left: defect?.hardwareVersionId === leftId,
        right: defect?.hardwareVersionId === rightId,
      }
    })

    const improved = tests.filter((t) => t.left === 'FAIL' && t.right === 'PASS').length
    const regressed = tests.filter((t) => t.left === 'PASS' && t.right === 'FAIL').length

    return {
      left,
      right,
      rows,
      tests,
      defects,
      summary: { changedItems: rows.filter((r) => r.changed).length, improved, regressed },
    }
  },

  stats(productId: string): { versions: number; runs: number; passRate: number; openDefects: number } {
    const runs = db.executions.filter((e) => e.productId === productId && e.result !== 'PENDING')
    const pass = runs.filter((r) => r.result === 'PASS').length
    return {
      versions: db.versions.filter((v) => v.productId === productId).length,
      runs: runs.length,
      passRate: runs.length ? Math.round((pass / runs.length) * 1000) / 10 : 0,
      openDefects: db.defects.filter((d) => d.productId === productId && d.status !== 'closed').length,
    }
  },
}
