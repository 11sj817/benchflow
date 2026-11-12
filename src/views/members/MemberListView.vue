<template>
  <div class="bf-page">
    <PageHeader title="团队与权限" :subtitle="`${db.members.length} 名成员 · 角色权限矩阵与项目成员分配`">
      <template #actions>
        <el-button size="small" @click="exportCsv"><Download :size="14" /> 导出</el-button>
        <el-button v-if="app.can('manage')" size="small" type="primary" @click="inviteOpen = true">
          <UserPlus :size="14" /> 邀请成员
        </el-button>
      </template>
    </PageHeader>

    <div class="bf-kpis">
      <KpiCard label="成员总数" :value="db.members.length" unit="人" :foot="`活跃 ${activeCount} 人`" />
      <KpiCard label="待激活邀请" :value="invitedCount" unit="人" foot="演示：未发送真实邀请邮件" />
      <KpiCard label="当前身份" :value="app.currentUser.name" :foot="ROLE_LABEL[app.session.role]" />
      <KpiCard label="可管理权限" :value="app.can('manage') ? '是' : '否'" :foot="app.can('manage') ? '可调整成员角色' : '仅组织管理员可调整'" />
    </div>

    <div class="bf-hint" style="margin-top: 12px">
      前端角色模拟只用于演示菜单与操作入口差异，<b>不是生产级安全认证</b>。真实授权必须由后端在每次请求中校验角色、项目范围与数据权限。
    </div>

    <section class="bf-panel" style="margin-top: 12px">
      <header class="bf-panel-header">
        <h2>组织成员</h2>
        <span class="bf-sub">成员角色变更写入审计日志</span>
      </header>
      <el-table :data="paged" size="small">
        <el-table-column label="成员" min-width="200">
          <template #default="{ row }">
            <div class="bf-row">
              <UserAvatar :name="row.name" :color="row.color" size="md" />
              <div>
                <div class="bf-table-name">{{ row.name }}</div>
                <div class="bf-sub">{{ row.title }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="email" label="邮箱" min-width="180" />
        <el-table-column label="角色" width="150">
          <template #default="{ row }">
            <el-select
              v-if="app.can('manage')"
              :model-value="row.role"
              size="small"
              @update:model-value="(value: RoleKey) => changeRole(row, value)"
            >
              <el-option v-for="(label, key) in ROLE_LABEL" :key="key" :label="label" :value="key" />
            </el-select>
            <StatusPill v-else :label="ROLE_LABEL[row.role as RoleKey]" tone="primary" />
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <StatusPill
              :label="row.status === 'active' ? '活跃' : row.status === 'invited' ? '待激活' : '已停用'"
              :tone="row.status === 'active' ? 'success' : row.status === 'invited' ? 'warning' : 'neutral'"
            />
          </template>
        </el-table-column>
        <el-table-column label="参与项目" width="86" align="right">
          <template #default="{ row }">{{ projectCount(row.id) }}</template>
        </el-table-column>
        <el-table-column label="最近活跃" width="110">
          <template #default="{ row }"><span class="bf-sub">{{ fromNow(row.lastActiveAt) }}</span></template>
        </el-table-column>
        <el-table-column label="加入时间" width="104">
          <template #default="{ row }"><span class="bf-sub">{{ fmtDate(row.joinedAt) }}</span></template>
        </el-table-column>
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <el-button v-if="app.can('manage')" size="small" text @click="toggleStatus(row)">
              {{ row.status === 'disabled' ? '启用' : '停用' }}
            </el-button>
            <el-button v-else size="small" text disabled>只读</el-button>
          </template>
        </el-table-column>
      </el-table>
      <DataPager v-model:page="page" v-model:page-size="pageSize" :total="total" />
    </section>

    <div class="bf-grid cols-2" style="margin-top: 14px">
      <section class="bf-panel">
        <header class="bf-panel-header"><h2>角色权限矩阵</h2></header>
        <div class="bf-panel-body flush">
          <el-table :data="matrixRows" size="small" border>
            <el-table-column prop="role" label="角色" width="120" fixed />
            <el-table-column v-for="action in PERMISSION_ORDER" :key="action" :label="PERMISSION_LABEL[action]" width="66" align="center">
              <template #default="{ row }">
                <Check v-if="row[action]" :size="14" class="yes" />
                <Minus v-else :size="14" class="no" />
              </template>
            </el-table-column>
          </el-table>
        </div>
      </section>

      <section class="bf-panel">
        <header class="bf-panel-header"><h2>项目成员分配</h2></header>
        <div class="bf-panel-body">
          <el-select v-model="assignProjectId" style="width: 100%; margin-bottom: 12px">
            <el-option v-for="project in db.projects" :key="project.id" :label="`${project.code} · ${project.name}`" :value="project.id" />
          </el-select>
          <el-checkbox-group v-if="assignProject" v-model="assignMembers" :disabled="!app.can('edit')" class="member-checks">
            <el-checkbox v-for="member in db.members" :key="member.id" :value="member.id">
              {{ member.name }} <span class="bf-sub">{{ ROLE_LABEL[member.role] }}</span>
            </el-checkbox>
          </el-checkbox-group>
          <div class="bf-row" style="margin-top: 10px">
            <el-button size="small" type="primary" :disabled="!app.can('edit')" @click="saveAssignment">保存分配</el-button>
            <span class="bf-sub">当前 {{ assignMembers.length }} 人</span>
          </div>
        </div>
      </section>
    </div>

    <el-dialog v-model="inviteOpen" title="邀请成员（演示）" width="480px">
      <el-form label-width="76px">
        <el-form-item label="姓名"><el-input v-model="inviteForm.name" /></el-form-item>
        <el-form-item label="邮箱"><el-input v-model="inviteForm.email" /></el-form-item>
        <el-form-item label="职位"><el-input v-model="inviteForm.title" /></el-form-item>
        <el-form-item label="角色">
          <el-select v-model="inviteForm.role" style="width: 100%">
            <el-option v-for="(label, key) in ROLE_LABEL" :key="key" :label="label" :value="key" />
          </el-select>
        </el-form-item>
      </el-form>
      <div class="bf-hint">演示环境不会发送真实邀请邮件，成员以「待激活」状态加入本地数据。</div>
      <template #footer>
        <el-button @click="inviteOpen = false">取消</el-button>
        <el-button type="primary" @click="invite">邀请</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Check, Download, Minus, UserPlus } from 'lucide-vue-next'
