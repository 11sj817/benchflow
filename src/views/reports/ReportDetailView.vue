<template>
  <div v-if="report" class="bf-page report-page">
    <div class="bf-page-header bf-no-print">
      <div>
        <button class="back" type="button" @click="router.push('/reports')"><ArrowLeft :size="15" /> 报告中心</button>
        <h1>
          <span class="bf-table-code">{{ report.code }}</span>
          {{ report.title }}
          <StatusPill :label="reportStatus.get(report.status).label" :tone="reportStatus.get(report.status).tone" />
        </h1>
        <p class="sub">
          {{ reportType.get(report.type).label }} · {{ projectName(report.projectId) }} · 作者 {{ memberName(report.authorId) }} ·
          <span class="num">{{ fmtDate(report.createdAt) }}</span>
        </p>
      </div>
      <div class="bf-header-actions">
        <el-button size="small" @click="printReport"><Printer :size="14" /> 打印 / PDF</el-button>
        <el-button size="small" @click="exportCsv"><Download :size="14" /> 导出 CSV</el-button>
        <el-button v-if="canSubmit" size="small" @click="submit">提交审核</el-button>
        <el-button v-if="canReview" size="small" type="success" plain @click="reviewOpen = true">审核</el-button>
        <el-button v-if="canPublish" size="small" type="primary" @click="publish">发布报告</el-button>
      </div>
    </div>

    <div class="report-grid">
      <article class="print-area report-doc">
        <header class="doc-head">
          <div class="org">
            <div class="org-logo">BF</div>
            <div>
              <strong>{{ db.org.name }}</strong>
              <span>{{ db.org.code }} · {{ db.org.industry }}</span>
            </div>
          </div>
          <div class="doc-code">
            <span>报告编号</span>
            <b class="mono">{{ report.code }}</b>
          </div>
        </header>

        <h2 class="doc-title">{{ report.title }}</h2>

        <div class="doc-meta">
          <div><span>报告类型</span><b>{{ reportType.get(report.type).label }}</b></div>
          <div><span>项目</span><b>{{ projectName(report.projectId) }}</b></div>
          <div><span>产品</span><b>{{ report.productId ? productName(report.productId) : '—' }}</b></div>
          <div><span>关联计划 / 执行</span><b>{{ report.planId || report.executionId || '—' }}</b></div>
          <div><span>编制人</span><b>{{ memberName(report.authorId) }}</b></div>
          <div><span>审核人</span><b>{{ report.reviewerId ? memberName(report.reviewerId) : '待指定' }}</b></div>
          <div><span>编制日期</span><b>{{ fmtDate(report.createdAt) }}</b></div>
          <div><span>审核日期</span><b>{{ report.reviewedAt ? fmtDate(report.reviewedAt) : '—' }}</b></div>
        </div>

        <section class="doc-section">
          <h3>摘要</h3>
          <p>{{ report.summary }}</p>
        </section>

        <section class="doc-metrics">
          <div v-for="metric in report.metrics" :key="metric.label" class="doc-metric">
            <span>{{ metric.label }}</span>
            <b>{{ metric.value }}</b>
          </div>
        </section>

        <section v-for="(section, idx) in report.sections" :key="idx" class="doc-section">
          <h3>{{ section.title }}</h3>
          <p class="preserve">{{ section.body }}</p>
        </section>

        <footer class="doc-foot">
          <div>本报告由 BenchFlow 本地演示环境生成，数据来自演示项目 {{ db.org.code }}，不代表真实客户项目结论。</div>
          <div class="mono">{{ report.code }} · {{ fmtDateTime(new Date().toISOString()) }}</div>
        </footer>
      </article>

      <aside class="report-side bf-no-print">
        <section class="bf-panel">
          <header class="bf-panel-header"><h2>审核流程</h2></header>
          <div class="bf-panel-body">
            <el-steps direction="vertical" :active="statusStep" finish-status="success" style="height: 190px">
              <el-step title="创建草稿" :description="fmtDateTime(report.createdAt)" />
              <el-step title="提交审核" />
              <el-step title="审核决定" :description="report.reviewedAt ? fmtDateTime(report.reviewedAt) : '等待审核'" />
              <el-step title="发布归档" />
            </el-steps>
            <div class="bf-hint" :class="{ warn: report.status === 'review' }">
              <template v-if="report.status === 'draft'">草稿状态：确认内容后提交审核。</template>
              <template v-else-if="report.status === 'review'">等待审核。审核人不能是报告作者本人。</template>
              <template v-else-if="report.status === 'approved'">审核通过，可发布为正式报告。</template>
              <template v-else-if="report.status === 'rejected'">审核驳回，请修改后重新提交。</template>
              <template v-else>报告已发布，可在外部协作中分享给客户（只读）。</template>
            </div>
            <div class="audit-note">
              <strong>审核记录</strong>
              <p v-if="report.reviewedAt">{{ memberName(report.reviewerId ?? '') }} 于 {{ fmtDateTime(report.reviewedAt) }} 完成审核。</p>
              <p v-else>尚无审核记录。</p>
            </div>
          </div>
        </section>

        <section class="bf-panel">
          <header class="bf-panel-header"><h2>关联对象</h2></header>
          <div class="bf-panel-body links">
            <router-link :to="`/projects/${report.projectId}`" class="link-item">项目 {{ projectCode(report.projectId) }}</router-link>
            <router-link v-if="report.planId" :to="`/test-plans/${report.planId}`" class="link-item">测试计划 {{ report.planId }}</router-link>
            <router-link v-if="report.executionId" :to="`/test-executions/${report.executionId}`" class="link-item">执行 {{ report.executionId }}</router-link>
            <router-link v-if="report.productId" :to="`/products/${report.productId}`" class="link-item">产品 {{ productName(report.productId) }}</router-link>
            <span v-for="versionId in report.versionIds ?? []" :key="versionId" class="link-item">
              版本 {{ versionLabel(versionId) }}
            </span>
          </div>
        </section>

        <section class="bf-panel">
          <header class="bf-panel-header"><h2>分享</h2></header>
          <div class="bf-panel-body">
            <p class="bf-sub">如需向客户提供只读报告，请到「外部协作」创建带有效期的分享链接。</p>
            <el-button size="small" style="margin-top: 8px" @click="router.push('/collaboration')">前往外部协作</el-button>
          </div>
        </section>
      </aside>
    </div>

    <el-dialog v-model="reviewOpen" title="审核报告" width="520px">
      <el-form label-width="86px">
        <el-form-item label="审核结论">
          <el-radio-group v-model="reviewApproved">
            <el-radio :value="true">通过</el-radio>
            <el-radio :value="false">驳回</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="审核意见">
          <el-input v-model="reviewNote" type="textarea" :rows="3" placeholder="审核意见将记录在报告中" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reviewOpen = false">取消</el-button>
        <el-button type="primary" @click="submitReview">提交审核结果</el-button>
      </template>
    </el-dialog>
  </div>

  <div v-else class="bf-page">
    <EmptyState text="报告不存在或没有访问权限" hint="外部访客只能查看被分享的报告。">
      <el-button size="small" @click="router.push('/reports')">返回报告中心</el-button>
    </EmptyState>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Download, Printer } from 'lucide-vue-next'
