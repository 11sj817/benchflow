<template>
  <div class="m-page">
    <header class="m-head">
      <h1>{{ mode === 'defect' ? '提交异常' : '创建测试记录' }}</h1>
      <p>{{ mode === 'defect' ? '现场发现异常，快速建立缺陷' : '现场录入测量值，自动判定 PASS / FAIL' }}</p>
    </header>

    <div class="seg">
      <button type="button" :class="{ active: mode === 'record' }" @click="switchMode('record')">测试记录</button>
      <button type="button" :class="{ active: mode === 'defect' }" @click="switchMode('defect')">异常上报</button>
    </div>

    <template v-if="mode === 'record'">
      <div v-if="createdRun" class="result-card" :class="createdRun.result.toLowerCase()">
        <span class="r-label">已提交</span>
        <strong>{{ createdRun.code }} · {{ createdRun.result }}</strong>
        <p>{{ caseName(createdRun.caseId) }} · {{ versionLabel(createdRun.hardwareVersionId) }}</p>
        <div class="r-actions">
          <router-link :to="`/test-executions/${createdRun.id}`" class="r-btn">查看执行详情</router-link>
          <button type="button" class="r-btn ghost" @click="resetRecord">再记一条</button>
        </div>
      </div>

      <template v-else>
        <section class="m-card">
          <div class="field">
            <label>测试计划</label>
            <el-select v-model="planId" size="large" style="width: 100%" @update:model-value="onPlanChange">
              <el-option v-for="plan in runningPlans" :key="plan.id" :label="`${plan.code} · ${plan.name}`" :value="plan.id" />
            </el-select>
          </div>
          <div class="field">
            <label>测试用例</label>
            <el-select v-model="caseId" size="large" style="width: 100%" @update:model-value="onCaseChange">
              <el-option v-for="testCase in planCases" :key="testCase.id" :label="testCase.name" :value="testCase.id" />
            </el-select>
          </div>
          <div class="field">
            <label>工况</label>
            <el-input v-model="conditions" size="large" placeholder="如 48V/50A 满载" />
          </div>
        </section>

        <section class="m-card" v-if="currentCase">
          <header class="m-card-head">
            <h2>测量值录入</h2>
            <span class="badge" :class="overall.toLowerCase()">{{ overall }}</span>
          </header>
          <div class="measure-list">
            <div v-for="step in paramSteps" :key="step.id" class="measure">
              <div class="m-title">
                <strong>{{ step.param?.name }}</strong>
                <span>{{ limitText(step.param) }}</span>
              </div>
              <div class="m-input">
                <el-input-number
                  :model-value="values[step.id] ?? undefined"
                  :controls="false"
                  size="large"
                  placeholder="0.0"
                  style="flex: 1"
                  @change="(value: number | undefined) => (values[step.id] = value ?? null)"
                />
                <span class="unit">{{ step.param?.unit }}</span>
                <span v-if="values[step.id] !== null && values[step.id] !== undefined" class="verdict" :class="judge(step)">
                  {{ judge(step) }}
                </span>
              </div>
            </div>
            <EmptyState v-if="paramSteps.length === 0" text="该用例没有测量参数" hint="可在备注中记录结果，或选择其他用例。" />
          </div>
        </section>

        <section class="m-card">
          <div class="field">
            <label>现场照片</label>
            <input ref="photoInput" type="file" accept="image/*" capture="environment" class="hidden" @change="onPhoto" />
            <button type="button" class="upload-btn" @click="photoInput?.click()">
              <Camera :size="16" />
              {{ photoName || '拍照 / 选择照片' }}
            </button>
          </div>
          <div class="field">
            <label>语音记录</label>
            <button type="button" class="voice-btn" :class="{ recording }" @click="toggleVoice">
              <Mic :size="16" />
              {{ recording ? `录音中 ${voiceSeconds}s，点击结束` : voiceNote || '按住说话（模拟录音）' }}
            </button>
            <span class="bf-sub">演示环境仅记录时长与文字，不上传真实音频。</span>
          </div>
          <div class="field">
            <label>备注</label>
            <el-input v-model="note" type="textarea" :rows="3" placeholder="测试现象、异常说明" />
          </div>
        </section>

        <button type="button" class="submit-btn" :disabled="submitting" @click="submitRecord">
          {{ submitting ? '提交中…' : '提交测试记录' }}
        </button>
      </template>
    </template>

    <template v-else>
      <section class="m-card">
        <div class="field">
          <label>所属项目</label>
          <el-select v-model="defectProject" size="large" style="width: 100%" @update:model-value="onDefectProject">
            <el-option v-for="project in db.projects" :key="project.id" :label="project.name" :value="project.id" />
          </el-select>
        </div>
        <div class="field">
          <label>产品</label>
          <el-select v-model="defectProduct" size="large" style="width: 100%">
            <el-option v-for="product in defectProducts" :key="product.id" :label="product.name" :value="product.id" />
          </el-select>
        </div>
        <div class="field">
          <label>异常标题</label>
          <el-input v-model="defectTitle" size="large" placeholder="例如：满载输出纹波超标" />
        </div>
        <div class="field">
          <label>严重程度</label>
          <div class="sev-row">
            <button
              v-for="(row, key) in severity.map"
              :key="key"
              type="button"
              class="sev"
              :class="{ active: defectSeverity === key }"
              @click="defectSeverity = key"
            >
              {{ row.label }}
            </button>
          </div>
        </div>
        <div class="field">
          <label>异常描述</label>
          <el-input v-model="defectDesc" type="textarea" :rows="3" placeholder="现象、复现条件、测量数据" />
        </div>
        <div class="field">
          <label>现场照片</label>
          <input ref="defectPhotoInput" type="file" accept="image/*" capture="environment" class="hidden" @change="onDefectPhoto" />
          <button type="button" class="upload-btn" @click="defectPhotoInput?.click()">
            <Camera :size="16" /> {{ defectPhotoName || '拍照 / 选择照片' }}
          </button>
        </div>
      </section>
      <button type="button" class="submit-btn danger" @click="submitDefect">提交异常</button>
    </template>

    <div class="tip">
      <Info :size="13" />
      移动端为响应式 Web 演示，不是已发布的微信小程序原生包。相机与录音能力在真实小程序中由 wx.chooseMedia / RecorderManager 提供。
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Camera, Info, Mic } from 'lucide-vue-next'
import type { Defect, Execution, RunResult, Severity, TestCase, TestStep } from '@/types'
import { db } from '@/services/db'
import { executionService, judgeValue } from '@/services/executionService'
import { defectService } from '@/services/defectService'
import { useAppStore } from '@/stores/app'
import EmptyState from '@/components/common/EmptyState.vue'
import { severity } from '@/utils/format'

