<template>
  <div class="bf-page">
    <PageHeader title="测试计划" :subtitle="`${filtered.length} 个计划 · 计划绑定项目、产品版本、需求与测试设备`">
      <template #actions>
        <el-button size="small" @click="exportCsv"><Download :size="14" /> 导出</el-button>
        <el-button v-if="app.can('create')" size="small" type="primary" @click="openCreate"><Plus :size="14" /> 新建计划</el-button>
      </template>
    </PageHeader>

    <section class="bf-panel">
      <div class="bf-toolbar">
        <el-input v-model="keyword" placeholder="搜索计划编号 / 名称" clearable style="width: 240px">
          <template #prefix><Search :size="14" /></template>
        </el-input>
        <el-select v-model="projectFilter" placeholder="项目" clearable style="width: 170px">
          <el-option v-for="project in db.projects" :key="project.id" :label="project.name" :value="project.id" />
        </el-select>
        <el-select v-model="statusFilter" placeholder="状态" clearable style="width: 120px">
          <el-option v-for="(row, key) in planStatus.map" :key="key" :label="row.label" :value="key" />
        </el-select>
        <el-select v-model="productFilter" placeholder="产品" clearable style="width: 170px">
          <el-option v-for="product in db.products" :key="product.id" :label="product.name" :value="product.id" />
        </el-select>
        <el-button text @click="resetFilters">重置</el-button>
        <span class="grow" />
        <span class="bf-filter-count">用例总数 {{ totalCases }}</span>
      </div>

      <el-table :data="paged" size="small" @sort-change="onSortChange" @row-click="(row: TestPlan) => router.push(`/test-plans/${row.id}`)">
        <el-table-column prop="code" label="编号" width="118" sortable="custom">
          <template #default="{ row }"><span class="bf-table-code">{{ row.code }}</span></template>
        </el-table-column>
        <el-table-column prop="name" label="计划名称" min-width="220" sortable="custom">
          <template #default="{ row }">
            <div class="bf-table-name">{{ row.name }}</div>
            <div class="bf-sub">{{ projectName(row.projectId) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="产品 / 版本" width="190">
          <template #default="{ row }">
            <div>{{ productName(row.productId) }}</div>
            <div class="bf-sub">{{ versionLabel(row.hardwareVersionId) }} / {{ versionLabel(row.firmwareVersionId) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="用例" width="64" align="right">
          <template #default="{ row }"><span class="num">{{ row.caseIds.length }}</span></template>
        </el-table-column>
        <el-table-column label="执行进度" width="150">
          <template #default="{ row }">
            <el-progress
              :percentage="progress(row.id).rate"
              :stroke-width="6"
              :show-text="false"
              :status="progress(row.id).fail > 0 ? 'exception' : undefined"
            />
            <span class="bf-sub">{{ progress(row.id).executedCases }}/{{ progress(row.id).totalCases }} 用例 · PASS {{ progress(row.id).pass }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="88">
          <template #default="{ row }"><StatusPill :label="planStatus.get(row.status).label" :tone="planStatus.get(row.status).tone" /></template>
        </el-table-column>
        <el-table-column label="负责人" width="110">
          <template #default="{ row }">
            <div class="bf-avatar-stack">
              <UserAvatar v-for="id in row.assigneeIds.slice(0, 3)" :key="id" :name="memberName(id)" :color="memberColor(id)" size="sm" />
            </div>
          </template>
        </el-table-column>
        <el-table-column label="周期" width="178" sortable="custom" prop="startDate">
          <template #default="{ row }"><span class="bf-sub num">{{ fmtDate(row.startDate) }} → {{ fmtDate(row.endDate) }}</span></template>
        </el-table-column>
        <el-table-column label="操作" width="108" fixed="right">
          <template #default="{ row }">
            <el-button size="small" text @click.stop="router.push(`/test-plans/${row.id}`)">详情</el-button>
            <el-dropdown v-if="app.can('edit')" trigger="click" @command="(cmd: string) => onCommand(cmd, row)">
              <el-button size="small" text @click.stop>更多<ChevronDown :size="12" /></el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="pending" :disabled="row.status === 'pending'">标记待执行</el-dropdown-item>
                  <el-dropdown-item command="running" :disabled="row.status === 'running'">开始执行</el-dropdown-item>
                  <el-dropdown-item command="review" :disabled="row.status === 'review'">提交审核</el-dropdown-item>
                  <el-dropdown-item command="completed" :disabled="row.status === 'completed'">标记完成</el-dropdown-item>
                  <el-dropdown-item command="cancelled" :disabled="row.status === 'cancelled'">取消计划</el-dropdown-item>
                  <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
      </el-table>
      <DataPager v-model:page="page" v-model:page-size="pageSize" :total="total" />
    </section>

    <el-dialog v-model="dialogOpen" title="新建测试计划" width="760px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="计划名称" prop="name">
          <el-input v-model="form.name" maxlength="70" show-word-limit placeholder="例如：DC-DC V1.2 整改回归验证" />
        </el-form-item>
        <div class="form-grid">
          <el-form-item label="所属项目" prop="projectId">
            <el-select v-model="form.projectId" style="width: 100%" @update:model-value="onProjectChange">
              <el-option v-for="project in db.projects" :key="project.id" :label="project.name" :value="project.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="产品" prop="productId">
            <el-select v-model="form.productId" style="width: 100%" @update:model-value="onProductChange">
              <el-option v-for="product in projectProducts" :key="product.id" :label="product.name" :value="product.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="硬件版本" prop="hardwareVersionId">
            <el-select v-model="form.hardwareVersionId" style="width: 100%">
              <el-option v-for="version in hardwareVersions" :key="version.id" :label="version.label" :value="version.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="固件版本">
            <el-select v-model="form.firmwareVersionId" style="width: 100%" clearable>
              <el-option v-for="version in firmwareVersions" :key="version.id" :label="version.label" :value="version.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="开始日期" prop="startDate">
            <el-date-picker v-model="form.startDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
          </el-form-item>
          <el-form-item label="结束日期" prop="endDate">
            <el-date-picker v-model="form.endDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
          </el-form-item>
        </div>
        <el-form-item label="关联需求">
          <el-select v-model="form.requirementIds" multiple filterable style="width: 100%">
            <el-option v-for="req in projectRequirements" :key="req.id" :label="`${req.code} · ${req.name}`" :value="req.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="测试用例" prop="caseIds">
          <el-select v-model="form.caseIds" multiple filterable style="width: 100%" placeholder="选择本计划覆盖的用例">
            <el-option v-for="testCase in availableCases" :key="testCase.id" :label="`${testCase.code} · ${testCase.name}`" :value="testCase.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="测试人员">
          <el-select v-model="form.assigneeIds" multiple style="width: 100%">
            <el-option v-for="member in db.members" :key="member.id" :label="`${member.name} · ${member.title}`" :value="member.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="测试设备">
          <el-select v-model="form.deviceIds" multiple style="width: 100%">
            <el-option v-for="device in db.devices" :key="device.id" :label="`${device.code} · ${device.name}`" :value="device.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="验收条件" prop="acceptance">
          <el-input v-model="form.acceptance" type="textarea" :rows="2" placeholder="如何判定计划通过" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.note" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">创建计划</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { ChevronDown, Download, Plus, Search } from 'lucide-vue-next'
import type { PlanStatus, TestPlan } from '@/types'
import { db } from '@/services/db'
import { testPlanService } from '@/services/testService'
import type { TestPlanInput } from '@/services/testService'
import { useAppStore } from '@/stores/app'
import { useTable } from '@/composables/useTable'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import DataPager from '@/components/common/DataPager.vue'
import { fmtDate, planStatus } from '@/utils/format'
import { downloadText, toCsv } from '@/utils/csv'

const route = useRoute()
const router = useRouter()
const app = useAppStore()

const keyword = ref('')
const projectFilter = ref(typeof route.query.project === 'string' ? route.query.project : '')
const statusFilter = ref<PlanStatus | ''>('')
const productFilter = ref('')

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return db.plans.filter((row) => {
    if (projectFilter.value && row.projectId !== projectFilter.value) return false
    if (statusFilter.value && row.status !== statusFilter.value) return false
    if (productFilter.value && row.productId !== productFilter.value) return false
    if (kw && !`${row.code} ${row.name}`.toLowerCase().includes(kw)) return false
    return true
  })
})

const accessors = {
  code: (row: TestPlan) => row.code,
  name: (row: TestPlan) => row.name,
  startDate: (row: TestPlan) => row.startDate,
}

const { page, pageSize, total, paged, onSortChange } = useTable(filtered, { pageSize: 10, accessors })

const totalCases = computed(() => filtered.value.reduce((sum, p) => sum + p.caseIds.length, 0))
const progress = (id: string) => testPlanService.progress(id)
const projectName = (id: string) => db.projects.find((p) => p.id === id)?.name ?? id
const productName = (id: string) => db.products.find((p) => p.id === id)?.name ?? id
const versionLabel = (id?: string) => (id ? db.versions.find((v) => v.id === id)?.version ?? id : '—')
const memberName = (id: string) => db.members.find((m) => m.id === id)?.name ?? id
const memberColor = (id: string) => db.members.find((m) => m.id === id)?.color ?? '#6b7a8f'

const resetFilters = () => {
  keyword.value = ''
  projectFilter.value = ''
  statusFilter.value = ''
  productFilter.value = ''
}

const dialogOpen = ref(false)
const saving = ref(false)
const formRef = ref<FormInstance>()

const today = () => new Date().toISOString().slice(0, 10)
const plusDays = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)

const form = reactive<TestPlanInput>({
  name: '',
  projectId: '',
  productId: '',
  hardwareVersionId: '',
  firmwareVersionId: '',
  requirementIds: [],
  caseIds: [],
  assigneeIds: [],
  startDate: today(),
  endDate: plusDays(7),
  deviceIds: [],
  acceptance: '',
  note: '',
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入计划名称', trigger: 'blur' }],
  projectId: [{ required: true, message: '请选择项目', trigger: 'change' }],
  productId: [{ required: true, message: '请选择产品', trigger: 'change' }],
  hardwareVersionId: [{ required: true, message: '请选择硬件版本', trigger: 'change' }],
  caseIds: [{ required: true, type: 'array', min: 1, message: '请至少选择一个用例', trigger: 'change' }],
  startDate: [{ required: true, message: '请选择开始日期', trigger: 'change' }],
  endDate: [{ required: true, message: '请选择结束日期', trigger: 'change' }],
}

const projectProducts = computed(() => db.products.filter((p) => p.projectId === form.projectId))
const hardwareVersions = computed(() => db.versions.filter((v) => v.productId === form.productId && v.kind === 'hardware'))
const firmwareVersions = computed(() => db.versions.filter((v) => v.productId === form.productId && v.kind === 'firmware'))
const projectRequirements = computed(() => db.requirements.filter((r) => r.projectId === form.projectId))
const availableCases = computed(() =>
  db.cases.filter(
    (c) =>
      (c.productIds.length === 0 || c.productIds.includes(form.productId)) &&
      c.status !== 'deprecated',
  ),
)

const onProjectChange = (projectId: string) => {
  form.productId = db.products.find((p) => p.projectId === projectId)?.id ?? ''
  form.hardwareVersionId = ''
  form.firmwareVersionId = ''
  form.requirementIds = []
  form.caseIds = []
}

const onProductChange = (productId: string) => {
  form.hardwareVersionId = db.versions.find((v) => v.productId === productId && v.kind === 'hardware')?.id ?? ''
  form.firmwareVersionId = db.versions.find((v) => v.productId === productId && v.kind === 'firmware')?.id ?? ''
  form.caseIds = []
}

const openCreate = () => {
  Object.assign(form, {
    name: '',
    projectId: projectFilter.value || db.projects[0]?.id || '',
    productId: '',
    hardwareVersionId: '',
    firmwareVersionId: '',
    requirementIds: [],
    caseIds: [],
    assigneeIds: [app.currentUser.id],
    startDate: today(),
    endDate: plusDays(7),
    deviceIds: [],
    acceptance: '',
    note: '',
  })
  onProjectChange(form.projectId)
  dialogOpen.value = true
}

const save = async () => {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  if (form.endDate < form.startDate) {
    ElMessage.warning('结束日期不能早于开始日期')
    return
  }
  saving.value = true
  try {
    const plan = testPlanService.create({ ...form, firmwareVersionId: form.firmwareVersionId || undefined })
    ElMessage.success(`计划 ${plan.code} 已创建`)
    dialogOpen.value = false
    router.push(`/test-plans/${plan.id}`)
  } finally {
    saving.value = false
  }
}

const onCommand = async (command: string, row: TestPlan) => {
  if (command === 'delete') {
    try {
      await ElMessageBox.confirm(`删除计划「${row.name}」？已产生执行的计划不可删除。`, '删除计划', {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
      })
      testPlanService.remove(row.id)
      ElMessage.success('计划已删除')
    } catch (error) {
      if (error instanceof Error) ElMessage.error(error.message)
    }
    return
  }
  testPlanService.setStatus(row.id, command as PlanStatus)
  ElMessage.success('计划状态已更新')
}

const exportCsv = () => {
  downloadText(
    `benchflow-plans-${today()}.csv`,
    toCsv(
      ['计划编号', '计划名称', '项目', '产品', '硬件版本', '固件版本', '用例数', '状态', '开始', '结束'],
      filtered.value.map((p) => [
        p.code,
        p.name,
        projectName(p.projectId),
        productName(p.productId),
        versionLabel(p.hardwareVersionId),
        versionLabel(p.firmwareVersionId),
        p.caseIds.length,
        planStatus.get(p.status).label,
        p.startDate,
        p.endDate,
      ]),
    ),
  )
  ElMessage.success('已导出计划 CSV')
}

if (route.query.create === '1' && app.can('create')) openCreate()
</script>

<style scoped>
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 14px;
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
