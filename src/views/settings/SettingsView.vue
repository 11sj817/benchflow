<template>
  <div class="bf-page">
    <PageHeader title="系统设置" subtitle="组织资料、个人偏好、数据管理与系统信息" />

    <section class="bf-panel">
      <el-tabs v-model="tab" class="settings-tabs">
        <el-tab-pane label="组织资料" name="org">
          <el-form label-width="110px" class="settings-form">
            <el-form-item label="组织名称"><el-input v-model="orgForm.name" :disabled="!app.can('manage')" /></el-form-item>
            <el-form-item label="组织编号"><el-input v-model="orgForm.code" :disabled="!app.can('manage')" /></el-form-item>
            <el-form-item label="行业"><el-input v-model="orgForm.industry" :disabled="!app.can('manage')" /></el-form-item>
            <el-form-item label="联系邮箱"><el-input v-model="orgForm.contact" :disabled="!app.can('manage')" /></el-form-item>
            <el-form-item label="演示套餐"><el-input :model-value="orgForm.plan" disabled /></el-form-item>
            <el-form-item>
              <el-button type="primary" size="small" :disabled="!app.can('manage')" @click="saveOrg">保存组织资料</el-button>
              <span v-if="!app.can('manage')" class="bf-sub" style="margin-left: 10px">仅组织管理员可修改</span>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="个人资料" name="profile">
          <el-form label-width="110px" class="settings-form">
            <el-form-item label="姓名"><el-input v-model="profileForm.name" /></el-form-item>
            <el-form-item label="职位"><el-input v-model="profileForm.title" /></el-form-item>
            <el-form-item label="邮箱"><el-input v-model="profileForm.email" /></el-form-item>
            <el-form-item label="电话"><el-input v-model="profileForm.phone" /></el-form-item>
            <el-form-item label="当前角色">
              <StatusPill :label="ROLE_LABEL[app.session.role]" tone="primary" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" size="small" @click="saveProfile">保存个人资料</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="通知偏好" name="notice">
          <div class="settings-form">
            <div class="pref" v-for="pref in prefs" :key="pref.key">
              <div>
                <strong>{{ pref.label }}</strong>
                <div class="bf-sub">{{ pref.desc }}</div>
              </div>
              <el-switch v-model="pref.value" />
            </div>
            <div class="bf-hint">通知偏好保存在本机浏览器。接入后端后会同步到用户配置，并通过企业微信 / 邮件实际发送。</div>
            <el-button size="small" @click="savePrefs">保存偏好</el-button>
          </div>
        </el-tab-pane>

        <el-tab-pane label="项目默认" name="defaults">
          <el-form label-width="140px" class="settings-form">
            <el-form-item label="默认项目负责人">
              <el-select v-model="defaults.ownerId" style="width: 100%">
                <el-option v-for="member in db.members" :key="member.id" :label="member.name" :value="member.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="默认测试计划周期">
              <el-input-number v-model="defaults.planDays" :min="1" :max="90" />
              <span class="bf-sub" style="margin-left: 8px">天</span>
            </el-form-item>
            <el-form-item label="执行通过判定">
              <el-radio-group v-model="defaults.strictMode">
                <el-radio :value="true">严格：任一测量超限即 FAIL</el-radio>
                <el-radio :value="false">宽松：仅必填项超限才 FAIL</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item>
              <el-button size="small" type="primary" @click="saveDefaults">保存默认配置</el-button>
            </el-form-item>
          </el-form>
          <div class="bf-hint warn">默认配置目前仅保存在本机，用于演示；实际判定逻辑由用例阈值与服务层实现。</div>
        </el-tab-pane>

        <el-tab-pane label="数据管理" name="data">
          <div class="settings-form">
            <el-descriptions :column="2" border size="small">
              <el-descriptions-item label="数据模式">本地演示模式（LocalStorage）</el-descriptions-item>
              <el-descriptions-item label="数据修订号">#{{ db.meta.revision }}</el-descriptions-item>
              <el-descriptions-item label="项目 / 执行">{{ db.projects.length }} / {{ db.executions.length }}</el-descriptions-item>
              <el-descriptions-item label="缺陷 / 用例">{{ db.defects.length }} / {{ db.cases.length }}</el-descriptions-item>
              <el-descriptions-item label="跨标签页同步">{{ workspace.lastRemoteSync ? fromNow(workspace.lastRemoteSync) : '尚未收到远端变更' }}</el-descriptions-item>
              <el-descriptions-item label="同步事件">{{ workspace.remoteEventCount }} 次</el-descriptions-item>
            </el-descriptions>

            <div class="storage">
              <div class="bf-between">
                <span class="bf-sub">LocalStorage 使用量</span>
                <span class="bf-sub">{{ fmtBytes(usage.bytes) }} / 5 MB</span>
              </div>
              <el-progress :percentage="Math.round(usage.ratio * 1000) / 10" :stroke-width="8" :status="usage.ratio > 0.8 ? 'exception' : undefined" />
            </div>

            <div class="data-actions">
              <el-button size="small" @click="exportJson">导出全部数据 JSON</el-button>
              <el-button size="small" @click="reloadDb">从本地存储重新载入</el-button>
              <el-button size="small" type="danger" plain @click="resetData">恢复初始演示数据</el-button>
            </div>
            <div class="bf-hint warn">恢复初始数据会覆盖当前所有本地修改，且不可撤销。</div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="外观" name="theme">
          <div class="settings-form">
            <div class="pref">
              <div>
                <strong>紧凑密度</strong>
                <div class="bf-sub">减小基础字号与表格行高，适合 1366px 笔记本</div>
              </div>
              <el-switch :model-value="app.compactMode" @update:model-value="app.setCompact" />
            </div>
            <div class="pref">
              <div>
                <strong>主题</strong>
                <div class="bf-sub">当前仅提供浅色专业主题（深蓝灰 + 低饱和青绿）</div>
              </div>
              <StatusPill label="浅色（固定）" tone="neutral" />
            </div>
            <div class="bf-hint">设计规范见 docs/UI_DESIGN_SYSTEM.md。</div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="系统信息" name="about">
          <div class="settings-form">
            <el-descriptions :column="2" border size="small">
              <el-descriptions-item label="产品名称">BenchFlow 2.0（内部代号）</el-descriptions-item>
              <el-descriptions-item label="前端版本">2.0.0</el-descriptions-item>
              <el-descriptions-item label="数据模型版本">schema {{ db.meta.schema }}</el-descriptions-item>
              <el-descriptions-item label="路由模式">Hash（GitHub Pages 兼容）</el-descriptions-item>
              <el-descriptions-item label="技术栈">Vue 3 · TypeScript · Vite · Pinia · Element Plus · ECharts</el-descriptions-item>
              <el-descriptions-item label="数据存储键">benchflow.db.v2</el-descriptions-item>
              <el-descriptions-item label="演示组织">{{ db.org.name }}</el-descriptions-item>
              <el-descriptions-item label="演示模式">本地演示 / 无后端</el-descriptions-item>
            </el-descriptions>
            <div class="bf-hint">
              BenchFlow 为暂定内部代号，未声明商标或域名。当前版本不连接任何外部 API，不包含真实客户数据。
              后端接入计划见 NEXT_STEPS.md。
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { db, loadDb, storageUsage } from '@/services/db'
import { orgService, memberService } from '@/services/orgService'
import { useAppStore } from '@/stores/app'
import { useWorkspaceStore } from '@/stores/workspace'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import { fmtBytes, fromNow } from '@/utils/format'
import { ROLE_LABEL } from '@/utils/permission'
import { downloadText } from '@/utils/csv'

