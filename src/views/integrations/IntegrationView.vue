<template>
  <div class="bf-page">
    <PageHeader title="集成中心" :subtitle="`${db.integrations.length} 个集成入口 · 代码托管、消息通知、数据交换与仪器接口`">
      <template #actions>
        <el-button size="small" @click="drawerOpen = true"><BookOpen :size="14" /> 接入说明</el-button>
      </template>
    </PageHeader>

    <div class="bf-hint">
      当前为演示配置：状态切换只写入本地数据，不会发起真实 OAuth 授权、Webhook 请求或仪器连接。真实接入需要后端服务、密钥托管与网络访问控制。
    </div>

    <div class="integration-grid">
      <article v-for="integration in db.integrations" :key="integration.id" class="integration">
        <header class="i-head">
          <div class="i-icon" :class="integration.category">{{ integration.name.slice(0, 2) }}</div>
          <div class="i-title">
            <strong>{{ integration.name }}</strong>
            <span class="bf-sub">{{ categoryLabel(integration.category) }}</span>
          </div>
          <StatusPill :label="integrationStatus.get(integration.status).label" :tone="integrationStatus.get(integration.status).tone" />
        </header>
        <p class="i-desc">{{ integration.description }}</p>
        <div class="i-features">
          <span v-for="feature in integration.features" :key="feature" class="feature">· {{ feature }}</span>
        </div>
        <div class="i-config">{{ integration.configNote }}</div>
        <footer class="i-foot">
          <el-button size="small" text @click="openConfig(integration)">配置说明</el-button>
          <el-button v-if="app.can('manage')" size="small" @click="toggle(integration)">
            {{ integration.status === 'connected' ? '断开（演示）' : '连接（演示）' }}
          </el-button>
          <span v-else class="bf-sub">仅管理员可配置</span>
        </footer>
      </article>
    </div>

    <section class="bf-panel" style="margin-top: 14px">
      <header class="bf-panel-header"><h2>后续接入计划</h2><span class="bf-sub">与后端路线图对齐</span></header>
      <div class="bf-panel-body">
        <el-table :data="roadmap" size="small">
          <el-table-column prop="phase" label="阶段" width="110" />
          <el-table-column prop="item" label="能力" min-width="220" />
          <el-table-column prop="detail" label="说明" min-width="320" />
          <el-table-column prop="status" label="状态" width="100">
            <template #default="{ row }">
              <StatusPill :label="row.status" :tone="row.status === '已实现' ? 'success' : row.status === '进行中' ? 'warning' : 'neutral'" />
            </template>
          </el-table-column>
        </el-table>
      </div>
    </section>

    <el-drawer v-model="drawerOpen" title="接入说明与示例" size="600px">
      <h4 class="block-title">REST API（规划）</h4>
      <pre class="code">POST /api/v1/executions
Authorization: Bearer &lt;token&gt;
Content-Type: application/json

{
  "planId": "TP-2401-02",
  "caseId": "TC-1002",
  "testerId": "M-005",
  "hardwareVersionId": "VER-1003",
  "environment": { "temperature": 25, "humidity": 48 },
  "measurements": [
    { "param": "输出纹波（满载）", "value": 42, "unit": "mV" }
  ]
}</pre>

      <h4 class="block-title">Webhook 事件（规划）</h4>
      <pre class="code">POST https://your-endpoint/hooks/benchflow
X-BenchFlow-Signature: sha256=...

{
  "event": "execution.completed",
  "data": {
    "runId": "RUN-0028",
    "result": "PASS",
    "caseId": "TC-1002",
    "hardwareVersionId": "VER-1003"
  }
}</pre>

      <h4 class="block-title">SCPI / VISA 采集（规划）</h4>
      <pre class="code">import pyvisa
rm = pyvisa.ResourceManager()
scope = rm.open_resource('USB0::0x2A8D::0x1766::MY58123456::INSTR')
scope.write(':MEASure:VPP? CHANnel1')
value = float(scope.read())
# 由桌面 Agent 回填至 BenchFlow 执行记录</pre>

      <div class="bf-hint warn">以上接口均为后续规划，当前前端不会调用任何外部服务。</div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { BookOpen } from 'lucide-vue-next'
import type { Integration } from '@/types'
import { db } from '@/services/db'
import { integrationService } from '@/services/orgService'
import { useAppStore } from '@/stores/app'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import { integrationStatus } from '@/utils/format'

const app = useAppStore()
const drawerOpen = ref(false)

const categoryLabel = (category: Integration['category']) =>
  ({ scm: '代码托管', im: '即时通讯', data: '数据交换', api: '开放接口', instrument: '仪器接口' })[category]

const toggle = (integration: Integration) => {
  integrationService.setStatus(integration.id, integration.status === 'connected' ? 'available' : 'connected')
  ElMessage.success(`已${integration.status === 'connected' ? '断开' : '连接'} ${integration.name}（本地演示，无真实请求）`)
}

const openConfig = (integration: Integration) => {
  ElMessage.info(integration.configNote)
  drawerOpen.value = true
}

const roadmap = [
  { phase: 'Phase A', item: 'NestJS + PostgreSQL 后端', detail: '项目 / 需求 / 计划 / 执行 / 缺陷 / 报告的持久化与鉴权', status: '规划中' },
  { phase: 'Phase B', item: '对象存储', detail: '示波器波形、照片、PDF 等大文件上传与直链下载', status: '规划中' },
  { phase: 'Phase C', item: 'WebSocket 协同', detail: '多用户实时更新、在线状态与冲突处理', status: '规划中' },
  { phase: 'Phase D', item: '微信小程序原生', detail: '扫码、拍照、语音记录、订阅消息与审批', status: '规划中' },
  { phase: 'Phase E', item: '桌面采集 Agent', detail: 'PyVISA/SCPI 自动采集并回填测量值', status: '规划中' },
  { phase: 'Phase F', item: 'CSV / Excel 导出', detail: '浏览器端导入导出与报告打印', status: '已实现' },
]
</script>

<style scoped>
.integration-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 12px;
}

.integration {
  background: var(--bf-surface);
  border: 1px solid var(--bf-border);
  border-radius: var(--bf-radius-lg);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 9px;
  min-width: 0;
}

.i-head {
  display: flex;
  align-items: center;
  gap: 9px;
}

.i-icon {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: var(--bf-primary-soft);
  color: var(--bf-primary);
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
}

.i-icon.im {
  background: #e7f5ef;
  color: #12664c;
}

.i-icon.instrument {
  background: #fdf6ea;
  color: #80510a;
}

.i-icon.data {
  background: #eef2f7;
  color: #4a5a6f;
}

.i-title {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.i-title strong {
  font-size: 13px;
}

.i-desc {
  font-size: 12px;
  color: var(--bf-ink-2);
  line-height: 1.55;
  min-height: 36px;
}

.i-features {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.feature {
  font-size: 11px;
  color: var(--bf-ink-3);
}

.i-config {
  font-size: 10.8px;
  color: var(--bf-ink-3);
  background: var(--bf-surface-2);
  border-radius: 4px;
  padding: 5px 7px;
}

.i-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid var(--bf-border);
  padding-top: 8px;
}

.block-title {
  font-size: 12.5px;
  font-weight: 600;
  margin: 16px 0 8px;
  color: var(--bf-ink-2);
}

.code {
  background: #14202e;
  color: #d6e4f0;
  border-radius: 6px;
  padding: 12px;
  font-family: var(--bf-mono);
  font-size: 11px;
  line-height: 1.65;
  overflow-x: auto;
  white-space: pre;
}

@media (max-width: 1280px) {
  .integration-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .integration-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