import { db } from '@/services/db'
import { reportService } from '@/services/reportService'
import { useAppStore } from '@/stores/app'
import StatusPill from '@/components/common/StatusPill.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { fmtDate, fmtDateTime, reportStatus, reportType } from '@/utils/format'
import { downloadText, toCsv } from '@/utils/csv'

const route = useRoute()
const router = useRouter()
const app = useAppStore()

const report = computed(() => db.reports.find((r) => r.id === route.params.id))

const projectName = (id: string) => db.projects.find((p) => p.id === id)?.name ?? id
const projectCode = (id: string) => db.projects.find((p) => p.id === id)?.code ?? id
const productName = (id: string) => db.products.find((p) => p.id === id)?.name ?? id
const memberName = (id: string) => db.members.find((m) => m.id === id)?.name ?? id
const versionLabel = (id: string) => db.versions.find((v) => v.id === id)?.version ?? id

const statusStep = computed(() => {
  if (!report.value) return 0
  return ({ draft: 0, review: 1, approved: 2, rejected: 1, published: 3 })[report.value.status]
})

const canSubmit = computed(() => !!report.value && report.value.status === 'draft' && app.can('edit'))
const canReview = computed(() => !!report.value && report.value.status === 'review' && app.can('review') && report.value.authorId !== app.currentUser.id)
const canPublish = computed(() => !!report.value && report.value.status === 'approved' && app.can('review'))

const submit = () => {
  if (!report.value) return
  reportService.submit(report.value.id)
  ElMessage.success('报告已提交审核')
}

const reviewOpen = ref(false)
const reviewApproved = ref(true)
const reviewNote = ref('')

const submitReview = () => {
  if (!report.value) return
  try {
    reportService.review(report.value.id, reviewApproved.value, reviewNote.value)
    reviewOpen.value = false
    ElMessage.success(reviewApproved.value ? '报告审核通过' : '报告已驳回')
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message)
  }
}

