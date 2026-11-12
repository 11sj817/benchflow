<template>
  <div class="m-page record-page">
    <header class="rec-head">
      <div>
        <h1>{{ mode === 'defect' ? '提交异常' : '创建测试记录' }}</h1>
        <p>{{ mode === 'defect' ? '现场异常快速建单' : '分步录入，自动判定，草稿自动保存' }}</p>
      </div>
      <div class="mode-switch">
        <button type="button" :class="{ active: mode === 'record' }" @click="switchMode('record')">测试</button>
        <button type="button" :class="{ active: mode === 'defect' }" @click="switchMode('defect')">异常</button>
      </div>
    </header>

    <div v-if="mode === 'record'" class="steps">
      <div v-for="(item, index) in stepMeta" :key="item.title" class="step-item" :class="{ active: step === index + 1, done: step > index + 1 }">
        <span class="step-num">{{ step > index + 1 ? '✓' : index + 1 }}</span>
        <span class="step-title">{{ item.title }}</span>
      </div>
    </div>

    <div v-if="draftAvailable && !submittedRun" class="draft-card">
      <div>
        <strong>发现未提交草稿</strong>
        <span>{{ draftSavedAt ? draftAgeLabel(draftSavedAt) : '' }}保存 · 可恢复测量值与附件</span>
      </div>
      <div class="draft-actions">
        <button type="button" @click="discardDraft">放弃</button>
        <button type="button" class="primary" @click="restoreDraft">恢复草稿</button>
      </div>
    </div>

    <div v-if="contextSource === 'scan'" class="context-hint">
      <ScanLine :size="14" /> 已根据扫码自动带入项目、产品、计划与设备，无需重复选择
    </div>

    <div v-if="submittedRun" class="success-card">
      <span class="ok-icon"><Check :size="20" /></span>
      <strong>{{ submittedRun.code }} 已提交 · {{ submittedRun.result }}</strong>
      <p>{{ caseName(submittedRun.caseId) }} · {{ versionLabel(submittedRun.hardwareVersionId) }}</p>
      <div class="success-actions">
        <router-link :to="`/mobile/executions/${submittedRun.id}`" class="primary">查看执行详情</router-link>
        <router-link v-if="createdDefect" :to="`/mobile/defects/${createdDefect.id}`" class="ghost">查看缺陷 {{ createdDefect.code }}</router-link>
        <button type="button" class="ghost" @click="resetAfterSubmit">再记一条</button>
      </div>
    </div>

    <template v-else-if="mode === 'record'">
      <section v-show="step === 1" class="m-card">
        <div class="card-title"><span>1</span> 选择测试对象</div>
        <div class="field">
          <label>项目</label>
          <el-select v-model="form.projectId" size="large" style="width: 100%" @update:model-value="onProjectChange">
            <el-option v-for="project in app.visibleProjects" :key="project.id" :label="`${project.code} · ${project.name}`" :value="project.id" />
          </el-select>
        </div>
        <div class="field">
          <label>产品</label>
          <el-select v-model="form.productId" size="large" style="width: 100%" @update:model-value="onProductChange">
            <el-option v-for="product in projectProducts" :key="product.id" :label="product.name" :value="product.id" />
          </el-select>
        </div>
        <div class="two-col">
          <div class="field">
            <label>硬件版本</label>
            <el-select v-model="form.hardwareVersionId" size="large" style="width: 100%">
              <el-option v-for="version in hardwareVersions" :key="version.id" :label="version.version" :value="version.id" />
            </el-select>
          </div>
          <div class="field">
            <label>固件版本</label>
            <el-select v-model="form.firmwareVersionId" size="large" clearable style="width: 100%">
              <el-option v-for="version in firmwareVersions" :key="version.id" :label="version.version" :value="version.id" />
            </el-select>
          </div>
        </div>
        <div class="field">
          <label>测试计划</label>
          <el-select v-model="form.planId" size="large" style="width: 100%" @update:model-value="onPlanChange">
            <el-option v-for="plan in availablePlans" :key="plan.id" :label="`${plan.code} · ${plan.name}`" :value="plan.id" />
          </el-select>
          <span v-if="availablePlans.length === 0" class="field-hint danger">该项目没有可执行计划，请先在 PC 端创建测试计划。</span>
        </div>
        <div class="field">
          <label>测试用例</label>
          <el-select v-model="form.caseId" size="large" style="width: 100%" @update:model-value="onCaseChange">
            <el-option v-for="testCase in availableCases" :key="testCase.id" :label="`${testCase.code} · ${testCase.name}`" :value="testCase.id" />
          </el-select>
        </div>
        <div class="field">
          <label>测试设备</label>
          <el-select v-model="form.deviceId" size="large" clearable style="width: 100%">
            <el-option v-for="device in db.devices" :key="device.id" :label="`${device.code} · ${device.name}（${calibrationLabel(device)}）`" :value="device.id" />
          </el-select>
        </div>
        <div class="field">
          <label>工况描述</label>
          <el-input v-model="form.conditions" size="large" placeholder="如 48V 输入 / 12V 输出 / 50A 满载" />
        </div>
      </section>

      <section v-show="step === 2" class="m-card">
        <div class="card-title"><span>2</span> 测量与现场记录</div>
        <div class="env-grid">
          <label>温度 ℃<el-input-number v-model="form.temperature" :controls="false" size="large" /></label>
          <label>湿度 %RH<el-input-number v-model="form.humidity" :controls="false" size="large" /></label>
          <label>输入电压 V<el-input-number v-model="form.inputVoltage" :controls="false" size="large" /></label>
          <label>负载电流 A<el-input-number v-model="form.load" :controls="false" size="large" /></label>
        </div>

        <div class="measure-list">
          <div v-for="stepItem in caseSteps" :key="stepItem.id" class="measure">
            <div class="m-title">
              <strong>{{ stepItem.name }}</strong>
              <span v-if="stepItem.param">{{ stepItem.param.name }} · {{ limitText(stepItem.param) }}</span>
              <span v-else>人工判定步骤</span>
            </div>
            <div v-if="stepItem.param" class="m-input">
              <el-input-number
                v-model="values[stepItem.id]"
                :controls="false"
                size="large"
                placeholder="实测值"
                style="flex: 1"
              />
              <span class="unit">{{ stepItem.param.unit }}</span>
              <span class="verdict" :class="judgeStep(stepItem)">{{ judgeStep(stepItem) }}</span>
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
            <p v-if="stepItem.expected" class="expect">预期：{{ stepItem.expected }}</p>
          </div>
          <EmptyState v-if="caseSteps.length === 0" text="请先在上一步选择测试用例" />
        </div>

        <div class="field">
          <label>现场照片</label>
          <input ref="photoInput" type="file" accept="image/*" capture="environment" class="hidden" multiple @change="onPhotos" />
          <button type="button" class="media-btn" @click="photoInput?.click()">
            <Camera :size="17" /> 拍照 / 选择照片
          </button>
          <div v-if="imageAttachments.length" class="thumbs">
            <div v-for="att in imageAttachments" :key="att.id" class="thumb">
              <img :src="previewUrls[att.id]" :alt="att.name" />
              <button type="button" class="remove" @click="removeAttachment(att.id)"><X :size="11" /></button>
              <span>{{ att.name }}</span>
            </div>
          </div>
          <span v-if="attachmentError" class="field-hint danger">{{ attachmentError }}</span>
        </div>

        <div class="field">
          <label>语音记录</label>
          <button v-if="voiceSupported" type="button" class="media-btn" :class="{ recording }" @click="toggleVoice">
            <Mic :size="17" /> {{ recording ? `录音中 ${voiceSeconds}s · 点击结束` : '开始录音' }}
          </button>
          <div v-else class="unsupported">
            <Info :size="14" /> 当前浏览器不支持 MediaRecorder 或未授权麦克风，录音不可用（不使用计时器模拟）。
          </div>
          <span v-if="voiceError" class="field-hint danger">{{ voiceError }}</span>
          <div v-for="att in audioAttachments" :key="att.id" class="audio-item">
            <audio :src="previewUrls[att.id]" controls preload="metadata" />
            <span>{{ att.name }}</span>
            <button type="button" class="remove-text" @click="removeAttachment(att.id)">删除</button>
          </div>
        </div>

        <div class="field">
          <label>备注</label>
          <el-input v-model="form.note" type="textarea" :rows="3" placeholder="测试现象、异常说明" size="large" />
        </div>
        <div class="draft-state">
          <span>{{ draftReady ? '草稿自动保存' : '恢复草稿后可继续自动保存' }}</span>
          <span v-if="draftSavedAt">{{ draftSavedAt.slice(11, 16) }}</span>
        </div>
      </section>

      <section v-show="step === 3" class="m-card">
        <div class="card-title"><span>3</span> 检查与提交</div>
        <div class="summary">
          <div><span>项目</span><b>{{ projectName(form.projectId) }}</b></div>
          <div><span>产品 / 版本</span><b>{{ productName(form.productId) }} / {{ versionLabel(form.hardwareVersionId) }}</b></div>
          <div><span>计划 / 用例</span><b>{{ planCode(form.planId) }} / {{ caseName(form.caseId) }}</b></div>
          <div><span>设备</span><b>{{ deviceLabel(form.deviceId) }}</b></div>
          <div><span>环境</span><b>{{ form.temperature }}℃ · {{ form.humidity }}%RH · {{ form.inputVoltage }}V · {{ form.load }}A</b></div>
        </div>

        <div class="check-result" :class="evaluation.result.toLowerCase()">
          <span>当前判定</span>
          <b>{{ evaluation.result }}</b>
          <p>{{ describeEvaluation(evaluation) }}</p>
        </div>

        <div class="check-list">
          <div v-for="measurement in measurements" :key="measurement.id" class="check-row">
            <span>{{ measurement.param }}</span>
            <b :class="{ danger: measurement.result === 'FAIL' }">{{ measurement.value ?? '—' }} {{ measurement.unit }}</b>
            <span class="verdict" :class="measurement.result ?? 'PENDING'">{{ measurement.result ?? 'PENDING' }}</span>
          </div>
          <div v-for="manual in manualResultRows" :key="manual.stepId" class="check-row">
            <span>{{ manual.name }}</span>
            <b>{{ manual.result }}</b>
            <span class="verdict" :class="manual.result">{{ manual.result }}</span>
          </div>
        </div>

        <div v-if="evaluation.missing.length || evaluation.pendingManual.length" class="missing">
          <strong>未完成项</strong>
          <span v-for="item in evaluation.missing" :key="item.stepId">· {{ item.param }}（必填）</span>
          <span v-for="item in evaluation.pendingManual" :key="item.stepId">· {{ item.stepName }}（人工判定）</span>
        </div>

        <label class="confirm-row">
          <el-checkbox v-model="confirmed" /> 我确认以上测量值与现场条件真实有效
        </label>
        <label v-if="evaluation.result === 'FAIL'" class="confirm-row">
          <el-checkbox v-model="autoCreateDefect" /> 提交后自动创建缺陷并指派给我
        </label>
        <div class="force-row">
          <button type="button" class="ghost" @click="submit('BLOCKED')">标记 BLOCKED</button>
          <button type="button" class="ghost" @click="submit('SKIPPED')">标记 SKIPPED</button>
        </div>
        <p class="force-hint">BLOCKED / SKIPPED 是明确的人工操作，会写入执行记录与审计日志。</p>
      </section>
    </template>

    <template v-else>
      <section class="m-card">
        <div class="card-title"><span>!</span> 异常信息</div>
        <div class="field">
          <label>项目</label>
          <el-select v-model="defect.projectId" size="large" style="width: 100%" @update:model-value="onDefectProject">
            <el-option v-for="project in db.projects" :key="project.id" :label="project.name" :value="project.id" />
          </el-select>
        </div>
        <div class="field">
          <label>产品</label>
          <el-select v-model="defect.productId" size="large" style="width: 100%">
            <el-option v-for="product in defectProducts" :key="product.id" :label="product.name" :value="product.id" />
          </el-select>
        </div>
        <div class="field">
          <label>异常标题</label>
          <el-input v-model="defect.title" size="large" placeholder="例如：满载输出纹波超标" />
        </div>
        <div class="field">
          <label>严重程度</label>
          <div class="severity-row">
            <button
              v-for="(row, key) in severity.map"
              :key="key"
              type="button"
              class="sev-btn"
              :class="{ active: defect.severity === key }"
              @click="defect.severity = key"
            >{{ row.label }}</button>
          </div>
        </div>
        <div class="field">
          <label>异常描述</label>
          <el-input v-model="defect.description" type="textarea" :rows="4" size="large" placeholder="现象、复现条件、测量数据" />
        </div>
        <div class="field">
          <label>现场照片</label>
          <input ref="photoInput" type="file" accept="image/*" capture="environment" class="hidden" multiple @change="onPhotos" />
          <button type="button" class="media-btn" @click="photoInput?.click()"><Camera :size="17" /> 拍照 / 选择照片</button>
          <div v-if="imageAttachments.length" class="thumbs">
            <div v-for="att in imageAttachments" :key="att.id" class="thumb">
              <img :src="previewUrls[att.id]" :alt="att.name" />
              <button type="button" class="remove" @click="removeAttachment(att.id)"><X :size="11" /></button>
            </div>
          </div>
        </div>
        <div v-if="defect.executionId" class="field-hint">关联失败执行：{{ defect.executionId }}</div>
      </section>
    </template>

    <div v-if="!submittedRun" class="bottom-bar">
      <template v-if="mode === 'record'">
        <button v-if="step > 1" type="button" class="ghost" @click="step -= 1">上一步</button>
        <button v-if="step < 3" type="button" class="primary" @click="nextStep">下一步</button>
        <button v-else type="button" class="primary" :disabled="submitting || !canSubmit" @click="submit()">
          {{ submitting ? '提交中…' : '提交测试记录' }}
        </button>
      </template>
      <button v-else type="button" class="primary wide" :disabled="defectSubmitting" @click="submitDefect">
        {{ defectSubmitting ? '提交中…' : '提交异常' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Camera, Check, Info, Mic, ScanLine, X } from 'lucide-vue-next'
import type { Attachment, Defect, Device, Measurement, RunResult, Severity, TestCase, TestPlan, TestStep } from '@/types'
import { db } from '@/services/db'
import { executionService } from '@/services/executionService'
import { defectService } from '@/services/defectService'
import { runService } from '@/services/runtime'
import { useAppStore } from '@/stores/app'
import EmptyState from '@/components/common/EmptyState.vue'
import { describeEvaluation, evaluateExecution, judgeValue } from '@/utils/measurement'
import { contextFromQuery, saveTestContext } from '@/utils/testContext'
import { clearDraft, draftAgeLabel, readDraft, saveDraft } from '@/utils/draftStore'
import {
  deleteAttachment,
  getAttachment,
  saveFileAttachment,
  saveAttachment,
  type AttachmentMeta,
} from '@/utils/attachmentStore'
import { severity } from '@/utils/format'

interface RecordForm {
  projectId: string
  productId: string
  hardwareVersionId: string
  firmwareVersionId: string
  planId: string
  caseId: string
  deviceId: string
  conditions: string
  temperature: number | null
  humidity: number | null
  inputVoltage: number | null
  load: number | null
  note: string
}

interface MobileRecordDraft {
  step: number
  mode: 'record' | 'defect'
  form: RecordForm
  values: Record<string, number | null>
  stepResults: Record<string, RunResult>
  attachments: AttachmentMeta[]
  defect: { projectId: string; productId: string; title: string; description: string; severity: Severity; executionId?: string }
}

const route = useRoute()
const router = useRouter()
const app = useAppStore()

const mode = ref<'record' | 'defect'>(route.query.mode === 'defect' ? 'defect' : 'record')
const step = ref(1)
const stepMeta = [{ title: '选择对象' }, { title: '测量记录' }, { title: '检查提交' }]
const contextSource = String(route.query.source ?? '')
const initialContext = contextFromQuery(route.query as Record<string, unknown>)

const form = reactive<RecordForm>({
  projectId: initialContext.projectId ?? '',
  productId: initialContext.productId ?? '',
  hardwareVersionId: initialContext.hardwareVersionId ?? '',
  firmwareVersionId: initialContext.firmwareVersionId ?? '',
  planId: initialContext.planId ?? '',
  caseId: initialContext.caseId ?? '',
  deviceId: initialContext.deviceId ?? '',
  conditions: '48V 输入 / 12V 输出 / 50A 满载 / 风冷',
  temperature: 25,
  humidity: 50,
  inputVoltage: 48,
  load: 50,
  note: '',
})

const defect = reactive({
  projectId: String(route.query.projectId ?? db.projects[0]?.id ?? ''),
  productId: String(route.query.productId ?? db.products[0]?.id ?? ''),
  title: '',
  description: '',
  severity: 'major' as Severity,
  executionId: typeof route.query.execution === 'string' ? route.query.execution : undefined,
})

const values = reactive<Record<string, number | null>>({})
const stepResults = reactive<Record<string, RunResult>>({})
const attachments = ref<AttachmentMeta[]>([])
const previewUrls = reactive<Record<string, string>>({})
const photoInput = ref<HTMLInputElement | null>(null)
const attachmentError = ref('')
const confirmed = ref(false)
const autoCreateDefect = ref(true)
const submitting = ref(false)
const defectSubmitting = ref(false)
const submittedRun = ref<{ id: string; code: string; result: RunResult; caseId: string; hardwareVersionId: string } | null>(null)
const createdDefect = ref<Defect | null>(null)

const draftKey = `mobile-record:${app.currentUser.id}`
const draftAvailable = ref(false)
const draftSavedAt = ref('')
const draftReady = ref(false)
let draftPayload: MobileRecordDraft | null = null
let saveTimer: number | null = null

const projectProducts = computed(() => db.products.filter((product) => product.projectId === form.projectId))
const hardwareVersions = computed(() =>
  db.versions.filter((version) => version.productId === form.productId && version.kind === 'hardware'),
)
const firmwareVersions = computed(() =>
  db.versions.filter((version) => version.productId === form.productId && version.kind === 'firmware'),
)
const availablePlans = computed<TestPlan[]>(() =>
  db.plans
    .filter(
      (plan) =>
        plan.projectId === form.projectId &&
        (!form.productId || plan.productId === form.productId) &&
        ['running', 'pending', 'review', 'completed'].includes(plan.status),
    )
    .slice()
    .sort((a, b) => Number(b.status === 'running') - Number(a.status === 'running')),
)
const currentPlan = computed(() => db.plans.find((plan) => plan.id === form.planId))
const availableCases = computed<TestCase[]>(() => {
  const plan = currentPlan.value
  const ids = plan ? plan.caseIds : db.cases.filter((item) => item.productIds.includes(form.productId)).map((item) => item.id)
  return ids
    .map((id) => db.cases.find((item) => item.id === id))
    .filter((item): item is TestCase => Boolean(item))
})
const currentCase = computed(() => db.cases.find((item) => item.id === form.caseId))
const caseSteps = computed<TestStep[]>(() => currentCase.value?.steps ?? [])
const paramSteps = computed(() => caseSteps.value.filter((stepItem) => stepItem.param))
const manualSteps = computed(() => caseSteps.value.filter((stepItem) => !stepItem.param))
const manualOptions: RunResult[] = ['PASS', 'FAIL', 'BLOCKED', 'SKIPPED']

const measurements = computed<Measurement[]>(() =>
  paramSteps.value.map((stepItem) => {
    const param = stepItem.param!
    const value = values[stepItem.id] ?? null
    return {
      id: `MS-${stepItem.id}`,
      param: param.name,
      unit: param.unit,
      value,
      min: param.min,
      max: param.max,
      result: judgeValue(value, param.min, param.max),
    }
  }),
)

const stepResultRows = computed(() =>
  caseSteps.value.map((stepItem) => ({ stepId: stepItem.id, result: stepResults[stepItem.id] ?? 'PENDING' as RunResult })),
)
const manualResultRows = computed(() =>
  manualSteps.value.map((stepItem) => ({
    stepId: stepItem.id,
    name: stepItem.name,
    result: stepResults[stepItem.id] ?? 'PENDING',
  })),
)
const evaluation = computed(() =>
  evaluateExecution({
    caseSteps: caseSteps.value,
    measurements: measurements.value,
    stepResults: stepResultRows.value,
  }),
)

const step1Valid = computed(
  () => Boolean(form.projectId && form.productId && form.hardwareVersionId && form.planId && form.caseId),
)
const canSubmit = computed(
  () => confirmed.value && evaluation.value.result !== 'PENDING' && evaluation.value.isComplete,
)
const imageAttachments = computed(() => attachments.value.filter((att) => att.kind === 'image'))
const audioAttachments = computed(() => attachments.value.filter((att) => att.kind === 'audio'))

const defectProducts = computed(() => db.products.filter((product) => product.projectId === defect.projectId))

const projectName = (id?: string) => db.projects.find((project) => project.id === id)?.name ?? '—'
const productName = (id?: string) => db.products.find((product) => product.id === id)?.name ?? '—'
const planCode = (id?: string) => db.plans.find((plan) => plan.id === id)?.code ?? '—'
const caseName = (id?: string) => db.cases.find((item) => item.id === id)?.name ?? '—'
const versionLabel = (id?: string) => (id ? db.versions.find((version) => version.id === id)?.version ?? id : '—')
const deviceLabel = (id?: string) => db.devices.find((device) => device.id === id)?.name ?? '未指定'
const calibrationLabel = (device: Device) => {
  const state = device.calibrationDate ? (device.calibrationDue < new Date().toISOString().slice(0, 10) ? '校准过期' : '校准有效') : '未校准'
  return state
}
const limitText = (param?: TestStep['param']) => {
  if (!param) return ''
  if (param.min != null && param.max != null) return `${param.min}~${param.max}${param.unit}`
  if (param.max != null) return `≤${param.max}${param.unit}`
  if (param.min != null) return `≥${param.min}${param.unit}`
  return param.unit
}
const judgeStep = (stepItem: TestStep): RunResult => {
  if (!stepItem.param) return stepResults[stepItem.id] ?? 'PENDING'
  const value = values[stepItem.id] ?? null
  return judgeValue(value, stepItem.param.min, stepItem.param.max)
}

const initializeValues = () => {
  paramSteps.value.forEach((stepItem) => {
    if (!(stepItem.id in values)) values[stepItem.id] = null
  })
  manualSteps.value.forEach((stepItem) => {
    if (!(stepItem.id in stepResults)) stepResults[stepItem.id] = 'PENDING'
  })
}

const applyPlan = (planId: string, preserveCase = true) => {
  const plan = db.plans.find((row) => row.id === planId)
  if (!plan) return
  form.productId = plan.productId
  form.hardwareVersionId = plan.hardwareVersionId
  form.firmwareVersionId = plan.firmwareVersionId ?? ''
  if (!preserveCase || !plan.caseIds.includes(form.caseId)) form.caseId = plan.caseIds[0] ?? ''
  if (!form.deviceId) form.deviceId = plan.deviceIds[0] ?? ''
  initializeValues()
  saveTestContext({
    projectId: form.projectId,
    productId: form.productId,
    hardwareVersionId: form.hardwareVersionId,
    firmwareVersionId: form.firmwareVersionId,
    planId: plan.id,
    caseId: form.caseId,
    deviceId: form.deviceId,
    source: 'manual',
  })
}

const initializeForm = () => {
  const plan = db.plans.find((row) => row.id === form.planId)
  if (plan) {
    form.projectId = plan.projectId
    form.productId = plan.productId
    form.hardwareVersionId = plan.hardwareVersionId
    form.firmwareVersionId = form.firmwareVersionId || plan.firmwareVersionId || ''
    form.caseId = form.caseId || plan.caseIds[0] || ''
    form.deviceId = form.deviceId || plan.deviceIds[0] || ''
  } else {
    if (!form.projectId) form.projectId = app.visibleProjects[0]?.id ?? db.projects[0]?.id ?? ''
    if (!form.productId) {
      form.productId =
        db.products.find((product) => product.projectId === form.projectId)?.id ?? db.products[0]?.id ?? ''
    }
    if (!form.hardwareVersionId) form.hardwareVersionId = hardwareVersions.value[0]?.id ?? ''
    if (!form.planId) form.planId = availablePlans.value[0]?.id ?? ''
    if (form.planId) {
      applyPlan(form.planId, true)
    } else {
      form.caseId = form.caseId || availableCases.value[0]?.id || ''
    }
  }
  initializeValues()
}

const onProjectChange = () => {
  form.productId = db.products.find((product) => product.projectId === form.projectId)?.id ?? ''
  form.hardwareVersionId = ''
  form.firmwareVersionId = ''
  form.planId = ''
  form.caseId = ''
  form.deviceId = ''
  onProductChange()
}

const onProductChange = () => {
  form.hardwareVersionId = db.versions.find((version) => version.productId === form.productId && version.kind === 'hardware')?.id ?? ''
  form.firmwareVersionId = db.versions.find((version) => version.productId === form.productId && version.kind === 'firmware')?.id ?? ''
  form.planId = availablePlans.value[0]?.id ?? ''
  form.caseId = ''
  if (form.planId) applyPlan(form.planId, false)
  else form.caseId = availableCases.value[0]?.id ?? ''
}

const onPlanChange = () => applyPlan(form.planId)

const onCaseChange = () => {
  initializeValues()
}

const nextStep = () => {
  if (step.value === 1 && !step1Valid.value) {
    ElMessage.warning('请选择项目、产品、硬件版本、测试计划与用例')
    return
  }
  if (step.value === 2 && caseSteps.value.length === 0) {
    ElMessage.warning('当前用例没有步骤')
    return
  }
  step.value = Math.min(3, step.value + 1)
}

const switchMode = (next: 'record' | 'defect') => {
  mode.value = next
  router.replace({ query: next === 'defect' ? { ...route.query, mode: 'defect' } : { ...route.query, mode: undefined } })
}

const onDefectProject = () => {
  defect.productId = defectProducts.value[0]?.id ?? ''
}

const onPhotos = async (event: Event) => {
  const files = Array.from((event.target as HTMLInputElement).files ?? [])
  if (!files.length) return
  attachmentError.value = ''
  for (const file of files) {
    try {
      const meta = await saveFileAttachment(file)
      attachments.value.push(meta)
      previewUrls[meta.id] = URL.createObjectURL(file)
    } catch (error) {
      attachmentError.value = error instanceof Error ? error.message : '附件保存失败'
    }
  }
  if (photoInput.value) photoInput.value.value = ''
}

const removeAttachment = async (id: string) => {
  await deleteAttachment(id)
  attachments.value = attachments.value.filter((att) => att.id !== id)
  if (previewUrls[id]) {
    URL.revokeObjectURL(previewUrls[id])
    delete previewUrls[id]
  }
}

const hydratePreviewUrls = async () => {
  for (const att of attachments.value) {
    if (previewUrls[att.id]) continue
    const stored = await getAttachment(att.id)
    if (stored) previewUrls[att.id] = URL.createObjectURL(stored.blob)
  }
}

const voiceSupported = typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'
const recording = ref(false)
const voiceSeconds = ref(0)
const voiceError = ref('')
let recorder: MediaRecorder | null = null
let recorderChunks: Blob[] = []
let recorderStream: MediaStream | null = null
let voiceTimer: number | null = null

const toggleVoice = async () => {
  if (!voiceSupported) return
  if (recording.value) {
    recorder?.stop()
    return
  }
  try {
    voiceError.value = ''
    recorderStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    recorderChunks = []
    recorder = new MediaRecorder(recorderStream)
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) recorderChunks.push(event.data)
    }
    recorder.onstop = async () => {
      const blob = new Blob(recorderChunks, { type: recorder?.mimeType || 'audio/webm' })
      recorderStream?.getTracks().forEach((track) => track.stop())
      recorderStream = null
      recording.value = false
      if (voiceTimer) window.clearInterval(voiceTimer)
      voiceTimer = null
      try {
        if (blob.size > 0) {
          const meta = await saveAttachment({ name: `现场语音_${new Date().toISOString().slice(11, 19).replace(/:/g, '')}.webm`, blob })
          attachments.value.push(meta)
          previewUrls[meta.id] = URL.createObjectURL(blob)
        }
      } catch (error) {
        voiceError.value = error instanceof Error ? error.message : '录音保存失败'
      }
    }
    recorder.start()
    recording.value = true
    voiceSeconds.value = 0
    voiceTimer = window.setInterval(() => {
      voiceSeconds.value += 1
    }, 1000)
  } catch {
    voiceError.value = '无法访问麦克风（权限被拒绝或环境不支持）'
    recording.value = false
  }
}

