<template>
  <div class="bf-page">
    <PageHeader title="工作台" :subtitle="`${db.org.name} · 硬件研发测试概览`">
      <template #meta>
        <div class="range-row">
          <el-radio-group v-model="rangeKey" size="small">
            <el-radio-button value="today">今日</el-radio-button>
            <el-radio-button value="7d">近 7 天</el-radio-button>
            <el-radio-button value="30d">近 30 天</el-radio-button>
            <el-radio-button value="custom">自定义</el-radio-button>
          </el-radio-group>
          <el-date-picker
            v-if="rangeKey === 'custom'"
            v-model="customRange"
            type="daterange"
            size="small"
            value-format="YYYY-MM-DD"
            start-placeholder="开始"
            end-placeholder="结束"
            style="width: 230px"
          />
        </div>
      </template>
      <template #actions>
        <el-button size="small" @click="refresh"><RefreshCw :size="14" /> 刷新</el-button>
        <el-button size="small" type="primary" @click="router.push('/test-executions')">
          <PlayCircle :size="14" /> 查看执行
        </el-button>
      </template>
    </PageHeader>

    <div class="bf-kpis">
      <KpiCard
        label="活跃项目"
        :value="data.activeProjects"
        unit="个"
        :foot="`${projectTotal} 个项目 · 点击进入项目管理`"
        :icon="FolderKanban"
        class="clickable"
        @click="router.push('/projects')"
      />
      <KpiCard
        label="测试执行"
        :value="data.executions"
        unit="次"
        :foot="`${range.label} · 失败 ${data.failRate}%`"
        :icon="PlayCircle"
        class="clickable"
        @click="router.push('/test-executions')"
      />
      <KpiCard
        label="执行通过率"
        :value="data.passRate"
        unit="%"
        :tone="data.passRate >= 85 ? 'success' : data.passRate >= 60 ? undefined : 'warning'"
        :foot="`有效执行 ${finishedCount} 次`"
        :icon="TrendingUp"
        class="clickable"
        @click="router.push('/analytics')"
      />
      <KpiCard
        label="未关闭缺陷"
        :value="data.openDefects"
        unit="个"
        :tone="data.criticalDefects > 0 ? 'danger' : undefined"
        :foot="`其中严重 / 阻塞 ${data.criticalDefects} 个`"
        :icon="Bug"
        class="clickable"
        @click="router.push('/defects')"
      />
    </div>

    <div class="top-grid">
      <section class="bf-panel">
        <header class="bf-panel-header">
          <h2>测试质量趋势</h2>
          <span class="bf-sub">{{ range.label }} · 按日统计执行结果</span>
        </header>
        <div class="bf-panel-body">
          <BaseChart :option="trendOption" />
        </div>
      </section>

      <section class="bf-panel">
        <header class="bf-panel-header">
          <h2>需要关注</h2>
          <span class="bf-chip">{{ data.attention.length }} 项</span>
        </header>
        <div class="attention">
          <button
            v-for="(row, idx) in data.attention"
            :key="idx"
            type="button"
            class="attention-row"
            @click="router.push(row.link.replace(/^#/, ''))"
          >
            <span class="level" :class="row.level" />
            <span class="a-body">
              <strong>{{ row.title }}</strong>
              <span class="bf-sub">{{ row.detail }}</span>
            </span>
            <ArrowUpRight :size="14" class="arrow" />
          </button>
          <EmptyState v-if="data.attention.length === 0" text="当前没有需要特别关注的异常" />
        </div>
      </section>
    </div>

    <div class="mid-grid">
      <section class="bf-panel">
        <header class="bf-panel-header">
          <h2>项目执行情况</h2>
          <router-link to="/projects" class="bf-link-btn">全部项目</router-link>
        </header>
        <el-table :data="data.projectRows" size="small" @row-click="(row: ProjectRow) => router.push(`/projects/${row.project.id}`)">
          <el-table-column label="项目" min-width="200">
            <template #default="{ row }">
              <div class="bf-table-name">{{ row.project.name }}</div>
              <div class="bf-sub"><span class="mono">{{ row.project.code }}</span> · {{ row.owner }}</div>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="92">
            <template #default="{ row }">
              <StatusPill :label="projectStatus.get(row.project.status).label" :tone="projectStatus.get(row.project.status).tone" />
            </template>
          </el-table-column>
          <el-table-column label="通过率" width="82" align="right">
            <template #default="{ row }"><span class="num">{{ row.stats.passRate }}%</span></template>
          </el-table-column>
          <el-table-column label="未关闭缺陷" width="100" align="right">
            <template #default="{ row }">
              <span class="num" :class="{ danger: row.stats.openDefects > 0 }">{{ row.stats.openDefects }}</span>
            </template>
          </el-table-column>
          <el-table-column label="进度" width="150">
            <template #default="{ row }">
              <el-progress :percentage="row.stats.progress" :stroke-width="6" :show-text="false" />
              <span class="bf-sub">{{ row.stats.progress }}%</span>
            </template>
          </el-table-column>
          <el-table-column label="风险" width="70" align="center">
            <template #default="{ row }">
              <el-tooltip v-if="row.risks.length" :content="row.risks.map((r: RiskRow) => r.text).join(' / ')" placement="top">
                <span class="risk-count">{{ row.risks.length }}</span>
              </el-tooltip>
              <span v-else class="muted">—</span>
            </template>
          </el-table-column>
        </el-table>
      </section>

      <div class="right-col">
        <section class="bf-panel">
          <header class="bf-panel-header">
            <h2>我的待办</h2>
            <span class="bf-sub">{{ app.currentUser.name }}</span>
          </header>
          <div class="todo-list">
            <label v-for="todo in data.todos" :key="todo.id" class="todo">
              <el-checkbox :model-value="false" @change="todoService.toggle(todo.id)" />
              <span class="todo-body" @click="router.push(todo.link.replace(/^#/, ''))">
                <span class="todo-title">{{ todo.title }}</span>
                <span class="bf-sub">截止 {{ fmtDate(todo.dueAt) }} · {{ todoKind(todo.kind) }}</span>
              </span>
            </label>
            <EmptyState v-if="data.todos.length === 0" text="没有待办事项" hint="完成得很好，可以推进下一阶段验证。" />
          </div>
        </section>

        <section class="bf-panel">
          <header class="bf-panel-header">
            <h2>待审核报告</h2>
            <router-link to="/reports" class="bf-link-btn">报告中心</router-link>
          </header>
          <div class="review-list">
            <button
              v-for="report in data.pendingReports"
              :key="report.id"
              type="button"
              class="review-row"
              @click="router.push(`/reports/${report.id}`)"
            >
              <FileText :size="15" class="icon" />
              <span class="r-body">
                <strong>{{ report.title }}</strong>
                <span class="bf-sub"><span class="mono">{{ report.code }}</span> · 作者 {{ memberName(report.authorId) }}</span>
              </span>
              <StatusPill :label="reportStatus.get(report.status).label" :tone="reportStatus.get(report.status).tone" />
            </button>
            <EmptyState v-if="data.pendingReports.length === 0" text="没有待审核报告" />
          </div>
        </section>
      </div>
    </div>

    <div class="bottom-grid">
      <section class="bf-panel">
        <header class="bf-panel-header">
          <h2>最近活动</h2>
          <router-link to="/audit" class="bf-link-btn">审计日志</router-link>
        </header>
        <div class="activity-list">
          <div v-for="log in data.activities" :key="log.id" class="activity">
            <UserAvatar :name="log.actorName" size="sm" :color="memberColor(log.actorId)" />
            <div class="a-main">
              <div><b>{{ log.actorName }}</b> {{ log.summary }}</div>
              <div class="bf-sub">{{ log.entityLabel }} · {{ fromNow(log.at) }}</div>
            </div>
            <StatusPill :label="auditAction.get(log.action).label" :tone="auditAction.get(log.action).tone" />
          </div>
          <EmptyState v-if="data.activities.length === 0" text="暂无活动记录" />
        </div>
      </section>

      <section class="bf-panel">
        <header class="bf-panel-header">
          <h2>缺陷严重程度分布</h2>
          <span class="bf-sub">全部未关闭 + 已关闭</span>
        </header>
        <div class="bf-panel-body">
          <BaseChart :option="severityOption" size="sm" />
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { EChartsOption } from 'echarts'
import {
  ArrowUpRight,
  Bug,
  FileText,
  FolderKanban,
  PlayCircle,
  RefreshCw,
  TrendingUp,
} from 'lucide-vue-next'
import { db } from '@/services/db'
import { analyticsService, presetRange } from '@/services/analyticsService'
import { todoService } from '@/services/orgService'
import { useAppStore } from '@/stores/app'
import PageHeader from '@/components/common/PageHeader.vue'
import KpiCard from '@/components/common/KpiCard.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import BaseChart from '@/components/charts/BaseChart.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import {
  auditAction,
  fmtDate,
  fromNow,
  projectStatus,
  reportStatus,
  severity,
} from '@/utils/format'
import type { Project, Severity } from '@/types'

