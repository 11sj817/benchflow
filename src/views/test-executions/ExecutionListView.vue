<template>
  <div class="bf-page">
    <PageHeader title="测试执行" :subtitle="`${filtered.length} 条执行记录 · 每次执行绑定产品版本、设备、工况与测量数据`">
      <template #actions>
        <el-button size="small" @click="exportCsv"><Download :size="14" /> 导出</el-button>
        <el-button v-if="app.can('execute')" size="small" type="primary" @click="openCreate"><Plus :size="14" /> 新建执行</el-button>
      </template>
    </PageHeader>

    <section class="bf-panel">
      <div class="bf-toolbar">
        <el-input v-model="keyword" placeholder="搜索 RUN 编号 / 备注" clearable style="width: 220px">
          <template #prefix><Search :size="14" /></template>
        </el-input>
        <el-select v-model="projectFilter" placeholder="项目" clearable style="width: 160px">
          <el-option v-for="project in db.projects" :key="project.id" :label="project.name" :value="project.id" />
        </el-select>
        <el-select v-model="planFilter" placeholder="测试计划" clearable filterable style="width: 180px">
          <el-option v-for="plan in db.plans" :key="plan.id" :label="`${plan.code} · ${plan.name}`" :value="plan.id" />
        </el-select>
        <el-select v-model="resultFilter" placeholder="结果" clearable style="width: 110px">
          <el-option v-for="(row, key) in runResult.map" :key="key" :label="row.label" :value="key" />
        </el-select>
        <el-select v-model="testerFilter" placeholder="执行人" clearable style="width: 120px">
          <el-option v-for="member in db.members" :key="member.id" :label="member.name" :value="member.id" />
        </el-select>
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          size="default"
          value-format="YYYY-MM-DD"
          start-placeholder="开始"
          end-placeholder="结束"
          style="width: 230px"
        />
        <el-button text @click="resetFilters">重置</el-button>
        <span class="grow" />
        <span class="bf-filter-count">PASS {{ resultCounts.PASS }} · FAIL {{ resultCounts.FAIL }}</span>
      </div>

      <el-table :data="paged" size="small" @sort-change="onSortChange" @row-click="(row: Execution) => router.push(`/test-executions/${row.id}`)">
        <el-table-column prop="code" label="执行编号" width="104" sortable="custom">
          <template #default="{ row }"><span class="bf-table-code">{{ row.code }}</span></template>
        </el-table-column>
        <el-table-column label="测试用例" min-width="200">
          <template #default="{ row }">
            <div class="bf-table-name">{{ caseName(row.caseId) }}</div>
            <div class="bf-sub">{{ planCode(row.planId) }} · {{ projectName(row.projectId) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="产品 / 版本" width="160">
          <template #default="{ row }">
            <div class="bf-sub">{{ productName(row.productId) }}</div>
            <div>{{ versionLabel(row.hardwareVersionId) }}<span v-if="row.firmwareVersionId"> / {{ versionLabel(row.firmwareVersionId) }}</span></div>
          </template>
        </el-table-column>
        <el-table-column label="工况" min-width="150" show-overflow-tooltip>
          <template #default="{ row }"><span class="bf-sub">{{ row.conditions }}</span></template>
        </el-table-column>
        <el-table-column label="执行人" width="82">
          <template #default="{ row }">{{ memberName(row.testerId) }}</template>
        </el-table-column>
        <el-table-column label="设备" width="96">
          <template #default="{ row }">
            <el-tooltip :content="row.deviceIds.map(deviceLabel).join(' / ') || '未记录'" placement="top">
              <span class="bf-sub">{{ row.deviceIds.length }} 台</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="结果" width="90" sortable="custom" prop="result">
          <template #default="{ row }"><StatusPill :label="runResult.get(row.result).label" :tone="runResult.get(row.result).tone" dot /></template>
        </el-table-column>
        <el-table-column label="缺陷" width="92">
          <template #default="{ row }">
            <span v-if="row.defectIds.length" class="defect-tag">{{ row.defectIds.join('、') }}</span>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="startedAt" label="执行时间" width="104" sortable="custom">
          <template #default="{ row }"><span class="bf-sub num">{{ fmtDate(row.startedAt) }}</span></template>
        </el-table-column>
        <el-table-column label="操作" width="92" fixed="right">
          <template #default="{ row }">
            <el-button size="small" text @click.stop="router.push(`/test-executions/${row.id}`)">详情</el-button>
            <el-button v-if="app.can('delete')" size="small" text type="danger" @click.stop="removeRun(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <DataPager v-model:page="page" v-model:page-size="pageSize" :total="total" />
    </section>

    <el-dialog v-model="dialogOpen" title="新建测试执行" width="600px" destroy-on-close>
      <el-form :model="form" label-width="90px">
        <el-form-item label="测试计划" required>
          <el-select v-model="form.planId" style="width: 100%" filterable @update:model-value="onPlanChange">
            <el-option v-for="plan in db.plans" :key="plan.id" :label="`${plan.code} · ${plan.name}`" :value="plan.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="测试用例" required>
          <el-select v-model="form.caseId" style="width: 100%">
            <el-option v-for="testCase in planCases" :key="testCase.id" :label="`${testCase.code} · ${testCase.name}`" :value="testCase.id" />
          </el-select>
        </el-form-item>
        <div class="form-grid">
          <el-form-item label="执行人" required>
            <el-select v-model="form.testerId" style="width: 100%">
              <el-option v-for="member in db.members" :key="member.id" :label="member.name" :value="member.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="测试设备">
            <el-select v-model="form.deviceIds" multiple style="width: 100%">
              <el-option v-for="device in db.devices" :key="device.id" :label="`${device.code} · ${device.name}`" :value="device.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="温度 ℃">
            <el-input-number v-model="form.temperature" :min="-40" :max="150" :controls="false" style="width: 100%" />
          </el-form-item>
          <el-form-item label="湿度 %RH">
            <el-input-number v-model="form.humidity" :min="0" :max="100" :controls="false" style="width: 100%" />
          </el-form-item>
        </div>
        <el-form-item label="工况描述">
          <el-input v-model="form.conditions" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogOpen = false">取消</el-button>
        <el-button type="primary" @click="createRun">创建并录入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Download, Plus, Search } from 'lucide-vue-next'
import type { Execution, RunResult, TestCase } from '@/types'
import { db } from '@/services/db'
import { executionService } from '@/services/executionService'
import { useAppStore } from '@/stores/app'
import { useTable } from '@/composables/useTable'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import DataPager from '@/components/common/DataPager.vue'
import { fmtDate, runResult } from '@/utils/format'
import { downloadText, toCsv } from '@/utils/csv'

const route = useRoute()
const router = useRouter()
const app = useAppStore()

const keyword = ref('')
const projectFilter = ref(typeof route.query.project === 'string' ? route.query.project : '')
const planFilter = ref('')
const resultFilter = ref<RunResult | ''>('')
const testerFilter = ref('')
const dateRange = ref<[string, string] | null>(null)

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return db.executions.filter((row) => {
    if (projectFilter.value && row.projectId !== projectFilter.value) return false
    if (planFilter.value && row.planId !== planFilter.value) return false
    if (resultFilter.value && row.result !== resultFilter.value) return false
    if (testerFilter.value && row.testerId !== testerFilter.value) return false
    if (dateRange.value) {
      const day = row.startedAt.slice(0, 10)
      if (day < dateRange.value[0] || day > dateRange.value[1]) return false
    }
    if (kw && !`${row.code} ${row.note} ${caseName(row.caseId)}`.toLowerCase().includes(kw)) return false
    return true
  })
})

