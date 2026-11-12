<template>
  <div class="bf-page">
    <PageHeader title="项目管理" :subtitle="`${filtered.length} 个项目 · 统一管理需求、版本、测试计划与缺陷`">
      <template #actions>
        <el-button size="small" @click="exportCsv"><Download :size="14" /> 导出</el-button>
        <el-button v-if="app.can('create')" size="small" type="primary" @click="openCreate">
          <Plus :size="14" /> 新建项目
        </el-button>
      </template>
    </PageHeader>

    <section class="bf-panel">
      <div class="bf-toolbar">
        <el-input v-model="keyword" placeholder="搜索项目编号 / 名称 / 描述" clearable size="default" style="width: 260px">
          <template #prefix><Search :size="14" /></template>
        </el-input>
        <el-select v-model="statusFilter" placeholder="状态" clearable size="default" style="width: 130px">
          <el-option v-for="(row, key) in projectStatus.map" :key="key" :label="row.label" :value="key" />
        </el-select>
        <el-select v-model="ownerFilter" placeholder="负责人" clearable size="default" style="width: 140px">
          <el-option v-for="member in db.members" :key="member.id" :label="member.name" :value="member.id" />
        </el-select>
        <el-select v-model="tagFilter" placeholder="标签" clearable size="default" style="width: 130px">
          <el-option v-for="tag in allTags" :key="tag" :label="tag" :value="tag" />
        </el-select>
        <el-button size="default" text @click="resetFilters">重置</el-button>
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
            <template v-if="selection.length > 0 && app.can('edit')">
              <el-button size="small" @click="bulkArchive">批量归档</el-button>
              <el-button size="small" @click="bulkExport">导出所选</el-button>
            </template>
          </template>
        </ListViewControls>
        <span class="bf-filter-count">显示 {{ filtered.length }} / {{ db.projects.length }}</span>
      </div>

      <div v-if="advancedOpen" class="advanced-row">
        <el-select v-model="priorityFilter" placeholder="优先级" clearable size="small" style="width: 120px">
          <el-option v-for="(row, key) in priority.map" :key="key" :label="row.label" :value="key" />
        </el-select>
        <el-select v-model="typeFilter" placeholder="项目类型" clearable size="small" style="width: 130px">
          <el-option v-for="(row, key) in projectType.map" :key="key" :label="row.label" :value="key" />
        </el-select>
        <el-date-picker
          v-model="advancedDateRange"
          type="daterange"
          size="small"
          value-format="YYYY-MM-DD"
          start-placeholder="计划结束起"
          end-placeholder="计划结束止"
          style="width: 240px"
        />
        <span class="bf-sub">按计划结束日期筛选；常用条件可保存为筛选方案。</span>
      </div>

      <el-table
        v-if="viewMode === 'table'"
        :data="paged"
        size="small"
        @sort-change="onSortChange"
        @selection-change="onSelectionChange"
        @row-click="(row: Project) => router.push(`/projects/${row.id}`)"
      >
        <el-table-column type="selection" width="38" />
        <el-table-column prop="code" label="编号" width="80" sortable="custom">
          <template #default="{ row }"><span class="bf-table-code">{{ row.code }}</span></template>
        </el-table-column>
        <el-table-column prop="name" label="项目名称" min-width="220" sortable="custom">
          <template #default="{ row }">
            <div class="bf-table-name">{{ row.name }}</div>
            <div class="bf-sub ellipsis">{{ row.description }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="type" label="类型" width="80">
          <template #default="{ row }">
            <StatusPill :label="projectType.get(row.type).label" :tone="projectType.get(row.type).tone" />
          </template>
        </el-table-column>
        <el-table-column label="负责人" width="88">
          <template #default="{ row }">
            <div class="bf-row">
              <UserAvatar :name="memberName(row.ownerId)" :color="memberColor(row.ownerId)" size="sm" />
              <span>{{ memberName(row.ownerId) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="成员" width="96">
          <template #default="{ row }">
            <div class="bf-avatar-stack">
              <UserAvatar
                v-for="memberId in row.memberIds.slice(0, 4)"
                :key="memberId"
                :name="memberName(memberId)"
                :color="memberColor(memberId)"
                size="sm"
              />
              <span v-if="row.memberIds.length > 4" class="bf-chip">+{{ row.memberIds.length - 4 }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="82" sortable="custom">
          <template #default="{ row }">
            <StatusPill :label="projectStatus.get(row.status).label" :tone="projectStatus.get(row.status).tone" />
          </template>
        </el-table-column>
        <el-table-column prop="priority" label="优先级" width="78" sortable="custom">
          <template #default="{ row }">
            <StatusPill :label="priority.get(row.priority).label" :tone="priority.get(row.priority).tone" />
          </template>
        </el-table-column>
        <el-table-column prop="plannedEndDate" label="计划结束" width="96" sortable="custom">
          <template #default="{ row }">
            <span class="num">{{ fmtDate(row.plannedEndDate) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="通过率 / 缺陷" width="112" align="right">
          <template #default="{ row }">
            <div class="num">{{ projectService.stats(row.id).passRate }}%</div>
            <div class="bf-sub num" :class="{ danger: projectService.stats(row.id).openDefects > 0 }">
              {{ projectService.stats(row.id).openDefects }} 个未关闭
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="156" fixed="right">
          <template #default="{ row }">
            <el-button size="small" text @click.stop="openQuick(row)">速览</el-button>
            <el-button size="small" text @click.stop="router.push(`/projects/${row.id}`)">详情</el-button>
            <el-dropdown v-if="app.can('edit')" trigger="click" @command="(cmd: string) => onRowCommand(cmd, row)">
              <el-button size="small" text @click.stop>更多<ChevronDown :size="12" /></el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="edit">编辑项目</el-dropdown-item>
                  <el-dropdown-item command="archive" :disabled="row.status === 'archived'">归档</el-dropdown-item>
                  <el-dropdown-item command="delete" divided :disabled="!app.can('delete')">删除</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
      </el-table>

      <div v-else class="project-cards">
        <EntityCard
          v-for="project in paged"
          :key="project.id"
          :title="project.name"
          :subtitle="`${project.code} · ${projectType.get(project.type).label}`"
          @click="router.push(`/projects/${project.id}`)"
        >
          <template #badge>
            <StatusPill :label="projectStatus.get(project.status).label" :tone="projectStatus.get(project.status).tone" />
          </template>
          <div class="card-line"><span>负责人</span><b>{{ memberName(project.ownerId) }}</b></div>
          <div class="card-line"><span>计划结束</span><b>{{ fmtDate(project.plannedEndDate) }}</b></div>
          <div class="card-line"><span>通过率 / 缺陷</span><b>{{ projectService.stats(project.id).passRate }}% · {{ projectService.stats(project.id).openDefects }} 个</b></div>
          <el-progress :percentage="projectService.stats(project.id).progress" :stroke-width="5" :show-text="false" />
          <template #actions>
            <el-button size="small" text @click.stop="openQuick(project)">速览</el-button>
            <el-button size="small" text @click.stop="router.push(`/projects/${project.id}`)">打开</el-button>
          </template>
        </EntityCard>
      </div>

      <DataPager v-model:page="page" v-model:page-size="pageSize" :total="total" />
    </section>

    <el-dialog v-model="dialogOpen" :title="editing ? '编辑项目' : '新建项目'" width="680px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="96px" label-position="right">
        <el-form-item label="项目名称" prop="name">
          <el-input v-model="form.name" maxlength="60" show-word-limit placeholder="例如：48V-12V DC-DC 电源" />
        </el-form-item>
        <el-form-item label="项目描述" prop="description">
          <el-input v-model="form.description" type="textarea" :rows="3" maxlength="300" show-word-limit placeholder="目标、范围与关键约束" />
        </el-form-item>
        <div class="form-grid">
          <el-form-item label="项目类型" prop="type">
            <el-select v-model="form.type" style="width: 100%">
              <el-option v-for="(row, key) in projectType.map" :key="key" :label="row.label" :value="key" />
            </el-select>
          </el-form-item>
          <el-form-item label="负责人" prop="ownerId">
            <el-select v-model="form.ownerId" style="width: 100%">
              <el-option v-for="member in db.members" :key="member.id" :label="`${member.name} · ${member.title}`" :value="member.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="状态" prop="status">
            <el-select v-model="form.status" style="width: 100%">
              <el-option v-for="(row, key) in projectStatus.map" :key="key" :label="row.label" :value="key" />
            </el-select>
          </el-form-item>
          <el-form-item label="优先级" prop="priority">
            <el-select v-model="form.priority" style="width: 100%">
              <el-option v-for="(row, key) in priority.map" :key="key" :label="row.label" :value="key" />
            </el-select>
          </el-form-item>
          <el-form-item label="开始日期" prop="startDate">
            <el-date-picker v-model="form.startDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
          </el-form-item>
          <el-form-item label="预计结束" prop="plannedEndDate">
            <el-date-picker v-model="form.plannedEndDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
          </el-form-item>
        </div>
        <el-form-item label="参与成员">
          <el-select v-model="form.memberIds" multiple filterable style="width: 100%">
            <el-option v-for="member in db.members" :key="member.id" :label="`${member.name} · ${member.title}`" :value="member.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="项目标签">
          <el-select v-model="form.tags" multiple filterable allow-create default-first-option style="width: 100%" placeholder="输入后回车创建标签">
            <el-option v-for="tag in allTags" :key="tag" :label="tag" :value="tag" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="quickOpen" title="项目速览" size="460px">
      <template v-if="quickProject">
        <div class="quick-code mono">{{ quickProject.code }}</div>
        <h3 class="quick-title">{{ quickProject.name }}</h3>
        <div class="bf-row" style="gap: 6px; margin-bottom: 10px">
          <StatusPill :label="projectStatus.get(quickProject.status).label" :tone="projectStatus.get(quickProject.status).tone" />
          <StatusPill :label="priority.get(quickProject.priority).label" :tone="priority.get(quickProject.priority).tone" />
          <span class="bf-chip">{{ projectType.get(quickProject.type).label }}</span>
        </div>
        <p class="quick-desc">{{ quickProject.description }}</p>
        <div class="quick-stats">
          <div><span>通过率</span><b>{{ projectService.stats(quickProject.id).passRate }}%</b></div>
          <div><span>未关闭缺陷</span><b>{{ projectService.stats(quickProject.id).openDefects }}</b></div>
          <div><span>执行次数</span><b>{{ projectService.stats(quickProject.id).runCount }}</b></div>
          <div><span>进度</span><b>{{ projectService.stats(quickProject.id).progress }}%</b></div>
        </div>
        <h4 class="quick-sub">项目风险</h4>
        <div class="quick-risks">
          <div v-for="(risk, index) in projectService.risks(quickProject.id)" :key="index" class="quick-risk" :class="risk.level">
            {{ risk.text }}
          </div>
        </div>
        <div class="quick-actions">
          <el-button size="small" @click="router.push(`/projects/${quickProject.id}`)">打开完整详情</el-button>
          <el-button size="small" @click="router.push(`/requirements?project=${quickProject.id}`)">需求矩阵</el-button>
          <el-button size="small" type="primary" @click="router.push(`/test-executions?project=${quickProject.id}`)">测试执行</el-button>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { ChevronDown, Download, Plus, Search } from 'lucide-vue-next'
import type { Project, ProjectStatus, ProjectType, Priority } from '@/types'
import { db } from '@/services/db'
import { projectService } from '@/services/projectService'
import type { ProjectInput } from '@/services/projectService'
import { useAppStore } from '@/stores/app'
import { useTable } from '@/composables/useTable'
import { useListView } from '@/composables/useListView'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import DataPager from '@/components/common/DataPager.vue'
import ListViewControls from '@/components/common/ListViewControls.vue'
import EntityCard from '@/components/common/EntityCard.vue'
import { fmtDate, priority as priorityDict, projectStatus as statusDict, projectType as typeDict } from '@/utils/format'
import { downloadText, toCsv } from '@/utils/csv'

const route = useRoute()
const router = useRouter()
const app = useAppStore()

const projectStatus = statusDict
const projectType = typeDict
const priority = priorityDict

const {
  viewMode,
  advancedOpen,
  savedViews,
  saveView,
  removeView,
  persistFilters,
  loadFilters,
} = useListView('projects')
const stored = loadFilters()

const keyword = ref(stored.keyword ?? '')
const statusFilter = ref<ProjectStatus | ''>((stored.status as ProjectStatus) ?? '')
const ownerFilter = ref(stored.owner ?? '')
const tagFilter = ref(stored.tag ?? '')
const priorityFilter = ref<Priority | ''>((stored.priority as Priority) ?? '')
const typeFilter = ref<ProjectType | ''>((stored.type as ProjectType) ?? '')
const dateFrom = ref(stored.dateFrom ?? '')
const dateTo = ref(stored.dateTo ?? '')
const selection = ref<Project[]>([])
const quickProject = ref<Project | null>(null)
const quickOpen = ref(false)

const activeFilterCount = computed(
  () =>
    [
      keyword.value,
      statusFilter.value,
      ownerFilter.value,
      tagFilter.value,
      priorityFilter.value,
      typeFilter.value,
      dateFrom.value,
      dateTo.value,
    ].filter(Boolean).length,
)

const advancedDateRange = computed<[string, string] | null>({
  get: (): [string, string] | null =>
    dateFrom.value || dateTo.value ? [dateFrom.value, dateTo.value] : null,
  set: (value: [string, string] | null) => {
    dateFrom.value = value?.[0] ?? ''
    dateTo.value = value?.[1] ?? ''
  },
})

const filterPayload = computed<Record<string, string>>(() => ({
  keyword: keyword.value,
  status: statusFilter.value,
  owner: ownerFilter.value,
  tag: tagFilter.value,
  priority: priorityFilter.value,
  type: typeFilter.value,
  dateFrom: dateFrom.value,
  dateTo: dateTo.value,
}))

const applyFilter = (filters: Record<string, string>) => {
  keyword.value = filters.keyword ?? ''
  statusFilter.value = (filters.status as ProjectStatus) ?? ''
  ownerFilter.value = filters.owner ?? ''
  tagFilter.value = filters.tag ?? ''
  priorityFilter.value = (filters.priority as Priority) ?? ''
  typeFilter.value = (filters.type as ProjectType) ?? ''
  dateFrom.value = filters.dateFrom ?? ''
  dateTo.value = filters.dateTo ?? ''
}

const handleSaveView = (name: string) => {
  saveView(name, filterPayload.value)
  ElMessage.success(`筛选方案「${name}」已保存`)
}

const clearFilters = () => {
  keyword.value = ''
  statusFilter.value = ''
  ownerFilter.value = ''
  tagFilter.value = ''
  priorityFilter.value = ''
  typeFilter.value = ''
  dateFrom.value = ''
  dateTo.value = ''
}

watch(filterPayload, (value) => {
  persistFilters(value)
  page.value = 1
})

const allTags = computed(() => Array.from(new Set(db.projects.flatMap((p) => p.tags))))

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  const source = app.isGuest ? app.visibleProjects : db.projects
  return source.filter((project) => {
    if (kw && !`${project.code} ${project.name} ${project.description} ${project.tags.join(' ')}`.toLowerCase().includes(kw)) return false
    if (statusFilter.value && project.status !== statusFilter.value) return false
    if (ownerFilter.value && project.ownerId !== ownerFilter.value) return false
    if (tagFilter.value && !project.tags.includes(tagFilter.value)) return false
    if (priorityFilter.value && project.priority !== priorityFilter.value) return false
    if (typeFilter.value && project.type !== typeFilter.value) return false
    if (dateFrom.value && project.plannedEndDate < dateFrom.value) return false
    if (dateTo.value && project.plannedEndDate > dateTo.value) return false
    return true
  })
})

const accessors = {
  code: (row: Project) => row.code,
  name: (row: Project) => row.name,
  status: (row: Project) => row.status,
  priority: (row: Project) => row.priority,
  plannedEndDate: (row: Project) => row.plannedEndDate,
}

const { page, pageSize, total, paged, onSortChange } = useTable(filtered, { pageSize: 10, accessors })

const memberName = (id: string) => db.members.find((m) => m.id === id)?.name ?? id
const memberColor = (id: string) => db.members.find((m) => m.id === id)?.color ?? '#6b7a8f'

const resetFilters = () => clearFilters()

const dialogOpen = ref(false)
const editing = ref<Project | null>(null)
const saving = ref(false)
const formRef = ref<FormInstance>()

const emptyForm = (): ProjectInput => ({
  name: '',
  description: '',
  type: 'hardware' as ProjectType,
  ownerId: app.currentUser.id,
  memberIds: [app.currentUser.id],
  startDate: new Date().toISOString().slice(0, 10),
  plannedEndDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  status: 'planning' as ProjectStatus,
  priority: 'P1' as Priority,
  tags: [],
})

const form = reactive<ProjectInput>(emptyForm())

const rules: FormRules = {
  name: [{ required: true, message: '请输入项目名称', trigger: 'blur' }],
  description: [{ required: true, message: '请输入项目描述', trigger: 'blur' }],
  ownerId: [{ required: true, message: '请选择负责人', trigger: 'change' }],
  startDate: [{ required: true, message: '请选择开始日期', trigger: 'change' }],
  plannedEndDate: [{ required: true, message: '请选择预计结束日期', trigger: 'change' }],
}

const openCreate = () => {
  editing.value = null
  Object.assign(form, emptyForm())
  dialogOpen.value = true
}

const openEdit = (project: Project) => {
  editing.value = project
  Object.assign(form, {
    name: project.name,
    description: project.description,
    type: project.type,
    ownerId: project.ownerId,
    memberIds: [...project.memberIds],
    startDate: project.startDate,
    plannedEndDate: project.plannedEndDate,
    status: project.status,
    priority: project.priority,
    tags: [...project.tags],
  })
  dialogOpen.value = true
}

const save = async () => {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    if (editing.value) {
      projectService.update(editing.value.id, { ...form })
      ElMessage.success('项目已更新')
    } else {
      const created = projectService.create({ ...form })
      ElMessage.success(`项目 ${created.code} 已创建`)
      router.push(`/projects/${created.id}`)
    }
    dialogOpen.value = false
  } finally {
    saving.value = false
  }
}

const onRowCommand = async (command: string, project: Project) => {
  if (command === 'edit') {
    openEdit(project)
    return
  }
  if (command === 'archive') {
    await ElMessageBox.confirm(`归档后项目将从活跃列表隐藏，但历史数据仍可追溯。确认归档「${project.name}」？`, '归档项目', {
      type: 'warning',
      confirmButtonText: '归档',
      cancelButtonText: '取消',
    })
    projectService.setStatus(project.id, 'archived')
    ElMessage.success('项目已归档')
    return
  }
  if (command === 'delete') {
    try {
      await ElMessageBox.confirm(`删除项目「${project.name}」不可恢复。仅当项目无任何关联数据时才允许删除。`, '删除项目', {
        type: 'error',
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
      })
      projectService.remove(project.id)
      ElMessage.success('项目已删除')
    } catch (error) {
      if (error instanceof Error) ElMessage.error(error.message)
    }
  }
}

const writeCsv = (rows: Project[]) => {
  const data = rows.map((p) => [
    p.code,
    p.name,
    projectType.get(p.type).label,
    memberName(p.ownerId),
    projectStatus.get(p.status).label,
    priority.get(p.priority).label,
    p.startDate,
    p.plannedEndDate,
    p.tags.join(' / '),
  ])
  downloadText(
    `benchflow-projects-${new Date().toISOString().slice(0, 10)}.csv`,
    toCsv(['项目编号', '项目名称', '类型', '负责人', '状态', '优先级', '开始日期', '计划结束', '标签'], data),
  )
  ElMessage.success(`已导出 ${rows.length} 条项目 CSV`)
}

const exportCsv = () => writeCsv(filtered.value)
const bulkExport = () => writeCsv(selection.value)

const onSelectionChange = (rows: Project[]) => {
  selection.value = rows
}

const bulkArchive = async () => {
  const targets = selection.value.filter((project) => project.status !== 'archived')
  if (!targets.length) {
    ElMessage.warning('所选项目都已归档')
    return
  }
  try {
    await ElMessageBox.confirm(`将 ${targets.length} 个项目归档？归档后仍可追溯历史数据。`, '批量归档', {
      confirmButtonText: '归档',
      cancelButtonText: '取消',
      type: 'warning',
    })
    targets.forEach((project) => projectService.setStatus(project.id, 'archived'))
    selection.value = []
    ElMessage.success('批量归档完成')
  } catch {
    // cancelled
  }
}

const openQuick = (project: Project) => {
  quickProject.value = project
  quickOpen.value = true
}

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

.project-cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  padding: 12px;
}

.card-line {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 11.5px;
}

.card-line span {
  color: var(--bf-ink-3);
}

.quick-code {
  font-size: 11px;
  color: var(--bf-primary);
}

.quick-title {
  font-size: 17px;
  font-weight: 650;
  margin: 3px 0 8px;
}

.quick-desc {
  font-size: 12px;
  color: var(--bf-ink-2);
  line-height: 1.6;
  margin-bottom: 12px;
}

.quick-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
}

.quick-stats > div {
  background: var(--bf-surface-2);
  border: 1px solid var(--bf-border);
  border-radius: 5px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
}

.quick-stats span {
  font-size: 10px;
  color: var(--bf-ink-3);
}

.quick-stats b {
  font-size: 17px;
  font-weight: 650;
}

.quick-sub {
  font-size: 11.5px;
  color: var(--bf-ink-2);
  margin: 16px 0 6px;
}

.quick-risks {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 14px;
}

.quick-risk {
  font-size: 11.5px;
  padding: 7px 9px;
  border-radius: 5px;
  background: var(--bf-surface-2);
  border: 1px solid var(--bf-border);
  color: var(--bf-ink-2);
}

.quick-risk.high {
  background: #fdf1f0;
  border-color: #f2d5d1;
  color: #8f241b;
}

.quick-risk.medium {
  background: #fdf6ea;
  border-color: #f0dfc0;
  color: #80510a;
}

.quick-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

@media (max-width: 1280px) {
  .project-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .project-cards {
    grid-template-columns: minmax(0, 1fr);
  }
}

.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 420px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 14px;
}

.danger {
  color: var(--bf-danger);
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