const draftSnapshot = (): MobileRecordDraft => ({
  step: step.value,
  mode: mode.value,
  form: { ...form },
  values: { ...values },
  stepResults: { ...stepResults },
  attachments: attachments.value,
  defect: { ...defect },
})

const scheduleDraft = () => {
  if (!draftReady.value || submittedRun.value) return
  if (saveTimer) window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    const envelope = saveDraft(draftKey, draftSnapshot(), 2)
    if (envelope) draftSavedAt.value = envelope.savedAt
  }, 500)
}

watch([form, values, stepResults, step, attachments, defect], scheduleDraft, { deep: true })

const restoreDraft = async () => {
  if (!draftPayload) return
  const payload = draftPayload
  Object.assign(form, payload.form)
  Object.keys(values).forEach((key) => delete values[key])
  Object.assign(values, payload.values)
  Object.keys(stepResults).forEach((key) => delete stepResults[key])
  Object.assign(stepResults, payload.stepResults)
  Object.assign(defect, payload.defect)
  attachments.value = payload.attachments ?? []
  mode.value = payload.mode ?? 'record'
  step.value = payload.step ?? 1
  draftAvailable.value = false
  draftReady.value = true
  await hydratePreviewUrls()
  saveTestContext({
    projectId: form.projectId,
    productId: form.productId,
    hardwareVersionId: form.hardwareVersionId,
    planId: form.planId,
    caseId: form.caseId,
    deviceId: form.deviceId,
    source: 'resume',
  })
  ElMessage.success('草稿已恢复')
}