const accessors = {
  code: (row: Execution) => row.code,
  result: (row: Execution) => row.result,
  startedAt: (row: Execution) => row.startedAt,
}

const { page, pageSize, total, paged, onSortChange } = useTable(filtered, { pageSize: 10, accessors })

const resultCounts = computed(() => {
  const base: Record<RunResult, number> = { PASS: 0, FAIL: 0, BLOCKED: 0, SKIPPED: 0, PENDING: 0 }
  filtered.value.forEach((row) => {
    base[row.result] += 1
  })
  return base
})

const caseName = (id: string) => db.cases.find((c) => c.id === id)?.name ?? id
const planCode = (id: string) => db.plans.find((p) => p.id === id)?.code ?? id
const projectName = (id: string) => db.projects.find((p) => p.id === id)?.name ?? id
const productName = (id: string) => db.products.find((p) => p.id === id)?.name ?? id
const versionLabel = (id?: string) => (id ? db.versions.find((v) => v.id === id)?.version ?? id : '—')
const memberName = (id: string) => db.members.find((m) => m.id === id)?.name ?? id
const deviceLabel = (id: string) => db.devices.find((d) => d.id === id)?.code ?? id

const resetFilters = () => {
  keyword.value = ''
  projectFilter.value = ''
  planFilter.value = ''
  resultFilter.value = ''
  testerFilter.value = ''
  dateRange.value = null
}

