<template>
  <div v-if="defect" class="bf-page">
    <div class="defect-head">
      <button class="back" type="button" @click="router.push('/defects')"><ArrowLeft :size="15" /> 缺陷管理</button>
      <div class="title-row">
        <div class="title-main">
          <div class="code-line">
            <span class="bf-table-code mono">{{ defect.code }}</span>
            <StatusPill :label="severity.get(defect.severity).label" :tone="severity.get(defect.severity).tone" />
            <StatusPill :label="priority.get(defect.priority).label" :tone="priority.get(defect.priority).tone" />
            <StatusPill :label="defectStatus.get(defect.status).label" :tone="defectStatus.get(defect.status).tone" dot />
          </div>
          <h1>{{ defect.title }}</h1>
          <p class="sub">
            {{ projectName(defect.projectId) }} · {{ productName(defect.productId) }} ·
            {{ versionLabel(defect.hardwareVersionId) }}
            <template v-if="defect.firmwareVersionId"> / {{ versionLabel(defect.firmwareVersionId) }}</template>
            · 发现人 {{ memberName(defect.reporterId) }} · <span class="num">{{ fmtDateTime(defect.foundAt) }}</span>
          </p>
        </div>
        <div class="bf-header-actions">
          <el-button v-if="app.can('edit')" size="small" @click="openResolve">补充根因 / 修复方案</el-button>
          <el-button v-if="app.can('create')" size="small" @click="createRegression"><GitBranch :size="14" /> 创建回归任务</el-button>
          <el-button v-if="canVerify" size="small" type="primary" @click="openVerify">提交验证</el-button>
          <el-button v-else-if="canClose" size="small" type="primary" @click="closeDefect">关闭缺陷</el-button>
          <el-button v-else-if="canStart" size="small" type="primary" @click="transition('in_progress')">开始处理</el-button>
          <el-button v-else-if="canResolve" size="small" type="primary" @click="openResolve">提交修复</el-button>
        </div>
      </div>
    </div>

    <section class="bf-panel">
      <div class="lifecycle">
        <el-steps :active="stepIndex" align-center finish-status="success">
          <el-step title="新建" />
          <el-step title="待分派" />
          <el-step title="处理中" />
          <el-step title="已修复" />
          <el-step title="待关闭" />
          <el-step title="已关闭" />
        </el-steps>
      </div>
      <div class="lifecycle-actions">
        <span class="bf-sub">流转规则由服务层校验：未填写根因/修复方案不能提交修复，无验证记录不能关闭。</span>
        <div class="row">
          <el-button v-if="canAssign" size="small" @click="openAssign">分派负责人</el-button>
          <el-button v-if="canResolve" size="small" @click="openResolve">提交修复</el-button>
          <el-button v-if="canReopen" size="small" @click="reopenOpen = true">重开缺陷</el-button>
        </div>
      </div>
    </section>

    <div class="defect-grid">
      <div class="defect-main">
        <section class="bf-panel">
          <header class="bf-panel-header"><h2>缺陷描述</h2></header>
          <div class="bf-panel-body">
            <p class="paragraph">{{ defect.description }}</p>
            <h4 class="sub-title">复现步骤</h4>
            <pre class="pre">{{ defect.steps || '未填写' }}</pre>
          </div>
        </section>

        <section class="bf-panel">
          <header class="bf-panel-header"><h2>根因分析与修复方案</h2><span class="bf-sub">修复版本 {{ versionLabel(defect.fixVersionId) }}</span></header>
          <div class="bf-panel-body">
            <h4 class="sub-title">根因分析</h4>
            <p class="paragraph">{{ defect.rootCause || '尚未填写。提交修复前必须补充根因分析。' }}</p>
            <h4 class="sub-title">修复方案</h4>
            <p class="paragraph">{{ defect.fixPlan || '尚未填写。' }}</p>
          </div>
        </section>

        <section class="bf-panel">
          <header class="bf-panel-header"><h2>证据与关联记录</h2></header>
          <div class="bf-panel-body">
            <div class="evidence">
              <div v-for="att in defect.evidence" :key="att.id" class="evidence-item">
                <StatusPill :label="fileKind.get(att.kind).label" :tone="fileKind.get(att.kind).tone" />
                <span>{{ att.name }}</span>
                <span class="bf-sub">{{ fmtBytes(att.size) }}</span>
              </div>
              <EmptyState v-if="defect.evidence.length === 0" text="没有上传证据文件" />
            </div>
            <div class="links">
              <router-link v-if="defect.executionId" :to="`/test-executions/${defect.executionId}`" class="link-item">
                <PlayCircle :size="14" /> 失败执行 {{ defect.executionId }}
              </router-link>
              <router-link v-if="defect.caseId" :to="`/test-cases/${defect.caseId}/edit`" class="link-item">
                <FlaskConical :size="14" /> 关联用例 {{ defect.caseId }}
              </router-link>
              <span v-for="runId in defect.regressionExecutionIds" :key="runId" class="link-item">
                <GitBranch :size="14" />
                <router-link :to="`/test-executions/${runId}`">回归 {{ runId }}</router-link>
              </span>
            </div>
          </div>
        </section>

        <section class="bf-panel">
          <header class="bf-panel-header"><h2>讨论（{{ defect.comments.length }}）</h2></header>
          <div class="bf-panel-body">
            <div class="comments">
              <div v-for="comment in defect.comments" :key="comment.id" class="comment">
                <UserAvatar :name="memberName(comment.by)" :color="memberColor(comment.by)" size="sm" />
                <div class="c-body">
                  <div class="c-head">
                    <b>{{ memberName(comment.by) }}</b>
                    <span class="bf-sub">{{ fromNow(comment.at) }}</span>
                  </div>
                  <div class="c-text">{{ comment.text }}</div>
                  <div v-if="comment.mentions.length" class="mentions">@{{ comment.mentions.map(memberName).join(' @') }}</div>
                </div>
              </div>
              <EmptyState v-if="defect.comments.length === 0" text="还没有讨论" />
            </div>
            <div v-if="app.can('view')" class="comment-input">
              <el-input v-model="commentText" type="textarea" :rows="2" placeholder="输入评论，支持 @ 提及成员" />
              <div class="comment-actions">
                <el-select v-model="mention" size="small" clearable placeholder="@ 提及" style="width: 130px" @change="insertMention">
                  <el-option v-for="member in db.members" :key="member.id" :label="member.name" :value="member.id" />
                </el-select>
                <el-button size="small" type="primary" @click="sendComment">发表评论</el-button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <aside class="defect-side">
        <section class="bf-panel">
          <header class="bf-panel-header"><h2>处置信息</h2></header>
          <div class="bf-panel-body">
            <el-descriptions :column="1" size="small">
              <el-descriptions-item label="负责人">{{ memberName(defect.ownerId) }}</el-descriptions-item>
              <el-descriptions-item label="发现人">{{ memberName(defect.reporterId) }}</el-descriptions-item>
              <el-descriptions-item label="发现时间">{{ fmtDateTime(defect.foundAt) }}</el-descriptions-item>
              <el-descriptions-item label="修复版本">{{ versionLabel(defect.fixVersionId) }}</el-descriptions-item>
              <el-descriptions-item label="关闭时间">{{ defect.closedAt ? fmtDateTime(defect.closedAt) : '未关闭' }}</el-descriptions-item>
              <el-descriptions-item label="持续时长">{{ ageDays }} 天</el-descriptions-item>
            </el-descriptions>
            <div class="bf-hint" :class="{ warn: defect.status !== 'closed' }">
              {{ defect.status === 'closed' ? '缺陷已关闭，验证记录与回归执行完整可追溯。' : '缺陷未关闭：请按流转规则推进，关闭前必须有 PASS 的回归验证记录。' }}
            </div>
          </div>
        </section>

        <section class="bf-panel">
          <header class="bf-panel-header"><h2>验证记录</h2></header>
          <div class="bf-panel-body">
            <div v-if="defect.verification" class="verification">
              <div class="v-row"><span>验证人</span><b>{{ memberName(defect.verification.by) }}</b></div>
              <div class="v-row"><span>验证时间</span><b>{{ fmtDateTime(defect.verification.at) }}</b></div>
              <div class="v-row"><span>回归执行</span><b class="mono">{{ defect.verification.executionId ?? '—' }}</b></div>
              <div class="v-note">{{ defect.verification.note }}</div>
            </div>
            <EmptyState v-else text="尚未提交验证记录" hint="提交 PASS 的回归执行后才能关闭缺陷。" />
          </div>
        </section>

        <section class="bf-panel">
          <header class="bf-panel-header"><h2>操作时间线</h2></header>
          <div class="bf-panel-body">
            <div class="timeline">
              <div v-for="(item, idx) in sortedTimeline" :key="idx" class="t-item">
                <span class="t-dot" />
                <div>
                  <div class="t-action">{{ item.action }}</div>
                  <div class="bf-sub">{{ memberName(item.by) }} · {{ fmtDateTime(item.at) }}</div>
                  <div v-if="item.note" class="t-note">{{ item.note }}</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </aside>
    </div>

    <el-dialog v-model="assignOpen" title="分派缺陷" width="420px">
      <el-select v-model="assignTarget" style="width: 100%">
        <el-option v-for="member in db.members" :key="member.id" :label="`${member.name} · ${member.title}`" :value="member.id" />
      </el-select>
      <template #footer>
        <el-button @click="assignOpen = false">取消</el-button>
        <el-button type="primary" @click="doAssign">确认分派</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="resolveOpen" title="根因分析与修复方案" width="620px">
      <el-form label-width="92px">
        <el-form-item label="根因分析">
          <el-input v-model="resolveForm.rootCause" type="textarea" :rows="3" placeholder="定位到的根本原因" />
        </el-form-item>
        <el-form-item label="修复方案">
          <el-input v-model="resolveForm.fixPlan" type="textarea" :rows="3" placeholder="整改措施、验证方式" />
        </el-form-item>
        <el-form-item label="修复版本">
          <el-select v-model="resolveForm.fixVersionId" clearable style="width: 100%">
            <el-option
              v-for="version in productVersions"
              :key="version.id"
              :label="`${version.version} · ${version.label}`"
              :value="version.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="提交状态">
          <el-checkbox v-model="resolveForm.markResolved">同时提交为「已修复」</el-checkbox>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resolveOpen = false">取消</el-button>
        <el-button type="primary" @click="saveResolve">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="verifyOpen" title="提交验证记录" width="560px">
      <div class="bf-hint">只有同一用例、结果为 PASS 的回归执行才能作为验证记录。</div>
      <el-form label-width="92px" style="margin-top: 12px">
        <el-form-item label="回归执行">
          <el-select v-model="verifyForm.executionId" style="width: 100%" placeholder="选择 PASS 的回归执行">
            <el-option v-for="run in verifyCandidates" :key="run.id" :label="`${run.code} · ${run.result} · ${fmtDate(run.startedAt)}`" :value="run.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="验证说明">
          <el-input v-model="verifyForm.note" type="textarea" :rows="3" placeholder="回归结果、余量、结论" />
        </el-form-item>
      </el-form>
      <EmptyState v-if="verifyCandidates.length === 0" text="没有可用的 PASS 回归执行" hint="请先创建并完成一次同用例的回归测试。" />
      <template #footer>
        <el-button @click="verifyOpen = false">取消</el-button>
        <el-button type="primary" :disabled="verifyCandidates.length === 0" @click="submitVerify">提交验证</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="reopenOpen" title="重开缺陷" width="480px">
      <el-input v-model="reopenReason" type="textarea" :rows="3" placeholder="请说明重开原因" />
      <template #footer>
        <el-button @click="reopenOpen = false">取消</el-button>
        <el-button type="primary" @click="doReopen">确认重开</el-button>
      </template>
    </el-dialog>
  </div>

  <div v-else class="bf-page">
    <EmptyState text="缺陷不存在" hint="请从缺陷列表重新进入。">
      <el-button size="small" @click="router.push('/defects')">返回列表</el-button>
    </EmptyState>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, FlaskConical, GitBranch, PlayCircle } from 'lucide-vue-next'