const route = useRoute()
const router = useRouter()
const app = useAppStore()

const mode = ref<'record' | 'defect'>(route.query.mode === 'defect' ? 'defect' : 'record')
const switchMode = (next: 'record' | 'defect') => {
  mode.value = next
  router.replace({ query: next === 'defect' ? { mode: 'defect' } : {} })
}

const runningPlans = computed(() =>
  db.plans
    .filter((p) => ['running', 'pending', 'review', 'completed'].includes(p.status))
    .slice()
    .sort((a, b) => Number(b.status === 'running') - Number(a.status === 'running')),
)
const planId = ref(runningPlans.value[0]?.id ?? '')
const caseId = ref('')
const conditions = ref('48V 输入 / 12V 输出 / 50A 满载')
const values = reactive<Record<string, number | null>>({})
const note = ref('')
const submitting = ref(false)
const createdRun = ref<Execution | null>(null)

const currentCase = computed<TestCase | undefined>(() => db.cases.find((c) => c.id === caseId.value))
const planCases = computed<TestCase[]>(() => {
  const plan = db.plans.find((p) => p.id === planId.value)
  if (!plan) return []
  return plan.caseIds.map((id) => db.cases.find((c) => c.id === id)).filter(Boolean) as TestCase[]
})
const paramSteps = computed<TestStep[]>(() => currentCase.value?.steps.filter((s) => s.param) ?? [])

const onPlanChange = () => {
  caseId.value = planCases.value[0]?.id ?? ''
  onCaseChange()
}

const onCaseChange = () => {
  paramSteps.value.forEach((step) => {
    values[step.id] = null
  })
}

onPlanChange()

const judge = (step: TestStep): RunResult =>
  judgeValue(values[step.id] ?? null, step.param?.min ?? null, step.param?.max ?? null)

