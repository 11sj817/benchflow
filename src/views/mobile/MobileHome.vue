<template>
  <div class="m-page">
    <header class="home-head">
      <div class="who">
        <UserAvatar :name="app.currentUser.name" :color="app.currentUser.color" size="lg" />
        <div>
          <h1>{{ app.currentUser.name }}</h1>
          <p>{{ db.org.name }} · {{ ROLE_LABEL[app.session.role] }}</p>
        </div>
      </div>
      <router-link to="/mobile/messages" class="bell" aria-label="消息中心">
        <Bell :size="18" />
        <span v-if="unread > 0" class="bell-dot">{{ unread }}</span>
      </router-link>
    </header>

    <button v-if="resumeTarget" type="button" class="resume" @click="resume">
      <span class="resume-icon"><RotateCcw :size="17" /></span>
      <span class="resume-body">
        <strong>继续上次测试</strong>
        <span>{{ resumeTarget.label }} · {{ resumeTarget.age }}</span>
      </span>
      <ChevronRight :size="15" />
    </button>

    <div class="quick-grid">
      <router-link to="/mobile/scan" class="quick">
        <ScanLine :size="20" />
        <span>扫码进入</span>
      </router-link>
      <router-link to="/mobile/record" class="quick primary">
        <ClipboardPlus :size="20" />
        <span>创建测试记录</span>
      </router-link>
      <router-link to="/mobile/tasks" class="quick">
        <ListTodo :size="20" />
        <span>我的任务</span>
        <em v-if="openTodos.length">{{ openTodos.length }}</em>
      </router-link>
      <router-link to="/mobile/record?mode=defect" class="quick">
        <Bug :size="20" />
        <span>提交异常</span>
      </router-link>
    </div>

    <section class="m-card">
      <header class="m-card-head"><h2>今天</h2><span>{{ todayLabel }}</span></header>
      <div class="m-kpis">
        <div><b>{{ todayRuns.length }}</b><span>我的执行</span></div>
        <div><b>{{ openTodos.length }}</b><span>待办</span></div>
        <div><b :class="{ danger: myDefects.length > 0 }">{{ myDefects.length }}</b><span>待处理异常</span></div>
      </div>
      <div class="today-strip">
        <span v-if="todayRuns.length">今日通过 {{ todayPass }} / {{ todayRuns.length }}</span>
        <span v-else>今天还没有测试记录</span>
        <span v-if="overdueCount" class="danger">{{ overdueCount }} 项逾期待办</span>
      </div>
    </section>

    <section class="m-card">
      <header class="m-card-head">
        <h2>今日任务</h2>
        <router-link to="/mobile/tasks" class="more">全部</router-link>
      </header>
      <div class="list">
        <router-link v-for="todo in visibleTodos" :key="todo.id" :to="`/mobile/tasks/${todo.id}`" class="row">
          <span class="dot" :class="{ danger: isOverdue(todo) }" />
          <span class="row-main">
            <strong>{{ todo.title }}</strong>
            <span>{{ projectName(todo.projectId) }} · {{ dueLabel(todo) }}</span>
          </span>
          <span class="mini-pill" :class="isOverdue(todo) ? 'danger' : isToday(todo) ? 'warning' : 'info'">
            {{ isOverdue(todo) ? '逾期' : isToday(todo) ? '今日' : '待办' }}
          </span>
        </router-link>
        <EmptyState v-if="visibleTodos.length === 0" text="今天没有待办任务" />
      </div>
    </section>

    <section v-if="myPlans.length" class="m-card">
      <header class="m-card-head"><h2>待执行测试</h2><router-link to="/mobile/projects" class="more">项目</router-link></header>
      <div class="list">
        <div v-for="plan in myPlans.slice(0, 3)" :key="plan.id" class="plan">
          <div class="plan-top">
            <span class="mono">{{ plan.code }}</span>
            <span class="mini-pill info">{{ planStatus.get(plan.status).label }}</span>
          </div>
          <strong>{{ plan.name }}</strong>
          <span class="row-sub">{{ plan.caseIds.length }} 个用例 · {{ versionLabel(plan.hardwareVersionId) }}</span>
          <button type="button" class="start-btn" @click="startPlan(plan)">开始测试</button>
        </div>
      </div>
    </section>

    <section v-if="reviewReports.length" class="m-card">
      <header class="m-card-head"><h2>待审核事项</h2><router-link to="/mobile/messages" class="more">消息</router-link></header>
      <div class="list">
        <router-link v-for="report in reviewReports.slice(0, 3)" :key="report.id" :to="`/mobile/reports/${report.id}`" class="row">
          <span class="dot warning" />
          <span class="row-main">
            <strong>{{ report.title }}</strong>
            <span>{{ report.code }} · {{ memberName(report.authorId) }}</span>
          </span>
          <ChevronRight :size="14" />
        </router-link>
      </div>
    </section>

    <section class="m-card">
      <header class="m-card-head"><h2>待处理异常</h2><router-link to="/mobile/record?mode=defect" class="more">上报</router-link></header>
      <div class="list">
        <router-link v-for="defect in myDefects.slice(0, 3)" :key="defect.id" :to="`/mobile/defects/${defect.id}`" class="row">
          <span class="dot danger" />
          <span class="row-main">
            <strong>{{ defect.title }}</strong>
            <span>{{ defect.code }} · {{ defectStatus.get(defect.status).label }}</span>
          </span>
          <span class="mini-pill danger">{{ severity.get(defect.severity).label }}</span>
        </router-link>
        <EmptyState v-if="myDefects.length === 0" text="没有待处理异常" />
      </div>
    </section>

    <section class="m-card">
      <header class="m-card-head"><h2>最近测试记录</h2><router-link to="/mobile/tasks" class="more">全部</router-link></header>
      <div class="list">
        <router-link v-for="run in recentRuns" :key="run.id" :to="`/mobile/executions/${run.id}`" class="row">
          <span class="dot" :class="run.result === 'FAIL' ? 'danger' : 'success'" />
          <span class="row-main">
            <strong>{{ caseName(run.caseId) }}</strong>
            <span>{{ run.code }} · {{ versionLabel(run.hardwareVersionId) }} · {{ fromNow(run.startedAt) }}</span>
          </span>
          <span class="mini-pill" :class="run.result === 'PASS' ? 'success' : run.result === 'FAIL' ? 'danger' : 'info'">
            {{ run.result }}
          </span>
        </router-link>
        <EmptyState v-if="recentRuns.length === 0" text="还没有你执行的记录" hint="扫码或创建测试记录后会显示在这里。" />
      </div>
    </section>

    <section class="m-card">
      <header class="m-card-head"><h2>最近项目</h2><router-link to="/mobile/projects" class="more">全部</router-link></header>
      <div class="list">
        <router-link v-for="project in myProjects.slice(0, 3)" :key="project.id" :to="`/mobile/projects/${project.id}`" class="row">
          <span class="proj-mark">{{ project.code.replace('P-', '') }}</span>
          <span class="row-main">
            <strong>{{ project.name }}</strong>
            <span>{{ projectService.stats(project.id).passRate }}% 通过率 · {{ projectService.stats(project.id).openDefects }} 个未关闭缺陷</span>
          </span>
          <ChevronRight :size="14" />
        </router-link>
      </div>
    </section>

    <div class="tip">
      <Info :size="13" />
      移动端与 PC 共享同一业务 service 与本地演示数据；同一浏览器内修改会同步，跨设备同步需后端支持。
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import {
  Bell,
  Bug,
  ChevronRight,
  ClipboardPlus,
  Info,
  ListTodo,
  RotateCcw,
  ScanLine,
} from 'lucide-vue-next'
import type { Defect, Execution, Report, TestPlan, Todo } from '@/types'
import { db } from '@/services/db'
import { projectService } from '@/services/projectService'
import { todoService, notificationService } from '@/services/orgService'
import { useAppStore } from '@/stores/app'
import UserAvatar from '@/components/common/UserAvatar.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { ROLE_LABEL } from '@/utils/permission'
import { defectStatus, fromNow, planStatus, severity } from '@/utils/format'
import { readDraft, draftAgeLabel } from '@/utils/draftStore'
import { readTestContext } from '@/utils/testContext'

