<template>
  <div class="bf-page">
    <PageHeader title="数据集管理" :subtitle="`${filtered.length} 个数据集 · CSV / XLSX / JSON / PNG / JPG / PDF / ZIP`">
      <template #actions>
        <el-button size="small" @click="exportCsv"><Download :size="14" /> 导出清单</el-button>
        <input ref="fileInput" type="file" class="hidden-input" accept=".csv,.xlsx,.xls,.json,.png,.jpg,.jpeg,.pdf,.zip,.log" @change="onFilePicked" />
        <el-button v-if="app.can('create')" size="small" type="primary" @click="fileInput?.click()"><Upload :size="14" /> 上传数据集</el-button>
      </template>
    </PageHeader>

    <div class="bf-hint storage-hint">
      <HardDrive :size="14" />
      <span>
        演示模式：文件元信息与小型 CSV 预览保存在浏览器 LocalStorage（上限约 5MB），单文件限制 2MB。
        大型示波器波形 / 高清照片不适合浏览器存储，真实部署需接入对象存储（见 NEXT_STEPS）。
        当前占用 {{ fmtBytes(datasetService.totalBytes()) }}。
      </span>
    </div>

    <div class="bf-hint warn storage-hint" v-if="alertLevel">
      浏览器存储已使用 {{ Math.round(usage.ratio * 100) }}%，建议删除不再需要的数据集或恢复演示数据。
    </div>

    <section class="bf-panel">
      <div class="bf-toolbar">
        <el-input v-model="keyword" placeholder="搜索文件名 / 编号 / 备注" clearable style="width: 260px">
          <template #prefix><Search :size="14" /></template>
        </el-input>
        <el-select v-model="categoryFilter" placeholder="分类" clearable style="width: 130px">
          <el-option v-for="(row, key) in datasetCategory.map" :key="key" :label="row.label" :value="key" />
        </el-select>
        <el-select v-model="kindFilter" placeholder="文件类型" clearable style="width: 120px">
          <el-option v-for="(row, key) in fileKind.map" :key="key" :label="row.label" :value="key" />
        </el-select>
        <el-select v-model="projectFilter" placeholder="项目" clearable style="width: 170px">
          <el-option v-for="project in db.projects" :key="project.id" :label="project.name" :value="project.id" />
        </el-select>
        <el-button text @click="resetFilters">重置</el-button>
        <span class="grow" />
        <span class="bf-filter-count">合计 {{ fmtBytes(filteredSize) }}</span>
      </div>

      <el-table :data="paged" size="small" @sort-change="onSortChange">
        <el-table-column prop="code" label="编号" width="82" sortable="custom">
          <template #default="{ row }"><span class="bf-table-code">{{ row.code }}</span></template>
        </el-table-column>
        <el-table-column prop="name" label="文件名" min-width="220" sortable="custom">
          <template #default="{ row }">
            <button class="file-link" type="button" @click="openPreview(row)">{{ row.name }}</button>
            <div class="bf-sub">{{ row.note }}</div>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="70">
          <template #default="{ row }"><StatusPill :label="fileKind.get(row.kind).label" :tone="fileKind.get(row.kind).tone" /></template>
        </el-table-column>
        <el-table-column label="分类" width="100">
          <template #default="{ row }">{{ datasetCategory.get(row.category).label }}</template>
        </el-table-column>
        <el-table-column prop="sizeBytes" label="大小" width="90" align="right" sortable="custom">
          <template #default="{ row }"><span class="num">{{ fmtBytes(row.sizeBytes) }}</span></template>
        </el-table-column>
        <el-table-column label="项目" width="160">
          <template #default="{ row }">{{ projectName(row.projectId) }}</template>
        </el-table-column>
        <el-table-column label="关联执行" width="96">
          <template #default="{ row }">
            <router-link v-if="row.executionId" :to="`/test-executions/${row.executionId}`" class="mono link">{{ row.executionId }}</router-link>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="版本" width="64">
          <template #default="{ row }"><span class="mono">{{ row.version }}</span></template>
        </el-table-column>
        <el-table-column label="上传" width="150" sortable="custom" prop="uploadedAt">
          <template #default="{ row }">
            <span>{{ memberName(row.uploadedBy) }}</span>
            <div class="bf-sub">{{ fmtDate(row.uploadedAt) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button size="small" text @click="openPreview(row)">预览</el-button>
            <el-button size="small" text @click="download(row)">下载</el-button>
            <el-button v-if="app.can('delete')" size="small" text type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <DataPager v-model:page="page" v-model:page-size="pageSize" :total="total" />
    </section>

    <el-dialog v-model="uploadOpen" title="上传数据集" width="600px" destroy-on-close>
      <div v-if="pendingFile" class="file-summary">
        <StatusPill :label="pendingKind" tone="info" />
        <div>
          <div>{{ pendingFile.name }}</div>
          <div class="bf-sub">{{ fmtBytes(pendingFile.size) }} · 单文件上限 2MB</div>
        </div>
      </div>
      <el-form label-width="92px" style="margin-top: 12px">
        <el-form-item label="所属项目" required>
          <el-select v-model="uploadForm.projectId" style="width: 100%">
            <el-option v-for="project in db.projects" :key="project.id" :label="project.name" :value="project.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="文件分类">
          <el-select v-model="uploadForm.category" style="width: 100%">
            <el-option v-for="(row, key) in datasetCategory.map" :key="key" :label="row.label" :value="key" />
          </el-select>
        </el-form-item>
        <el-form-item label="关联执行">
          <el-select v-model="uploadForm.executionId" clearable filterable style="width: 100%">
            <el-option v-for="run in projectRuns" :key="run.id" :label="`${run.code} · ${run.result}`" :value="run.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="关联用例">
          <el-select v-model="uploadForm.caseIds" multiple filterable style="width: 100%">
            <el-option v-for="testCase in db.cases" :key="testCase.id" :label="`${testCase.code} · ${testCase.name}`" :value="testCase.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="uploadForm.note" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="uploadOpen = false">取消</el-button>
        <el-button type="primary" :loading="uploading" @click="confirmUpload">上传</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="previewOpen" :title="active ? active.name : ''" size="680px">
      <template v-if="active">
        <el-descriptions :column="3" border size="small">
          <el-descriptions-item label="编号">{{ active.code }}</el-descriptions-item>
          <el-descriptions-item label="类型">{{ fileKind.get(active.kind).label }}</el-descriptions-item>
          <el-descriptions-item label="大小">{{ fmtBytes(active.sizeBytes) }}</el-descriptions-item>
          <el-descriptions-item label="项目">{{ projectName(active.projectId) }}</el-descriptions-item>
          <el-descriptions-item label="关联执行">{{ active.executionId || '—' }}</el-descriptions-item>
          <el-descriptions-item label="版本">{{ active.version }}</el-descriptions-item>
          <el-descriptions-item label="上传人">{{ memberName(active.uploadedBy) }}</el-descriptions-item>
          <el-descriptions-item label="上传时间" :span="2">{{ fmtDateTime(active.uploadedAt) }}</el-descriptions-item>
        </el-descriptions>

        <template v-if="active.previewHeaders?.length">
          <h4 class="block-title">数据预览（前 {{ active.previewRows?.length }} 行）</h4>
          <el-table :data="previewTable" size="small" max-height="320">
            <el-table-column v-for="(header, idx) in active.previewHeaders" :key="header" :label="header" :prop="`c${idx}`" min-width="110" />
          </el-table>

          <h4 class="block-title">数值曲线</h4>
          <BaseChart v-if="previewChart" :option="previewChart" size="sm" />
          <EmptyState v-else text="预览数据中没有可绘制的数值列" />
        </template>
        <EmptyState v-else text="该文件类型不提供浏览器内预览" hint="XLSX / ZIP / PDF / 图片等文件仅保存元信息，真实预览需后端解析或对象存储直链。" />

        <div class="drawer-actions">
          <el-button size="small" @click="download(active)">下载 / 导出</el-button>
          <el-button v-if="app.can('delete')" size="small" type="danger" @click="remove(active)">删除</el-button>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Download, HardDrive, Search, Upload } from 'lucide-vue-next'
import type { EChartsOption } from 'echarts'
import type { Dataset, DatasetCategory, FileKind } from '@/types'
import { db, storageUsage } from '@/services/db'
import { datasetService, MAX_INLINE_FILE } from '@/services/assetService'
import { useAppStore } from '@/stores/app'
import { useTable } from '@/composables/useTable'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import DataPager from '@/components/common/DataPager.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import BaseChart from '@/components/charts/BaseChart.vue'
import { datasetCategory, fileKind, fmtBytes, fmtDate, fmtDateTime } from '@/utils/format'
import { downloadText, toCsv } from '@/utils/csv'

const app = useAppStore()
const route = useRoute()

const keyword = ref('')
const categoryFilter = ref<DatasetCategory | ''>('')
const kindFilter = ref<FileKind | ''>('')
const projectFilter = ref('')

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return db.datasets.filter((row) => {
    if (categoryFilter.value && row.category !== categoryFilter.value) return false
    if (kindFilter.value && row.kind !== kindFilter.value) return false
    if (projectFilter.value && row.projectId !== projectFilter.value) return false
    if (kw && !`${row.code} ${row.name} ${row.note}`.toLowerCase().includes(kw)) return false
    return true
  })
})

