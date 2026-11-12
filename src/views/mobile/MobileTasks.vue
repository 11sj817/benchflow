<template>
  <div class="m-page">
    <header class="m-head">
      <h1>我的任务</h1>
      <p>待办 {{ pending.length }} 项 · 逾期 {{ overdue.length }} 项</p>
    </header>

    <div class="seg four">
      <button type="button" :class="{ active: tab === 'pending' }" @click="tab = 'pending'">待办 {{ pending.length }}</button>
      <button type="button" :class="{ active: tab === 'progress' }" @click="tab = 'progress'">进行中 {{ progress.length }}</button>
      <button type="button" :class="{ active: tab === 'overdue' }" @click="tab = 'overdue'">已逾期 {{ overdue.length }}</button>
      <button type="button" :class="{ active: tab === 'done' }" @click="tab = 'done'">已完成 {{ done.length }}</button>
    </div>

    <div class="list">
      <div v-for="todo in current" :key="todo.id" class="item">
        <el-checkbox :model-value="todo.done" @change="todoService.toggle(todo.id)" />
        <button type="button" class="body" @click="router.push(`/mobile/tasks/${todo.id}`)">
          <strong>{{ todo.title }}</strong>
          <span>{{ projectName(todo.projectId) }} · {{ dueLabel(todo) }}</span>
          <span class="meta">
            <em class="kind">{{ kindLabel(todo.kind) }}</em>
            <em class="owner">{{ memberName(todo.assigneeId) }}</em>
            <em class="state" :class="stateClass(todo)">{{ stateLabel(todo) }}</em>
          </span>
        </button>
        <button type="button" class="chev" @click="router.push(`/mobile/tasks/${todo.id}`)"><ChevronRight :size="15" /></button>
      </div>
      <EmptyState v-if="current.length === 0" :text="emptyText" />
    </div>

    <div class="tip">
      <Info :size="13" />
      任务来自计划分派、缺陷流转与报告审核。点击任务可查看关联项目、执行或直接开始测试。
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { ChevronRight, Info } from 'lucide-vue-next'
import type { Todo } from '@/types'
import { db } from '@/services/db'
import { todoService } from '@/services/orgService'
import { useAppStore } from '@/stores/app'
import EmptyState from '@/components/common/EmptyState.vue'

const router = useRouter()
const app = useAppStore()
const tab = ref<'pending' | 'progress' | 'overdue' | 'done'>('pending')

const today = dayjs().format('YYYY-MM-DD')
const all = computed(() => todoService.all(app.currentUser.id))
const pending = computed(() => all.value.filter((todo) => !todo.done))
const done = computed(() => all.value.filter((todo) => todo.done))
const overdue = computed(() => pending.value.filter((todo) => dayjs(todo.dueAt).isBefore(today, 'day')))
const progress = computed(() => pending.value.filter((todo) => !dayjs(todo.dueAt).isBefore(today, 'day')))

const current = computed(() => {
  if (tab.value === 'progress') return progress.value
  if (tab.value === 'overdue') return overdue.value
  if (tab.value === 'done') return done.value
  return pending.value
})

const emptyText = computed(() =>
  tab.value === 'done' ? '还没有已完成任务' : tab.value === 'overdue' ? '没有逾期任务' : '没有待办任务',
)

const kindLabel = (kind: Todo['kind']) =>
  ({ review: '审核', execute: '执行', defect: '缺陷', report: '报告', other: '其他' })[kind] ?? kind
const projectName = (id?: string) => db.projects.find((project) => project.id === id)?.name ?? '未关联项目'
const memberName = (id: string) => db.members.find((member) => member.id === id)?.name ?? id
const isOverdue = (todo: Todo) => dayjs(todo.dueAt).isBefore(today, 'day')
const stateLabel = (todo: Todo) => (todo.done ? '已完成' : isOverdue(todo) ? '已逾期' : '进行中')
const stateClass = (todo: Todo) => (todo.done ? 'done' : isOverdue(todo) ? 'danger' : 'info')
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

.m-head h1 {
  font-size: 18px;
  font-weight: 650;
}

.m-head p {
  font-size: 11px;
  color: var(--bf-ink-3);
  margin-top: 3px;
}

.seg {
  display: grid;
  background: #e9edf3;
  border-radius: 7px;
  padding: 3px;
  gap: 2px;
}

.seg.four {
  grid-template-columns: repeat(4, 1fr);
}

.seg button {
  border: none;
  background: transparent;
  padding: 8px 2px;
  border-radius: 5px;
  font-size: 10.8px;
  color: var(--bf-ink-2);
  font-family: inherit;
  min-height: 34px;
}

.seg button.active {
  background: #fff;
  color: var(--bf-ink);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(20, 32, 46, 0.08);
}

.list {
  background: #fff;
  border: 1px solid var(--bf-border);
  border-radius: 8px;
  overflow: hidden;
}

.item {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 11px 8px 11px 12px;
  border-bottom: 1px solid var(--bf-border);
  min-height: 56px;
}

.item:last-child {
  border-bottom: none;
}

.body {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  padding: 0;
  text-align: left;
  font-family: inherit;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.body strong {
  font-size: 12.3px;
  font-weight: 550;
  line-height: 1.45;
}

.body > span {
  font-size: 10.3px;
  color: var(--bf-ink-3);
}

.meta {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  margin-top: 2px;
}

.meta em {
  font-style: normal;
  font-size: 9.5px;
  border-radius: 3px;
  padding: 1px 5px;
  background: var(--bf-surface-3);
  color: var(--bf-ink-3);
}

.meta .state.info {
  background: #eaf1f7;
  color: #2a5878;
}

.meta .state.danger {
  background: #fdecea;
  color: #a12319;
}

.meta .state.done {
  background: #e7f5ef;
  color: #12664c;
}

.chev {
  width: 40px;
  height: 40px;
  border: none;
  background: transparent;
  color: var(--bf-ink-3);
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
  padding: 0 2px;
}
</style>
