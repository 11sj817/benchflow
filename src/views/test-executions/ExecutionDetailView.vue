<template>
  <div v-if="run" class="bf-page execution-page">
    <div class="exec-head">
      <button class="back" type="button" @click="router.push('/test-executions')"><ArrowLeft :size="15" /> 测试执行</button>
      <div class="title-row">
        <div>
          <div class="code-line">
            <span class="bf-table-code mono">{{ run.code }}</span>
            <StatusPill :label="runResult.get(run.result).label" :tone="runResult.get(run.result).tone" dot />
            <span class="bf-chip">{{ planCode(run.planId) }}</span>
            <span class="bf-chip">{{ projectName(run.projectId) }}</span>
          </div>
          <h1>{{ caseName(run.caseId) }}</h1>
          <p class="sub">
            {{ productName(run.productId) }} · {{ versionLabel(run.hardwareVersionId) }}
            <template v-if="run.firmwareVersionId"> / {{ versionLabel(run.firmwareVersionId) }}</template>
            · 执行人 {{ memberName(run.testerId) }} · <span class="num">{{ fmtDateTime(run.startedAt) }}</span>
          </p>
        </div>
        <div class="bf-header-actions">
          <input ref="csvInput" type="file" accept=".csv,text/csv" class="hidden-input" @change="importCsv" />
          <el-button size="small" @click="csvInput?.click()"><Upload :size="14" /> 导入测量 CSV</el-button>
          <el-button v-if="run.result === 'FAIL' && app.can('create')" size="small" type="danger" plain @click="createDefect">
            <Bug :size="14" /> 创建缺陷
          </el-button>
          <el-button v-if="app.can('execute')" size="small" type="primary" @click="submitRun">
            <Check :size="14" /> 提交执行结果
          </el-button>
        </div>
      </div>
    </div>

    <div class="exec-grid">
      <div class="exec-main">
        <section class="bf-panel">
          <header class="bf-panel-header">
            <h2>测试步骤与实测数据</h2>
            <span class="bf-sub">阈值来自用例配置，系统自动判定</span>
          </header>
          <div class="steps">
            <div v-for="(step, index) in caseSteps" :key="step.id" class="exec-step">
              <div class="step-head">
                <span class="step-index">{{ index + 1 }}</span>
                <div class="step-title">
                  <strong>{{ step.name }}</strong>
                  <span class="bf-sub">{{ step.action }}</span>
                </div>
                <StatusPill
                  v-if="verdictOf(step)"
                  :label="runResult.get(verdictOf(step)!).label"
                  :tone="runResult.get(verdictOf(step)!).tone"
                  dot
                />
                <StatusPill v-else label="未记录" tone="neutral" />
              </div>
              <div class="step-expect">预期：{{ step.expected }}</div>

              <div v-if="step.param" class="measure-row">
                <div class="m-name">
                  {{ step.param.name }} <span class="unit">{{ step.param.unit }}</span>
                  <span v-if="step.param.required" class="required">必填</span>
                </div>
                <div class="m-limit">限值 {{ limitText(step.param) }}</div>
                <el-input-number
                  :model-value="measurementOf(step)?.value ?? undefined"
                  :controls="false"
                  :disabled="!app.can('execute')"
                  size="default"
                  placeholder="录入实测值"
                  style="width: 150px"
                  @change="(value: number | undefined) => setValue(step, value)"
                />
                <span class="m-unit">{{ step.param.unit }}</span>
                <StatusPill
                  v-if="measurementOf(step)"
                  :label="runResult.get(measurementOf(step)!.result ?? 'PENDING').label"
                  :tone="runResult.get(measurementOf(step)!.result ?? 'PENDING').tone"
                  dot
                />
              </div>

              <div v-else class="manual-row">
                <span class="bf-sub">人工判定：</span>
                <el-radio-group
                  :model-value="stepResultOf(step.id)"
                  size="small"
                  :disabled="!app.can('execute')"
                  @update:model-value="(value: RunResult) => executionService.setStepResult(run!.id, step.id, value)"
                >
                  <el-radio-button value="PASS">PASS</el-radio-button>
                  <el-radio-button value="FAIL">FAIL</el-radio-button>
                  <el-radio-button value="BLOCKED">BLOCKED</el-radio-button>
                  <el-radio-button value="SKIPPED">SKIPPED</el-radio-button>
                </el-radio-group>
              </div>
            </div>
          </div>
        </section>

        <section class="bf-panel">
          <header class="bf-panel-header">
            <h2>测量数据汇总</h2>
            <span class="bf-sub">{{ measurements.length }} 项 · FAIL {{ failCount }} 项</span>
          </header>
          <el-table :data="measurements" size="small">
            <el-table-column prop="param" label="测量参数" min-width="200" />
            <el-table-column label="实测值" width="120" align="right">
              <template #default="{ row }">
                <span class="num" :class="{ fail: row.result === 'FAIL' }">{{ row.value ?? '—' }}</span>
                <span class="bf-sub"> {{ row.unit }}</span>
              </template>
            </el-table-column>
            <el-table-column label="限值" width="150">
              <template #default="{ row }"><span class="mono">{{ measureLimit(row) }}</span></template>
            </el-table-column>
            <el-table-column label="判定" width="94">
              <template #default="{ row }">
                <StatusPill :label="runResult.get(row.result ?? 'PENDING').label" :tone="runResult.get(row.result ?? 'PENDING').tone" dot />
              </template>
            </el-table-column>
            <el-table-column label="编辑" width="160">
              <template #default="{ row }">
                <el-input-number
                  :model-value="row.value ?? undefined"
                  :controls="false"
                  size="small"
                  :disabled="!app.can('execute')"
                  style="width: 100%"
                  @change="(value: number | undefined) => executionService.setMeasurement(run!.id, row.id, value ?? null)"
                />
              </template>
            </el-table-column>
          </el-table>
        </section>

        <section class="bf-panel">
          <header class="bf-panel-header"><h2>环境与工况参数</h2><span class="bf-sub">可修改并保存</span></header>
          <div class="bf-panel-body env-grid">
            <label>温度 ℃<el-input-number v-model="env.temperature" :controls="false" size="small" :disabled="!app.can('execute')" /></label>
            <label>湿度 %RH<el-input-number v-model="env.humidity" :controls="false" size="small" :disabled="!app.can('execute')" /></label>
            <label>输入电压 V<el-input-number v-model="env.inputVoltage" :controls="false" size="small" :disabled="!app.can('execute')" /></label>
            <label>负载电流 A<el-input-number v-model="env.load" :controls="false" size="small" :disabled="!app.can('execute')" /></label>
            <label class="wide">工况描述<el-input v-model="env.conditions" size="small" :disabled="!app.can('execute')" /></label>
            <el-button size="small" :disabled="!app.can('execute')" @click="saveEnv">保存环境参数</el-button>
          </div>
        </section>
      </div>

      <aside class="exec-side">
        <section class="bf-panel result-panel">
          <header class="bf-panel-header"><h2>执行结果</h2></header>
          <div class="bf-panel-body">
            <div class="big-result" :class="run.result.toLowerCase()">{{ run.result }}</div>
            <div class="result-counts">
              <span>PASS <b class="num">{{ passCount }}</b></span>
              <span>FAIL <b class="num danger">{{ failCount }}</b></span>
              <span>待录入 <b class="num">{{ pendingCount }}</b></span>
            </div>
            <div class="bf-hint" :class="{ danger: failCount > 0 }">
              <template v-if="failCount > 0">存在超限测量项，提交后将被判定为 FAIL，可创建缺陷进入闭环。</template>
              <template v-else-if="pendingCount > 0">仍有 {{ pendingCount }} 个测量项未录入，提交前需要补全必填项。</template>
              <template v-else>所有必填测量项已录入，可提交执行结果。</template>
            </div>
            <div class="force-row">
              <el-button size="small" :disabled="!app.can('execute')" @click="forceResult('BLOCKED')">标记 BLOCKED</el-button>
              <el-button size="small" :disabled="!app.can('execute')" @click="forceResult('SKIPPED')">标记 SKIPPED</el-button>
            </div>
            <div class="meta-list">
              <div><span>提交时间</span><b>{{ run.finishedAt ? fmtDateTime(run.finishedAt) : '尚未提交' }}</b></div>
              <div><span>测试设备</span><b>{{ run.deviceIds.map(deviceLabel).join('、') || '未记录' }}</b></div>
              <div><span>关联缺陷</span><b>{{ run.defectIds.join('、') || '无' }}</b></div>
            </div>
          </div>
        </section>

        <section class="bf-panel">
          <header class="bf-panel-header">
            <h2>附件与波形</h2>
            <span class="bf-chip">{{ run.attachments.length }}</span>
          </header>
          <div class="bf-panel-body">
            <div class="att-list">
              <div v-for="att in run.attachments" :key="att.id" class="att">
                <StatusPill :label="fileKind.get(att.kind).label" :tone="fileKind.get(att.kind).tone" />
                <div class="att-name">
                  <span class="ellipsis">{{ att.name }}</span>
                  <span class="bf-sub">{{ fmtBytes(att.size) }}</span>
                </div>
              </div>
              <EmptyState v-if="run.attachments.length === 0" text="暂无附件" />
            </div>
            <input ref="fileInput" type="file" class="hidden-input" @change="uploadAttachment" />
            <el-button size="small" :disabled="!app.can('execute')" @click="fileInput?.click()"><Upload :size="14" /> 添加附件</el-button>
            <div class="bf-sub" style="margin-top: 6px">演示模式单文件 ≤ 2MB，仅保存文件元信息。</div>
          </div>
        </section>

        <section class="bf-panel">
          <header class="bf-panel-header"><h2>测量曲线</h2><span class="bf-sub">{{ chartDataset?.name ?? '无采样数据' }}</span></header>
          <div class="bf-panel-body">
            <BaseChart v-if="chartOption" :option="chartOption" size="sm" />
            <EmptyState v-else text="暂无可绘制的采样数据" hint="上传 CSV 采样数据后可在此显示曲线。" />
          </div>
        </section>

        <section class="bf-panel">
          <header class="bf-panel-header"><h2>关联缺陷</h2></header>
          <div class="bf-panel-body">
            <router-link v-for="code in run.defectIds" :key="code" :to="`/defects/${code}`" class="defect-link">
              <Bug :size="13" /> {{ code }} · {{ defectTitle(code) }}
            </router-link>
            <EmptyState v-if="run.defectIds.length === 0" text="没有关联缺陷" />
          </div>
        </section>

        <section class="bf-panel">
          <header class="bf-panel-header"><h2>操作历史</h2></header>
          <div class="bf-panel-body">
            <div class="history">
              <div v-for="log in history" :key="log.id" class="history-row">
                <span class="dot" />
                <div>
                  <div>{{ log.actorName }} · {{ log.summary }}</div>
                  <div class="bf-sub">{{ fmtDateTime(log.at) }}</div>
                </div>
              </div>
              <EmptyState v-if="history.length === 0" text="暂无操作记录" />
            </div>
          </div>
        </section>
      </aside>
    </div>
  </div>

  <div v-else class="bf-page">
    <EmptyState text="执行记录不存在" hint="请从执行列表重新进入。">
      <el-button size="small" @click="router.push('/test-executions')">返回列表</el-button>
    </EmptyState>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { EChartsOption } from 'echarts'