const overall = computed<RunResult>(() => {
  const verdicts = paramSteps.value.map((step) => judge(step))
  if (verdicts.some((v) => v === 'FAIL')) return 'FAIL'
  if (verdicts.length > 0 && verdicts.every((v) => v === 'PENDING')) return 'PENDING'
  return 'PASS'
})

const limitText = (param?: TestStep['param']) => {
  if (!param) return ''
  if (param.min != null && param.max != null) return `${param.min}~${param.max}${param.unit}`
  if (param.max != null) return `≤${param.max}${param.unit}`
  if (param.min != null) return `≥${param.min}${param.unit}`
  return param.unit
}

const photoInput = ref<HTMLInputElement | null>(null)
const photoName = ref('')
const onPhoto = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  photoName.value = file ? file.name : ''
}

const recording = ref(false)
const voiceSeconds = ref(0)
const voiceNote = ref('')
let voiceTimer: number | null = null

const toggleVoice = () => {
  if (recording.value) {
    recording.value = false
    if (voiceTimer) window.clearInterval(voiceTimer)
    voiceTimer = null
    voiceNote.value = `语音记录 ${voiceSeconds.value}s（模拟）`
    note.value = `${note.value}${note.value ? '\n' : ''}[语音记录 ${voiceSeconds.value}s]`
    return
  }
  voiceSeconds.value = 0
  recording.value = true
  voiceTimer = window.setInterval(() => {
    voiceSeconds.value += 1
    if (voiceSeconds.value >= 60) toggleVoice()
  }, 1000)
}

onBeforeUnmount(() => {
  if (voiceTimer) window.clearInterval(voiceTimer)
})

const submitRecord = () => {
  if (!caseId.value) {
    ElMessage.warning('请选择测试用例')
    return
  }
  if (overall.value === 'PENDING') {
    ElMessage.warning('请至少录入一项测量值')
    return
  }
  submitting.value = true
  try {
    const run = executionService.create({
      planId: planId.value,
      caseId: caseId.value,
      testerId: app.currentUser.id,
      deviceIds: db.plans.find((p) => p.id === planId.value)?.deviceIds ?? [],
      environment: { temperature: 25, humidity: 50, inputVoltage: 48, load: 50, note: '移动端现场录入' },
      conditions: conditions.value,
      note: `${note.value}${photoName.value ? `\n照片：${photoName.value}` : ''}`,
    })
    paramSteps.value.forEach((step) => {
      const measurement = run.measurements.find((m) => m.id === `MS-${step.id}`)
      if (measurement) executionService.setMeasurement(run.id, measurement.id, values[step.id] ?? null)
    })
    executionService.finish(run.id)
    createdRun.value = db.executions.find((e) => e.id === run.id) ?? run
    ElMessage.success(`测试记录 ${run.code} 已提交`)

    if (createdRun.value.result === 'FAIL') {
      const draft = executionService.defectDraft(run.id)
      if (draft) {
        defectService.create({
          title: String(draft.title),
          description: String(draft.description),
          severity: 'major',
          priority: (draft.priority as 'P0' | 'P1' | 'P2' | 'P3') ?? 'P1',
          projectId: String(draft.projectId),
          productId: String(draft.productId),
          hardwareVersionId: draft.hardwareVersionId ? String(draft.hardwareVersionId) : undefined,
          executionId: run.id,
          caseId: run.caseId,
          steps: String(draft.steps),
          evidence: [],
          ownerId: app.currentUser.id,
        })
        ElMessage.info('已根据失败记录自动创建缺陷草稿')
      }
    }
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message)
  } finally {
    submitting.value = false
  }
}

const resetRecord = () => {
  createdRun.value = null
  note.value = ''
  photoName.value = ''
  voiceNote.value = ''
  onCaseChange()
}

const caseName = (id: string) => db.cases.find((c) => c.id === id)?.name ?? id
const versionLabel = (id?: string) => (id ? db.versions.find((v) => v.id === id)?.version ?? id : '—')

const defectProject = ref(db.projects[0]?.id ?? '')
const defectProduct = ref(db.products[0]?.id ?? '')
const defectTitle = ref('')
const defectDesc = ref('')
const defectSeverity = ref<Severity>('major')
const defectPhotoName = ref('')
const defectPhotoInput = ref<HTMLInputElement | null>(null)

