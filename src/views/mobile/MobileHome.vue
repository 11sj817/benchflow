<template>
  <div class="m-page">
    <div class="greet">
      <div>
        <h1>你好，{{ app.currentUser.name }}</h1>
        <p>{{ today }} · 本地演示模式</p>
      </div>
      <UserAvatar :name="app.currentUser.name" :color="app.currentUser.color" size="lg" />
    </div>

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
      </router-link>
      <router-link to="/mobile/record?mode=defect" class="quick">
        <Bug :size="20" />
        <span>提交异常</span>
      </router-link>
    </div>

    <section class="m-card">
      <header class="m-card-head">
        <h2>今日概览</h2>
        <span class="bf-sub">近 7 天</span>
      </header>
      <div class="m-kpis">
        <div><b class="num">{{ stats.executions }}</b><span>执行</span></div>
        <div><b class="num">{{ stats.passRate }}%</b><span>通过率</span></div>
        <div><b class="num">{{ stats.openDefects }}</b><span>未关闭缺陷</span></div>
      </div>
    </section>

    <section class="m-card">
      <header class="m-card-head">
        <h2>我的任务</h2>
        <router-link to="/mobile/tasks" class="more">全部</router-link>
      </header>
      <div class="task-list">
        <router-link v-for="todo in todos" :key="todo.id" :to="todo.link.replace(/^#/, '')" class="task">
          <span class="task-dot" />
          <span class="task-text">
            <strong>{{ todo.title }}</strong>
            <span>{{ fmtDate(todo.dueAt) }} 截止</span>
          </span>
          <ChevronRight :size="14" class="chev" />
        </router-link>
        <EmptyState v-if="todos.length === 0" text="暂无待办" />
      </div>
    </section>

    <section class="m-card">
      <header class="m-card-head">
        <h2>最近执行</h2>
        <span class="bf-sub">与我相关</span>
      </header>
      <div class="run-list">
        <router-link v-for="run in recentRuns" :key="run.id" :to="`/test-executions/${run.id}`" class="run">
          <div class="run-main">
            <strong>{{ caseName(run.caseId) }}</strong>
            <span>{{ run.code }} · {{ versionLabel(run.hardwareVersionId) }} · {{ fromNow(run.startedAt) }}</span>
          </div>
          <StatusPill :label="runResult.get(run.result).label" :tone="runResult.get(run.result).tone" dot />
        </router-link>
        <EmptyState v-if="recentRuns.length === 0" text="暂无执行记录" />
      </div>
    </section>

    <router-link to="/mobile/projects" class="m-link">查看我的项目 <ArrowRight :size="13" /></router-link>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import { ArrowRight, Bug, ChevronRight, ClipboardPlus, ListTodo, ScanLine } from 'lucide-vue-next'
import { db } from '@/services/db'
import { analyticsService, presetRange } from '@/services/analyticsService'
import { todoService } from '@/services/orgService'
import { useAppStore } from '@/stores/app'
import StatusPill from '@/components/common/StatusPill.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { fmtDate, fromNow, runResult } from '@/utils/format'

const app = useAppStore()
const today = `${dayjs().format('YYYY-MM-DD')} 周${'日一二三四五六'[dayjs().day()]}`
const stats = computed(() => analyticsService.dashboard(presetRange('7d')))
const todos = computed(() => todoService.list(app.currentUser.id).slice(0, 4))
const recentRuns = computed(() =>
  db.executions
    .filter((r) => r.testerId === app.currentUser.id || r.projectId === db.projects[0]?.id)
    .slice()
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
    .slice(0, 4),
)

const caseName = (id: string) => db.cases.find((c) => c.id === id)?.name ?? id
const versionLabel = (id: string) => db.versions.find((v) => v.id === id)?.version ?? id
</script>

<style scoped>
.m-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.greet {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2px 2px 4px;
}

.greet h1 {
  font-size: 18px;
  font-weight: 650;
}

.greet p {
  font-size: 11px;
  color: var(--bf-ink-3);
  margin-top: 2px;
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
  background: #fff;
  border: 1px solid var(--bf-border);
  border-radius: 8px;
  padding: 12px;
  color: var(--bf-ink);
  font-size: 12.5px;
  font-weight: 550;
  text-decoration: none;
}

.quick.primary {
  background: var(--bf-primary);
  border-color: var(--bf-primary);
  color: #fff;
}

.quick:active {
  opacity: 0.85;
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

.more {
  font-size: 11.5px;
  color: var(--bf-accent);
}

.m-kpis {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  padding: 12px 0;
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
  font-size: 19px;
  font-weight: 650;
}

.m-kpis span {
  font-size: 10.5px;
  color: var(--bf-ink-3);
}

.task-list,
.run-list {
  display: flex;
  flex-direction: column;
}

.task {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--bf-border);
  color: var(--bf-ink);
  text-decoration: none;
}

.task:last-child {
  border-bottom: none;
}

.task-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #c07a1a;
  flex: none;
}

.task-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.task-text strong {
  font-size: 12.2px;
  font-weight: 550;
  line-height: 1.4;
}

.task-text span {
  font-size: 10.5px;
  color: var(--bf-ink-3);
}

.chev {
  color: var(--bf-ink-3);
}

.run {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--bf-border);
  color: var(--bf-ink);
  text-decoration: none;
}

.run:last-child {
  border-bottom: none;
}

.run-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.run-main strong {
  font-size: 12.2px;
  font-weight: 550;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.run-main span {
  font-size: 10.5px;
  color: var(--bf-ink-3);
}

.m-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 12px;
  color: var(--bf-accent);
  padding: 4px 0 8px;
}
</style>
