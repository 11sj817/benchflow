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
        <span class="bf-filter-count">显示 {{ filtered.length }} / {{ db.projects.length }}</span>
      </div>

      <el-table
        :data="paged"
        size="small"
        @sort-change="onSortChange"
        @row-click="(row: Project) => router.push(`/projects/${row.id}`)"
      >
        <el-table-column prop="code" label="编号" width="96" sortable="custom">
          <template #default="{ row }"><span class="bf-table-code">{{ row.code }}</span></template>
        </el-table-column>
        <el-table-column prop="name" label="项目名称" min-width="240" sortable="custom">
          <template #default="{ row }">
            <div class="bf-table-name">{{ row.name }}</div>
            <div class="bf-sub ellipsis">{{ row.description }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="type" label="类型" width="92">
          <template #default="{ row }">
            <StatusPill :label="projectType.get(row.type).label" :tone="projectType.get(row.type).tone" />
          </template>
        </el-table-column>
        <el-table-column label="负责人" width="96">
          <template #default="{ row }">
            <div class="bf-row">
              <UserAvatar :name="memberName(row.ownerId)" :color="memberColor(row.ownerId)" size="sm" />
              <span>{{ memberName(row.ownerId) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="成员" width="112">
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
        <el-table-column prop="status" label="状态" width="88" sortable="custom">
          <template #default="{ row }">
            <StatusPill :label="projectStatus.get(row.status).label" :tone="projectStatus.get(row.status).tone" />
          </template>
        </el-table-column>
        <el-table-column prop="priority" label="优先级" width="86" sortable="custom">
          <template #default="{ row }">
            <StatusPill :label="priority.get(row.priority).label" :tone="priority.get(row.priority).tone" />
          </template>
        </el-table-column>
        <el-table-column prop="plannedEndDate" label="计划结束" width="104" sortable="custom">
          <template #default="{ row }">
            <span class="num">{{ fmtDate(row.plannedEndDate) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="通过率" width="80" align="right">
          <template #default="{ row }">
            <span class="num">{{ projectService.stats(row.id).passRate }}%</span>
          </template>
        </el-table-column>
        <el-table-column label="缺陷" width="64" align="right">
          <template #default="{ row }">
            <span class="num" :class="{ danger: projectService.stats(row.id).openDefects > 0 }">
              {{ projectService.stats(row.id).openDefects }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="132" fixed="right">
          <template #default="{ row }">
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
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { ChevronDown, Download, Plus, Search } from 'lucide-vue-next'
import type { Project, ProjectStatus, ProjectType, Priority } from '@/types'
import { db } from '@/services/db'
import { projectService } from '@/services/projectService'
import type { ProjectInput } from '@/services/projectService'
import { useAppStore } from '@/stores/app'
import { useTable } from '@/composables/useTable'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import DataPager from '@/components/common/DataPager.vue'
import { fmtDate, priority as priorityDict, projectStatus as statusDict, projectType as typeDict } from '@/utils/format'
import { downloadText, toCsv } from '@/utils/csv'

const router = useRouter()
const app = useAppStore()

const projectStatus = statusDict
const projectType = typeDict
const priority = priorityDict

const keyword = ref('')
const statusFilter = ref<ProjectStatus | ''>('')
const ownerFilter = ref('')
const tagFilter = ref('')

const allTags = computed(() => Array.from(new Set(db.projects.flatMap((p) => p.tags))))

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  const source = app.isGuest ? app.visibleProjects : db.projects
  return source.filter((project) => {
    if (kw && !`${project.code} ${project.name} ${project.description} ${project.tags.join(' ')}`.toLowerCase().includes(kw)) return false
    if (statusFilter.value && project.status !== statusFilter.value) return false
    if (ownerFilter.value && project.ownerId !== ownerFilter.value) return false
    if (tagFilter.value && !project.tags.includes(tagFilter.value)) return false
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

const resetFilters = () => {
  keyword.value = ''
  statusFilter.value = ''
  ownerFilter.value = ''
  tagFilter.value = ''
}

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

const exportCsv = () => {
  const rows = filtered.value.map((p) => [
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
    toCsv(['项目编号', '项目名称', '类型', '负责人', '状态', '优先级', '开始日期', '计划结束', '标签'], rows),
  )
  ElMessage.success('已导出当前筛选结果 CSV')
}

watch(paged, () => {
  // 数据变化时由 useTable 自行收敛页码
})
</script>

<style scoped>
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
