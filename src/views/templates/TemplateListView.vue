<template>
  <div class="bf-page">
    <PageHeader title="模板中心" :subtitle="`${filtered.length} 个测试模板 · 预置参考模板 + 团队自定义模板`">
      <template #actions>
        <input ref="importInput" type="file" accept=".json,application/json" class="hidden-input" @change="importTemplates" />
        <el-button size="small" @click="exportTemplates"><Download :size="14" /> 导出</el-button>
        <el-button size="small" @click="importInput?.click()"><Upload :size="14" /> 导入</el-button>
        <el-button v-if="app.can('create')" size="small" type="primary" @click="openCreate"><Plus :size="14" /> 新建模板</el-button>
      </template>
    </PageHeader>

    <div class="bf-hint warn">
      预置模板为参考模板，仅作为测试设计起点，不代表已满足任何认证标准、行业规范或客户规范。使用前请由测试负责人评审并补充项目特定条件。
    </div>

    <div class="bf-toolbar templates-toolbar">
      <el-input v-model="keyword" placeholder="搜索模板名称 / 说明" clearable style="width: 250px">
        <template #prefix><Search :size="14" /></template>
      </el-input>
      <el-select v-model="categoryFilter" placeholder="测试分类" clearable style="width: 140px">
        <el-option v-for="(row, key) in testCategory.map" :key="key" :label="row.label" :value="key" />
      </el-select>
      <span class="grow" />
      <span class="bf-filter-count">{{ filtered.length }} 个模板</span>
    </div>

    <div class="template-grid">
      <article v-for="template in filtered" :key="template.id" class="template-card">
        <header class="t-head">
          <div>
            <div class="bf-row">
              <StatusPill :label="testCategory.get(template.category).label" :tone="testCategory.get(template.category).tone" />
              <span class="bf-chip">{{ template.builtin ? '预置参考' : '自定义' }}</span>
            </div>
            <h3>{{ template.name }}</h3>
          </div>
          <span class="bf-table-code">{{ template.code }}</span>
        </header>
        <p class="t-desc">{{ template.description }}</p>
        <div class="t-meta">
          <span>{{ template.steps.length }} 个步骤</span>
          <span>{{ template.params.length }} 个测量项</span>
        </div>
        <div class="t-params">
          <span v-for="param in template.params.slice(0, 3)" :key="param.name" class="param-chip">
            {{ param.name }}
            <b>{{ param.min ?? '—' }} ~ {{ param.max ?? '—' }} {{ param.unit }}</b>
          </span>
        </div>
        <footer class="t-foot">
          <el-button size="small" text @click="openDetail(template)">查看</el-button>
          <el-button size="small" text @click="copyTemplate(template)">复制</el-button>
          <el-button size="small" type="primary" plain @click="useTemplate(template)">使用模板建用例</el-button>
        </footer>
      </article>
      <EmptyState v-if="filtered.length === 0" text="没有匹配的模板" />
    </div>

    <el-drawer v-model="drawerOpen" :title="active ? active.name : ''" size="600px">
      <template v-if="active">
        <div class="bf-row" style="gap: 8px; margin-bottom: 8px">
          <StatusPill :label="testCategory.get(active.category).label" :tone="testCategory.get(active.category).tone" />
          <span class="bf-chip">{{ active.builtin ? '预置参考模板' : '自定义模板' }}</span>
        </div>
        <p class="paragraph">{{ active.description }}</p>
        <div class="disclaimer">{{ active.disclaimer }}</div>

        <h4 class="block-title">测量参数</h4>
        <el-table :data="active.params" size="small">
          <el-table-column prop="name" label="参数" min-width="140" />
          <el-table-column prop="unit" label="单位" width="80" />
          <el-table-column label="下限" width="80" align="right">
            <template #default="{ row }">{{ row.min ?? '—' }}</template>
          </el-table-column>
          <el-table-column label="上限" width="80" align="right">
            <template #default="{ row }">{{ row.max ?? '—' }}</template>
          </el-table-column>
        </el-table>
        <EmptyState v-if="active.params.length === 0" text="该模板没有预置测量参数" />

        <h4 class="block-title">测试步骤</h4>
        <div class="t-steps">
          <div v-for="(step, idx) in active.steps" :key="idx" class="t-step">
            <span class="step-index">{{ idx + 1 }}</span>
            <div>
              <strong>{{ step.name }}</strong>
              <div class="bf-sub">操作：{{ step.action }}</div>
              <div class="bf-sub">预期：{{ step.expected }}</div>
            </div>
          </div>
        </div>

        <div class="drawer-actions">
          <el-button size="small" @click="copyTemplate(active)">复制为自定义模板</el-button>
          <el-button size="small" type="primary" @click="useTemplate(active)">使用模板创建用例</el-button>
        </div>
      </template>
    </el-drawer>

    <el-dialog v-model="dialogOpen" title="新建自定义模板" width="700px" destroy-on-close>
      <el-form :model="form" label-width="88px">
        <div class="form-grid">
          <el-form-item label="模板名称"><el-input v-model="form.name" /></el-form-item>
          <el-form-item label="测试分类">
            <el-select v-model="form.category" style="width: 100%">
              <el-option v-for="(row, key) in testCategory.map" :key="key" :label="row.label" :value="key" />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item label="模板说明"><el-input v-model="form.description" type="textarea" :rows="2" /></el-form-item>

        <el-form-item label="测量参数">
          <div class="edit-rows">
            <div v-for="(param, idx) in form.params" :key="idx" class="edit-row">
              <el-input v-model="param.name" size="small" placeholder="参数名称" style="flex: 1" />
              <el-input v-model="param.unit" size="small" placeholder="单位" style="width: 90px" />
              <el-input-number v-model="param.min" :controls="false" size="small" placeholder="下限" style="width: 100px" />
              <el-input-number v-model="param.max" :controls="false" size="small" placeholder="上限" style="width: 100px" />
              <el-button size="small" text type="danger" @click="form.params.splice(idx, 1)"><Trash2 :size="14" /></el-button>
            </div>
            <el-button size="small" @click="form.params.push({ name: '', unit: '', min: null, max: null })"><Plus :size="14" /> 添加参数</el-button>
          </div>
        </el-form-item>

        <el-form-item label="测试步骤">
          <div class="edit-rows">
            <div v-for="(step, idx) in form.steps" :key="idx" class="step-edit">
              <div class="step-edit-head">
                <el-input v-model="step.name" size="small" placeholder="步骤名称" style="flex: 1" />
                <el-button size="small" text type="danger" @click="form.steps.splice(idx, 1)"><Trash2 :size="14" /></el-button>
              </div>
              <el-input v-model="step.action" size="small" type="textarea" :rows="2" placeholder="操作说明" />
              <el-input v-model="step.expected" size="small" type="textarea" :rows="2" placeholder="预期结果" />
            </div>
            <el-button size="small" @click="form.steps.push({ name: '', action: '', expected: '' })"><Plus :size="14" /> 添加步骤</el-button>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogOpen = false">取消</el-button>
        <el-button type="primary" @click="save">保存模板</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Download, Plus, Search, Trash2, Upload } from 'lucide-vue-next'
