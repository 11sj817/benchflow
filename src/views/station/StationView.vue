<template>
  <div class="station">
    <header class="station-head">
      <div class="head-left">
        <div class="brand-line">
          <span class="logo">BF</span>
          <div>
            <strong>BenchFlow 工位模式</strong>
            <span>A-01 电气测试台 · 键盘 / 触屏录入</span>
          </div>
        </div>
        <div class="conn" :class="connection.tone">
          <span class="dot" />
          {{ connection.label }}
        </div>
      </div>
      <div class="head-right">
        <span v-if="currentRun" class="run-chip mono">{{ currentRun.code }}</span>
        <button type="button" class="ghost" :disabled="!currentRun" @click="manualSaveDraft">中断并保存</button>
        <router-link to="/dashboard" class="ghost">退出工位</router-link>
      </div>
    </header>

    <div v-if="draftAvailable && !currentRun" class="draft-banner">
      <div>
        <strong>发现中断的工位草稿</strong>
        <span>{{ draftAgeLabel(draftSavedAt) }} · RUN {{ draftPayload?.runId ?? '未创建' }}</span>
      </div>
      <div class="draft-actions">
        <button type="button" @click="discardDraft">放弃</button>
        <button type="button" class="primary" @click="restoreDraft">恢复</button>
      </div>
    </div>

    <div v-if="!currentRun" class="setup">
      <section class="panel setup-main">
        <h1>开始一次工位执行</h1>
        <p class="sub">选择计划与用例后，系统会生成 RUN 编号并绑定产品版本、设备与工况。设备连接状态为本地演示，不代表真实仪器已接入。</p>
        <div class="setup-field">
          <label>测试计划</label>
          <el-select v-model="setupPlanId" size="large" style="width: 100%" @update:model-value="onSetupPlanChange">
            <el-option v-for="plan in plans" :key="plan.id" :label="`${plan.code} · ${plan.name}`" :value="plan.id" />
          </el-select>
        </div>
        <div class="setup-field">
          <label>测试用例</label>
          <el-select v-model="setupCaseId" size="large" style="width: 100%">
            <el-option v-for="item in setupCases" :key="item.id" :label="`${item.code} · ${item.name}`" :value="item.id" />
          </el-select>
        </div>
        <div class="setup-field">
          <label>工况描述</label>
          <el-input v-model="setupConditions" size="large" />
        </div>
        <button type="button" class="start-btn" :disabled="!setupCaseId" @click="startRun">开始执行</button>
      </section>

      <aside class="panel setup-side">
        <h2>工位设备</h2>
        <div class="device-list">
          <div v-for="device in setupDevices" :key="device.id" class="device">
            <div>
              <strong>{{ device.code }} {{ device.name }}</strong>
              <span>{{ device.model }} · {{ device.station }}</span>
            </div>
            <span class="cal" :class="calibration(device).state">{{ calibration(device).label }}</span>
          </div>
          <EmptyState v-if="setupDevices.length === 0" text="计划未指定设备" />
        </div>
        <div class="sim-note">
          <Info :size="14" />
          仪器连接：未接入。当前为人工录入 / CSV 导入演示，不会向真实仪器发送 SCPI 命令。
        </div>
      </aside>
    </div>

    <template v-else>
      <div class="run-head">
        <div class="run-title">
          <span class="mono">{{ currentRun.code }}</span>
          <h1>{{ caseName(currentRun.caseId) }}</h1>
          <p>{{ planCode(currentRun.planId) }} · {{ productName(currentRun.productId) }} · {{ versionLabel(currentRun.hardwareVersionId) }}</p>
        </div>
        <div class="run-state">
          <span class="result" :class="evaluation.result.toLowerCase()">{{ evaluation.result }}</span>
          <span class="sub">{{ evaluation.completedRequired }} / {{ evaluation.requiredCount }} 必填项</span>
        </div>
      </div>

      <div class="station-grid">
        <section class="panel steps-panel">
          <header class="panel-head">
            <h2>测试步骤与实测值</h2>
            <div class="step-tools">
              <input ref="csvInput" type="file" accept=".csv,text/csv" class="hidden" @change="importCsv" />
              <button type="button" class="tool-btn" @click="csvInput?.click()"><Upload :size="14" /> 导入测量 CSV</button>
              <span class="sub">{{ caseSteps.length }} 步</span>
            </div>
          </header>
          <div class="steps">
            <div v-for="(stepItem, index) in caseSteps" :key="stepItem.id" class="step">
              <div class="step-index">{{ index + 1 }}</div>
              <div class="step-body">
                <div class="step-title">
                  <strong>{{ stepItem.name }}</strong>
                  <span class="verdict" :class="judgeStep(stepItem)">{{ judgeStep(stepItem) }}</span>
                </div>
                <p class="step-action">{{ stepItem.action }}</p>
                <p class="step-expect">预期：{{ stepItem.expected }}</p>
                <div v-if="stepItem.param" class="big-input">
                  <el-input-number
                    :model-value="values[stepItem.id] ?? undefined"
                    :controls="false"
                    size="large"
                    placeholder="输入实测值"
                    class="value-input"
                    @change="(value: number | undefined) => setValue(stepItem, value)"
                  />
                  <span class="unit">{{ stepItem.param.unit }}</span>
                  <span class="limit">{{ limitText(stepItem.param) }}</span>
                </div>
                <div v-else class="manual-row">
                  <button
                    v-for="option in manualOptions"
                    :key="option"
                    type="button"
                    class="manual-btn"
                    :class="{ active: stepResults[stepItem.id] === option }"
                    @click="stepResults[stepItem.id] = option"
                  >{{ option }}</button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside class="side">
          <section class="panel">
            <header class="panel-head small"><h2>设备与校准</h2></header>
            <div class="device-list">
              <div v-for="device in devices" :key="device.id" class="device">
                <div>
                  <strong>{{ device.code }} {{ device.name }}</strong>
                  <span>{{ device.model }}</span>
                </div>
                <span class="cal" :class="calibration(device).state">{{ calibration(device).label }}</span>
              </div>
              <EmptyState v-if="devices.length === 0" text="未指定设备" />
            </div>
            <div class="sim-note compact">
              <Info :size="13" /> 模拟连接，无真实仪器通信
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
            <input ref="fileInput" type="file" class="hidden" accept=".csv,.png,.jpg,.jpeg,.pdf,.zip,.log" @change="addAttachment" />
            <button type="button" class="tool-btn full" @click="fileInput?.click()"><Paperclip :size="14" /> 添加测试附件</button>
            <div class="att-list">
              <div v-for="att in stageAttachments" :key="att.id" class="att">
                <span>{{ att.name }}</span>
                <span class="sub">{{ fmtBytes(att.size) }}</span>
                <button type="button" class="remove" @click="stageAttachments = stageAttachments.filter((row) => row.id !== att.id)">×</button>
              </div>
            </div>
          </section>

          <section class="panel">
            <header class="panel-head small"><h2>实时判定</h2></header>
            <div class="judge-box" :class="evaluation.result.toLowerCase()">
              <b>{{ evaluation.result }}</b>
              <span>{{ describeEvaluation(evaluation) }}</span>
            </div>
            <div class="judge-stats">
              <span>PASS {{ evaluation.passCount }}</span>
              <span>FAIL {{ evaluation.failCount }}</span>
              <span>待完成 {{ evaluation.pendingCount }}</span>
            </div>
          </section>
        </aside>
      </div>

      <footer class="action-bar">
        <div class="action-left">
          <span class="mono">{{ currentRun.code }}</span>
          <span class="sub">Ctrl + Enter 提交 · 数据自动保存草稿</span>
        </div>
        <div class="action-right">
          <button type="button" class="ghost" @click="submit('BLOCKED')">BLOCKED</button>
          <button type="button" class="ghost" @click="submit('SKIPPED')">SKIPPED</button>
          <button type="button" class="primary" :disabled="submitting || !evaluation.isComplete" @click="submit()">
            {{ submitting ? '提交中…' : '提交执行结果' }}
          </button>
        </div>
      </footer>

      <div v-if="lastResult" class="result-banner" :class="lastResult.toLowerCase()">
        <strong>{{ currentRun.code }} 已提交：{{ lastResult }}</strong>
        <span>{{ lastResult === 'FAIL' ? '请创建缺陷并跟踪整改。' : '数据已写入执行记录。' }}</span>
        <router-link :to="`/test-executions/${currentRun.id}`" class="link">在 PC 端查看完整执行详情</router-link>
        <button type="button" class="link" @click="resetRun">新建一次执行</button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Info, Paperclip, Upload } from 'lucide-vue-next'
