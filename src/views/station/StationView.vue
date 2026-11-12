<template>
  <div class="station">
    <div class="station-grid">
      <section class="panel main-panel">
        <header class="panel-head">
          <div>
            <h1>工位执行</h1>
            <p>A-01 电气测试台 · 大尺寸触控录入 · 设备与工况自动绑定</p>
          </div>
          <div class="head-actions">
            <el-button v-if="currentRun" size="large" @click="resetRun">新建一次执行</el-button>
            <el-button size="large" type="primary" :disabled="!currentRun" @click="submit">提交结果</el-button>
          </div>
        </header>

        <div v-if="!currentRun" class="setup">
          <div class="setup-row">
            <label>测试计划</label>
            <el-select v-model="planId" size="large" style="flex: 1" @update:model-value="onPlanChange">
              <el-option v-for="plan in plans" :key="plan.id" :label="`${plan.code} · ${plan.name}`" :value="plan.id" />
            </el-select>
          </div>
          <div class="setup-row">
            <label>测试用例</label>
            <el-select v-model="caseId" size="large" style="flex: 1">
              <el-option v-for="testCase in planCases" :key="testCase.id" :label="`${testCase.code} · ${testCase.name}`" :value="testCase.id" />
            </el-select>
          </div>
          <div class="setup-row">
            <label>工况描述</label>
            <el-input v-model="conditions" size="large" style="flex: 1" />
          </div>
          <button type="button" class="start-btn" @click="startRun">开始执行</button>
          <div class="hint">
            开始后将生成新的 RUN 编号，并绑定当前计划的产品版本、测试设备与工况参数。
          </div>
        </div>

        <template v-else>
          <div class="run-bar">
            <span class="run-code">{{ currentRun.code }}</span>
            <span class="bf-sub">{{ caseName(currentRun.caseId) }} · {{ versionLabel(currentRun.hardwareVersionId) }} · {{ planCode(currentRun.planId) }}</span>
            <span class="live" :class="overall.toLowerCase()">{{ overall }}</span>
          </div>

          <div class="steps">
            <div v-for="(step, index) in caseSteps" :key="step.id" class="step">
              <span class="index">{{ index + 1 }}</span>
              <div class="step-body">
                <div class="step-title">
                  <strong>{{ step.name }}</strong>
                  <span>{{ step.action }}</span>
                  <span class="expect">预期：{{ step.expected }}</span>
                </div>
                <div v-if="step.param" class="input-row">
                  <el-input-number
                    :model-value="values[step.id] ?? undefined"
                    :controls="false"
                    size="large"
                    placeholder="实测值"
                    style="width: 220px"
                    @change="(value: number | undefined) => (values[step.id] = value ?? null)"
                  />
                  <span class="unit">{{ step.param.unit }}</span>
                  <span class="limit">{{ limitText(step.param) }}</span>
                  <span v-if="values[step.id] !== null && values[step.id] !== undefined" class="verdict" :class="judge(step)">
                    {{ judge(step) }}
                  </span>
                </div>
                <div v-else class="input-row">
                  <el-radio-group
                    :model-value="stepResults[step.id] ?? 'PENDING'"
                    size="large"
                    @update:model-value="(value: RunResult) => (stepResults[step.id] = value)"
                  >
                    <el-radio-button value="PASS">PASS</el-radio-button>
                    <el-radio-button value="FAIL">FAIL</el-radio-button>
                    <el-radio-button value="BLOCKED">BLOCKED</el-radio-button>
                    <el-radio-button value="SKIPPED">SKIPPED</el-radio-button>
                  </el-radio-group>
                </div>
              </div>
            </div>
          </div>

          <div v-if="lastResult" class="result-banner" :class="lastResult.toLowerCase()">
            <strong>{{ currentRun.code }} 已提交：{{ lastResult }}</strong>
            <span>{{ lastResult === 'FAIL' ? '请创建缺陷并跟踪整改。' : '数据已写入执行记录，可在 PC 端查看曲线与附件。' }}</span>
            <router-link v-if="lastResult === 'FAIL'" :to="`/defects?create=1&execution=${currentRun.id}`" class="defect-link">创建缺陷</router-link>
          </div>
        </template>
      </section>

      <aside class="side">
        <section class="panel">
          <header class="panel-head small"><h2>测试设备</h2><span class="bf-sub">{{ devices.length }} 台</span></header>
          <div class="device-list">
            <div v-for="device in devices" :key="device.id" class="device">
              <div>
                <strong>{{ device.code }} {{ device.name }}</strong>
                <span>{{ device.model }} · {{ device.station }}</span>
              </div>
              <span class="cal" :class="calibration(device).state">{{ calibration(device).label }}</span>
            </div>
            <div v-if="devices.length === 0" class="empty">当前计划未指定设备</div>
          </div>
        </section>

        <section class="panel">
          <header class="panel-head small"><h2>环境与工况</h2></header>
          <div class="env">
            <label>温度 ℃<el-input-number v-model="env.temperature" :controls="false" size="large" /></label>
            <label>湿度 %RH<el-input-number v-model="env.humidity" :controls="false" size="large" /></label>
            <label>输入电压 V<el-input-number v-model="env.inputVoltage" :controls="false" size="large" /></label>
            <label>负载电流 A<el-input-number v-model="env.load" :controls="false" size="large" /></label>
          </div>
          <div class="hint">参数会随执行记录保存，可在 PC 执行详情中继续修改。</div>
        </section>

        <section class="panel">
          <header class="panel-head small"><h2>本计划执行记录</h2></header>
          <div class="run-list">
            <router-link v-for="run in planRuns.slice(0, 6)" :key="run.id" :to="`/test-executions/${run.id}`" class="run-row">
              <span class="mono">{{ run.code }}</span>
              <span class="bf-sub">{{ caseName(run.caseId) }}</span>
              <span class="result" :class="run.result.toLowerCase()">{{ run.result }}</span>
            </router-link>
            <div v-if="planRuns.length === 0" class="empty">暂无执行记录</div>
          </div>
        </section>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { Device, Execution, RunResult, TestCase, TestStep } from '@/types'
