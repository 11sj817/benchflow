<template>
  <div class="bf-page dashboard">
    <header class="dash-head">
      <div class="hello">
        <div class="eyebrow">{{ db.org.name }} · {{ roleLabel(app.session.role).label }}</div>
        <h1>{{ greeting }}，{{ app.currentUser.name }}</h1>
        <p>{{ roleHeadline }}</p>
      </div>
      <div class="head-actions">
        <el-dropdown v-if="app.can('create')" trigger="click" @command="go">
          <el-button type="primary" size="default">
            <Plus :size="15" /> 新建
            <ChevronDown :size="13" />
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-for="action in quickActions" :key="action.to" :command="action.to">
                <component :is="action.icon" :size="14" class="dd-icon" /> {{ action.label }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button size="default" @click="cmdkHint">
          <Search :size="15" /> 搜索与操作
          <kbd>Ctrl K</kbd>
        </el-button>
      </div>
    </header>

    <div class="dash-kpis">
      <button type="button" class="mini-kpi" @click="router.push('/mobile/tasks')">
        <span class="k-label"><ClipboardList :size="14" /> 我的待办</span>
        <b>{{ openTodos.length }}</b>
        <span class="k-foot" :class="{ danger: overdueTodos.length > 0 }">
          {{ overdueTodos.length ? `${overdueTodos.length} 项已逾期` : '暂无逾期' }}
        </span>
      </button>
      <button type="button" class="mini-kpi" @click="router.push('/test-executions')">
        <span class="k-label"><PlayCircle :size="14" /> 我的执行（近 7 天）</span>
        <b>{{ myWeeklyRuns.length }}</b>
        <span class="k-foot">PASS {{ myWeeklyPass }}</span>
      </button>
      <button type="button" class="mini-kpi" :class="{ alert: scopedDefects.length > 0 }" @click="router.push('/defects')">
        <span class="k-label"><Bug :size="14" /> 待处理缺陷</span>
        <b>{{ scopedDefects.length }}</b>
        <span class="k-foot">{{ role === 'dev_engineer' ? '分派给我' : '项目范围' }}</span>
      </button>
      <button type="button" class="mini-kpi" @click="router.push('/reports')">
        <span class="k-label"><FileText :size="14" /> {{ app.can('review') ? '待审核报告' : '我的报告' }}</span>
        <b>{{ reviewReports.length }}</b>
        <span class="k-foot">{{ app.can('review') ? '等待审核决定' : '草稿 / 驳回' }}</span>
      </button>
    </div>

    <div class="dash-grid">
      <div class="main-col">
        <section class="bf-panel">
          <header class="bf-panel-header">
            <h2><ClipboardList :size="15" /> 今日待办与到期任务</h2>
            <router-link to="/mobile/tasks" class="bf-link-btn">全部任务</router-link>
          </header>
          <div class="todo-list">
            <div v-for="todo in priorityTodos" :key="todo.id" class="todo-row" :class="{ overdue: isOverdue(todo) }">
              <el-checkbox :model-value="todo.done" @change="toggleTodo(todo.id)" />
              <button class="todo-main" type="button" @click="router.push(todo.link.replace(/^#/, ''))">
                <span class="todo-title">{{ todo.title }}</span>
                <span class="todo-meta">
                  <span :class="{ danger: isOverdue(todo) }">{{ dueLabel(todo) }}</span>
                  <span>·</span>
                  <span>{{ projectName(todo.projectId) }}</span>
                  <span>·</span>
                  <span>{{ kindLabel(todo.kind) }}</span>
                </span>
              </button>
              <StatusPill
                :label="isOverdue(todo) ? '已逾期' : isToday(todo) ? '今日到期' : '进行中'"
                :tone="isOverdue(todo) ? 'danger' : isToday(todo) ? 'warning' : 'info'"
              />
              <ArrowUpRight :size="14" class="row-arrow" @click="router.push(todo.link.replace(/^#/, ''))" />
            </div>
            <EmptyState v-if="priorityTodos.length === 0" text="今天没有到期任务" hint="可以继续上次测试，或从快捷操作创建新记录。" />
          </div>
        </section>

        <div class="two-col">
          <section class="bf-panel">
            <header class="bf-panel-header">
              <h2><Bug :size="15" /> 待处理缺陷</h2>
              <router-link to="/defects" class="bf-link-btn">缺陷中心</router-link>
            </header>
            <div class="compact-list">
              <button v-for="defect in scopedDefects.slice(0, 5)" :key="defect.id" type="button" class="compact-row" @click="router.push(`/defects/${defect.id}`)">
                <span class="mono code">{{ defect.code }}</span>
                <span class="compact-main">
                  <strong>{{ defect.title }}</strong>
                  <span>{{ memberName(defect.ownerId) }} · {{ defectStatus.get(defect.status).label }}</span>
                </span>
                <StatusPill :label="severity.get(defect.severity).label" :tone="severity.get(defect.severity).tone" />
              </button>
              <EmptyState v-if="scopedDefects.length === 0" text="当前没有待处理缺陷" />
            </div>
          </section>

          <section class="bf-panel">
            <header class="bf-panel-header">
              <h2><FileText :size="15" /> {{ app.can('review') ? '待审核报告' : '我的报告' }}</h2>
              <router-link to="/reports" class="bf-link-btn">报告中心</router-link>
            </header>
            <div class="compact-list">
              <button v-for="report in reviewReports.slice(0, 5)" :key="report.id" type="button" class="compact-row" @click="router.push(`/reports/${report.id}`)">
                <span class="mono code">{{ report.code }}</span>
                <span class="compact-main">
                  <strong>{{ report.title }}</strong>
                  <span>{{ memberName(report.authorId) }} · {{ fmtDate(report.createdAt) }}</span>
                </span>
                <StatusPill :label="reportStatus.get(report.status).label" :tone="reportStatus.get(report.status).tone" />
              </button>
              <EmptyState v-if="reviewReports.length === 0" text="没有待处理报告" />
            </div>
          </section>
        </div>

        <section class="bf-panel">
          <header class="bf-panel-header">
            <h2><FolderKanban :size="15" /> 最近访问</h2>
            <span class="bf-sub">来自本机浏览记录</span>
          </header>
          <div class="recents">
            <button v-for="item in recents.slice(0, 6)" :key="item.to" type="button" class="recent" @click="router.push(item.to)">
              <span class="recent-type">{{ recentTypeLabel(item.type) }}</span>
              <span class="recent-main">
                <strong>{{ item.title }}</strong>
                <span>{{ item.subtitle }}</span>
              </span>
              <ChevronRight :size="14" />
            </button>
            <div v-if="recents.length === 0" class="recent-empty">
              <EmptyState text="还没有访问记录" hint="打开项目、执行或缺陷后会自动记录在这里。" />
            </div>
          </div>
        </section>
      </div>

      <aside class="side-col">
        <section class="bf-panel quick-panel">
          <header class="bf-panel-header"><h2><Plus :size="15" /> 快捷操作</h2><kbd>Ctrl K</kbd></header>
          <div class="quick-grid">
            <button v-for="action in quickActions" :key="action.to" type="button" class="quick-btn" @click="router.push(action.to)">
              <component :is="action.icon" :size="17" />
              <span>{{ action.label }}</span>
            </button>
          </div>
        </section>

        <section v-if="lastRun" class="bf-panel run-panel">
          <header class="bf-panel-header"><h2>最近一次测试执行</h2><StatusPill :label="runResult.get(lastRun.result).label" :tone="runResult.get(lastRun.result).tone" /></header>
          <div class="bf-panel-body">
            <div class="run-code mono">{{ lastRun.code }}</div>
            <div class="run-title">{{ caseName(lastRun.caseId) }}</div>
            <div class="run-meta">{{ versionLabel(lastRun.hardwareVersionId) }} · {{ memberName(lastRun.testerId) }} · {{ fromNow(lastRun.startedAt) }}</div>
            <div class="run-actions">
              <el-button size="small" @click="router.push(`/test-executions/${lastRun.id}`)">查看详情</el-button>
              <el-button size="small" type="primary" plain @click="router.push('/mobile/record')">再记一条</el-button>
            </div>
          </div>
        </section>

        <section v-if="lastContext" class="bf-panel resume-panel">
          <header class="bf-panel-header"><h2>继续上次测试</h2><span class="bf-sub">{{ contextAge }}</span></header>
          <div class="bf-panel-body">
            <div class="run-title">{{ planName(lastContext.planId) || projectName(lastContext.projectId) || '现场测试上下文' }}</div>
            <div class="run-meta">{{ caseName(lastContext.caseId) }} · {{ versionLabel(lastContext.hardwareVersionId) }}</div>
            <el-button size="small" type="primary" style="margin-top: 10px" @click="resumeTest">继续录入</el-button>
          </div>
        </section>

        <section class="bf-panel">
          <header class="bf-panel-header"><h2><AlertTriangle :size="15" /> 当前项目风险</h2></header>
          <div class="risk-list">
            <button v-for="risk in projectRisks" :key="risk.key" type="button" class="risk-row" :class="risk.level" @click="router.push(`/projects/${risk.projectId}`)">
              <span class="risk-dot" />
              <span class="risk-main">
                <strong>{{ risk.projectName }}</strong>
                <span>{{ risk.text }}</span>
              </span>
              <ChevronRight :size="13" />
            </button>
            <EmptyState v-if="projectRisks.length === 0" text="当前没有阻断性风险" />
          </div>
        </section>

        <section v-if="app.isGuest" class="bf-panel">
          <header class="bf-panel-header"><h2>共享给我的内容</h2></header>
          <div class="bf-panel-body guest-box">
            <p class="bf-sub">你当前是外部访客，只能查看被分享的项目与报告，不能创建或修改数据。</p>
            <div class="guest-links">
              <router-link v-for="project in app.visibleProjects" :key="project.id" :to="`/projects/${project.id}`">{{ project.code }} · {{ project.name }}</router-link>
            </div>
          </div>
        </section>
      </aside>
    </div>

    <section class="bf-panel trend-panel">
      <header class="bf-panel-header">
        <h2>近 7 天质量摘要</h2>
        <router-link to="/analytics" class="bf-link-btn">打开质量分析</router-link>
      </header>
      <div class="bf-panel-body trend-body">
        <BaseChart :option="trendOption" size="sm" />
        <div class="trend-side">
          <div><span>执行通过率</span><b>{{ passRate }}%</b></div>
          <div><span>执行次数</span><b>{{ weeklyRuns.length }}</b></div>
          <div><span>未关闭缺陷</span><b>{{ openDefectCount }}</b></div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import type { EChartsOption } from 'echarts'
import {
  AlertTriangle,
  ArrowUpRight,
  Bug,
  CalendarPlus,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  ClipboardPlus,
  FileText,
  FlaskConical,
  FolderKanban,
  FolderPlus,
  ListPlus,
  PlayCircle,
  Plus,
  Search,
  Upload,
} from 'lucide-vue-next'
import type { Defect, Execution, Report, Todo } from '@/types'
import { db } from '@/services/db'
import { projectService } from '@/services/projectService'
import { analyticsService, presetRange } from '@/services/analyticsService'
import { todoService } from '@/services/orgService'
import { useAppStore } from '@/stores/app'
import StatusPill from '@/components/common/StatusPill.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import BaseChart from '@/components/charts/BaseChart.vue'
import {
  defectStatus,
  fmtDate,
  fromNow,
  roleLabel,
  runResult,
  reportStatus,
  severity,
} from '@/utils/format'
import { loadRecents } from '@/utils/recents'
import { readTestContext, type TestContext } from '@/utils/testContext'

const router = useRouter()
const app = useAppStore()
const role = computed(() => app.session.role)

const greeting = computed(() => {
  const hour = dayjs().hour()
  if (hour < 6) return '夜深了'
  if (hour < 11) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
})

const today = dayjs().format('YYYY-MM-DD')
const startOfWeek = dayjs().subtract(6, 'day').startOf('day')

const allTodos = computed(() => todoService.all(app.currentUser.id))
const openTodos = computed(() => allTodos.value.filter((todo) => !todo.done))
const overdueTodos = computed(() => openTodos.value.filter((todo) => dayjs(todo.dueAt).isBefore(today, 'day')))
const priorityTodos = computed(() =>
  [...openTodos.value]
    .sort((a, b) => {
      const aOver = dayjs(a.dueAt).isBefore(today, 'day') ? 0 : 1
      const bOver = dayjs(b.dueAt).isBefore(today, 'day') ? 0 : 1
      return aOver - bOver || a.dueAt.localeCompare(b.dueAt)
    })
    .slice(0, 6),
)

const myRuns = computed(() => db.executions.filter((run) => run.testerId === app.currentUser.id))
const myWeeklyRuns = computed(() => myRuns.value.filter((run) => dayjs(run.startedAt).isAfter(startOfWeek)))
const myWeeklyPass = computed(() => myWeeklyRuns.value.filter((run) => run.result === 'PASS').length)

const scopedDefects = computed<Defect[]>(() => {
  if (app.isGuest) return []
  const open = db.defects.filter((defect) => defect.status !== 'closed')
  if (role.value === 'dev_engineer') return open.filter((defect) => defect.ownerId === app.currentUser.id)
  if (role.value === 'test_engineer') {
    return open.filter((defect) => defect.ownerId === app.currentUser.id || defect.reporterId === app.currentUser.id)
  }
  return open
})

const reviewReports = computed<Report[]>(() => {
  if (app.isGuest) return []
  if (app.can('review')) return db.reports.filter((report) => report.status === 'review')
  return db.reports.filter((report) => report.authorId === app.currentUser.id && ['draft', 'rejected'].includes(report.status))
})

const lastRun = computed<Execution | undefined>(() =>
  [...myRuns.value].sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))[0],
)