import type { Attachment, Device, Execution, RunResult, TestCase, TestPlan, TestStep } from '@/types'
import { db } from '@/services/db'
import { executionService } from '@/services/executionService'
import { deviceService } from '@/services/assetService'
import { useAppStore } from '@/stores/app'
import EmptyState from '@/components/common/EmptyState.vue'
import { describeEvaluation, evaluateExecution, judgeValue } from '@/utils/measurement'
import { parseMeasurementCsv, readFileText } from '@/utils/csv'
import { clearDraft, draftAgeLabel, readDraft, saveDraft } from '@/utils/draftStore'
import { fmtBytes } from '@/utils/format'

const app = useAppStore()

interface StationDraft {
  runId: string
  values: Record<string, number | null>
  stepResults: Record<string, RunResult>
  env: { temperature: number | null; humidity: number | null; inputVoltage: number | null; load: number | null }
  attachments: { id: string; name: string; size: number; kind: Attachment['kind'] }[]
}

const plans = computed<TestPlan[]>(() =>
  db.plans
    .filter((plan) => ['running', 'pending', 'review', 'completed'].includes(plan.status))
    .slice()
    .sort((a, b) => Number(b.status === 'running') - Number(a.status === 'running')),
)
const setupPlanId = ref(plans.value[0]?.id ?? '')
const setupCaseId = ref('')
const setupConditions = ref('48V 输入 / 12V 输出 / 50A 满载 / 风冷')
const setupCases = computed<TestCase[]>(() => {
  const plan = db.plans.find((row) => row.id === setupPlanId.value)
  if (!plan) return []
  return plan.caseIds.map((id) => db.cases.find((item) => item.id === id)).filter((item): item is TestCase => Boolean(item))
})
const setupDevices = computed<Device[]>(() => {
  const plan = db.plans.find((row) => row.id === setupPlanId.value)
  if (!plan) return []
  return plan.deviceIds.map((id) => db.devices.find((device) => device.id === id)).filter((item): item is Device => Boolean(item))
})

