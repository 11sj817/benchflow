<template>
  <div v-if="todo" class="m-detail">
    <button type="button" class="back" @click="router.push('/mobile/tasks')"><ArrowLeft :size="16" /> 我的任务</button>

    <header class="m-hero">
      <div class="code-row">
        <span class="kind">{{ kindLabel(todo.kind) }}</span>
        <span class="badge" :class="stateClass">{{ stateLabel }}</span>
      </div>
      <h1>{{ todo.title }}</h1>
      <p>{{ projectName(todo.projectId) || '未关联项目' }}</p>
      <div class="meta">
        <span>截止 {{ fmtDate(todo.dueAt) }}</span>
        <span>{{ dueText }}</span>
      </div>
    </header>

    <section class="m-card">
      <header class="m-card-head"><h2>任务操作</h2></header>
      <div class="actions">
        <button type="button" class="primary" @click="primaryAction">{{ primaryLabel }}</button>
        <button type="button" @click="toggle">{{ todo.done ? '标记未完成' : '标记完成' }}</button>
      </div>
      <p class="hint">
        手机端完成任务后，PC 端与执行记录会读取同一份本地演示数据；跨设备同步需要后端支持。
      </p>
    </section>

    <section v-if="relatedRun" class="m-card">
      <header class="m-card-head"><h2>最近相关执行</h2></header>
      <router-link :to="`/mobile/executions/${relatedRun.id}`" class="row">
        <span class="dot" :class="relatedRun.result === 'FAIL' ? 'danger' : 'success'" />
        <span class="row-main">
          <strong>{{ relatedRun.code }} · {{ caseName(relatedRun.caseId) }}</strong>
          <span>{{ relatedRun.result }} · {{ fromNow(relatedRun.startedAt) }}</span>
        </span>
        <ChevronRight :size="14" />
      </router-link>
    </section>

    <section v-if="relatedDefect" class="m-card">
      <header class="m-card-head"><h2>相关缺陷</h2></header>
      <router-link :to="`/mobile/defects/${relatedDefect.id}`" class="row">
        <span class="dot danger" />
        <span class="row-main">
          <strong>{{ relatedDefect.code }} · {{ relatedDefect.title }}</strong>
          <span>{{ relatedDefect.status }}</span>
        </span>
        <ChevronRight :size="14" />
      </router-link>
    </section>

    <section v-if="relatedReport" class="m-card">
      <header class="m-card-head"><h2>相关报告</h2></header>
      <router-link :to="`/mobile/reports/${relatedReport.id}`" class="row">
        <span class="dot warning" />
        <span class="row-main">
          <strong>{{ relatedReport.code }} · {{ relatedReport.title }}</strong>
          <span>{{ relatedReport.status }}</span>
        </span>
        <ChevronRight :size="14" />
      </router-link>
    </section>
  </div>

  <div v-else class="m-detail">
    <EmptyState text="任务不存在或已完成">
      <el-button size="small" @click="router.push('/mobile/tasks')">返回任务列表</el-button>
    </EmptyState>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { ArrowLeft, ChevronRight } from 'lucide-vue-next'
import type { Todo } from '@/types'
import { db } from '@/services/db'
import { todoService } from '@/services/orgService'
import EmptyState from '@/components/common/EmptyState.vue'
import { fmtDate, fromNow } from '@/utils/format'
import { saveTestContext } from '@/utils/testContext'

const route = useRoute()
const router = useRouter()

