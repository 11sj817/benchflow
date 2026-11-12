<template>
  <div class="bf-page">
    <PageHeader title="报告中心" :subtitle="`${filtered.length} 份报告 · 基于真实演示数据生成，支持审核、打印与导出`">
      <template #actions>
        <el-button size="small" @click="exportList"><Download :size="14" /> 导出清单</el-button>
        <el-button v-if="app.can('create')" size="small" type="primary" @click="openCreate"><Plus :size="14" /> 新建报告</el-button>
      </template>
    </PageHeader>

    <section class="bf-panel">
      <div class="bf-toolbar">
        <el-input v-model="keyword" placeholder="搜索报告编号 / 标题" clearable style="width: 250px">
          <template #prefix><Search :size="14" /></template>
        </el-input>
        <el-select v-model="typeFilter" placeholder="报告类型" clearable style="width: 160px">
          <el-option v-for="(row, key) in reportType.map" :key="key" :label="row.label" :value="key" />
        </el-select>
        <el-select v-model="statusFilter" placeholder="审核状态" clearable style="width: 130px">
          <el-option v-for="(row, key) in reportStatus.map" :key="key" :label="row.label" :value="key" />
        </el-select>
        <el-select v-model="projectFilter" placeholder="项目" clearable style="width: 170px">
          <el-option v-for="project in visibleProjects" :key="project.id" :label="project.name" :value="project.id" />
        </el-select>
        <el-button text @click="resetFilters">重置</el-button>
        <span class="grow" />
        <span class="bf-filter-count">待审核 {{ pendingCount }}</span>
      </div>

      <el-table :data="paged" size="small" @sort-change="onSortChange" @row-click="(row: Report) => router.push(`/reports/${row.id}`)">
        <el-table-column prop="code" label="编号" width="126" sortable="custom">
          <template #default="{ row }"><span class="bf-table-code">{{ row.code }}</span></template>
        </el-table-column>
        <el-table-column prop="title" label="报告标题" min-width="250" sortable="custom">
          <template #default="{ row }">
            <div class="bf-table-name">{{ row.title }}</div>
            <div class="bf-sub ellipsis">{{ row.summary }}</div>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="130">
          <template #default="{ row }">
            <StatusPill :label="reportType.get(row.type).label" :tone="reportType.get(row.type).tone" />
          </template>
        </el-table-column>
        <el-table-column label="项目" width="150">
          <template #default="{ row }">{{ projectName(row.projectId) }}</template>
        </el-table-column>
        <el-table-column label="作者" width="82">
          <template #default="{ row }">{{ memberName(row.authorId) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <StatusPill :label="reportStatus.get(row.status).label" :tone="reportStatus.get(row.status).tone" />
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="102" sortable="custom" prop="createdAt">
          <template #default="{ row }"><span class="bf-sub num">{{ fmtDate(row.createdAt) }}</span></template>
        </el-table-column>
        <el-table-column label="审核人" width="82">
          <template #default="{ row }">{{ row.reviewerId ? memberName(row.reviewerId) : '—' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <el-button size="small" text @click.stop="router.push(`/reports/${row.id}`)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>
      <DataPager v-model:page="page" v-model:page-size="pageSize" :total="total" />
    </section>

    <el-dialog v-model="dialogOpen" title="新建报告（基于演示数据生成）" width="600px">
      <el-form label-width="96px">
        <el-form-item label="报告类型">
          <el-select v-model="createForm.type" style="width: 100%">
            <el-option v-for="(row, key) in reportType.map" :key="key" :label="row.label" :value="key" />
          </el-select>
        </el-form-item>

        <el-form-item v-if="createForm.type === 'plan'" label="测试计划">
          <el-select v-model="createForm.planId" filterable style="width: 100%">
            <el-option v-for="plan in db.plans" :key="plan.id" :label="`${plan.code} · ${plan.name}`" :value="plan.id" />
          </el-select>
        </el-form-item>

        <el-form-item v-if="createForm.type === 'execution'" label="执行记录">
          <el-select v-model="createForm.executionId" filterable style="width: 100%">
            <el-option v-for="run in db.executions" :key="run.id" :label="`${run.code} · ${run.result}`" :value="run.id" />
          </el-select>
        </el-form-item>

        <el-form-item v-if="createForm.type === 'product' || createForm.type === 'acceptance'" :label="createForm.type === 'product' ? '产品' : '项目'">
          <el-select v-if="createForm.type === 'product'" v-model="createForm.productId" style="width: 100%">
            <el-option v-for="product in db.products" :key="product.id" :label="product.name" :value="product.id" />
          </el-select>
          <el-select v-else v-model="createForm.projectId" style="width: 100%">
            <el-option v-for="project in db.projects" :key="project.id" :label="project.name" :value="project.id" />
          </el-select>
        </el-form-item>

        <el-form-item v-if="createForm.type === 'defect'" label="项目">
          <el-select v-model="createForm.projectId" style="width: 100%">
            <el-option v-for="project in db.projects" :key="project.id" :label="project.name" :value="project.id" />
          </el-select>
        </el-form-item>

        <template v-if="createForm.type === 'version_compare'">
          <el-form-item label="基线版本">
            <el-select v-model="createForm.leftVersionId" style="width: 100%">
              <el-option v-for="version in db.versions" :key="version.id" :label="`${version.version} · ${version.label}`" :value="version.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="对比版本">
            <el-select v-model="createForm.rightVersionId" style="width: 100%">
              <el-option v-for="version in db.versions" :key="version.id" :label="`${version.version} · ${version.label}`" :value="version.id" />
            </el-select>
          </el-form-item>
        </template>
      </el-form>
      <div class="bf-hint">报告章节与指标将从计划、执行、缺陷和版本数据自动汇总，生成后可在详情页继续编辑并提交审核。</div>
      <template #footer>
        <el-button @click="dialogOpen = false">取消</el-button>
        <el-button type="primary" @click="generate">生成报告</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Download, Plus, Search } from 'lucide-vue-next'
