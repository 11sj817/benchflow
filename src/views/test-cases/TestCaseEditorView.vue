<template>
  <div class="bf-page editor-page">
    <PageHeader :title="isNew ? '新建测试用例' : `编辑用例 · ${code}`" :subtitle="subtitle">
      <template #actions>
        <el-button size="small" @click="router.push('/test-cases')"><ArrowLeft :size="14" /> 返回列表</el-button>
        <el-button v-if="app.can('edit')" size="small" @click="save(false)">保存草稿</el-button>
        <el-button v-if="app.can('edit')" size="small" type="primary" @click="save(true)">
          <Check :size="14" /> 发布用例
        </el-button>
      </template>
    </PageHeader>

    <div class="editor-grid">
      <div class="editor-main">
        <section class="bf-panel">
          <header class="bf-panel-header"><h2>1. 基础信息</h2><span class="bf-sub">用例编号由系统分配</span></header>
          <div class="bf-panel-body">
            <el-form ref="formRef" :model="form" :rules="rules" label-width="96px">
              <el-form-item label="用例名称" prop="name">
                <el-input v-model="form.name" maxlength="80" show-word-limit placeholder="例如：输出纹波与噪声" />
              </el-form-item>
              <div class="form-grid">
                <el-form-item label="测试分类" prop="category">
                  <el-select v-model="form.category" style="width: 100%">
                    <el-option v-for="(row, key) in testCategory.map" :key="key" :label="row.label" :value="key" />
                  </el-select>
                </el-form-item>
                <el-form-item label="优先级" prop="priority">
                  <el-select v-model="form.priority" style="width: 100%">
                    <el-option v-for="(row, key) in priority.map" :key="key" :label="row.label" :value="key" />
                  </el-select>
                </el-form-item>
              </div>
              <el-form-item label="测试目的" prop="purpose">
                <el-input v-model="form.purpose" type="textarea" :rows="2" maxlength="300" show-word-limit />
              </el-form-item>
              <el-form-item label="适用产品">
                <el-select v-model="form.productIds" multiple style="width: 100%">
                  <el-option v-for="product in db.products" :key="product.id" :label="product.name" :value="product.id" />
                </el-select>
              </el-form-item>
              <el-form-item label="标签">
                <el-select v-model="form.tags" multiple filterable allow-create default-first-option style="width: 100%" placeholder="输入回车创建标签" />
              </el-form-item>
            </el-form>
          </div>
        </section>

        <section class="bf-panel">
          <header class="bf-panel-header"><h2>2. 前置条件与测试环境</h2></header>
          <div class="bf-panel-body">
            <el-form label-width="96px">
              <el-form-item label="前置条件">
                <el-input v-model="form.precondition" type="textarea" :rows="2" placeholder="设备校准、样机状态、接线方式等" />
              </el-form-item>
              <el-form-item label="测试环境">
                <el-input v-model="form.environment" type="textarea" :rows="2" placeholder="温度、湿度、输入电压、散热条件等" />
              </el-form-item>
            </el-form>
          </div>
        </section>

        <section class="bf-panel">
          <header class="bf-panel-header">
            <h2>3. 测试步骤与测量参数</h2>
            <div class="bf-row">
              <span class="bf-sub">共 {{ form.steps.length }} 步 · {{ paramCount }} 个测量项</span>
              <el-button size="small" @click="addStep"><Plus :size="14" /> 添加步骤</el-button>
            </div>
          </header>
          <div class="steps">
            <div v-for="(step, index) in form.steps" :key="step.id" class="step-card">
              <div class="step-head">
                <span class="step-index">{{ index + 1 }}</span>
                <el-input v-model="step.name" size="small" placeholder="步骤名称" style="max-width: 260px" />
                <span class="grow" />
                <el-button size="small" text :disabled="index === 0" @click="moveStep(index, -1)"><ArrowUp :size="14" /></el-button>
                <el-button size="small" text :disabled="index === form.steps.length - 1" @click="moveStep(index, 1)"><ArrowDown :size="14" /></el-button>
                <el-button size="small" text type="danger" @click="removeStep(index)"><Trash2 :size="14" /></el-button>
              </div>
              <div class="step-body">
                <label class="field-block">
                  <span>操作说明</span>
                  <el-input v-model="step.action" type="textarea" :rows="2" placeholder="如何执行这一步" />
                </label>
                <label class="field-block">
                  <span>预期结果</span>
                  <el-input v-model="step.expected" type="textarea" :rows="2" placeholder="如何判定通过" />
                </label>
              </div>

              <div class="param-box">
                <div class="param-head">
                  <el-switch
                    :model-value="!!step.param"
                    size="small"
                    @update:model-value="(value: boolean) => toggleParam(step, value)"
                  />
                  <span class="param-title">测量参数与验收阈值</span>
                  <span v-if="step.param" class="bf-sub">阈值由用例配置，执行时自动判定 PASS / FAIL</span>
                </div>
                <div v-if="step.param" class="param-grid">
                  <el-input v-model="step.param.name" size="small" placeholder="参数名称，如 输出纹波（满载）" />
                  <el-input v-model="step.param.unit" size="small" placeholder="单位，如 mV" style="width: 110px" />
                  <el-input-number
                    :model-value="step.param.min ?? undefined"
                    :controls="false"
                    size="small"
                    placeholder="下限"
                    style="width: 110px"
                    @change="(value: number | undefined) => setParamValue(step, 'min', value)"
                  />
                  <el-input-number
                    :model-value="step.param.max ?? undefined"
                    :controls="false"
                    size="small"
                    placeholder="上限"
                    style="width: 110px"
                    @change="(value: number | undefined) => setParamValue(step, 'max', value)"
                  />
                  <el-checkbox v-model="step.param.required" size="small">必填</el-checkbox>
                </div>
                <div v-if="step.param" class="param-preview">
                  判定规则：
                  <span class="mono">{{ step.param.name || '参数' }}</span>
                  {{ ruleText(step.param) }}
                </div>
              </div>
            </div>
            <EmptyState v-if="form.steps.length === 0" text="还没有测试步骤" hint="添加步骤后可配置测量参数与验收阈值。">
              <el-button size="small" @click="addStep">添加第一步</el-button>
            </EmptyState>
          </div>
        </section>

        <div class="editor-footer">
          <el-button @click="router.push('/test-cases')">取消</el-button>
          <el-button @click="save(false)">保存草稿</el-button>
          <el-button type="primary" @click="save(true)">发布用例</el-button>
        </div>
      </div>

      <aside class="editor-side">
        <section class="bf-panel">
          <header class="bf-panel-header"><h2>用例状态</h2></header>
          <div class="bf-panel-body side-body">
            <el-descriptions :column="1" size="small">
              <el-descriptions-item label="编号">{{ code }}</el-descriptions-item>
              <el-descriptions-item label="版本">
                <span class="mono">{{ form.version }}</span>
              </el-descriptions-item>
              <el-descriptions-item label="状态">
                <StatusPill :label="caseStatus.get(form.status).label" :tone="caseStatus.get(form.status).tone" />
              </el-descriptions-item>
              <el-descriptions-item label="维护人">{{ memberName(form.ownerId) }}</el-descriptions-item>
              <el-descriptions-item label="更新时间">{{ fmtDateTime(form.updatedAt) }}</el-descriptions-item>
            </el-descriptions>
            <div class="bf-hint">
              发布后版本号递增，并写入版本历史。已发布的用例仍可继续修订，不影响历史执行记录。
            </div>
          </div>
        </section>

        <section class="bf-panel">
          <header class="bf-panel-header"><h2>测量项预览</h2><span class="bf-chip">{{ paramCount }}</span></header>
          <div class="bf-panel-body side-body">
            <div v-for="step in paramSteps" :key="step.id" class="measure-preview">
              <strong>{{ step.param?.name || '未命名参数' }}</strong>
              <span class="bf-sub">{{ ruleText(step.param) }} · {{ step.param?.unit }} · {{ step.param?.required ? '必填' : '选填' }}</span>
            </div>
            <EmptyState v-if="paramSteps.length === 0" text="尚未配置测量参数" />
          </div>
        </section>

        <section class="bf-panel">
          <header class="bf-panel-header"><h2>版本历史</h2></header>
          <div class="bf-panel-body side-body">
            <div class="revisions">
              <div v-for="(rev, idx) in form.revisions.slice(0, 8)" :key="`${rev.version}-${idx}`" class="revision">
                <span class="mono rev-version">{{ rev.version }}</span>
                <div class="rev-main">
                  <div>{{ rev.summary }}</div>
                  <div class="bf-sub">{{ memberName(rev.by) }} · {{ fmtDateTime(rev.at) }}</div>
                </div>
              </div>
              <EmptyState v-if="form.revisions.length === 0" text="暂无版本记录" />
            </div>
          </div>
        </section>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { ArrowDown, ArrowLeft, ArrowUp, Check, Plus, Trash2 } from 'lucide-vue-next'
