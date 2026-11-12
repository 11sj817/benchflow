import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { db, initSync, loadDb, resetDb, storageUsage } from '@/services/db'
import { useAppStore } from './app'

/**
 * 工作空间状态：修订号 / 多标签页同步时间 / 存储用量。
 * 明确：这是“本地演示模式”的跨标签页同步，不是云端多人协同。
 */
export const useWorkspaceStore = defineStore('workspace', () => {
  const lastRemoteSync = ref<string | null>(null)
  const syncState = ref<'local' | 'synced'>('local')
  const remoteEventCount = ref(0)
  let dispose: (() => void) | null = null

  const revision = computed(() => db.meta.revision)
  const usage = computed(() => storageUsage())
  const counts = computed(() => ({
    projects: db.projects.length,
    executions: db.executions.length,
    defects: db.defects.length,
    cases: db.cases.length,
  }))

  function init(): void {
    loadDb()
    if (typeof window === 'undefined') return
    dispose?.()
    dispose = initSync(() => {
      lastRemoteSync.value = new Date().toISOString()
      remoteEventCount.value += 1
      syncState.value = 'synced'
      const app = useAppStore()
      const member = db.members.find((m) => m.id === app.session.userId)
      if (member) {
        // 远端数据更新后保持当前会话身份
        app.setUser(member.id)
      }
    })
  }

  function reset(): void {
    const app = useAppStore()
    resetDb({ id: app.currentUser.id, name: app.currentUser.name })
    app.setUser(app.currentUser.id)
  }

  function refreshUsage(): void {
    void storageUsage()
  }

  function disposeSync(): void {
    dispose?.()
    dispose = null
  }

  return {
    lastRemoteSync,
    syncState,
    remoteEventCount,
    revision,
    usage,
    counts,
    init,
    reset,
    refreshUsage,
    disposeSync,
  }
})