const discardDraft = () => {
  clearDraft(draftKey)
  draftAvailable.value = false
  draftPayload = null
  draftReady.value = true
  initializeForm()
}

const submit = async (forced?: RunResult) => {
  if (mode.value !== 'record') return
  if (!forced && !canSubmit.value) {
    ElMessage.warning(
      !evaluation.value.isComplete
        ? '还有必填测量或人工判定未完成，请补全后再提交'
        : evaluation.value.result === 'PENDING'
          ? '还有未完成项，请先补全'
          : '请确认测量数据真实有效',
    )
    return
  }
  if (!form.planId || !form.caseId) {
    ElMessage.warning('请先选择测试计划与用例')
    return
  }
  if (forced) {
    try {
      await ElMessageBox.confirm(`将整条执行标记为 ${forced}，需要人工确认。是否继续？`, `标记 ${forced}`, {
        confirmButtonText: '确认标记',
        cancelButtonText: '取消',
      })
    } catch {
      return
    }
  }
  submitting.value = true
  try {
    const run = await runService(
      'execution.create',
      () =>
        executionService.create({
          planId: form.planId,
          caseId: form.caseId,
          testerId: app.currentUser.id,
          deviceIds: form.deviceId ? [form.deviceId] : [],
          environment: {
            temperature: form.temperature,
            humidity: form.humidity,
            inputVoltage: form.inputVoltage,
            load: form.load,
            note: '移动端现场录入',
          },
          conditions: form.conditions,
          note: form.note,
        }),
      { permission: 'execute' },
    )
    measurements.value.forEach((measurement) => {
      executionService.setMeasurement(run.id, measurement.id, measurement.value)
    })
    manualSteps.value.forEach((stepItem) => {
      executionService.setStepResult(run.id, stepItem.id, stepResults[stepItem.id] ?? 'PENDING')
    })
    const attachmentRows: Attachment[] = attachments.value.map((att) => ({
      id: att.id,
      name: att.name,
      kind:
        att.kind === 'image'
          ? att.type.includes('png')
            ? 'png'
            : 'jpg'
          : att.kind === 'audio'
            ? 'audio'
            : att.kind === 'csv'
              ? 'csv'
              : 'log',
      size: att.size,
      addedAt: att.createdAt,
      note: '移动端现场附件',
    }))
    if (attachmentRows.length) executionService.setAttachmentList(run.id, attachmentRows)
    executionService.finish(run.id, forced)
    const finished = db.executions.find((row) => row.id === run.id) ?? run

    let newDefect: Defect | null = null
    if (finished.result === 'FAIL' && autoCreateDefect.value) {
      const draftData = executionService.defectDraft(run.id)
      if (draftData) {
        newDefect = defectService.create({
          title: String(draftData.title),
          description: String(draftData.description),
          severity: 'critical',
          priority: 'P0',
          projectId: String(draftData.projectId),
          productId: String(draftData.productId),
          hardwareVersionId: draftData.hardwareVersionId ? String(draftData.hardwareVersionId) : undefined,
          firmwareVersionId: draftData.firmwareVersionId ? String(draftData.firmwareVersionId) : undefined,
          executionId: run.id,
          caseId: run.caseId,
          steps: String(draftData.steps),
          evidence: attachmentRows,
          ownerId: app.currentUser.id,
        })
        createdDefect.value = newDefect
      }
    }

    clearDraft(draftKey)
    saveTestContext({
      projectId: form.projectId,
      productId: form.productId,
      hardwareVersionId: form.hardwareVersionId,
      planId: form.planId,
      caseId: form.caseId,
      deviceId: form.deviceId,
      source: 'manual',
    })
    submittedRun.value = {
      id: finished.id,
      code: finished.code,
      result: finished.result,
      caseId: finished.caseId,
      hardwareVersionId: finished.hardwareVersionId,
    }
    ElMessage.success(`测试记录 ${finished.code} 已提交：${finished.result}`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '提交失败')
  } finally {
    submitting.value = false
  }
}

