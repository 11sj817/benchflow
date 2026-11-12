<template>
  <div class="bf-page">
    <PageHeader title="质量分析" :subtitle="`${range.label} · 通过率、版本对比、缺陷分布与过程能力分析`">
      <template #actions>
        <el-button size="small" @click="exportCsv"><Download :size="14" /> 导出统计</el-button>
        <el-button size="small" @click="router.push('/reports')"><FileText :size="14" /> 生成报告</el-button>
      </template>
    </PageHeader>

    <div class="bf-toolbar filter-panel">
      <el-radio-group v-model="rangeKey" size="small">
        <el-radio-button value="today">今日</el-radio-button>
        <el-radio-button value="7d">近 7 天</el-radio-button>
        <el-radio-button value="30d">近 30 天</el-radio-button>
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button value="custom">自定义</el-radio-button>
      </el-radio-group>
      <el-date-picker
        v-if="rangeKey === 'custom'"
        v-model="customRange"
        type="daterange"
        size="small"
        value-format="YYYY-MM-DD"
        style="width: 230px"
      />
      <el-select v-model="projectFilter" placeholder="项目" clearable size="small" style="width: 170px">
        <el-option v-for="project in db.projects" :key="project.id" :label="project.name" :value="project.id" />
      </el-select>
      <el-select v-model="productFilter" placeholder="产品" clearable size="small" style="width: 170px" @update:model-value="versionFilter = ''">
        <el-option v-for="product in filteredProducts" :key="product.id" :label="product.name" :value="product.id" />
      </el-select>
      <el-select v-model="versionFilter" placeholder="硬件版本" clearable size="small" style="width: 150px">
        <el-option v-for="version in filteredVersions" :key="version.id" :label="version.version" :value="version.id" />
      </el-select>
      <span class="grow" />
      <span class="bf-filter-count">有效执行 {{ quality.finished.length }} 次</span>
    </div>

    <div class="bf-kpis">
      <KpiCard label="执行通过率" :value="quality.passRate" unit="%" :tone="quality.passRate >= 85 ? 'success' : quality.passRate >= 60 ? undefined : 'warning'" :foot="`PASS ${quality.pass} · FAIL ${quality.fail}`" />
      <KpiCard label="执行次数" :value="quality.runs.length" unit="次" :foot="range.label" />
      <KpiCard label="失败率" :value="failRate" unit="%" :tone="failRate > 20 ? 'danger' : undefined" foot="有效执行中的 FAIL 占比" />
      <KpiCard label="缺陷平均关闭周期" :value="quality.avgCloseDays" unit="天" :foot="`已关闭 ${quality.closeCycles.length} 个缺陷`" />
    </div>

    <div class="chart-grid">
      <section class="bf-panel">
        <header class="bf-panel-header"><h2>测试执行与通过率趋势</h2></header>
        <div class="bf-panel-body"><BaseChart :option="trendOption" /></div>
      </section>
      <section class="bf-panel">
        <header class="bf-panel-header"><h2>不同版本结果对比</h2><span class="bf-sub">当前筛选范围内</span></header>
        <div class="bf-panel-body"><BaseChart :option="versionOption" /></div>
      </section>
      <section class="bf-panel">
        <header class="bf-panel-header"><h2>缺陷严重程度分布</h2></header>
        <div class="bf-panel-body"><BaseChart :option="severityOption" /></div>
      </section>
      <section class="bf-panel">
        <header class="bf-panel-header"><h2>测试人员工作量</h2><span class="bf-sub">PASS / FAIL</span></header>
        <div class="bf-panel-body"><BaseChart :option="workloadOption" /></div>
      </section>
      <section class="bf-panel">
        <header class="bf-panel-header"><h2>缺陷关闭周期</h2><span class="bf-sub">天</span></header>
        <div class="bf-panel-body"><BaseChart :option="closeCycleOption" /></div>
      </section>
      <section class="bf-panel">
        <header class="bf-panel-header"><h2>产品通过率</h2></header>
        <div class="bf-panel-body"><BaseChart :option="productOption" /></div>
      </section>
    </div>

    <section class="bf-panel" style="margin-top: 14px">
      <header class="bf-panel-header">
        <h2>测量数据分布与过程能力（Cpk）</h2>
        <div class="bf-row">
          <el-select v-model="paramKeyword" size="small" style="width: 210px" filterable>
            <el-option v-for="param in paramOptions" :key="param" :label="param" :value="param" />
          </el-select>
          <el-button size="small" @click="resetParam">重置参数</el-button>
        </div>
      </header>
      <div class="bf-panel-body dist">
        <div class="dist-chart">
          <BaseChart :option="histogramOption" size="sm" />
        </div>
        <div class="dist-chart">
          <BaseChart :option="boxOption" size="sm" />
        </div>
        <div class="cpk-card">
          <div class="cpk-head">
            <span>样本量 n = <b class="num">{{ capability.n }}</b></span>
            <span>均值 <b class="num">{{ capability.mean.toFixed(2) }}</b></span>
            <span>标准差 <b class="num">{{ capability.sd.toFixed(2) }}</b></span>
            <span>规格 {{ specText }}</span>
          </div>
          <div class="cpk-values">
            <div><span>Cp</span><b class="num">{{ fmt(capability.cp) }}</b></div>
            <div><span>Cpk</span><b class="num" :class="cpkTone">{{ fmt(capability.cpk) }}</b></div>
            <div><span>CPU</span><b class="num">{{ fmt(capability.cpu) }}</b></div>
            <div><span>CPL</span><b class="num">{{ fmt(capability.cpl) }}</b></div>
          </div>
          <div class="bf-hint" :class="{ warn: !capability.applicable || mixedVersions > 1 }">
            <strong>{{ !capability.applicable ? '暂不给出能力结论' : mixedVersions > 1 ? '跨版本混合，仅作参考' : '结论可用' }}</strong>
            <span v-if="!capability.applicable">：{{ capability.reasons.join('；') }}。</span>
            <span v-else-if="mixedVersions > 1">：样本来自 {{ mixedVersions }} 个硬件版本，过程不一致，Cpk 不能代表单一稳定过程。</span>
            {{ capability.note }}
          </div>
          <div class="bf-sub sample-note">
            样本来自当前筛选条件下所有包含「{{ paramKeyword }}」的执行测量值。跨版本混合样本不代表单一稳定过程，请结合版本筛选判断。
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { EChartsOption } from 'echarts'
import { Download, FileText } from 'lucide-vue-next'
import { db } from '@/services/db'
import { analyticsService, presetRange } from '@/services/analyticsService'
import PageHeader from '@/components/common/PageHeader.vue'
import KpiCard from '@/components/common/KpiCard.vue'
import BaseChart from '@/components/charts/BaseChart.vue'
import { severity } from '@/utils/format'
import { boxStats, histogram } from '@/utils/stats'
import { downloadText, toCsv } from '@/utils/csv'

