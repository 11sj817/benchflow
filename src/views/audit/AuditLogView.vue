<template>
  <div class="bf-page">
    <PageHeader title="审计日志" :subtitle="`${filtered.length} 条操作记录 · 关键数据修改留痕`">
      <template #actions>
        <el-button size="small" @click="exportCsv"><Download :size="14" /> 导出</el-button>
      </template>
    </PageHeader>

    <div class="bf-hint">
      审计日志记录项目、版本、用例、执行、缺陷、文件、报告与权限变更。当前保存在浏览器本地；接入后端后将改为只追加、不可篡改的服务端日志表。
    </div>

    <section class="bf-panel" style="margin-top: 12px">
      <div class="bf-toolbar">
        <el-input v-model="filters.keyword" placeholder="搜索摘要 / 对象 / 操作人" clearable style="width: 250px">
          <template #prefix><Search :size="14" /></template>
        </el-input>
        <el-select v-model="filters.action" placeholder="操作类型" clearable style="width: 130px">
          <el-option v-for="(row, key) in auditAction.map" :key="key" :label="row.label" :value="key" />
        </el-select>
        <el-select v-model="filters.entity" placeholder="对象类型" clearable style="width: 130px">
          <el-option v-for="(label, key) in ENTITY_LABEL" :key="key" :label="label" :value="key" />
        </el-select>
        <el-select v-model="filters.actorId" placeholder="操作人" clearable style="width: 120px">
          <el-option v-for="member in db.members" :key="member.id" :label="member.name" :value="member.id" />
        </el-select>
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          start-placeholder="开始"
          end-placeholder="结束"
          style="width: 230px"
        />
        <el-button text @click="resetFilters">重置</el-button>
        <span class="grow" />
        <span class="bf-filter-count">{{ filtered.length }} 条</span>
      </div>

      <el-table :data="paged" size="small">
        <el-table-column label="时间" width="146">
          <template #default="{ row }"><span class="num">{{ fmtDateTime(row.at) }}</span></template>
        </el-table-column>
        <el-table-column label="操作人" width="110">
          <template #default="{ row }">
            <div class="bf-row">
              <UserAvatar :name="row.actorName" :color="memberColor(row.actorId)" size="sm" />
              {{ row.actorName }}
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作类型" width="100">
          <template #default="{ row }">
            <StatusPill :label="auditAction.get(row.action).label" :tone="auditAction.get(row.action).tone" />
          </template>
        </el-table-column>
        <el-table-column label="对象" width="150">
          <template #default="{ row }">
            <span class="bf-sub">{{ ENTITY_LABEL[row.entity] ?? row.entity }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="entityLabel" label="对象名称" min-width="200" />
        <el-table-column prop="summary" label="修改摘要" min-width="270" />
        <el-table-column label="对象编号" width="120">
          <template #default="{ row }"><span class="mono bf-sub">{{ row.entityId }}</span></template>
        </el-table-column>
      </el-table>
      <DataPager v-model:page="page" v-model:page-size="pageSize" :total="total" />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Download, Search } from 'lucide-vue-next'
import { db } from '@/services/db'
import { auditService } from '@/services/orgService'
import { useTable } from '@/composables/useTable'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import DataPager from '@/components/common/DataPager.vue'
import { auditAction, fmtDateTime } from '@/utils/format'
import { downloadText, toCsv } from '@/utils/csv'

const ENTITY_LABEL: Record<string, string> = {
  project: '项目',
  requirement: '需求',
  product: '产品',
  version: '版本',
  case: '测试用例',
  plan: '测试计划',
  execution: '测试执行',
  defect: '缺陷',
  device: '设备',
  dataset: '数据集',
  report: '报告',
  share: '分享',
  member: '成员',
  setting: '设置',
  session: '会话',
}

const filters = reactive({
  keyword: '',
  action: '',
  entity: '',
  actorId: '',
})
const dateRange = ref<[string, string] | null>(null)

const filtered = computed(() => {
  const rows = auditService.filter({
    action: filters.action || undefined,
    entity: filters.entity || undefined,
    actorId: filters.actorId || undefined,
    keyword: filters.keyword || undefined,
    from: dateRange.value?.[0],
    to: dateRange.value?.[1],
  })
  return rows
})

const { page, pageSize, total, paged } = useTable(filtered, { pageSize: 20 })

watch(
  () => [filters.keyword, filters.action, filters.entity, filters.actorId, dateRange.value],
  () => {
    page.value = 1
  },
)

const memberColor = (id: string) => db.members.find((m) => m.id === id)?.color ?? '#6b7a8f'

const resetFilters = () => {
  filters.keyword = ''
  filters.action = ''
  filters.entity = ''
  filters.actorId = ''
  dateRange.value = null
}

const exportCsv = () => {
  downloadText(
    `benchflow-audit-${new Date().toISOString().slice(0, 10)}.csv`,
    toCsv(
      ['时间', '操作人', '操作类型', '对象类型', '对象名称', '对象编号', '修改摘要'],
      filtered.value.map((row) => [
        row.at.slice(0, 19).replace('T', ' '),
        row.actorName,
        auditAction.get(row.action).label,
        ENTITY_LABEL[row.entity] ?? row.entity,
        row.entityLabel,
        row.entityId,
        row.summary,
      ]),
    ),
  )
  ElMessage.success('已导出审计日志')
}
</script>
