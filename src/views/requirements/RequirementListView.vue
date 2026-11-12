<template>
  <div class="bf-page">
    <PageHeader title="需求管理" :subtitle="`${filtered.length} 条需求 · 覆盖率 ${coverage.rate}% · 需求 ↔ 用例 ↔ 执行 ↔ 缺陷 双向追踪`">
      <template #actions>
        <el-button size="small" @click="exportCsv"><Download :size="14" /> 导出</el-button>
        <el-button v-if="app.can('create')" size="small" type="primary" @click="openCreate">
          <Plus :size="14" /> 新建需求
        </el-button>
      </template>
    </PageHeader>

    <section class="bf-panel">
      <div class="bf-toolbar">
        <el-input v-model="keyword" placeholder="搜索需求编号 / 名称 / 描述" clearable style="width: 240px">
          <template #prefix><Search :size="14" /></template>
        </el-input>
        <el-select v-model="projectFilter" placeholder="项目" clearable style="width: 170px">
          <el-option v-for="project in db.projects" :key="project.id" :label="project.name" :value="project.id" />
        </el-select>
        <el-select v-model="statusFilter" placeholder="状态" clearable style="width: 120px">
          <el-option v-for="(row, key) in requirementStatus.map" :key="key" :label="row.label" :value="key" />
        </el-select>
        <el-button text @click="resetFilters">重置</el-button>
        <span class="grow" />
        <ListViewControls
          v-model:view="viewMode"
          v-model:advanced="advancedOpen"
          :saved-views="savedViews"
          :active-count="activeFilterCount"
          @save="handleSaveView"
          @apply="(view) => applyFilter(view.filters)"
          @clear="clearFilters"
          @delete-view="removeView"
        />
        <span class="bf-filter-count">
          已覆盖 {{ coverage.covered }} / {{ coverage.total }} · 已验证 {{ coverage.verified }}
        </span>
      </div>

      <div v-if="advancedOpen" class="advanced-row">
        <el-select v-model="priorityFilter" placeholder="优先级" clearable size="small" style="width: 110px">
          <el-option v-for="(row, key) in priority.map" :key="key" :label="row.label" :value="key" />
        </el-select>
        <el-select v-model="sourceFilter" placeholder="来源" clearable size="small" style="width: 120px">
          <el-option v-for="(row, key) in requirementSource.map" :key="key" :label="row.label" :value="key" />
        </el-select>
        <span class="bf-sub">按优先级与来源筛选，可保存为常用方案。</span>
      </div>

      <el-table v-if="viewMode === 'table'" :data="paged" size="small" @sort-change="onSortChange">
        <el-table-column prop="code" label="编号" width="122" sortable="custom">
          <template #default="{ row }">
            <span class="bf-table-code">{{ row.code }}</span>
            <div v-if="row.parentId" class="bf-sub">子需求 · {{ row.parentId }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="需求名称" min-width="220" sortable="custom">
          <template #default="{ row }">
            <button class="req-link" type="button" @click="openDrawer(row)">{{ row.name }}</button>
            <div class="bf-sub ellipsis">{{ row.description }}</div>
          </template>
        </el-table-column>
        <el-table-column label="项目" width="150">
          <template #default="{ row }">{{ projectName(row.projectId) }}</template>
        </el-table-column>
        <el-table-column label="优先级" width="84">
          <template #default="{ row }"><StatusPill :label="priority.get(row.priority).label" :tone="priority.get(row.priority).tone" /></template>
        </el-table-column>
        <el-table-column label="来源" width="92">
          <template #default="{ row }">{{ requirementSource.get(row.source).label }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <StatusPill :label="requirementStatus.get(row.status).label" :tone="requirementStatus.get(row.status).tone" />
          </template>
        </el-table-column>
        <el-table-column label="覆盖" width="88">
          <template #default="{ row }">
            <StatusPill
              :label="row.caseIds.length ? (verified(row) ? '已验证' : '已覆盖') : '未覆盖'"
              :tone="row.caseIds.length ? (verified(row) ? 'success' : 'info') : 'warning'"
              dot
            />
          </template>
        </el-table-column>
        <el-table-column label="用例 / 缺陷" width="110">
          <template #default="{ row }">
            <span class="mono">{{ row.caseIds.length }}</span> / <span class="mono">{{ row.defectIds.length }}</span>
          </template>
        </el-table-column>
        <el-table-column label="负责人" width="88">
          <template #default="{ row }">{{ memberName(row.ownerId) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button size="small" text @click="openDrawer(row)">追踪</el-button>
            <el-dropdown v-if="app.can('edit')" trigger="click" @command="(cmd: string) => onCommand(cmd, row)">
              <el-button size="small" text @click.stop>更多<ChevronDown :size="12" /></el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="edit">编辑需求</el-dropdown-item>
                  <el-dropdown-item command="split">拆分需求</el-dropdown-item>
                  <el-dropdown-item command="delete" divided>删除需求</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
      </el-table>

      <div v-else class="req-cards">
        <EntityCard
          v-for="requirement in paged"
          :key="requirement.id"
          :title="requirement.name"
          :subtitle="`${requirement.code} · ${projectName(requirement.projectId)}`"
          @click="openDrawer(requirement)"
        >
          <template #badge>
            <StatusPill :label="requirementStatus.get(requirement.status).label" :tone="requirementStatus.get(requirement.status).tone" />
          </template>
          <div class="card-line"><span>优先级 / 来源</span><b>{{ priority.get(requirement.priority).label }} · {{ requirementSource.get(requirement.source).label }}</b></div>
          <div class="card-line"><span>关联用例</span><b>{{ requirement.caseIds.length }} 条</b></div>
          <div class="card-line"><span>覆盖状态</span><b>{{ requirement.caseIds.length ? (verified(requirement) ? '已验证' : '已覆盖') : '未覆盖' }}</b></div>
          <div class="card-line"><span>负责人</span><b>{{ memberName(requirement.ownerId) }}</b></div>
          <template #actions>
            <el-button size="small" text @click.stop="openDrawer(requirement)">追踪</el-button>
            <el-button v-if="app.can('edit')" size="small" text @click.stop="openEdit(requirement)">编辑</el-button>
          </template>
        </EntityCard>
      </div>

      <DataPager v-model:page="page" v-model:page-size="pageSize" :total="total" />
    </section>

    <el-dialog v-model="dialogOpen" :title="editing ? '编辑需求' : '新建需求'" width="720px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="92px">
        <div class="form-grid">
          <el-form-item label="所属项目" prop="projectId">
            <el-select v-model="form.projectId" style="width: 100%">
              <el-option v-for="project in db.projects" :key="project.id" :label="project.name" :value="project.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="负责人" prop="ownerId">
            <el-select v-model="form.ownerId" style="width: 100%">
              <el-option v-for="member in db.members" :key="member.id" :label="member.name" :value="member.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="优先级">
            <el-select v-model="form.priority" style="width: 100%">
              <el-option v-for="(row, key) in priority.map" :key="key" :label="row.label" :value="key" />
            </el-select>
          </el-form-item>
          <el-form-item label="来源">
            <el-select v-model="form.source" style="width: 100%">
              <el-option v-for="(row, key) in requirementSource.map" :key="key" :label="row.label" :value="key" />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item label="需求名称" prop="name">
          <el-input v-model="form.name" maxlength="80" show-word-limit />
        </el-form-item>
        <el-form-item label="需求描述" prop="description">
          <el-input v-model="form.description" type="textarea" :rows="3" maxlength="400" show-word-limit />
        </el-form-item>
        <el-form-item label="验收标准" prop="acceptance">
          <el-input v-model="form.acceptance" type="textarea" :rows="2" maxlength="300" placeholder="可度量、可判定的验收条件" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status" style="width: 100%">
            <el-option v-for="(row, key) in requirementStatus.map" :key="key" :label="row.label" :value="key" />
          </el-select>
        </el-form-item>
        <el-form-item label="关联用例">
          <el-select v-model="form.caseIds" multiple filterable style="width: 100%" placeholder="选择用于验证该需求的测试用例">
            <el-option v-for="testCase in db.cases" :key="testCase.id" :label="`${testCase.code} · ${testCase.name}`" :value="testCase.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogOpen = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="splitOpen" title="拆分需求" width="560px">
      <p class="bf-sub split-hint">每行生成一条子需求，继承当前需求的项目、来源、优先级与负责人。</p>
      <el-input v-model="splitText" type="textarea" :rows="6" placeholder="例如：&#10;输入范围 36–60V 输出稳定&#10;满载效率 ≥94%" />
      <template #footer>
        <el-button @click="splitOpen = false">取消</el-button>
        <el-button type="primary" @click="doSplit">拆分</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="drawerOpen" :title="active ? `需求追踪 · ${active.code}` : ''" size="620px">
      <template v-if="active">
        <h3 class="drawer-title">{{ active.name }}</h3>
        <p class="bf-sub drawer-desc">{{ active.description }}</p>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="状态">
            <StatusPill :label="requirementStatus.get(active.status).label" :tone="requirementStatus.get(active.status).tone" />
          </el-descriptions-item>
          <el-descriptions-item label="优先级">{{ priority.get(active.priority).label }}</el-descriptions-item>
          <el-descriptions-item label="验收标准" :span="2">{{ active.acceptance }}</el-descriptions-item>
        </el-descriptions>

        <h4 class="drawer-sub">关联测试用例</h4>
        <el-table :data="traceCases" size="small">
          <el-table-column prop="code" label="用例" width="92">
            <template #default="{ row }"><span class="bf-table-code">{{ row.code }}</span></template>
          </el-table-column>
          <el-table-column prop="name" label="名称" min-width="150" />
          <el-table-column label="最新执行" width="100">
            <template #default="{ row }">
              <StatusPill v-if="row.latest" :label="runResult.get(row.latest.result).label" :tone="runResult.get(row.latest).tone" dot />
              <span v-else class="muted">未执行</span>
            </template>
          </el-table-column>
          <el-table-column label="执行" width="70">
            <template #default="{ row }">
              <button v-if="row.latest" class="bf-link-btn" type="button" @click="router.push(`/test-executions/${row.latest.id}`)">查看</button>
              <span v-else class="muted">—</span>
            </template>
          </el-table-column>
        </el-table>
        <EmptyState v-if="traceCases.length === 0" text="尚未关联测试用例" hint="在需求编辑中选择用例，即可建立追踪关系。" />

        <h4 class="drawer-sub">关联缺陷</h4>
        <div class="defect-links">
          <router-link v-for="code in active.defectIds" :key="code" :to="`/defects/${code}`" class="defect-link">
            <Bug :size="13" /> {{ code }} · {{ defectTitle(code) }}
          </router-link>
          <span v-if="active.defectIds.length === 0" class="bf-sub">无关联缺陷</span>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Bug, ChevronDown, Download, Plus, Search } from 'lucide-vue-next'
