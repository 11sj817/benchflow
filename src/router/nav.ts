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
} from 'lucide-vue-next'
import type { PermissionAction } from '@/types'

export interface NavItem {
  label: string
  to: string
  icon: Component
  permission?: PermissionAction
  guestAllowed?: boolean
  badgeKey?: 'defects' | 'reports' | 'devices'
}

export interface NavGroup {
  title: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: '工作空间',
    items: [
      { label: '总览', to: '/dashboard', icon: LayoutDashboard, guestAllowed: true },
      { label: '项目管理', to: '/projects', icon: FolderKanban, guestAllowed: true },
      { label: '需求管理', to: '/requirements', icon: ListChecks },
      { label: '测试计划', to: '/test-plans', icon: CalendarRange },
      { label: '测试执行', to: '/test-executions', icon: PlayCircle },
      { label: '缺陷管理', to: '/defects', icon: Bug, badgeKey: 'defects' },
    ],
  },
  {
    title: '研发资产',
    items: [
      { label: '产品与版本', to: '/products', icon: Boxes },
      { label: '测试用例库', to: '/test-cases', icon: FlaskConical },
      { label: '设备资产', to: '/devices', icon: HardDrive, badgeKey: 'devices' },
      { label: '数据集管理', to: '/datasets', icon: Database },
      { label: '模板中心', to: '/templates', icon: LayoutTemplate },
    ],
  },
  {
    title: '分析与交付',
    items: [
      { label: '质量分析', to: '/analytics', icon: TrendingUp },
      { label: '报告中心', to: '/reports', icon: FileText, guestAllowed: true, badgeKey: 'reports' },
      { label: '外部协作', to: '/collaboration', icon: Share2 },
    ],
  },
  {
    title: '组织管理',
    items: [
      { label: '团队与权限', to: '/members', icon: Users },
      { label: '集成中心', to: '/integrations', icon: Plug },
      { label: '审计日志', to: '/audit', icon: ScrollText },
      { label: '系统设置', to: '/settings', icon: Settings },
    ],
  },
]
