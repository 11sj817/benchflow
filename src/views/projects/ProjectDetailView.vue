<template>
  <div v-if="project" class="bf-page">
    <div class="detail-head">
      <button class="back" type="button" @click="router.push('/projects')"><ArrowLeft :size="15" /> 项目列表</button>
      <div class="title-row">
        <div class="title-main">
          <div class="code-line">
            <span class="bf-table-code mono">{{ project.code }}</span>
            <StatusPill :label="projectStatus.get(project.status).label" :tone="projectStatus.get(project.status).tone" />
            <StatusPill :label="priority.get(project.priority).label" :tone="priority.get(project.priority).tone" />
            <span v-for="tag in project.tags" :key="tag" class="bf-chip">{{ tag }}</span>
          </div>
          <h1>{{ project.name }}</h1>
          <p class="desc">{{ project.description }}</p>
        </div>
        <div class="bf-header-actions">
          <el-button size="small" @click="router.push(`/requirements?project=${project.id}`)">需求矩阵</el-button>
          <el-button v-if="app.can('create')" size="small" @click="router.push(`/test-plans?create=1&project=${project.id}`)">
            <Plus :size="14" /> 测试计划
          </el-button>
          <el-button v-if="app.can('edit')" size="small" type="primary" @click="openEdit"><Pencil :size="14" /> 编辑项目</el-button>
        </div>
      </div>

      <div class="head-meta">
        <div class="meta-item">
          <span class="label">负责人</span>
          <span class="value bf-row">
            <UserAvatar :name="memberName(project.ownerId)" :color="memberColor(project.ownerId)" size="sm" />
            {{ memberName(project.ownerId) }}
          </span>
        </div>
        <div class="meta-item">
          <span class="label">成员</span>
          <span class="value bf-avatar-stack">
            <UserAvatar
              v-for="member in members"
              :key="member.id"
              :name="member.name"
              :color="member.color"
              size="sm"
            />
            <span class="member-count">{{ members.length }} 人</span>
          </span>
        </div>
        <div class="meta-item">
          <span class="label">周期</span>
          <span class="value num">{{ fmtDate(project.startDate) }} → {{ fmtDate(project.plannedEndDate) }}</span>
        </div>
        <div class="meta-item">
          <span class="label">关联产品</span>
          <span class="value">{{ products.map((p) => p.name).join('、') || '未关联' }}</span>
        </div>
        <div class="meta-item">
          <span class="label">项目进度</span>
          <span class="value progress-value">
            <el-progress :percentage="stats.progress" :stroke-width="7" :show-text="false" style="width: 130px" />
            <b class="num">{{ stats.progress }}%</b>
          </span>
        </div>
      </div>
    </div>

    <div class="bf-kpis detail-kpis">
      <KpiCard label="测试覆盖率" :value="coverage.rate" unit="%" :foot="`${coverage.covered} / ${coverage.total} 条需求已关联用例`" />
      <KpiCard
        label="执行通过率"
        :value="stats.passRate"
        unit="%"
        :tone="stats.passRate >= 85 ? 'success' : stats.passRate >= 60 ? undefined : 'warning'"
        :foot="`${stats.runCount} 次执行 · ${stats.planCount} 个计划`"
      />
      <KpiCard
        label="未关闭缺陷"
        :value="stats.openDefects"
        unit="个"
        :tone="stats.openDefects > 0 ? 'warning' : 'success'"
        :foot="`缺陷总数 ${defects.length} 个`"
      />
      <KpiCard label="用例覆盖" :value="stats.caseCount" unit="条" :foot="`产品版本 ${versionCount} 个`" />
    </div>

    <section class="bf-panel">
      <el-tabs v-model="tab" class="detail-tabs">
        <el-tab-pane label="概览" name="overview">
          <div class="overview">
            <div class="ov-left">
              <h3 class="block-title">关键指标</h3>
              <div class="metric-grid">
                <div class="metric">
                  <span class="m-label">需求总数</span>
                  <strong class="num">{{ coverage.total }}</strong>
                  <span class="bf-sub">已验证 {{ coverage.verified }} 条</span>
                </div>
                <div class="metric">
                  <span class="m-label">执行次数</span>
                  <strong class="num">{{ stats.runCount }}</strong>
                  <span class="bf-sub">FAIL {{ runs.filter((r) => r.result === 'FAIL').length }} 次</span>
                </div>
                <div class="metric">
                  <span class="m-label">未关闭缺陷</span>
                  <strong class="num">{{ stats.openDefects }}</strong>
                  <span class="bf-sub">严重 {{ criticalCount }} 个</span>
                </div>
                <div class="metric">
                  <span class="m-label">数据集</span>
                  <strong class="num">{{ datasets.length }}</strong>
                  <span class="bf-sub">关联执行附件</span>
                </div>
              </div>

              <h3 class="block-title">最近执行</h3>
              <el-table :data="runs.slice(0, 6)" size="small" @row-click="(row: Execution) => router.push(`/test-executions/${row.id}`)">
                <el-table-column prop="code" label="执行" width="92">
                  <template #default="{ row }"><span class="bf-table-code">{{ row.code }}</span></template>
                </el-table-column>
                <el-table-column label="用例" min-width="170">
                  <template #default="{ row }">{{ caseName(row.caseId) }}</template>
                </el-table-column>
                <el-table-column label="版本" width="100">
                  <template #default="{ row }">{{ versionLabel(row.hardwareVersionId) }}</template>
                </el-table-column>
                <el-table-column label="执行人" width="80">
                  <template #default="{ row }">{{ memberName(row.testerId) }}</template>
                </el-table-column>
                <el-table-column label="结果" width="88">
                  <template #default="{ row }">
                    <StatusPill :label="runResult.get(row.result).label" :tone="runResult.get(row.result).tone" dot />
                  </template>
                </el-table-column>
                <el-table-column label="时间" width="100">
                  <template #default="{ row }"><span class="bf-sub">{{ fmtDate(row.startedAt) }}</span></template>
                </el-table-column>
              </el-table>

              <h3 class="block-title">重要时间节点</h3>
              <div class="milestones">
                <div class="milestone">
                  <span class="dot" />
                  <div><strong>项目启动</strong><span class="bf-sub">{{ fmtDate(project.startDate) }}</span></div>
                </div>
                <div class="milestone">
                  <span class="dot" :class="{ warn: isOverdue }" />
                  <div>
                    <strong>计划结束</strong>
                    <span class="bf-sub">{{ fmtDate(project.plannedEndDate) }}{{ isOverdue ? '（已延期）' : '' }}</span>
                  </div>
                </div>
                <div class="milestone">
                  <span class="dot" :class="{ ok: project.status === 'completed' }" />
                  <div><strong>实际结束</strong><span class="bf-sub">{{ project.actualEndDate ? fmtDate(project.actualEndDate) : '尚未结束' }}</span></div>
                </div>
              </div>
            </div>

            <aside class="ov-right">
              <h3 class="block-title">项目风险</h3>
              <div class="risks">
                <div v-for="(risk, idx) in risks" :key="idx" class="risk" :class="risk.level">
                  <AlertTriangle :size="14" />
                  <span>{{ risk.text }}</span>
                </div>
              </div>
              <h3 class="block-title">负责人视图</h3>
              <div class="owner-box">
                <UserAvatar :name="memberName(project.ownerId)" :color="memberColor(project.ownerId)" size="lg" />
                <div>
                  <strong>{{ memberName(project.ownerId) }}</strong>
                  <div class="bf-sub">{{ memberTitle(project.ownerId) }}</div>
                </div>
              </div>
              <div class="bf-hint">
                项目数据来自本地演示库。真实部署后，项目进度与风险将基于后端聚合的任务、执行与缺陷数据计算。
              </div>
            </aside>
          </div>
        </el-tab-pane>

        <el-tab-pane :label="`需求（${requirements.length}）`" name="requirements">
          <div class="tab-toolbar">
            <span class="bf-sub">需求到测试用例双向追踪 · 覆盖率 {{ coverage.rate }}%</span>
            <el-button v-if="app.can('create')" size="small" @click="router.push(`/requirements?create=1&project=${project.id}`)">新建需求</el-button>
          </div>
          <el-table :data="requirements" size="small">
            <el-table-column prop="code" label="编号" width="120">
              <template #default="{ row }"><span class="bf-table-code">{{ row.code }}</span></template>
            </el-table-column>
            <el-table-column prop="name" label="需求名称" min-width="200" />
            <el-table-column label="优先级" width="86">
              <template #default="{ row }"><StatusPill :label="priority.get(row.priority).label" :tone="priority.get(row.priority).tone" /></template>
            </el-table-column>
            <el-table-column label="状态" width="92">
              <template #default="{ row }">
                <StatusPill :label="requirementStatus.get(row.status).label" :tone="requirementStatus.get(row.status).tone" />
              </template>
            </el-table-column>
            <el-table-column label="关联用例" width="100">
              <template #default="{ row }">
                <span class="mono">{{ row.caseIds.length }}</span> 条
              </template>
            </el-table-column>
            <el-table-column label="关联缺陷" width="100">
              <template #default="{ row }">{{ row.defectIds.join('、') || '—' }}</template>
            </el-table-column>
            <el-table-column label="负责人" width="90">
              <template #default="{ row }">{{ memberName(row.ownerId) }}</template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane :label="`产品与版本（${products.length}）`" name="products">
          <div v-for="product in products" :key="product.id" class="product-block">
            <div class="product-head">
              <div>
                <router-link :to="`/products/${product.id}`" class="product-name">{{ product.name }}</router-link>
                <span class="bf-sub">{{ product.code }} · {{ product.description }}</span>
              </div>
              <el-button size="small" @click="router.push(`/products/${product.id}`)">版本与对比</el-button>
            </div>
            <el-table :data="versionsOf(product.id)" size="small">
              <el-table-column label="版本" width="150">
                <template #default="{ row }"><span class="bf-table-code">{{ row.version }}</span></template>
              </el-table-column>
              <el-table-column prop="label" label="说明" min-width="180" />
              <el-table-column label="类型" width="100">
                <template #default="{ row }">{{ versionKind.get(row.kind).label }}</template>
              </el-table-column>
              <el-table-column label="状态" width="90">
                <template #default="{ row }">
                  <StatusPill :label="versionStatus.get(row.status).label" :tone="versionStatus.get(row.status).tone" />
                </template>
              </el-table-column>
              <el-table-column label="变更项" width="80" align="right">
                <template #default="{ row }">{{ row.changeItems.length }}</template>
              </el-table-column>
              <el-table-column label="发布日期" width="104">
                <template #default="{ row }">{{ fmtDate(row.releasedAt) }}</template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>

        <el-tab-pane :label="`测试计划（${plans.length}）`" name="plans">
          <div class="tab-toolbar">
            <span class="bf-sub">计划绑定产品 / 硬件版本 / 固件版本与用例集合</span>
            <el-button v-if="app.can('create')" size="small" @click="router.push(`/test-plans?create=1&project=${project.id}`)">新建计划</el-button>
          </div>
          <el-table :data="plans" size="small" @row-click="(row: TestPlan) => router.push(`/test-plans/${row.id}`)">
            <el-table-column prop="code" label="编号" width="120">
              <template #default="{ row }"><span class="bf-table-code">{{ row.code }}</span></template>
            </el-table-column>
            <el-table-column prop="name" label="计划名称" min-width="200" />
            <el-table-column label="硬件 / 固件" width="150">
              <template #default="{ row }">{{ versionLabel(row.hardwareVersionId) }} / {{ versionLabel(row.firmwareVersionId) }}</template>
            </el-table-column>
            <el-table-column label="用例" width="70" align="right">
              <template #default="{ row }">{{ row.caseIds.length }}</template>
            </el-table-column>
            <el-table-column label="状态" width="90">
              <template #default="{ row }">
                <StatusPill :label="planStatus.get(row.status).label" :tone="planStatus.get(row.status).tone" />
              </template>
            </el-table-column>
            <el-table-column label="执行进度" width="150">
              <template #default="{ row }">
                <el-progress
                  :percentage="planProgress(row.id).rate"
                  :stroke-width="6"
                  :show-text="false"
                  :status="planProgress(row.id).fail > 0 ? 'exception' : undefined"
                />
                <span class="bf-sub">{{ planProgress(row.id).executedCases }}/{{ planProgress(row.id).totalCases }} 用例</span>
              </template>
            </el-table-column>
            <el-table-column label="周期" width="180">
              <template #default="{ row }"><span class="bf-sub">{{ fmtDate(row.startDate) }} → {{ fmtDate(row.endDate) }}</span></template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane :label="`测试执行（${runs.length}）`" name="runs">
          <div class="tab-toolbar">
            <span class="bf-sub">每条执行绑定版本、设备、工况与测量数据</span>
            <el-button size="small" @click="router.push(`/test-executions?project=${project.id}`)">打开执行中心</el-button>
          </div>
          <el-table :data="runs" size="small" @row-click="(row: Execution) => router.push(`/test-executions/${row.id}`)">
            <el-table-column prop="code" label="执行" width="94">
              <template #default="{ row }"><span class="bf-table-code">{{ row.code }}</span></template>
            </el-table-column>
            <el-table-column label="用例" min-width="170">
              <template #default="{ row }">{{ caseName(row.caseId) }}</template>
            </el-table-column>
            <el-table-column label="版本" width="96">
              <template #default="{ row }">{{ versionLabel(row.hardwareVersionId) }}</template>
            </el-table-column>
            <el-table-column label="执行人" width="80">
              <template #default="{ row }">{{ memberName(row.testerId) }}</template>
            </el-table-column>
            <el-table-column label="工况" min-width="150" show-overflow-tooltip>
              <template #default="{ row }"><span class="bf-sub">{{ row.conditions }}</span></template>
            </el-table-column>
            <el-table-column label="结果" width="90">
              <template #default="{ row }"><StatusPill :label="runResult.get(row.result).label" :tone="runResult.get(row.result).tone" dot /></template>
            </el-table-column>
            <el-table-column label="缺陷" width="100">
              <template #default="{ row }">{{ row.defectIds.join('、') || '—' }}</template>
            </el-table-column>
            <el-table-column label="时间" width="100">
              <template #default="{ row }"><span class="bf-sub">{{ fmtDate(row.startedAt) }}</span></template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane :label="`缺陷（${defects.length}）`" name="defects">
          <div class="tab-toolbar">
            <span class="bf-sub">未关闭 {{ stats.openDefects }} 个</span>
            <el-button v-if="app.can('create')" size="small" @click="router.push(`/defects?create=1&project=${project.id}`)">新建缺陷</el-button>
          </div>
          <el-table :data="defects" size="small" @row-click="(row: Defect) => router.push(`/defects/${row.id}`)">
            <el-table-column prop="code" label="编号" width="100">
              <template #default="{ row }"><span class="bf-table-code">{{ row.code }}</span></template>
            </el-table-column>
            <el-table-column prop="title" label="缺陷标题" min-width="230" />
            <el-table-column label="严重程度" width="88">
              <template #default="{ row }"><StatusPill :label="severity.get(row.severity).label" :tone="severity.get(row.severity).tone" /></template>
            </el-table-column>
            <el-table-column label="状态" width="90">
              <template #default="{ row }"><StatusPill :label="defectStatus.get(row.status).label" :tone="defectStatus.get(row.status).tone" /></template>
            </el-table-column>
            <el-table-column label="负责人" width="90">
              <template #default="{ row }">{{ memberName(row.ownerId) }}</template>
            </el-table-column>
            <el-table-column label="发现时间" width="104">
              <template #default="{ row }">{{ fmtDate(row.foundAt) }}</template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane :label="`文件（${datasets.length}）`" name="files">
          <div class="tab-toolbar">
            <span class="bf-sub">项目数据集与原始记录（单文件 ≤ 2MB，本地演示）</span>
            <el-button size="small" @click="router.push('/datasets')">数据集管理</el-button>
          </div>
          <el-table :data="datasets" size="small">
            <el-table-column prop="name" label="文件名" min-width="220" />
            <el-table-column label="类型" width="80">
              <template #default="{ row }">{{ fileKind.get(row.kind).label }}</template>
            </el-table-column>
            <el-table-column label="分类" width="100">
              <template #default="{ row }">{{ datasetCategory.get(row.category).label }}</template>
            </el-table-column>
            <el-table-column label="大小" width="90" align="right">
              <template #default="{ row }">{{ fmtBytes(row.sizeBytes) }}</template>
            </el-table-column>
            <el-table-column label="关联执行" width="100">
              <template #default="{ row }">{{ row.executionId || '—' }}</template>
            </el-table-column>
            <el-table-column label="上传" width="150">
              <template #default="{ row }">{{ memberName(row.uploadedBy) }} · {{ fromNow(row.uploadedAt) }}</template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane :label="`团队（${members.length}）`" name="team">
          <div class="member-grid">
            <div v-for="member in members" :key="member.id" class="member-card">
              <UserAvatar :name="member.name" :color="member.color" size="lg" />
              <div class="m-info">
                <strong>{{ member.name }}</strong>
                <span class="bf-sub">{{ member.title }} · {{ member.email }}</span>
              </div>
              <StatusPill :label="roleLabel(member.role).label" :tone="roleLabel(member.role).tone" />
            </div>
          </div>
          <div class="bf-hint">成员由组织管理员在「团队与权限」中分配。前端仅做可见性演示，真实授权需后端校验。</div>
        </el-tab-pane>

        <el-tab-pane :label="`操作记录（${activities.length}）`" name="activity">
          <div class="activity-list">
            <div v-for="log in activities" :key="log.id" class="activity">
              <UserAvatar :name="log.actorName" size="sm" :color="memberColor(log.actorId)" />
              <div class="a-main">
                <div><b>{{ log.actorName }}</b> {{ log.summary }}</div>
                <div class="bf-sub">{{ log.entityLabel }} · {{ fmtDateTime(log.at) }}</div>
              </div>
              <StatusPill :label="auditAction.get(log.action).label" :tone="auditAction.get(log.action).tone" />
            </div>
            <EmptyState v-if="activities.length === 0" text="暂无项目操作记录" />
          </div>
        </el-tab-pane>
      </el-tabs>
    </section>

    <el-dialog v-model="editOpen" title="编辑项目" width="620px">
      <el-form :model="editForm" label-width="92px">
        <el-form-item label="项目名称"><el-input v-model="editForm.name" maxlength="60" /></el-form-item>
        <el-form-item label="项目描述"><el-input v-model="editForm.description" type="textarea" :rows="3" maxlength="300" /></el-form-item>
        <div class="form-grid">
          <el-form-item label="状态">
            <el-select v-model="editForm.status" style="width: 100%">
              <el-option v-for="(row, key) in projectStatus.map" :key="key" :label="row.label" :value="key" />
            </el-select>
          </el-form-item>
          <el-form-item label="优先级">
            <el-select v-model="editForm.priority" style="width: 100%">
              <el-option v-for="(row, key) in priority.map" :key="key" :label="row.label" :value="key" />
            </el-select>
          </el-form-item>
          <el-form-item label="负责人">
            <el-select v-model="editForm.ownerId" style="width: 100%">
              <el-option v-for="member in db.members" :key="member.id" :label="member.name" :value="member.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="计划结束">
            <el-date-picker v-model="editForm.plannedEndDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="editOpen = false">取消</el-button>
        <el-button type="primary" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>

  <div v-else class="bf-page">
    <EmptyState text="项目不存在或已被删除" hint="请从项目列表重新进入。">
      <el-button size="small" @click="router.push('/projects')">返回项目列表</el-button>
    </EmptyState>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { AlertTriangle, ArrowLeft, Pencil, Plus } from 'lucide-vue-next'
