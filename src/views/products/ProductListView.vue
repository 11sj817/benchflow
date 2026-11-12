<template>
  <div class="bf-page">
    <PageHeader title="产品与版本" :subtitle="`${filtered.length} 个产品 · 硬件 / 固件 / 软件 / 测试基线统一版本记录`">
      <template #actions>
        <el-button size="small" @click="exportCsv"><Download :size="14" /> 导出</el-button>
        <el-button v-if="app.can('create')" size="small" type="primary" @click="openCreate"><Plus :size="14" /> 新建产品</el-button>
      </template>
    </PageHeader>

    <section class="bf-panel">
      <div class="bf-toolbar">
        <el-input v-model="keyword" placeholder="搜索产品编号 / 名称" clearable style="width: 240px">
          <template #prefix><Search :size="14" /></template>
        </el-input>
        <el-select v-model="projectFilter" placeholder="项目" clearable style="width: 180px">
          <el-option v-for="project in db.projects" :key="project.id" :label="project.name" :value="project.id" />
        </el-select>
        <el-button text @click="resetFilters">重置</el-button>
        <span class="grow" />
        <span class="bf-filter-count">版本总数 {{ totalVersions }}</span>
      </div>

      <el-table :data="paged" size="small" @sort-change="onSortChange" @row-click="(row: Product) => router.push(`/products/${row.id}`)">
        <el-table-column prop="code" label="编号" width="100" sortable="custom">
          <template #default="{ row }"><span class="bf-table-code">{{ row.code }}</span></template>
        </el-table-column>
        <el-table-column prop="name" label="产品名称" min-width="220" sortable="custom">
          <template #default="{ row }">
            <div class="bf-table-name">{{ row.name }}</div>
            <div class="bf-sub ellipsis">{{ row.description }}</div>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="110">
          <template #default="{ row }">{{ productTypeLabel(row.type) }}</template>
        </el-table-column>
        <el-table-column label="所属项目" width="170">
          <template #default="{ row }">{{ projectName(row.projectId) }}</template>
        </el-table-column>
        <el-table-column label="负责人" width="94">
          <template #default="{ row }">
            <div class="bf-row">
              <UserAvatar :name="memberName(row.ownerId)" :color="memberColor(row.ownerId)" size="sm" />
              {{ memberName(row.ownerId) }}
            </div>
          </template>
        </el-table-column>
        <el-table-column label="版本" width="74" align="right" sortable="custom" prop="versions">
          <template #default="{ row }">
            <span class="num">{{ productService.stats(row.id).versions }}</span>
          </template>
        </el-table-column>
        <el-table-column label="执行" width="70" align="right">
          <template #default="{ row }">
            <span class="num">{{ productService.stats(row.id).runs }}</span>
          </template>
        </el-table-column>
        <el-table-column label="通过率" width="86" align="right">
          <template #default="{ row }">
            <span class="num">{{ productService.stats(row.id).passRate }}%</span>
          </template>
        </el-table-column>
        <el-table-column label="未关闭缺陷" width="100" align="right">
          <template #default="{ row }">
            <span class="num" :class="{ danger: productService.stats(row.id).openDefects > 0 }">
              {{ productService.stats(row.id).openDefects }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="132" fixed="right">
          <template #default="{ row }">
            <el-button size="small" text @click.stop="router.push(`/products/${row.id}`)">版本</el-button>
            <el-button v-if="app.can('edit')" size="small" text @click.stop="openEdit(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
      <DataPager v-model:page="page" v-model:page-size="pageSize" :total="total" />
    </section>

    <el-dialog v-model="dialogOpen" :title="editing ? '编辑产品' : '新建产品'" width="600px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="92px">
        <el-form-item label="产品名称" prop="name">
          <el-input v-model="form.name" maxlength="60" show-word-limit />
        </el-form-item>
        <el-form-item label="产品描述" prop="description">
          <el-input v-model="form.description" type="textarea" :rows="3" maxlength="300" />
        </el-form-item>
        <div class="form-grid">
          <el-form-item label="产品类型" prop="type">
            <el-select v-model="form.type" style="width: 100%">
              <el-option label="DC-DC 电源" value="dc_dc" />
              <el-option label="整流器" value="rectifier" />
              <el-option label="控制板" value="control_board" />
              <el-option label="传感器" value="sensor" />
              <el-option label="其他" value="other" />
            </el-select>
          </el-form-item>
          <el-form-item label="所属项目" prop="projectId">
            <el-select v-model="form.projectId" style="width: 100%">
              <el-option v-for="project in db.projects" :key="project.id" :label="project.name" :value="project.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="产品负责人" prop="ownerId">
            <el-select v-model="form.ownerId" style="width: 100%">
              <el-option v-for="member in db.members" :key="member.id" :label="member.name" :value="member.id" />
            </el-select>
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="dialogOpen = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Download, Plus, Search } from 'lucide-vue-next'
import type { Product, ProductType } from '@/types'
import { db } from '@/services/db'
import { productService } from '@/services/productService'
import type { ProductInput } from '@/services/productService'
import { useAppStore } from '@/stores/app'
import { useTable } from '@/composables/useTable'
import PageHeader from '@/components/common/PageHeader.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import DataPager from '@/components/common/DataPager.vue'
import { downloadText, toCsv } from '@/utils/csv'

const router = useRouter()
const app = useAppStore()

const keyword = ref('')
const projectFilter = ref('')

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return db.products.filter((row) => {
    if (projectFilter.value && row.projectId !== projectFilter.value) return false
    if (kw && !`${row.code} ${row.name} ${row.description}`.toLowerCase().includes(kw)) return false
    return true
  })
})