import type { CaseStatus, CaseRevision, Priority, TestCase, TestCategory, TestStep } from '@/types'
import { db } from '@/services/db'
import { testCaseService } from '@/services/testService'
import { useAppStore } from '@/stores/app'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { caseStatus, fmtDateTime, priority, testCategory } from '@/utils/format'
import { uid } from '@/utils/id'

const route = useRoute()
const router = useRouter()
const app = useAppStore()

const isNew = computed(() => route.name === 'test-case-create')
const source = computed<TestCase | undefined>(() =>
  isNew.value ? undefined : db.cases.find((c) => c.id === route.params.id),
)

const code = computed(() => source.value?.code ?? 'TC-新建')

interface EditorForm {
  name: string
  category: TestCategory
  purpose: string
  precondition: string
  environment: string
  steps: TestStep[]
  priority: Priority
  productIds: string[]
  tags: string[]
  status: CaseStatus
  version: string
  ownerId: string
  updatedAt: string
  revisions: CaseRevision[]
}

const formRef = ref<FormInstance>()
const form = reactive<EditorForm>({
  name: '',
  category: 'functional',
  purpose: '',
  precondition: '',
  environment: '',
  steps: [],
  priority: 'P1',
  productIds: [],
  tags: [],
  status: 'draft',
  version: 'v1.0',
  ownerId: app.currentUser.id,
  updatedAt: new Date().toISOString(),
  revisions: [],
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入用例名称', trigger: 'blur' }],
  category: [{ required: true, message: '请选择测试分类', trigger: 'change' }],
  purpose: [{ required: true, message: '请填写测试目的', trigger: 'blur' }],
}

const subtitle = computed(() =>
  isNew.value ? '配置测试步骤与测量阈值，保存草稿或直接发布' : `${source.value?.purpose ?? ''}`,
)

const paramSteps = computed(() => form.steps.filter((s) => s.param))
const paramCount = computed(() => paramSteps.value.length)

const memberName = (id: string) => db.members.find((m) => m.id === id)?.name ?? id

const hydrate = () => {
  const row = source.value
  if (!row) {
    // 从模板预填
    const templateId = typeof route.query.template === 'string' ? route.query.template : ''
    const template = db.templates.find((t) => t.id === templateId)
    if (template) {
      form.name = template.name.replace('模板', '')
      form.category = template.category
      form.purpose = template.description
      form.steps = template.steps.map((step, index) => ({
        id: uid('S'),
        name: step.name,
        action: step.action,
        expected: step.expected,
        param: template.params[index]
          ? {
              name: template.params[index].name,
              unit: template.params[index].unit,
              min: template.params[index].min,
              max: template.params[index].max,
              target: null,
              required: true,
            }
          : null,
      }))
      form.tags = ['模板创建']
    } else {
      form.steps = [
        { id: uid('S'), name: '步骤 1', action: '', expected: '', param: null },
      ]
    }
    return
  }
  Object.assign(form, {
    name: row.name,
    category: row.category,
    purpose: row.purpose,
    precondition: row.precondition,
    environment: row.environment,
    steps: JSON.parse(JSON.stringify(row.steps)),
    priority: row.priority,
    productIds: [...row.productIds],
    tags: [...row.tags],
    status: row.status,
    version: row.version,
    ownerId: row.ownerId,
    updatedAt: row.updatedAt,
    revisions: JSON.parse(JSON.stringify(row.revisions)),
  })
}

hydrate()

const addStep = () => {
  form.steps.push({ id: uid('S'), name: `步骤 ${form.steps.length + 1}`, action: '', expected: '', param: null })
}

const removeStep = (index: number) => {
  form.steps.splice(index, 1)
}

const moveStep = (index: number, offset: number) => {
  const target = index + offset
  if (target < 0 || target >= form.steps.length) return
  const [row] = form.steps.splice(index, 1)
  form.steps.splice(target, 0, row)
}

const toggleParam = (step: TestStep, enabled: boolean) => {
  step.param = enabled
    ? { name: '', unit: '', min: null, max: null, target: null, required: true }
    : null
}

const setParamValue = (step: TestStep, key: 'min' | 'max', value: number | undefined) => {
  if (!step.param) return
  step.param[key] = value === undefined || Number.isNaN(value) ? null : value
}

const ruleText = (param?: TestStep['param']) => {
  if (!param) return '无数值判定'
  const { min, max, unit } = param
  if (min !== null && min !== undefined && max !== null && max !== undefined) return `${min} ~ ${max} ${unit}`
  if (min !== null && min !== undefined) return `≥ ${min} ${unit}`
  if (max !== null && max !== undefined) return `≤ ${max} ${unit}`
  return '仅记录，不判定'
}

const validateSteps = (): boolean => {
  if (form.steps.length === 0) {
    ElMessage.warning('至少需要一个测试步骤')
    return false
  }
  for (const [index, step] of form.steps.entries()) {
    if (!step.name.trim() || !step.action.trim() || !step.expected.trim()) {
      ElMessage.warning(`第 ${index + 1} 步的名称、操作说明与预期结果都需要填写`)
      return false
    }
    if (step.param) {
      if (!step.param.name.trim() || !step.param.unit.trim()) {
        ElMessage.warning(`第 ${index + 1} 步的测量参数需要填写名称与单位`)
        return false
      }
      if (step.param.min !== null && step.param.max !== null && step.param.min !== undefined && step.param.max !== undefined && step.param.min > step.param.max) {
        ElMessage.warning(`第 ${index + 1} 步的测量下限不能大于上限`)
        return false
      }
    }
  }
  return true
}

const save = async (publish: boolean) => {
  if (!app.can('edit')) return
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  if (!validateSteps()) return

  if (publish) {
    try {
      await ElMessageBox.confirm('发布后版本号将递增，并写入版本历史。确认发布该用例？', '发布用例', {
        confirmButtonText: '发布',
        cancelButtonText: '取消',
      })
    } catch {
      return
    }
  }

  const payload = {
    name: form.name,
    category: form.category,
    purpose: form.purpose,
    precondition: form.precondition,
    environment: form.environment,
    steps: form.steps,
    priority: form.priority,
    productIds: form.productIds,
    tags: form.tags,
  }

  if (isNew.value) {
    const created = testCaseService.create(payload, publish ? 'published' : 'draft')
    ElMessage.success(`用例 ${created.code} 已创建`)
    router.replace(`/test-cases/${created.id}/edit`)
    return
  }

  if (!source.value) return
  testCaseService.update(source.value.id, payload, {
    publish,
    summary: publish ? '编辑并发布新版本' : '保存草稿',
  })
  ElMessage.success(publish ? '用例已发布' : '草稿已保存')
  const refreshed = db.cases.find((c) => c.id === source.value?.id)
  if (refreshed) {
    form.version = refreshed.version
    form.status = refreshed.status
    form.revisions = JSON.parse(JSON.stringify(refreshed.revisions))
    form.updatedAt = refreshed.updatedAt
  }
}
</script>

<style scoped>
.editor-page {
  padding-bottom: 40px;
}

.editor-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 14px;
  align-items: start;
}