import type { Defect, Execution, Member, Priority, ProjectStatus, TestPlan } from '@/types'
import { db } from '@/services/db'
import { projectService, requirementService } from '@/services/projectService'
import type { ProjectStats } from '@/services/projectService'
import { testPlanService } from '@/services/testService'
import { useAppStore } from '@/stores/app'
import KpiCard from '@/components/common/KpiCard.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import {
  auditAction,
  datasetCategory,
  defectStatus,
  fileKind,
  fmtBytes,
  fmtDate,
  fmtDateTime,
  fromNow,
  planStatus,
  priority,
  projectStatus,
  requirementStatus,
  roleLabel,
  runResult,
  severity,
  versionKind,
  versionStatus,
} from '@/utils/format'

const route = useRoute()
const router = useRouter()
const app = useAppStore()

const project = computed(() => db.projects.find((p) => p.id === route.params.id))
const tab = ref('overview')

const stats = computed<ProjectStats>(() =>
  project.value
    ? projectService.stats(project.value.id)
    : {
        planCount: 0,
        runCount: 0,
        passRate: 0,
        openDefects: 0,
        caseCount: 0,
        requirementCount: 0,
        coveredRequirements: 0,
        progress: 0,
      },
)
const coverage = computed(() =>
  project.value
    ? requirementService.coverage(project.value.id)
    : { total: 0, covered: 0, verified: 0, uncovered: 0, rate: 0 },
)
const risks = computed(() => (project.value ? projectService.risks(project.value.id) : []))

