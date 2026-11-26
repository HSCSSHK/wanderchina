# Tasks: e2e-playwright

## 1. 准备与基线

- [x] 1.1 确认 8081/5174 空闲、`wanderchina_e2e` 不存在或可重建；复核现有 `data-testid` 与 V1 表结构
- [x] 1.2 记录基线：`npm test`、`mvn test`、`npm run build` 当前全绿

## 2. E2E 工具链与 RED

- [x] 2.1 安装 `npm i -D @playwright/test` 与 `npx playwright install chromium`
- [x] 2.2 新增 `frontend/playwright.config.ts`：testDir `./e2e`、`testMatch "**/*.e2e.ts"`、两个 webServer（8081 后端 e2e profile、5174 前端 strictPort）、trace/截图、chromium 单 project
- [x] 2.3 `package.json` 增加 `test:e2e` / `test:e2e:headed` / `test:e2e:report`；`.gitignore` 追加 `test-results/`、`playwright-report/`、`blob-report/`、`playwright/.cache/`
- [x] 2.4 编写 6 条用例：`e2e/home.e2e.ts`、`e2e/attractions-browse.e2e.ts`、`e2e/attraction-deep-link.e2e.ts`、`e2e/attractions-featured.e2e.ts`、`e2e/attraction-not-found.e2e.ts`、`e2e/resilience.e2e.ts`，断言按 spec
- [x] 2.5 运行 `npm run test:e2e`，在 e2e profile/种子缺失下观察 RED（webServer 启动失败或接口不可用），记录失败证据

## 3. 后端 E2E 环境（GREEN 前半）

- [x] 3.1 新增 `backend/src/main/resources/application-e2e.yml`：`server.port: 8081`、`wanderchina_e2e`、`spring.flyway.locations=classpath:db/migration,classpath:db/e2e`
- [x] 3.2 新增 `backend/src/main/resources/db/e2e/R__e2e_seed.sql`：固定 4 城市 → 6 景点（5 featured）→ 开放时间；全部 `INSERT ... ON DUPLICATE KEY UPDATE`，显式 `created_at`/`updated_at`
- [x] 3.3 以 e2e profile 启动后端，确认 `GET /api/spots` 6 条、`GET /api/spots/2000000000000000001` 含 `Beijing`/`60.00`/7 条开放时间；重启一次验证幂等（仍 6 条）
- [x] 3.4 确认 dev/prod 的 Flyway locations 未变，`wanderchina_dev` 无新增行

## 4. 前端代理参数化（GREEN 后半）

- [x] 4.1 `vite.config.ts` 将代理 target 改为 `process.env.VITE_PROXY_TARGET ?? 'http://localhost:8080'`
- [x] 4.2 确认 `npm run dev`（无环境变量）仍代理 8080，dev 行为不回归

## 5. 六条用例转 GREEN

- [x] 5.1 首页入口：`/` Hero 可见 → 点击 `Explore Attractions` → `/spots` 卡片可见
- [x] 5.2 浏览闭环：点击 `Forbidden City` → URL/事实卡断言（名称、故宫、Beijing、Historic、60.00、3 hr、交通、7 行开放时间、Mon Closed、Tue 08:30-17:00）→ Back 回列表
- [x] 5.3 深链与历史：直达 Badaling 详情 → 刷新仍完整 → 浏览器后退回列表
- [x] 5.4 热门筛选：Off→On 后 5 条且 `Oriental Pearl Tower` 消失、均含 Featured；再切回 6 条
- [x] 5.5 未找到：`/spots/99999999999` 与 `/spots/not-a-number` 均显示未找到、无 Retry、返回链接可用
- [x] 5.6 错误与重试：列表与详情分别注入 500 → 错误态 → 解除后 Retry 恢复
- [x] 5.7 `npm run test:e2e` 全绿，失败产物路径正确

## 6. 回归与合规

- [x] 6.1 `npm test` 全绿（33 用例，E2E 文件未被 Vitest 收集）
- [x] 6.2 `mvn test` 全绿（10 用例）
- [x] 6.3 `npm run build` 通过（vue-tsc + vite build）
- [x] 6.4 合规：无页面结构改动、无新增生产 `data-testid`、无固定 sleep、仅错误态使用 route 拦截、种子仅 e2e profile 生效
- [ ] 6.5 归档（用户 CLI）：`openspec archive e2e-playwright`
