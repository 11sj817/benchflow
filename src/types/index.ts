/**
 * BenchFlow — 统一业务数据模型
 * 所有模块共享这些类型；页面不得自行定义重复的数据结构。
 * 该模型即为未来 NestJS + PostgreSQL 的 API 契约草案（见 docs/DATA_MODEL.md）。
 */

export type ID = string

export type RoleKey =
  | 'super_admin'
  | 'org_admin'
  | 'project_owner'
  | 'test_lead'
  | 'test_engineer'
  | 'dev_engineer'
  | 'guest'

export type PermissionAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'execute'
  | 'review'
  | 'export'
  | 'manage'

export type Priority = 'P0' | 'P1' | 'P2' | 'P3'

export interface Member {
  id: ID
  name: string
  title: string
  role: RoleKey
  email: string
  phone?: string
  color: string
  status: 'active' | 'invited' | 'disabled'
  joinedAt: string
  lastActiveAt: string
}

export type ProjectStatus = 'planning' | 'active' | 'paused' | 'completed' | 'archived'
export type ProjectType = 'hardware' | 'power' | 'embedded' | 'sensor' | 'other'

export interface Project {
  id: ID
  code: string
  name: string
  description: string
  type: ProjectType
  ownerId: ID
  memberIds: ID[]
  startDate: string
  plannedEndDate: string
  actualEndDate?: string
  status: ProjectStatus
  priority: Priority
  productIds: ID[]
  tags: string[]
  createdAt: string
  updatedAt: string
}

export type RequirementStatus = 'draft' | 'reviewing' | 'approved' | 'implemented' | 'verified' | 'rejected'
export type RequirementSource = 'customer' | 'internal' | 'standard' | 'market'

export interface Requirement {
  id: ID
  code: string
  projectId: ID
  parentId?: ID
  name: string
  description: string
  priority: Priority
  source: RequirementSource
  acceptance: string
  ownerId: ID
  status: RequirementStatus
  caseIds: ID[]
  defectIds: ID[]
  createdAt: string
  updatedAt: string
}

export type ProductType = 'dc_dc' | 'rectifier' | 'control_board' | 'sensor' | 'other'

export interface Product {
  id: ID
  code: string
  name: string
  type: ProductType
  description: string
  projectId: ID
  ownerId: ID
  createdAt: string
}

export type VersionKind = 'hardware' | 'firmware' | 'software' | 'baseline'
export type VersionStatus = 'draft' | 'released' | 'deprecated'
export type ChangeCategory = 'material' | 'parameter' | 'firmware' | 'structure'

export interface VersionChange {
  item: string
  from: string
  to: string
  category: ChangeCategory
  note?: string
}

export interface ProductVersion {
  id: ID
  productId: ID
  kind: VersionKind
  version: string
  label: string
  notes: string
  changeItems: VersionChange[]
  status: VersionStatus
  releasedAt?: string
  createdBy: ID
  createdAt: string
  attachmentNames: string[]
}

export type TestCategory =
  | 'functional'
  | 'performance'
  | 'electrical'
  | 'environment'
  | 'reliability'
  | 'security'
  | 'compatibility'
  | 'regression'

export interface MeasureParam {
  name: string
  unit: string
  min?: number | null
  max?: number | null
  target?: number | null
  required: boolean
}

export interface TestStep {
  id: ID
  name: string
  action: string
  expected: string
  param?: MeasureParam | null
}

export interface CaseRevision {
  version: string
  at: string
  by: ID
  summary: string
}

export type CaseStatus = 'draft' | 'published' | 'deprecated'

export interface TestCase {
  id: ID
  code: string
  name: string
  category: TestCategory
  purpose: string
  precondition: string
  environment: string
  steps: TestStep[]
  priority: Priority
  productIds: ID[]
  status: CaseStatus
  version: string
  revisions: CaseRevision[]
  tags: string[]
  ownerId: ID
  createdAt: string
  updatedAt: string
}