const submitDefect = async () => {
  if (!defect.title.trim() || !defect.description.trim()) {
    ElMessage.warning('请填写异常标题与描述')
    return
  }
  defectSubmitting.value = true
  try {
    const attachmentRows: Attachment[] = attachments.value.map((att) => ({
      id: att.id,
      name: att.name,
      kind: att.kind === 'image' ? 'jpg' : att.kind === 'audio' ? 'audio' : 'log',
      size: att.size,
      addedAt: att.createdAt,
    }))
    const created = await runService(
      'defect.create',
      () =>
        defectService.create({
          title: defect.title.trim(),
          description: defect.description.trim(),
          severity: defect.severity,
          priority: defect.severity === 'critical' || defect.severity === 'blocker' ? 'P0' : 'P1',
          projectId: defect.projectId,
          productId: defect.productId,
          executionId: defect.executionId,
          caseId: defect.executionId ? db.executions.find((run) => run.id === defect.executionId)?.caseId : undefined,
          steps: '移动端现场上报，复现步骤待补充。',
          evidence: attachmentRows,
          ownerId: app.currentUser.id,
        }),
      { permission: 'create' },
    )
    clearDraft(draftKey)
    ElMessage.success(`缺陷 ${created.code} 已提交`)
    router.push(`/mobile/defects/${created.id}`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '提交失败')
  } finally {
    defectSubmitting.value = false
  }
}

