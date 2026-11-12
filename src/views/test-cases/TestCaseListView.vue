<template>
  <div class="bf-page">
    <PageHeader title="测试用例库" :subtitle="`${filtered.length} 条用例 · 覆盖电气、性能、环境、可靠性与功能验证`">
      <template #actions>
        <el-button size="small" @click="exportCsv"><Download :size="14" /> 导出</el-button>
        <el-button v-if="app.can('create')" size="small" @click="importOpen = true"><Upload :size="14" /> 批量导入</el-button>
        <el-button v-if="app.can('create')" size="small" type="primary" @click="router.push('/test-cases/new')">
          <Plus :size="14" /> 新建用例
        </el-button>
      </template>
    </PageHeader>

    <section class="bf-panel">
      <div class="bf-toolbar">
        <el-input v-model="keyword" placeholder="搜索用例编号 / 名称 / 标签" clearable style="width: 250px">
          <template #prefix><Search :size="14" /></template>
        </el-input>
        <el-select v-model="categoryFilter" placeholder="测试分类" clearable style="width: 130px">
          <el-option v-for="(row, key) in testCategory.map" :key="key" :label="row.label" :value="key" />
        </el-select>
        <el-select v-model="statusFilter" placeholder="状态" clearable style="width: 110px">
          <el-option v-for="(row, key) in caseStatus.map" :key="key" :label="row.label" :value="key" />
        </el-select>
        <el-select v-model="productFilter" placeholder="适用产品" clearable style="width: 180px">
          <el-option v-for="product in db.products" :key="product.id" :label="product.name" :value="product.id" />
        </el-select>
        <el-button text @click="resetFilters">重置</el-button>
        <span class="grow" />
        <span class="bf-filter-count">{{ total }} 条</span>
      </div>

      <el-table :data="paged" size="small" @sort-change="onSortChange">
        <el-table-column prop="code" label="编号" width="94" sortable="custom">
          <template #default="{ row }"><span class="bf-table-code">{{ row.code }}</span></template>
        </el-table-column>
        <el-table-column prop="name" label="用例名称" min-width="240" sortable="custom">
          <template #default="{ row }">
            <router-link :to="`/test-cases/${row.id}/edit`" class="bf-table-name link">{{ row.name }}</router-link>
            <div class="bf-sub ellipsis">{{ row.purpose }}</div>
          </template>
        </el-table-column>
        <el-table-column label="分类" width="104">
          <template #default="{ row }">
            <StatusPill :label="testCategory.get(row.category).label" :tone="testCategory.get(row.category).tone" />
          </template>
        </el-table-column>
        <el-table-column label="步骤 / 参数" width="96" align="center">
          <template #default="{ row }">
            <span class="num">{{ row.steps.length }}</span> / <span class="num">{{ paramCount(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="优先级" width="82">
          <template #default="{ row }"><StatusPill :label="priority.get(row.priority).label" :tone="priority.get(row.priority).tone" /></template>
        </el-table-column>
        <el-table-column label="版本" width="70">
          <template #default="{ row }"><span class="mono">{{ row.version }}</span></template>
        </el-table-column>
        <el-table-column label="状态" width="88">
          <template #default="{ row }"><StatusPill :label="caseStatus.get(row.status).label" :tone="caseStatus.get(row.status).tone" /></template>
        </el-table-column>
        <el-table-column label="适用产品" width="150">
          <template #default="{ row }">
            <span class="bf-sub">{{ row.productIds.map(productName).join('、') || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="维护人" width="84">
          <template #default="{ row }">{{ memberName(row.ownerId) }}</template>
        </el-table-column>
        <el-table-column label="更新时间" width="104" sortable="custom" prop="updatedAt">
          <template #default="{ row }"><span class="bf-sub">{{ fmtDate(row.updatedAt) }}</span></template>
        </el-table-column>
        <el-table-column label="操作" width="112" fixed="right">
          <template #default="{ row }">
            <el-button size="small" text @click="router.push(`/test-cases/${row.id}/edit`)">编辑</el-button>
            <el-dropdown trigger="click" @command="(cmd: string) => onCommand(cmd, row)">
              <el-button size="small" text @click.stop>更多<ChevronDown :size="12" /></el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="duplicate">复制用例</el-dropdown-item>
                  <el-dropdown-item command="deprecate">停用</el-dropdown-item>
                  <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
      </el-table>
      <DataPager v-model:page="page" v-model:page-size="pageSize" :total="total" />
    </section>

    <el-dialog v-model="importOpen" title="批量导入测试用例（CSV）" width="580px">
      <div class="bf-hint">
        支持列：名称、分类、目的、前置条件、环境、优先级、标签。分类可填「电气测试 / 性能测试 / 功能测试」等中文名称。
        导入后生成草稿用例，需补充步骤与测量参数后再发布。
      </div>
      <div class="import-row">
        <input ref="fileInput" type="file" accept=".csv,text/csv" @change="onFile" />
        <el-button size="small" text @click="downloadTemplate">下载导入模板</el-button>
      </div>
      <div v-if="importSummary" class="bf-hint">{{ importSummary }}</div>
      <template #footer>
        <el-button @click="importOpen = false">取消</el-button>
        <el-button type="primary" :loading="importing" :disabled="!importRows.length" @click="doImport">
          导入 {{ importRows.length }} 条
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ChevronDown, Download, Plus, Search, Upload } from 'lucide-vue-next'
import type { CaseStatus, TestCase, TestCategory } from '@/types'
import { db } from '@/services/db'
import { testCaseService } from '@/services/testService'
import { useAppStore } from '@/stores/app'
import { useTable } from '@/composables/useTable'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import DataPager from '@/components/common/DataPager.vue'
import { caseStatus, fmtDate, priority, testCategory } from '@/utils/format'
import { downloadText, parseCsv, readFileText, toCsv } from '@/utils/csv'

const router = useRouter()
const app = useAppStore()

const keyword = ref('')
const categoryFilter = ref<TestCategory | ''>('')
const statusFilter = ref<CaseStatus | ''>('')
const productFilter = ref('')

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return db.cases.filter((row) => {
    if (categoryFilter.value && row.category !== categoryFilter.value) return false
    if (statusFilter.value && row.status !== statusFilter.value) return false
    if (productFilter.value && !row.productIds.includes(productFilter.value)) return false
    if (kw && !`${row.code} ${row.name} ${row.tags.join(' ')} ${row.purpose}`.toLowerCase().includes(kw)) return false
    return true
  })
})

const accessors = {
  code: (row: TestCase) => row.code,
  name: (row: TestCase) => row.name,
  updatedAt: (row: TestCase) => row.updatedAt,
}

const { page, pageSize, total, paged, onSortChange } = useTable(filtered, { pageSize: 10, accessors })

const paramCount = (row: TestCase) => row.steps.filter((s) => s.param).length
const productName = (id: string) => db.products.find((p) => p.id === id)?.name ?? id
const memberName = (id: string) => db.members.find((m) => m.id === id)?.name ?? id

const resetFilters = () => {
  keyword.value = ''
  categoryFilter.value = ''
  statusFilter.value = ''
  productFilter.value = ''
}

const onCommand = async (command: string, row: TestCase) => {
  if (command === 'duplicate') {
    const copy = testCaseService.duplicate(row.id)
    if (copy) {
      ElMessage.success(`已复制为 ${copy.code}`)
      router.push(`/test-cases/${copy.id}/edit`)
    }
    return
  }
  if (command === 'deprecate') {
    await ElMessageBox.confirm(`停用后该用例不会再用于新计划，历史执行保留。停用「${row.name}」？`, '停用用例', {
      type: 'warning',
      confirmButtonText: '停用',
      cancelButtonText: '取消',
    })
    testCaseService.setStatus(row.id, 'deprecated')
    ElMessage.success('用例已停用')
    return
  }
  if (command === 'delete') {
    try {
      await ElMessageBox.confirm(`删除用例「${row.name}」不可恢复。`, '删除用例', {
        type: 'error',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
      })
      testCaseService.remove(row.id)
      ElMessage.success('用例已删除')
    } catch (error) {
      if (error instanceof Error) ElMessage.error(error.message)
    }
  }
}

const exportCsv = () => {
  downloadText(
    `benchflow-cases-${new Date().toISOString().slice(0, 10)}.csv`,
    toCsv(
      ['用例编号', '用例名称', '分类', '目的', '前置条件', '环境', '步骤数', '测量参数', '优先级', '状态', '版本', '适用产品'],
      filtered.value.map((c) => [
        c.code,
        c.name,
        testCategory.get(c.category).label,
        c.purpose,
        c.precondition,
        c.environment,
        c.steps.length,
        c.steps.filter((s) => s.param).map((s) => `${s.param?.name}(${s.param?.unit})`).join(' / '),
        priority.get(c.priority).label,
        caseStatus.get(c.status).label,
        c.version,
        c.productIds.map(productName).join(' / '),
      ]),
    ),
  )
  ElMessage.success('已导出用例 CSV')
}

const importOpen = ref(false)
const importing = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const importRows = ref<Record<string, string>[]>([])
const importSummary = ref('')

const categoryFromLabel = (label: string): TestCategory => {
  const found = Object.entries(testCategory.map).find(([, row]) => row.label === label)
  return (found?.[0] as TestCategory) ?? 'functional'
}

const onFile = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const text = await readFileText(file)
  const parsed = parseCsv(text)
  importRows.value = parsed.rows
    .map((cells) => {
      const row: Record<string, string> = {}
      parsed.headers.forEach((header, idx) => {
        row[header] = cells[idx] ?? ''
      })
      return row
    })
    .filter((row) => (row['名称'] ?? row['name'] ?? '').trim())
  importSummary.value = importRows.value.length
    ? `已解析 ${importRows.value.length} 条用例，将导入为草稿。`
    : '没有解析到有效数据，请检查表头是否包含「名称」列。'
}

const downloadTemplate = () => {
  downloadText(
    'benchflow-case-import-template.csv',
    toCsv(
      ['名称', '分类', '目的', '前置条件', '环境', '优先级', '标签'],
      [
        ['输出纹波复测', '电气测试', '验证满载输出纹波', '示波器校准完成', '室温 25℃', 'P1', '纹波,回归'],
      ],
    ),
  )
}

const doImport = async () => {
  importing.value = true
  try {
    let count = 0
    importRows.value.forEach((row) => {
      const name = (row['名称'] ?? row['name'] ?? '').trim()
      if (!name) return
      testCaseService.create(
        {
          name,
          category: categoryFromLabel((row['分类'] ?? row['category'] ?? '').trim()),
          purpose: row['目的'] ?? '',
          precondition: row['前置条件'] ?? '',
          environment: row['环境'] ?? '',
          priority: (['P0', 'P1', 'P2', 'P3'].includes((row['优先级'] ?? '').trim()) ? (row['优先级'] ?? 'P2').trim() : 'P2') as TestCase['priority'],
          productIds: [],
          tags: (row['标签'] ?? '').split(/[,，]/).map((t) => t.trim()).filter(Boolean),
          steps: [
            {
              id: `S-${Date.now()}-${count}`,
              name: '步骤 1',
              action: '补充操作说明',
              expected: '补充预期结果',
              param: null,
            },
          ],
        },
        'draft',
      )
      count += 1
    })
    ElMessage.success(`已导入 ${count} 条用例（草稿）`)
    importOpen.value = false
    importRows.value = []
    importSummary.value = ''
    if (fileInput.value) fileInput.value.value = ''
  } finally {
    importing.value = false
  }
}
</script>

<style scoped>
.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 440px;
}

.link {
  color: var(--bf-ink);
  text-decoration: none;
}

.link:hover {
  color: var(--bf-accent);
  text-decoration: underline;
}

.import-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 14px 0;
  flex-wrap: wrap;
}
</style>