const currentRun = ref<Execution | null>(null)
const values = reactive<Record<string, number | null>>({})
const stepResults = reactive<Record<string, RunResult>>({})
const env = reactive({
  temperature: 25 as number | null,
  humidity: 48 as number | null,
  inputVoltage: 48 as number | null,
  load: 50 as number | null,
})
const stageAttachments = ref<{ id: string; name: string; size: number; kind: Attachment['kind'] }[]>([])
const submitting = ref(false)
const lastResult = ref<RunResult | null>(null)
const csvInput = ref<HTMLInputElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

const draftKey = `station:${app.currentUser.id}`
const draftAvailable = ref(false)
const draftSavedAt = ref('')
const draftPayload = ref<StationDraft | null>(null)
let saveTimer: number | null = null

const caseSteps = computed<TestStep[]>(() => (currentRun.value ? db.cases.find((item) => item.id === currentRun.value!.caseId)?.steps ?? [] : []))
const plan = computed(() => db.plans.find((row) => row.id === currentRun.value?.planId))
const devices = computed<Device[]>(() => {
  const row = plan.value
  if (!row) return []
  return row.deviceIds.map((id) => db.devices.find((device) => device.id === id)).filter((item): item is Device => Boolean(item))
})
const manualOptions: RunResult[] = ['PASS', 'FAIL', 'BLOCKED', 'SKIPPED']
const measurements = computed(() =>
  caseSteps.value
    .filter((stepItem) => stepItem.param)
    .map((stepItem) => ({
      id: `MS-${stepItem.id}`,
      param: stepItem.param!.name,
      unit: stepItem.param!.unit,
      value: values[stepItem.id] ?? null,
      min: stepItem.param!.min,
      max: stepItem.param!.max,
      result: judgeValue(values[stepItem.id] ?? null, stepItem.param!.min, stepItem.param!.max),
    })),
)
const evaluation = computed(() =>
  evaluateExecution({
    caseSteps: caseSteps.value,
    measurements: measurements.value,
    stepResults: caseSteps.value.map((stepItem) => ({ stepId: stepItem.id, result: stepResults[stepItem.id] ?? 'PENDING' })),
  }),
)

