<template>
  <div class="bf-page">
    <PageHeader title="缺陷管理" :subtitle="`${filtered.length} 个缺陷 · 新建 → 分派 → 处理 → 修复 → 验证 → 关闭 全流程闭环`">
      <template #actions>
        <el-button size="small" @click="exportCsv"><Download :size="14" /> 导出</el-button>
        <el-button v-if="app.can('create')" size="small" type="primary" @click="openCreate()">
          <Plus :size="14" /> 新建缺陷
        </el-button>
      </template>
    </PageHeader>

    <div class="bf-kpis">
      <KpiCard label="缺陷总数" :value="stats.total" unit="个" :foot="`${stats.closed} 个已关闭`" />
      <KpiCard label="未关闭" :value="stats.open" unit="个" :tone="stats.open > 0 ? 'warning' : 'success'" :foot="`严重 ${stats.bySeverity.critical} 个`" />
      <KpiCard label="平均关闭周期" :value="stats.avgCloseDays" unit="天" :foot="'按已关闭缺陷统计'" />
      <KpiCard label="阻塞 / 严重" :value="stats.bySeverity.blocker + stats.bySeverity.critical" unit="个" tone="danger" foot="优先处理项" />
    </div>

    <section class="bf-panel" style="margin-top: 14px">
      <div class="bf-toolbar">
        <el-input v-model="keyword" placeholder="搜索缺陷编号 / 标题" clearable style="width: 240px">
          <template #prefix><Search :size="14" /></template>
        </el-input>
        <el-select v-model="projectFilter" placeholder="项目" clearable style="width: 160px">
          <el-option v-for="project in db.projects" :key="project.id" :label="project.name" :value="project.id" />
        </el-select>
        <el-select v-model="statusFilter" placeholder="状态" clearable style="width: 120px">
          <el-option v-for="(row, key) in defectStatus.map" :key="key" :label="row.label" :value="key" />
        </el-select>
        <el-button text @click="resetFilters">重置</el-button>
        <span class="grow" />
        <ListViewControls
          v-model:view="viewMode"
          v-model:advanced="advancedOpen"
          :saved-views="savedViews"
          :active-count="activeFilterCount"
          :selection="selection.length"
          @save="handleSaveView"
          @apply="(view) => applyFilter(view.filters)"
          @clear="clearFilters"
          @delete-view="removeView"
        >
          <template #bulk>
            <template v-if="selection.length">
              <el-button size="small" @click="bulkExport">导出所选</el-button>
              <el-button v-if="app.can('edit')" size="small" @click="bulkAssign">分派给我</el-button>
            </template>
          </template>
        </ListViewControls>
        <span class="bf-filter-count">未关闭 {{ openCount }}</span>
      </div>

      <div v-if="advancedOpen" class="advanced-row">
        <el-select v-model="severityFilter" placeholder="严重程度" clearable size="small" style="width: 120px">
          <el-option v-for="(row, key) in severity.map" :key="key" :label="row.label" :value="key" />
        </el-select>
        <el-select v-model="ownerFilter" placeholder="负责人" clearable size="small" style="width: 120px">
          <el-option v-for="member in db.members" :key="member.id" :label="member.name" :value="member.id" />
        </el-select>
        <span class="bf-sub">严重程度与负责人筛选；可与项目、状态组合保存为方案。</span>
      </div>

      <el-table
        v-if="viewMode === 'table'"
        :data="paged"
        size="small"
        @sort-change="onSortChange"
        @selection-change="onSelectionChange"
        @row-click="(row: Defect) => router.push(`/defects/${row.id}`)"
      >
        <el-table-column type="selection" width="38" />
        <el-table-column prop="code" label="编号" width="96" sortable="custom">
          <template #default="{ row }"><span class="bf-table-code">{{ row.code }}</span></template>
        </el-table-column>
        <el-table-column prop="title" label="缺陷标题" min-width="250" sortable="custom">
          <template #default="{ row }">
            <div class="bf-table-name">{{ row.title }}</div>
            <div class="bf-sub">{{ projectName(row.projectId) }} · {{ versionLabel(row.hardwareVersionId) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="严重程度" width="88">
          <template #default="{ row }"><StatusPill :label="severity.get(row.severity).label" :tone="severity.get(row.severity).tone" /></template>
        </el-table-column>
        <el-table-column label="优先级" width="82">
          <template #default="{ row }"><StatusPill :label="priority.get(row.priority).label" :tone="priority.get(row.priority).tone" /></template>
        </el-table-column>
        <el-table-column label="状态" width="90" sortable="custom" prop="status">
          <template #default="{ row }"><StatusPill :label="defectStatus.get(row.status).label" :tone="defectStatus.get(row.status).tone" /></template>
        </el-table-column>
        <el-table-column label="负责人" width="88">
          <template #default="{ row }">{{ memberName(row.ownerId) }}</template>
        </el-table-column>
        <el-table-column label="关联执行" width="96">
          <template #default="{ row }">
            <router-link v-if="row.executionId" :to="`/test-executions/${row.executionId}`" class="mono link" @click.stop>
              {{ row.executionId }}
            </router-link>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="发现时间" width="102" sortable="custom" prop="foundAt">
          <template #default="{ row }"><span class="bf-sub num">{{ fmtDate(row.foundAt) }}</span></template>
        </el-table-column>
        <el-table-column label="持续" width="70" align="right">
          <template #default="{ row }">
            <span class="bf-sub">{{ row.status === 'closed' ? '已关闭' : `${ageDays(row)} 天` }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ row }">
            <el-button size="small" text @click.stop="router.push(`/defects/${row.id}`)">处理</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-else class="defect-cards">
        <EntityCard
          v-for="defect in paged"
          :key="defect.id"
          :title="defect.title"
          :subtitle="`${defect.code} · ${projectName(defect.projectId)}`"
          @click="router.push(`/defects/${defect.id}`)"
        >
          <template #badge>
            <StatusPill :label="defectStatus.get(defect.status).label" :tone="defectStatus.get(defect.status).tone" />
          </template>
          <div class="card-line"><span>严重程度</span><b>{{ severity.get(defect.severity).label }}</b></div>
          <div class="card-line"><span>负责人</span><b>{{ memberName(defect.ownerId) }}</b></div>
          <div class="card-line"><span>关联执行</span><b>{{ defect.executionId ?? '—' }}</b></div>
          <div class="card-line"><span>发现时间</span><b>{{ fmtDate(defect.foundAt) }}</b></div>
          <template #actions>
            <el-button size="small" text @click.stop="router.push(`/defects/${defect.id}`)">处理</el-button>
          </template>
        </EntityCard>
      </div>

      <DataPager v-model:page="page" v-model:page-size="pageSize" :total="total" />
    </section>

    <el-dialog v-model="dialogOpen" title="新建缺陷" width="720px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="96px">
        <el-form-item label="缺陷标题" prop="title">
          <el-input v-model="form.title" maxlength="90" show-word-limit />
        </el-form-item>
        <el-form-item label="缺陷描述" prop="description">
          <el-input v-model="form.description" type="textarea" :rows="3" maxlength="600" show-word-limit />
        </el-form-item>
        <div class="form-grid">
          <el-form-item label="严重程度">
            <el-select v-model="form.severity" style="width: 100%">
              <el-option v-for="(row, key) in severity.map" :key="key" :label="row.label" :value="key" />
            </el-select>
          </el-form-item>
          <el-form-item label="优先级">
            <el-select v-model="form.priority" style="width: 100%">
              <el-option v-for="(row, key) in priority.map" :key="key" :label="row.label" :value="key" />
            </el-select>
          </el-form-item>
          <el-form-item label="所属项目" prop="projectId">
            <el-select v-model="form.projectId" style="width: 100%" @update:model-value="onProjectChange">
              <el-option v-for="project in db.projects" :key="project.id" :label="project.name" :value="project.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="产品" prop="productId">
            <el-select v-model="form.productId" style="width: 100%">
              <el-option v-for="product in projectProducts" :key="product.id" :label="product.name" :value="product.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="硬件版本">
            <el-select v-model="form.hardwareVersionId" style="width: 100%" clearable>
              <el-option v-for="version in hardwareVersions" :key="version.id" :label="version.label" :value="version.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="固件版本">
            <el-select v-model="form.firmwareVersionId" style="width: 100%" clearable>
              <el-option v-for="version in firmwareVersions" :key="version.id" :label="version.label" :value="version.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="关联执行">
            <el-select v-model="form.executionId" style="width: 100%" clearable filterable @update:model-value="onExecutionChange">
              <el-option v-for="run in projectRuns" :key="run.id" :label="`${run.code} · ${run.result}`" :value="run.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="负责人" prop="ownerId">
            <el-select v-model="form.ownerId" style="width: 100%">
              <el-option v-for="member in db.members" :key="member.id" :label="member.name" :value="member.id" />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item label="复现步骤">
          <el-input v-model="form.steps" type="textarea" :rows="3" placeholder="1. 设置输入 48V…&#10;2. 满载 50A…" />
        </el-form-item>
      </el-form>
      <div class="bf-hint">缺陷关闭前必须提交验证记录（关联 PASS 的回归执行），系统会阻止无验证记录的关闭操作。</div>
      <template #footer>
        <el-button @click="dialogOpen = false">取消</el-button>
        <el-button type="primary" @click="save">创建缺陷</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Download, Plus, Search } from 'lucide-vue-next'
import type { Defect, DefectStatus, Priority, Severity } from '@/types'
import { db } from '@/services/db'
import { defectService } from '@/services/defectService'
import { executionService } from '@/services/executionService'
import { useAppStore } from '@/stores/app'
import { useTable } from '@/composables/useTable'
import { useListView } from '@/composables/useListView'
import PageHeader from '@/components/common/PageHeader.vue'
import KpiCard from '@/components/common/KpiCard.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import DataPager from '@/components/common/DataPager.vue'
import ListViewControls from '@/components/common/ListViewControls.vue'
import EntityCard from '@/components/common/EntityCard.vue'
import { defectStatus, fmtDate, priority, severity } from '@/utils/format'
import { downloadText, toCsv } from '@/utils/csv'

const route = useRoute()
const router = useRouter()
const app = useAppStore()

const { viewMode, advancedOpen, savedViews, saveView, removeView, persistFilters, loadFilters } = useListView('defects')
const stored = loadFilters()

const keyword = ref(stored.keyword ?? '')
const projectFilter = ref(typeof route.query.project === 'string' ? route.query.project : (stored.project ?? ''))
const statusFilter = ref<DefectStatus | ''>((stored.status as DefectStatus) ?? '')
const severityFilter = ref<Severity | ''>((stored.severity as Severity) ?? '')
const ownerFilter = ref(stored.owner ?? '')
const selection = ref<Defect[]>([])

const filterPayload = computed<Record<string, string>>(() => ({
  keyword: keyword.value,
  project: projectFilter.value,
  status: statusFilter.value,
  severity: severityFilter.value,
  owner: ownerFilter.value,
}))

const activeFilterCount = computed(
  () => [keyword.value, projectFilter.value, statusFilter.value, severityFilter.value, ownerFilter.value].filter(Boolean).length,
)

const applyFilter = (filters: Record<string, string>) => {
  keyword.value = filters.keyword ?? ''
  projectFilter.value = filters.project ?? ''
  statusFilter.value = (filters.status as DefectStatus) ?? ''
  severityFilter.value = (filters.severity as Severity) ?? ''
  ownerFilter.value = filters.owner ?? ''
}

const clearFilters = () => {
  keyword.value = ''
  projectFilter.value = ''
  statusFilter.value = ''
  severityFilter.value = ''
  ownerFilter.value = ''
}

const handleSaveView = (name: string) => {
  saveView(name, filterPayload.value)
  ElMessage.success(`筛选方案「${name}」已保存`)
}

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return db.defects.filter((row) => {
    if (projectFilter.value && row.projectId !== projectFilter.value) return false
    if (statusFilter.value && row.status !== statusFilter.value) return false
    if (severityFilter.value && row.severity !== severityFilter.value) return false
    if (ownerFilter.value && row.ownerId !== ownerFilter.value) return false
    if (kw && !`${row.code} ${row.title} ${row.description}`.toLowerCase().includes(kw)) return false
    return true
  })
})

