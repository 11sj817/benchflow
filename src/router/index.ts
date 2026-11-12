import { createRouter, createWebHashHistory } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { routes } from './routes'

/**
 * Hash 路由：GitHub Pages 刷新不会 404。
 * 移动端 / 平板工位模式使用独立路由与独立布局，不是 PC 页面的等比缩小。
 */
const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach((to) => {
  const app = useAppStore()
  document.title = `${String(to.meta.title ?? 'BenchFlow')} · BenchFlow`

  const name = String(to.name ?? '')
  if (name === 'login' || name === 'share' || name === 'not-found') return true
  if (name === 'station' || name.startsWith('mobile-')) return true

  if (app.isGuest && !to.meta.guest) {
    return { name: 'dashboard' }
  }
  return true
})

export default router