import type { Priority, Requirement, RequirementSource, RequirementStatus, RunResult, TestCase } from '@/types'
import { db } from '@/services/db'
import { requirementService } from '@/services/projectService'
import type { RequirementInput } from '@/services/projectService'
import { useAppStore } from '@/stores/app'
import { useTable } from '@/composables/useTable'
import { useListView } from '@/composables/useListView'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import DataPager from '@/components/common/DataPager.vue'
import ListViewControls from '@/components/common/ListViewControls.vue'
import EntityCard from '@/components/common/EntityCard.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { priority, requirementSource, requirementStatus, runResult } from '@/utils/format'
import { downloadText, toCsv } from '@/utils/csv'

const route = useRoute()
const router = useRouter()
const app = useAppStore()

const { viewMode, advancedOpen, savedViews, saveView, removeView, persistFilters, loadFilters } = useListView('requirements')
const stored = loadFilters()

const keyword = ref(stored.keyword ?? '')
const projectFilter = ref(typeof route.query.project === 'string' ? route.query.project : (stored.project ?? ''))
const statusFilter = ref<RequirementStatus | ''>((stored.status as RequirementStatus) ?? '')
const priorityFilter = ref<Priority | ''>((stored.priority as Priority) ?? '')
const sourceFilter = ref<RequirementSource | ''>((stored.source as RequirementSource) ?? '')