const accessors = {
  code: (row: Dataset) => row.code,
  name: (row: Dataset) => row.name,
  sizeBytes: (row: Dataset) => row.sizeBytes,
  uploadedAt: (row: Dataset) => row.uploadedAt,
}

const { page, pageSize, total, paged, onSortChange } = useTable(filtered, { pageSize: 10, accessors })

const filteredSize = computed(() => filtered.value.reduce((sum, row) => sum + row.sizeBytes, 0))
const usage = computed(() => storageUsage())
const alertLevel = computed(() => usage.value.ratio > 0.75)
const projectName = (id: string) => db.projects.find((p) => p.id === id)?.name ?? id
const memberName = (id: string) => db.members.find((m) => m.id === id)?.name ?? id

const resetFilters = () => {
  keyword.value = ''
  categoryFilter.value = ''
  kindFilter.value = ''
  projectFilter.value = ''
}

const fileInput = ref<HTMLInputElement | null>(null)
const uploadOpen = ref(false)
const uploading = ref(false)
const pendingFile = ref<File | null>(null)
const pendingKind = ref('CSV')

const kindOf = (name: string): FileKind => {
  const ext = (name.split('.').pop() ?? '').toLowerCase()
  if (ext === 'csv') return 'csv'
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx'
  if (ext === 'json') return 'json'
  if (ext === 'png') return 'png'
  if (ext === 'jpg' || ext === 'jpeg') return 'jpg'
  if (ext === 'pdf') return 'pdf'
  if (ext === 'zip') return 'zip'
  return 'log'
}