const router = useRouter()
const app = useAppStore()

const today = dayjs().format('YYYY-MM-DD')
const todayLabel = `${dayjs().format('MM-DD')} 周${'日一二三四五六'[dayjs().day()]}`

const allTodos = computed(() => todoService.all(app.currentUser.id))
const openTodos = computed(() => allTodos.value.filter((todo) => !todo.done))
const overdueCount = computed(() => openTodos.value.filter((todo) => dayjs(todo.dueAt).isBefore(today, 'day')).length)
const visibleTodos = computed(() =>
  [...openTodos.value]
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .slice(0, 5),
)

const myProjects = computed(() =>
  app.isGuest
    ? app.visibleProjects
    : app.visibleProjects.filter((project) => project.memberIds.includes(app.currentUser.id)),
)
const myPlans = computed<TestPlan[]>(() =>
  db.plans.filter(
    (plan) => plan.assigneeIds.includes(app.currentUser.id) && ['running', 'pending', 'review'].includes(plan.status),
  ),
)

const myRuns = computed(() => db.executions.filter((run) => run.testerId === app.currentUser.id))
const todayRuns = computed(() => myRuns.value.filter((run) => dayjs(run.startedAt).isSame(today, 'day')))
const todayPass = computed(() => todayRuns.value.filter((run) => run.result === 'PASS').length)
const recentRuns = computed<Execution[]>(() =>
  [...myRuns.value].sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1)).slice(0, 4),
)