export type PlanStatus = 'draft' | 'pending' | 'running' | 'review' | 'completed' | 'cancelled'

export interface TestPlan {
  id: ID
  code: string
  name: string
  projectId: ID
  productId: ID
  hardwareVersionId: ID
  firmwareVersionId?: ID
  requirementIds: ID[]
  caseIds: ID[]
  assigneeIds: ID[]
  startDate: string
  endDate: string
  deviceIds: ID[]
  acceptance: string
  status: PlanStatus
  note: string
  createdBy: ID
  createdAt: string
  updatedAt: string
}

export type RunResult = 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIPPED' | 'PENDING'

export interface Measurement {
  id: ID
  param: string
  unit: string
  value: number | null
  min?: number | null
  max?: number | null
  result?: RunResult
  note?: string
}

export type FileKind = 'csv' | 'xlsx' | 'json' | 'png' | 'jpg' | 'pdf' | 'zip' | 'log' | 'audio'

export interface Attachment {
  id: ID
  name: string
  kind: FileKind
  size: number
  addedAt: string
  note?: string
}

export interface StepResult {
  stepId: ID
  result: RunResult
  note?: string
}

export interface ExecutionEnv {
  temperature: number | null
  humidity: number | null
  inputVoltage: number | null
  load: number | null
  note: string
}

export interface Execution {
  id: ID
  code: string
  planId: ID
  projectId: ID
  productId: ID
  hardwareVersionId: ID
  firmwareVersionId?: ID
  caseId: ID
  testerId: ID
  deviceIds: ID[]
  environment: ExecutionEnv
  conditions: string
  measurements: Measurement[]
  stepResults: StepResult[]
  result: RunResult
  startedAt: string
  finishedAt?: string
  attachments: Attachment[]
  defectIds: ID[]
  note: string
  createdAt: string
  updatedAt: string
}

export type DefectStatus = 'new' | 'assigned' | 'in_progress' | 'resolved' | 'verified' | 'closed' | 'reopened'
export type Severity = 'blocker' | 'critical' | 'major' | 'minor' | 'trivial'

export interface Comment {
  id: ID
  by: ID
  at: string
  text: string
  mentions: ID[]
}

export interface TimelineEntry {
  at: string
  by: ID
  action: string
  note?: string
}

export interface Verification {
  by: ID
  at: string
  executionId?: ID
  note: string
}

export interface Defect {
  id: ID
  code: string
  title: string
  description: string
  severity: Severity
  priority: Priority
  status: DefectStatus
  ownerId: ID
  reporterId: ID
  foundAt: string
  projectId: ID
  productId: ID
  hardwareVersionId?: ID
  firmwareVersionId?: ID
  executionId?: ID
  caseId?: ID
  steps: string
  evidence: Attachment[]
  rootCause: string
  fixPlan: string
  fixVersionId?: ID
  regressionExecutionIds: ID[]
  comments: Comment[]
  timeline: TimelineEntry[]
  verification?: Verification
  closedAt?: string
  createdAt: string
  updatedAt: string
}

export type DeviceCategory =
  | 'oscilloscope'
  | 'multimeter'
  | 'dc_power'
  | 'electronic_load'
  | 'power_analyzer'
  | 'signal_generator'
  | 'thermal'
  | 'other'

export interface DeviceUsage {
  at: string
  by: ID
  executionId?: ID
  note: string
}

export interface DeviceRepair {
  at: string
  note: string
  cost?: number
}

export type DeviceStatus = 'available' | 'in_use' | 'maintenance' | 'retired'

export interface Device {
  id: ID
  code: string
  name: string
  category: DeviceCategory
  model: string
  serial: string
  vendor: string
  station: string
  ownerId: ID
  calibrationDate: string
  calibrationDue: string
  status: DeviceStatus
  attachments: Attachment[]
  usage: DeviceUsage[]
  repairs: DeviceRepair[]
  createdAt: string
}