import type { Report, ReportStatus, ReportType } from '@/types'
import { db } from '@/services/db'
import { reportService } from '@/services/reportService'
import { useAppStore } from '@/stores/app'
import { useTable } from '@/composables/useTable'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import DataPager from '@/components/common/DataPager.vue'
import { fmtDate, reportStatus, reportType } from '@/utils/format'
import { downloadText, toCsv } from '@/utils/csv'

const router = useRouter()
const app = useAppStore()

const keyword = ref('')
const typeFilter = ref<ReportType | ''>('')
const statusFilter = ref<ReportStatus | ''>('')
const projectFilter = ref('')

const visibleProjects = computed(() => app.visibleProjects)
const visibleReports = computed(() => {
  if (!app.isGuest) return db.reports
  const ids = new Set(app.visibleProjectIds)
  const sharedReports = new Set(
    db.shares.filter((s) => s.status === 'active').flatMap((s) => s.reportIds),
  )
  return db.reports.filter((r) => ids.has(r.projectId) && sharedReports.has(r.id))
})

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return visibleReports.value.filter((row) => {
    if (typeFilter.value && row.type !== typeFilter.value) return false
    if (statusFilter.value && row.status !== statusFilter.value) return false
    if (projectFilter.value && row.projectId !== projectFilter.value) return false
    if (kw && !`${row.code} ${row.title} ${row.summary}`.toLowerCase().includes(kw)) return false
    return true
  })
})

const accessors = {
  code: (row: Report) => row.code,
  title: (row: Report) => row.title,
  createdAt: (row: Report) => row.createdAt,
}

const { page, pageSize, total, paged, onSortChange } = useTable(filtered, { pageSize: 10, accessors })

const pendingCount = computed(() => visibleReports.value.filter((r) => r.status === 'review').length)
const projectName = (id: string) => db.projects.find((p) => p.id === id)?.name ?? id
const memberName = (id: string) => db.members.find((m) => m.id === id)?.name ?? id

const resetFilters = () => {
  keyword.value = ''
  typeFilter.value = ''
  statusFilter.value = ''
  projectFilter.value = ''
}

const dialogOpen = ref(false)
const createForm = reactive({
  type: 'plan' as ReportType,
  planId: db.plans[0]?.id ?? '',
  executionId: db.executions[0]?.id ?? '',
  productId: db.products[0]?.id ?? '',
  projectId: db.projects[0]?.id ?? '',
  leftVersionId: db.versions[0]?.id ?? '',
  rightVersionId: db.versions[1]?.id ?? '',
})

const openCreate = () => {
  dialogOpen.value = true
}

const generate = () => {
  try {
    let report: Report
    switch (createForm.type) {
      case 'plan':
        report = reportService.generateFromPlan(createForm.planId)
        break
      case 'execution':
        report = reportService.generateFromExecution(createForm.executionId)
        break
      case 'product':
        report = reportService.generateFromProduct(createForm.productId)
        break
      case 'version_compare':
        report = reportService.generateVersionCompare(createForm.leftVersionId, createForm.rightVersionId)
        break
      case 'defect':
        report = reportService.generateDefectAnalysis(createForm.projectId)
        break
      default:
        report = reportService.generateAcceptance(createForm.projectId)
    }
    ElMessage.success(`报告 ${report.code} 已生成`)
    dialogOpen.value = false
    router.push(`/reports/${report.id}`)
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message)
  }
}

const exportList = () => {
  downloadText(
    `benchflow-reports-${new Date().toISOString().slice(0, 10)}.csv`,
    toCsv(
      ['报告编号', '标题', '类型', '项目', '作者', '状态', '创建时间'],
      filtered.value.map((r) => [
        r.code,
        r.title,
        reportType.get(r.type).label,
        projectName(r.projectId),
        memberName(r.authorId),
        reportStatus.get(r.status).label,
        r.createdAt.slice(0, 10),
      ]),
    ),
  )
  ElMessage.success('已导出报告清单')
}
</script>

<style scoped>
.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 430px;
}

:deep(.el-table__row) {
  cursor: pointer;
}
</style>