const uploadForm = reactive({
  projectId: db.projects[0]?.id ?? '',
  category: 'raw' as DatasetCategory,
  executionId: '',
  caseIds: [] as string[],
  note: '',
})

const projectRuns = computed(() =>
  db.executions.filter((e) => e.projectId === uploadForm.projectId).slice().sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1)),
)

const onFilePicked = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (file.size > MAX_INLINE_FILE) {
    ElMessage.error(`单文件需 ≤ 2MB（当前 ${(file.size / 1024 / 1024).toFixed(1)}MB）。大型波形请接入后端对象存储。`)
    if (fileInput.value) fileInput.value.value = ''
    return
  }
  pendingFile.value = file
  pendingKind.value = fileKind.get(kindOf(file.name)).label
  uploadForm.note = `${file.name} 上传`
  uploadOpen.value = true
}

const confirmUpload = async () => {
  if (!pendingFile.value) return
  uploading.value = true
  try {
    const dataset = await datasetService.ingest(pendingFile.value, {
      projectId: uploadForm.projectId,
      category: uploadForm.category,
      executionId: uploadForm.executionId || undefined,
      caseIds: uploadForm.caseIds,
      note: uploadForm.note,
    })
    ElMessage.success(`数据集 ${dataset.code} 已上传`)
    uploadOpen.value = false
    pendingFile.value = null
    if (fileInput.value) fileInput.value.value = ''
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message)
  } finally {
    uploading.value = false
  }
}

const previewOpen = ref(false)
const active = ref<Dataset | null>(null)