const requirements = computed(() => (project.value ? db.requirements.filter((r) => r.projectId === project.value!.id) : []))
const products = computed(() => (project.value ? db.products.filter((p) => p.projectId === project.value!.id) : []))
const plans = computed(() => (project.value ? db.plans.filter((p) => p.projectId === project.value!.id) : []))
const runs = computed(() =>
  project.value
    ? db.executions.filter((e) => e.projectId === project.value!.id).slice().sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
    : [],
)
const defects = computed(() => (project.value ? db.defects.filter((d) => d.projectId === project.value!.id) : []))
const datasets = computed(() => (project.value ? db.datasets.filter((d) => d.projectId === project.value!.id) : []))
const members = computed(() =>
  project.value
    ? (project.value.memberIds
        .map((id) => db.members.find((m) => m.id === id))
        .filter((m): m is Member => Boolean(m)))
    : [],
)
const activities = computed(() => db.audits.filter((a) => a.projectId === project.value?.id).slice(0, 30))
const versionCount = computed(() => products.value.reduce((sum, p) => sum + db.versions.filter((v) => v.productId === p.id).length, 0))
const criticalCount = computed(() => defects.value.filter((d) => d.severity === 'critical' || d.severity === 'blocker').length)
const isOverdue = computed(() => {
  if (!project.value) return false
  return project.value.plannedEndDate < new Date().toISOString().slice(0, 10) && project.value.status !== 'completed'
})