const accessors = {
  code: (row: Product) => row.code,
  name: (row: Product) => row.name,
  versions: (row: Product) => productService.stats(row.id).versions,
}

const { page, pageSize, total, paged, onSortChange } = useTable(filtered, { pageSize: 10, accessors })

const totalVersions = computed(() => filtered.value.reduce((sum, p) => sum + productService.stats(p.id).versions, 0))
const projectName = (id: string) => db.projects.find((p) => p.id === id)?.name ?? id
const memberName = (id: string) => db.members.find((m) => m.id === id)?.name ?? id
const memberColor = (id: string) => db.members.find((m) => m.id === id)?.color ?? '#6b7a8f'
const productTypeLabel = (type: ProductType) =>
  ({ dc_dc: 'DC-DC 电源', rectifier: '整流器', control_board: '控制板', sensor: '传感器', other: '其他' })[type]

const resetFilters = () => {
  keyword.value = ''
  projectFilter.value = ''
}

const dialogOpen = ref(false)
const editing = ref<Product | null>(null)
const formRef = ref<FormInstance>()
const form = reactive<ProductInput>({
  name: '',
  type: 'other',
  description: '',
  projectId: db.projects[0]?.id ?? '',
  ownerId: app.currentUser.id,
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入产品名称', trigger: 'blur' }],
  description: [{ required: true, message: '请输入产品描述', trigger: 'blur' }],
  projectId: [{ required: true, message: '请选择所属项目', trigger: 'change' }],
  ownerId: [{ required: true, message: '请选择负责人', trigger: 'change' }],
}

const openCreate = () => {
  editing.value = null
  Object.assign(form, {
    name: '',
    type: 'other',
    description: '',
    projectId: db.projects[0]?.id ?? '',
    ownerId: app.currentUser.id,
  })
  dialogOpen.value = true
}

const openEdit = (product: Product) => {
  editing.value = product
  Object.assign(form, {
    name: product.name,
    type: product.type,
    description: product.description,
    projectId: product.projectId,
    ownerId: product.ownerId,
  })
  dialogOpen.value = true
}

const save = async () => {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  if (editing.value) {
    productService.update(editing.value.id, { ...form })
    ElMessage.success('产品已更新')
  } else {
    const created = productService.create({ ...form })
    ElMessage.success(`产品 ${created.name} 已创建`)
    router.push(`/products/${created.id}`)
  }
  dialogOpen.value = false
}

const exportCsv = () => {
  downloadText(
    `benchflow-products-${new Date().toISOString().slice(0, 10)}.csv`,
    toCsv(
      ['产品编号', '产品名称', '类型', '所属项目', '负责人', '版本数', '执行数', '通过率', '未关闭缺陷'],
      filtered.value.map((p) => {
        const stats = productService.stats(p.id)
        return [p.code, p.name, productTypeLabel(p.type), projectName(p.projectId), memberName(p.ownerId), stats.versions, stats.runs, `${stats.passRate}%`, stats.openDefects]
      }),
    ),
  )
  ElMessage.success('已导出产品 CSV')
}
</script>

<style scoped>
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 14px;
}

.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 430px;
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
