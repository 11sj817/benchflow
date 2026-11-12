<template>
  <div class="shell">
    <aside class="sidebar" :class="{ collapsed: isCollapsed, open: mobileOpen }">
      <div class="brand">
        <div class="logo">BF</div>
        <div v-if="!isCollapsed" class="brand-text">
          <strong>BenchFlow</strong>
          <span>研发测试协作平台</span>
        </div>
      </div>

      <nav class="nav">
        <div v-for="group in visibleGroups" :key="group.title" class="nav-group">
          <div v-if="!isCollapsed" class="nav-title">{{ group.title }}</div>
          <router-link
            v-for="item in group.items"
            :key="item.to"
            :to="item.to"
            class="nav-item"
            :class="{ active: isActive(item.to) }"
            :title="item.label"
            @click="mobileOpen = false"
          >
            <component :is="item.icon" :size="16" class="nav-icon" />
            <span v-if="!isCollapsed" class="nav-label">{{ item.label }}</span>
            <span v-if="!isCollapsed && badgeCount(item) > 0" class="nav-badge">{{ badgeCount(item) }}</span>
          </router-link>
        </div>
      </nav>

      <div class="sidebar-foot">
        <div class="mode"><span class="mode-dot" /> 本地演示模式</div>
        <div v-if="!isCollapsed" class="rev">数据修订 #{{ db.meta.revision }} · 非云端协同</div>
      </div>
    </aside>

    <div v-if="mobileOpen" class="overlay" @click="mobileOpen = false" />

    <div class="content">
      <header class="bf-topbar">
        <button class="icon-btn" type="button" title="展开 / 收起导航" @click="toggleNav">
          <Menu :size="18" />
        </button>

        <div class="crumb">
          <span class="module">{{ moduleTitle }}</span>
          <ChevronRight :size="13" />
          <span class="current">{{ String(route.meta.title ?? '') }}</span>
        </div>

        <div class="search-wrap">
          <Search :size="15" class="search-icon" />
          <input
            v-model="keyword"
            class="search-input"
            placeholder="搜索项目 / 用例 / 执行 / 缺陷"
            @focus="searchOpen = true"
            @blur="closeSearch"
          />
          <div v-if="searchOpen && keyword.trim()" class="search-panel">
            <div v-if="searchResults.length === 0" class="search-empty">没有匹配结果</div>
            <button
              v-for="row in searchResults"
              :key="row.to + row.label"
              type="button"
              class="search-row"
              @mousedown.prevent="go(row.to)"
            >
              <span class="tag">{{ row.type }}</span>
              <span class="label">{{ row.label }}</span>
              <span class="sub mono">{{ row.sub }}</span>
            </button>
          </div>
        </div>

        <div class="topbar-right">
          <el-dropdown trigger="click" @command="openTerminal">
            <button class="terminal-btn" type="button">
              <MonitorSmartphone :size="15" />
              <span class="hide-sm">终端预览</span>
              <ChevronDown :size="12" />
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="pc">PC Web（当前）</el-dropdown-item>
                <el-dropdown-item command="mobile">移动端演示（新窗口）</el-dropdown-item>
                <el-dropdown-item command="station">平板工位模式（新窗口）</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>

          <el-popover placement="bottom-end" :width="340" trigger="click">
            <template #reference>
              <button class="icon-btn" type="button" title="通知">
                <Bell :size="17" />
                <span v-if="unread > 0" class="dot-badge">{{ unread }}</span>
              </button>
            </template>
            <div class="notice-head">
              <strong>通知</strong>
              <button class="bf-link-btn" type="button" @click="notificationService.markAllRead(app.currentUser.id)">全部已读</button>
            </div>
            <div class="notice-list">
              <button
                v-for="notice in notices"
                :key="notice.id"
                type="button"
                class="notice"
                :class="{ unread: !notice.read }"
                @click="openNotice(notice)"
              >
                <span class="notice-dot" :class="notice.kind" />
                <span class="notice-body">
                  <strong>{{ notice.title }}</strong>
                  <span class="bf-sub">{{ notice.body }}</span>
                  <span class="bf-sub">{{ fromNow(notice.at) }}</span>
                </span>
              </button>
              <div v-if="notices.length === 0" class="bf-empty">暂无通知</div>
            </div>
          </el-popover>

          <el-dropdown trigger="click" @command="onCommand">
            <button class="user-btn" type="button">
              <UserAvatar :name="app.currentUser.name" :color="app.currentUser.color" size="sm" />
              <span class="user-name hide-sm">{{ app.currentUser.name }}</span>
              <StatusPill :label="ROLE_LABEL[app.session.role]" tone="primary" />
              <ChevronDown :size="12" />
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item disabled>{{ app.currentUser.name }} · {{ app.currentUser.email }}</el-dropdown-item>
                <el-dropdown-item command="identity" divided>切换演示身份 / 角色</el-dropdown-item>
                <el-dropdown-item command="sync">本地数据与同步状态</el-dropdown-item>
                <el-dropdown-item command="settings">系统设置</el-dropdown-item>
                <el-dropdown-item command="reset" divided>恢复演示数据</el-dropdown-item>
                <el-dropdown-item command="logout">退出到登录页</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <main class="main">
        <div class="demo-banner">
          <span class="banner-chip">本地演示</span>
          当前为前端 MVP：数据存储于浏览器、跨标签页同步为本地模拟，未接入后端与真实云端协作。
          <button class="bf-link-btn" type="button" @click="syncOpen = true">查看数据状态</button>
        </div>
        <router-view />
      </main>
    </div>

    <IdentityDialog v-model="identityOpen" />
    <SyncInfoDialog v-model="syncOpen" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Bell, ChevronDown, ChevronRight, Menu, MonitorSmartphone, Search } from 'lucide-vue-next'