interface ProjectRow {
  project: Project
  stats: { passRate: number; openDefects: number; progress: number }
  risks: RiskRow[]
}

interface RiskRow {
  level: string
  text: string
}

const router = useRouter()
const app = useAppStore()

const rangeKey = ref<'today' | '7d' | '30d' | 'custom'>('30d')
const customRange = ref<[string, string]>([
  new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10),
  new Date().toISOString().slice(0, 10),
])

const range = computed(() =>
  rangeKey.value === 'custom'
    ? presetRange('custom', customRange.value[0], customRange.value[1])
    : presetRange(rangeKey.value),
)

const data = computed(() => analyticsService.dashboard(range.value))
const projectTotal = computed(() => db.projects.length)
const finishedCount = computed(
  () => data.value.trend.reduce((sum, day) => sum + day.pass + day.fail, 0),
)

const trendOption = computed<EChartsOption>(() => ({
  grid: { left: 38, right: 42, top: 26, bottom: 28 },
  tooltip: { trigger: 'axis' },
  legend: { data: ['PASS', 'FAIL', '通过率'], right: 0, top: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11 } },
  xAxis: {
    type: 'category',
    data: data.value.trend.map((d) => d.day.slice(5)),
    axisLine: { lineStyle: { color: '#e1e7ef' } },
    axisLabel: { color: '#8494a8', fontSize: 10 },
    axisTick: { show: false },
  },
  yAxis: [
    {
      type: 'value',
      name: '次数',
      minInterval: 1,
      interval: 1,
      nameTextStyle: { color: '#8494a8', fontSize: 10 },
      splitLine: { lineStyle: { color: '#eef2f7' } },
      axisLabel: { color: '#8494a8', fontSize: 10 },
    },
    {
      type: 'value',
      name: '通过率 %',
      max: 100,
      nameTextStyle: { color: '#8494a8', fontSize: 10 },
      splitLine: { show: false },
      axisLabel: { color: '#8494a8', fontSize: 10 },
    },
  ],
  series: [
    {
      name: 'PASS',
      type: 'bar',
      stack: 'total',
      barWidth: 14,
      itemStyle: { color: '#2f7f6b', borderRadius: [2, 2, 0, 0] },
      data: data.value.trend.map((d) => d.pass),
    },
    {
      name: 'FAIL',
      type: 'bar',
      stack: 'total',
      barWidth: 14,
      itemStyle: { color: '#b02a1f', borderRadius: [2, 2, 0, 0] },
      data: data.value.trend.map((d) => d.fail),
    },
    {
      name: '通过率',
      type: 'line',
      yAxisIndex: 1,
      smooth: false,
      symbolSize: 5,
      lineStyle: { width: 1.6, color: '#1e3a5f' },
      itemStyle: { color: '#1e3a5f' },
      data: data.value.trend.map((d) => (d.total ? Math.round((d.pass / d.total) * 100) : null)),
    },
  ],
}))

