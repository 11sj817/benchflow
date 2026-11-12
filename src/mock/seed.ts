import type { Db } from '@/types'
import { cases, members, plans, products, projects, requirements, versions } from './seedCore'
import { executions } from './seedRuns'
import { defects } from './seedDefects'
import {
  audits,
  datasets,
  devices,
  integrations,
  notifications,
  org,
  reports,
  shares,
  templates,
  todos,
} from './seedAssets'

export const SCHEMA_VERSION = 2
export const STORAGE_KEY = 'benchflow.db.v2'
export const SESSION_KEY = 'benchflow.session.v2'
export const CHANNEL_NAME = 'benchflow.sync.v2'

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

/**
 * 组装演示数据库。所有关联在一次组装中回填，保证：
 * RUN-0017(mV) → BUG-0021 → V1.2 整改 → RUN-0019 回归 → 缺陷关闭 的闭环成立。
 */
export function createSeedDb(): Db {
  const runs = clone(executions)
  const bugList = clone(defects)

  bugList.forEach((defect) => {
    if (!defect.executionId) return
    const run = runs.find((r) => r.id === defect.executionId)
    if (run && !run.defectIds.includes(defect.id)) run.defectIds.push(defect.id)
  })

  // 回归执行记录同样挂上缺陷编号，便于执行详情反查。
  bugList.forEach((defect) => {
    defect.regressionExecutionIds.forEach((runId) => {
      const run = runs.find((r) => r.id === runId)
      if (run && !run.defectIds.includes(defect.id)) run.defectIds.push(defect.id)
    })
  })

  const now = new Date().toISOString()

  return {
    meta: { seededAt: now, revision: 1, schema: SCHEMA_VERSION },
    org: clone(org),
    members: clone(members),
    projects: clone(projects),
    requirements: clone(requirements),
    products: clone(products),
    versions: clone(versions),
    cases: clone(cases),
    plans: clone(plans),
    executions: runs,
    defects: bugList,
    devices: clone(devices),
    datasets: clone(datasets),
    reports: clone(reports),
    templates: clone(templates),
    shares: clone(shares),
    audits: clone(audits),
    notifications: clone(notifications),
    integrations: clone(integrations),
    todos: clone(todos),
  }
}
