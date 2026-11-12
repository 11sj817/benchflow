export type ScanTargetType = 'project' | 'product' | 'device' | 'plan' | 'execution' | 'case' | 'report' | 'unknown'

export interface ScanContext {
  type: ScanTargetType
  id: string
  raw: string
}

const PREFIX_MAP: { prefix: string; type: ScanTargetType }[] = [
  { prefix: 'PRD-', type: 'product' },
  { prefix: 'RUN-', type: 'execution' },
  { prefix: 'TP-', type: 'plan' },
  { prefix: 'DEV-', type: 'device' },
  { prefix: 'TC-', type: 'case' },
  { prefix: 'RPT-', type: 'report' },
  { prefix: 'P-', type: 'project' },
]

const KNOWN_TYPES: ScanTargetType[] = ['project', 'product', 'device', 'plan', 'execution', 'case', 'report']

function classifyByCode(code: string): ScanTargetType {
  const normalized = code.trim().toUpperCase()
  const match = PREFIX_MAP.find((item) => normalized.startsWith(item.prefix))
  return match?.type ?? 'unknown'
}

/**
 * 解析二维码 / 手动输入内容。
 * 支持：
 *  - benchflow://device/DEV-001
 *  - https://host/#/projects/P-2401
 *  - https://host/#/mobile/executions/RUN-0017
 *  - 纯编号：P-2401 / PRD-100 / DEV-001 / TP-2401-02 / RUN-0017 / TC-1002 / RPT-2025-001
 *  - JSON：{"type":"device","id":"DEV-001"}
 */
export function parseScanPayload(raw: string): ScanContext | null {
  const text = raw.trim()
  if (!text) return null
  const original = text

  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text) as { type?: string; id?: string }
      if (parsed.type && parsed.id && KNOWN_TYPES.includes(parsed.type as ScanTargetType)) {
        return { type: parsed.type as ScanTargetType, id: parsed.id, raw: original }
      }
    } catch {
      // fall through
    }
  }

  const schemeMatch = /^benchflow:\/\/([a-z]+)\/([^/?#]+)/i.exec(text)
  if (schemeMatch) {
    const type = schemeMatch[1].toLowerCase() as ScanTargetType
    if (KNOWN_TYPES.includes(type)) return { type, id: decodeURIComponent(schemeMatch[2]), raw: original }
  }

  try {
    const url = new URL(text)
    const hash = url.hash.replace(/^#\/?/, '')
    const parts = hash.split('/').filter(Boolean)
    if (parts[0] === 'mobile' && parts.length >= 3 && parts[1] === 'projects') {
      return { type: 'project', id: parts[2], raw: original }
    }
    if (parts[0] === 'mobile' && parts.length >= 3 && parts[1] === 'executions') {
      return { type: 'execution', id: parts[2], raw: original }
    }
    if (parts[0] === 'mobile' && parts.length >= 3 && parts[1] === 'defects') {
      return { type: 'unknown', id: parts[2], raw: original }
    }
    const routeMap: Record<string, ScanTargetType> = {
      projects: 'project',
      products: 'product',
      devices: 'device',
      'test-plans': 'plan',
      'test-executions': 'execution',
      'test-cases': 'case',
      reports: 'report',
    }
    if (parts.length >= 2 && routeMap[parts[0]]) {
      return { type: routeMap[parts[0]], id: parts[1], raw: original }
    }
  } catch {
    // not a URL
  }

  const compact = text
    .replace(/^benchflow:\/\//i, '')
    .replace(/^#\/?/, '')
    .replace(/^mobile\//i, '')
    .replace(/^\/+/, '')
  const typeFromPath = /^(projects|products|devices|test-plans|test-executions|test-cases|reports)\/([^/?#]+)/.exec(compact)
  if (typeFromPath) {
    const routeMap: Record<string, ScanTargetType> = {
      projects: 'project',
      products: 'product',
      devices: 'device',
      'test-plans': 'plan',
      'test-executions': 'execution',
      'test-cases': 'case',
      reports: 'report',
    }
    return { type: routeMap[typeFromPath[1]], id: typeFromPath[2], raw: original }
  }

  if (compact.includes('/')) {
    const [first, second] = compact.split('/')
    if (KNOWN_TYPES.includes(first as ScanTargetType) && second) {
      return { type: first as ScanTargetType, id: second, raw: original }
    }
  }

  const type = classifyByCode(compact)
  return { type, id: compact.toUpperCase(), raw: original }
}

/** 生成用于设备 / 项目二维码的深链内容。 */
export function buildScanPayload(type: ScanTargetType, id: string): string {
  return `benchflow://${type}/${id}`
}

/** 扫码类型到中文名称。 */
export const SCAN_TYPE_LABEL: Record<ScanTargetType, string> = {
  project: '项目',
  product: '产品',
  device: '设备',
  plan: '测试计划',
  execution: '测试执行',
  case: '测试用例',
  report: '报告',
  unknown: '未知对象',
}