const app = useAppStore()
const workspace = useWorkspaceStore()
const tab = ref('org')

const orgForm = reactive({ ...db.org })
const profileForm = reactive({
  name: app.currentUser.name,
  title: app.currentUser.title,
  email: app.currentUser.email,
  phone: app.currentUser.phone ?? '',
})

const usage = computed(() => storageUsage())

const saveOrg = () => {
  orgService.update({ ...orgForm })
  ElMessage.success('组织资料已保存')
}

const saveProfile = () => {
  memberService.updateProfile(app.currentUser.id, { ...profileForm })
  ElMessage.success('个人资料已保存')
}

const PREF_KEY = 'benchflow.notification.prefs'
const saved = (() => {
  try {
    return JSON.parse(localStorage.getItem(PREF_KEY) ?? '{}') as Record<string, boolean>
  } catch {
    return {}
  }
})()

const prefs = reactive([
  { key: 'defect', label: '缺陷分派与状态变更', desc: '被分派缺陷、待验证、关闭审核时提醒', value: saved.defect ?? true },
  { key: 'report', label: '报告审核', desc: '报告提交审核与审核结果通知', value: saved.report ?? true },
  { key: 'calibration', label: '设备校准提醒', desc: '校准到期前 30 天与过期时提醒', value: saved.calibration ?? true },
  { key: 'task', label: '我的测试任务', desc: '计划分派、执行待提交提醒', value: saved.task ?? true },
  { key: 'weekly', label: '每周质量简报', desc: '汇总执行通过率与未关闭缺陷', value: saved.weekly ?? false },
])

const savePrefs = () => {
  localStorage.setItem(PREF_KEY, JSON.stringify(Object.fromEntries(prefs.map((p) => [p.key, p.value]))))
  ElMessage.success('通知偏好已保存到本机')
}

const DEFAULTS_KEY = 'benchflow.project.defaults'
const defaults = reactive({
  ownerId: app.currentUser.id,
  planDays: 7,
  strictMode: true,
})

const saveDefaults = () => {
  localStorage.setItem(DEFAULTS_KEY, JSON.stringify(defaults))
  ElMessage.success('默认项目配置已保存到本机')
}

const exportJson = () => {
  downloadText(`benchflow-data-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(db, null, 2), 'application/json')
  ElMessage.success('已导出全部本地数据')
}

const reloadDb = () => {
  loadDb()
  ElMessage.success('已从 LocalStorage 重新载入')
}

const resetData = async () => {
  try {
    await ElMessageBox.confirm('恢复初始演示数据会覆盖当前所有修改，是否继续？', '恢复演示数据', {
      type: 'warning',
      confirmButtonText: '恢复',
      cancelButtonText: '取消',
    })
    workspace.reset()
    ElMessage.success('已恢复初始演示数据')
  } catch {
    // cancelled
  }
}
</script>

<style scoped>
.settings-tabs {
  padding: 4px 18px 18px;
}

.settings-form {
  max-width: 720px;
  padding-top: 8px;
}

.pref {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--bf-border);
}

.pref strong {
  font-size: 12.8px;
}

.storage {
  margin: 16px 0 12px;
}

.data-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
</style>