const resetAfterSubmit = () => {
  submittedRun.value = null
  createdDefect.value = null
  step.value = 1
  confirmed.value = false
  form.note = ''
  attachments.value = []
  Object.keys(previewUrls).forEach((id) => {
    URL.revokeObjectURL(previewUrls[id])
    delete previewUrls[id]
  })
  Object.keys(values).forEach((key) => delete values[key])
  Object.keys(stepResults).forEach((key) => delete stepResults[key])
  initializeValues()
}

const applyExecutionPrefill = () => {
  if (mode.value !== 'defect' || !defect.executionId) return
  const draftData = executionService.defectDraft(defect.executionId)
  if (!draftData) return
  defect.title = String(draftData.title ?? '')
  defect.description = String(draftData.description ?? '')
  defect.projectId = String(draftData.projectId ?? defect.projectId)
  defect.productId = String(draftData.productId ?? defect.productId)
  defect.severity = 'critical'
}

onBeforeUnmount(() => {
  if (saveTimer) window.clearTimeout(saveTimer)
  if (voiceTimer) window.clearInterval(voiceTimer)
  recorderStream?.getTracks().forEach((track) => track.stop())
  Object.values(previewUrls).forEach((url) => URL.revokeObjectURL(url))
})

const bootstrap = async () => {
  const stored = readDraft<MobileRecordDraft>(draftKey, 2)
  if (stored) {
    draftPayload = stored.data
    draftAvailable.value = true
    draftSavedAt.value = stored.savedAt
  } else {
    draftReady.value = true
    initializeForm()
  }
  applyExecutionPrefill()
  if (mode.value === 'record' && (initialContext.source === 'scan' || initialContext.planId)) {
    saveTestContext({ ...initialContext, source: initialContext.source ?? 'scan' })
  }
  void hydratePreviewUrls()
}