const accessors = {
  code: (row: Defect) => row.code,
  title: (row: Defect) => row.title,
  status: (row: Defect) => row.status,
  foundAt: (row: Defect) => row.foundAt,
}

const { page, pageSize, total, paged, onSortChange } = useTable(filtered, { pageSize: 10, accessors })

watch(filterPayload, (value) => {
  persistFilters(value)
  page.value = 1
})

const stats = computed(() => defectService.stats())
const openCount = computed(() => filtered.value.filter((d) => d.status !== 'closed').length)
const ageDays = (row: Defect) => Math.max(0, Math.round((Date.now() - new Date(row.foundAt).getTime()) / 86400000))

const projectName = (id: string) => db.projects.find((p) => p.id === id)?.name ?? id
const versionLabel = (id?: string) => (id ? db.versions.find((v) => v.id === id)?.version ?? id : '—')
const memberName = (id: string) => db.members.find((m) => m.id === id)?.name ?? id

const resetFilters = () => clearFilters()

const dialogOpen = ref(false)
const formRef = ref<FormInstance>()

const emptyForm = () => ({
  title: '',
  description: '',
  severity: 'major' as Severity,
  priority: 'P1' as Priority,
  projectId: projectFilter.value || db.projects[0]?.id || '',
  productId: '',
  hardwareVersionId: '',
  firmwareVersionId: '',
  executionId: '',
  caseId: '',
  steps: '',
  ownerId: app.currentUser.id,
})

