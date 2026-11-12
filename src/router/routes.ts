import type { RouteRecordRaw } from 'vue-router'

/**
 * 路由表独立导出：便于单元测试断言模块覆盖与路径完整性。
 * Hash 路由：GitHub Pages 刷新不会 404。
 */
export const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    component: () => import('@/layouts/AuthLayout.vue'),
    children: [{ path: '', name: 'login', component: () => import('@/views/auth/LoginView.vue'), meta: { title: '演示身份登录' } }],
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', name: 'dashboard', component: () => import('@/views/dashboard/DashboardView.vue'), meta: { title: '总览', guest: true } },
      { path: 'projects', name: 'projects', component: () => import('@/views/projects/ProjectListView.vue'), meta: { title: '项目管理', guest: true } },
      { path: 'projects/:id', name: 'project-detail', component: () => import('@/views/projects/ProjectDetailView.vue'), meta: { title: '项目详情', guest: true } },
      { path: 'requirements', name: 'requirements', component: () => import('@/views/requirements/RequirementListView.vue'), meta: { title: '需求管理' } },
      { path: 'test-plans', name: 'test-plans', component: () => import('@/views/test-plans/TestPlanListView.vue'), meta: { title: '测试计划' } },
      { path: 'test-plans/:id', name: 'test-plan-detail', component: () => import('@/views/test-plans/TestPlanDetailView.vue'), meta: { title: '测试计划详情' } },
      { path: 'test-cases', name: 'test-cases', component: () => import('@/views/test-cases/TestCaseListView.vue'), meta: { title: '测试用例库' } },
      { path: 'test-cases/new', name: 'test-case-create', component: () => import('@/views/test-cases/TestCaseEditorView.vue'), meta: { title: '新建测试用例' } },
      { path: 'test-cases/:id/edit', name: 'test-case-edit', component: () => import('@/views/test-cases/TestCaseEditorView.vue'), meta: { title: '编辑测试用例' } },
      { path: 'test-executions', name: 'test-executions', component: () => import('@/views/test-executions/ExecutionListView.vue'), meta: { title: '测试执行' } },
      { path: 'test-executions/:id', name: 'execution-detail', component: () => import('@/views/test-executions/ExecutionDetailView.vue'), meta: { title: '执行详情' } },
      { path: 'defects', name: 'defects', component: () => import('@/views/defects/DefectListView.vue'), meta: { title: '缺陷管理' } },
      { path: 'defects/:id', name: 'defect-detail', component: () => import('@/views/defects/DefectDetailView.vue'), meta: { title: '缺陷详情' } },
      { path: 'products', name: 'products', component: () => import('@/views/products/ProductListView.vue'), meta: { title: '产品与版本' } },
      { path: 'products/:id', name: 'product-detail', component: () => import('@/views/products/ProductDetailView.vue'), meta: { title: '产品详情' } },
      { path: 'devices', name: 'devices', component: () => import('@/views/devices/DeviceListView.vue'), meta: { title: '设备资产' } },
      { path: 'datasets', name: 'datasets', component: () => import('@/views/datasets/DatasetListView.vue'), meta: { title: '数据集管理' } },
      { path: 'templates', name: 'templates', component: () => import('@/views/templates/TemplateListView.vue'), meta: { title: '模板中心' } },
      { path: 'analytics', name: 'analytics', component: () => import('@/views/analytics/AnalyticsView.vue'), meta: { title: '质量分析' } },
      { path: 'reports', name: 'reports', component: () => import('@/views/reports/ReportListView.vue'), meta: { title: '报告中心', guest: true } },
      { path: 'reports/:id', name: 'report-detail', component: () => import('@/views/reports/ReportDetailView.vue'), meta: { title: '报告详情', guest: true } },
      { path: 'collaboration', name: 'collaboration', component: () => import('@/views/collaboration/CollaborationView.vue'), meta: { title: '外部协作' } },
      { path: 'members', name: 'members', component: () => import('@/views/members/MemberListView.vue'), meta: { title: '团队与权限' } },
      { path: 'integrations', name: 'integrations', component: () => import('@/views/integrations/IntegrationView.vue'), meta: { title: '集成中心' } },
      { path: 'audit', name: 'audit', component: () => import('@/views/audit/AuditLogView.vue'), meta: { title: '审计日志' } },
      { path: 'settings', name: 'settings', component: () => import('@/views/settings/SettingsView.vue'), meta: { title: '系统设置' } },
    ],
  },
  {
    path: '/mobile',
    component: () => import('@/layouts/MobileLayout.vue'),
    redirect: '/mobile/home',
    children: [
      { path: 'home', name: 'mobile-home', component: () => import('@/views/mobile/MobileHome.vue'), meta: { title: '移动工作台' } },
      { path: 'tasks', name: 'mobile-tasks', component: () => import('@/views/mobile/MobileTasks.vue'), meta: { title: '我的任务' } },
      { path: 'record', name: 'mobile-record', component: () => import('@/views/mobile/MobileRecord.vue'), meta: { title: '创建测试记录' } },
      { path: 'scan', name: 'mobile-scan', component: () => import('@/views/mobile/MobileScan.vue'), meta: { title: '扫码进入' } },
      { path: 'messages', name: 'mobile-messages', component: () => import('@/views/mobile/MobileMessages.vue'), meta: { title: '消息中心' } },
      { path: 'projects', name: 'mobile-projects', component: () => import('@/views/mobile/MobileProjects.vue'), meta: { title: '我的项目' } },
      { path: 'projects/:id', name: 'mobile-project-detail', component: () => import('@/views/mobile/MobileProjectDetail.vue'), meta: { title: '项目详情' } },
      { path: 'executions/:id', name: 'mobile-execution-detail', component: () => import('@/views/mobile/MobileExecutionDetail.vue'), meta: { title: '执行详情' } },
      { path: 'defects/:id', name: 'mobile-defect-detail', component: () => import('@/views/mobile/MobileDefectDetail.vue'), meta: { title: '缺陷详情' } },
      { path: 'tasks/:id', name: 'mobile-task-detail', component: () => import('@/views/mobile/MobileTaskDetail.vue'), meta: { title: '任务详情' } },
      { path: 'reports/:id', name: 'mobile-report-detail', component: () => import('@/views/mobile/MobileReportDetail.vue'), meta: { title: '报告详情' } },
    ],
  },
  {
    path: '/station',
    component: () => import('@/layouts/StationLayout.vue'),
    children: [{ path: '', name: 'station', component: () => import('@/views/station/StationView.vue'), meta: { title: '平板工位模式' } }],
  },
  {
    path: '/share/:token',
    name: 'share',
    component: () => import('@/views/share/ShareView.vue'),
    meta: { title: '只读分享' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/system/NotFoundView.vue'),
    meta: { title: '页面不存在' },
  },
]