const dialogOpen = ref(false)
const form = reactive({
  planId: '',
  caseId: '',
  testerId: app.currentUser.id,
  deviceIds: [] as string[],
  temperature: 25,
  humidity: 48,
  conditions: '48V 输入 / 12V 输出 / 50A 满载 / 风冷',
})

const planCases = computed<TestCase[]>(() => {
  const plan = db.plans.find((p) => p.id === form.planId)
  if (!plan) return []
  return plan.caseIds.map((id) => db.cases.find((c) => c.id === id)).filter(Boolean) as TestCase[]
})

const onPlanChange = (planId: string) => {
  const plan = db.plans.find((p) => p.id === planId)
  form.caseId = plan?.caseIds[0] ?? ''
  form.deviceIds = plan ? [...plan.deviceIds] : []
}

const openCreate = () => {
  const firstPlan = db.plans.find((p) => p.status === 'running') ?? db.plans[0]
  form.planId = firstPlan?.id ?? ''
  form.caseId = firstPlan?.caseIds[0] ?? ''
  form.deviceIds = firstPlan ? [...firstPlan.deviceIds] : []
  form.testerId = app.currentUser.id
  dialogOpen.value = true
}

const createRun = () => {
  if (!form.planId || !form.caseId) {
    ElMessage.warning('请选择测试计划与用例')
    return
  }
  try {
    const run = executionService.create({
      planId: form.planId,
      caseId: form.caseId,
      testerId: form.testerId,
      deviceIds: form.deviceIds,
      environment: { temperature: form.temperature, humidity: form.humidity, inputVoltage: null, load: null, note: '' },
      conditions: form.conditions,
      note: '',
    })
    ElMessage.success(`执行 ${run.code} 已创建`)
    dialogOpen.value = false
    router.push(`/test-executions/${run.id}`)
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message)
  }
}

const removeRun = async (row: Execution) => {
  try {
    await ElMessageBox.confirm(`删除执行记录 ${row.code}？关联缺陷的执行不能删除。`, '删除执行', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    executionService.remove(row.id)
    ElMessage.success('执行记录已删除')
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message)
  }
}

const exportCsv = () => {
  downloadText(
    `benchflow-executions-${new Date().toISOString().slice(0, 10)}.csv`,
    toCsv(
      ['执行编号', '测试用例', '计划', '项目', '产品', '硬件版本', '固件版本', '执行人', '工况', '结果', '执行时间'],
      filtered.value.map((r) => [
        r.code,
        caseName(r.caseId),
        planCode(r.planId),
        projectName(r.projectId),
        productName(r.productId),
        versionLabel(r.hardwareVersionId),
        versionLabel(r.firmwareVersionId),
        memberName(r.testerId),
        r.conditions,
        r.result,
        r.startedAt.slice(0, 16).replace('T', ' '),
      ]),
    ),
  )
  ElMessage.success('已导出执行记录 CSV')
}
</script>

<style scoped>
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 12px;
}

.defect-tag {
  font-family: var(--bf-mono);
  font-size: 11px;
  color: var(--bf-danger);
  background: #fdecea;
  border-radius: 3px;
  padding: 0 4px;
}

:deep(.el-table__row) {
  cursor: pointer;
}

@media (max-width: 760px) {
  .form-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
