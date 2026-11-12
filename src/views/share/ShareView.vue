<template>
  <div class="share-page">
    <header class="share-top">
      <div class="brand">
        <span class="logo">BF</span>
        <div>
          <strong>BenchFlow</strong>
          <span>Hardware R&amp;D Test Management</span>
        </div>
      </div>
      <span class="readonly">只读分享</span>
    </header>

    <main v-if="share && state === 'active'" class="share-body">
      <div class="banner">
        <span>这是 {{ creatorName }} 创建的只读分享，有效期至 {{ share.expiresAt }}（剩余 {{ daysLeft }} 天）。</span>
        <span class="bf-sub">访问次数 {{ share.accessCount }} · 演示环境，无真实公开授权后端</span>
      </div>

      <section class="project-card">
        <div class="p-code mono">{{ project?.code }}</div>
        <h1>{{ project?.name }}</h1>
        <p>{{ project?.description }}</p>
        <div class="p-meta">
          <div><span>项目状态</span><b>{{ project ? projectStatus.get(project.status).label : '—' }}</b></div>
          <div><span>负责人</span><b>{{ ownerName }}</b></div>
          <div><span>项目周期</span><b>{{ project?.startDate }} → {{ project?.plannedEndDate }}</b></div>
          <div><span>可查看报告</span><b>{{ share.reportIds.length }} 份</b></div>
        </div>
      </section>

      <section v-for="report in sharedReports" :key="report.id" class="report">
        <header class="r-head">
          <div>
            <span class="mono r-code">{{ report.code }}</span>
            <h2>{{ report.title }}</h2>
            <p>{{ reportType.get(report.type).label }} · 编制 {{ memberName(report.authorId) }} · {{ fmtDate(report.createdAt) }}</p>
          </div>
          <StatusPill :label="reportStatus.get(report.status).label" :tone="reportStatus.get(report.status).tone" />
        </header>
        <p class="r-summary">{{ report.summary }}</p>
        <div class="r-metrics">
          <div v-for="metric in report.metrics" :key="metric.label">
            <span>{{ metric.label }}</span>
            <b>{{ metric.value }}</b>
          </div>
        </div>
        <div class="r-sections">
          <div v-for="(section, idx) in report.sections" :key="idx" class="r-section">
            <h3>{{ section.title }}</h3>
            <p>{{ section.body }}</p>
          </div>
        </div>
      </section>

      <footer class="share-foot">
        本页面为 BenchFlow 本地演示分享，仅供查看，不提供编辑、导出原件与测量原始数据下载。
      </footer>
    </main>

    <main v-else-if="share" class="share-body invalid">
      <h2>该分享链接{{ state === 'expired' ? '已过期' : '已被撤销' }}</h2>
      <p>请联系项目负责人重新生成分享链接。</p>
    </main>

    <main v-else class="share-body invalid">
      <h2>分享链接无效</h2>
      <p>链接不存在，或数据不在当前浏览器中（本地演示模式的数据无法跨设备共享）。</p>
    </main>

    <footer class="share-bottom">
      <router-link to="/login">内部成员登录</router-link>
      <span>BenchFlow · 本地演示模式</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { db } from '@/services/db'
import { shareService } from '@/services/reportService'
import StatusPill from '@/components/common/StatusPill.vue'
import { fmtDate, projectStatus, reportStatus, reportType } from '@/utils/format'
import type { Report } from '@/types'

const route = useRoute()
const token = String(route.params.token ?? '')
const share = computed(() => shareService.getByToken(token))
const state = computed(() => (share.value ? shareService.state(share.value) : 'invalid'))

const project = computed(() => (share.value ? db.projects.find((p) => p.id === share.value!.projectId) : undefined))
const creatorName = computed(() => db.members.find((m) => m.id === share.value?.createdBy)?.name ?? '项目负责人')
const ownerName = computed(() => db.members.find((m) => m.id === project.value?.ownerId)?.name ?? '—')
const sharedReports = computed(() => {
  if (!share.value) return []
  return share.value.reportIds
    .map((id) => db.reports.find((r) => r.id === id))
    .filter((r): r is Report => Boolean(r))
})
const daysLeft = computed(() => {
  if (!share.value) return 0
  return Math.max(0, Math.ceil((new Date(share.value.expiresAt).getTime() - Date.now()) / 86400000))
})
const memberName = (id: string) => db.members.find((m) => m.id === id)?.name ?? id

