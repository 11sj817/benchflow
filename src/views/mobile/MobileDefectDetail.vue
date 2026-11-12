<template>
  <div v-if="defect" class="m-detail">
    <button type="button" class="back" @click="router.back()"><ArrowLeft :size="16" /> 返回</button>

    <header class="m-hero">
      <div class="code-row">
        <span class="mono">{{ defect.code }}</span>
        <span class="badge" :class="defect.status">{{ defectStatus.get(defect.status).label }}</span>
      </div>
      <h1>{{ defect.title }}</h1>
      <p>{{ projectName(defect.projectId) }} · {{ productName(defect.productId) }} · {{ versionLabel(defect.hardwareVersionId) }}</p>
      <div class="meta">
        <span>负责人 {{ memberName(defect.ownerId) }}</span>
        <span>{{ fmtDate(defect.foundAt) }}</span>
      </div>
      <div class="tags">
        <span class="tag danger">{{ severity.get(defect.severity).label }}</span>
        <span class="tag warning">{{ priority.get(defect.priority).label }}</span>
      </div>
    </header>

    <section class="m-card">
      <header class="m-card-head"><h2>缺陷描述</h2></header>
      <p class="text">{{ defect.description }}</p>
      <div class="sub-block">
        <strong>复现步骤</strong>
        <pre>{{ defect.steps || '未填写' }}</pre>
      </div>
    </section>

    <section class="m-card">
      <header class="m-card-head"><h2>根因与修复</h2></header>
      <div class="sub-block">
        <strong>根因分析</strong>
        <p class="text">{{ defect.rootCause || '尚未填写' }}</p>
      </div>
      <div class="sub-block">
        <strong>修复方案</strong>
        <p class="text">{{ defect.fixPlan || '尚未填写' }}</p>
      </div>
      <div class="sub-block" v-if="defect.fixVersionId">
        <strong>修复版本</strong>
        <p class="text">{{ versionLabel(defect.fixVersionId) }}</p>
      </div>
    </section>

    <section class="m-card">
      <header class="m-card-head"><h2>关联记录</h2></header>
      <div class="list">
        <router-link v-if="defect.executionId" :to="`/mobile/executions/${defect.executionId}`" class="row">
          <span class="dot danger" />
          <span class="row-main"><strong>失败执行 {{ defect.executionId }}</strong><span>查看测量值与判定</span></span>
          <ChevronRight :size="14" />
        </router-link>
        <router-link v-if="defect.caseId" :to="`/mobile/record?caseId=${defect.caseId}`" class="row">
          <span class="dot" />
          <span class="row-main"><strong>关联用例 {{ defect.caseId }}</strong><span>按同一用例创建回归记录</span></span>
          <ChevronRight :size="14" />
        </router-link>
        <router-link v-for="runId in defect.regressionExecutionIds" :key="runId" :to="`/mobile/executions/${runId}`" class="row">
          <span class="dot success" />
          <span class="row-main"><strong>回归 {{ runId }}</strong><span>查看回归结果</span></span>
          <ChevronRight :size="14" />
        </router-link>
      </div>
    </section>

    <section class="m-card">
      <header class="m-card-head"><h2>处理进度</h2><span>{{ timeline.length }} 条</span></header>
      <div class="timeline">
        <div v-for="(item, index) in timeline" :key="index" class="t-item">
          <span class="t-dot" />
          <div>
            <strong>{{ item.action }}</strong>
            <span>{{ memberName(item.by) }} · {{ fmtDateTime(item.at) }}</span>
            <p v-if="item.note">{{ item.note }}</p>
          </div>
        </div>
      </div>
    </section>

    <section class="m-card">
      <header class="m-card-head"><h2>讨论</h2><span>{{ defect.comments.length }} 条</span></header>
      <div class="comments">
        <div v-for="comment in defect.comments" :key="comment.id" class="comment">
          <UserAvatar :name="memberName(comment.by)" size="sm" />
          <div>
            <strong>{{ memberName(comment.by) }} <span>{{ fromNow(comment.at) }}</span></strong>
            <p>{{ comment.text }}</p>
          </div>
        </div>
        <EmptyState v-if="defect.comments.length === 0" text="还没有讨论" />
      </div>
      <div class="comment-input">
        <el-input v-model="commentText" type="textarea" :rows="2" placeholder="补充处理说明…" />
        <button type="button" @click="sendComment">发送</button>
      </div>
    </section>

    <div class="sticky-actions">
      <button v-if="canAssign" type="button" class="ghost" @click="assign">分派给我</button>
      <button v-if="canStart" type="button" class="primary" @click="transition('in_progress')">开始处理</button>
      <button v-if="canResolve" type="button" class="primary" @click="openResolve">提交修复</button>
      <button v-if="canVerify" type="button" class="primary" @click="openVerify">提交验证</button>
      <button v-if="canClose" type="button" class="primary" @click="closeDefect">关闭缺陷</button>
      <button v-if="canReopen" type="button" class="ghost" @click="reopen">重开</button>
    </div>

    <el-dialog v-model="resolveOpen" title="提交修复" width="92%">
      <el-input v-model="resolveForm.rootCause" type="textarea" :rows="3" placeholder="根因分析" />
      <el-input v-model="resolveForm.fixPlan" type="textarea" :rows="3" placeholder="修复方案" style="margin-top: 8px" />
      <el-select v-model="resolveForm.fixVersionId" clearable placeholder="修复版本" style="width: 100%; margin-top: 8px">
        <el-option v-for="version in versions" :key="version.id" :label="version.version" :value="version.id" />
      </el-select>
      <template #footer>
        <el-button @click="resolveOpen = false">取消</el-button>
        <el-button type="primary" @click="submitResolve">提交</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="verifyOpen" title="提交验证" width="92%">
      <p class="dialog-hint">仅同一用例的 PASS 回归执行可作为验证记录。</p>
      <el-select v-model="verifyForm.executionId" placeholder="选择回归执行" style="width: 100%">
        <el-option v-for="candidate in verifyCandidates" :key="candidate.id" :label="`${candidate.code} · ${candidate.result}`" :value="candidate.id" />
      </el-select>
      <el-input v-model="verifyForm.note" type="textarea" :rows="2" placeholder="验证说明" style="margin-top: 8px" />
      <template #footer>
        <el-button @click="verifyOpen = false">取消</el-button>
        <el-button type="primary" :disabled="!verifyCandidates.length" @click="submitVerify">提交验证</el-button>
      </template>
    </el-dialog>
  </div>

  <div v-else class="m-detail">
    <EmptyState text="缺陷不存在">
      <el-button size="small" @click="router.push('/mobile/tasks')">返回任务</el-button>
    </EmptyState>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, ChevronRight } from 'lucide-vue-next'
