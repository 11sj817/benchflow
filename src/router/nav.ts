import type { Component } from 'vue'
import {
  LayoutDashboard,
  FolderKanban,
  ListChecks,
  CalendarRange,
  PlayCircle,
  Bug,
  Boxes,
  FlaskConical,
  HardDrive,
  Database,
  LayoutTemplate,
  TrendingUp,
  FileText,
  Share2,
  Users,
  Plug,
  ScrollText,
  Settings,
  Briefcase,
  Building2,
} from 'lucide-vue-next'
import type { PermissionAction } from '@/types'

export interface NavItem {
  key: string
  label: string
  to: string
  icon: Component
  permission?: PermissionAction
  guestAllowed?: boolean
  badgeKey?: 'defects' | 'reports' | 'devices'
}

export interface NavGroup {
  key: string
  label: string
  icon: Component
  description: string
  items: NavItem[]
}

/**
 * 六个一级工作区域。二级模块仍是原有 18 个功能入口，
 * 只重新分组，不删除任何模块。
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    key: 'workspace',
    label: '工作台',
    icon: LayoutDashboard,
    description: '我的待办与全局概览',
    items: [
      { key: 'dashboard', label: '我的工作台', to: '/dashboard', icon: LayoutDashboard, guestAllowed: true },
    ],
  },
  {
    key: 'projects',
    label: '项目中心',
    icon: Briefcase,
    description: '项目、需求与追踪',
    items: [
      { key: 'projects', label: '项目管理', to: '/projects', icon: FolderKanban, guestAllowed: true },
      { key: 'requirements', label: '需求管理', to: '/requirements', icon: ListChecks },
    ],
  },
  {
    key: 'testing',
    label: '测试中心',
    icon: FlaskConical,
    description: '计划、执行、用例与缺陷',
    items: [
      { key: 'test-plans', label: '测试计划', to: '/test-plans', icon: CalendarRange },
      { key: 'test-executions', label: '测试执行', to: '/test-executions', icon: PlayCircle },
      { key: 'test-cases', label: '测试用例库', to: '/test-cases', icon: FlaskConical },
      { key: 'defects', label: '缺陷管理', to: '/defects', icon: Bug, badgeKey: 'defects' },
    ],
  },
  {
    key: 'assets',
    label: '研发资产',
    icon: Boxes,
    description: '产品版本、设备、数据与模板',
    items: [
      { key: 'products', label: '产品与版本', to: '/products', icon: Boxes },
      { key: 'devices', label: '设备资产', to: '/devices', icon: HardDrive, badgeKey: 'devices' },
      { key: 'datasets', label: '数据集管理', to: '/datasets', icon: Database },
      { key: 'templates', label: '模板中心', to: '/templates', icon: LayoutTemplate },
    ],
  },
  {
    key: 'delivery',
    label: '分析与交付',
    icon: TrendingUp,
    description: '质量分析与报告交付',
    items: [
      { key: 'analytics', label: '质量分析', to: '/analytics', icon: TrendingUp },
      { key: 'reports', label: '报告中心', to: '/reports', icon: FileText, guestAllowed: true, badgeKey: 'reports' },
      { key: 'collaboration', label: '外部协作', to: '/collaboration', icon: Share2 },
    ],
  },
  {
    key: 'org',
    label: '组织管理',
    icon: Building2,
    description: '成员、集成、审计与设置',
    items: [
      { key: 'members', label: '团队与权限', to: '/members', icon: Users },
      { key: 'integrations', label: '集成中心', to: '/integrations', icon: Plug },
      { key: 'audit', label: '审计日志', to: '/audit', icon: ScrollText },
      { key: 'settings', label: '系统设置', to: '/settings', icon: Settings },
    ],
  },
]

export const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items)

export function navGroupOf(path: string): NavGroup | undefined {
  return NAV_GROUPS.find((group) => group.items.some((item) => path === item.to || path.startsWith(`${item.to}/`)))
}

export function navItemOf(path: string): NavItem | undefined {
  return ALL_NAV_ITEMS.find((item) => path === item.to || path.startsWith(`${item.to}/`))
}