const connection = computed(() => {
  if (stageAttachments.value.some((att) => att.kind === 'csv')) {
    return { label: '仪器连接：未接入 · CSV 数据已导入', tone: 'csv' }
  }
  return { label: '仪器连接：未接入（人工录入演示）', tone: 'offline' }
})

const caseName = (id: string) => db.cases.find((item) => item.id === id)?.name ?? id
const planCode = (id: string) => db.plans.find((row) => row.id === id)?.code ?? id
const productName = (id: string) => db.products.find((row) => row.id === id)?.name ?? id
const versionLabel = (id?: string) => (id ? db.versions.find((version) => version.id === id)?.version ?? id : '—')
const limitText = (param?: TestStep['param']) => {
  if (!param) return ''
  if (param.min != null && param.max != null) return `${param.min}~${param.max} ${param.unit}`
  if (param.max != null) return `≤${param.max} ${param.unit}`
  if (param.min != null) return `≥${param.min} ${param.unit}`
  return param.unit
}
const judgeStep = (stepItem: TestStep) => {
  if (!stepItem.param) return stepResults[stepItem.id] ?? 'PENDING'
  return judgeValue(values[stepItem.id] ?? null, stepItem.param.min, stepItem.param.max)
}
const calibration = (device: Device) => {
  const state = deviceService.calibrationState(device)
  return { state, label: state === 'expired' ? '校准过期' : state === 'due_soon' ? '即将到期' : '校准有效' }
}

const setValue = (stepItem: TestStep, value: number | undefined) => {
  values[stepItem.id] = value === undefined || Number.isNaN(value) ? null : value
}

const onSetupPlanChange = () => {
  setupCaseId.value = setupCases.value[0]?.id ?? ''
}

const initializeRunValues = () => {
  caseSteps.value.forEach((stepItem) => {
    if (stepItem.param && !(stepItem.id in values)) values[stepItem.id] = null
    if (!stepItem.param && !(stepItem.id in stepResults)) stepResults[stepItem.id] = 'PENDING'
  })
}

const startRun = () => {
  if (!setupCaseId.value) return
  try {
    const run = executionService.create({
      planId: setupPlanId.value,
      caseId: setupCaseId.value,
      testerId: app.currentUser.id,
      deviceIds: setupDevices.value.map((device) => device.id),
      environment: { ...env, note: '平板工位录入' },
      conditions: setupConditions.value,
      note: '工位模式执行',
    })
    currentRun.value = db.executions.find((row) => row.id === run.id) ?? run
    Object.keys(values).forEach((key) => delete values[key])
    Object.keys(stepResults).forEach((key) => delete stepResults[key])
    initializeRunValues()
    lastResult.value = null
    stageAttachments.value = []
    ElMessage.success(`已创建 ${run.code}`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '创建执行失败')
  }
}