const memberName = (id?: string) => db.members.find((m) => m.id === id)?.name ?? id ?? '—'
const memberTitle = (id: string) => db.members.find((m) => m.id === id)?.title ?? ''
const memberColor = (id: string) => db.members.find((m) => m.id === id)?.color ?? '#6b7a8f'
const caseName = (id: string) => db.cases.find((c) => c.id === id)?.name ?? id
const versionLabel = (id?: string) => (id ? db.versions.find((v) => v.id === id)?.version ?? id : '—')
const versionsOf = (productId: string) => db.versions.filter((v) => v.productId === productId)
const planProgress = (planId: string) => testPlanService.progress(planId)

const editOpen = ref(false)
const editForm = reactive({
  name: '',
  description: '',
  status: 'active' as ProjectStatus,
  priority: 'P1' as Priority,
  ownerId: '',
  plannedEndDate: '',
})

const openEdit = () => {
  if (!project.value) return
  Object.assign(editForm, {
    name: project.value.name,
    description: project.value.description,
    status: project.value.status,
    priority: project.value.priority,
    ownerId: project.value.ownerId,
    plannedEndDate: project.value.plannedEndDate,
  })
  editOpen.value = true
}

const saveEdit = () => {
  if (!project.value) return
  projectService.update(project.value.id, { ...editForm })
  editOpen.value = false
  ElMessage.success('项目信息已保存')
}
</script>

