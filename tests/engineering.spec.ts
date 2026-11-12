import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * 交付物完整性：部署工作流与文档必须存在。
 * 构建、类型检查、单元测试由 GitHub Actions 分别执行（见 .github/workflows/deploy.yml）。
 */
describe('工程交付物', () => {
  const requiredFiles = [
    '.github/workflows/deploy.yml',
    'README.md',
    'NEXT_STEPS.md',
    'docs/PRODUCT_REQUIREMENTS.md',
    'docs/ARCHITECTURE.md',
    'docs/DATA_MODEL.md',
    'docs/API_DESIGN.md',
    'docs/UI_DESIGN_SYSTEM.md',
    'docs/TEST_REPORT.md',
    'docs/UX_REDESIGN_2.1.md',
    'docs/DEPLOYMENT.md',
  ]

  it('部署工作流与全部文档存在', () => {
    requiredFiles.forEach((file) => {
      expect(existsSync(resolve(process.cwd(), file)), `${file} 缺失`).toBe(true)
    })
  })

  it('Vite 使用相对 base 与 hash 路由，兼容 GitHub Pages 子路径', () => {
    const viteConfig = readFileSync(resolve(process.cwd(), 'vite.config.ts'), 'utf8')
    expect(viteConfig).toContain("base: './'")
    const router = readFileSync(resolve(process.cwd(), 'src/router/index.ts'), 'utf8')
    expect(router).toContain('createWebHashHistory')
  })
})
