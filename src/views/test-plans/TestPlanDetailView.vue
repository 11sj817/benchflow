<template>
  <div v-if="plan" class="bf-page">
    <div class="bf-page-header">
      <div>
        <button class="back" type="button" @click="router.push('/test-plans')"><ArrowLeft :size="15" /> 测试计划</button>
        <h1>
          <span class="bf-table-code">{{ plan.code }}</span>
          {{ plan.name }}
          <StatusPill :label="planStatus.get(plan.status).label" :tone="planStatus.get(plan.status).tone" />
        </h1>
        <p class="sub">
          {{ projectName(plan.projectId) }} · {{ productName(plan.productId) }} ·
          {{ versionLabel(plan.hardwareVersionId) }} / {{ versionLabel(plan.firmwareVersionId) }} ·
          <span class="num">{{ fmtDate(plan.startDate) }} → {{ fmtDate(plan.endDate) }}</span>
        </p>
      </div>
      <div class="bf-header-actions">
        <el-button v-if="app.can('edit')" size="small" @click="reportOpen = true"><FileText :size="14" /> 生成报告</el-button>
        <el-button v-if="app.can('execute')" size="small" type="primary" @click="openRunDialog">
          <Play :size="14" /> 创建执行
        </el-button>
        <el-dropdown v-if="app.can('edit')" trigger="click" @command="changeStatus">
          <el-button size="small">状态<ChevronDown :size="12" /></el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-for="(row, key) in planStatus.map" :key="key" :command="key" :disabled="plan.status === key">
                {{ row.label }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <div class="bf-kpis">
      <KpiCard label="覆盖用例" :value="plan.caseIds.length" unit="条" :foot="`已完成 ${progress.executedCases} 条`" />
      <KpiCard label="PASS" :value="progress.pass" unit="次" tone="success" :foot="`执行通过率 ${progress.rate}%`" />
      <KpiCard label="FAIL" :value="progress.fail" unit="次" :tone="progress.fail > 0 ? 'danger' : undefined" :foot="`阻塞/跳过 ${progress.blocked}`" />
      <KpiCard label="执行记录" :value="runs.length" unit="条" :foot="`关联需求 ${plan.requirementIds.length} 条`" />
    </div>

    <div class="plan-grid">
      <section class="bf-panel">
        <header class="bf-panel-header">
          <h2>用例执行情况</h2>
          <span class="bf-sub">按用例查看最新执行结果</span>
        </header>
        <el-table :data="caseRows" size="small">
          <el-table-column label="用例" min-width="220">
            <template #default="{ row }">
              <div class="bf-table-name">{{ row.testCase.name }}</div>
              <div class="bf-sub"><span class="mono">{{ row.testCase.code }}</span> · {{ testCategory.get(row.testCase.category).label }}</div>
            </template>
          </el-table-column>
          <el-table-column label="测量项" width="80" align="center">
            <template #default="{ row }">{{ row.testCase.steps.filter((s: TestStep) => s.param).length }}</template>
          </el-table-column>
          <el-table-column label="执行次数" width="86" align="center">
            <template #default="{ row }"><span class="num">{{ row.runCount }}</span></template>
          </el-table-column>
          <el-table-column label="最新结果" width="100">
            <template #default="{ row }">
              <StatusPill v-if="row.latest" :label="runResult.get(row.latest.result).label" :tone="runResult.get(row.latest).tone" dot />
              <span v-else class="muted">未执行</span>
            </template>
          </el-table-column>
          <el-table-column label="执行人" width="92">
            <template #default="{ row }">{{ row.latest ? memberName(row.latest.testerId) : '—' }}</template>
          </el-table-column>
          <el-table-column label="时间" width="100">
            <template #default="{ row }">
              <span class="bf-sub">{{ row.latest ? fmtDate(row.latest.startedAt) : '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120" align="right">
            <template #default="{ row }">
              <el-button v-if="row.latest" size="small" text @click="router.push(`/test-executions/${row.latest.id}`)">查看</el-button>
              <el-button v-if="app.can('execute')" size="small" text @click="openRunDialog(row.testCase.id)">执行</el-button>
            </template>
          </el-table-column>
        </el-table>
      </section>

      <aside class="plan-side">
        <section class="bf-panel">
          <header class="bf-panel-header"><h2>计划信息</h2></header>
          <div class="bf-panel-body">
            <el-descriptions :column="1" size="small">
              <el-descriptions-item label="项目">{{ projectName(plan.projectId) }}</el-descriptions-item>
              <el-descriptions-item label="产品">{{ productName(plan.productId) }}</el-descriptions-item>
              <el-descriptions-item label="硬件版本">{{ versionLabel(plan.hardwareVersionId) }}</el-descriptions-item>
              <el-descriptions-item label="固件版本">{{ versionLabel(plan.firmwareVersionId) }}</el-descriptions-item>
              <el-descriptions-item label="测试人员">
                <span class="bf-avatar-stack">
                  <UserAvatar v-for="id in plan.assigneeIds" :key="id" :name="memberName(id)" :color="memberColor(id)" size="sm" />
                </span>
                {{ plan.assigneeIds.map(memberName).join('、') }}
              </el-descriptions-item>
              <el-descriptions-item label="测试设备">
                {{ plan.deviceIds.map(deviceLabel).join('、') || '未指定' }}
              </el-descriptions-item>
              <el-descriptions-item label="验收条件">{{ plan.acceptance }}</el-descriptions-item>
              <el-descriptions-item label="备注">{{ plan.note || '—' }}</el-descriptions-item>
            </el-descriptions>
          </div>
        </section>

        <section class="bf-panel">
          <header class="bf-panel-header"><h2>关联需求</h2></header>
          <div class="bf-panel-body">
            <div v-for="req in planRequirements" :key="req.id" class="req-row">
              <span class="mono req-code">{{ req.code }}</span>
              <span class="req-name">{{ req.name }}</span>
              <StatusPill :label="requirementStatus.get(req.status).label" :tone="requirementStatus.get(req.status).tone" />
            </div>
            <EmptyState v-if="planRequirements.length === 0" text="未关联需求" />
          </div>
        </section>

        <section class="bf-panel">
          <header class="bf-panel-header"><h2>执行记录（{{ runs.length }}）</h2></header>
          <div class="bf-panel-body flush">
            <button
              v-for="run in runs.slice(0, 8)"
              :key="run.id"
              type="button"
              class="run-row"
              @click="router.push(`/test-executions/${run.id}`)"
            >
              <span class="mono">{{ run.code }}</span>
              <StatusPill :label="runResult.get(run.result).label" :tone="runResult.get(run.result).tone" dot />
              <span class="bf-sub">{{ fmtDate(run.startedAt) }}</span>
            </button>
            <EmptyState v-if="runs.length === 0" text="尚无执行记录" hint="点击「创建执行」开始第一轮测试。" />
          </div>
        </section>
      </aside>
    </div>

    <el-dialog v-model="runDialog" title="创建测试执行" width="620px" destroy-on-close>
      <el-form :model="runForm" label-width="92px">
        <el-form-item label="测试用例" required>
          <el-select v-model="runForm.caseId" style="width: 100%">
            <el-option
              v-for="testCase in planCases"
              :key="testCase.id"
              :label="`${testCase.code} · ${testCase.name}`"
              :value="testCase.id"
            />
          </el-select>
        </el-form-item>
        <div class="form-grid">
          <el-form-item label="测试人员" required>
            <el-select v-model="runForm.testerId" style="width: 100%">
              <el-option v-for="member in db.members" :key="member.id" :label="member.name" :value="member.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="测试设备">
            <el-select v-model="runForm.deviceIds" multiple style="width: 100%">
              <el-option v-for="device in db.devices" :key="device.id" :label="`${device.code} · ${device.name}`" :value="device.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="环境温度">
            <el-input-number v-model="runForm.temperature" :min="-40" :max="150" :controls="false" style="width: 100%" />
          </el-form-item>
          <el-form-item label="环境湿度">
            <el-input-number v-model="runForm.humidity" :min="0" :max="100" :controls="false" style="width: 100%" />
          </el-form-item>
          <el-form-item label="输入电压 V">
            <el-input-number v-model="runForm.inputVoltage" :min="0" :controls="false" style="width: 100%" />
          </el-form-item>
          <el-form-item label="负载电流 A">
            <el-input-number v-model="runForm.load" :min="0" :controls="false" style="width: 100%" />
          </el-form-item>
        </div>
        <el-form-item label="工况描述">
          <el-input v-model="runForm.conditions" placeholder="例如：48V 输入 / 12V 输出 / 50A 满载 / 风冷" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="runForm.note" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <div class="bf-hint">创建后进入执行详情页录入测量值；系统按用例阈值自动判定 PASS / FAIL，并生成 RUN 编号。</div>
      <template #footer>
        <el-button @click="runDialog = false">取消</el-button>
        <el-button type="primary" @click="createRun">创建并开始</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="reportOpen" title="生成测试计划报告" width="520px">
      <p class="bf-sub">报告将基于该计划的实际执行数据生成章节与指标，可在报告中心继续编辑、审核与打印。</p>
      <template #footer>
        <el-button @click="reportOpen = false">取消</el-button>
        <el-button type="primary" @click="generateReport">生成报告</el-button>
      </template>
    </el-dialog>
  </div>

  <div v-else class="bf-page">
    <EmptyState text="测试计划不存在" hint="请从计划列表重新进入。">
      <el-button size="small" @click="router.push('/test-plans')">返回列表</el-button>
    </EmptyState>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, ChevronDown, FileText, Play } from 'lucide-vue-next'
import type { Execution, PlanStatus, Requirement, TestCase, TestStep } from '@/types'
import { db } from '@/services/db'
import { testPlanService } from '@/services/testService'
import { executionService } from '@/services/executionService'
import { reportService } from '@/services/reportService'
import { useAppStore } from '@/stores/app'
import KpiCard from '@/components/common/KpiCard.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { fmtDate, planStatus, requirementStatus, runResult, testCategory } from '@/utils/format'

const route = useRoute()
const router = useRouter()
const app = useAppStore()

const plan = computed(() => db.plans.find((p) => p.id === route.params.id))
const progress = computed(() => (plan.value ? testPlanService.progress(plan.value.id) : { rate: 0, pass: 0, fail: 0, blocked: 0, executedCases: 0, totalCases: 0, pending: 0 }))
const runs = computed(() =>
  plan.value
    ? db.executions.filter((e) => e.planId === plan.value!.id).slice().sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
    : [],
)

const planCases = computed<TestCase[]>(() => {
  if (!plan.value) return []
  return plan.value.caseIds
    .map((id) => db.cases.find((c) => c.id === id))
    .filter((c): c is TestCase => Boolean(c))
})

interface CaseRow {
  testCase: TestCase
  runCount: number
  latest?: Execution
}

const caseRows = computed<CaseRow[]>(() =>
  planCases.value.map((testCase) => {
    const caseRuns = runs.value.filter((r) => r.caseId === testCase.id)
    return { testCase, runCount: caseRuns.length, latest: caseRuns[0] }
  }),
)

const planRequirements = computed<Requirement[]>(() =>
  plan.value
    ? plan.value.requirementIds
        .map((id) => db.requirements.find((r) => r.id === id))
        .filter((r): r is Requirement => Boolean(r))
    : [],
)

const projectName = (id: string) => db.projects.find((p) => p.id === id)?.name ?? id
const productName = (id: string) => db.products.find((p) => p.id === id)?.name ?? id
const versionLabel = (id?: string) => (id ? db.versions.find((v) => v.id === id)?.version ?? id : '—')
const memberName = (id: string) => db.members.find((m) => m.id === id)?.name ?? id
const memberColor = (id: string) => db.members.find((m) => m.id === id)?.color ?? '#6b7a8f'
const deviceLabel = (id: string) => db.devices.find((d) => d.id === id)?.name ?? id

const changeStatus = (status: PlanStatus) => {
  if (!plan.value) return
  testPlanService.setStatus(plan.value.id, status)
  ElMessage.success('计划状态已更新')
}

const runDialog = ref(false)
const runForm = reactive({
  caseId: '',
  testerId: app.currentUser.id,
  deviceIds: [] as string[],
  temperature: 25,
  humidity: 48,
  inputVoltage: 48,
  load: 50,
  conditions: '48V 输入 / 12V 输出 / 50A 满载 / 风冷',
  note: '',
})

const openRunDialog = (caseId?: string) => {
  if (!plan.value) return
  runForm.caseId = caseId ?? plan.value.caseIds[0] ?? ''
  runForm.testerId = plan.value.assigneeIds[0] ?? app.currentUser.id
  runForm.deviceIds = [...plan.value.deviceIds]
  runForm.conditions = '48V 输入 / 12V 输出 / 50A 满载 / 风冷'
  runForm.note = ''
  runDialog.value = true
}

const createRun = () => {
  if (!plan.value) return
  if (!runForm.caseId) {
    ElMessage.warning('请选择测试用例')
    return
  }
  try {
    const run = executionService.create({
      planId: plan.value.id,
      caseId: runForm.caseId,
      testerId: runForm.testerId,
      deviceIds: runForm.deviceIds,
      environment: {
        temperature: runForm.temperature,
        humidity: runForm.humidity,
        inputVoltage: runForm.inputVoltage,
        load: runForm.load,
        note: '',
      },
      conditions: runForm.conditions,
      note: runForm.note,
    })
    ElMessage.success(`执行 ${run.code} 已创建`)
    runDialog.value = false
    router.push(`/test-executions/${run.id}`)
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message)
  }
}

const reportOpen = ref(false)
const generateReport = () => {
  if (!plan.value) return
  try {
    const report = reportService.generateFromPlan(plan.value.id)
    ElMessage.success(`报告 ${report.code} 已生成`)
    reportOpen.value = false
    router.push(`/reports/${report.id}`)
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message)
  }
}
</script>

<style scoped>
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

h1 {
  gap: 10px !important;
  flex-wrap: wrap;
  font-size: 19px !important;
}

.plan-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(300px, 0.9fr);
  gap: 14px;
  margin-top: 14px;
  align-items: start;
}

.plan-side {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.req-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px dashed var(--bf-border);
  font-size: 12.2px;
}

.req-row:last-child {
  border-bottom: none;
}

.req-code {
  font-size: 11px;
  color: var(--bf-primary);
  flex: none;
}

.req-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.run-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  border: none;
  background: transparent;
  border-bottom: 1px solid var(--bf-border);
  padding: 8px 14px;
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
}

.run-row:hover {
  background: var(--bf-surface-2);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 12px;
}

@media (max-width: 1180px) {
  .plan-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 760px) {
  .form-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
