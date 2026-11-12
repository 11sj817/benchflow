<template>
  <div class="m-page">
    <header class="m-head">
      <h1>扫码进入</h1>
      <p>项目 / 产品 / 设备 / 计划 / 执行二维码</p>
    </header>

    <div class="scan-box">
      <div class="corners"><span /><span /><span /><span /></div>
      <ScanLine :size="40" class="scan-icon" />
      <p>将二维码放入框内</p>
      <span class="sim-label">演示环境：无摄像头调用，使用下方模拟或手动输入</span>
      <div class="sim-row">
        <button v-for="type in simTypes" :key="type.key" type="button" @click="simulate(type.key)">{{ type.label }}</button>
      </div>
    </div>

    <section class="m-card">
      <header class="m-card-head"><h2>手动输入编号或链接</h2></header>
      <div class="manual">
        <el-input v-model="code" size="large" placeholder="如 P-2401 / DEV-001 / TP-2401-02" @keyup.enter="lookup" />
        <el-button size="large" type="primary" @click="lookup">识别</el-button>
      </div>
      <div v-if="message" class="msg" :class="{ error: !!error }">{{ message }}</div>
    </section>

    <template v-if="context">
      <section v-if="context.type === 'project' && project" class="m-card">
        <header class="m-card-head">
          <h2>{{ project.name }}</h2>
          <StatusPill :label="projectStatus.get(project.status).label" :tone="projectStatus.get(project.status).tone" />
        </header>
        <div class="entity">
          <div class="e-row"><span>项目编号</span><b class="mono">{{ project.code }}</b></div>
          <div class="e-row"><span>负责人</span><b>{{ memberName(project.ownerId) }}</b></div>
          <div class="e-row"><span>进行中计划</span><b>{{ projectPlans.length }} 个</b></div>
          <div class="e-row"><span>未关闭缺陷</span><b>{{ projectOpenDefects }}</b></div>
        </div>
        <div v-if="projectPlans[0]" class="focus">
          <span class="focus-label">当前计划</span>
          <strong>{{ projectPlans[0].name }}</strong>
          <span>{{ projectPlans[0].caseIds.length }} 个用例 · {{ versionLabel(projectPlans[0].hardwareVersionId) }}</span>
        </div>
        <div class="scan-actions">
          <button type="button" class="ghost" @click="router.push(`/mobile/projects/${project.id}`)">项目详情</button>
          <button type="button" class="primary" @click="startFromProject">开始测试</button>
        </div>
      </section>

      <section v-if="context.type === 'product' && product" class="m-card">
        <header class="m-card-head"><h2>{{ product.name }}</h2><span class="mono">{{ product.code }}</span></header>
        <div class="entity">
          <div class="e-row"><span>所属项目</span><b>{{ projectName(product.projectId) }}</b></div>
          <div class="e-row"><span>硬件版本</span><b>{{ hardwareVersions.map((v) => v.version).join('、') || '—' }}</b></div>
          <div class="e-row"><span>关联用例</span><b>{{ productCases.length }} 条</b></div>
        </div>
        <div class="scan-actions">
          <button type="button" class="ghost" @click="router.push(`/mobile/projects/${product.projectId}`)">项目详情</button>
          <button type="button" class="primary" @click="startFromProduct">创建测试记录</button>
        </div>
      </section>

      <section v-if="context.type === 'device' && device" class="m-card">
        <header class="m-card-head"><h2>{{ device.name }}</h2><span class="cal" :class="calibration.state">{{ calibration.label }}</span></header>
        <div class="entity">
          <div class="e-row"><span>设备编号</span><b class="mono">{{ device.code }}</b></div>
          <div class="e-row"><span>型号 / 序列号</span><b>{{ device.model }} · {{ device.serial }}</b></div>
          <div class="e-row"><span>工位</span><b>{{ device.station }}</b></div>
          <div class="e-row"><span>校准到期</span><b>{{ device.calibrationDue }}</b></div>
          <div class="e-row"><span>关联项目</span><b>{{ deviceProject?.name ?? '暂无关联' }}</b></div>
        </div>
        <div v-if="deviceLastRun" class="focus">
          <span class="focus-label">最近使用</span>
          <strong>{{ deviceLastRun.code }} · {{ caseName(deviceLastRun.caseId) }}</strong>
          <span>{{ deviceLastRun.result }} · {{ fromNow(deviceLastRun.startedAt) }}</span>
        </div>
        <div class="scan-actions">
          <button type="button" class="ghost" @click="router.push(`/mobile/projects/${deviceProject?.id ?? ''}`)">项目</button>
          <button type="button" class="primary" @click="startFromDevice">用该设备测试</button>
        </div>
      </section>

      <section v-if="context.type === 'plan' && plan" class="m-card">
        <header class="m-card-head"><h2>{{ plan.name }}</h2><StatusPill :label="planStatus.get(plan.status).label" :tone="planStatus.get(plan.status).tone" /></header>
        <div class="entity">
          <div class="e-row"><span>计划编号</span><b class="mono">{{ plan.code }}</b></div>
          <div class="e-row"><span>项目</span><b>{{ projectName(plan.projectId) }}</b></div>
          <div class="e-row"><span>产品版本</span><b>{{ versionLabel(plan.hardwareVersionId) }}</b></div>
          <div class="e-row"><span>用例</span><b>{{ plan.caseIds.length }} 条</b></div>
        </div>
        <div class="scan-actions">
          <button type="button" class="ghost" @click="router.push(`/mobile/projects/${plan.projectId}`)">项目详情</button>
          <button type="button" class="primary" @click="startFromPlan(plan)">开始测试</button>
        </div>
      </section>

      <section v-if="context.type === 'execution' && execution" class="m-card">
        <header class="m-card-head"><h2>{{ caseName(execution.caseId) }}</h2><span class="result" :class="execution.result.toLowerCase()">{{ execution.result }}</span></header>
        <div class="entity">
          <div class="e-row"><span>执行编号</span><b class="mono">{{ execution.code }}</b></div>
          <div class="e-row"><span>产品版本</span><b>{{ versionLabel(execution.hardwareVersionId) }}</b></div>
          <div class="e-row"><span>执行人</span><b>{{ memberName(execution.testerId) }}</b></div>
          <div class="e-row"><span>执行时间</span><b>{{ fmtDateTime(execution.startedAt) }}</b></div>
        </div>
        <div class="scan-actions">
          <button type="button" class="ghost" @click="startFromExecution">再测一次</button>
          <button type="button" class="primary" @click="router.push(`/mobile/executions/${execution.id}`)">查看执行详情</button>
        </div>
      </section>

      <section v-if="context.type === 'report' && report" class="m-card">
        <header class="m-card-head"><h2>{{ report.title }}</h2><span class="mono">{{ report.code }}</span></header>
        <div class="scan-actions">
          <button type="button" class="primary" @click="router.push(`/mobile/reports/${report.id}`)">查看报告</button>
        </div>
      </section>
    </template>

    <div class="tip">
      <Info :size="13" />
      真实微信小程序使用 wx.scanCode 获取上述内容；扫码后会携带 projectId、productId、planId、deviceId、versionId 进入测试记录，无需重复选择。
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Info, ScanLine } from 'lucide-vue-next'
import type { Project, TestPlan } from '@/types'
import { db } from '@/services/db'
import { deviceService } from '@/services/assetService'
import StatusPill from '@/components/common/StatusPill.vue'
import {
  fmtDateTime,
  fromNow,
  planStatus,
  projectStatus,
} from '@/utils/format'
import { buildScanPayload, parseScanPayload, SCAN_TYPE_LABEL, type ScanContext, type ScanTargetType } from '@/utils/scanContext'
import { saveTestContext } from '@/utils/testContext'

