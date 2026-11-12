<template>
  <el-dialog :model-value="modelValue" title="演示身份与角色" width="640px" @update:model-value="emit('update:modelValue', $event)">
    <div class="bf-hint">
      用于演示不同角色的菜单、数据可见性与操作入口差异。前端角色模拟**不是**生产级安全认证，真实授权必须由后端校验。
    </div>

    <div class="section-title">当前演示身份</div>
    <div class="members">
      <button
        v-for="member in db.members"
        :key="member.id"
        type="button"
        class="member"
        :class="{ active: member.id === app.session.userId }"
        @click="switchUser(member.id)"
      >
        <UserAvatar :name="member.name" :color="member.color" size="lg" />
        <div class="info">
          <div class="name">{{ member.name }} <StatusPill :label="roleLabel(member.role).label" :tone="roleLabel(member.role).tone" /></div>
          <div class="bf-sub">{{ member.title }} · {{ member.email }}</div>
        </div>
        <Check v-if="member.id === app.session.userId" :size="16" class="check" />
      </button>
    </div>

    <div class="section-title">演示角色（覆盖会话角色）</div>
    <el-select :model-value="app.session.role" style="width: 100%" @update:model-value="changeRole">
      <el-option v-for="(label, key) in ROLE_LABEL" :key="key" :label="`${label} — ${ROLE_DESCRIPTION[key as RoleKey]}`" :value="key" />
    </el-select>

    <template #footer>
      <el-button type="primary" @click="emit('update:modelValue', false)">完成</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { Check } from 'lucide-vue-next'
import { db } from '@/services/db'
import { useAppStore } from '@/stores/app'
import { ROLE_DESCRIPTION, ROLE_LABEL } from '@/utils/permission'
import { roleLabel } from '@/utils/format'
import type { RoleKey } from '@/types'
import UserAvatar from '@/components/common/UserAvatar.vue'
import StatusPill from '@/components/common/StatusPill.vue'

defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const app = useAppStore()

const switchUser = (id: string) => {
  app.setUser(id)
  ElMessage.success(`已切换为 ${app.currentUser.name}（${ROLE_LABEL[app.session.role]}）`)
}

const changeRole = (role: RoleKey) => {
  app.setRole(role)
  ElMessage.success(`演示角色已切换为 ${ROLE_LABEL[role]}`)
}
</script>

<style scoped>
.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--bf-ink-2);
  margin: 16px 0 8px;
}
.members {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.member {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--bf-border);
  background: var(--bf-surface);
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
}
.member:hover {
  border-color: var(--bf-border-strong);
  background: var(--bf-surface-2);
}
.member.active {
  border-color: var(--bf-primary);
  background: var(--bf-primary-soft);
}
.info {
  min-width: 0;
  flex: 1;
}
.name {
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}
.check {
  color: var(--bf-primary);
}
@media (max-width: 680px) {
  .members {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
