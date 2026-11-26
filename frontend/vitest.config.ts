import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

// 前端测试栈：Vitest + jsdom（审查决策 1 / design D6）。
export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