const defectProducts = computed(() => db.products.filter((p) => p.projectId === defectProject.value))

const onDefectProject = () => {
  defectProduct.value = defectProducts.value[0]?.id ?? ''
}

const onDefectPhoto = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  defectPhotoName.value = file ? file.name : ''
}

const submitDefect = () => {
  if (!defectTitle.value.trim() || !defectDesc.value.trim()) {
    ElMessage.warning('请填写异常标题与描述')
    return
  }
  const created: Defect = defectService.create({
    title: defectTitle.value.trim(),
    description: `${defectDesc.value.trim()}${defectPhotoName.value ? `\n现场照片：${defectPhotoName.value}` : ''}`,
    severity: defectSeverity.value,
    priority: 'P1',
    projectId: defectProject.value,
    productId: defectProduct.value,
    steps: '移动端现场上报，复现步骤待补充。',
    evidence: [],
    ownerId: app.currentUser.id,
  })
  ElMessage.success(`缺陷 ${created.code} 已提交`)
  defectTitle.value = ''
  defectDesc.value = ''
  router.push(`/defects/${created.id}`)
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

.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.field label {
  font-size: 11.5px;
  color: var(--bf-ink-3);
}

.m-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.m-card-head h2 {
  font-size: 12.8px;
  font-weight: 620;
}

.badge {
  font-size: 10.5px;
  border-radius: 10px;
  padding: 1px 8px;
  background: #eef2f7;
  color: #5a6a7e;
}

.badge.pass {
  background: #e7f5ef;
  color: #12664c;
}

.badge.fail {
  background: #fdecea;
  color: #a12319;
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
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
}

.m-title strong {
  font-weight: 550;
}

.m-title span {
  color: var(--bf-ink-3);
  font-family: var(--bf-mono);
  font-size: 10.5px;
}

.m-input {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 5px;
}

.unit {
  font-size: 11.5px;
  color: var(--bf-ink-3);
  width: 34px;
}

.verdict {
  font-size: 10.5px;
  font-weight: 600;
  padding: 1px 6px;
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

.upload-btn,
.voice-btn {
  display: flex;
  align-items: center;
  gap: 7px;
  border: 1px dashed var(--bf-border-strong);
  background: var(--bf-surface-2);
  border-radius: 6px;
  padding: 10px;
  font-size: 12px;
  color: var(--bf-ink-2);
  font-family: inherit;
  text-align: left;
}

.voice-btn.recording {
  border-color: #b02a1f;
  background: #fdf1f0;
  color: #8f241b;
}

.hidden {
  display: none;
}

.submit-btn {
  border: none;
  background: var(--bf-primary);
  color: #fff;
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  box-shadow: 0 3px 10px rgba(30, 58, 95, 0.22);
}

.submit-btn:disabled {
  opacity: 0.6;
}

.submit-btn.danger {
  background: #a33a30;
}

.result-card {
  background: #fff;
  border: 1px solid var(--bf-border);
  border-left: 4px solid var(--bf-success);
  border-radius: 8px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.result-card.fail {
  border-left-color: var(--bf-danger);
}

.r-label {
  font-size: 10.5px;
  color: var(--bf-ink-3);
}

.result-card strong {
  font-size: 17px;
  font-weight: 650;
}

.result-card p {
  font-size: 11.5px;
  color: var(--bf-ink-3);
}

.r-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.r-btn {
  flex: 1;
  text-align: center;
  border: 1px solid var(--bf-primary);
  color: var(--bf-primary);
  border-radius: 5px;
  padding: 7px;
  font-size: 12px;
  background: #fff;
  font-family: inherit;
}

.r-btn.ghost {
  border-color: var(--bf-border-strong);
  color: var(--bf-ink-2);
}

.sev-row {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}

.sev {
  border: 1px solid var(--bf-border);
  background: #fff;
  border-radius: 4px;
  padding: 5px 9px;
  font-size: 11.5px;
  color: var(--bf-ink-2);
  font-family: inherit;
}

.sev.active {
  border-color: var(--bf-primary);
  background: var(--bf-primary-soft);
  color: var(--bf-primary);
  font-weight: 600;
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
