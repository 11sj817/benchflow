<template>
  <div class="bf-page">
    <PageHeader title="外部协作" :subtitle="`${db.shares.length} 个分享链接 · 面向客户与供应商的只读访问`">
      <template #actions>
        <el-button v-if="app.can('create')" size="small" type="primary" @click="openCreate"><Plus :size="14" /> 创建只读分享</el-button>
      </template>
    </PageHeader>

    <div class="bf-hint">
      当前仅模拟分享链接与访问范围，没有公开授权后端。真实部署时需要服务端签发短期 Token、校验访问范围与有效期，并记录访问审计。
      演示链接可直接在浏览器打开（只读页面读取本浏览器 LocalStorage 数据）。
    </div>

    <section class="bf-panel" style="margin-top: 12px">
      <el-table :data="paged" size="small">
        <el-table-column prop="id" label="分享编号" width="104">
          <template #default="{ row }"><span class="bf-table-code">{{ row.id }}</span></template>
        </el-table-column>
        <el-table-column label="访问链接" min-width="260">
          <template #default="{ row }">
            <span class="mono token">{{ row.token }}</span>
            <div class="bf-sub">{{ row.note }}</div>
          </template>
        </el-table-column>
        <el-table-column label="项目" width="160">
          <template #default="{ row }">{{ projectName(row.projectId) }}</template>
        </el-table-column>
        <el-table-column label="可查看报告" width="200">
          <template #default="{ row }">
            <span class="bf-sub">{{ row.reportIds.map(reportCode).join('、') || '仅项目概览' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="有效期" width="118">
          <template #default="{ row }">
            <div>{{ row.expiresAt }}</div>
            <div class="bf-sub">{{ stateLabel(row) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <StatusPill :label="shareStateLabel(row)" :tone="shareStateTone(row)" />
          </template>
        </el-table-column>
        <el-table-column prop="accessCount" label="访问次数" width="88" align="right" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button size="small" text :disabled="shareService.state(row) !== 'active'" @click="openShare(row)">打开</el-button>
            <el-button size="small" text @click="copyLink(row)">复制链接</el-button>
            <el-button v-if="app.can('edit')" size="small" text type="danger" :disabled="row.status === 'revoked'" @click="revoke(row)">撤销</el-button>
          </template>
        </el-table-column>
      </el-table>
      <DataPager v-model:page="page" v-model:page-size="pageSize" :total="total" />
    </section>

    <el-dialog v-model="dialogOpen" title="创建只读分享" width="580px">
      <el-form label-width="96px">
        <el-form-item label="分享项目" required>
          <el-select v-model="form.projectId" style="width: 100%" @update:model-value="form.reportIds = []">
            <el-option v-for="project in db.projects" :key="project.id" :label="project.name" :value="project.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="可查看报告">
          <el-select v-model="form.reportIds" multiple style="width: 100%" placeholder="不选则仅展示项目概览">
            <el-option v-for="report in projectReports" :key="report.id" :label="`${report.code} · ${report.title}`" :value="report.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="有效期">
          <el-select v-model="form.days" style="width: 100%">
            <el-option :value="3" label="3 天" />
            <el-option :value="7" label="7 天" />
            <el-option :value="30" label="30 天" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.note" placeholder="例如：客户 A 阶段评审" />
        </el-form-item>
      </el-form>
      <div class="bf-hint">分享为只读视图，不包含测量原始文件下载权限；撤销后链接立即失效。</div>
      <template #footer>
        <el-button @click="dialogOpen = false">取消</el-button>
        <el-button type="primary" @click="create">创建分享</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from 'lucide-vue-next'
import type { ShareLink } from '@/types'
import { db } from '@/services/db'
import { shareService } from '@/services/reportService'
import { useAppStore } from '@/stores/app'
import { useTable } from '@/composables/useTable'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import DataPager from '@/components/common/DataPager.vue'

const app = useAppStore()

const list = computed(() => db.shares)
const { page, pageSize, total, paged } = useTable(list, { pageSize: 10 })

const projectName = (id: string) => db.projects.find((p) => p.id === id)?.name ?? id
const reportCode = (id: string) => db.reports.find((r) => r.id === id)?.code ?? id

const shareStateLabel = (row: ShareLink) => {
  const state = shareService.state(row)
  return state === 'active' ? '生效中' : state === 'expired' ? '已过期' : '已撤销'
}
const shareStateTone = (row: ShareLink) => {
  const state = shareService.state(row)
  return state === 'active' ? 'success' : state === 'expired' ? 'warning' : 'neutral'
}
const stateLabel = (row: ShareLink) => {
  const state = shareService.state(row)
  if (state === 'expired') return '已过期'
  if (state === 'revoked') return '已撤销'
  const days = Math.ceil((new Date(row.expiresAt).getTime() - Date.now()) / 86400000)
  return days >= 0 ? `剩余 ${days} 天` : '已过期'
}

const dialogOpen = ref(false)
const form = reactive({
  projectId: db.projects[0]?.id ?? '',
  reportIds: [] as string[],
  days: 7,
  note: '',
})

const projectReports = computed(() => db.reports.filter((r) => r.projectId === form.projectId))

const openCreate = () => {
  Object.assign(form, { projectId: db.projects[0]?.id ?? '', reportIds: [], days: 7, note: '' })
  dialogOpen.value = true
}

const create = () => {
  if (!form.projectId) {
    ElMessage.warning('请选择分享项目')
    return
  }
  const share = shareService.create({ ...form, note: form.note || '只读分享（演示）' })
  dialogOpen.value = false
  ElMessage.success(`分享 ${share.id} 已创建，有效期至 ${share.expiresAt}`)
  copyLink(share, false)
}

const linkOf = (share: ShareLink) => `${window.location.origin}${window.location.pathname}#/share/${share.token}`

const copyLink = async (share: ShareLink, notify = true) => {
  try {
    await navigator.clipboard.writeText(linkOf(share))
    if (notify) ElMessage.success('分享链接已复制')
  } catch {
    ElMessage.info(linkOf(share))
  }
}

const openShare = (share: ShareLink) => {
  window.open(linkOf(share), '_blank')
}

const revoke = async (share: ShareLink) => {
  try {
    await ElMessageBox.confirm(`撤销分享 ${share.id}？撤销后链接立即失效。`, '撤销分享', {
      type: 'warning',
      confirmButtonText: '撤销',
      cancelButtonText: '取消',
    })
    shareService.revoke(share.id)
    ElMessage.success('分享已撤销')
  } catch {
    // cancelled
  }
}
</script>

<style scoped>
.token {
  font-size: 12px;
  color: var(--bf-primary);
}
</style>
