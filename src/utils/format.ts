import dayjs from 'dayjs'
import type {
  CaseStatus,
  ChangeCategory,
  DatasetCategory,
  DefectStatus,
  DeviceCategory,
  DeviceStatus,
  FileKind,
  PlanStatus,
  Priority,
  ProjectStatus,
  ProjectType,
  ReportStatus,
  ReportType,
  RequirementSource,
  RequirementStatus,
  RoleKey,
  RunResult,
  Severity,
  TestCategory,
  VersionKind,
  VersionStatus,
  AuditAction,
  Integration,
} from '@/types'

export const fmtDate = (v?: string | null): string => (v ? dayjs(v).format('YYYY-MM-DD') : '—')

export const fmtDateTime = (v?: string | null): string => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—')

export const fmtTime = (v?: string | null): string => (v ? dayjs(v).format('HH:mm') : '—')

export const fromNow = (v?: string | null): string => {
  if (!v) return '—'
  const d = dayjs(v)
  const mins = dayjs().diff(d, 'minute')
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  return d.format('YYYY-MM-DD')
}

export const daysUntil = (v?: string | null): number => (v ? dayjs(v).startOf('day').diff(dayjs().startOf('day'), 'day') : 0)

export const fmtBytes = (n: number): string => {
  if (!n) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
  return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary'

export interface Labeled {
  label: string
  tone: Tone
}

const dict = <T extends string>(map: Record<T, Labeled>) => ({
  get: (v: T | undefined | null): Labeled => (v && map[v]) || { label: v || '—', tone: 'neutral' },
  map,
})

export const projectStatus = dict<ProjectStatus>({
  planning: { label: '规划中', tone: 'info' },
  active: { label: '进行中', tone: 'primary' },
  paused: { label: '已暂停', tone: 'warning' },
  completed: { label: '已完成', tone: 'success' },
  archived: { label: '已归档', tone: 'neutral' },
})

export const projectType = dict<ProjectType>({
  hardware: { label: '硬件研发', tone: 'primary' },
  power: { label: '电力电子', tone: 'primary' },
  embedded: { label: '嵌入式', tone: 'info' },
  sensor: { label: '传感器', tone: 'info' },
  other: { label: '其他', tone: 'neutral' },
})

export const priority = dict<Priority>({
  P0: { label: 'P0 紧急', tone: 'danger' },
  P1: { label: 'P1 高', tone: 'warning' },
  P2: { label: 'P2 中', tone: 'info' },
  P3: { label: 'P3 低', tone: 'neutral' },
})

export const requirementStatus = dict<RequirementStatus>({
  draft: { label: '草稿', tone: 'neutral' },
  reviewing: { label: '评审中', tone: 'warning' },
  approved: { label: '已批准', tone: 'info' },
  implemented: { label: '已实现', tone: 'primary' },
  verified: { label: '已验证', tone: 'success' },
  rejected: { label: '已拒绝', tone: 'danger' },
})

export const requirementSource = dict<RequirementSource>({
  customer: { label: '客户需求', tone: 'primary' },
  internal: { label: '内部需求', tone: 'info' },
  standard: { label: '标准要求', tone: 'warning' },
  market: { label: '市场输入', tone: 'neutral' },
})

export const testCategory = dict<TestCategory>({
  functional: { label: '功能测试', tone: 'primary' },
  performance: { label: '性能测试', tone: 'info' },
  electrical: { label: '电气测试', tone: 'info' },
  environment: { label: '环境测试', tone: 'warning' },
  reliability: { label: '可靠性测试', tone: 'warning' },
  security: { label: '安全测试', tone: 'danger' },
  compatibility: { label: '兼容性测试', tone: 'neutral' },
  regression: { label: '回归测试', tone: 'primary' },
})

export const caseStatus = dict<CaseStatus>({
  draft: { label: '草稿', tone: 'neutral' },
  published: { label: '已发布', tone: 'success' },
  deprecated: { label: '已停用', tone: 'warning' },
})

export const planStatus = dict<PlanStatus>({
  draft: { label: '草稿', tone: 'neutral' },
  pending: { label: '待执行', tone: 'info' },
  running: { label: '执行中', tone: 'primary' },
  review: { label: '待审核', tone: 'warning' },
  completed: { label: '已完成', tone: 'success' },
  cancelled: { label: '已取消', tone: 'neutral' },
})

export const runResult = dict<RunResult>({
  PASS: { label: 'PASS', tone: 'success' },
  FAIL: { label: 'FAIL', tone: 'danger' },
  BLOCKED: { label: 'BLOCKED', tone: 'warning' },
  SKIPPED: { label: 'SKIPPED', tone: 'neutral' },
  PENDING: { label: 'PENDING', tone: 'info' },
})

export const defectStatus = dict<DefectStatus>({
  new: { label: '新建', tone: 'info' },
  assigned: { label: '待分派', tone: 'warning' },
  in_progress: { label: '处理中', tone: 'primary' },
  resolved: { label: '已修复', tone: 'info' },
  verified: { label: '待关闭', tone: 'warning' },
  closed: { label: '已关闭', tone: 'success' },
  reopened: { label: '已重开', tone: 'danger' },
})

export const severity = dict<Severity>({
  blocker: { label: '阻塞', tone: 'danger' },
  critical: { label: '严重', tone: 'danger' },
  major: { label: '主要', tone: 'warning' },
  minor: { label: '次要', tone: 'info' },
  trivial: { label: '轻微', tone: 'neutral' },
})

export const versionKind = dict<VersionKind>({
  hardware: { label: '硬件版本', tone: 'primary' },
  firmware: { label: '固件版本', tone: 'info' },
  software: { label: '软件版本', tone: 'info' },
  baseline: { label: '测试基线', tone: 'neutral' },
})

export const versionStatus = dict<VersionStatus>({
  draft: { label: '草稿', tone: 'neutral' },
  released: { label: '已发布', tone: 'success' },
  deprecated: { label: '已废弃', tone: 'warning' },
})

export const changeCategory = dict<ChangeCategory>({
  material: { label: '物料', tone: 'info' },
  parameter: { label: '参数', tone: 'primary' },
  firmware: { label: '固件', tone: 'info' },
  structure: { label: '结构', tone: 'neutral' },
})

export const deviceCategory = dict<DeviceCategory>({
  oscilloscope: { label: '示波器', tone: 'primary' },
  multimeter: { label: '万用表', tone: 'info' },
  dc_power: { label: '直流电源', tone: 'info' },
  electronic_load: { label: '电子负载', tone: 'info' },
  power_analyzer: { label: '功率分析仪', tone: 'primary' },
  signal_generator: { label: '信号发生器', tone: 'neutral' },
  thermal: { label: '温度设备', tone: 'warning' },
  other: { label: '其他设备', tone: 'neutral' },
})

export const deviceStatus = dict<DeviceStatus>({
  available: { label: '可用', tone: 'success' },
  in_use: { label: '使用中', tone: 'primary' },
  maintenance: { label: '维修中', tone: 'warning' },
  retired: { label: '已报废', tone: 'neutral' },
})

export const datasetCategory = dict<DatasetCategory>({
  waveform: { label: '波形数据', tone: 'primary' },
  bom: { label: 'BOM 物料', tone: 'info' },
  photo: { label: '现场照片', tone: 'neutral' },
  report: { label: '报告文档', tone: 'info' },
  raw: { label: '原始记录', tone: 'warning' },
  other: { label: '其他', tone: 'neutral' },
})

export const fileKind = dict<FileKind>({
  csv: { label: 'CSV', tone: 'info' },
  xlsx: { label: 'XLSX', tone: 'success' },
  json: { label: 'JSON', tone: 'info' },
  png: { label: 'PNG', tone: 'neutral' },
  jpg: { label: 'JPG', tone: 'neutral' },
  pdf: { label: 'PDF', tone: 'danger' },
  zip: { label: 'ZIP', tone: 'warning' },
  log: { label: 'LOG', tone: 'neutral' },
})

export const reportType = dict<ReportType>({
  plan: { label: '测试计划报告', tone: 'primary' },
  execution: { label: '单次测试报告', tone: 'info' },
  product: { label: '产品验证报告', tone: 'primary' },
  version_compare: { label: '版本对比报告', tone: 'info' },
  defect: { label: '缺陷分析报告', tone: 'warning' },
  acceptance: { label: '阶段验收报告', tone: 'success' },
})

export const reportStatus = dict<ReportStatus>({
  draft: { label: '草稿', tone: 'neutral' },
  review: { label: '待审核', tone: 'warning' },
  approved: { label: '已通过', tone: 'success' },
  rejected: { label: '已驳回', tone: 'danger' },
  published: { label: '已发布', tone: 'primary' },
})

export const roleDict = dict<RoleKey>({
  super_admin: { label: '超级管理员', tone: 'danger' },
  org_admin: { label: '组织管理员', tone: 'primary' },
  project_owner: { label: '项目负责人', tone: 'primary' },
  test_lead: { label: '测试负责人', tone: 'info' },
  test_engineer: { label: '测试工程师', tone: 'info' },
  dev_engineer: { label: '研发工程师', tone: 'neutral' },
  guest: { label: '外部访客', tone: 'warning' },
})

/** 角色标签（函数式，供模板直接调用）。 */
export const roleLabel = (role?: RoleKey | null): Labeled => roleDict.get(role)

export const auditAction = dict<AuditAction>({
  create: { label: '创建', tone: 'success' },
  update: { label: '修改', tone: 'info' },
  delete: { label: '删除', tone: 'danger' },
  status: { label: '状态流转', tone: 'primary' },
  upload: { label: '上传文件', tone: 'info' },
  review: { label: '审核', tone: 'warning' },
  permission: { label: '权限变更', tone: 'warning' },
  reset: { label: '数据重置', tone: 'danger' },
})

export const integrationStatus = dict<Integration['status']>({
  connected: { label: '已连接', tone: 'success' },
  available: { label: '可配置', tone: 'info' },
  planned: { label: '规划中', tone: 'neutral' },
})

export const initials = (name: string): string => name.slice(-2)
