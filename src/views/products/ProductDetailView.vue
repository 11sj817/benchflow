<template>
  <div v-if="product" class="bf-page">
    <div class="bf-page-header">
      <div>
        <button class="back" type="button" @click="router.push('/products')"><ArrowLeft :size="15" /> 产品与版本</button>
        <h1>
          <span class="bf-table-code">{{ product.code }}</span>
          {{ product.name }}
        </h1>
        <p class="sub">
          {{ projectName(product.projectId) }} · {{ productTypeLabel(product.type) }} · 负责人 {{ memberName(product.ownerId) }}
        </p>
        <p class="desc">{{ product.description }}</p>
      </div>
      <div class="bf-header-actions">
        <el-button size="small" @click="tab = 'compare'"><GitCompare :size="14" /> 版本对比</el-button>
        <el-button v-if="app.can('create')" size="small" type="primary" @click="openVersionCreate">
          <Plus :size="14" /> 新建版本
        </el-button>
      </div>
    </div>

    <div class="bf-kpis">
      <KpiCard label="版本总数" :value="stats.versions" unit="个" :foot="`硬件 ${kindCount('hardware')} · 固件 ${kindCount('firmware')}`" />
      <KpiCard label="执行次数" :value="stats.runs" unit="次" :foot="`关联缺陷 ${productDefects.length} 个`" />
      <KpiCard
        label="执行通过率"
        :value="stats.passRate"
        unit="%"
        :tone="stats.passRate >= 85 ? 'success' : stats.passRate >= 60 ? undefined : 'warning'"
        foot="按产品全部有效执行统计"
      />
      <KpiCard label="未关闭缺陷" :value="stats.openDefects" unit="个" :tone="stats.openDefects > 0 ? 'warning' : 'success'" :foot="'跨版本累计'" />
    </div>

    <section class="bf-panel" style="margin-top: 14px">
      <el-tabs v-model="tab" class="product-tabs">
        <el-tab-pane label="版本列表" name="versions">
          <div class="tab-toolbar">
            <el-select v-model="kindFilter" placeholder="版本类型" clearable size="small" style="width: 140px">
              <el-option v-for="(row, key) in versionKind.map" :key="key" :label="row.label" :value="key" />
            </el-select>
            <span class="bf-sub">共 {{ filteredVersions.length }} 个版本</span>
          </div>
          <el-table :data="filteredVersions" size="small">
            <el-table-column label="版本号" width="150">
              <template #default="{ row }">
                <button class="version-link" type="button" @click="openVersionDrawer(row)">{{ row.version }}</button>
              </template>
            </el-table-column>
            <el-table-column prop="label" label="版本说明" min-width="220" />
            <el-table-column label="类型" width="100">
              <template #default="{ row }">
                <StatusPill :label="versionKind.get(row.kind).label" :tone="versionKind.get(row.kind).tone" />
              </template>
            </el-table-column>
            <el-table-column label="状态" width="90">
              <template #default="{ row }">
                <StatusPill :label="versionStatus.get(row.status).label" :tone="versionStatus.get(row.status).tone" />
              </template>
            </el-table-column>
            <el-table-column label="变更项" width="76" align="right">
              <template #default="{ row }">{{ row.changeItems.length }}</template>
            </el-table-column>
            <el-table-column label="关联测试" width="88" align="right">
              <template #default="{ row }">{{ runsOfVersion(row.id).length }}</template>
            </el-table-column>
            <el-table-column label="关联缺陷" width="88" align="right">
              <template #default="{ row }">{{ defectsOfVersion(row.id).length }}</template>
            </el-table-column>
            <el-table-column label="发布日期" width="106">
              <template #default="{ row }">{{ fmtDate(row.releasedAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="126" fixed="right">
              <template #default="{ row }">
                <el-button size="small" text @click="openVersionDrawer(row)">详情</el-button>
                <el-dropdown v-if="app.can('edit')" trigger="click" @command="(cmd: string) => setVersionStatus(row, cmd)">
                  <el-button size="small" text @click.stop>状态<ChevronDown :size="12" /></el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="released" :disabled="row.status === 'released'">发布</el-dropdown-item>
                      <el-dropdown-item command="deprecated" :disabled="row.status === 'deprecated'">废弃</el-dropdown-item>
                      <el-dropdown-item command="draft" :disabled="row.status === 'draft'">改回草稿</el-dropdown-item>
                      <el-dropdown-item command="delete" divided>删除版本</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="版本对比" name="compare">
          <div class="compare-select">
            <div class="cmp-field">
              <span>基线版本</span>
              <el-select v-model="leftId" size="small" filterable>
                <el-option v-for="version in productVersions" :key="version.id" :label="`${version.version} · ${version.label}`" :value="version.id" />
              </el-select>
            </div>
            <ArrowRight :size="16" class="arrow" />
            <div class="cmp-field">
              <span>对比版本</span>
              <el-select v-model="rightId" size="small" filterable>
                <el-option v-for="version in productVersions" :key="version.id" :label="`${version.version} · ${version.label}`" :value="version.id" />
              </el-select>
            </div>
            <el-button size="small" type="primary" :disabled="!compare" @click="generateCompareReport">生成对比报告</el-button>
          </div>

          <div v-if="compare" class="compare-result">
            <div class="cmp-summary">
              <span class="bf-chip">变更项 {{ compare.summary.changedItems }}</span>
              <span class="bf-chip success">测试改善 {{ compare.summary.improved }}</span>
              <span class="bf-chip danger">测试回退 {{ compare.summary.regressed }}</span>
            </div>

            <h4 class="block-title">物料 / 参数 / 固件 / 结构差异</h4>
            <el-table :data="compare.rows" size="small">
              <el-table-column prop="item" label="变更项" min-width="180" />
              <el-table-column label="分类" width="86">
                <template #default="{ row }">
                  <StatusPill :label="changeCategory.get(row.category).label" :tone="changeCategory.get(row.category).tone" />
                </template>
              </el-table-column>
              <el-table-column prop="left" label="基线版本" width="180" />
              <el-table-column prop="right" label="对比版本" width="180" />
              <el-table-column label="差异" width="80">
                <template #default="{ row }">
                  <span :class="row.changed ? 'changed' : 'muted'">{{ row.changed ? '已变更' : '一致' }}</span>
                </template>
              </el-table-column>
            </el-table>

            <div class="cmp-grid">
              <div>
                <h4 class="block-title">测试结果差异</h4>
                <el-table :data="compare.tests" size="small">
                  <el-table-column prop="caseId" label="用例" width="92">
                    <template #default="{ row }"><span class="mono">{{ row.caseId }}</span></template>
                  </el-table-column>
                  <el-table-column prop="caseName" label="名称" min-width="140" />
                  <el-table-column label="基线" width="88">
                    <template #default="{ row }">
                      <StatusPill :label="row.left" :tone="row.left === 'FAIL' ? 'danger' : row.left === 'PASS' ? 'success' : 'neutral'" />
                    </template>
                  </el-table-column>
                  <el-table-column label="对比" width="88">
                    <template #default="{ row }">
                      <StatusPill :label="row.right" :tone="row.right === 'FAIL' ? 'danger' : row.right === 'PASS' ? 'success' : 'neutral'" />
                    </template>
                  </el-table-column>
                </el-table>
                <EmptyState v-if="compare.tests.length === 0" text="两个版本暂无可对比的执行记录" />
              </div>
              <div>
                <h4 class="block-title">缺陷差异</h4>
                <el-table :data="compare.defects" size="small">
                  <el-table-column prop="code" label="缺陷" width="96">
                    <template #default="{ row }"><span class="mono">{{ row.code }}</span></template>
                  </el-table-column>
                  <el-table-column prop="title" label="标题" min-width="150" />
                  <el-table-column label="基线" width="66" align="center">
                    <template #default="{ row }">{{ row.left ? '有' : '—' }}</template>
                  </el-table-column>
                  <el-table-column label="对比" width="66" align="center">
                    <template #default="{ row }">{{ row.right ? '有' : '—' }}</template>
                  </el-table-column>
                </el-table>
                <EmptyState v-if="compare.defects.length === 0" text="两个版本都没有关联缺陷" />
              </div>
            </div>
          </div>
          <EmptyState v-else text="请选择两个版本进行对比" />
        </el-tab-pane>
      </el-tabs>
    </section>

    <el-drawer v-model="drawerOpen" :title="activeVersion ? `${activeVersion.version} · ${activeVersion.label}` : ''" size="560px">
      <template v-if="activeVersion">
        <div class="bf-row" style="gap: 8px; margin-bottom: 10px">
          <StatusPill :label="versionKind.get(activeVersion.kind).label" :tone="versionKind.get(activeVersion.kind).tone" />
          <StatusPill :label="versionStatus.get(activeVersion.status).label" :tone="versionStatus.get(activeVersion.status).tone" />
          <span class="bf-sub">发布 {{ fmtDate(activeVersion.releasedAt) }}</span>
        </div>
        <p class="paragraph">{{ activeVersion.notes }}</p>

        <h4 class="block-title">变更记录</h4>
        <el-table :data="activeVersion.changeItems" size="small">
          <el-table-column prop="item" label="变更项" min-width="140" />
          <el-table-column label="分类" width="80">
            <template #default="{ row }">
              <StatusPill :label="changeCategory.get(row.category).label" :tone="changeCategory.get(row.category).tone" />
            </template>
          </el-table-column>
          <el-table-column prop="from" label="原值" width="100" />
          <el-table-column prop="to" label="新值" width="100" />
        </el-table>
        <EmptyState v-if="activeVersion.changeItems.length === 0" text="没有变更记录" />

        <h4 class="block-title">附件</h4>
        <div class="attachments">
          <span v-for="name in activeVersion.attachmentNames" :key="name" class="bf-chip">{{ name }}</span>
          <span v-if="activeVersion.attachmentNames.length === 0" class="bf-sub">无附件</span>
        </div>

        <h4 class="block-title">关联测试与缺陷</h4>
        <div class="links">
          <router-link v-for="run in runsOfVersion(activeVersion.id)" :key="run.id" :to="`/test-executions/${run.id}`" class="link-item">
            {{ run.code }} · {{ run.result }}
          </router-link>
          <router-link v-for="defect in defectsOfVersion(activeVersion.id)" :key="defect.id" :to="`/defects/${defect.id}`" class="link-item danger">
            {{ defect.code }} · {{ defect.title }}
          </router-link>
          <span v-if="runsOfVersion(activeVersion.id).length === 0 && defectsOfVersion(activeVersion.id).length === 0" class="bf-sub">暂无关联记录</span>
        </div>
      </template>
    </el-drawer>

    <el-dialog v-model="versionDialog" title="新建产品版本" width="720px" destroy-on-close>
      <el-form :model="versionForm" label-width="92px">
        <div class="form-grid">
          <el-form-item label="版本类型">
            <el-select v-model="versionForm.kind" style="width: 100%">
              <el-option v-for="(row, key) in versionKind.map" :key="key" :label="row.label" :value="key" />
            </el-select>
          </el-form-item>
          <el-form-item label="版本号">
            <el-input v-model="versionForm.version" placeholder="例如 PCB V1.3 / FW V0.9" />
          </el-form-item>
          <el-form-item label="版本说明">
            <el-input v-model="versionForm.label" placeholder="一句话说明该版本" />
          </el-form-item>
          <el-form-item label="发布状态">
            <el-select v-model="versionForm.status" style="width: 100%">
              <el-option v-for="(row, key) in versionStatus.map" :key="key" :label="row.label" :value="key" />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item label="详细说明">
          <el-input v-model="versionForm.notes" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="附件名称">
          <el-select v-model="versionForm.attachmentNames" multiple filterable allow-create default-first-option style="width: 100%" placeholder="输入文件名后回车" />
        </el-form-item>

        <el-form-item label="变更项">
          <div class="changes">
            <div v-for="(change, index) in versionForm.changeItems" :key="index" class="change-row">
              <el-input v-model="change.item" size="small" placeholder="变更项" style="flex: 1" />
              <el-select v-model="change.category" size="small" style="width: 92px">
                <el-option v-for="(row, key) in changeCategory.map" :key="key" :label="row.label" :value="key" />
              </el-select>
              <el-input v-model="change.from" size="small" placeholder="原值" style="width: 110px" />
              <el-input v-model="change.to" size="small" placeholder="新值" style="width: 110px" />
              <el-button size="small" text type="danger" @click="versionForm.changeItems.splice(index, 1)"><Trash2 :size="14" /></el-button>
            </div>
            <el-button size="small" @click="addChange"><Plus :size="14" /> 添加变更项</el-button>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="versionDialog = false">取消</el-button>
        <el-button type="primary" @click="saveVersion">保存版本</el-button>
      </template>
    </el-dialog>
  </div>

  <div v-else class="bf-page">
    <EmptyState text="产品不存在" hint="请从产品列表重新进入。">
      <el-button size="small" @click="router.push('/products')">返回产品列表</el-button>
    </EmptyState>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, ArrowRight, ChevronDown, GitCompare, Plus, Trash2 } from 'lucide-vue-next'
