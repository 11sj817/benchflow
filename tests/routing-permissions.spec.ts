import { describe, expect, it } from 'vitest'
import { can, ROLE_PERMISSIONS, visibleProjectIds } from '@/utils/permission'
import { routes } from '@/router/routes'
import type { RouteRecordRaw } from 'vue-router'

describe('角色权限', () => {
  it('外部访客只有查看权限', () => {
    expect(ROLE_PERMISSIONS.guest).toEqual(['view'])
    expect(can('guest', 'view')).toBe(true)
    expect(can('guest', 'edit')).toBe(false)
    expect(can('guest', 'review')).toBe(false)
  })

  it('测试工程师不能删除与审核，测试负责人可以', () => {
    expect(can('test_engineer', 'execute')).toBe(true)
    expect(can('test_engineer', 'delete')).toBe(false)
    expect(can('test_engineer', 'review')).toBe(false)
    expect(can('test_lead', 'review')).toBe(true)
    expect(can('test_lead', 'manage')).toBe(false)
  })

  it('组织管理员拥有全部权限', () => {
    expect(ROLE_PERMISSIONS.org_admin).toContain('manage')
    expect(ROLE_PERMISSIONS.org_admin).toContain('delete')
  })

  it('访客的项目数据范围限定为被分享项目', () => {
    expect(visibleProjectIds('guest', ['P-1', 'P-2'], ['P-2'])).toEqual(['P-2'])
    expect(visibleProjectIds('test_lead', ['P-1', 'P-2'], ['P-2'])).toEqual(['P-1', 'P-2'])
  })
})

function flatten(records: RouteRecordRaw[], prefix = ''): { path: string; name?: string }[] {
  return records.flatMap((record) => {
    const path = record.path.startsWith('/') ? record.path : `${prefix}/${record.path}`.replace(/\/+/g, '/')
    const self = record.name ? [{ path, name: String(record.name) }] : []
    const children = record.children ? flatten(record.children, path === '/' ? '' : path) : []
    return [...self, ...children]
  })
}

describe('路由与模块覆盖', () => {
  const flat = flatten(routes)
  const names = new Set(flat.map((r) => r.name))
  const paths = new Set(flat.map((r) => r.path))

  it('18 个业务模块均有可访问路由', () => {
    const modules = [
      '/dashboard',
      '/projects',
      '/requirements',
      '/test-plans',
      '/test-executions',
      '/defects',
      '/products',
      '/test-cases',
      '/devices',
      '/datasets',
      '/templates',
      '/analytics',
      '/reports',
      '/collaboration',
      '/members',
      '/integrations',
      '/audit',
      '/settings',
    ]
    modules.forEach((path) => expect(paths.has(path)).toBe(true))
  })

  it('核心详情页、编辑器与多端路由存在', () => {
    expect(names.has('project-detail')).toBe(true)
    expect(names.has('test-case-create')).toBe(true)
    expect(names.has('test-case-edit')).toBe(true)
    expect(names.has('execution-detail')).toBe(true)
    expect(names.has('test-plan-detail')).toBe(true)
    expect(names.has('defect-detail')).toBe(true)
    expect(names.has('report-detail')).toBe(true)
    expect(names.has('mobile-home')).toBe(true)
    expect(names.has('mobile-record')).toBe(true)
    expect(names.has('station')).toBe(true)
    expect(names.has('share')).toBe(true)
  })

  it('所有路由都配置了懒加载组件', () => {
    const walk = (records: RouteRecordRaw[]) => {
      records.forEach((record) => {
        expect(typeof record.component).toBe('function')
        if (record.children) walk(record.children)
      })
    }
    walk(routes)
  })

  it('访客可访问的路由标记正确', () => {
    const guestPaths = routes
      .flatMap((r) => r.children ?? [])
      .filter((child) => child.meta?.guest)
      .map((child) => String(child.path))
    expect(guestPaths).toContain('dashboard')
    expect(guestPaths).toContain('projects')
    expect(guestPaths).toContain('reports')
  })
})