import type { DefectStatus } from '@/types'
import { db } from '@/services/db'
import { defectService } from '@/services/defectService'
import { useAppStore } from '@/stores/app'
import StatusPill from '@/components/common/StatusPill.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { defectStatus, fileKind, fmtBytes, fmtDate, fmtDateTime, fromNow, priority, severity } from '@/utils/format'

const route = useRoute()
const router = useRouter()
const app = useAppStore()

const defect = computed(() => db.defects.find((d) => d.id === route.params.id))

const stepIndex = computed(() => {
  if (!defect.value) return 0
  const map: Record<DefectStatus, number> = {
    new: 0,
    assigned: 1,
    in_progress: 2,
    resolved: 3,
    verified: 4,
    closed: 5,
    reopened: 1,
  }
  return map[defect.value.status]
})

const canAssign = computed(() => !!defect.value && app.can('edit') && ['new', 'assigned', 'reopened'].includes(defect.value.status))
const canStart = computed(() => !!defect.value && app.can('edit') && ['assigned', 'reopened'].includes(defect.value.status))
const canResolve = computed(() => !!defect.value && app.can('edit') && defect.value.status === 'in_progress')
const canVerify = computed(() => !!defect.value && app.can('review') && defect.value.status === 'resolved')
const canClose = computed(() => !!defect.value && app.can('review') && defect.value.status === 'verified' && !!defect.value.verification)
const canReopen = computed(() => !!defect.value && app.can('edit') && ['resolved', 'verified', 'closed'].includes(defect.value.status))