import type { ChangeCategory, ProductType, VersionKind, VersionStatus } from '@/types'
import { db } from '@/services/db'
import { productService } from '@/services/productService'
import type { VersionInput } from '@/services/productService'
import { reportService } from '@/services/reportService'
import { useAppStore } from '@/stores/app'
import KpiCard from '@/components/common/KpiCard.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { changeCategory, fmtDate, versionKind, versionStatus } from '@/utils/format'

const route = useRoute()
const router = useRouter()
const app = useAppStore()

const product = computed(() => db.products.find((p) => p.id === route.params.id))
const tab = ref('versions')
const kindFilter = ref<VersionKind | ''>('')

const productVersions = computed(() => (product.value ? db.versions.filter((v) => v.productId === product.value!.id) : []))
const filteredVersions = computed(() =>
  kindFilter.value ? productVersions.value.filter((v) => v.kind === kindFilter.value) : productVersions.value,
)
const productDefects = computed(() => (product.value ? db.defects.filter((d) => d.productId === product.value!.id) : []))
const stats = computed(() => (product.value ? productService.stats(product.value.id) : { versions: 0, runs: 0, passRate: 0, openDefects: 0 }))

const kindCount = (kind: VersionKind) => productVersions.value.filter((v) => v.kind === kind).length
const projectName = (id: string) => db.projects.find((p) => p.id === id)?.name ?? id
const memberName = (id: string) => db.members.find((m) => m.id === id)?.name ?? id
const productTypeLabel = (type: ProductType) =>
  ({ dc_dc: 'DC-DC 电源', rectifier: '整流器', control_board: '控制板', sensor: '传感器', other: '其他' })[type]