const recents = ref(loadRecents())
const lastContext = ref<TestContext | null>(readTestContext())
const contextAge = computed(() => (lastContext.value?.updatedAt ? fromNow(lastContext.value.updatedAt) : ''))

const activeProjects = computed(() => app.visibleProjects.filter((project) => project.status === 'active'))
const projectRisks = computed(() =>
  activeProjects.value
    .flatMap((project) =>
      projectService.risks(project.id).filter((risk) => risk.level !== 'low').map((risk) => ({
        key: `${project.id}-${risk.text}`,
        projectId: project.id,
        projectName: project.name,
        level: risk.level,
        text: risk.text,
      })),
    )
    .slice(0, 5),
)

const weekly = computed(() => analyticsService.dashboard(presetRange('7d')))
const weeklyRuns = computed(() => db.executions.filter((run) => dayjs(run.startedAt).isAfter(startOfWeek)))
const passRate = computed(() => weekly.value.passRate)
const openDefectCount = computed(() => db.defects.filter((defect) => defect.status !== 'closed').length)

const quickActions = computed(() => {
  if (!app.can('create')) return []
  return [
    { label: '创建项目', to: '/projects?create=1', icon: FolderPlus },
    { label: '创建需求', to: '/requirements?create=1', icon: ListPlus },
    { label: '创建计划', to: '/test-plans?create=1', icon: CalendarPlus },
    { label: '创建用例', to: '/test-cases/new', icon: FlaskConical },
    { label: '测试记录', to: '/mobile/record', icon: ClipboardPlus },
    { label: '提交缺陷', to: '/defects?create=1', icon: Bug },
    { label: '上传数据', to: '/datasets?upload=1', icon: Upload },
    { label: '生成报告', to: '/reports?create=1', icon: FileText },
  ]
})

