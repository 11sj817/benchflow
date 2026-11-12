<template>
  <div v-if="run" class="m-detail">
    <button type="button" class="back" @click="router.push('/mobile/tasks')"><ArrowLeft :size="16" /> 任务与执行</button>

    <header class="m-hero" :class="run.result.toLowerCase()">
      <div class="code-row">
        <span class="mono">{{ run.code }}</span>
        <span class="result-badge" :class="run.result.toLowerCase()">{{ run.result }}</span>
      </div>
      <h1>{{ caseName(run.caseId) }}</h1>
      <p>{{ projectName(run.projectId) }} · {{ versionLabel(run.hardwareVersionId) }}<span v-if="run.firmwareVersionId"> / {{ versionLabel(run.firmwareVersionId) }}</span></p>
      <div class="meta">
        <span>{{ memberName(run.testerId) }}</span>
        <span>{{ fmtDateTime(run.startedAt) }}</span>
        <span v-if="run.planId">{{ run.planId }}</span>
      </div>
    </header>

    <div class="stat-grid">
      <div><b class="ok">{{ passCount }}</b><span>PASS</span></div>
      <div><b class="bad">{{ failCount }}</b><span>FAIL</span></div>
      <div><b>{{ pendingCount }}</b><span>待录入</span></div>
      <div><b>{{ run.measurements.length }}</b><span>测量项</span></div>
    </div>

    <section class="m-card">
      <header class="m-card-head"><h2>测试步骤与实测值</h2><span>阈值来自用例</span></header>
      <div class="list">
        <div v-for="(step, index) in steps" :key="step.id" class="step">
          <div class="step-head">
            <span class="step-index">{{ index + 1 }}</span>
            <div class="step-title">
              <strong>{{ step.name }}</strong>
              <span>{{ step.action }}</span>
            </div>
            <span class="mini-pill" :class="stepVerdict(step).toLowerCase()">{{ stepVerdict(step) }}</span>
          </div>
          <div v-if="step.param" class="measure">
            <span>{{ step.param.name }}</span>
            <b :class="{ danger: stepVerdict(step) === 'FAIL' }">{{ measurementOf(step)?.value ?? '—' }} {{ step.param.unit }}</b>
            <span class="limit">{{ limitText(step.param) }}</span>
          </div>
          <div v-else class="measure">
            <span>人工判定</span>
            <b>{{ stepResultOf(step.id) }}</b>
          </div>
        </div>
        <EmptyState v-if="steps.length === 0" text="用例没有步骤" />
      </div>
    </section>

    <section class="m-card">
      <header class="m-card-head"><h2>环境与工况</h2></header>
      <div class="env">
        <div><span>温度</span><b>{{ run.environment.temperature ?? '—' }} ℃</b></div>
        <div><span>湿度</span><b>{{ run.environment.humidity ?? '—' }} %RH</b></div>
        <div><span>输入电压</span><b>{{ run.environment.inputVoltage ?? '—' }} V</b></div>
        <div><span>负载</span><b>{{ run.environment.load ?? '—' }} A</b></div>
      </div>
      <div class="condition">{{ run.conditions || '未记录工况' }}</div>
      <div v-if="run.note" class="note">{{ run.note }}</div>
    </section>

    <section v-if="run.attachments.length" class="m-card">
      <header class="m-card-head"><h2>附件</h2><span>{{ run.attachments.length }} 个</span></header>
      <div class="list">
        <div v-for="att in run.attachments" :key="att.id" class="att">
          <span class="file-kind">{{ fileKind.get(att.kind).label }}</span>
          <span class="att-name">{{ att.name }}</span>
          <span class="sub">{{ fmtBytes(att.size) }}</span>
        </div>
      </div>
    </section>

    <section v-if="run.defectIds.length" class="m-card">
      <header class="m-card-head"><h2>关联缺陷</h2></header>
      <div class="list">
        <router-link v-for="code in run.defectIds" :key="code" :to="`/mobile/defects/${code}`" class="row">
          <span class="dot danger" />
          <span class="row-main"><strong>{{ code }}</strong><span>{{ defectTitle(code) }}</span></span>
          <ChevronRight :size="14" />
        </router-link>
      </div>
    </section>

    <div class="sticky-actions">
      <button v-if="run.result === 'FAIL'" type="button" class="ghost" @click="createDefect">创建缺陷</button>
      <button type="button" class="primary" @click="retest">再测一次</button>
    </div>
  </div>

  <div v-else class="m-detail">
    <EmptyState text="执行记录不存在">
      <el-button size="small" @click="router.push('/mobile/tasks')">返回任务</el-button>
    </EmptyState>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, ChevronRight } from 'lucide-vue-next'