import { db } from '@/services/db'
import { executionService, judgeValue } from '@/services/executionService'
import { deviceService } from '@/services/assetService'
import { useAppStore } from '@/stores/app'

const app = useAppStore()

const plans = computed(() =>
  db.plans
    .filter((p) => ['running', 'pending', 'review', 'completed'].includes(p.status))
    .slice()
    .sort((a, b) => Number(b.status === 'running') - Number(a.status === 'running')),
)
const planId = ref(plans.value[0]?.id ?? '')
const caseId = ref('')
const conditions = ref('48V 输入 / 12V 输出 / 50A 满载 / 风冷')
const currentRun = ref<Execution | null>(null)
const lastResult = ref<RunResult | null>(null)
const values = reactive<Record<string, number | null>>({})
const stepResults = reactive<Record<string, RunResult>>({})

const env = reactive({
  temperature: 25 as number | null,
  humidity: 48 as number | null,
  inputVoltage: 48 as number | null,
  load: 50 as number | null,
})

const planCases = computed(() => {
  const plan = db.plans.find((p) => p.id === planId.value)
  if (!plan) return []
  return plan.caseIds
    .map((id) => db.cases.find((c) => c.id === id))
    .filter((c): c is TestCase => Boolean(c))
})

const onPlanChange = () => {
  caseId.value = planCases.value[0]?.id ?? ''
}

onPlanChange()

const caseSteps = computed<TestStep[]>(() => {
  if (!currentRun.value) return []
  return db.cases.find((c) => c.id === currentRun.value!.caseId)?.steps ?? []
})

const devices = computed<Device[]>(() => {
  const plan = db.plans.find((p) => p.id === planId.value)
  if (!plan) return []
  return plan.deviceIds.map((id) => db.devices.find((d) => d.id === id)).filter(Boolean) as Device[]
})