<style scoped>
.detail-head {
  background: var(--bf-surface);
  border: 1px solid var(--bf-border);
  border-radius: var(--bf-radius-lg);
  padding: 14px 18px 16px;
  margin-bottom: 14px;
}

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
  margin-bottom: 8px;
  font-family: inherit;
}

.back:hover {
  color: var(--bf-accent);
}

.title-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  flex-wrap: wrap;
}

.title-main {
  min-width: 0;
}

.code-line {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.title-main h1 {
  font-size: 21px;
  font-weight: 650;
  letter-spacing: -0.015em;
  margin-top: 6px;
}

.desc {
  color: var(--bf-ink-2);
  font-size: 12.5px;
  margin-top: 5px;
  max-width: 760px;
  line-height: 1.6;
}

.head-meta {
  display: flex;
  gap: 26px;
  flex-wrap: wrap;
  margin-top: 16px;
  padding-top: 13px;
  border-top: 1px dashed var(--bf-border);
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.meta-item .label {
  font-size: 10.5px;
  color: var(--bf-ink-3);
}

.meta-item .value {
  font-size: 12.3px;
  color: var(--bf-ink);
  display: flex;
  align-items: center;
  gap: 5px;
}

.member-count {
  font-size: 11.5px;
  color: var(--bf-ink-3);
  margin-left: 6px;
}

.progress-value {
  gap: 8px !important;
}

.detail-kpis {
  margin-bottom: 14px;
}

.detail-tabs {
  padding: 4px 16px 16px;
}

.overview {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(280px, 0.8fr);
  gap: 20px;
  padding-top: 6px;
}

.block-title {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--bf-ink-2);
  margin: 14px 0 8px;
}

.block-title:first-child {
  margin-top: 2px;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.metric {
  border: 1px solid var(--bf-border);
  border-radius: 6px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: var(--bf-surface-2);
}

.m-label {
  font-size: 11px;
  color: var(--bf-ink-3);
}

.metric strong {
  font-size: 20px;
  font-weight: 620;
  line-height: 1.2;
}

.milestones {
  display: flex;
  gap: 26px;
  flex-wrap: wrap;
}

.milestone {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.milestone .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--bf-border-strong);
  margin-top: 5px;
}

.milestone .dot.warn {
  background: #c07a1a;
}

.milestone .dot.ok {
  background: #157a5b;
}

.milestone div {
  display: flex;
  flex-direction: column;
}

.milestone strong {
  font-size: 12.3px;
}

.risks {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.risk {
  display: flex;
  gap: 7px;
  align-items: flex-start;
  font-size: 12px;
  line-height: 1.5;
  padding: 8px 10px;
  border-radius: 5px;
  border: 1px solid var(--bf-border);
  background: var(--bf-surface-2);
  color: var(--bf-ink-2);
}

.risk.high {
  background: #fdf1f0;
  border-color: #f2d5d1;
  color: #8f241b;
}

.risk.medium {
  background: #fdf6ea;
  border-color: #f0dfc0;
  color: #80510a;
}

.owner-box {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--bf-border);
  border-radius: 6px;
  margin-bottom: 12px;
}

.product-block {
  border: 1px solid var(--bf-border);
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 12px;
}

.product-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.product-head > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.product-name {
  font-size: 13px;
  font-weight: 600;
}

.tab-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 8px 0 10px;
  flex-wrap: wrap;
}

.member-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.member-card {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--bf-border);
  border-radius: 6px;
  padding: 10px 12px;
}

.m-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.activity-list {
  display: flex;
  flex-direction: column;
}

.activity {
  display: flex;
  gap: 9px;
  align-items: flex-start;
  padding: 9px 0;
  border-bottom: 1px solid var(--bf-border);
}

.a-main {
  flex: 1;
  font-size: 12.3px;
  min-width: 0;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 14px;
}

@media (max-width: 1180px) {
  .overview {
    grid-template-columns: minmax(0, 1fr);
  }

  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .member-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 720px) {
  .head-meta {
    gap: 16px;
  }

  .form-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