const memberName = (id: string) => db.members.find((m) => m.id === id)?.name ?? id
const memberColor = (id: string) => db.members.find((m) => m.id === id)?.color ?? '#6b7a8f'
const projectName = (id: string) => db.projects.find((p) => p.id === id)?.name ?? id
const productName = (id: string) => db.products.find((p) => p.id === id)?.name ?? id
const versionLabel = (id?: string) => (id ? db.versions.find((v) => v.id === id)?.version ?? id : '未指定')

const ageDays = computed(() => {
  if (!defect.value) return 0
  const end = defect.value.closedAt ? new Date(defect.value.closedAt).getTime() : Date.now()
  return Math.max(0, Math.round((end - new Date(defect.value.foundAt).getTime()) / 86400000))
})

const productVersions = computed(() =>
  defect.value ? db.versions.filter((v) => v.productId === defect.value!.productId) : [],
)

const verifyCandidates = computed(() => {
  if (!defect.value) return []
  return db.executions.filter((e) => e.caseId === defect.value!.caseId && e.result === 'PASS')
})

const sortedTimeline = computed(() => {
  if (!defect.value) return []
  return [...defect.value.timeline].sort((a, b) => (a.at < b.at ? 1 : -1))
})

const transition = (status: DefectStatus) => {
  if (!defect.value) return
  try {
    defectService.transition(defect.value.id, status)
    ElMessage.success('缺陷状态已更新')
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message)
  }
}