import { NAV_GROUPS } from '@/router/nav'
import type { NavItem } from '@/router/nav'
import { db } from '@/services/db'
import { notificationService } from '@/services/orgService'
import { useAppStore } from '@/stores/app'
import { useWorkspaceStore } from '@/stores/workspace'
import { ROLE_LABEL } from '@/utils/permission'
import { fromNow } from '@/utils/format'
import UserAvatar from '@/components/common/UserAvatar.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import IdentityDialog from '@/components/dialogs/IdentityDialog.vue'
import SyncInfoDialog from '@/components/dialogs/SyncInfoDialog.vue'

const app = useAppStore()
const workspace = useWorkspaceStore()
const route = useRoute()
const router = useRouter()

const mobileOpen = ref(false)
const identityOpen = ref(false)
const syncOpen = ref(false)
const keyword = ref('')
const searchOpen = ref(false)
const isNarrow = ref(false)

const isCollapsed = computed(() => app.sidebarCollapsed && !isNarrow.value)

const visibleGroups = computed(() =>
  NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => (app.isGuest ? item.guestAllowed : true)),
  })).filter((group) => group.items.length > 0),
)

const moduleTitle = computed(() => {
  const group = NAV_GROUPS.find((g) => g.items.some((i) => route.path.startsWith(i.to)))
  return group?.title ?? 'BenchFlow'
})

const isActive = (to: string) => route.path === to || route.path.startsWith(`${to}/`)

const badgeCount = (item: NavItem): number => {
  if (item.badgeKey === 'defects') return db.defects.filter((d) => d.status !== 'closed').length
  if (item.badgeKey === 'reports') return db.reports.filter((r) => r.status === 'review').length
  if (item.badgeKey === 'devices') return db.devices.filter((d) => d.calibrationDue < new Date().toISOString().slice(0, 10)).length
  return 0
}

const notices = computed(() => notificationService.list(app.currentUser.id).slice(0, 6))
const unread = computed(() => notificationService.unread(app.currentUser.id))

const searchResults = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return [] as { type: string; label: string; sub: string; to: string }[]
  const rows: { type: string; label: string; sub: string; to: string }[] = []
  db.projects
    .filter((p) => `${p.code} ${p.name} ${p.tags.join(' ')}`.toLowerCase().includes(kw))
    .slice(0, 3)
    .forEach((p) => rows.push({ type: '项目', label: p.name, sub: p.code, to: `/projects/${p.id}` }))
  if (!app.isGuest) {
    db.cases
      .filter((c) => `${c.code} ${c.name}`.toLowerCase().includes(kw))
      .slice(0, 3)
      .forEach((c) => rows.push({ type: '用例', label: c.name, sub: c.code, to: `/test-cases/${c.id}/edit` }))
    db.executions
      .filter((e) => `${e.code} ${e.note}`.toLowerCase().includes(kw))
      .slice(0, 3)
      .forEach((e) => rows.push({ type: '执行', label: e.code, sub: e.result, to: `/test-executions/${e.id}` }))
    db.defects
      .filter((d) => `${d.code} ${d.title}`.toLowerCase().includes(kw))
      .slice(0, 3)
      .forEach((d) => rows.push({ type: '缺陷', label: d.title, sub: d.code, to: `/defects/${d.id}` }))
  }
  db.reports
    .filter((r) => `${r.code} ${r.title}`.toLowerCase().includes(kw))
    .slice(0, 3)
    .forEach((r) => rows.push({ type: '报告', label: r.title, sub: r.code, to: `/reports/${r.id}` }))
  return rows.slice(0, 10)
})

