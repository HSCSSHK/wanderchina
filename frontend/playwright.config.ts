import { randomUUID } from 'node:crypto'
import { defineConfig, devices } from '@playwright/test'

// E2E 隔离栈：8081 后端（profile=e2e -> wanderchina_e2e）+ 5174 前端。
// 不复用 8080/5173 的 dev 服务；端口冲突直接失败，避免串库。
// JWT 密钥在运行期随机生成并只注入后端进程，不在仓库中留任何字面量。
const e2eJwtSecret = `e2e-${randomUUID()}-${randomUUID()}`
export default defineConfig({
  testDir: './e2e',
  // 用 *.e2e.ts 与 Vitest 的 *.test.ts / *.spec.ts 隔离，npm test 不会误收。
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'mvn -f backend/pom.xml spring-boot:run -Dspring-boot.run.profiles=e2e',
      cwd: '..',
      url: 'http://localhost:8081/api/spots',
      timeout: 180_000,
      reuseExistingServer: false,
      env: { JWT_SECRET: e2eJwtSecret },
    },
    {
      command: 'npm run dev -- --port 5174 --strictPort',
      url: 'http://localhost:5174',
      timeout: 60_000,
      reuseExistingServer: false,
      env: { VITE_PROXY_TARGET: 'http://localhost:8081' },
    },
  ],
})