const router = useRouter()

const code = ref('')
const context = ref<ScanContext | null>(null)
const message = ref('')
const error = ref(false)

const simTypes: { key: ScanTargetType; label: string }[] = [
  { key: 'project', label: '项目' },
  { key: 'product', label: '产品' },
  { key: 'device', label: '设备' },
  { key: 'plan', label: '计划' },
  { key: 'execution', label: '执行' },
]

const project = computed(() => (context.value?.type === 'project' ? db.projects.find((row) => row.id === context.value!.id) : undefined))
const product = computed(() => (context.value?.type === 'product' ? db.products.find((row) => row.id === context.value!.id) : undefined))
const device = computed(() => (context.value?.type === 'device' ? db.devices.find((row) => row.id === context.value!.id) : undefined))
const plan = computed(() => (context.value?.type === 'plan' ? db.plans.find((row) => row.id === context.value!.id) : undefined))
const execution = computed(() => (context.value?.type === 'execution' ? db.executions.find((row) => row.id === context.value!.id) : undefined))
const report = computed(() => (context.value?.type === 'report' ? db.reports.find((row) => row.id === context.value!.id) : undefined))

const projectPlans = computed<TestPlan[]>(() =>
  project.value ? db.plans.filter((row) => row.projectId === project.value!.id && ['running', 'pending'].includes(row.status)) : [],
)
const projectOpenDefects = computed(() =>
  project.value ? db.defects.filter((defect) => defect.projectId === project.value!.id && defect.status !== 'closed').length : 0,
)
const hardwareVersions = computed(() => (product.value ? db.versions.filter((version) => version.productId === product.value!.id && version.kind === 'hardware') : []))
const productCases = computed(() => (product.value ? db.cases.filter((item) => item.productIds.includes(product.value!.id)) : []))