import type { Measurement, TestStep } from '@/types'
import { db } from '@/services/db'
import EmptyState from '@/components/common/EmptyState.vue'
import { evaluateExecution } from '@/utils/measurement'
import { fileKind, fmtBytes, fmtDateTime } from '@/utils/format'
import { saveTestContext } from '@/utils/testContext'

const route = useRoute()
const router = useRouter()

const run = computed(() => db.executions.find((row) => row.id === route.params.id))
const steps = computed<TestStep[]>(() => (run.value ? db.cases.find((item) => item.id === run.value!.caseId)?.steps ?? [] : []))
const evaluation = computed(() =>
  run.value
    ? evaluateExecution({ caseSteps: steps.value, measurements: run.value.measurements, stepResults: run.value.stepResults })
    : null,
)
const passCount = computed(() => evaluation.value?.passCount ?? 0)
const failCount = computed(() => evaluation.value?.failCount ?? 0)
const pendingCount = computed(() => evaluation.value?.pendingCount ?? 0)

const memberName = (id: string) => db.members.find((member) => member.id === id)?.name ?? id
const projectName = (id?: string) => db.projects.find((project) => project.id === id)?.name ?? '未关联项目'
const caseName = (id: string) => db.cases.find((item) => item.id === id)?.name ?? id
const versionLabel = (id?: string) => (id ? db.versions.find((version) => version.id === id)?.version ?? id : '—')
const defectTitle = (code: string) => db.defects.find((defect) => defect.code === code)?.title ?? code

const measurementOf = (step: TestStep): Measurement | undefined =>
  run.value?.measurements.find((measurement) => measurement.id === `MS-${step.id}`)
const stepResultOf = (stepId: string) => run.value?.stepResults.find((result) => result.stepId === stepId)?.result ?? 'PENDING'
const stepVerdict = (step: TestStep) => {
  if (step.param) return measurementOf(step)?.result ?? 'PENDING'
  return stepResultOf(step.id)
}
const limitText = (param: TestStep['param']) => {
  if (!param) return ''
  if (param.min != null && param.max != null) return `${param.min}~${param.max} ${param.unit}`
  if (param.max != null) return `≤${param.max} ${param.unit}`
  if (param.min != null) return `≥${param.min} ${param.unit}`
  return param.unit
}

const createDefect = () => {
  if (!run.value) return
  router.push(`/mobile/record?mode=defect&execution=${run.value.id}`)
}

const retest = () => {
  if (!run.value) return
  saveTestContext({
    projectId: run.value.projectId,
    productId: run.value.productId,
    hardwareVersionId: run.value.hardwareVersionId,
    firmwareVersionId: run.value.firmwareVersionId,
    planId: run.value.planId,
    caseId: run.value.caseId,
    deviceId: run.value.deviceIds[0],
    source: 'manual',
  })
  router.push({
    path: '/mobile/record',
    query: {
      planId: run.value.planId,
      caseId: run.value.caseId,
      projectId: run.value.projectId,
      productId: run.value.productId,
      hardwareVersionId: run.value.hardwareVersionId,
      ...(run.value.firmwareVersionId ? { firmwareVersionId: run.value.firmwareVersionId } : {}),
      ...(run.value.deviceIds[0] ? { deviceId: run.value.deviceIds[0] } : {}),
      source: 'manual',
    },
  })
}
</script>

<style scoped>
.m-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 140px;
}

.back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: transparent;
  color: var(--bf-ink-3);
  font-family: inherit;
  font-size: 11.5px;
  padding: 0;
  min-height: 32px;
  align-self: flex-start;
}