const myDefects = computed<Defect[]>(() => {
  if (app.isGuest) return []
  return db.defects.filter(
    (defect) =>
      defect.status !== 'closed' &&
      (defect.ownerId === app.currentUser.id || defect.reporterId === app.currentUser.id),
  )
})

const reviewReports = computed<Report[]>(() => {
  if (!app.can('review')) return []
  return db.reports.filter((report) => report.status === 'review')
})

const unread = computed(() => notificationService.unread(app.currentUser.id))

const draft = computed(() => readDraft<{ step?: number }>(`mobile-record:${app.currentUser.id}`, 2))
const context = computed(() => readTestContext())
const resumeTarget = computed(() => {
  if (draft.value) {
    const planId = (draft.value.data as { form?: { planId?: string } })?.form?.planId
    const plan = db.plans.find((row) => row.id === planId)
    return {
      label: plan ? `${plan.code} · ${plan.name}` : '未提交的测试记录草稿',
      age: draftAgeLabel(draft.value.savedAt),
      query: context.value,
    }
  }
  if (context.value?.planId || context.value?.projectId) {
    const plan = db.plans.find((row) => row.id === context.value?.planId)
    const project = db.projects.find((row) => row.id === context.value?.projectId)
    return {
      label: plan ? `${plan.code} · ${plan.name}` : project?.name ?? '现场测试上下文',
      age: context.value.updatedAt ? fromNow(context.value.updatedAt) : '刚刚',
      query: context.value,
    }
  }
  return null
})

const resume = () => {
  const query = resumeTarget.value?.query
  router.push({
    path: '/mobile/record',
    query: Object.fromEntries(
      Object.entries(query ?? {}).filter(([, value]) => typeof value === 'string') as [string, string][],
    ),
  })
}

const startPlan = (plan: TestPlan) => {
  router.push({
    path: '/mobile/record',
    query: {
      planId: plan.id,
      projectId: plan.projectId,
      productId: plan.productId,
      hardwareVersionId: plan.hardwareVersionId,
      ...(plan.firmwareVersionId ? { firmwareVersionId: plan.firmwareVersionId } : {}),
      source: 'manual',
    },
  })
}

const memberName = (id: string) => db.members.find((member) => member.id === id)?.name ?? id
const projectName = (id?: string) => db.projects.find((project) => project.id === id)?.name ?? '未关联项目'
const caseName = (id: string) => db.cases.find((item) => item.id === id)?.name ?? id
const versionLabel = (id?: string) => (id ? db.versions.find((version) => version.id === id)?.version ?? id : '—')
const isOverdue = (todo: Todo) => dayjs(todo.dueAt).isBefore(today, 'day')
const isToday = (todo: Todo) => dayjs(todo.dueAt).isSame(today, 'day')
const dueLabel = (todo: Todo) => {
  const diff = dayjs(todo.dueAt).diff(dayjs(today), 'day')
  if (diff < 0) return `逾期 ${Math.abs(diff)} 天`
  if (diff === 0) return '今天到期'
  return `${diff} 天后到期`
}
</script>

<style scoped>
.m-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.home-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 2px 2px 2px;
}

.who {
  display: flex;
  align-items: center;
  gap: 10px;
}

.who h1 {
  font-size: 18px;
  font-weight: 650;
}

.who p {
  font-size: 10.5px;
  color: var(--bf-ink-3);
  margin-top: 2px;
}