const deviceProject = computed<Project | undefined>(() => {
  if (!device.value) return undefined
  const run = db.executions.find((row) => row.deviceIds.includes(device.value!.id))
  return run ? db.projects.find((row) => row.id === run.projectId) : db.projects[0]
})
const deviceLastRun = computed(() => (device.value ? db.executions.filter((row) => row.deviceIds.includes(device.value!.id)).sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))[0] : undefined))
const calibration = computed(() => {
  if (!device.value) return { state: 'valid', label: '' }
  const state = deviceService.calibrationState(device.value)
  return { state, label: state === 'expired' ? '校准已过期' : state === 'due_soon' ? '校准即将到期' : '校准有效' }
})

const memberName = (id: string) => db.members.find((member) => member.id === id)?.name ?? id
const projectName = (id: string) => db.projects.find((row) => row.id === id)?.name ?? id
const caseName = (id: string) => db.cases.find((item) => item.id === id)?.name ?? id
const versionLabel = (id?: string) => (id ? db.versions.find((version) => version.id === id)?.version ?? id : '—')

const recognize = (raw: string) => {
  const parsed = parseScanPayload(raw)
  if (!parsed) {
    context.value = null
    error.value = true
    message.value = '无法识别二维码内容，请检查编号或链接'
    return
  }
  const exists =
    (parsed.type === 'project' && db.projects.some((row) => row.id === parsed.id)) ||
    (parsed.type === 'product' && db.products.some((row) => row.id === parsed.id)) ||
    (parsed.type === 'device' && db.devices.some((row) => row.id === parsed.id)) ||
    (parsed.type === 'plan' && db.plans.some((row) => row.id === parsed.id)) ||
    (parsed.type === 'execution' && db.executions.some((row) => row.id === parsed.id)) ||
    (parsed.type === 'report' && db.reports.some((row) => row.id === parsed.id))
  if (!exists) {
    context.value = parsed
    error.value = true
    message.value = `识别为${SCAN_TYPE_LABEL[parsed.type]} ${parsed.id}，但演示数据中不存在该编号`
    return
  }
  context.value = parsed
  code.value = parsed.id
  error.value = false
  message.value = `已识别：${SCAN_TYPE_LABEL[parsed.type]} ${parsed.id}`
}

const lookup = () => recognize(code.value.trim())

const simulate = (type: ScanTargetType) => {
  if (type === 'project') recognize(buildScanPayload('project', db.projects[0]?.id ?? 'P-2401'))
  else if (type === 'product') recognize(buildScanPayload('product', db.products[0]?.id ?? 'PRD-100'))
  else if (type === 'device') recognize(buildScanPayload('device', db.devices[0]?.id ?? 'DEV-001'))
  else if (type === 'plan') recognize(buildScanPayload('plan', db.plans.find((row) => row.status === 'running')?.id ?? db.plans[0]?.id ?? 'TP-2401-02'))
  else if (type === 'execution') recognize(buildScanPayload('execution', db.executions[0]?.id ?? 'RUN-0017'))
}

const goRecord = (contextValue: {
  projectId?: string
  productId?: string
  hardwareVersionId?: string
  firmwareVersionId?: string
  planId?: string
  caseId?: string
  deviceId?: string
}) => {
  saveTestContext({ ...contextValue, source: 'scan' })
  router.push({
    path: '/mobile/record',
    query: Object.fromEntries(Object.entries(contextValue).filter(([, value]) => typeof value === 'string') as [string, string][]),
  })
}

const startFromProject = () => {
  if (!project.value) return
  const currentPlan = projectPlans.value[0]
  goRecord({
    projectId: project.value.id,
    planId: currentPlan?.id,
    productId: currentPlan?.productId,
    hardwareVersionId: currentPlan?.hardwareVersionId,
    caseId: currentPlan?.caseIds[0],
  })
}