const form = reactive(emptyForm())

const rules: FormRules = {
  title: [{ required: true, message: '请输入缺陷标题', trigger: 'blur' }],
  description: [{ required: true, message: '请输入缺陷描述', trigger: 'blur' }],
  projectId: [{ required: true, message: '请选择项目', trigger: 'change' }],
  productId: [{ required: true, message: '请选择产品', trigger: 'change' }],
  ownerId: [{ required: true, message: '请选择负责人', trigger: 'change' }],
}

const projectProducts = computed(() => db.products.filter((p) => p.projectId === form.projectId))
const hardwareVersions = computed(() => db.versions.filter((v) => v.productId === form.productId && v.kind === 'hardware'))
const firmwareVersions = computed(() => db.versions.filter((v) => v.productId === form.productId && v.kind === 'firmware'))
const projectRuns = computed(() =>
  db.executions.filter((e) => e.projectId === form.projectId).slice().sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1)),
)

const onProjectChange = (projectId: string) => {
  form.productId = db.products.find((p) => p.projectId === projectId)?.id ?? ''
  form.hardwareVersionId = ''
  form.firmwareVersionId = ''
  form.executionId = ''
  form.caseId = ''
  form.steps = ''
}

const onExecutionChange = (executionId: string) => {
  if (!executionId) return
  const run = db.executions.find((e) => e.id === executionId)
  if (!run) return
  const draft = executionService.defectDraft(executionId)
  if (!draft) return
  Object.assign(form, {
    ...form,
    ...draft,
    projectId: run.projectId,
    productId: run.productId,
    hardwareVersionId: run.hardwareVersionId,
    firmwareVersionId: run.firmwareVersionId ?? '',
    caseId: run.caseId,
  })
}

