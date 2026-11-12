<template>
  <div class="login">
    <div class="head">
      <h2>进入 BenchFlow</h2>
      <p>选择一个演示身份。该步骤仅用于展示角色权限差异，不是真实登录认证。</p>
    </div>

    <div class="members">
      <button
        v-for="member in db.members"
        :key="member.id"
        type="button"
        class="member"
        :class="{ active: selected === member.id }"
        @click="selected = member.id"
      >
        <UserAvatar :name="member.name" :color="member.color" size="lg" />
        <div class="info">
          <div class="name">{{ member.name }}</div>
          <div class="bf-sub">{{ member.title }}</div>
        </div>
        <StatusPill :label="ROLE_LABEL[member.role]" tone="primary" />
      </button>
    </div>

    <div class="role-row">
      <span class="label">演示角色</span>
      <el-select v-model="role" size="default" style="flex: 1">
        <el-option v-for="(label, key) in ROLE_LABEL" :key="key" :label="label" :value="key" />
      </el-select>
    </div>

    <div class="bf-hint">
      当前为本地演示模式：所有数据保存在此浏览器的 LocalStorage，多个标签页之间通过 BroadcastChannel 同步。
      不要在演示数据中填写真实客户信息或密钥。
    </div>

    <el-button type="primary" size="large" class="enter" @click="enter">进入工作空间</el-button>

    <div class="quick">
      <button class="bf-link-btn" type="button" @click="quick('M-002')">测试负责人视角</button>
      <span class="sep">·</span>
      <button class="bf-link-btn" type="button" @click="quick('M-006')">外部访客视角</button>
      <span class="sep">·</span>
      <button class="bf-link-btn" type="button" @click="goMobile">移动端演示</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '@/services/db'
import { useAppStore } from '@/stores/app'
import { ROLE_LABEL } from '@/utils/permission'
import type { RoleKey } from '@/types'
import UserAvatar from '@/components/common/UserAvatar.vue'
import StatusPill from '@/components/common/StatusPill.vue'

const router = useRouter()
const app = useAppStore()
const selected = ref(app.session.userId)
const role = ref<RoleKey>(app.session.role)

const enter = () => {
  app.setUser(selected.value)
  app.setRole(role.value)
  router.push('/dashboard')
}

const quick = (id: string) => {
  selected.value = id
  const member = db.members.find((m) => m.id === id)
  if (member) role.value = member.role
  enter()
}

const goMobile = () => {
  app.setUser(selected.value)
  router.push('/mobile/home')
}
</script>

<style scoped>
.login {
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.head h2 {
  font-size: 22px;
  font-weight: 620;
  letter-spacing: -0.01em;
}

.head p {
  margin-top: 6px;
  font-size: 12.5px;
  color: var(--bf-ink-3);
  line-height: 1.6;
}

.members {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.member {
  display: flex;
  align-items: center;
  gap: 9px;
  border: 1px solid var(--bf-border);
  background: #fff;
  border-radius: 7px;
  padding: 10px;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  min-width: 0;
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
  flex: 1;
  min-width: 0;
}

.name {
  font-size: 13px;
  font-weight: 600;
}

.role-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.role-row .label {
  font-size: 12.5px;
  color: var(--bf-ink-2);
  width: 60px;
}

.enter {
  width: 100%;
}

.quick {
  display: flex;
  justify-content: center;
  gap: 8px;
  font-size: 12px;
  color: var(--bf-ink-3);
}

.sep {
  color: var(--bf-border-strong);
}

@media (max-width: 520px) {
  .members {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