const runsOfVersion = (versionId: string) =>
  db.executions.filter((e) => e.hardwareVersionId === versionId || e.firmwareVersionId === versionId)
const defectsOfVersion = (versionId: string) =>
  db.defects.filter((d) => d.hardwareVersionId === versionId || d.fixVersionId === versionId)

const drawerOpen = ref(false)
const activeVersion = computed(() => productVersions.value.find((v) => v.id === drawerVersionId.value))
const drawerVersionId = ref('')
const openVersionDrawer = (version: { id: string }) => {
  drawerVersionId.value = version.id
  drawerOpen.value = true
}

const leftId = ref('')
const rightId = ref('')
if (productVersions.value.length >= 2) {
  leftId.value = productVersions.value[productVersions.value.length - 2]?.id ?? ''
  rightId.value = productVersions.value[productVersions.value.length - 1]?.id ?? ''
}

const compare = computed(() => {
  if (!leftId.value || !rightId.value || leftId.value === rightId.value) return null
  return productService.compare(leftId.value, rightId.value)
})

const versionDialog = ref(false)
const versionForm = reactive({
  kind: 'hardware' as VersionKind,
  version: '',
  label: '',
  notes: '',
  status: 'draft' as VersionStatus,
  attachmentNames: [] as string[],
  changeItems: [] as { item: string; from: string; to: string; category: ChangeCategory; note?: string }[],
})