const roleHeadline = computed(() => {
  if (role.value === 'guest') return `只读查看 ${app.visibleProjects.length} 个共享项目与报告`
  if (role.value === 'dev_engineer') {
    return `${scopedDefects.value.length} 个缺陷分派给我，${openTodos.value.length} 项待办`
  }
  if (role.value === 'test_engineer') {
    return `${openTodos.value.length} 项待办 · 近 7 天完成 ${myWeeklyRuns.value.length} 次执行`
  }
  if (role.value === 'test_lead' || role.value === 'project_owner' || role.value === 'org_admin' || role.value === 'super_admin') {
    return `${reviewReports.value.length} 份报告待审核 · ${openDefectCount.value} 个未关闭缺陷 · ${openTodos.value.length} 项待办`
  }
  return `${openTodos.value.length} 项待办`
})

const trendOption = computed<EChartsOption>(() => ({
  grid: { left: 34, right: 12, top: 12, bottom: 22 },
  tooltip: { trigger: 'axis' },
  xAxis: {
    type: 'category',
    data: weekly.value.trend.map((row) => row.day.slice(5)),
    axisLabel: { color: '#8494a8', fontSize: 9 },
    axisLine: { lineStyle: { color: '#e1e7ef' } },
    axisTick: { show: false },
  },
  yAxis: { type: 'value', minInterval: 1, interval: 1, splitLine: { lineStyle: { color: '#eef2f7' } }, axisLabel: { color: '#8494a8', fontSize: 9 } },
  series: [
    {
      type: 'bar',
      barWidth: 12,
      data: weekly.value.trend.map((row) => row.pass),
      itemStyle: { color: '#2f7f6b', borderRadius: [2, 2, 0, 0] },
    },
    {
      type: 'bar',
      barWidth: 12,
      data: weekly.value.trend.map((row) => row.fail),
      itemStyle: { color: '#b02a1f', borderRadius: [2, 2, 0, 0] },
    },
  ],
}))

