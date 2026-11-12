<template>
  <div v-if="project" class="m-detail">
    <button type="button" class="back" @click="router.push('/mobile/projects')"><ArrowLeft :size="16" /> 我的项目</button>

    <header class="m-hero">
      <div class="code-row">
        <span class="mono">{{ project.code }}</span>
        <StatusPill :label="projectStatus.get(project.status).label" :tone="projectStatus.get(project.status).tone" />
        <StatusPill :label="priority.get(project.priority).label" :tone="priority.get(project.priority).tone" />
      </div>
      <h1>{{ project.name }}</h1>
      <p>{{ project.description }}</p>
      <div class="meta">
        <span>负责人 {{ memberName(project.ownerId) }}</span>
        <span>{{ project.startDate }} → {{ project.plannedEndDate }}</span>
      </div>
    </header>

    <div class="stat-grid">
      <div><b>{{ stats.progress }}%</b><span>项目进度</span></div>
      <div><b>{{ stats.passRate }}%</b><span>执行通过率</span></div>
      <div><b :class="{ danger: stats.openDefects > 0 }">{{ stats.openDefects }}</b><span>未关闭缺陷</span></div>
      <div><b>{{ coverage.rate }}%</b><span>需求覆盖</span></div>
    </div>

    <section class="m-card">
      <header class="m-card-head"><h2>当前测试计划</h2><span>{{ activePlans.length }} 个</span></header>
      <div class="list">
        <div v-for="plan in activePlans" :key="plan.id" class="plan">
          <div class="plan-top">
            <span class="mono">{{ plan.code }}</span>
            <span class="mini-pill info">{{ planStatus.get(plan.status).label }}</span>
          </div>
          <strong>{{ plan.name }}</strong>
          <span class="sub">{{ plan.caseIds.length }} 个用例 · {{ versionLabel(plan.hardwareVersionId) }} · {{ plan.assigneeIds.map(memberName).join('、') }}</span>
          <div class="plan-actions">
            <button type="button" class="primary" @click="startPlan(plan)">开始测试</button>
          </div>
        </div>
        <EmptyState v-if="activePlans.length === 0" text="当前没有进行中的测试计划" />
      </div>
    </section>

    <section class="m-card">
      <header class="m-card-head"><h2>最近执行</h2><span>{{ runs.length }} 条</span></header>
      <div class="list">
        <router-link v-for="run in runs.slice(0, 5)" :key="run.id" :to="`/mobile/executions/${run.id}`" class="row">
          <span class="dot" :class="run.result === 'FAIL' ? 'danger' : run.result === 'PASS' ? 'success' : 'warning'" />
          <span class="row-main">
            <strong>{{ caseName(run.caseId) }}</strong>
            <span>{{ run.code }} · {{ memberName(run.testerId) }} · {{ fromNow(run.startedAt) }}</span>
          </span>
          <span class="mini-pill" :class="run.result === 'PASS' ? 'success' : run.result === 'FAIL' ? 'danger' : 'info'">{{ run.result }}</span>
        </router-link>
        <EmptyState v-if="runs.length === 0" text="还没有测试执行" />
      </div>
    </section>

    <section class="m-card">
      <header class="m-card-head"><h2>未关闭缺陷</h2><span>{{ openDefects.length }} 个</span></header>
      <div class="list">
        <router-link v-for="defect in openDefects" :key="defect.id" :to="`/mobile/defects/${defect.id}`" class="row">
          <span class="dot danger" />
          <span class="row-main">
            <strong>{{ defect.title }}</strong>
            <span>{{ defect.code }} · {{ memberName(defect.ownerId) }}</span>
          </span>
          <span class="mini-pill danger">{{ severity.get(defect.severity).label }}</span>
        </router-link>
        <EmptyState v-if="openDefects.length === 0" text="没有未关闭缺陷" />
      </div>
    </section>

    <section class="m-card">
      <header class="m-card-head"><h2>项目成员</h2></header>
      <div class="members">
        <div v-for="member in members" :key="member.id" class="member">
          <UserAvatar :name="member.name" :color="member.color" size="sm" />
          <span>{{ member.name }}</span>
          <span class="sub">{{ member.title }}</span>
        </div>
      </div>
    </section>

    <div class="sticky-actions">
      <button type="button" class="ghost" @click="router.push(`/mobile/record?mode=defect&projectId=${project.id}`)">提交异常</button>
      <button type="button" class="primary" @click="startRecord(null)">创建测试记录</button>
    </div>
  </div>

  <div v-else class="m-detail">
    <EmptyState text="项目不存在或没有访问权限">
      <el-button size="small" @click="router.push('/mobile/projects')">返回项目列表</el-button>
    </EmptyState>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'
import type { Member, TestPlan } from '@/types'
import { db } from '@/services/db'
import { projectService, requirementService } from '@/services/projectService'
import StatusPill from '@/components/common/StatusPill.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import { fromNow, planStatus, priority, projectStatus, severity } from '@/utils/format'
import { saveTestContext } from '@/utils/testContext'

const route = useRoute()
const router = useRouter()