const filterPayload = computed<Record<string, string>>(() => ({
  keyword: keyword.value,
  project: projectFilter.value,
  status: statusFilter.value,
  priority: priorityFilter.value,
  source: sourceFilter.value,
}))

const activeFilterCount = computed(
  () => [keyword.value, projectFilter.value, statusFilter.value, priorityFilter.value, sourceFilter.value].filter(Boolean).length,
)

const applyFilter = (filters: Record<string, string>) => {
  keyword.value = filters.keyword ?? ''
  projectFilter.value = filters.project ?? ''
  statusFilter.value = (filters.status as RequirementStatus) ?? ''
  priorityFilter.value = (filters.priority as Priority) ?? ''
  sourceFilter.value = (filters.source as RequirementSource) ?? ''
}

const clearFilters = () => {
  keyword.value = ''
  projectFilter.value = ''
  statusFilter.value = ''
  priorityFilter.value = ''
  sourceFilter.value = ''
}

const handleSaveView = (name: string) => {
  saveView(name, filterPayload.value)
  ElMessage.success(`筛选方案「${name}」已保存`)
}

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return db.requirements.filter((row) => {
    if (projectFilter.value && row.projectId !== projectFilter.value) return false
    if (statusFilter.value && row.status !== statusFilter.value) return false
    if (priorityFilter.value && row.priority !== priorityFilter.value) return false
    if (sourceFilter.value && row.source !== sourceFilter.value) return false
    if (kw && !`${row.code} ${row.name} ${row.description}`.toLowerCase().includes(kw)) return false
    return true
  })
})

