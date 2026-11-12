import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type { PermissionAction, RoleKey, Session } from '@/types'
import { db, loadDb } from '@/services/db'
import { setActor } from '@/services/actor'
import { can as permissionCan } from '@/utils/permission'
import { SESSION_KEY } from '@/mock/seed'

function loadSession(): Session {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Session
      if (parsed?.userId && parsed?.role) return parsed
    }
  } catch {
    // ignore corrupted session
  }
  return { userId: 'M-002', role: 'test_lead', mode: 'demo' }
}

export const useAppStore = defineStore('app', () => {
  const session = ref<Session>(loadSession())
  const sidebarCollapsed = ref(false)
  const compactMode = ref(localStorage.getItem('benchflow.compact') === '1')
  const bootstrapped = ref(false)
  const lastReadNotice = ref<string | null>(null)

  const currentUser = computed(() => db.members.find((m) => m.id === session.value.userId) ?? db.members[0])
  const role = computed<RoleKey>(() => session.value.role)
  const isGuest = computed(() => role.value === 'guest')
  const can = (action: PermissionAction) => permissionCan(role.value, action)
  const demoMode = true

  const visibleProjects = computed(() => {
    if (role.value !== 'guest') return db.projects
    const today = new Date().toISOString().slice(0, 10)
    const sharedIds = db.shares
      .filter((s) => s.status === 'active' && s.expiresAt >= today)
      .map((s) => s.projectId)
    return db.projects.filter((p) => sharedIds.includes(p.id))
  })

  const visibleProjectIds = computed(() => visibleProjects.value.map((p) => p.id))

  function persistSession(): void {
    session.value = { ...session.value, mode: 'demo' }
    localStorage.setItem(SESSION_KEY, JSON.stringify(session.value))
  }

  function setUser(userId: string): void {
    const member = db.members.find((m) => m.id === userId)
    if (!member) return
    session.value = { userId: member.id, role: member.role, mode: 'demo' }
    setActor(member)
    persistSession()
  }

  function setRole(next: RoleKey): void {
    session.value = { ...session.value, role: next }
    persistSession()
  }

  function toggleSidebar(): void {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  function setCompact(value: boolean): void {
    compactMode.value = value
    localStorage.setItem('benchflow.compact', value ? '1' : '0')
    document.documentElement.classList.toggle('compact', value)
  }

  function bootstrap(): void {
    loadDb()
    const member = db.members.find((m) => m.id === session.value.userId) ?? db.members[0]
    setActor(member)
    document.documentElement.classList.toggle('compact', compactMode.value)
    bootstrapped.value = true
  }

  watch(
    () => db.members.map((m) => `${m.id}:${m.role}`).join('|'),
    () => {
      if (!bootstrapped.value) return
      if (session.value.role !== currentUser.value?.role) {
        // 成员角色被管理员修改时，跟随更新会话角色
        session.value = { ...session.value, role: currentUser.value.role }
        persistSession()
      }
    },
  )

  return {
    session,
    role,
    currentUser,
    isGuest,
    can,
    demoMode,
    sidebarCollapsed,
    compactMode,
    visibleProjects,
    visibleProjectIds,
    setUser,
    setRole,
    toggleSidebar,
    setCompact,
    bootstrap,
    lastReadNotice,
  }
})