const router = useRouter()

const rangeKey = ref<'today' | '7d' | '30d' | 'all' | 'custom'>('all')
const customRange = ref<[string, string]>([
  new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10),
  new Date().toISOString().slice(0, 10),
])
const projectFilter = ref('')
const productFilter = ref('')
const versionFilter = ref('')
const paramKeyword = ref('输出纹波')

const range = computed(() =>
  rangeKey.value === 'custom'
    ? presetRange('custom', customRange.value[0], customRange.value[1])
    : presetRange(rangeKey.value),
)

const filters = computed(() => ({
  projectId: projectFilter.value || undefined,
  productId: productFilter.value || undefined,
  versionId: versionFilter.value || undefined,
}))

const quality = computed(() => analyticsService.quality(range.value, filters.value))
const failRate = computed(() => {
  const total = quality.value.finished.length
  return total ? Math.round((quality.value.fail / total) * 1000) / 10 : 0
})

const filteredProducts = computed(() =>
  projectFilter.value ? db.products.filter((p) => p.projectId === projectFilter.value) : db.products,
)
const filteredVersions = computed(() =>
  db.versions.filter((v) => (productFilter.value ? v.productId === productFilter.value : true) && v.kind === 'hardware'),
)

const paramOptions = computed(() => {
  const params = analyticsService.measurementParams().filter((p) => p.includes('纹波') || p.includes('效率') || p.includes('温度') || p.includes('过冲'))
  return params.length ? params : analyticsService.measurementParams()
})

const capability = computed(() => analyticsService.capability(paramKeyword.value, filters.value))
const capabilitySamples = computed(() => analyticsService.samples(paramKeyword.value, filters.value))
const mixedVersions = computed(() => new Set(capabilitySamples.value.rows.map((row) => row.versionId)).size)
const specText = computed(() => {
  const { min, max } = capability.value
  if (min !== null && max !== null) return `${min} ~ ${max}`
  if (max !== null) return `≤ ${max}`
  if (min !== null) return `≥ ${min}`
  return '无规格限'
})

const fmt = (value: number | null) => (value === null || Number.isNaN(value) ? '—' : value.toFixed(2))
const cpkTone = computed(() => {
  if (!capability.value.applicable || capability.value.cpk === null) return ''
  if (capability.value.cpk >= 1.33) return 'good'
  if (capability.value.cpk >= 1.0) return 'ok'
  return 'bad'
})

const resetParam = () => {
  paramKeyword.value = '输出纹波'
}

const axisStyle = {
  axisLabel: { color: '#8494a8', fontSize: 10 },
  axisLine: { lineStyle: { color: '#e1e7ef' } },
  axisTick: { show: false },
}
const splitStyle = { splitLine: { lineStyle: { color: '#eef2f7' } } }