const accessors = {
  code: (row: Requirement) => row.code,
  name: (row: Requirement) => row.name,
}

const { page, pageSize, total, paged, onSortChange } = useTable(filtered, { pageSize: 10, accessors })

watch(filterPayload, (value) => {
  persistFilters(value)
  page.value = 1
})

const passedCaseIds = computed(
  () => new Set(db.executions.filter((e) => e.result === 'PASS').map((e) => e.caseId)),
)

const verified = (row: Requirement) => row.caseIds.some((id) => passedCaseIds.value.has(id))

const coverage = computed(() => {
  const rows = filtered.value
  const covered = rows.filter((r) => r.caseIds.length > 0).length
  const verifiedCount = rows.filter((r) => verified(r)).length
  return {
    total: rows.length,
    covered,
    verified: verifiedCount,
    rate: rows.length ? Math.round((covered / rows.length) * 1000) / 10 : 0,
  }
})

const projectName = (id: string) => db.projects.find((p) => p.id === id)?.name ?? id
const memberName = (id: string) => db.members.find((m) => m.id === id)?.name ?? id
const defectTitle = (code: string) => db.defects.find((d) => d.code === code)?.title ?? ''

const resetFilters = () => clearFilters()

const dialogOpen = ref(false)
const editing = ref<Requirement | null>(null)
const formRef = ref<FormInstance>()
const form = reactive<RequirementInput>({
  projectId: '',
  name: '',
  description: '',
  priority: 'P1',
  source: 'internal',
  acceptance: '',
  ownerId: app.currentUser.id,
  status: 'draft',
  caseIds: [],
  defectIds: [],
})

const rules: FormRules = {
  projectId: [{ required: true, message: '请选择项目', trigger: 'change' }],
  name: [{ required: true, message: '请输入需求名称', trigger: 'blur' }],
  description: [{ required: true, message: '请输入需求描述', trigger: 'blur' }],
  acceptance: [{ required: true, message: '请填写验收标准', trigger: 'blur' }],
  ownerId: [{ required: true, message: '请选择负责人', trigger: 'change' }],
}

const openCreate = () => {
  editing.value = null
  Object.assign(form, {
    projectId: projectFilter.value || db.projects[0]?.id || '',
    name: '',
    description: '',
    priority: 'P1',
    source: 'internal',
    acceptance: '',
    ownerId: app.currentUser.id,
    status: 'draft',
    caseIds: [],
    defectIds: [],
  })
  dialogOpen.value = true
}