const assignOpen = ref(false)
const assignTarget = ref('')
const openAssign = () => {
  if (!defect.value) return
  assignTarget.value = defect.value.ownerId
  assignOpen.value = true
}
const doAssign = () => {
  if (!defect.value) return
  defectService.assign(defect.value.id, assignTarget.value)
  assignOpen.value = false
  ElMessage.success('负责人已更新')
}
const resolveOpen = ref(false)
const resolveForm = reactive({ rootCause: '', fixPlan: '', fixVersionId: '', markResolved: false })

const openResolve = () => {
  if (!defect.value) return
  resolveForm.rootCause = defect.value.rootCause
  resolveForm.fixPlan = defect.value.fixPlan
  resolveForm.fixVersionId = defect.value.fixVersionId ?? ''
  resolveForm.markResolved = false
  resolveOpen.value = true
}

const saveResolve = () => {
  if (!defect.value) return
  if (!resolveForm.rootCause.trim() || !resolveForm.fixPlan.trim()) {
    ElMessage.warning('根因分析与修复方案都需要填写')
    return
  }
  defectService.update(defect.value.id, {
    rootCause: resolveForm.rootCause,
    fixPlan: resolveForm.fixPlan,
    fixVersionId: resolveForm.fixVersionId || undefined,
  })
  if (resolveForm.markResolved) {
    try {
      defectService.transition(defect.value.id, 'resolved', '提交修复')
    } catch (error) {
      if (error instanceof Error) ElMessage.error(error.message)
    }
  }
  resolveOpen.value = false
  ElMessage.success('根因与修复方案已保存')
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
    defectService.verify(defect.value.id, { executionId: verifyForm.executionId, note: verifyForm.note || '回归验证通过。' })
    verifyOpen.value = false
    ElMessage.success('验证记录已提交，缺陷进入待关闭')
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message)
  }
}

const closeDefect = async () => {
  if (!defect.value) return
  try {
    await ElMessageBox.confirm('关闭后缺陷将归档，验证记录仍可追溯。确认关闭？', '关闭缺陷', {
      confirmButtonText: '确认关闭',
      cancelButtonText: '取消',
    })
    defectService.close(defect.value.id, '验证通过，同意关闭')
    ElMessage.success('缺陷已关闭')
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message)
  }
}