import type { Template, TestCategory } from '@/types'
import { db } from '@/services/db'
import { templateService } from '@/services/assetService'
import { useAppStore } from '@/stores/app'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { testCategory } from '@/utils/format'
import { downloadText, readFileText } from '@/utils/csv'

const router = useRouter()
const app = useAppStore()

const keyword = ref('')
const categoryFilter = ref<TestCategory | ''>('')

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return db.templates.filter((row) => {
    if (categoryFilter.value && row.category !== categoryFilter.value) return false
    if (kw && !`${row.name} ${row.description}`.toLowerCase().includes(kw)) return false
    return true
  })
})

const drawerOpen = ref(false)
const active = ref<Template | null>(null)

const openDetail = (template: Template) => {
  active.value = template
  drawerOpen.value = true
}

const copyTemplate = (template: Template) => {
  const copy = templateService.duplicate(template.id)
  if (copy) ElMessage.success(`已复制为 ${copy.code}（可编辑）`)
}

const useTemplate = (template: Template) => {
  router.push(`/test-cases/new?template=${template.id}`)
}

const dialogOpen = ref(false)
const form = reactive({
  name: '',
  category: 'electrical' as TestCategory,
  description: '',
  params: [{ name: '', unit: '', min: null as number | null, max: null as number | null }],
  steps: [{ name: '', action: '', expected: '' }],
})