import { ArrowLeft, Bug, Check, Upload } from 'lucide-vue-next'
import type { Measurement, RunResult, TestStep } from '@/types'
import { db } from '@/services/db'
import { executionService } from '@/services/executionService'
import { useAppStore } from '@/stores/app'
import StatusPill from '@/components/common/StatusPill.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import BaseChart from '@/components/charts/BaseChart.vue'
import { fileKind, fmtBytes, fmtDateTime, runResult } from '@/utils/format'
import { evaluateExecution } from '@/utils/measurement'
import { parseMeasurementCsv, readFileText } from '@/utils/csv'

const route = useRoute()
const router = useRouter()
const app = useAppStore()

const run = computed(() => db.executions.find((e) => e.id === route.params.id))
const caseSteps = computed<TestStep[]>(() => {
  if (!run.value) return []
  return db.cases.find((c) => c.id === run.value!.caseId)?.steps ?? []
})
const measurements = computed<Measurement[]>(() => run.value?.measurements ?? [])

const evaluation = computed(() =>
  evaluateExecution({
    caseSteps: caseSteps.value,
    measurements: measurements.value,
    stepResults: run.value?.stepResults ?? [],
  }),
)
const passCount = computed(() => evaluation.value.passCount)
const failCount = computed(() => evaluation.value.failCount)
const pendingCount = computed(() => evaluation.value.missing.length + evaluation.value.pendingManual.length)