const memberName = (id: string) => db.members.find((member) => member.id === id)?.name ?? id
const projectName = (id?: string) => db.projects.find((project) => project.id === id)?.name ?? ''
const planName = (id?: string) => db.plans.find((plan) => plan.id === id)?.name ?? ''
const caseName = (id?: string) => db.cases.find((item) => item.id === id)?.name ?? ''
const versionLabel = (id?: string) => db.versions.find((version) => version.id === id)?.version ?? '—'
const kindLabel = (kind: Todo['kind']) =>
  ({ review: '审核', execute: '执行', defect: '缺陷', report: '报告', other: '其他' })[kind] ?? kind
const recentTypeLabel = (type: string) =>
  ({ project: '项目', execution: '执行', defect: '缺陷', plan: '计划', case: '用例', report: '报告', product: '产品', device: '设备', dataset: '数据' })[type] ?? type

const isOverdue = (todo: Todo) => dayjs(todo.dueAt).isBefore(today, 'day')
const isToday = (todo: Todo) => dayjs(todo.dueAt).isSame(today, 'day')
const dueLabel = (todo: Todo) => {
  const diff = dayjs(todo.dueAt).diff(dayjs(today), 'day')
  if (diff < 0) return `逾期 ${Math.abs(diff)} 天`
  if (diff === 0) return '今天到期'
  return `${diff} 天后到期`
}

