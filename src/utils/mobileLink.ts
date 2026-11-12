import { db } from '@/services/db'

/**
 * 把 PC 路由 / 旧的通知链接转换为移动端路由，
 * 保证用户在移动端点击任何业务对象后不会掉回 PC 布局。
 */
export function toMobileLink(link?: string, options: { preferRecord?: boolean } = {}): string {
  if (!link) return '/mobile/home'
  const path = link.replace(/^#/, '')
  if (path.startsWith('/mobile/')) return path

  const projectMatch = /^\/projects\/([^/?#]+)/.exec(path)
  if (projectMatch) return `/mobile/projects/${projectMatch[1]}`

  const executionMatch = /^\/test-executions\/([^/?#]+)/.exec(path)
  if (executionMatch) return `/mobile/executions/${executionMatch[1]}`

  const defectMatch = /^\/defects\/([^/?#]+)/.exec(path)
  if (defectMatch) return `/mobile/defects/${defectMatch[1]}`

  const reportMatch = /^\/reports\/([^/?#]+)/.exec(path)
  if (reportMatch) return `/mobile/reports/${reportMatch[1]}`

  const taskMatch = /^\/mobile\/tasks\/([^/?#]+)/.exec(path)
  if (taskMatch) return `/mobile/tasks/${taskMatch[1]}`

  const planMatch = /^\/test-plans\/([^/?#]+)/.exec(path)
  if (planMatch) {
    const plan = db.plans.find((row) => row.id === planMatch[1])
    if (plan && options.preferRecord) {
      return `/mobile/record?planId=${encodeURIComponent(plan.id)}&projectId=${encodeURIComponent(plan.projectId)}&productId=${encodeURIComponent(plan.productId)}&hardwareVersionId=${encodeURIComponent(plan.hardwareVersionId)}${plan.firmwareVersionId ? `&firmwareVersionId=${encodeURIComponent(plan.firmwareVersionId)}` : ''}`
    }
    if (plan) return `/mobile/projects/${plan.projectId}`
    return '/mobile/home'
  }

  const caseMatch = /^\/test-cases\/([^/?#]+)/.exec(path)
  if (caseMatch) return `/mobile/record?caseId=${caseMatch[1]}`

  const productMatch = /^\/products\/([^/?#]+)/.exec(path)
  if (productMatch) {
    const product = db.products.find((row) => row.id === productMatch[1])
    return product ? `/mobile/projects/${product.projectId}` : '/mobile/home'
  }

  if (path.startsWith('/devices')) return '/mobile/scan'
  if (path.startsWith('/test-executions')) return '/mobile/tasks'
  if (path.startsWith('/defects')) return '/mobile/tasks'
  if (path.startsWith('/reports')) return '/mobile/tasks'
  return '/mobile/home'
}