const memberName = (id: string) => db.members.find((m) => m.id === id)?.name ?? id
const planCode = (id: string) => db.plans.find((p) => p.id === id)?.code ?? id
const projectName = (id: string) => db.projects.find((p) => p.id === id)?.name ?? id
const productName = (id: string) => db.products.find((p) => p.id === id)?.name ?? id
const versionLabel = (id?: string) => (id ? db.versions.find((v) => v.id === id)?.version ?? id : '—')
const caseName = (id: string) => db.cases.find((c) => c.id === id)?.name ?? id
const deviceLabel = (id: string) => db.devices.find((d) => d.id === id)?.name ?? id
const defectTitle = (code: string) => db.defects.find((d) => d.code === code)?.title ?? ''

const limitText = (param: TestStep['param']) => {
  if (!param) return '—'
  if (param.min != null && param.max != null) return `${param.min} ~ ${param.max} ${param.unit}`
  if (param.min != null) return `≥ ${param.min} ${param.unit}`
  if (param.max != null) return `≤ ${param.max} ${param.unit}`
  return `仅记录 ${param.unit}`
}

const measureLimit = (measurement: Measurement) => {
  if (measurement.min != null && measurement.max != null) return `${measurement.min} ~ ${measurement.max} ${measurement.unit}`
  if (measurement.min != null) return `≥ ${measurement.min} ${measurement.unit}`
  if (measurement.max != null) return `≤ ${measurement.max} ${measurement.unit}`
  return '—'
}

