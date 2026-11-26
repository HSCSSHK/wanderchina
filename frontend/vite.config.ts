import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      // 开发期跨域由 proxy 解决，/api -> Spring Boot 8080（design D5）。
      // E2E 通过 VITE_PROXY_TARGET 指向隔离后端 8081，dev 默认行为不变。
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