const publish = async () => {
  if (!report.value) return
  try {
    await ElMessageBox.confirm('发布后报告将进入归档状态，可在外部协作中分享。确认发布？', '发布报告', {
      confirmButtonText: '发布',
      cancelButtonText: '取消',
    })
    reportService.publish(report.value.id)
    ElMessage.success('报告已发布')
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message)
  }
}

const printReport = () => window.print()

const exportCsv = () => {
  if (!report.value) return
  const rows: (string | number)[][] = [
    ['标题', report.value.title],
    ['类型', reportType.get(report.value.type).label],
    ['项目', projectName(report.value.projectId)],
    ['作者', memberName(report.value.authorId)],
    ['状态', reportStatus.get(report.value.status).label],
    ['摘要', report.value.summary],
    [],
    ['指标', '数值'],
    ...report.value.metrics.map((m) => [m.label, m.value]),
    [],
    ['章节', '内容'],
    ...report.value.sections.map((s) => [s.title, s.body]),
  ]
  downloadText(`${report.value.code}.csv`, toCsv(['项目', '内容'], rows.map((r) => (r.length ? r : ['', '']))))
  ElMessage.success('报告已导出 CSV')
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
}

.report-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 14px;
  align-items: start;
}

.report-doc {
  background: #fff;
  border: 1px solid var(--bf-border);
  border-radius: var(--bf-radius-lg);
  padding: 36px 42px 28px;
  min-width: 0;
}

.doc-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 2px solid var(--bf-primary);
  padding-bottom: 12px;
}

.org {
  display: flex;
  align-items: center;
  gap: 10px;
}

.org-logo {
  width: 34px;
  height: 34px;
  border-radius: 6px;
  background: var(--bf-primary);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.org div {
  display: flex;
  flex-direction: column;
}

.org strong {
  font-size: 14px;
}

.org span {
  font-size: 10.5px;
  color: var(--bf-ink-3);
}

.doc-code {
  text-align: right;
  display: flex;
  flex-direction: column;
}

.doc-code span {
  font-size: 10px;
  color: var(--bf-ink-3);
}

.doc-code b {
  font-size: 13px;
  color: var(--bf-primary);
}

.doc-title {
  font-size: 22px;
  font-weight: 650;
  text-align: center;
  margin: 28px 0 22px;
  letter-spacing: 0.01em;
}

.doc-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border: 1px solid var(--bf-border);
  border-radius: 4px;
  overflow: hidden;
}

.doc-meta > div {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 7px 11px;
  font-size: 11.8px;
  border-bottom: 1px solid var(--bf-border);
}

.doc-meta > div:nth-child(odd) {
  border-right: 1px solid var(--bf-border);
}

.doc-meta span {
  color: var(--bf-ink-3);
}

.doc-meta b {
  font-weight: 500;
  text-align: right;
}

.doc-section {
  margin-top: 22px;
}

.doc-section h3 {
  font-size: 13px;
  font-weight: 650;
  color: var(--bf-primary);
  margin-bottom: 8px;
  padding-left: 8px;
  border-left: 3px solid var(--bf-primary);
}

.doc-section p {
  font-size: 12.3px;
  line-height: 1.85;
  color: #2f3b4a;
}

.preserve {
  white-space: pre-wrap;
}

.doc-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-top: 20px;
}

.doc-metric {
  border: 1px solid var(--bf-border);
  border-radius: 4px;
  padding: 9px 11px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: var(--bf-surface-2);
}

.doc-metric span {
  font-size: 10.5px;
  color: var(--bf-ink-3);
}

.doc-metric b {
  font-size: 16px;
  font-weight: 620;
  font-variant-numeric: tabular-nums;
}

.doc-foot {
  margin-top: 30px;
  padding-top: 10px;
  border-top: 1px solid var(--bf-border);
  display: flex;
  justify-content: space-between;
  gap: 16px;
  font-size: 10px;
  color: var(--bf-ink-3);
  flex-wrap: wrap;
}

.report-side {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.audit-note {
  margin-top: 12px;
  font-size: 11.8px;
  color: var(--bf-ink-2);
}

.audit-note strong {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
}

.links {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.link-item {
  font-size: 12px;
  color: var(--bf-accent);
}

@media (max-width: 1180px) {
  .report-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .report-doc {
    padding: 22px 18px;
  }

  .doc-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media print {
  .report-page {
    padding: 0;
  }

  .report-grid {
    display: block;
  }

  .report-doc {
    border: none;
    padding: 0;
  }

  .doc-section {
    break-inside: avoid;
  }
}
</style>