const measurementOf = (step: TestStep) => measurements.value.find((m) => m.id === `MS-${step.id}`)
const stepResultOf = (stepId: string) => run.value?.stepResults.find((s) => s.stepId === stepId)?.result ?? 'PENDING'
const verdictOf = (step: TestStep): RunResult | null => {
  const measurement = measurementOf(step)
  if (measurement) return measurement.result ?? 'PENDING'
  const result = stepResultOf(step.id)
  return result === 'PENDING' ? null : result
}

const setValue = (step: TestStep, value: number | undefined) => {
  if (!run.value) return
  const measurement = measurementOf(step)
  if (!measurement) return
  executionService.setMeasurement(run.value.id, measurement.id, value ?? null)
}

const env = reactive({
  temperature: 25 as number | null,
  humidity: 48 as number | null,
  inputVoltage: 48 as number | null,
  load: 50 as number | null,
  conditions: '',
})

const syncEnv = () => {
  if (!run.value) return
  env.temperature = run.value.environment.temperature
  env.humidity = run.value.environment.humidity
  env.inputVoltage = run.value.environment.inputVoltage
  env.load = run.value.environment.load
  env.conditions = run.value.conditions
}

syncEnv()
watch(() => route.params.id, syncEnv)

const saveEnv = () => {
  if (!run.value) return
  executionService.updateEnv(run.value.id, {
    temperature: env.temperature,
    humidity: env.humidity,
    inputVoltage: env.inputVoltage,
    load: env.load,
  }, env.conditions)
  ElMessage.success('环境与工况参数已保存')
}