import type { Member, RoleKey } from '@/types'
import { db } from '@/services/db'
import { memberService } from '@/services/orgService'
import { projectService } from '@/services/projectService'
import { useAppStore } from '@/stores/app'
import { useTable } from '@/composables/useTable'
import PageHeader from '@/components/common/PageHeader.vue'
import KpiCard from '@/components/common/KpiCard.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import DataPager from '@/components/common/DataPager.vue'
import { fmtDate, fromNow } from '@/utils/format'
import { PERMISSION_LABEL, PERMISSION_ORDER, ROLE_LABEL, ROLE_PERMISSIONS } from '@/utils/permission'
import { downloadText, toCsv } from '@/utils/csv'

const app = useAppStore()

const { page, pageSize, total, paged } = useTable(computed(() => db.members), { pageSize: 10 })

const activeCount = computed(() => db.members.filter((m) => m.status === 'active').length)
const invitedCount = computed(() => db.members.filter((m) => m.status === 'invited').length)
const projectCount = (memberId: string) => db.projects.filter((p) => p.memberIds.includes(memberId)).length

const matrixRows = computed(() =>
  (Object.keys(ROLE_LABEL) as RoleKey[]).map((role) => {
    const row: Record<string, boolean | string> = { role: ROLE_LABEL[role] }
    PERMISSION_ORDER.forEach((action) => {
      row[action] = ROLE_PERMISSIONS[role].includes(action)
    })
    return row
  }),
)

const changeRole = (member: Member, role: RoleKey) => {
  memberService.setRole(member.id, role)
  ElMessage.success(`${member.name} 的角色已更新为 ${ROLE_LABEL[role]}`)
}

const toggleStatus = (member: Member) => {
  memberService.setStatus(member.id, member.status === 'disabled' ? 'active' : 'disabled')
  ElMessage.success('成员状态已更新')
}

const inviteOpen = ref(false)
const inviteForm = reactive({ name: '', email: '', title: '测试工程师', role: 'test_engineer' as RoleKey })

watch(inviteOpen, (open) => {
  if (open) Object.assign(inviteForm, { name: '', email: '', title: '测试工程师', role: 'test_engineer' })
})

const invite = () => {
  if (!inviteForm.name.trim() || !inviteForm.email.trim()) {
    ElMessage.warning('请填写姓名与邮箱')
    return
  }
  memberService.invite({ ...inviteForm })
  inviteOpen.value = false
  ElMessage.success('邀请已创建（演示，不会发送邮件）')
}

const assignProjectId = ref(db.projects[0]?.id ?? '')
const assignMembers = ref<string[]>([])

const assignProject = computed(() => db.projects.find((p) => p.id === assignProjectId.value))

watch(
  assignProjectId,
  () => {
    assignMembers.value = assignProject.value ? [...assignProject.value.memberIds] : []
  },
  { immediate: true },
)

const saveAssignment = () => {
  if (!assignProject.value) return
  projectService.update(assignProject.value.id, { memberIds: [...assignMembers.value] })
  ElMessage.success('项目成员已更新')
}

const exportCsv = () => {
  downloadText(
    `benchflow-members-${new Date().toISOString().slice(0, 10)}.csv`,
    toCsv(
      ['姓名', '职位', '邮箱', '角色', '状态', '参与项目数', '加入时间'],
      db.members.map((m) => [m.name, m.title, m.email, ROLE_LABEL[m.role], m.status, projectCount(m.id), m.joinedAt.slice(0, 10)]),
    ),
  )
  ElMessage.success('已导出成员 CSV')
}
</script>

<style scoped>
.member-checks {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 10px;
}

.yes {
  color: #157a5b;
}

.no {
  color: var(--bf-border-strong);
}
</style>