const toggleNav = () => {
  if (isNarrow.value) mobileOpen.value = !mobileOpen.value
  else app.toggleSidebar()
}

const closeSearch = () => {
  window.setTimeout(() => {
    searchOpen.value = false
  }, 140)
}

const go = (to: string) => {
  keyword.value = ''
  searchOpen.value = false
  router.push(to)
}

const openNotice = (notice: { id: string; read: boolean; link?: string }) => {
  if (!notice.read) notificationService.markRead(notice.id)
  if (notice.link) router.push(notice.link.replace(/^#/, ''))
}

const openTerminal = (command: string) => {
  if (command === 'mobile') {
    window.open(`${window.location.pathname}#/mobile`, '_blank')
    return
  }
  if (command === 'station') {
    window.open(`${window.location.pathname}#/station`, '_blank')
    return
  }
  ElMessage.info('当前已经是 PC Web 视图')
}

const onCommand = async (command: string) => {
  if (command === 'identity') identityOpen.value = true
  else if (command === 'sync') syncOpen.value = true
  else if (command === 'settings') router.push('/settings')
  else if (command === 'logout') router.push('/login')
  else if (command === 'reset') {
    try {
      await ElMessageBox.confirm('将覆盖本地所有修改并恢复初始演示数据，是否继续？', '恢复演示数据', {
        type: 'warning',
        confirmButtonText: '恢复',
        cancelButtonText: '取消',
      })
      workspace.reset()
      ElMessage.success('已恢复初始演示数据')
    } catch {
      // user cancelled
    }
  }
}

const handleResize = () => {
  isNarrow.value = window.innerWidth < 960
  if (!isNarrow.value) mobileOpen.value = false
}

onMounted(() => {
  handleResize()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => window.removeEventListener('resize', handleResize))
</script>

<style scoped>
.shell {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.sidebar {
  width: var(--bf-sidebar-w);
  flex: none;
  background: var(--bf-sidebar-bg);
  color: var(--bf-sidebar-ink);
  display: flex;
  flex-direction: column;
  transition: width 0.16s ease;
  z-index: 60;
}

.sidebar.collapsed {
  width: 62px;
}

.brand {
  height: var(--bf-topbar-h);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 15px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  flex: none;
}

.logo {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: #1f6f8b;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
}

.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
  min-width: 0;
}

.brand-text strong {
  font-size: 14px;
  color: #fff;
  letter-spacing: 0.01em;
}

.brand-text span {
  font-size: 10px;
  color: #7d90a6;
}

.nav {
  flex: 1;
  overflow-y: auto;
  padding: 6px 8px 12px;
}

.nav-group {
  margin-bottom: 4px;
}

.nav-title {
  font-size: 10px;
  letter-spacing: 0.1em;
  color: #6b8098;
  padding: 13px 10px 5px;
  text-transform: uppercase;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-radius: 5px;
  color: var(--bf-sidebar-ink);
  font-size: 12.8px;
  margin-bottom: 1px;
  position: relative;
  text-decoration: none;
}

.nav-item:hover {
  background: var(--bf-sidebar-bg-2);
  color: var(--bf-sidebar-ink-strong);
  text-decoration: none;
}

.nav-item.active {
  background: #22374d;
  color: #fff;
}

.nav-item.active::before {
  content: '';
  position: absolute;
  left: -8px;
  top: 7px;
  bottom: 7px;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background: #46a58c;
}

.sidebar.collapsed .nav-item {
  justify-content: center;
  padding: 9px 0;
}

.nav-icon {
  flex: none;
  opacity: 0.9;
}

.nav-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nav-badge {
  margin-left: auto;
  background: #a9332a;
  color: #fff;
  font-size: 10px;
  min-width: 16px;
  height: 16px;
  line-height: 16px;
  border-radius: 8px;
  text-align: center;
  padding: 0 4px;
}

.sidebar-foot {
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  padding: 10px 14px 12px;
  font-size: 10.5px;
  flex: none;
}

.mode {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #b9c8d8;
}

.mode-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #d9a441;
  flex: none;
}

.rev {
  color: #6e8298;
  margin-top: 3px;
  font-family: var(--bf-mono);
  font-size: 9.5px;
}

.content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.bf-topbar {
  height: var(--bf-topbar-h);
  flex: none;
  background: var(--bf-surface);
  border-bottom: 1px solid var(--bf-border);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  position: relative;
  z-index: 30;
}

.icon-btn {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 5px;
  color: var(--bf-ink-2);
  cursor: pointer;
  position: relative;
  flex: none;
}

.icon-btn:hover {
  background: var(--bf-surface-3);
  color: var(--bf-ink);
}

.crumb {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--bf-ink-3);
  white-space: nowrap;
}

.crumb .current {
  color: var(--bf-ink);
  font-weight: 600;
  font-size: 12.5px;
}

.search-wrap {
  position: relative;
  margin-left: auto;
  width: 300px;
  max-width: 32vw;
}

.search-icon {
  position: absolute;
  left: 9px;
  top: 8px;
  color: var(--bf-ink-3);
}

.search-input {
  width: 100%;
  height: 30px;
  border: 1px solid var(--bf-border);
  background: var(--bf-surface-2);
  border-radius: 5px;
  padding: 0 10px 0 29px;
  font-size: 12.5px;
  color: var(--bf-ink);
  outline: none;
  font-family: inherit;
}

.search-input:focus {
  border-color: #9db3cc;
  background: #fff;
}

.search-panel {
  position: absolute;
  top: 35px;
  left: 0;
  right: 0;
  background: #fff;
  border: 1px solid var(--bf-border);
  border-radius: 6px;
  box-shadow: var(--bf-shadow-md);
  padding: 5px;
  z-index: 40;
  max-height: 340px;
  overflow-y: auto;
}

.search-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  border: none;
  background: transparent;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
}