void bootstrap()
</script>

<style scoped>
.record-page {
  padding-bottom: 150px;
}

.rec-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}

.rec-head h1 {
  font-size: 18px;
  font-weight: 650;
}

.rec-head p {
  font-size: 10.5px;
  color: var(--bf-ink-3);
  margin-top: 3px;
}

.mode-switch {
  display: flex;
  background: #e9edf3;
  border-radius: 6px;
  padding: 2px;
  flex: none;
}

.mode-switch button {
  border: none;
  background: transparent;
  font-family: inherit;
  font-size: 10.5px;
  color: var(--bf-ink-2);
  padding: 5px 9px;
  border-radius: 4px;
  min-height: 30px;
}

.mode-switch button.active {
  background: #fff;
  color: var(--bf-ink);
  font-weight: 600;
}

.steps {
  display: flex;
  gap: 4px;
  background: #fff;
  border: 1px solid var(--bf-border);
  border-radius: 8px;
  padding: 8px;
}

.step-item {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10.5px;
  color: var(--bf-ink-3);
  min-width: 0;
}

.step-item .step-num {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--bf-surface-3);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  flex: none;
}

.step-item.active {
  color: var(--bf-primary);
  font-weight: 600;
}

.step-item.active .step-num {
  background: var(--bf-primary);
  color: #fff;
}