const todo = computed(() => db.todos.find((row) => row.id === route.params.id))
const relatedRun = computed(() => {
  const link = todo.value?.link ?? ''
  const match = /\/test-executions\/([^/?#]+)/.exec(link)
  return match ? db.executions.find((run) => run.id === match[1]) : undefined
})
const relatedDefect = computed(() => {
  const link = todo.value?.link ?? ''
  const match = /\/defects\/([^/?#]+)/.exec(link)
  return match ? db.defects.find((defect) => defect.id === match[1]) : undefined
})
const relatedReport = computed(() => {
  const link = todo.value?.link ?? ''
  const match = /\/reports\/([^/?#]+)/.exec(link)
  return match ? db.reports.find((report) => report.id === match[1]) : undefined
})
const relatedPlan = computed(() => {
  const link = todo.value?.link ?? ''
  const match = /\/test-plans\/([^/?#]+)/.exec(link)
  return match ? db.plans.find((plan) => plan.id === match[1]) : undefined
})

const kindLabel = (kind: Todo['kind']) =>
  ({ review: '审核', execute: '执行', defect: '缺陷', report: '报告', other: '其他' })[kind] ?? kind
const projectName = (id?: string) => db.projects.find((project) => project.id === id)?.name ?? ''
const caseName = (id: string) => db.cases.find((item) => item.id === id)?.name ?? id
const isOverdue = computed(() => !!todo.value && dayjs(todo.value.dueAt).isBefore(dayjs().format('YYYY-MM-DD'), 'day'))
const stateLabel = computed(() => (todo.value?.done ? '已完成' : isOverdue.value ? '已逾期' : '待处理'))
const stateClass = computed(() => (todo.value?.done ? 'done' : isOverdue.value ? 'danger' : 'info'))
const dueText = computed(() => {
  if (!todo.value) return ''
  const diff = dayjs(todo.value.dueAt).diff(dayjs().format('YYYY-MM-DD'), 'day')
  if (diff < 0) return `逾期 ${Math.abs(diff)} 天`
  if (diff === 0) return '今天到期'
  return `${diff} 天后到期`
})

const primaryLabel = computed(() => {
  if (!todo.value) return '打开'
  if (todo.value.kind === 'execute') return '开始执行'
  if (todo.value.kind === 'defect') return '处理缺陷'
  if (todo.value.kind === 'review' || todo.value.kind === 'report') return '查看报告'
  return '打开关联内容'
})

const primaryAction = () => {
  if (!todo.value) return
  if (relatedPlan.value) {
    const plan = relatedPlan.value
    saveTestContext({
      projectId: plan.projectId,
      productId: plan.productId,
      hardwareVersionId: plan.hardwareVersionId,
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
      },
    })
    return
  }
  if (relatedDefect.value) {
    router.push(`/mobile/defects/${relatedDefect.value.id}`)
    return
  }
  if (relatedReport.value) {
    router.push(`/mobile/reports/${relatedReport.value.id}`)
    return
  }
  if (relatedRun.value) {
    router.push(`/mobile/executions/${relatedRun.value.id}`)
    return
  }
  router.push('/mobile/home')
}

const toggle = () => {
  if (!todo.value) return
  todoService.toggle(todo.value.id)
}
</script>

<style scoped>
.m-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 32px;
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
  gap: 4px;
}

.code-row {
  display: flex;
  justify-content: space-between;
}

.kind {
  font-size: 9.5px;
  background: var(--bf-primary-soft);
  color: var(--bf-primary);
  border-radius: 3px;
  padding: 1px 6px;
}

.badge {
  font-size: 9.5px;
  border-radius: 9px;
  padding: 1px 7px;
  background: #eef2f7;
  color: #5a6a7e;
}

.badge.danger {
  background: #fdecea;
  color: #a12319;
}

.badge.info {
  background: #eaf1f7;
  color: #2a5878;
}

.badge.done {
  background: #e7f5ef;
  color: #12664c;
}

.m-hero h1 {
  font-size: 17px;
  font-weight: 650;
  line-height: 1.45;
}

.m-hero p {
  font-size: 11px;
  color: var(--bf-ink-2);
}

.meta {
  display: flex;
  gap: 9px;
  font-size: 10.2px;
  color: var(--bf-ink-3);
}

.m-card {
  background: #fff;
  border: 1px solid var(--bf-border);
  border-radius: 8px;
  overflow: hidden;
}

.m-card-head {
  padding: 11px 12px;
  border-bottom: 1px solid var(--bf-border);
}

.m-card-head h2 {
  font-size: 12.7px;
  font-weight: 620;
}

.actions {
  display: flex;
  gap: 8px;
  padding: 12px;
}

.actions button {
  flex: 1;
  min-height: 44px;
  border-radius: 6px;
  border: 1px solid var(--bf-border);
  background: #fff;
  font-family: inherit;
  font-size: 12.5px;
  color: var(--bf-ink-2);
}

.actions button.primary {
  background: var(--bf-primary);
  border-color: var(--bf-primary);
  color: #fff;
}

.hint {
  padding: 0 12px 12px;
  font-size: 10.5px;
  color: var(--bf-ink-3);
  line-height: 1.55;
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 12px;
  color: var(--bf-ink);
  text-decoration: none;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--bf-border-strong);
}

.dot.danger {
  background: #b02a1f;
}

.dot.success {
  background: #157a5b;
}

.dot.warning {
  background: #c07a1a;
}

.row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.row-main strong {
  font-size: 11.8px;
  font-weight: 550;
}

.row-main span {
  font-size: 10.2px;
  color: var(--bf-ink-3);
}
</style>