.editor-main,
.editor-side {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 14px;
}

.steps {
  padding: 0 16px 16px;
}

.step-card {
  border: 1px solid var(--bf-border);
  border-radius: 6px;
  padding: 12px;
  margin-top: 12px;
  background: var(--bf-surface-2);
}

.step-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.step-index {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--bf-primary);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  flex: none;
}

.step-body {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.field-block {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.field-block > span {
  font-size: 10.5px;
  color: var(--bf-ink-3);
}

.param-box {
  margin-top: 9px;
  padding-top: 9px;
  border-top: 1px dashed var(--bf-border-strong);
}

.param-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.param-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--bf-ink-2);
}

.param-grid {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 8px;
  flex-wrap: wrap;
}

.param-grid > .el-input:first-child {
  flex: 1;
  min-width: 180px;
}

.param-preview {
  margin-top: 8px;
  font-size: 11.5px;
  color: var(--bf-ink-3);
}

.editor-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 4px 0 20px;
}

.side-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.measure-preview {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding-bottom: 7px;
  border-bottom: 1px dashed var(--bf-border);
}

.measure-preview strong {
  font-size: 12.3px;
  font-weight: 600;
}

.revisions {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.revision {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.rev-version {
  font-size: 11px;
  color: var(--bf-primary);
  background: var(--bf-primary-soft);
  border-radius: 3px;
  padding: 0 5px;
  flex: none;
}

.rev-main {
  font-size: 12px;
  min-width: 0;
}

.grow {
  flex: 1;
}

@media (max-width: 1180px) {
  .editor-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 760px) {
  .step-body,
  .form-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