const trendOption = computed<EChartsOption>(() => ({
  grid: { left: 40, right: 40, top: 28, bottom: 26 },
  tooltip: { trigger: 'axis' },
  legend: { top: 0, right: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 10 } },
  xAxis: { type: 'category', data: quality.value.trend.map((d) => d.day.slice(5)), ...axisStyle },
  yAxis: [
    { type: 'value', name: '次数', minInterval: 1, interval: 1, ...axisStyle, ...splitStyle },
    { type: 'value', name: '通过率 %', max: 100, ...axisStyle, splitLine: { show: false } },
  ],
  series: [
    { name: 'PASS', type: 'bar', stack: 'a', barWidth: 12, itemStyle: { color: '#2f7f6b' }, data: quality.value.trend.map((d) => d.pass) },
    { name: 'FAIL', type: 'bar', stack: 'a', barWidth: 12, itemStyle: { color: '#b02a1f' }, data: quality.value.trend.map((d) => d.fail) },
    {
      name: '通过率',
      type: 'line',
      yAxisIndex: 1,
      symbolSize: 4,
      lineStyle: { width: 1.5, color: '#1e3a5f' },
      itemStyle: { color: '#1e3a5f' },
      data: quality.value.trend.map((d) => (d.total ? d.rate : null)),
    },
  ],
}))

const versionOption = computed<EChartsOption>(() => ({
  grid: { left: 46, right: 20, top: 20, bottom: 30 },
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
  xAxis: { type: 'category', data: quality.value.versionRows.map((v) => v.version.version), ...axisStyle },
  yAxis: { type: 'value', max: 100, ...axisStyle, ...splitStyle },
  series: [
    {
      type: 'bar',
      barWidth: 22,
      label: { show: true, position: 'top', fontSize: 10, color: '#54637a', formatter: '{c}%' },
      data: quality.value.versionRows.map((v) => ({
        value: v.rate,
        itemStyle: { color: v.rate >= 85 ? '#2f7f6b' : v.rate >= 60 ? '#4a7ba7' : '#b02a1f' },
      })),
    },
  ],
}))

const severityOption = computed<EChartsOption>(() => ({
  grid: { left: 60, right: 26, top: 10, bottom: 24 },
  tooltip: { trigger: 'axis' },
  xAxis: { type: 'value', ...axisStyle, ...splitStyle },
  yAxis: { type: 'category', data: quality.value.defectBySeverity.map((d) => severity.get(d.level).label), ...axisStyle },
  series: [
    {
      type: 'bar',
      barWidth: 12,
      data: quality.value.defectBySeverity.map((d) => ({
        value: d.count,
        itemStyle: { color: d.level === 'blocker' || d.level === 'critical' ? '#b02a1f' : d.level === 'major' ? '#c07a1a' : '#4a7ba7' },
      })),
      label: { show: true, position: 'right', fontSize: 10, color: '#54637a' },
    },
  ],
}))

const workloadOption = computed<EChartsOption>(() => ({
  grid: { left: 42, right: 18, top: 28, bottom: 26 },
  tooltip: { trigger: 'axis' },
  legend: { top: 0, right: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 10 } },
  xAxis: { type: 'category', data: quality.value.workload.map((w) => w.member.name), ...axisStyle },
  yAxis: { type: 'value', ...axisStyle, ...splitStyle },
  series: [
    { name: 'PASS', type: 'bar', stack: 'w', barWidth: 18, itemStyle: { color: '#2f7f6b' }, data: quality.value.workload.map((w) => w.pass) },
    { name: 'FAIL', type: 'bar', stack: 'w', barWidth: 18, itemStyle: { color: '#b02a1f' }, data: quality.value.workload.map((w) => w.fail) },
  ],
}))

const closeCycleOption = computed<EChartsOption>(() => ({
  grid: { left: 52, right: 20, top: 16, bottom: 40 },
  tooltip: { trigger: 'axis' },
  xAxis: {
    type: 'category',
    data: quality.value.closeCycles.map((c) => c.code),
    ...axisStyle,
    axisLabel: { color: '#8494a8', fontSize: 9, rotate: 28 },
  },
  yAxis: { type: 'value', name: '天', ...axisStyle, ...splitStyle },
  series: [
    {
      type: 'bar',
      barWidth: 16,
      itemStyle: { color: '#4a7ba7' },
      label: { show: true, position: 'top', fontSize: 9, color: '#54637a' },
      data: quality.value.closeCycles.map((c) => c.days),
    },
  ],
}))

