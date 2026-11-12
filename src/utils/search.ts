import type { Db } from '@/types'

export type SearchEntityType =
  | 'project'
  | 'requirement'
  | 'plan'
  | 'case'
  | 'execution'
  | 'defect'
  | 'product'
  | 'device'
  | 'dataset'
  | 'report'

export interface SearchHit {
  id: string
  type: SearchEntityType
  typeLabel: string
  title: string
  subtitle: string
  to: string
  keywords: string
}

const LABELS: Record<SearchEntityType, string> = {
  project: '项目',
  requirement: '需求',
  plan: '计划',
  case: '用例',
  execution: '执行',
  defect: '缺陷',
  product: '产品',
  device: '设备',
  dataset: '数据',
  report: '报告',
}

export function buildSearchIndex(db: Db): SearchHit[] {
  const hits: SearchHit[] = []

  db.projects.forEach((row) =>
    hits.push({
      id: row.id,
      type: 'project',
      typeLabel: LABELS.project,
      title: row.name,
      subtitle: `${row.code} · ${row.status}`,
      to: `/projects/${row.id}`,
      keywords: `${row.code} ${row.name} ${row.description} ${row.tags.join(' ')}`,
    }),
  )

  db.requirements.forEach((row) =>
    hits.push({
      id: row.id,
      type: 'requirement',
      typeLabel: LABELS.requirement,
      title: row.name,
      subtitle: `${row.code} · ${row.status}`,
      to: `/requirements?project=${row.projectId}`,
      keywords: `${row.code} ${row.name} ${row.description}`,
    }),
  )

  db.plans.forEach((row) =>
    hits.push({
      id: row.id,
      type: 'plan',
      typeLabel: LABELS.plan,
      title: row.name,
      subtitle: `${row.code} · ${row.status}`,
      to: `/test-plans/${row.id}`,
      keywords: `${row.code} ${row.name}`,
    }),
  )

  db.cases.forEach((row) =>
    hits.push({
      id: row.id,
      type: 'case',
      typeLabel: LABELS.case,
      title: row.name,
      subtitle: `${row.code} · ${row.category}`,
      to: `/test-cases/${row.id}/edit`,
      keywords: `${row.code} ${row.name} ${row.tags.join(' ')}`,
    }),
  )

  db.executions.forEach((row) =>
    hits.push({
      id: row.id,
      type: 'execution',
      typeLabel: LABELS.execution,
      title: `${row.code} · ${row.result}`,
      subtitle: `${db.cases.find((c) => c.id === row.caseId)?.name ?? row.caseId}`,
      to: `/test-executions/${row.id}`,
      keywords: `${row.code} ${row.note} ${row.conditions} ${row.result}`,
    }),
  )

  db.defects.forEach((row) =>
    hits.push({
      id: row.id,
      type: 'defect',
      typeLabel: LABELS.defect,
      title: row.title,
      subtitle: `${row.code} · ${row.status}`,
      to: `/defects/${row.id}`,
      keywords: `${row.code} ${row.title} ${row.description}`,
    }),
  )

  db.products.forEach((row) =>
    hits.push({
      id: row.id,
      type: 'product',
      typeLabel: LABELS.product,
      title: row.name,
      subtitle: row.code,
      to: `/products/${row.id}`,
      keywords: `${row.code} ${row.name} ${row.description}`,
    }),
  )

  db.devices.forEach((row) =>
    hits.push({
      id: row.id,
      type: 'device',
      typeLabel: LABELS.device,
      title: `${row.code} · ${row.name}`,
      subtitle: `${row.model} · ${row.station}`,
      to: `/devices`,
      keywords: `${row.code} ${row.name} ${row.model} ${row.serial} ${row.vendor}`,
    }),
  )

  db.datasets.forEach((row) =>
    hits.push({
      id: row.id,
      type: 'dataset',
      typeLabel: LABELS.dataset,
      title: row.name,
      subtitle: `${row.code} · ${row.kind}`,
      to: `/datasets`,
      keywords: `${row.code} ${row.name} ${row.note}`,
    }),
  )

  db.reports.forEach((row) =>
    hits.push({
      id: row.id,
      type: 'report',
      typeLabel: LABELS.report,
      title: row.title,
      subtitle: `${row.code} · ${row.status}`,
      to: `/reports/${row.id}`,
      keywords: `${row.code} ${row.title} ${row.summary}`,
    }),
  )

  return hits
}

export function searchIndex(index: SearchHit[], keyword: string, limit = 14): SearchHit[] {
  const query = keyword.trim().toLowerCase()
  if (!query) return []
  const scored = index
    .map((hit) => {
      const haystack = `${hit.title} ${hit.subtitle} ${hit.keywords}`.toLowerCase()
      if (!haystack.includes(query)) return null
      let score = 0
      if (hit.title.toLowerCase() === query) score += 100
      if (hit.title.toLowerCase().startsWith(query)) score += 60
      if (hit.id.toLowerCase() === query) score += 80
      if (hit.subtitle.toLowerCase().includes(query)) score += 20
      if (hit.typeLabel.includes(query)) score += 10
      if (hit.keywords.toLowerCase().startsWith(query)) score += 15
      return { hit, score }
    })
    .filter((row): row is { hit: SearchHit; score: number } => row !== null)
    .sort((a, b) => b.score - a.score || a.hit.title.localeCompare(b.hit.title, 'zh-CN'))
  return scored.slice(0, limit).map((row) => row.hit)
}