const startFromProduct = () => {
  if (!product.value) return
  const currentPlan = db.plans.find((row) => row.productId === product.value!.id && ['running', 'pending'].includes(row.status))
  goRecord({
    projectId: product.value.projectId,
    productId: product.value.id,
    hardwareVersionId: hardwareVersions.value[0]?.id,
    planId: currentPlan?.id,
    caseId: currentPlan?.caseIds[0],
  })
}

const startFromDevice = () => {
  if (!device.value || !deviceProject.value) return
  const currentPlan = db.plans.find((row) => row.projectId === deviceProject.value!.id && ['running', 'pending'].includes(row.status))
  goRecord({
    projectId: deviceProject.value.id,
    deviceId: device.value.id,
    planId: currentPlan?.id,
    productId: currentPlan?.productId,
    hardwareVersionId: currentPlan?.hardwareVersionId,
    caseId: currentPlan?.caseIds[0],
  })
}

const startFromPlan = (target: TestPlan) => {
  goRecord({
    projectId: target.projectId,
    productId: target.productId,
    hardwareVersionId: target.hardwareVersionId,
    firmwareVersionId: target.firmwareVersionId,
    planId: target.id,
    caseId: target.caseIds[0],
  })
}

const startFromExecution = () => {
  if (!execution.value) return
  goRecord({
    projectId: execution.value.projectId,
    productId: execution.value.productId,
    hardwareVersionId: execution.value.hardwareVersionId,
    firmwareVersionId: execution.value.firmwareVersionId,
    planId: execution.value.planId,
    caseId: execution.value.caseId,
    deviceId: execution.value.deviceIds[0],
  })
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

.scan-box {
  background: #14202e;
  border-radius: 10px;
  padding: 22px 16px 16px;
  color: #c9d6e3;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  position: relative;
}

.corners span {
  position: absolute;
  width: 20px;
  height: 20px;
  border: 2px solid #4aa08a;
}

.corners span:nth-child(1) { top: 14px; left: 14px; border-right: none; border-bottom: none; }
.corners span:nth-child(2) { top: 14px; right: 14px; border-left: none; border-bottom: none; }
.corners span:nth-child(3) { bottom: 14px; left: 14px; border-right: none; border-top: none; }
.corners span:nth-child(4) { bottom: 14px; right: 14px; border-left: none; border-top: none; }

.scan-icon {
  color: #7fa5c2;
}

.scan-box p {
  font-size: 12px;
}

.sim-label {
  font-size: 9.5px;
  color: #93a8bd;
  text-align: center;
}

.sim-row {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 4px;
}

.sim-row button {
  border: 1px solid #3b566e;
  background: #223449;
  color: #e3edf6;
  border-radius: 4px;
  padding: 5px 10px;
  font-size: 11px;
  font-family: inherit;
  min-height: 34px;
}

.m-card {
  background: #fff;
  border: 1px solid var(--bf-border);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.m-card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.m-card-head h2 {
  font-size: 13px;
  font-weight: 620;
  line-height: 1.4;
}

.m-card-head .mono {
  font-size: 10px;
  color: var(--bf-primary);
}

.manual {
  display: flex;
  gap: 8px;
}

.msg {
  font-size: 10.8px;
  color: var(--bf-ink-3);
  line-height: 1.5;
}

.msg.error {
  color: var(--bf-danger);
}

.entity {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.e-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 11.5px;
}

.e-row span {
  color: var(--bf-ink-3);
}

.e-row b {
  font-weight: 500;
  text-align: right;
}

.focus {
  background: var(--bf-surface-2);
  border: 1px solid var(--bf-border);
  border-radius: 6px;
  padding: 8px 9px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.focus-label {
  font-size: 9.5px;
  color: var(--bf-ink-3);
}

.focus strong {
  font-size: 12px;
}

.focus span {
  font-size: 10.2px;
  color: var(--bf-ink-3);
}

.cal {
  font-size: 9.5px;
  border-radius: 9px;
  padding: 1px 7px;
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

.result {
  font-size: 10px;
  font-weight: 700;
  border-radius: 9px;
  padding: 1px 7px;
  background: #eef2f7;
}

.result.pass { background: #e7f5ef; color: #12664c; }
.result.fail { background: #fdecea; color: #a12319; }

.scan-actions {
  display: flex;
  gap: 8px;
}

.scan-actions button {
  flex: 1;
  min-height: 44px;
  border-radius: 6px;
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 550;
}

.scan-actions .ghost {
  border: 1px solid var(--bf-border);
  background: #fff;
  color: var(--bf-ink-2);
}

.scan-actions .primary {
  border: none;
  background: var(--bf-primary);
  color: #fff;
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