const productOption = computed<EChartsOption>(() => ({
  grid: { left: 44, right: 18, top: 16, bottom: 42 },
  tooltip: { trigger: 'axis' },
  xAxis: {
    type: 'category',
    data: quality.value.productRows.map((p) => p.product.name),
    ...axisStyle,
    axisLabel: { color: '#8494a8', fontSize: 9, rotate: 20, interval: 0 },
  },
  yAxis: { type: 'value', max: 100, ...axisStyle, ...splitStyle },
  series: [
    {
      type: 'bar',
      barWidth: 16,
      itemStyle: { color: '#1f6f8b' },
      label: { show: true, position: 'top', fontSize: 9, color: '#54637a', formatter: '{c}%' },
      data: quality.value.productRows.map((p) => p.rate),
    },
  ],
}))

const histogramOption = computed<EChartsOption>(() => {
  const values = capability.value.values
  const bins = histogram(values, 8)
  return {
    grid: { left: 42, right: 20, top: 24, bottom: 28 },
    tooltip: { trigger: 'axis' },
    title: {
      text: `${paramKeyword.value} 分布直方图`,
      left: 0,
      top: 0,
      textStyle: { fontSize: 11, color: '#54637a', fontWeight: 'normal' },
    },
    xAxis: {
      type: 'category',
      data: bins.map((b) => b.from.toFixed(1)),
      ...axisStyle,
    },
    yAxis: { type: 'value', name: '频数', ...axisStyle, ...splitStyle },
    series: [
      {
        type: 'bar',
        barWidth: '85%',
        itemStyle: { color: '#4a7ba7' },
        data: bins.map((b) => b.count),
      },
    ],
  }
})

const boxOption = computed<EChartsOption>(() => {
  const groups = Array.from(new Set(capability.value.values.length ? db.executions.filter((e) => (filters.value.versionId ? e.hardwareVersionId === filters.value.versionId : true)).map((e) => e.hardwareVersionId) : []))
  const byVersion = groups
    .map((versionId) => {
      const version = db.versions.find((v) => v.id === versionId)
      const values = db.executions
        .filter((e) => e.hardwareVersionId === versionId && (!filters.value.productId || e.productId === filters.value.productId))
        .flatMap((e) => e.measurements.filter((m) => m.param.includes(paramKeyword.value) && m.value !== null).map((m) => m.value as number))
      return { label: version?.version ?? versionId, values }
    })
    .filter((row) => row.values.length >= 4)
  return {
    grid: { left: 42, right: 20, top: 24, bottom: 30 },
    tooltip: { trigger: 'item' },
    title: {
      text: '按硬件版本的测量分布（箱线图）',
      left: 0,
      top: 0,
      textStyle: { fontSize: 11, color: '#54637a', fontWeight: 'normal' },
    },
    xAxis: { type: 'category', data: byVersion.map((v) => v.label), ...axisStyle },
    yAxis: { type: 'value', scale: true, ...axisStyle, ...splitStyle },
    series: [
      {
        type: 'boxplot',
        itemStyle: { color: '#1e3a5f', borderColor: '#1e3a5f' },
        data: byVersion.map((v) => {
          const box = boxStats(v.values)
          return [box.min, box.q1, box.median, box.q3, box.max]
        }),
      },
    ],
  }
})

const exportCsv = () => {
  const rows = quality.value.versionRows.map((v) => [v.version.version, v.version.label, v.total, v.pass, v.rate])
  downloadText(
    `benchflow-quality-${new Date().toISOString().slice(0, 10)}.csv`,
    toCsv(['版本', '说明', '执行次数', 'PASS', '通过率(%)'], rows),
  )
  void router
}
</script>

<style scoped>
.filter-panel {
  border: 1px solid var(--bf-border);
  border-radius: var(--bf-radius-lg);
  background: var(--bf-surface);
  margin-bottom: 14px;
}

.chart-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 14px;
}

.dist {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(300px, 0.85fr);
  gap: 16px;
  align-items: start;
}

.dist-chart {
  min-width: 0;
}

.cpk-card {
  border: 1px solid var(--bf-border);
  border-radius: 6px;
  padding: 12px;
  background: var(--bf-surface-2);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cpk-head {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  font-size: 11.5px;
  color: var(--bf-ink-3);
}

.cpk-head b {
  color: var(--bf-ink);
  font-weight: 600;
}

.cpk-values {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.cpk-values > div {
  background: #fff;
  border: 1px solid var(--bf-border);
  border-radius: 4px;
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.cpk-values span {
  font-size: 10.5px;
  color: var(--bf-ink-3);
}

.cpk-values b {
  font-size: 16px;
  font-weight: 620;
}

.cpk-values b.good {
  color: #157a5b;
}

.cpk-values b.ok {
  color: #a35a06;
}

.cpk-values b.bad {
  color: #b02a1f;
}

.sample-note {
  line-height: 1.55;
}

@media (max-width: 1280px) {
  .chart-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .dist {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