const planRuns = computed(() => db.executions.filter((e) => e.planId === planId.value))

const caseName = (id: string) => db.cases.find((c) => c.id === id)?.name ?? id
const planCode = (id: string) => db.plans.find((p) => p.id === id)?.code ?? id
const versionLabel = (id?: string) => (id ? db.versions.find((v) => v.id === id)?.version ?? id : '—')

const judge = (step: TestStep): RunResult =>
  judgeValue(values[step.id] ?? null, step.param?.min ?? null, step.param?.max ?? null)

const overall = computed<RunResult>(() => {
  const verdicts = caseSteps.value.map((step) => (step.param ? judge(step) : stepResults[step.id] ?? 'PENDING'))
  if (verdicts.some((v) => v === 'FAIL')) return 'FAIL'
  if (verdicts.length > 0 && verdicts.every((v) => v === 'PENDING')) return 'PENDING'
  return 'PASS'
})

const limitText = (param?: TestStep['param']) => {
  if (!param) return ''
  if (param.min != null && param.max != null) return `${param.min}~${param.max} ${param.unit}`
  if (param.max != null) return `≤${param.max} ${param.unit}`
  if (param.min != null) return `≥${param.min} ${param.unit}`
  return param.unit
}

const calibration = (device: Device) => {
  const state = deviceService.calibrationState(device)
  return { state, label: state === 'expired' ? '校准过期' : state === 'due_soon' ? '即将到期' : '校准有效' }
}

const startRun = () => {
  if (!caseId.value) {
    ElMessage.warning('请选择测试用例')
    return
  }
  try {
    const run = executionService.create({
      planId: planId.value,
      caseId: caseId.value,
      testerId: app.currentUser.id,
      deviceIds: devices.value.map((d) => d.id),
      environment: { ...env, note: '平板工位录入' },
      conditions: conditions.value,
      note: '工位模式执行',
    })
    currentRun.value = db.executions.find((e) => e.id === run.id) ?? run
    lastResult.value = null
    caseSteps.value.forEach((step) => {
      values[step.id] = null
      stepResults[step.id] = 'PENDING'
    })
    ElMessage.success(`已创建执行 ${run.code}`)
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message)
  }
}

const submit = () => {
  if (!currentRun.value) return
  try {
    caseSteps.value.forEach((step) => {
      if (step.param) {
        const measurement = currentRun.value!.measurements.find((m) => m.id === `MS-${step.id}`)
        if (measurement) executionService.setMeasurement(currentRun.value!.id, measurement.id, values[step.id] ?? null)
      } else if (stepResults[step.id] && stepResults[step.id] !== 'PENDING') {
        executionService.setStepResult(currentRun.value!.id, step.id, stepResults[step.id])
      }
    })
    const result = executionService.finish(currentRun.value.id)
    lastResult.value = result
    currentRun.value = db.executions.find((e) => e.id === currentRun.value!.id) ?? currentRun.value
    ElMessage.success(`执行结果已提交：${result}`)
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message)
  }
}

const resetRun = () => {
  currentRun.value = null
  lastResult.value = null
}
</script>

<style scoped>
.station {
  max-width: 1400px;
  margin: 0 auto;
}

.station-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(320px, 0.8fr);
  gap: 16px;
  align-items: start;
}

.panel {
  background: #fff;
  border: 1px solid var(--bf-border);
  border-radius: 8px;
  overflow: hidden;
}

.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--bf-border);
}

.panel-head h1 {
  font-size: 18px;
  font-weight: 650;
}

.panel-head p {
  font-size: 11.5px;
  color: var(--bf-ink-3);
  margin-top: 3px;
}

.panel-head.small {
  align-items: center;
  padding: 12px 14px;
}

.panel-head h2 {
  font-size: 13px;
  font-weight: 620;
}

.head-actions {
  display: flex;
  gap: 8px;
}

.setup {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 620px;
}

.setup-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.setup-row label {
  width: 84px;
  font-size: 12.5px;
  color: var(--bf-ink-2);
}