const saveDraftNow = () => {
  if (!currentRun.value || lastResult.value) return
  const payload: StationDraft = {
    runId: currentRun.value.id,
    values: { ...values },
    stepResults: { ...stepResults },
    env: { ...env },
    attachments: stageAttachments.value,
  }
  const envelope = saveDraft(draftKey, payload, 1)
  if (envelope) draftSavedAt.value = envelope.savedAt
}

const manualSaveDraft = () => {
  saveDraftNow()
  if (draftSavedAt.value) ElMessage.success('工位草稿已保存，可中断后恢复')
}

const scheduleDraft = () => {
  if (!currentRun.value) return
  if (saveTimer) window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(saveDraftNow, 600)
}

watch([values, stepResults, env, stageAttachments], scheduleDraft, { deep: true })

const restoreDraft = () => {
  const payload = draftPayload.value
  if (!payload) return
  const run = db.executions.find((row) => row.id === payload.runId)
  if (!run) {
    ElMessage.warning('草稿对应的执行记录不存在，已清除草稿')
    clearDraft(draftKey)
    draftAvailable.value = false
    return
  }
  currentRun.value = run
  Object.assign(values, payload.values)
  Object.assign(stepResults, payload.stepResults)
  Object.assign(env, payload.env)
  stageAttachments.value = payload.attachments
  initializeRunValues()
  draftAvailable.value = false
  ElMessage.success('已恢复工位执行')
}

const discardDraft = () => {
  clearDraft(draftKey)
  draftAvailable.value = false
  draftPayload.value = null
}

const importCsv = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const text = await readFileText(file)
  const rows = parseMeasurementCsv(text)
  if (!rows.length) {
    ElMessage.warning('未解析到测量数据，请使用 param,unit,value 表头')
    return
  }
  let matched = 0
  rows.forEach((row) => {
    const stepItem = caseSteps.value.find(
      (step) => step.param && (step.param.name === row.param || step.param.name.includes(row.param) || row.param.includes(step.param.name)),
    )
    if (!stepItem || !stepItem.param) return
    values[stepItem.id] = row.value
    matched += 1
  })
  stageAttachments.value.push({ id: `ST-${Date.now()}`, name: file.name, size: file.size, kind: 'csv' })
  ElMessage.success(matched ? `已导入 ${matched} 项测量值` : 'CSV 参数名与当前用例不匹配')
  if (csvInput.value) csvInput.value.value = ''
}

const addAttachment = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (file.size > 2 * 1024 * 1024) {
    ElMessage.error('演示环境附件需 ≤ 2MB')
    return
  }
  const ext = (file.name.split('.').pop() ?? '').toLowerCase()
  const kind: Attachment['kind'] =
    ext === 'csv' ? 'csv' : ext === 'png' ? 'png' : ext === 'jpg' || ext === 'jpeg' ? 'jpg' : ext === 'pdf' ? 'pdf' : ext === 'zip' ? 'zip' : 'log'
  stageAttachments.value.push({ id: `ST-${Date.now()}`, name: file.name, size: file.size, kind })
  ElMessage.success('附件已添加，提交时写入执行记录')
  if (fileInput.value) fileInput.value.value = ''
}