const openCreate = () => {
  Object.assign(form, {
    name: '',
    category: 'electrical',
    description: '',
    params: [{ name: '', unit: '', min: null, max: null }],
    steps: [{ name: '', action: '', expected: '' }],
  })
  dialogOpen.value = true
}

const save = () => {
  if (!form.name.trim()) {
    ElMessage.warning('请填写模板名称')
    return
  }
  const steps = form.steps.filter((s) => s.name.trim())
  if (steps.length === 0) {
    ElMessage.warning('至少需要一个测试步骤')
    return
  }
  const created = templateService.create({
    name: form.name.trim(),
    category: form.category,
    description: form.description,
    params: form.params.filter((p) => p.name.trim()),
    steps,
  })
  ElMessage.success(`模板 ${created.code} 已创建`)
  dialogOpen.value = false
}

const importInput = ref<HTMLInputElement | null>(null)

const exportTemplates = () => {
  downloadText('benchflow-templates.json', JSON.stringify(filtered.value, null, 2), 'application/json')
  ElMessage.success('已导出模板 JSON')
}

const importTemplates = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const text = await readFileText(file)
    const parsed = JSON.parse(text) as Template[]
    if (!Array.isArray(parsed)) throw new Error('文件格式不是模板数组')
    let count = 0
    parsed.forEach((item) => {
      if (!item.name || !Array.isArray(item.steps)) return
      templateService.create({
        name: `${item.name}（导入）`,
        category: item.category ?? 'functional',
        description: item.description ?? '',
        params: item.params ?? [],
        steps: item.steps,
      })
      count += 1
    })
    ElMessage.success(`已导入 ${count} 个模板`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '模板导入失败')
  } finally {
    if (importInput.value) importInput.value.value = ''
  }
}
</script>

<style scoped>
.hidden-input {
  display: none;
}

.templates-toolbar {
  margin-top: 12px;
  border: 1px solid var(--bf-border);
  border-radius: var(--bf-radius-lg);
  background: var(--bf-surface);
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 12px;
}

.template-card {
  background: var(--bf-surface);
  border: 1px solid var(--bf-border);
  border-radius: var(--bf-radius-lg);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.template-card:hover {
  border-color: var(--bf-border-strong);
}

.t-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-start;
}

.t-head h3 {
  font-size: 13.5px;
  font-weight: 620;
  margin-top: 6px;
  line-height: 1.4;
}

.t-desc {
  font-size: 12px;
  color: var(--bf-ink-2);
  line-height: 1.55;
  min-height: 37px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.t-meta {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: var(--bf-ink-3);
}

.t-params {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.param-chip {
  font-size: 11px;
  color: var(--bf-ink-3);
  display: flex;
  justify-content: space-between;
  gap: 8px;
  background: var(--bf-surface-2);
  border-radius: 3px;
  padding: 2px 6px;
}

.param-chip b {
  color: var(--bf-ink-2);
  font-weight: 500;
  font-family: var(--bf-mono);
  font-size: 10.5px;
}

.t-foot {
  display: flex;
  gap: 4px;
  justify-content: flex-end;
  border-top: 1px solid var(--bf-border);
  padding-top: 8px;
  margin-top: auto;
}

.paragraph {
  font-size: 12.8px;
  line-height: 1.7;
  color: var(--bf-ink-2);
}

.disclaimer {
  margin-top: 10px;
  background: #fdf6ea;
  border: 1px solid #f0dfc0;
  color: #80510a;
  border-radius: 5px;
  padding: 8px 10px;
  font-size: 11.5px;
  line-height: 1.55;
}

.block-title {
  font-size: 12.5px;
  font-weight: 600;
  margin: 16px 0 8px;
  color: var(--bf-ink-2);
}

.t-steps {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.t-step {
  display: flex;
  gap: 8px;
  font-size: 12px;
}

.step-index {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--bf-surface-3);
  color: var(--bf-ink-2);
  font-size: 10.5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
}

.drawer-actions {
  display: flex;
  gap: 8px;
  margin-top: 18px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 14px;
}

.edit-rows {
  display: flex;
  flex-direction: column;
  gap: 7px;
  width: 100%;
}

.edit-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.step-edit {
  border: 1px solid var(--bf-border);
  border-radius: 5px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--bf-surface-2);
}

.step-edit-head {
  display: flex;
  gap: 6px;
  align-items: center;
}

@media (max-width: 1280px) {
  .template-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .template-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .form-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