const severityOption = computed<EChartsOption>(() => {
  const keys: Severity[] = ['blocker', 'critical', 'major', 'minor', 'trivial']
  return {
    grid: { left: 62, right: 24, top: 10, bottom: 22 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#eef2f7' } },
      axisLabel: { color: '#8494a8', fontSize: 10 },
    },
    yAxis: {
      type: 'category',
      data: keys.map((k) => severity.get(k).label),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#54637a', fontSize: 11 },
    },
    series: [
      {
        type: 'bar',
        barWidth: 12,
        data: keys.map((k) => ({
          value: data.value.severity[k],
          itemStyle: { color: k === 'blocker' || k === 'critical' ? '#b02a1f' : k === 'major' ? '#c07a1a' : '#4a7ba7' },
        })),
        label: { show: true, position: 'right', color: '#54637a', fontSize: 10 },
      },
    ],
  }
})

const todoKind = (kind: string) =>
  ({ review: '审核', execute: '执行', defect: '缺陷', report: '报告', other: '其他' })[kind] ?? kind

const memberName = (id: string) => db.members.find((m) => m.id === id)?.name ?? id
const memberColor = (id: string) => db.members.find((m) => m.id === id)?.color ?? '#6b7a8f'

const refresh = () => {
  router.replace({ query: { t: Date.now().toString() } })
}
</script>

