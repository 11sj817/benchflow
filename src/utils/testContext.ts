export interface TestContext {
  projectId?: string
  productId?: string
  hardwareVersionId?: string
  firmwareVersionId?: string
  planId?: string
  caseId?: string
  deviceId?: string
  source?: 'scan' | 'project' | 'manual' | 'resume' | 'station'
  updatedAt?: string
}

const KEY = 'benchflow.test-context.v1'

export function saveTestContext(context: TestContext): TestContext {
  const next: TestContext = { ...context, updatedAt: new Date().toISOString() }
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
  return next
}

export function readTestContext(): TestContext | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw) as TestContext
  } catch {
    return null
  }
}

export function clearTestContext(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}

export function hasTestContext(context: TestContext | null): boolean {
  return Boolean(context?.planId || context?.projectId || context?.deviceId)
}

/** 将上下文转为查询参数，供移动端记录 / 工位模式自动填充。 */
export function contextToQuery(context: TestContext): Record<string, string> {
  const query: Record<string, string> = {}
  Object.entries(context).forEach(([key, value]) => {
    if (typeof value === 'string' && value && key !== 'source' && key !== 'updatedAt') {
      query[key] = value
    }
  })
  if (context.source) query.source = context.source
  return query
}

export function contextFromQuery(query: Record<string, unknown>): TestContext {
  const read = (key: string) => (typeof query[key] === 'string' ? (query[key] as string) : undefined)
  return {
    projectId: read('projectId'),
    productId: read('productId'),
    hardwareVersionId: read('hardwareVersionId') ?? read('versionId'),
    firmwareVersionId: read('firmwareVersionId'),
    planId: read('planId'),
    caseId: read('caseId'),
    deviceId: read('deviceId'),
    source: (read('source') as TestContext['source']) ?? 'manual',
  }
}