.search-row:hover {
  background: var(--bf-surface-2);
}

.search-row .tag {
  font-size: 10.5px;
  color: var(--bf-ink-3);
  background: var(--bf-surface-3);
  border-radius: 3px;
  padding: 0 5px;
  flex: none;
}

.search-row .label {
  flex: 1;
  font-size: 12.5px;
  color: var(--bf-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-row .sub {
  font-size: 10.5px;
  color: var(--bf-ink-3);
}

.search-empty {
  padding: 14px;
  text-align: center;
  color: var(--bf-ink-3);
  font-size: 12px;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: none;
}

.terminal-btn,
.user-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 8px;
  border: 1px solid var(--bf-border);
  background: #fff;
  border-radius: 5px;
  font-size: 12px;
  color: var(--bf-ink-2);
  cursor: pointer;
  font-family: inherit;
}

.terminal-btn:hover,
.user-btn:hover {
  border-color: var(--bf-border-strong);
  background: var(--bf-surface-2);
}

.user-name {
  font-size: 12px;
  color: var(--bf-ink);
}

.dot-badge {
  position: absolute;
  top: 1px;
  right: 0;
  background: #b02a1f;
  color: #fff;
  font-size: 9px;
  border-radius: 8px;
  min-width: 14px;
  height: 14px;
  line-height: 14px;
  text-align: center;
  padding: 0 3px;
}

.notice-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--bf-border);
  font-size: 12.5px;
}

.notice-list {
  max-height: 360px;
  overflow-y: auto;
}

.notice {
  display: flex;
  gap: 8px;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  padding: 9px 4px;
  border-bottom: 1px solid var(--bf-border);
  cursor: pointer;
  font-family: inherit;
}

.notice:hover {
  background: var(--bf-surface-2);
}

.notice-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-top: 5px;
  flex: none;
  background: var(--bf-ink-3);
}

.notice-dot.warning {
  background: #d9a441;
}

.notice-dot.danger {
  background: #b02a1f;
}

.notice-dot.success {
  background: #157a5b;
}

.notice-dot.info {
  background: #1f6f8b;
}

.notice-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.notice-body strong {
  font-size: 12px;
  color: var(--bf-ink);
}

.notice.unread .notice-body strong {
  font-weight: 650;
}

.main {
  flex: 1;
  overflow-y: auto;
  background: var(--bf-bg);
  min-width: 0;
}

.demo-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  background: #fdf8ec;
  border-bottom: 1px solid #f0e2c6;
  color: #7a5311;
  font-size: 11.5px;
  padding: 6px 24px;
}

.banner-chip {
  background: #b7791f;
  color: #fff;
  border-radius: 3px;
  padding: 0 5px;
  font-size: 10px;
  line-height: 16px;
}

.overlay {
  position: fixed;
  inset: 0;
  background: rgba(10, 18, 28, 0.45);
  z-index: 55;
}

@media (max-width: 1100px) {
  .search-wrap {
    max-width: 220px;
  }
}

@media (max-width: 960px) {
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    transform: translateX(-100%);
    transition: transform 0.18s ease;
  }

  .sidebar.open {
    transform: none;
    box-shadow: 0 0 24px rgba(0, 0, 0, 0.3);
  }

  .sidebar.collapsed {
    width: var(--bf-sidebar-w);
  }

  .crumb .module {
    display: none;
  }

  .search-wrap {
    display: none;
  }

  .demo-banner {
    padding: 6px 14px;
  }

  .hide-sm {
    display: none;
  }
}
</style>