import type { DefectStatus } from '@/types'
import { db } from '@/services/db'
import { defectService } from '@/services/defectService'
import { useAppStore } from '@/stores/app'
import EmptyState from '@/components/common/EmptyState.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import { defectStatus, fmtDate, fmtDateTime, fromNow, priority, severity } from '@/utils/format'

const route = useRoute()
const router = useRouter()
const app = useAppStore()

const defect = computed(() => db.defects.find((row) => row.id === route.params.id))
const timeline = computed(() => (defect.value ? [...defect.value.timeline].sort((a, b) => (a.at < b.at ? 1 : -1)) : []))
const versions = computed(() => (defect.value ? db.versions.filter((version) => version.productId === defect.value!.productId) : []))
const verifyCandidates = computed(() =>
  defect.value ? db.executions.filter((run) => run.caseId === defect.value!.caseId && run.result === 'PASS') : [],
)

const canAssign = computed(() => !!defect.value && app.can('edit') && ['new', 'assigned', 'reopened'].includes(defect.value.status) && defect.value.ownerId !== app.currentUser.id)
const canStart = computed(() => !!defect.value && app.can('edit') && ['assigned', 'reopened'].includes(defect.value.status))
const canResolve = computed(() => !!defect.value && app.can('edit') && defect.value.status === 'in_progress')
const canVerify = computed(() => !!defect.value && app.can('review') && defect.value.status === 'resolved')
const canClose = computed(() => !!defect.value && app.can('review') && defect.value.status === 'verified')
const canReopen = computed(() => !!defect.value && app.can('edit') && ['resolved', 'verified', 'closed'].includes(defect.value.status))