.bell {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: #fff;
  border: 1px solid var(--bf-border);
  color: var(--bf-ink-2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  flex: none;
}

.bell-dot {
  position: absolute;
  top: -3px;
  right: -3px;
  min-width: 17px;
  height: 17px;
  border-radius: 9px;
  background: #b02a1f;
  color: #fff;
  font-size: 9.5px;
  line-height: 17px;
  text-align: center;
  padding: 0 4px;
}

.resume {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  border: 1px solid #d7e3f1;
  background: var(--bf-primary-soft);
  border-radius: 8px;
  padding: 10px 12px;
  text-align: left;
  font-family: inherit;
  color: var(--bf-primary);
}

.resume-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
}

.resume-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.resume-body strong {
  font-size: 12.5px;
}

.resume-body span {
  font-size: 10.8px;
  color: var(--bf-ink-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.quick {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  background: #fff;
  border: 1px solid var(--bf-border);
  border-radius: 8px;
  padding: 10px 12px;
  color: var(--bf-ink);
  font-size: 12.5px;
  font-weight: 550;
  text-decoration: none;
  position: relative;
}

.quick.primary {
  background: var(--bf-primary);
  border-color: var(--bf-primary);
  color: #fff;
}

.quick:active {
  opacity: 0.85;
}

.quick em {
  position: absolute;
  top: 6px;
  right: 8px;
  font-style: normal;
  font-size: 9.5px;
  background: #fdf6ea;
  color: #80510a;
  border-radius: 8px;
  padding: 0 5px;
}

.m-card {
  background: #fff;
  border: 1px solid var(--bf-border);
  border-radius: 8px;
  overflow: hidden;
}

.m-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 11px 12px;
  border-bottom: 1px solid var(--bf-border);
}

.m-card-head h2 {
  font-size: 12.8px;
  font-weight: 620;
}

.m-card-head > span {
  font-size: 10.5px;
  color: var(--bf-ink-3);
}

.more {
  font-size: 11.5px;
  color: var(--bf-accent);
}

.m-kpis {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  padding: 10px 0;
}

.m-kpis > div {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  border-right: 1px solid var(--bf-border);
}

.m-kpis > div:last-child {
  border-right: none;
}

.m-kpis b {
  font-size: 18px;
  font-weight: 650;
}

.m-kpis b.danger {
  color: var(--bf-danger);
}

.m-kpis span {
  font-size: 10px;
  color: var(--bf-ink-3);
}

.today-strip {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 0 12px 10px;
  font-size: 10.5px;
  color: var(--bf-ink-3);
  flex-wrap: wrap;
}

.danger {
  color: var(--bf-danger);
}

.list {
  display: flex;
  flex-direction: column;
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 12px;
  border-bottom: 1px solid var(--bf-border);
  color: var(--bf-ink);
  text-decoration: none;
  min-height: 48px;
}

.row:last-child {
  border-bottom: none;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--bf-border-strong);
  flex: none;
}

.dot.warning {
  background: #c07a1a;
}

.dot.success {
  background: #157a5b;
}

.dot.danger {
  background: #b02a1f;
}

.row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.row-main strong {
  font-size: 12.3px;
  font-weight: 550;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-main span {
  font-size: 10.3px;
  color: var(--bf-ink-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-sub {
  font-size: 10.3px;
  color: var(--bf-ink-3);
}

.mini-pill {
  font-size: 9.5px;
  border-radius: 9px;
  padding: 1px 7px;
  background: #eef2f7;
  color: #5a6a7e;
  flex: none;
}

.mini-pill.success {
  background: #e7f5ef;
  color: #12664c;
}

.mini-pill.warning {
  background: #fdf6ea;
  color: #80510a;
}

.mini-pill.danger {
  background: #fdecea;
  color: #a12319;
}

.mini-pill.info {
  background: #eaf1f7;
  color: #2a5878;
}

.plan {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 11px 12px;
  border-bottom: 1px solid var(--bf-border);
}

.plan:last-child {
  border-bottom: none;
}

.plan-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.plan-top .mono {
  font-size: 10.5px;
  color: var(--bf-primary);
}

.plan strong {
  font-size: 12.5px;
  font-weight: 600;
}

.start-btn {
  margin-top: 5px;
  min-height: 38px;
  border: none;
  border-radius: 6px;
  background: var(--bf-primary);
  color: #fff;
  font-size: 12px;
  font-family: inherit;
}

.proj-mark {
  width: 34px;
  height: 34px;
  border-radius: 7px;
  background: var(--bf-surface-3);
  color: var(--bf-primary);
  font-family: var(--bf-mono);
  font-size: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
}

.tip {
  display: flex;
  gap: 6px;
  font-size: 10.5px;
  color: var(--bf-ink-3);
  line-height: 1.55;
  padding: 0 2px 6px;
}
</style>