const project = computed(() => db.projects.find((row) => row.id === route.params.id))
const stats = computed(() =>
  project.value
    ? projectService.stats(project.value.id)
    : { progress: 0, passRate: 0, openDefects: 0, runCount: 0, planCount: 0, caseCount: 0, requirementCount: 0, coveredRequirements: 0 },
)
const coverage = computed(() =>
  project.value ? requirementService.coverage(project.value.id) : { total: 0, covered: 0, verified: 0, uncovered: 0, rate: 0 },
)
const activePlans = computed<TestPlan[]>(() =>
  project.value
    ? db.plans.filter((plan) => plan.projectId === project.value!.id && ['running', 'pending', 'review'].includes(plan.status))
    : [],
)
const runs = computed(() =>
  project.value
    ? db.executions.filter((run) => run.projectId === project.value!.id).slice().sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
    : [],
)
const openDefects = computed(() =>
  project.value ? db.defects.filter((defect) => defect.projectId === project.value!.id && defect.status !== 'closed') : [],
)
const members = computed<Member[]>(() =>
  project.value
    ? (project.value.memberIds.map((id) => db.members.find((member) => member.id === id)).filter((member): member is Member => Boolean(member)))
    : [],
)

const memberName = (id: string) => db.members.find((member) => member.id === id)?.name ?? id
const caseName = (id: string) => db.cases.find((item) => item.id === id)?.name ?? id
const versionLabel = (id?: string) => (id ? db.versions.find((version) => version.id === id)?.version ?? id : '—')

const startPlan = (plan: TestPlan) => {
  saveTestContext({
    projectId: plan.projectId,
    productId: plan.productId,
    hardwareVersionId: plan.hardwareVersionId,
    firmwareVersionId: plan.firmwareVersionId,
    planId: plan.id,
    source: 'manual',
  })
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

const startRecord = (plan: TestPlan | null) => {
  if (plan) {
    startPlan(plan)
    return
  }
  router.push(`/mobile/record?projectId=${project.value?.id ?? ''}&source=manual`)
}
</script>

<style scoped>
.m-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 140px;
}

.back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: transparent;
  color: var(--bf-ink-3);
  font-family: inherit;
  font-size: 11.5px;
  padding: 0;
  min-height: 32px;
  align-self: flex-start;
}

.m-hero {
  background: #fff;
  border: 1px solid var(--bf-border);
  border-radius: 8px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.code-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.code-row .mono {
  font-size: 10.5px;
  color: var(--bf-primary);
}

.m-hero h1 {
  font-size: 18px;
  font-weight: 650;
  line-height: 1.35;
}

.m-hero p {
  font-size: 11.5px;
  color: var(--bf-ink-2);
  line-height: 1.55;
}

.meta {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 10.3px;
  color: var(--bf-ink-3);
  margin-top: 2px;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  background: #fff;
  border: 1px solid var(--bf-border);
  border-radius: 8px;
  padding: 10px 0;
}

.stat-grid > div {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  border-right: 1px solid var(--bf-border);
}

.stat-grid > div:last-child {
  border-right: none;
}

.stat-grid b {
  font-size: 16px;
  font-weight: 650;
}

.stat-grid b.danger {
  color: var(--bf-danger);
}

.stat-grid span {
  font-size: 9.5px;
  color: var(--bf-ink-3);
}

.m-card {
  background: #fff;
  border: 1px solid var(--bf-border);
  border-radius: 8px;
  overflow: hidden;
}

.m-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
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

.list {
  display: flex;
  flex-direction: column;
}

.plan {
  padding: 11px 12px;
  border-bottom: 1px solid var(--bf-border);
  display: flex;
  flex-direction: column;
  gap: 3px;
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

.sub {
  font-size: 10.3px;
  color: var(--bf-ink-3);
}

.plan-actions {
  display: flex;
  gap: 8px;
  margin-top: 5px;
}

.plan-actions button {
  flex: 1;
  min-height: 38px;
  border: 1px solid var(--bf-border);
  border-radius: 5px;
  background: #fff;
  color: var(--bf-ink-2);
  font-family: inherit;
  font-size: 11.5px;
}

.plan-actions button.primary {
  background: var(--bf-primary);
  border-color: var(--bf-primary);
  color: #fff;
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

.dot.success {
  background: #157a5b;
}

.dot.danger {
  background: #b02a1f;
}

.dot.warning {
  background: #c07a1a;
}

.row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.row-main strong {
  font-size: 12.2px;
  font-weight: 550;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-main span {
  font-size: 10.2px;
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

.mini-pill.danger {
  background: #fdecea;
  color: #a12319;
}

.mini-pill.info {
  background: #eaf1f7;
  color: #2a5878;
}

.members {
  display: flex;
  flex-direction: column;
}

.member {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-bottom: 1px solid var(--bf-border);
  font-size: 12px;
}

.member:last-child {
  border-bottom: none;
}

.member .sub {
  margin-left: auto;
}

.sticky-actions {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 64px;
  max-width: 460px;
  margin: 0 auto;
  background: #fff;
  border-top: 1px solid var(--bf-border);
  padding: 8px 12px;
  display: flex;
  gap: 8px;
  z-index: 25;
}

.sticky-actions button {
  flex: 1;
  min-height: 44px;
  border-radius: 6px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 550;
}

.sticky-actions .ghost {
  border: 1px solid var(--bf-border);
  background: #fff;
  color: var(--bf-ink-2);
}

.sticky-actions .primary {
  border: none;
  background: var(--bf-primary);
  color: #fff;
}
</style>