const memberName = (id: string) => db.members.find((member) => member.id === id)?.name ?? id
const projectName = (id: string) => db.projects.find((project) => project.id === id)?.name ?? id
const productName = (id: string) => db.products.find((product) => product.id === id)?.name ?? id
const versionLabel = (id?: string) => (id ? db.versions.find((version) => version.id === id)?.version ?? id : '—')

const transition = (status: DefectStatus) => {
  if (!defect.value) return
  try {
    defectService.transition(defect.value.id, status)
    ElMessage.success('状态已更新')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '状态更新失败')
  }
}

const assign = () => {
  if (!defect.value) return
  defectService.assign(defect.value.id, app.currentUser.id)
  ElMessage.success('已分派给我')
}

const resolveOpen = ref(false)
const resolveForm = reactive({ rootCause: '', fixPlan: '', fixVersionId: '' })
const openResolve = () => {
  if (!defect.value) return
  resolveForm.rootCause = defect.value.rootCause
  resolveForm.fixPlan = defect.value.fixPlan
  resolveForm.fixVersionId = defect.value.fixVersionId ?? ''
  resolveOpen.value = true
}
const submitResolve = () => {
  if (!defect.value) return
  if (!resolveForm.rootCause.trim() || !resolveForm.fixPlan.trim()) {
    ElMessage.warning('请填写根因分析与修复方案')
    return
  }
  defectService.update(defect.value.id, {
    rootCause: resolveForm.rootCause,
    fixPlan: resolveForm.fixPlan,
    fixVersionId: resolveForm.fixVersionId || undefined,
  })
  try {
    defectService.transition(defect.value.id, 'resolved', '提交修复')
    resolveOpen.value = false
    ElMessage.success('已提交修复')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '提交失败')
  }
}

const verifyOpen = ref(false)
const verifyForm = reactive({ executionId: '', note: '' })
const openVerify = () => {
  verifyForm.executionId = verifyCandidates.value[0]?.id ?? ''
  verifyForm.note = ''
  verifyOpen.value = true
}
const submitVerify = () => {
  if (!defect.value) return
  try {
    defectService.verify(defect.value.id, { executionId: verifyForm.executionId, note: verifyForm.note || '回归验证通过' })
    verifyOpen.value = false
    ElMessage.success('验证记录已提交')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '验证失败')
  }
}

const closeDefect = async () => {
  if (!defect.value) return
  try {
    await ElMessageBox.confirm('确认关闭缺陷？验证记录会保留。', '关闭缺陷', { confirmButtonText: '关闭', cancelButtonText: '取消' })
    defectService.close(defect.value.id)
    ElMessage.success('缺陷已关闭')
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message)
  }
}

const reopen = async () => {
  if (!defect.value) return
  try {
    const { value } = await ElMessageBox.prompt('请填写重开原因', '重开缺陷', { inputPlaceholder: '例如：回归后再次复现' })
    defectService.reopen(defect.value.id, value ?? '')
    ElMessage.success('缺陷已重开')
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message)
  }
}