const openCreate = (prefill?: Record<string, unknown>) => {
  Object.assign(form, emptyForm(), prefill ?? {})
  const project = db.projects.find((p) => p.id === form.projectId)
  if (project) {
    form.productId = form.productId || db.products.find((p) => p.projectId === project.id)?.id || ''
    const hardware = db.versions.find((v) => v.productId === form.productId && v.kind === 'hardware')
    form.hardwareVersionId = form.hardwareVersionId || hardware?.id || ''
  }
  dialogOpen.value = true
}

const save = async () => {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  const created = defectService.create({
    title: form.title,
    description: form.description,
    severity: form.severity,
    priority: form.priority,
    projectId: form.projectId,
    productId: form.productId,
    hardwareVersionId: form.hardwareVersionId || undefined,
    firmwareVersionId: form.firmwareVersionId || undefined,
    executionId: form.executionId || undefined,
    caseId: form.caseId || undefined,
    steps: form.steps,
    evidence: [],
    ownerId: form.ownerId,
  })
  ElMessage.success(`缺陷 ${created.code} 已创建`)
  dialogOpen.value = false
  router.push(`/defects/${created.id}`)
}

const writeCsv = (rows: Defect[]) => {
  downloadText(
    `benchflow-defects-${new Date().toISOString().slice(0, 10)}.csv`,
    toCsv(
      ['缺陷编号', '标题', '项目', '产品版本', '严重程度', '优先级', '状态', '负责人', '发现人', '发现时间', '关联执行'],
      rows.map((d) => [
        d.code,
        d.title,
        projectName(d.projectId),
        versionLabel(d.hardwareVersionId),
        severity.get(d.severity).label,
        priority.get(d.priority).label,
        defectStatus.get(d.status).label,
        memberName(d.ownerId),
        memberName(d.reporterId),
        d.foundAt.slice(0, 10),
        d.executionId ?? '',
      ]),
    ),
  )
  ElMessage.success(`已导出 ${rows.length} 条缺陷`)
}

const exportCsv = () => writeCsv(filtered.value)
const bulkExport = () => writeCsv(selection.value)
const onSelectionChange = (rows: Defect[]) => {
  selection.value = rows
}

const bulkAssign = () => {
  if (!selection.value.length) return
  selection.value.forEach((defect) => defectService.assign(defect.id, app.currentUser.id))
  ElMessage.success(`已将 ${selection.value.length} 个缺陷分派给我`)
  selection.value = []
}

if (route.query.create === '1' && app.can('create')) {
  const executionId = typeof route.query.execution === 'string' ? route.query.execution : ''
  if (executionId) {
    const draft = executionService.defectDraft(executionId)
    openCreate(draft ?? undefined)
  } else {
    openCreate(typeof route.query.project === 'string' ? { projectId: route.query.project } : undefined)
  }
}
</script>

<style scoped>
.advanced-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--bf-surface-2);
  border-bottom: 1px solid var(--bf-border);
  flex-wrap: wrap;
}

.defect-cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  padding: 12px;
}

.card-line {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 11.3px;
}

.card-line span {
  color: var(--bf-ink-3);
}

.card-line b {
  font-weight: 500;
  text-align: right;
}

@media (max-width: 1280px) {
  .defect-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .defect-cards {
    grid-template-columns: minmax(0, 1fr);
  }
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 14px;
}

.link {
  color: var(--bf-accent);
  font-size: 11.5px;
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