const submit = async (forced?: RunResult) => {
  if (!currentRun.value) return
  if (lastResult.value) {
    ElMessage.info('本次执行已提交，请新建一次执行')
    return
  }
  if (!forced && !evaluation.value.isComplete) {
    ElMessage.warning(describeEvaluation(evaluation.value))
    return
  }
  if (forced) {
    try {
      await ElMessageBox.confirm(`将整条执行标记为 ${forced}？该操作会写入记录与审计。`, `标记 ${forced}`, {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
      })
    } catch {
      return
    }
  }
  submitting.value = true
  try {
    measurements.value.forEach((measurement) => {
      executionService.setMeasurement(currentRun.value!.id, measurement.id, measurement.value)
    })
    caseSteps.value.forEach((stepItem) => {
      if (!stepItem.param && stepResults[stepItem.id]) {
        executionService.setStepResult(currentRun.value!.id, stepItem.id, stepResults[stepItem.id])
      }
    })
    executionService.updateEnv(currentRun.value.id, { ...env })
    const attachmentRows: Attachment[] = stageAttachments.value.map((att) => ({
      id: att.id,
      name: att.name,
      kind: att.kind,
      size: att.size,
      addedAt: new Date().toISOString(),
    }))
    if (attachmentRows.length) executionService.setAttachmentList(currentRun.value.id, attachmentRows)
    const result = executionService.finish(currentRun.value.id, forced)
    lastResult.value = result
    currentRun.value = db.executions.find((row) => row.id === currentRun.value!.id) ?? currentRun.value
    clearDraft(draftKey)
    ElMessage.success(`执行已提交：${result}`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '提交失败')
  } finally {
    submitting.value = false
  }
}

const resetRun = () => {
  currentRun.value = null
  lastResult.value = null
  stageAttachments.value = []
  Object.keys(values).forEach((key) => delete values[key])
  Object.keys(stepResults).forEach((key) => delete stepResults[key])
  setupCaseId.value = setupCases.value[0]?.id ?? ''
}

onSetupPlanChange()

const bootstrap = () => {
  const stored = readDraft<StationDraft>(draftKey, 1)
  if (stored) {
    draftPayload.value = stored.data
    draftAvailable.value = true
    draftSavedAt.value = stored.savedAt
  }
}

onMounted(() => {
  bootstrap()
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  if (saveTimer) window.clearTimeout(saveTimer)
})

const onKeydown = (event: KeyboardEvent) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault()
    if (currentRun.value) void submit()
  }
}
</script>

<style scoped>
.station {
  max-width: 1500px;
  margin: 0 auto;
  padding-bottom: 76px;
}

.station-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  background: #1a2b3d;
  color: #fff;
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.head-left,
.brand-line {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo {
  width: 30px;
  height: 30px;
  border-radius: 6px;
  background: #2f7f8f;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
}

.brand-line div {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}

.brand-line strong {
  font-size: 13px;
}

.brand-line span {
  font-size: 10px;
  color: #93a8bd;
}

.conn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid #365066;
  border-radius: 20px;
  padding: 3px 9px;
  font-size: 10px;
  color: #b9cddd;
}

.conn .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #8a9db0;
}

.conn.csv .dot {
  background: #46a58c;
}

.head-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.run-chip {
  font-size: 11px;
  color: #9fd0c5;
  border: 1px solid #2f4a5d;
  border-radius: 4px;
  padding: 2px 7px;
}

.ghost {
  border: 1px solid #365066;
  background: transparent;
  color: #d6e2ee;
  border-radius: 5px;
  min-height: 34px;
  padding: 0 10px;
  font-family: inherit;
  font-size: 11px;
  display: inline-flex;
  align-items: center;
}

.ghost:disabled {
  opacity: 0.45;
  cursor: default;
}

