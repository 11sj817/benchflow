<template>
  <div class="m-page">
    <header class="m-head">
      <h1>我的任务</h1>
      <p>待办 {{ pending.length }} 项 · 已完成 {{ done.length }} 项</p>
    </header>

    <div class="seg">
      <button type="button" :class="{ active: tab === 'pending' }" @click="tab = 'pending'">待办 {{ pending.length }}</button>
      <button type="button" :class="{ active: tab === 'done' }" @click="tab = 'done'">已完成 {{ done.length }}</button>
    </div>

    <div class="list">
      <div v-for="todo in current" :key="todo.id" class="item" :class="{ done: todo.done }">
        <el-checkbox :model-value="todo.done" @change="todoService.toggle(todo.id)" />
        <div class="body" @click="router.push(todo.link.replace(/^#/, ''))">
          <strong>{{ todo.title }}</strong>
          <span>{{ kindLabel(todo.kind) }} · 截止 {{ fmtDate(todo.dueAt) }}</span>
        </div>
        <ChevronRight :size="14" class="chev" />
      </div>
      <EmptyState v-if="current.length === 0" :text="tab === 'pending' ? '没有待办任务' : '还没有已完成任务'" />
    </div>

    <div class="tip">
      <Info :size="13" />
      任务来自演示待办数据。接入后端后，任务将由计划分派、缺陷流转与报告审核自动生成。
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronRight, Info } from 'lucide-vue-next'
import { todoService } from '@/services/orgService'
import { useAppStore } from '@/stores/app'
import EmptyState from '@/components/common/EmptyState.vue'
import { fmtDate } from '@/utils/format'

const router = useRouter()
const app = useAppStore()
const tab = ref<'pending' | 'done'>('pending')

const all = computed(() => todoService.all(app.currentUser.id))
const pending = computed(() => all.value.filter((t) => !t.done))
const done = computed(() => all.value.filter((t) => t.done))
const current = computed(() => (tab.value === 'pending' ? pending.value : done.value))

const kindLabel = (kind: string) => ({ review: '审核', execute: '执行', defect: '缺陷', report: '报告', other: '其他' })[kind] ?? kind
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
  grid-template-columns: repeat(2, 1fr);
  background: #e9edf3;
  border-radius: 7px;
  padding: 3px;
}

.seg button {
  border: none;
  background: transparent;
  padding: 7px;
  border-radius: 5px;
  font-size: 12px;
  color: var(--bf-ink-2);
  font-family: inherit;
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
  gap: 8px;
  padding: 11px 12px;
  border-bottom: 1px solid var(--bf-border);
}

.item:last-child {
  border-bottom: none;
}

.item.done .body strong {
  color: var(--bf-ink-3);
  text-decoration: line-through;
}

.body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.body strong {
  font-size: 12.3px;
  font-weight: 550;
  line-height: 1.45;
}

.body span {
  font-size: 10.5px;
  color: var(--bf-ink-3);
}

.chev {
  color: var(--bf-ink-3);
  margin-top: 3px;
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