<style scoped>
.range-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.clickable {
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.clickable:hover {
  border-color: var(--bf-border-strong);
}

.top-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(320px, 0.95fr);
  gap: 14px;
  margin-top: 14px;
  align-items: start;
}

.mid-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(320px, 0.85fr);
  gap: 14px;
  margin-top: 14px;
  align-items: start;
}

.right-col {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.bottom-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(300px, 0.8fr);
  gap: 14px;
  margin-top: 14px;
  align-items: start;
}

.attention {
  max-height: 300px;
  overflow-y: auto;
}

.attention-row {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  width: 100%;
  border: none;
  background: transparent;
  border-bottom: 1px solid var(--bf-border);
  padding: 9px 14px;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
}

.attention-row:hover {
  background: var(--bf-surface-2);
}

.level {
  width: 3px;
  align-self: stretch;
  min-height: 28px;
  border-radius: 2px;
  background: var(--bf-border-strong);
  flex: none;
}

.level.high {
  background: #b02a1f;
}

.level.medium {
  background: #c07a1a;
}

.level.low {
  background: #4a7ba7;
}

.a-body {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  min-width: 0;
}

.a-body strong {
  font-size: 12.5px;
  font-weight: 600;
}

.arrow {
  color: var(--bf-ink-3);
  margin-top: 3px;
  flex: none;
}

.todo-list,
.review-list,
.activity-list {
  display: flex;
  flex-direction: column;
}

.todo {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--bf-border);
  cursor: pointer;
}

.todo:last-child {
  border-bottom: none;
}

.todo-body {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.todo-title {
  font-size: 12.5px;
  color: var(--bf-ink);
  line-height: 1.4;
}

.review-row {
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  background: transparent;
  border-bottom: 1px solid var(--bf-border);
  padding: 9px 14px;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
}

.review-row:hover {
  background: var(--bf-surface-2);
}

.review-row .icon {
  color: var(--bf-accent);
  flex: none;
}

.r-body {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  min-width: 0;
}

.r-body strong {
  font-size: 12.3px;
  font-weight: 550;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.activity {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--bf-border);
}

.activity:last-child {
  border-bottom: none;
}

.a-main {
  flex: 1;
  min-width: 0;
  font-size: 12.3px;
}

.danger {
  color: var(--bf-danger);
}

.risk-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 3px;
  background: #fdf3e4;
  color: #8a4d05;
  font-size: 11px;
  cursor: help;
}

@media (max-width: 1280px) {
  .top-grid,
  .mid-grid,
  .bottom-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