.draft-banner {
  background: #fdf6ea;
  border: 1px solid #f0dfc0;
  border-radius: 7px;
  padding: 10px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.draft-banner strong {
  font-size: 12px;
  color: #80510a;
  display: block;
}

.draft-banner span {
  font-size: 10.5px;
  color: #8a6a35;
}

.draft-actions {
  display: flex;
  gap: 6px;
}

.draft-actions button {
  min-height: 34px;
  border-radius: 5px;
  border: 1px solid #e8d4ae;
  background: #fff;
  color: #80510a;
  font-family: inherit;
  font-size: 11px;
  padding: 0 10px;
}

.draft-actions .primary {
  background: #80510a;
  border-color: #80510a;
  color: #fff;
}

.setup {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(300px, 0.8fr);
  gap: 14px;
}

.panel {
  background: #fff;
  border: 1px solid var(--bf-border);
  border-radius: 8px;
  overflow: hidden;
}

.setup-main {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.setup-main h1 {
  font-size: 20px;
  font-weight: 650;
}

.setup-main .sub {
  font-size: 11.5px;
  color: var(--bf-ink-3);
  line-height: 1.6;
}

.setup-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.setup-field label {
  font-size: 11px;
  color: var(--bf-ink-3);
}

.start-btn {
  min-height: 48px;
  border: none;
  border-radius: 7px;
  background: var(--bf-primary);
  color: #fff;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  margin-top: 4px;
}

.start-btn:disabled {
  opacity: 0.5;
}

.setup-side {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.setup-side h2 {
  font-size: 13px;
  font-weight: 620;
}

.device-list {
  display: flex;
  flex-direction: column;
}

.device {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--bf-border);
  align-items: flex-start;
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
  font-size: 11.5px;
  font-weight: 550;
}

.device span {
  font-size: 10px;
  color: var(--bf-ink-3);
}

.cal {
  font-size: 9.5px;
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

.sim-note {
  display: flex;
  gap: 6px;
  align-items: flex-start;
  background: var(--bf-surface-2);
  border: 1px solid var(--bf-border);
  border-radius: 5px;
  padding: 8px;
  font-size: 10.5px;
  color: var(--bf-ink-3);
  line-height: 1.5;
}

.sim-note.compact {
  margin: 8px 0 0;
}

.run-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 12px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.run-title .mono {
  font-size: 11px;
  color: var(--bf-primary);
}

.run-title h1 {
  font-size: 19px;
  font-weight: 650;
  margin-top: 2px;
}

.run-title p {
  font-size: 11px;
  color: var(--bf-ink-3);
  margin-top: 2px;
}

.run-state {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.result {
  font-size: 18px;
  font-weight: 700;
  color: var(--bf-ink-3);
}

.result.pass {
  color: #157a5b;
}

.result.fail {
  color: #b02a1f;
}

.station-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.75fr) minmax(320px, 0.8fr);
  gap: 14px;
  align-items: start;
}

.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  border-bottom: 1px solid var(--bf-border);
}

.panel-head h2 {
  font-size: 12.8px;
  font-weight: 620;
}

.panel-head.small {
  padding: 10px 12px;
}

.step-tools {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sub {
  font-size: 10.2px;
  color: var(--bf-ink-3);
}

.tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 34px;
  border: 1px solid var(--bf-border);
  background: #fff;
  border-radius: 5px;
  padding: 0 9px;
  font-family: inherit;
  font-size: 10.8px;
  color: var(--bf-ink-2);
}

.tool-btn.full {
  margin: 8px 12px 0;
  width: calc(100% - 24px);
  justify-content: center;
}

.steps {
  padding: 4px 14px 14px;
}

.step {
  display: flex;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px dashed var(--bf-border);
}

.step:last-child {
  border-bottom: none;
}

.step-index {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--bf-primary);
  color: #fff;
  font-size: 11px;
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
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.step-title strong {
  font-size: 14px;
}

.step-action {
  font-size: 11px;
  color: var(--bf-ink-2);
  margin-top: 2px;
  line-height: 1.5;
}

.step-expect {
  font-size: 10.5px;
  color: var(--bf-ink-3);
  margin-top: 1px;
}

.verdict {
  font-size: 10px;
  font-weight: 600;
  border-radius: 3px;
  padding: 1px 7px;
  background: #eef2f7;
  color: #5a6a7e;
  flex: none;
}

.verdict.PASS {
  background: #e7f5ef;
  color: #12664c;
}

.verdict.FAIL {
  background: #fdecea;
  color: #a12319;
}

.big-input {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 7px;
  flex-wrap: wrap;
}

.value-input {
  width: 220px;
}

.value-input :deep(.el-input__inner) {
  font-size: 18px;
  font-weight: 600;
  height: 46px;
}

.unit {
  font-size: 12px;
  color: var(--bf-ink-3);
}

.limit {
  font-family: var(--bf-mono);
  font-size: 10.5px;
  color: var(--bf-ink-3);
}

.manual-row {
  display: flex;
  gap: 6px;
  margin-top: 7px;
  flex-wrap: wrap;
}

.manual-btn {
  min-height: 42px;
  min-width: 88px;
  border: 1px solid var(--bf-border);
  background: #fff;
  border-radius: 5px;
  font-family: inherit;
  font-size: 11.5px;
  color: var(--bf-ink-2);
}

.manual-btn.active {
  border-color: var(--bf-primary);
  background: var(--bf-primary-soft);
  color: var(--bf-primary);
  font-weight: 600;
}

.side {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.env {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  padding: 10px 12px 0;
}

.env label {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 10px;
  color: var(--bf-ink-3);
}

.att-list {
  display: flex;
  flex-direction: column;
  padding: 6px 12px 10px;
}

.att {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10.5px;
  padding: 3px 0;
}

.att span:first-child {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.remove {
  border: none;
  background: transparent;
  color: var(--bf-danger);
  font-size: 14px;
  min-height: 26px;
  min-width: 26px;
}

.judge-box {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  border-bottom: 1px solid var(--bf-border);
}

.judge-box b {
  font-size: 24px;
  font-weight: 700;
  color: var(--bf-ink-3);
}

.judge-box.pass b {
  color: #157a5b;
}

.judge-box.fail b {
  color: #b02a1f;
}

.judge-box span {
  font-size: 10.5px;
  color: var(--bf-ink-3);
  line-height: 1.5;
}

.judge-stats {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  font-size: 10px;
  color: var(--bf-ink-3);
}

.action-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: #fff;
  border-top: 1px solid var(--bf-border);
  padding: 8px 18px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  z-index: 30;
  flex-wrap: wrap;
}

.action-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.action-left .mono {
  font-size: 11px;
  color: var(--bf-primary);
}

.action-right {
  display: flex;
  gap: 6px;
}

.action-right button {
  min-height: 42px;
  border-radius: 6px;
  font-family: inherit;
  font-size: 11.5px;
  padding: 0 12px;
}

.action-right .ghost {
  border: 1px solid var(--bf-border);
  background: #fff;
  color: var(--bf-ink-2);
}

.action-right .primary {
  border: none;
  background: var(--bf-primary);
  color: #fff;
  min-width: 150px;
  font-weight: 600;
}

.action-right .primary:disabled {
  opacity: 0.5;
}

.result-banner {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: 66px;
  background: #fff;
  border: 1px solid var(--bf-border);
  border-left: 4px solid #157a5b;
  border-radius: 6px;
  padding: 10px 14px;
  display: flex;
  gap: 10px;
  align-items: center;
  z-index: 40;
  box-shadow: 0 10px 30px rgba(20, 32, 46, 0.16);
  flex-wrap: wrap;
}

.result-banner.fail {
  border-left-color: #b02a1f;
}

.result-banner strong {
  font-size: 12px;
}

.result-banner span {
  font-size: 10.5px;
  color: var(--bf-ink-3);
}

.result-banner .link {
  border: none;
  background: transparent;
  color: var(--bf-accent);
  font-size: 10.5px;
  font-family: inherit;
}

.hidden {
  display: none;
}

@media (max-width: 980px) {
  .station-grid,
  .setup {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 760px) {
  .station {
    padding-bottom: 96px;
  }

  .value-input {
    width: 160px;
  }

  .action-bar {
    padding: 8px 10px;
  }

  .action-left .sub {
    display: none;
  }
}
</style>