const openVersionCreate = () => {
  Object.assign(versionForm, {
    kind: 'hardware',
    version: '',
    label: '',
    notes: '',
    status: 'draft',
    attachmentNames: [],
    changeItems: [{ item: '', from: '', to: '', category: 'parameter' }],
  })
  versionDialog.value = true
}

const addChange = () => {
  versionForm.changeItems.push({ item: '', from: '', to: '', category: 'parameter' })
}

const saveVersion = () => {
  if (!product.value) return
  if (!versionForm.version.trim() || !versionForm.label.trim()) {
    ElMessage.warning('请填写版本号与版本说明')
    return
  }
  const changes = versionForm.changeItems.filter((c) => c.item.trim())
  const input: VersionInput = {
    productId: product.value.id,
    kind: versionForm.kind,
    version: versionForm.version.trim(),
    label: versionForm.label.trim(),
    notes: versionForm.notes,
    status: versionForm.status,
    attachmentNames: versionForm.attachmentNames,
    changeItems: changes,
  }
  productService.createVersion(input)
  ElMessage.success(`版本 ${input.version} 已创建`)
  versionDialog.value = false
}

const setVersionStatus = async (version: { id: string; code?: string; version: string }, command: string) => {
  if (command === 'delete') {
    try {
      await ElMessageBox.confirm(`删除版本 ${version.version}？被测试计划 / 执行 / 缺陷引用时不允许删除。`, '删除版本', {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
      })
      productService.removeVersion(version.id)
      ElMessage.success('版本已删除')
    } catch (error) {
      if (error instanceof Error) ElMessage.error(error.message)
    }
    return
  }
  productService.updateVersion(version.id, { status: command as VersionStatus })
  ElMessage.success('版本状态已更新')
}