.m-hero {
  background: #fff;
  border: 1px solid var(--bf-border);
  border-left: 4px solid var(--bf-border-strong);
  border-radius: 8px;
  padding: 13px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.m-hero.pass {
  border-left-color: #157a5b;
}

.m-hero.fail {
  border-left-color: #b02a1f;
}

.code-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.code-row .mono {
  font-size: 10.5px;
  color: var(--bf-primary);
}

.result-badge {
  font-size: 10px;
  font-weight: 700;
  border-radius: 9px;
  padding: 1px 8px;
  background: #eef2f7;
  color: #5a6a7e;
}

.result-badge.pass {
  background: #e7f5ef;
  color: #12664c;
}

.result-badge.fail {
  background: #fdecea;
  color: #a12319;
}

.m-hero h1 {
  font-size: 17px;
  font-weight: 650;
  line-height: 1.35;
}

.m-hero p {
  font-size: 11px;
  color: var(--bf-ink-2);
}

.meta {
  display: flex;
  gap: 9px;
  flex-wrap: wrap;
  font-size: 10.2px;
  color: var(--bf-ink-3);
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  background: #fff;
  border: 1px solid var(--bf-border);
  border-radius: 8px;
  padding: 9px 0;
}

.stat-grid > div {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  border-right: 1px solid var(--bf-border);
}

.stat-grid > div:last-child {
  border-right: none;
}

.stat-grid b {
  font-size: 16px;
  font-weight: 650;
}

.stat-grid .ok {
  color: #157a5b;
}

.stat-grid .bad {
  color: #b02a1f;
}

.stat-grid span {
  font-size: 9.5px;
  color: var(--bf-ink-3);
}

.m-card {
  background: #fff;
  border: 1px solid var(--bf-border);
  border-radius: 8px;
  overflow: hidden;
}

.m-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 11px 12px;
  border-bottom: 1px solid var(--bf-border);
}

.m-card-head h2 {
  font-size: 12.7px;
  font-weight: 620;
}

.m-card-head > span {
  font-size: 10.2px;
  color: var(--bf-ink-3);
}

.list {
  display: flex;
  flex-direction: column;
}

.step {
  padding: 11px 12px;
  border-bottom: 1px solid var(--bf-border);
}

.step:last-child {
  border-bottom: none;
}

.step-head {
  display: flex;
  align-items: flex-start;
  gap: 7px;
}

.step-index {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--bf-surface-3);
  color: var(--bf-ink-2);
  font-size: 10px;
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
  font-size: 12.2px;
  font-weight: 600;
}

.step-title span {
  font-size: 10.2px;
  color: var(--bf-ink-3);
  line-height: 1.45;
}

.mini-pill {
  font-size: 9.5px;
  border-radius: 9px;
  padding: 1px 6px;
  background: #eef2f7;
  color: #5a6a7e;
  flex: none;
}

.mini-pill.pass {
  background: #e7f5ef;
  color: #12664c;
}

.mini-pill.fail {
  background: #fdecea;
  color: #a12319;
}

.measure {
  margin-left: 27px;
  margin-top: 5px;
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 11px;
  color: var(--bf-ink-3);
  flex-wrap: wrap;
}

.measure b {
  font-size: 13px;
  color: var(--bf-ink);
}

.measure b.danger {
  color: var(--bf-danger);
}

.limit {
  font-family: var(--bf-mono);
  font-size: 10px;
}

.env {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 7px;
  padding: 11px 12px 6px;
}

.env div {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--bf-ink-3);
}

.env b {
  color: var(--bf-ink);
  font-weight: 500;
}

.condition,
.note {
  margin: 0 12px 10px;
  padding: 7px 9px;
  background: var(--bf-surface-2);
  border-radius: 5px;
  font-size: 10.8px;
  color: var(--bf-ink-2);
  line-height: 1.5;
}

.note {
  margin-top: 0;
}

.att {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-bottom: 1px solid var(--bf-border);
  font-size: 11px;
}

.att:last-child {
  border-bottom: none;
}

.file-kind {
  font-size: 9.5px;
  background: var(--bf-surface-3);
  color: var(--bf-ink-3);
  border-radius: 3px;
  padding: 1px 5px;
}

.att-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sub {
  font-size: 10px;
  color: var(--bf-ink-3);
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--bf-border);
  color: var(--bf-ink);
  text-decoration: none;
}

.row:last-child {
  border-bottom: none;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--bf-border-strong);
}

.dot.danger {
  background: #b02a1f;
}

.row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.row-main strong {
  font-size: 12px;
}

.row-main span {
  font-size: 10.2px;
  color: var(--bf-ink-3);
}

.sticky-actions {
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

.sticky-actions button {
  flex: 1;
  min-height: 44px;
  border-radius: 6px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 550;
}

.sticky-actions .ghost {
  border: 1px solid var(--bf-border);
  background: #fff;
  color: var(--bf-ink-2);
}

.sticky-actions .primary {
  border: none;
  background: var(--bf-primary);
  color: #fff;
}
</style>
