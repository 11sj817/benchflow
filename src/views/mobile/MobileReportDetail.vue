<template>
  <div v-if="report" class="m-detail">
    <button type="button" class="back" @click="router.push('/mobile/messages')"><ArrowLeft :size="16" /> 消息与审核</button>

    <header class="m-hero">
      <div class="code-row">
        <span class="mono">{{ report.code }}</span>
        <StatusPill :label="reportStatus.get(report.status).label" :tone="reportStatus.get(report.status).tone" />
      </div>
      <h1>{{ report.title }}</h1>
      <p>{{ projectName(report.projectId) }} · {{ reportType.get(report.type).label }}</p>
      <div class="meta">
        <span>{{ memberName(report.authorId) }}</span>
        <span>{{ fmtDate(report.createdAt) }}</span>
      </div>
    </header>

    <section class="m-card">
      <header class="m-card-head"><h2>摘要</h2></header>
      <p class="text">{{ report.summary }}</p>
      <div class="metrics">
        <div v-for="metric in report.metrics" :key="metric.label">
          <span>{{ metric.label }}</span>
          <b>{{ metric.value }}</b>
        </div>
      </div>
    </section>

    <section v-for="(section, index) in report.sections" :key="index" class="m-card">
      <header class="m-card-head"><h2>{{ section.title }}</h2></header>
      <p class="text preserve">{{ section.body }}</p>
    </section>

    <div v-if="canReview" class="sticky-actions">
      <button type="button" class="ghost" @click="review(false)">驳回</button>
      <button type="button" class="primary" @click="review(true)">审核通过</button>
    </div>
  </div>

  <div v-else class="m-detail">
    <EmptyState text="报告不存在或没有访问权限">
      <el-button size="small" @click="router.push('/mobile/messages')">返回消息</el-button>
    </EmptyState>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft } from 'lucide-vue-next'
import { db } from '@/services/db'
import { reportService } from '@/services/reportService'
import { useAppStore } from '@/stores/app'
import StatusPill from '@/components/common/StatusPill.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { fmtDate, reportStatus, reportType } from '@/utils/format'

const route = useRoute()
const router = useRouter()
const app = useAppStore()

const report = computed(() => db.reports.find((row) => row.id === route.params.id))
const canReview = computed(
  () => !!report.value && report.value.status === 'review' && app.can('review') && report.value.authorId !== app.currentUser.id,
)

const memberName = (id: string) => db.members.find((member) => member.id === id)?.name ?? id
const projectName = (id: string) => db.projects.find((project) => project.id === id)?.name ?? id

const review = async (approved: boolean) => {
  if (!report.value) return
  try {
    const { value } = await ElMessageBox.prompt(approved ? '审核意见（可选）' : '请填写驳回原因', approved ? '审核通过' : '驳回报告', {
      inputPlaceholder: approved ? '同意发布' : '需要补充的章节或数据',
    })
    reportService.review(report.value.id, approved, value ?? '')
    ElMessage.success(approved ? '报告已通过审核' : '报告已驳回')
    router.push('/mobile/messages')
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message)
  }
}
</script>

<style scoped>
.m-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 140px;
}

.back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: transparent;
  color: var(--bf-ink-3);
  font-family: inherit;
  font-size: 11.5px;
  padding: 0;
  min-height: 32px;
  align-self: flex-start;
}

.m-hero {
  background: #fff;
  border: 1px solid var(--bf-border);
  border-radius: 8px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.code-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.code-row .mono {
  font-size: 10.5px;
  color: var(--bf-primary);
}

.m-hero h1 {
  font-size: 16.5px;
  font-weight: 650;
  line-height: 1.4;
}

.m-hero p {
  font-size: 10.8px;
  color: var(--bf-ink-2);
}

.meta {
  display: flex;
  gap: 9px;
  font-size: 10.2px;
  color: var(--bf-ink-3);
}

.m-card {
  background: #fff;
  border: 1px solid var(--bf-border);
  border-radius: 8px;
  overflow: hidden;
}

.m-card-head {
  padding: 11px 12px;
  border-bottom: 1px solid var(--bf-border);
}

.m-card-head h2 {
  font-size: 12.7px;
  font-weight: 620;
}

.text {
  padding: 11px 12px;
  font-size: 11.8px;
  color: var(--bf-ink-2);
  line-height: 1.7;
}

.preserve {
  white-space: pre-wrap;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 7px;
  padding: 0 12px 12px;
}

.metrics div {
  background: var(--bf-surface-2);
  border: 1px solid var(--bf-border);
  border-radius: 5px;
  padding: 7px 9px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.metrics span {
  font-size: 9.5px;
  color: var(--bf-ink-3);
}

.metrics b {
  font-size: 14px;
  font-weight: 620;
}

.sticky-actions {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 64px;
  max-width: 460px;
  margin: 0 auto;
  background: #fff;
  border-top: 1px solid var(--bf-border);
  padding: 8px 12px;
  display: flex;
  gap: 8px;
  z-index: 25;
}

.sticky-actions button {
  flex: 1;
  min-height: 44px;
  border-radius: 6px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 550;
}

.sticky-actions .ghost {
  border: 1px solid var(--bf-border);
  background: #fff;
  color: var(--bf-ink-2);
}

.sticky-actions .primary {
  border: none;
  background: var(--bf-primary);
  color: #fff;
}
</style>