export type DatasetCategory = 'waveform' | 'bom' | 'photo' | 'report' | 'raw' | 'other'

export interface Dataset {
  id: ID
  code: string
  name: string
  kind: FileKind
  category: DatasetCategory
  sizeBytes: number
  projectId: ID
  executionId?: ID
  caseIds: ID[]
  version: string
  uploadedBy: ID
  uploadedAt: string
  note: string
  previewHeaders?: string[]
  previewRows?: string[][]
}

export type ReportType = 'plan' | 'execution' | 'product' | 'version_compare' | 'defect' | 'acceptance'
export type ReportStatus = 'draft' | 'review' | 'approved' | 'rejected' | 'published'

export interface ReportSection {
  title: string
  body: string
}

export interface Report {
  id: ID
  code: string
  title: string
  type: ReportType
  projectId: ID
  productId?: ID
  planId?: ID
  executionId?: ID
  versionIds?: ID[]
  status: ReportStatus
  authorId: ID
  reviewerId?: ID
  createdAt: string
  reviewedAt?: string
  summary: string
  sections: ReportSection[]
  metrics: { label: string; value: string }[]
}

export interface TemplateParam {
  name: string
  unit: string
  min: number | null
  max: number | null
}

export interface TemplateStep {
  name: string
  action: string
  expected: string
}

export interface Template {
  id: ID
  code: string
  name: string
  category: TestCategory
  description: string
  disclaimer: string
  params: TemplateParam[]
  steps: TemplateStep[]
  builtin: boolean
  createdAt: string
}

export interface ShareLink {
  id: ID
  token: string
  projectId: ID
  reportIds: ID[]
  expiresAt: string
  createdAt: string
  createdBy: ID
  status: 'active' | 'revoked'
  accessCount: number
  note: string
}

export type AuditAction = 'create' | 'update' | 'delete' | 'status' | 'upload' | 'review' | 'permission' | 'reset'
export type EntityKind =
  | 'project'
  | 'requirement'
  | 'product'
  | 'version'
  | 'case'
  | 'plan'
  | 'execution'
  | 'defect'
  | 'device'
  | 'dataset'
  | 'report'
  | 'share'
  | 'member'
  | 'setting'
  | 'session'

export interface AuditLog {
  id: ID
  at: string
  actorId: ID
  actorName: string
  action: AuditAction
  entity: EntityKind
  entityId: ID
  entityLabel: string
  summary: string
  projectId?: ID
}

export interface Notification {
  id: ID
  at: string
  title: string
  body: string
  kind: 'info' | 'warning' | 'success' | 'danger'
  read: boolean
  link?: string
  userId?: ID
}

export interface Integration {
  id: ID
  name: string
  category: 'scm' | 'im' | 'data' | 'api' | 'instrument'
  status: 'connected' | 'available' | 'planned'
  description: string
  configNote: string
  features: string[]
}

export interface Todo {
  id: ID
  title: string
  kind: 'review' | 'execute' | 'defect' | 'report' | 'other'
  dueAt: string
  link: string
  done: boolean
  assigneeId: ID
  projectId?: ID
}

export interface Org {
  name: string
  code: string
  industry: string
  contact: string
  plan: string
  createdAt: string
}

export interface DbMeta {
  seededAt: string
  revision: number
  schema: number
}

export interface Db {
  meta: DbMeta
  org: Org
  members: Member[]
  projects: Project[]
  requirements: Requirement[]
  products: Product[]
  versions: ProductVersion[]
  cases: TestCase[]
  plans: TestPlan[]
  executions: Execution[]
  defects: Defect[]
  devices: Device[]
  datasets: Dataset[]
  reports: Report[]
  templates: Template[]
  shares: ShareLink[]
  audits: AuditLog[]
  notifications: Notification[]
  integrations: Integration[]
  todos: Todo[]
}

export interface Session {
  userId: ID
  role: RoleKey
  mode: 'demo'
}

export interface Paged<T> {
  rows: T[]
  total: number
}