const toggleTodo = (id: string) => todoService.toggle(id)
const go = (to: string) => router.push(to)
const cmdkHint = () => {
  const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })
  window.dispatchEvent(event)
}
const resumeTest = () => {
  if (!lastContext.value) return
  router.push({ path: '/mobile/record', query: Object.fromEntries(Object.entries(lastContext.value).filter(([key, value]) => typeof value === 'string' && !['source', 'updatedAt'].includes(key)) as [string, string][]) })
}
</script>

<style scoped>
.dashboard {
  padding-bottom: 36px;
}

.dash-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-end;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.eyebrow {
  font-size: 11px;
  color: var(--bf-ink-3);
  letter-spacing: 0.03em;
}

.hello h1 {
  font-size: 22px;
  font-weight: 650;
  letter-spacing: -0.015em;
  margin-top: 3px;
}

.hello p {
  font-size: 12.5px;
  color: var(--bf-ink-2);
  margin-top: 4px;
}

.head-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.head-actions kbd {
  border: 1px solid var(--bf-border);
  border-radius: 3px;
  padding: 0 4px;
  font-size: 9.5px;
  color: var(--bf-ink-3);
  font-family: var(--bf-mono);
  margin-left: 4px;
}

.dash-kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.mini-kpi {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  border: 1px solid var(--bf-border);
  background: #fff;
  border-radius: 8px;
  padding: 12px 14px;
  font-family: inherit;
  cursor: pointer;
  text-align: left;
}

.mini-kpi:hover {
  border-color: var(--bf-border-strong);
}

.mini-kpi.alert {
  border-color: #f0d9a8;
  background: #fffdf7;
}

.k-label {
  font-size: 11.5px;
  color: var(--bf-ink-3);
  display: flex;
  align-items: center;
  gap: 6px;
}

.mini-kpi b {
  font-size: 24px;
  font-weight: 650;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
}

.k-foot {
  font-size: 10.5px;
  color: var(--bf-ink-3);
}

.k-foot.danger {
  color: var(--bf-danger);
}

.dash-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.75fr) minmax(320px, 0.85fr);
  gap: 14px;
  margin-top: 14px;
  align-items: start;
}