.start-btn {
  border: none;
  background: var(--bf-primary);
  color: #fff;
  border-radius: 8px;
  padding: 14px;
  font-size: 15px;
  font-weight: 600;
  font-family: inherit;
  margin-top: 6px;
}

.hint {
  font-size: 11.5px;
  color: var(--bf-ink-3);
  line-height: 1.55;
}

.run-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 18px;
  background: var(--bf-surface-2);
  border-bottom: 1px solid var(--bf-border);
  flex-wrap: wrap;
}

.run-code {
  font-family: var(--bf-mono);
  font-size: 13px;
  color: var(--bf-primary);
  font-weight: 600;
}

.live {
  margin-left: auto;
  font-size: 13px;
  font-weight: 700;
  padding: 2px 10px;
  border-radius: 12px;
  background: #eef2f7;
  color: #5a6a7e;
}

.live.pass {
  background: #e7f5ef;
  color: #12664c;
}

.live.fail {
  background: #fdecea;
  color: #a12319;
}

.steps {
  padding: 6px 18px 18px;
}

.step {
  display: flex;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px dashed var(--bf-border);
}

.step:last-child {
  border-bottom: none;
}

.index {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--bf-primary);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
}

.step-body {
  flex: 1;
  min-width: 0;
}

.step-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.step-title strong {
  font-size: 14px;
}

.step-title span {
  font-size: 11.5px;
  color: var(--bf-ink-2);
}

.step-title .expect {
  color: var(--bf-ink-3);
}

.input-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.unit {
  font-size: 12px;
  color: var(--bf-ink-3);
}

.limit {
  font-size: 11.5px;
  font-family: var(--bf-mono);
  color: var(--bf-ink-3);
}

.verdict {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 3px;
  background: #f1f4f8;
  color: #5a6a7e;
}

.verdict.PASS {
  background: #e7f5ef;
  color: #12664c;
}

.verdict.FAIL {
  background: #fdecea;
  color: #a12319;
}

.result-banner {
  margin: 0 18px 18px;
  border: 1px solid var(--bf-border);
  border-left: 4px solid var(--bf-success);
  border-radius: 6px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.result-banner.fail {
  border-left-color: var(--bf-danger);
}

.result-banner strong {
  font-size: 14px;
}

.result-banner span {
  font-size: 11.5px;
  color: var(--bf-ink-3);
}

.defect-link {
  font-size: 12px;
  color: var(--bf-danger);
  margin-top: 4px;
}

.side {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.device-list,
.run-list {
  display: flex;
  flex-direction: column;
}

.device {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-start;
  padding: 10px 14px;
  border-bottom: 1px solid var(--bf-border);
}

.device:last-child {
  border-bottom: none;
}

.device div {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.device strong {
  font-size: 12.2px;
  font-weight: 550;
}

.device span {
  font-size: 10.5px;
  color: var(--bf-ink-3);
}

.cal {
  font-size: 10.5px;
  padding: 1px 6px;
  border-radius: 3px;
  background: #e7f5ef;
  color: #12664c;
  flex: none;
}

.cal.expired {
  background: #fdecea;
  color: #a12319;
}

.cal.due_soon {
  background: #fdf6ea;
  color: #80510a;
}

.env {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 12px 14px;
}

.env label {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 11px;
  color: var(--bf-ink-3);
}

.env + .hint {
  padding: 0 14px 12px;
}

.run-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--bf-border);
  font-size: 11.5px;
  color: var(--bf-ink);
}

.run-row:last-child {
  border-bottom: none;
}

.run-row .bf-sub {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result {
  font-size: 10.5px;
  font-weight: 600;
}

.result.pass {
  color: #157a5b;
}

.result.fail {
  color: #b02a1f;
}

.empty {
  padding: 16px 14px;
  font-size: 11.5px;
  color: var(--bf-ink-3);
  text-align: center;
}

@media (max-width: 1100px) {
  .station-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