const submitRun = () => {
  if (!run.value) return
  try {
    const result = executionService.finish(run.value.id)
    ElMessage.success(`执行结果已提交：${result}`)
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message)
  }
}

const forceResult = (result: RunResult) => {
  if (!run.value) return
  executionService.finish(run.value.id, result)
  ElMessage.success(`已标记为 ${result}`)
}

const createDefect = () => {
  if (!run.value) return
  router.push(`/defects?create=1&execution=${run.value.id}`)
}

const csvInput = ref<HTMLInputElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

const importCsv = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file || !run.value) return
  const text = await readFileText(file)
  const rows = parseMeasurementCsv(text)
  if (rows.length === 0) {
    ElMessage.warning('未解析到测量数据，请使用 param,unit,value 表头')
    return
  }
  const matched = executionService.importMeasurements(run.value.id, rows)
  ElMessage.success(matched > 0 ? `已导入 ${matched} 项测量值` : '没有匹配到当前用例的测量参数名')
  if (csvInput.value) csvInput.value.value = ''
}

const uploadAttachment = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file || !run.value) return
  if (file.size > 2 * 1024 * 1024) {
    ElMessage.error('演示模式单个附件需 ≤ 2MB')
    return
  }
  const ext = (file.name.split('.').pop() ?? '').toLowerCase()
  const kind = ext === 'csv' ? 'csv' : ext === 'png' ? 'png' : ext === 'jpg' || ext === 'jpeg' ? 'jpg' : ext === 'pdf' ? 'pdf' : ext === 'zip' ? 'zip' : ext === 'json' ? 'json' : ext === 'xlsx' || ext === 'xls' ? 'xlsx' : 'log'
  executionService.addAttachment(run.value.id, {
    id: `ATT-${Date.now().toString(36)}`,
    name: file.name,
    kind,
    size: file.size,
    addedAt: new Date().toISOString(),
  })
  ElMessage.success('附件已添加')
  if (fileInput.value) fileInput.value.value = ''
}

const chartDataset = computed(() => {
  if (!run.value) return undefined
  return db.datasets.find((d) => d.executionId === run.value!.id && (d.previewRows?.length ?? 0) > 2)
})

const chartOption = computed<EChartsOption | null>(() => {
  const dataset = chartDataset.value
  if (!dataset?.previewHeaders || !dataset.previewRows) return null
  const xValues = dataset.previewRows.map((row) => row[0])
  const series = dataset.previewHeaders.slice(1).map((header, index) => ({
    name: header,
    type: 'line' as const,
    smooth: true,
    showSymbol: false,
    lineStyle: { width: 1.4 },
    data: dataset.previewRows!.map((row) => Number(row[index + 1])),
  }))
  return {
    grid: { left: 44, right: 16, top: 26, bottom: 24 },
    tooltip: { trigger: 'axis' },
    legend: { top: 0, right: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 10 } },
    xAxis: {
      type: 'category',
      data: xValues,
      axisLabel: { color: '#8494a8', fontSize: 9 },
      axisLine: { lineStyle: { color: '#e1e7ef' } },
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLabel: { color: '#8494a8', fontSize: 9 },
      splitLine: { lineStyle: { color: '#eef2f7' } },
    },
    series,
  }
})

const history = computed(() => {
  if (!run.value) return []
  return db.audits
    .filter((a) => a.entityId === run.value!.id || a.summary.includes(run.value!.code))
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 10)
})
</script>

<style scoped>
.execution-page {
  padding-bottom: 40px;
}

.exec-head {
  background: var(--bf-surface);
  border: 1px solid var(--bf-border);
  border-radius: var(--bf-radius-lg);
  padding: 14px 18px;
  margin-bottom: 14px;
}

.back {
  border: none;
  background: none;
  color: var(--bf-ink-3);
  font-size: 11.5px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 0;
  margin-bottom: 7px;
  font-family: inherit;
}