onMounted(() => {
  if (share.value && state.value === 'active') shareService.touch(token)
})
</script>

<style scoped>
.share-page {
  min-height: 100vh;
  background: #f3f5f8;
  display: flex;
  flex-direction: column;
}

.share-top {
  background: #14202e;
  color: #fff;
  height: 54px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 22px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 9px;
}

.logo {
  width: 27px;
  height: 27px;
  border-radius: 6px;
  background: #1f6f8b;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
}

.brand div {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.brand strong {
  font-size: 13px;
}

.brand span {
  font-size: 9.5px;
  color: #93a8bd;
}

.readonly {
  font-size: 11px;
  border: 1px solid #3b566e;
  border-radius: 12px;
  padding: 2px 9px;
  color: #c9d6e3;
}

.share-body {
  width: 100%;
  max-width: 860px;
  margin: 0 auto;
  padding: 20px 16px 40px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.banner {
  background: #fdf6ea;
  border: 1px solid #f0dfc0;
  color: #80510a;
  border-radius: 6px;
  padding: 9px 12px;
  font-size: 11.5px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.project-card,
.report {
  background: #fff;
  border: 1px solid var(--bf-border);
  border-radius: 8px;
  padding: 18px 20px;
}

.p-code {
  font-size: 11px;
  color: var(--bf-primary);
}

.project-card h1 {
  font-size: 21px;
  font-weight: 650;
  margin-top: 3px;
}

.project-card > p {
  font-size: 12.5px;
  color: var(--bf-ink-2);
  margin-top: 6px;
  line-height: 1.65;
}

.p-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 16px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed var(--bf-border);
}

.p-meta div {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 11.8px;
}

.p-meta span {
  color: var(--bf-ink-3);
}

.r-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  border-bottom: 1px solid var(--bf-border);
  padding-bottom: 10px;
}

.r-code {
  font-size: 10.5px;
  color: var(--bf-primary);
}

.r-head h2 {
  font-size: 16px;
  font-weight: 620;
  margin-top: 2px;
}

.r-head p {
  font-size: 11px;
  color: var(--bf-ink-3);
  margin-top: 3px;
}

.r-summary {
  font-size: 12.5px;
  color: var(--bf-ink-2);
  line-height: 1.7;
  margin-top: 10px;
}

.r-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin: 12px 0;
}

.r-metrics div {
  background: var(--bf-surface-2);
  border: 1px solid var(--bf-border);
  border-radius: 5px;
  padding: 7px 9px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.r-metrics span {
  font-size: 10px;
  color: var(--bf-ink-3);
}

.r-metrics b {
  font-size: 14px;
  font-weight: 620;
}

.r-section {
  margin-top: 14px;
}

.r-section h3 {
  font-size: 12.5px;
  font-weight: 620;
  color: var(--bf-primary);
  margin-bottom: 5px;
}

.r-section p {
  font-size: 12.2px;
  line-height: 1.75;
  color: #2f3b4a;
  white-space: pre-wrap;
}

.share-foot {
  text-align: center;
  font-size: 10.5px;
  color: var(--bf-ink-3);
  line-height: 1.6;
  padding-top: 6px;
}

.invalid {
  align-items: center;
  text-align: center;
  padding-top: 80px;
}

.invalid h2 {
  font-size: 18px;
}

.invalid p {
  font-size: 12px;
  color: var(--bf-ink-3);
  margin-top: 6px;
}

.share-bottom {
  margin-top: auto;
  padding: 14px 22px;
  background: #fff;
  border-top: 1px solid var(--bf-border);
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--bf-ink-3);
}

@media (max-width: 640px) {
  .r-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .p-meta {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