const openEdit = (row: Requirement) => {
  editing.value = row
  Object.assign(form, {
    projectId: row.projectId,
    name: row.name,
    description: row.description,
    priority: row.priority,
    source: row.source,
    acceptance: row.acceptance,
    ownerId: row.ownerId,
    status: row.status,
    caseIds: [...row.caseIds],
    defectIds: [...row.defectIds],
    parentId: row.parentId,
  })
  dialogOpen.value = true
}

const save = async () => {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  if (editing.value) {
    requirementService.update(editing.value.id, { ...form })
    ElMessage.success('需求已更新')
  } else {
    const created = requirementService.create({ ...form })
    ElMessage.success(`需求 ${created.code} 已创建`)
  }
  dialogOpen.value = false
}

const splitOpen = ref(false)
const splitText = ref('')
const splitTarget = ref<Requirement | null>(null)

const doSplit = () => {
  if (!splitTarget.value) return
  const lines = splitText.value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length === 0) {
    ElMessage.warning('请至少填写一条子需求')
    return
  }
  requirementService.split(
    splitTarget.value.id,
    lines.map((line) => ({ name: line, description: `由 ${splitTarget.value?.code} 拆分而来。` })),
  )
  ElMessage.success(`已拆分为 ${lines.length} 条子需求`)
  splitOpen.value = false
  splitText.value = ''
}

const onCommand = async (command: string, row: Requirement) => {
  if (command === 'edit') {
    openEdit(row)
    return
  }
  if (command === 'split') {
    splitTarget.value = row
    splitText.value = ''
    splitOpen.value = true
    return
  }
  if (command === 'delete') {
    await ElMessageBox.confirm(`删除需求「${row.name}」？已关联的用例与缺陷不会删除。`, '删除需求', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    requirementService.remove(row.id)
    ElMessage.success('需求已删除')
  }
}

const drawerOpen = ref(false)
const active = ref<Requirement | null>(null)

interface TraceCase extends TestCase {
  latest?: { id: string; result: RunResult }
}

const traceCases = computed<TraceCase[]>(() => {
  if (!active.value) return []
  return active.value.caseIds
    .map((id) => db.cases.find((c) => c.id === id))
    .filter((testCase): testCase is TestCase => Boolean(testCase))
    .map((testCase) => {
      const runs = db.executions
        .filter((e) => e.caseId === testCase.id)
        .slice()
        .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
      return { ...testCase, latest: runs[0] ? { id: runs[0].id, result: runs[0].result } : undefined }
    })
})

const openDrawer = (row: Requirement) => {
  active.value = row
  drawerOpen.value = true
}

const exportCsv = () => {
  downloadText(
    `benchflow-requirements-${new Date().toISOString().slice(0, 10)}.csv`,
    toCsv(
      ['需求编号', '需求名称', '项目', '优先级', '来源', '状态', '关联用例', '关联缺陷', '验收标准'],
      filtered.value.map((r) => [
        r.code,
        r.name,
        projectName(r.projectId),
        priority.get(r.priority).label,
        requirementSource.get(r.source).label,
        requirementStatus.get(r.status).label,
        r.caseIds.join(' / '),
        r.defectIds.join(' / '),
        r.acceptance,
      ]),
    ),
  )
  ElMessage.success('已导出需求 CSV')
}

watch(
  () => route.query.project,
  (value) => {
    if (typeof value === 'string') projectFilter.value = value
  },
)

if (route.query.create === '1' && app.can('create')) openCreate()
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

.req-cards {
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
  .req-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .req-cards {
    grid-template-columns: minmax(0, 1fr);
  }
}

.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 420px;
}

.req-link {
  border: none;
  background: none;
  padding: 0;
  font-size: 12.8px;
  font-weight: 550;
  color: var(--bf-ink);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
}

.req-link:hover {
  color: var(--bf-accent);
  text-decoration: underline;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 14px;
}

.split-hint {
  margin-bottom: 8px;
}

.drawer-title {
  font-size: 15px;
  font-weight: 620;
  margin-bottom: 4px;
}

.drawer-desc {
  margin-bottom: 12px;
  line-height: 1.6;
}

.drawer-sub {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--bf-ink-2);
  margin: 18px 0 8px;
}

.defect-links {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.defect-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.3px;
  color: var(--bf-danger);
}

@media (max-width: 760px) {
  .form-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