const reopenOpen = ref(false)
const reopenReason = ref('')
const doReopen = () => {
  if (!defect.value) return
  try {
    defectService.reopen(defect.value.id, reopenReason.value)
    reopenOpen.value = false
    reopenReason.value = ''
    ElMessage.success('缺陷已重开')
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message)
  }
}

const createRegression = () => {
  if (!defect.value) return
  try {
    const plan = defectService.createRegression(defect.value.id)
    ElMessage.success(`回归计划 ${plan.code} 已创建`)
    router.push(`/test-plans/${plan.id}`)
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message)
  }
}

const commentText = ref('')
const mention = ref('')
const insertMention = (memberId: string) => {
  if (!memberId) return
  commentText.value += `${commentText.value ? ' ' : ''}@${memberName(memberId)} `
  mention.value = ''
}

const sendComment = () => {
  if (!defect.value) return
  if (!commentText.value.trim()) {
    ElMessage.warning('请输入评论内容')
    return
  }
  const mentions = db.members.filter((m) => commentText.value.includes(`@${m.name}`)).map((m) => m.id)
  defectService.comment(defect.value.id, commentText.value.trim(), mentions)
  commentText.value = ''
  ElMessage.success('评论已发布')
}
</script>

<style scoped>
.defect-head {
  background: var(--bf-surface);
  border: 1px solid var(--bf-border);
  border-radius: var(--bf-radius-lg);
  padding: 14px 18px;
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
  margin-bottom: 7px;
  font-family: inherit;
}

.back:hover {
  color: var(--bf-accent);
}

.title-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  align-items: flex-start;
}

.title-main {
  min-width: 0;
}

.code-line {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.title-main h1 {
  font-size: 20px;
  font-weight: 650;
  margin-top: 6px;
  letter-spacing: -0.01em;
}

.sub {
  font-size: 12px;
  color: var(--bf-ink-3);
  margin-top: 4px;
}

.lifecycle {
  padding: 16px 20px 8px;
}

.lifecycle-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 8px 20px 16px;
  border-top: 1px dashed var(--bf-border);
  flex-wrap: wrap;
}

.lifecycle-actions .row {
  display: flex;
  gap: 8px;
}

.defect-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(310px, 0.85fr);
  gap: 14px;
  margin-top: 14px;
  align-items: start;
}

.defect-main,
.defect-side {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.paragraph {
  font-size: 12.8px;
  line-height: 1.7;
  color: var(--bf-ink-2);
  white-space: pre-wrap;
}

.sub-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--bf-ink-2);
  margin: 14px 0 6px;
}

.pre {
  font-family: var(--bf-mono);
  font-size: 11.8px;
  background: var(--bf-surface-2);
  border: 1px solid var(--bf-border);
  border-radius: 5px;
  padding: 10px;
  white-space: pre-wrap;
  margin: 0;
  color: var(--bf-ink-2);
  line-height: 1.6;
}

.evidence {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.evidence-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  padding: 5px 0;
  border-bottom: 1px dashed var(--bf-border);
}

.links {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-top: 12px;
}

.link-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--bf-accent);
}

.comments {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 12px;
}

.comment {
  display: flex;
  gap: 8px;
}

.c-body {
  min-width: 0;
  flex: 1;
}

.c-head {
  display: flex;
  gap: 8px;
  align-items: baseline;
  font-size: 12px;
}

.c-text {
  font-size: 12.5px;
  color: var(--bf-ink-2);
  margin-top: 2px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.mentions {
  font-size: 11.5px;
  color: var(--bf-accent);
  margin-top: 2px;
}

.comment-input {
  border-top: 1px solid var(--bf-border);
  padding-top: 12px;
}

.comment-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

.verification {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
}

.v-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.v-row span {
  color: var(--bf-ink-3);
}

.v-note {
  margin-top: 6px;
  background: var(--bf-surface-2);
  border-radius: 4px;
  padding: 8px;
  font-size: 12px;
  color: var(--bf-ink-2);
  line-height: 1.6;
}

.timeline {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.t-item {
  display: flex;
  gap: 8px;
  font-size: 12px;
}

.t-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--bf-border-strong);
  margin-top: 5px;
  flex: none;
}

.t-action {
  color: var(--bf-ink);
}

.t-note {
  color: var(--bf-ink-3);
  font-size: 11.5px;
  margin-top: 1px;
}

@media (max-width: 1180px) {
  .defect-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