.step-item.done .step-num {
  background: #157a5b;
  color: #fff;
}

.step-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.draft-card {
  background: #fdf6ea;
  border: 1px solid #f0dfc0;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.draft-card strong {
  font-size: 12px;
  color: #80510a;
}

.draft-card span {
  display: block;
  font-size: 10.3px;
  color: #8a6a35;
  margin-top: 2px;
}

.draft-actions {
  display: flex;
  gap: 8px;
}

.draft-actions button {
  flex: 1;
  min-height: 38px;
  border-radius: 5px;
  border: 1px solid #e8d4ae;
  background: #fff;
  color: #80510a;
  font-family: inherit;
  font-size: 11.5px;
}

.draft-actions button.primary {
  background: #80510a;
  border-color: #80510a;
  color: #fff;
}

.context-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #eaf1f7;
  color: #2a5878;
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 10.5px;
}

.m-card {
  background: #fff;
  border: 1px solid var(--bf-border);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.card-title {
  font-size: 12.8px;
  font-weight: 620;
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--bf-border);
}

.card-title > span {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--bf-primary);
  color: #fff;
  font-size: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.field label {
  font-size: 11px;
  color: var(--bf-ink-3);
}

.field-hint {
  font-size: 10px;
  color: var(--bf-ink-3);
}

.field-hint.danger {
  color: var(--bf-danger);
}

