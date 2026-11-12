import type { PermissionAction, RoleKey } from '@/types'

export const ROLE_LABEL: Record<RoleKey, string> = {
  super_admin: '超级管理员',
  org_admin: '组织管理员',
  project_owner: '项目负责人',
  test_lead: '测试负责人',
  test_engineer: '测试工程师',
  dev_engineer: '研发工程师',
  guest: '外部访客',
}

export const ROLE_DESCRIPTION: Record<RoleKey, string> = {
  super_admin: '拥有组织全部权限，包含成员、集成与组织设置。',
  org_admin: '组织级管理权限，可管理成员、项目与全部测试资产。',
  project_owner: '可管理所属项目的全部业务数据，并审核报告与缺陷关闭。',
  test_lead: '可创建测试计划、分派任务、审核报告和缺陷闭环。',
  test_engineer: '可执行测试、录入数据、创建缺陷与上传证据。',
  dev_engineer: '可查看测试数据、处理缺陷、维护需求与产品版本。',
  guest: '外部只读访客，仅能查看被分享的项目与报告。',
}

const ALL: PermissionAction[] = ['view', 'create', 'edit', 'delete', 'execute', 'review', 'export', 'manage']

export const ROLE_PERMISSIONS: Record<RoleKey, PermissionAction[]> = {
  super_admin: ALL,
  org_admin: ALL,
  project_owner: ['view', 'create', 'edit', 'delete', 'execute', 'review', 'export'],
  test_lead: ['view', 'create', 'edit', 'delete', 'execute', 'review', 'export'],
  test_engineer: ['view', 'create', 'edit', 'execute', 'export'],
  dev_engineer: ['view', 'create', 'edit', 'export'],
  guest: ['view'],
}

export const PERMISSION_LABEL: Record<PermissionAction, string> = {
  view: '查看',
  create: '新建',
  edit: '编辑',
  delete: '删除',
  execute: '执行',
  review: '审核',
  export: '导出',
  manage: '管理',
}

export const PERMISSION_ORDER: PermissionAction[] = ['view', 'create', 'edit', 'delete', 'execute', 'review', 'export', 'manage']

export function can(role: RoleKey | undefined, action: PermissionAction): boolean {
  if (!role) return false
  return ROLE_PERMISSIONS[role]?.includes(action) ?? false
}

/** 演示用数据范围：访客只能看到被分享的项目；其他角色看到全部演示项目。 */
export function visibleProjectIds(role: RoleKey, allIds: string[], guestSharedIds: string[]): string[] {
  return role === 'guest' ? guestSharedIds : allIds
}