const generateCompareReport = () => {
  if (!leftId.value || !rightId.value) return
  try {
    const report = reportService.generateVersionCompare(leftId.value, rightId.value)
    ElMessage.success(`对比报告 ${report.code} 已生成`)
    router.push(`/reports/${report.id}`)
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message)
  }
}
</script>

<style scoped>
.back {
  border: none;
  background: none;
  color: var(--bf-ink-3);
  font-size: 11.5px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 0;
  margin-bottom: 7px;
  font-family: inherit;
}

.back:hover {
  color: var(--bf-accent);
}

h1 {
  gap: 10px !important;
  flex-wrap: wrap;
  font-size: 20px !important;
}

.desc {
  color: var(--bf-ink-2);
  font-size: 12.5px;
  margin-top: 5px;
  max-width: 780px;
}

.product-tabs {
  padding: 4px 16px 16px;
}

.tab-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0 10px;
}

.version-link {
  border: none;
  background: none;
  padding: 0;
  color: var(--bf-primary);
  font-family: var(--bf-mono);
  font-size: 12px;
  cursor: pointer;
}

.version-link:hover {
  text-decoration: underline;
}

.compare-select {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  padding: 6px 0 14px;
  flex-wrap: wrap;
}

.cmp-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 240px;
}

.cmp-field span {
  font-size: 11px;
  color: var(--bf-ink-3);
}

.arrow {
  color: var(--bf-ink-3);
  margin-bottom: 6px;
}

.compare-result {
  border-top: 1px solid var(--bf-border);
  padding-top: 12px;
}

.cmp-summary {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.bf-chip.success {
  background: #e7f5ef;
  color: #12664c;
}

.bf-chip.danger {
  background: #fdecea;
  color: #a12319;
}

.block-title {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--bf-ink-2);
  margin: 16px 0 8px;
}

.cmp-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.changed {
  color: #a35a06;
  font-weight: 600;
  font-size: 11.5px;
}

.muted {
  color: var(--bf-ink-3);
  font-size: 11.5px;
}

.paragraph {
  font-size: 12.8px;
  color: var(--bf-ink-2);
  line-height: 1.7;
}

.attachments {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.links {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.link-item {
  font-size: 12px;
  color: var(--bf-accent);
}

.link-item.danger {
  color: var(--bf-danger);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 14px;
}

.changes {
  display: flex;
  flex-direction: column;
  gap: 7px;
  width: 100%;
}

.change-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

@media (max-width: 1000px) {
  .cmp-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 760px) {
  .form-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .cmp-field {
    min-width: 100%;
  }
}
</style>
