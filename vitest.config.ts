import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

// 单元测试只覆盖纯 TypeScript 模块（工具、服务、数据模型），不挂载 .vue 组件，
// 因此无需 Vue 插件，也避免 vitest 内置 vite 与项目 vite 版本的类型冲突。
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    reporters: ['default'],
  },
})