const commentText = ref('')
const sendComment = () => {
  if (!defect.value || !commentText.value.trim()) return
  defectService.comment(defect.value.id, commentText.value.trim())
  commentText.value = ''
  ElMessage.success('评论已发送')
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
  padding: 13px 14px;
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

.badge {
  font-size: 9.5px;
  border-radius: 9px;
  padding: 1px 7px;
  background: #eef2f7;
  color: #5a6a7e;
}

.badge.in_progress {
  background: #eaf1f7;
  color: #2a5878;
}

.badge.verified {
  background: #fdf6ea;
  color: #80510a;
}

.badge.closed {
  background: #e7f5ef;
  color: #12664c;
}

.badge.reopened {
  background: #fdecea;
  color: #a12319;
}

.m-hero h1 {
  font-size: 17px;
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
  flex-wrap: wrap;
  font-size: 10.2px;
  color: var(--bf-ink-3);
}

.tags {
  display: flex;
  gap: 5px;
  margin-top: 2px;
}

.tag {
  font-size: 9.5px;
  border-radius: 3px;
  padding: 1px 6px;
  background: #eef2f7;
  color: #5a6a7e;
}

.tag.danger {
  background: #fdecea;
  color: #a12319;
}

.tag.warning {
  background: #fdf6ea;
  color: #80510a;
}

.m-card {
  background: #fff;
  border: 1px solid var(--bf-border);
  border-radius: 8px;
  overflow: hidden;
}

.m-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 11px 12px;
  border-bottom: 1px solid var(--bf-border);
}

.m-card-head h2 {
  font-size: 12.7px;
  font-weight: 620;
}

.m-card-head > span {
  font-size: 10.2px;
  color: var(--bf-ink-3);
}

.text {
  padding: 10px 12px 0;
  font-size: 11.8px;
  color: var(--bf-ink-2);
  line-height: 1.65;
  white-space: pre-wrap;
}

.sub-block {
  padding: 8px 12px;
}

.sub-block strong {
  font-size: 10.5px;
  color: var(--bf-ink-3);
  display: block;
  margin-bottom: 3px;
}

.sub-block p {
  font-size: 11.8px;
  color: var(--bf-ink-2);
  line-height: 1.6;
  white-space: pre-wrap;
}

.sub-block pre {
  margin: 0;
  background: var(--bf-surface-2);
  border-radius: 5px;
  padding: 8px;
  font-family: var(--bf-mono);
  font-size: 10.8px;
  line-height: 1.55;
  white-space: pre-wrap;
  color: var(--bf-ink-2);
}

.list {
  display: flex;
  flex-direction: column;
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--bf-border);
  color: var(--bf-ink);
  text-decoration: none;
  min-height: 48px;
}

.row:last-child {
  border-bottom: none;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--bf-border-strong);
}

.dot.danger {
  background: #b02a1f;
}

.dot.success {
  background: #157a5b;
}

.row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.row-main strong {
  font-size: 11.8px;
  font-weight: 550;
}

.row-main span {
  font-size: 10.2px;
  color: var(--bf-ink-3);
}

.timeline {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 11px 12px;
}

.t-item {
  display: flex;
  gap: 8px;
}

.t-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--bf-border-strong);
  margin-top: 5px;
  flex: none;
}

.t-item strong {
  font-size: 11.8px;
  font-weight: 550;
  display: block;
}

.t-item span {
  font-size: 10px;
  color: var(--bf-ink-3);
}

.t-item p {
  font-size: 10.8px;
  color: var(--bf-ink-2);
  margin-top: 2px;
  line-height: 1.5;
}

.comments {
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 11px 12px;
}

.comment {
  display: flex;
  gap: 8px;
}

.comment strong {
  font-size: 11px;
  display: block;
}

.comment strong span {
  font-weight: 400;
  color: var(--bf-ink-3);
  font-size: 9.5px;
}

.comment p {
  font-size: 11.5px;
  color: var(--bf-ink-2);
  margin-top: 2px;
  line-height: 1.55;
  white-space: pre-wrap;
}

.comment-input {
  display: flex;
  gap: 6px;
  padding: 0 12px 12px;
  align-items: flex-end;
}

.comment-input button {
  min-height: 40px;
  min-width: 56px;
  border: none;
  border-radius: 5px;
  background: var(--bf-primary);
  color: #fff;
  font-family: inherit;
  font-size: 12px;
}

.dialog-hint {
  font-size: 11px;
  color: var(--bf-ink-3);
  margin-bottom: 8px;
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
  font-size: 12.5px;
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