const openPreview = (row: Dataset) => {
  active.value = row
  previewOpen.value = true
}

const previewTable = computed(() => {
  if (!active.value?.previewHeaders) return []
  return (active.value.previewRows ?? []).map((row) => {
    const record: Record<string, string> = {}
    row.forEach((cell, idx) => {
      record[`c${idx}`] = cell
    })
    return record
  })
})

const previewChart = computed<EChartsOption | null>(() => {
  const dataset = active.value
  if (!dataset?.previewHeaders || !dataset.previewRows) return null
  const numericIndexes = dataset.previewHeaders
    .map((header, idx) => ({ header, idx }))
    .slice(1)
    .filter(({ idx }) => dataset.previewRows!.every((row) => row[idx] !== '' && !Number.isNaN(Number(row[idx]))))
  if (numericIndexes.length === 0) return null
  return {
    grid: { left: 44, right: 14, top: 22, bottom: 24 },
    tooltip: { trigger: 'axis' },
    legend: { top: 0, right: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 10 } },
    xAxis: {
      type: 'category',
      data: dataset.previewRows.map((row) => row[0]),
      axisLabel: { fontSize: 9, color: '#8494a8' },
      axisLine: { lineStyle: { color: '#e1e7ef' } },
    },
    yAxis: { type: 'value', scale: true, axisLabel: { fontSize: 9, color: '#8494a8' }, splitLine: { lineStyle: { color: '#eef2f7' } } },
    series: numericIndexes.map(({ header, idx }) => ({
      name: header,
      type: 'line' as const,
      smooth: true,
      showSymbol: false,
      data: dataset.previewRows!.map((row) => Number(row[idx])),
    })),
  }
})

const download = (row: Dataset) => {
  if (row.previewHeaders?.length && row.previewRows?.length) {
    downloadText(row.name.endsWith('.csv') ? row.name : `${row.name}.csv`, toCsv(row.previewHeaders, row.previewRows))
    ElMessage.success('已导出预览数据 CSV')
    return
  }
  ElMessage.info('演示环境只保存元信息，不包含真实二进制文件内容；接入对象存储后可下载原件。')
}

const remove = async (row: Dataset) => {
  try {
    await ElMessageBox.confirm(`删除数据集 ${row.code} ${row.name}？`, '删除数据集', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    datasetService.remove(row.id)
    previewOpen.value = false
    ElMessage.success('数据集已删除')
  } catch {
    // cancelled
  }
}

const exportCsv = () => {
  downloadText(
    `benchflow-datasets-${new Date().toISOString().slice(0, 10)}.csv`,
    toCsv(
      ['编号', '文件名', '类型', '分类', '大小(B)', '项目', '关联执行', '上传人', '上传时间'],
      filtered.value.map((d) => [
        d.code,
        d.name,
        fileKind.get(d.kind).label,
        datasetCategory.get(d.category).label,
        d.sizeBytes,
        projectName(d.projectId),
        d.executionId ?? '',
        memberName(d.uploadedBy),
        d.uploadedAt.slice(0, 16).replace('T', ' '),
      ]),
    ),
  )
  ElMessage.success('已导出数据集清单')
}

onMounted(() => {
  if (route.query.upload === '1' && app.can('create')) {
    window.setTimeout(() => fileInput.value?.click(), 300)
  }
})
</script>

<style scoped>
.storage-hint {
  margin-bottom: 10px;
  align-items: flex-start;
}

.hidden-input {
  display: none;
}

.file-link {
  border: none;
  background: none;
  padding: 0;
  font-size: 12.8px;
  font-weight: 550;
  color: var(--bf-ink);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  word-break: break-all;
}

.file-link:hover {
  color: var(--bf-accent);
  text-decoration: underline;
}

.link {
  color: var(--bf-accent);
  font-size: 11.5px;
}

.file-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--bf-border);
  border-radius: 5px;
  padding: 10px;
  background: var(--bf-surface-2);
  font-size: 12.5px;
}

.block-title {
  font-size: 12.5px;
  font-weight: 600;
  margin: 16px 0 8px;
  color: var(--bf-ink-2);
}

.drawer-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

@media (max-width: 760px) {
  .storage-hint {
    font-size: 11px;
  }
}
</style>