.two-col {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.env-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.env-grid label {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 10.5px;
  color: var(--bf-ink-3);
}

.measure-list {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.measure {
  border-bottom: 1px dashed var(--bf-border);
  padding-bottom: 9px;
}

.measure:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.m-title {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.m-title strong {
  font-size: 12.2px;
  font-weight: 600;
}

.m-title span {
  font-size: 10.2px;
  color: var(--bf-ink-3);
}

.m-input {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 5px;
}

.unit {
  font-size: 11px;
  color: var(--bf-ink-3);
  width: 32px;
}

.verdict {
  font-size: 9.5px;
  font-weight: 600;
  border-radius: 3px;
  padding: 1px 6px;
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

.manual-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 5px;
  margin-top: 5px;
}

.manual-btn {
  min-height: 38px;
  border: 1px solid var(--bf-border);
  background: #fff;
  border-radius: 5px;
  font-family: inherit;
  font-size: 10.5px;
  color: var(--bf-ink-2);
}

.manual-btn.active {
  border-color: var(--bf-primary);
  background: var(--bf-primary-soft);
  color: var(--bf-primary);
  font-weight: 600;
}

.expect {
  font-size: 10px;
  color: var(--bf-ink-3);
  margin-top: 4px;
  line-height: 1.45;
}

.media-btn {
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 44px;
  border: 1px dashed var(--bf-border-strong);
  background: var(--bf-surface-2);
  border-radius: 6px;
  font-family: inherit;
  font-size: 12px;
  color: var(--bf-ink-2);
  padding: 0 11px;
}

.media-btn.recording {
  border-color: #b02a1f;
  background: #fdf1f0;
  color: #8f241b;
}

.unsupported {
  display: flex;
  gap: 6px;
  align-items: flex-start;
  background: #fdf1f0;
  border: 1px solid #f2d5d1;
  color: #8f241b;
  border-radius: 5px;
  padding: 8px;
  font-size: 10.3px;
  line-height: 1.5;
}

.hidden {
  display: none;
}

.thumbs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin-top: 6px;
}

.thumb {
  position: relative;
  border-radius: 5px;
  overflow: hidden;
  border: 1px solid var(--bf-border);
  background: var(--bf-surface-2);
}

.thumb img {
  width: 100%;
  height: 76px;
  object-fit: cover;
  display: block;
}

.thumb span {
  display: block;
  font-size: 8.5px;
  color: var(--bf-ink-3);
  padding: 2px 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.thumb .remove {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: none;
  background: rgba(20, 32, 46, 0.7);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.audio-item {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 6px;
  background: var(--bf-surface-2);
  border-radius: 5px;
  padding: 5px 7px;
}

.audio-item audio {
  width: 150px;
  height: 30px;
}

.audio-item span {
  flex: 1;
  font-size: 9.5px;
  color: var(--bf-ink-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.remove-text {
  border: none;
  background: transparent;
  color: var(--bf-danger);
  font-size: 10px;
  font-family: inherit;
  min-height: 30px;
}

.draft-state {
  display: flex;
  justify-content: space-between;
  font-size: 9.5px;
  color: var(--bf-ink-3);
}

.summary {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.summary div {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 11px;
}

.summary span {
  color: var(--bf-ink-3);
}

.summary b {
  font-weight: 500;
  text-align: right;
}

.check-result {
  border: 1px solid var(--bf-border);
  border-radius: 6px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: var(--bf-surface-2);
}

.check-result > span {
  font-size: 9.5px;
  color: var(--bf-ink-3);
}

.check-result b {
  font-size: 20px;
  font-weight: 700;
}

.check-result p {
  font-size: 10.3px;
  color: var(--bf-ink-3);
  line-height: 1.5;
}

.check-result.pass b {
  color: #157a5b;
}

.check-result.fail b {
  color: #b02a1f;
}

.check-list {
  display: flex;
  flex-direction: column;
}

.check-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 0;
  border-bottom: 1px dashed var(--bf-border);
  font-size: 11px;
}

.check-row > span:first-child {
  flex: 1;
  min-width: 0;
}

.check-row b {
  font-weight: 600;
}

.check-row b.danger {
  color: var(--bf-danger);
}

.missing {
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: #fdf6ea;
  border: 1px solid #f0dfc0;
  border-radius: 5px;
  padding: 8px;
  font-size: 10.5px;
  color: #80510a;
}

.missing strong {
  font-size: 11px;
}

.confirm-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--bf-ink-2);
}

.force-row {
  display: flex;
  gap: 6px;
}

.force-row button {
  flex: 1;
  min-height: 36px;
  border: 1px solid var(--bf-border);
  background: #fff;
  border-radius: 5px;
  font-family: inherit;
  font-size: 10.5px;
  color: var(--bf-ink-2);
}

.force-hint {
  font-size: 9.5px;
  color: var(--bf-ink-3);
  line-height: 1.5;
}

.severity-row {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}

.sev-btn {
  min-height: 36px;
  border: 1px solid var(--bf-border);
  background: #fff;
  border-radius: 5px;
  padding: 0 10px;
  font-family: inherit;
  font-size: 10.5px;
  color: var(--bf-ink-2);
}

.sev-btn.active {
  border-color: var(--bf-primary);
  background: var(--bf-primary-soft);
  color: var(--bf-primary);
  font-weight: 600;
}

.bottom-bar {
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

.bottom-bar button {
  flex: 1;
  min-height: 44px;
  border-radius: 6px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
}

.bottom-bar .ghost {
  border: 1px solid var(--bf-border);
  background: #fff;
  color: var(--bf-ink-2);
}

.bottom-bar .primary {
  border: none;
  background: var(--bf-primary);
  color: #fff;
}

.bottom-bar .primary:disabled {
  opacity: 0.55;
}

.bottom-bar .wide {
  flex: 1;
}

.success-card {
  background: #fff;
  border: 1px solid var(--bf-border);
  border-left: 4px solid #157a5b;
  border-radius: 8px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ok-icon {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: #e7f5ef;
  color: #157a5b;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.success-card strong {
  font-size: 15px;
}

.success-card p {
  font-size: 11px;
  color: var(--bf-ink-3);
}

.success-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.success-actions a,
.success-actions button {
  min-height: 38px;
  border-radius: 5px;
  padding: 0 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11.5px;
  font-family: inherit;
}

.success-actions .primary {
  background: var(--bf-primary);
  color: #fff;
  border: none;
}

.success-actions .ghost {
  border: 1px solid var(--bf-border);
  background: #fff;
  color: var(--bf-ink-2);
}
</style>