.main-col,
.side-col {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.two-col {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.bf-panel-header h2 {
  display: flex;
  align-items: center;
  gap: 7px;
}

.todo-list {
  display: flex;
  flex-direction: column;
}

.todo-row {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 14px;
  border-bottom: 1px solid var(--bf-border);
}

.todo-row:last-child {
  border-bottom: none;
}

.todo-row.overdue {
  background: #fffaf7;
}

.todo-main {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  text-align: left;
  font-family: inherit;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0;
}

.todo-title {
  font-size: 12.7px;
  color: var(--bf-ink);
  font-weight: 550;
}

.todo-meta {
  font-size: 10.8px;
  color: var(--bf-ink-3);
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}

.todo-meta .danger {
  color: var(--bf-danger);
}

.row-arrow {
  color: var(--bf-ink-3);
  cursor: pointer;
  flex: none;
}

.compact-list {
  display: flex;
  flex-direction: column;
}

.compact-row {
  display: flex;
  align-items: center;
  gap: 9px;
  border: none;
  background: transparent;
  border-bottom: 1px solid var(--bf-border);
  padding: 9px 13px;
  text-align: left;
  font-family: inherit;
  cursor: pointer;
}

.compact-row:hover {
  background: var(--bf-surface-2);
}

.compact-row:last-child {
  border-bottom: none;
}

.code {
  font-size: 10.5px;
  color: var(--bf-primary);
  flex: none;
}

.compact-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.compact-main strong {
  font-size: 12.2px;
  font-weight: 550;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compact-main span {
  font-size: 10.5px;
  color: var(--bf-ink-3);
}

.recents {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0;
}

.recent {
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  border-bottom: 1px solid var(--bf-border);
  background: transparent;
  padding: 9px 13px;
  text-align: left;
  font-family: inherit;
  cursor: pointer;
}

.recent:hover {
  background: var(--bf-surface-2);
}

.recent-type {
  font-size: 9.5px;
  color: var(--bf-ink-3);
  background: var(--bf-surface-3);
  border-radius: 3px;
  padding: 1px 5px;
  flex: none;
}

.recent-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.recent-main strong {
  font-size: 12px;
  font-weight: 550;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-main span {
  font-size: 10.5px;
  color: var(--bf-ink-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-empty {
  grid-column: span 2;
}

.quick-panel kbd {
  border: 1px solid var(--bf-border);
  border-radius: 3px;
  padding: 0 5px;
  font-size: 9.5px;
  color: var(--bf-ink-3);
  font-family: var(--bf-mono);
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  padding: 10px;
}

.quick-btn {
  display: flex;
  align-items: center;
  gap: 7px;
  border: 1px solid var(--bf-border);
  background: #fff;
  border-radius: 5px;
  padding: 9px 10px;
  font-family: inherit;
  font-size: 11.8px;
  color: var(--bf-ink-2);
  cursor: pointer;
  text-align: left;
}

.quick-btn:hover {
  border-color: var(--bf-primary);
  color: var(--bf-primary);
  background: var(--bf-primary-soft);
}

.run-panel .bf-panel-body,
.resume-panel .bf-panel-body {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.run-code {
  font-size: 11px;
  color: var(--bf-primary);
}

.run-title {
  font-size: 13.5px;
  font-weight: 620;
  line-height: 1.4;
}

.run-meta {
  font-size: 10.8px;
  color: var(--bf-ink-3);
}

.run-actions {
  display: flex;
  gap: 6px;
  margin-top: 9px;
}

.risk-list {
  display: flex;
  flex-direction: column;
}

.risk-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  border: none;
  background: transparent;
  border-bottom: 1px solid var(--bf-border);
  padding: 9px 13px;
  text-align: left;
  font-family: inherit;
  cursor: pointer;
}

.risk-row:last-child {
  border-bottom: none;
}

.risk-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--bf-border-strong);
  margin-top: 5px;
  flex: none;
}

.risk-row.high .risk-dot {
  background: #b02a1f;
}

.risk-row.medium .risk-dot {
  background: #c07a1a;
}

.risk-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.risk-main strong {
  font-size: 11.8px;
  font-weight: 600;
}

.risk-main span {
  font-size: 10.8px;
  color: var(--bf-ink-2);
  line-height: 1.45;
}

.guest-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.guest-links {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 12px;
}

.trend-panel {
  margin-top: 14px;
}

.trend-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 220px;
  gap: 16px;
  align-items: center;
}

.trend-side {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.trend-side > div {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  border-bottom: 1px dashed var(--bf-border);
  padding-bottom: 5px;
}

.trend-side span {
  font-size: 11.5px;
  color: var(--bf-ink-3);
}

.trend-side b {
  font-size: 18px;
  font-weight: 650;
}

.dd-icon {
  margin-right: 6px;
}

@media (max-width: 1280px) {
  .dash-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .dash-kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 860px) {
  .two-col,
  .recents {
    grid-template-columns: minmax(0, 1fr);
  }

  .trend-body {
    grid-template-columns: minmax(0, 1fr);
  }

  .head-actions {
    width: 100%;
  }
}
</style>