.back:hover {
  color: var(--bf-accent);
}

.title-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  flex-wrap: wrap;
}

.code-line {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.title-row h1 {
  font-size: 20px;
  font-weight: 650;
  margin-top: 6px;
  letter-spacing: -0.01em;
}

.sub {
  color: var(--bf-ink-3);
  font-size: 12px;
  margin-top: 4px;
}

.exec-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(310px, 0.85fr);
  gap: 14px;
  align-items: start;
}

.exec-main,
.exec-side {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.steps {
  padding: 0 16px 14px;
}

.exec-step {
  padding: 12px 0;
  border-bottom: 1px dashed var(--bf-border);
}

.exec-step:last-child {
  border-bottom: none;
}

.step-head {
  display: flex;
  align-items: flex-start;
  gap: 9px;
}

.step-index {
  width: 21px;
  height: 21px;
  border-radius: 50%;
  background: var(--bf-surface-3);
  color: var(--bf-ink-2);
  font-size: 11px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  margin-top: 1px;
}

.step-title {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.step-title strong {
  font-size: 12.8px;
}

.step-expect {
  margin-left: 30px;
  font-size: 11.8px;
  color: var(--bf-ink-2);
  margin-top: 4px;
}

.measure-row,
.manual-row {
  margin-left: 30px;
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  background: var(--bf-surface-2);
  border: 1px solid var(--bf-border);
  border-radius: 5px;
  padding: 8px 10px;
}

.m-name {
  font-size: 12.2px;
  font-weight: 600;
  min-width: 150px;
}

.m-name .unit {
  color: var(--bf-ink-3);
  font-weight: 400;
  font-size: 11px;
}

.required {
  font-size: 10px;
  color: var(--bf-danger);
  border: 1px solid #f2d5d1;
  border-radius: 3px;
  padding: 0 3px;
  margin-left: 4px;
}

.m-limit {
  font-size: 11.5px;
  color: var(--bf-ink-3);
  font-family: var(--bf-mono);
  min-width: 110px;
}

.m-unit {
  font-size: 11.5px;
  color: var(--bf-ink-3);
}

.env-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  align-items: end;
}

.env-grid label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11.5px;
  color: var(--bf-ink-3);
}

.env-grid label.wide {
  grid-column: span 3;
}

.big-result {
  font-size: 30px;
  font-weight: 700;
  letter-spacing: 0.01em;
  text-align: center;
  padding: 8px 0 4px;
  color: var(--bf-ink-3);
}

.big-result.pass {
  color: #157a5b;
}

.big-result.fail {
  color: #b02a1f;
}

.big-result.blocked,
.big-result.skipped {
  color: #a35a06;
}

.result-counts {
  display: flex;
  justify-content: space-around;
  font-size: 11.5px;
  color: var(--bf-ink-3);
  border-top: 1px dashed var(--bf-border);
  border-bottom: 1px dashed var(--bf-border);
  padding: 8px 0;
  margin-bottom: 10px;
}

.result-counts b {
  display: block;
  font-size: 16px;
  color: var(--bf-ink);
  text-align: center;
}

.danger {
  color: var(--bf-danger) !important;
}

.force-row {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.meta-list {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.meta-list div {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 11.8px;
}

.meta-list span {
  color: var(--bf-ink-3);
}

.att-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin-bottom: 9px;
}

.att {
  display: flex;
  gap: 8px;
  align-items: center;
}

.att-name {
  display: flex;
  flex-direction: column;
  min-width: 0;
  font-size: 12px;
}

.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hidden-input {
  display: none;
}

.defect-link {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.2px;
  color: var(--bf-danger);
  padding: 3px 0;
}

.history {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.history-row {
  display: flex;
  gap: 8px;
  font-size: 11.8px;
}

.history-row .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--bf-border-strong);
  margin-top: 5px;
  flex: none;
}

@media (max-width: 1180px) {
  .exec-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .env-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .env-grid label.wide {
    grid-column: span 1;
  }
}
</style>
