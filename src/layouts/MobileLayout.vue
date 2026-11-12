<template>
  <div class="mobile-shell">
    <div class="phone">
      <header class="m-top">
        <div class="m-brand">
          <span class="m-logo">BF</span>
          <div>
            <strong>BenchFlow</strong>
            <span>移动端演示</span>
          </div>
        </div>
        <router-link class="pc-link" to="/dashboard">PC 版</router-link>
      </header>

      <div class="m-body">
        <router-view />
      </div>

      <nav class="m-tabbar">
        <router-link
          v-for="tab in tabs"
          :key="tab.to"
          :to="tab.to"
          class="m-tab"
          :class="{ active: route.path === tab.to, primary: tab.primary }"
        >
          <span class="tab-icon" :class="{ bump: tab.primary }">
            <component :is="tab.icon" :size="tab.primary ? 22 : 19" />
          </span>
          <span class="tab-label">{{ tab.label }}</span>
        </router-link>
      </nav>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { Bell, ClipboardList, FolderKanban, Home, Plus } from 'lucide-vue-next'

const route = useRoute()

const tabs = [
  { label: '工作台', to: '/mobile/home', icon: Home },
  { label: '任务', to: '/mobile/tasks', icon: ClipboardList },
  { label: '记录', to: '/mobile/record', icon: Plus, primary: true },
  { label: '消息', to: '/mobile/messages', icon: Bell },
  { label: '项目', to: '/mobile/projects', icon: FolderKanban },
]
</script>

<style scoped>
.mobile-shell {
  min-height: 100vh;
  background: #dfe5ec;
  display: flex;
  justify-content: center;
  overflow-x: hidden;
}

.phone {
  width: 100%;
  max-width: 460px;
  min-width: 0;
  min-height: 100vh;
  background: #f3f5f8;
  display: flex;
  flex-direction: column;
  box-shadow: 0 0 40px rgba(20, 32, 46, 0.12);
  position: relative;
}

.m-top {
  height: 52px;
  background: #14202e;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  position: sticky;
  top: 0;
  z-index: 20;
}

.m-brand {
  display: flex;
  align-items: center;
  gap: 9px;
}

.m-logo {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: #1f6f8b;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
}

.m-brand div {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.m-brand strong {
  font-size: 13px;
}

.m-brand span {
  font-size: 9.5px;
  color: #8fa3b8;
}

.pc-link {
  color: #b9c9d9;
  font-size: 11.5px;
  border: 1px solid #2b4056;
  border-radius: 20px;
  padding: 2px 9px;
}

.m-body {
  flex: 1;
  padding: 12px 12px 76px;
  min-width: 0;
}

.m-tabbar {
  position: fixed;
  bottom: 0;
  width: 100%;
  max-width: 460px;
  background: #fff;
  border-top: 1px solid var(--bf-border);
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  padding: 6px 0 max(6px, env(safe-area-inset-bottom));
  z-index: 30;
}

.m-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  color: #7b8b9e;
  font-size: 10px;
  text-decoration: none;
  position: relative;
}

.m-tab.active {
  color: var(--bf-primary);
  font-weight: 600;
}

.tab-icon {
  display: inline-flex;
  width: 30px;
  height: 26px;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
}

.m-tab.active .tab-icon {
  background: var(--bf-primary-soft);
}

.tab-icon.bump {
  width: 42px;
  height: 42px;
  margin-top: -18px;
  border-radius: 50%;
  background: var(--bf-primary);
  color: #fff;
  box-shadow: 0 4px 12px rgba(30, 58, 95, 0.28);
}

.m-tab.active .tab-icon.bump {
  background: var(--bf-primary-600);
  color: #fff;
}

.tab-label {
  line-height: 1;
}

@media (min-width: 900px) {
  .m-tabbar {
    max-width: 460px;
  }
}

@media (max-width: 480px) {
  .phone {
    max-width: 100%;
  }

  .m-tabbar {
    max-width: 100%;
  }
}
</style>
