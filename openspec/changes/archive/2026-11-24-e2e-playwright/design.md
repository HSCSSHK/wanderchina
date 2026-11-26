# Design: e2e-playwright

## Context

P0 页面已完成，前端有 7 个 Vitest 文件（33 个用例）、后端 10 个集成测试，但都止步于组件/服务边界。用户要求进入 Playwright 浏览器级验收，且明确种子数据必须复用既有 Flyway，禁止手工插数。

已确认事实：

- 后端基座：Spring Boot 3.3.5 + Flyway（schema-only `V1__create_attractions_tables.sql`），`application.yml` 的 `spring.flyway.locations=classpath:db/migration`，默认 profile 为 `dev`。
- dev 库 `wanderchina_dev` 有 6 条手工注入景点（固定 ID `2000000000000000001`～`...006`，5 条 featured），但不在迁移里，不可作为验收基线。
- 前端 dev 端口 5173，`/api` 固定代理到 8080；页面已有稳定 `data-testid`（`hero`、`cta-spots`、`spot-card`、`spot-card-link`、`featured-toggle`、`pagination`、`spot-detail`、`detail-not-found`、`detail-error`、`detail-retry`、`opening-hour-row` 等）。
- Vitest 默认匹配 `**/*.{test,spec}.?(c|m)[jt]s?(x)`；E2E 文件若命名为 `*.spec.ts` 会被 `npm test` 误收。
- 本机 MySQL 5.7.25，`ON DUPLICATE KEY UPDATE ... VALUES(col)` 可用；V1 使用 `utf8mb4_general_ci`。

## Goals / Non-Goals

**Goals**

- 一条命令启动隔离全栈并跑完 6 条金路径，结果可重复。
- 种子数据由 Flyway repeatable 迁移管理，幂等、固定 ID、仅 e2e 生效。
- 与 dev 栈零耦合：独立端口、独立库、独立代理目标。
- 失败可诊断（trace/截图/HTML 报告），产物不入库。
- 不修改页面结构，复用现有 `data-testid`。

**Non-Goals**

- 分页、空态、AI 占位页的 E2E；跨浏览器矩阵；视觉回归；CI 平台接入。
- 为测试新增页面钩子或暴露内部状态。
- 用 mock 正常数据流替代真实后端。

## Decisions

### D1: 独立 E2E 栈拓扑

```text
+--------------------------------------------------------------+
| Playwright (baseURL http://localhost:5174)                   |
+----------------------------+---------------------------------+
                             | 浏览器请求
                             v
+--------------------------------------------------------------+
| Vite dev :5174   /api --> http://localhost:8081              |
+----------------------------+---------------------------------+
                             v
+--------------------------------------------------------------+
| Spring Boot :8081  profile=e2e                               |
|   /api/spots, /api/spots/{id}                                |
+----------------------------+---------------------------------+
                             v
+--------------------------------------------------------------+
| MySQL: wanderchina_e2e (V1 schema + R__e2e_seed)             |
+--------------------------------------------------------------+
```

- 端口固定 8081/5174，`reuseExistingServer: false`，前端启动带 `--strictPort`；冲突即失败。
- 代理目标参数化：`vite.config.ts` 中 `target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:8080'`，dev 行为不变。
- 后端端口写在 `application-e2e.yml`（`server.port: 8081`），不依赖外部 shell 参数。

### D2: Flyway repeatable 种子（用户已拍板）

新增 `backend/src/main/resources/db/e2e/R__e2e_seed.sql`：

- **为什么用 `R__` 而不是 `V900__`**：repeatable 迁移在 checksum 变化时自动重跑，适合可丢弃的 e2e 夹具；版本号不会挤占正式迁移序列。
- **幂等**：所有写入用 `INSERT ... ON DUPLICATE KEY UPDATE`（主键固定），重复启动不产生重复行；不改动 dev/prod 的 locations。
- **配置**：`application-e2e.yml` 设置 `spring.flyway.locations=classpath:db/migration,classpath:db/e2e`。`V1` 先建表，`R__` 再灌数。
- **可丢弃**：`wanderchina_e2e` 允许随时 `DROP DATABASE` 重建；`createDatabaseIfNotExist=true` 已覆盖首次创建。
- **两条约束**：`geo_city` 必须先于 `scenic_spot`；`spot_opening_hour` 必须最后。所有行显式写 `created_at`/`updated_at`（`DATETIME(3)` 非空），列表依赖 `created_at DESC` 的稳定排序。

种子契约（固定值，用例直接断言）：

| id | slug | name_en | city | category | ticket | duration | featured |
|---|---|---|---|---|---|---|---|
| ...0001 | forbidden-city | Forbidden City | Beijing | historic | 60.00 CNY | 180 | 是 |
| ...0002 | badaling-great-wall | Badaling Great Wall | Beijing | historic | 40.00 CNY | 240 | 是 |
| ...0003 | terracotta-army | Terracotta Army | Xi'an | museum | 120.00 CNY | 150 | 是 |
| ...0004 | the-bund | The Bund | Shanghai | viewpoint | 0.00 CNY | 60 | 是 |
| ...0005 | oriental-pearl-tower | Oriental Pearl Tower | Shanghai | viewpoint | 199.00 CNY | 90 | 否 |
| ...0006 | chengdu-panda-base | Giant Panda Breeding Research Base | Chengdu | natural | 58.00 CNY | 180 | 是 |

城市 ID：北京 `1000000000000000001`、西安 `...002`、上海 `...003`、成都 `...004`。Forbidden City 开放时间 7 行：周一 `closed=1`，周二至周日 `08:30:00`–`17:00:00`。

### D3: Playwright 配置与 webServer 编排

`frontend/playwright.config.ts`：

```ts
testDir: './e2e',
testMatch: '**/*.e2e.ts',            // 避开 Vitest 的 *.spec.ts 匹配
fullyParallel: true,
retries: process.env.CI ? 2 : 0,
reporter: [['list'], ['html', { open: 'never' }]],
use: {
  baseURL: 'http://localhost:5174',
  trace: 'on-first-retry',
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
},
projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }],
webServer: [
  {
    command: 'mvn -f backend/pom.xml spring-boot:run -Dspring-boot.run.profiles=e2e',
    cwd: '..',
    url: 'http://localhost:8081/api/spots',
    timeout: 180_000,
    reuseExistingServer: false,
  },
  {
    command: 'npm run dev -- --port 5174 --strictPort',
    url: 'http://localhost:5174',
    timeout: 60_000,
    reuseExistingServer: false,
    env: { VITE_PROXY_TARGET: 'http://localhost:8081' },
  },
],
```

- 后端启动约 10–25s（Flyway + JPA），180s 超时留足余量。
- 等待条件用 API 200 判断，避免前端先就绪、后端未起时的竞态。
- `cwd: '..'` 让 Maven 从仓库根执行，与现有 `mvn -f backend/pom.xml` 约定一致。

### D4: 选择器与稳定性策略

- 一律 `page.getByTestId(...)`；卡片定位用 `filter({ hasText: 'Forbidden City' })`，不依赖索引。
- 所有断言用 web-first（`expect(locator).toBeVisible()` / `toHaveURL` / `toHaveCount`），禁止 `waitForTimeout`。
- `Featured` 数量用 `getByTestId('spot-card')` 计数 + 文本断言。
- 详情开放时间行数用 `getByTestId('opening-hour-row')`，并在该行内断言 `Closed` / `08:30-17:00`，避免跨行误配。
- 列表排序为 `featured DESC, created_at DESC`，种子 `created_at` 交错设置，测试仍以文本而非顺序断言。

### D5: 故障注入（仅错误分支）

- 列表错误：`page.route('**/api/spots?**', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 500, message: 'boom', data: null }) }))`。
- 详情错误：匹配 `**/api/spots/2000000000000000001`。
- 断言错误态后 `page.unroute(...)`，点击 `Retry`，等待成功态。
- 注意 Vite 代理下浏览器请求 URL 仍是 `http://localhost:5174/api/...`，route 模式按路径匹配即可。
- 只在错误态用例使用，正常数据流保持真实后端。

### D6: 产物与脚本

`package.json`：

```json
"test:e2e": "playwright test",
"test:e2e:headed": "playwright test --headed",
"test:e2e:report": "playwright show-report"
```

`.gitignore` 追加：`test-results/`、`playwright-report/`、`blob-report/`、`playwright/.cache/`。

## Test Plan

### RED（先于 E2E 运行时）

1. 安装 `@playwright/test` 与 Chromium（工具链前置，不改变产品行为）。
2. 写 `playwright.config.ts`、`e2e/*.e2e.ts`（6 条用例按 spec 断言编写）、scripts、`.gitignore`。
3. 在 `application-e2e.yml` 与种子尚未落地时执行 `npm run test:e2e`：e2e 后端缺少 datasource/profile 会启动失败，Playwright 报 webServer 退出 → **RED**（证明用例确实依赖 e2e 栈，而不是 mock）。

### GREEN

4. 加 `application-e2e.yml`（8081 + `wanderchina_e2e` + 扩展 Flyway locations）。
5. 加 `R__e2e_seed.sql`，启动后端确认 `GET /api/spots` 返回 6 条、详情返回 Forbidden City 完整事实与 7 条开放时间。
6. 改 `vite.config.ts` 代理目标参数化，跑 `npm run test:e2e` 转 GREEN；逐条修复真实渲染断言（尤其 `Intl` 货币符号与 Element Plus 文本）。

### 回归门禁

7. `npm test`（33 用例）、`mvn test`（10 用例）、`npm run build`、`npm run test:e2e` 四绿。
8. 合规：dev/prod Flyway locations 未变；`wanderchina_dev` 未被写入；无固定 sleep；无页面结构改动；E2E 文件未被 Vitest 收集。

## Migration Plan

无表结构迁移。运行顺序：工具链 → 用例 RED → e2e profile/种子 → 代理参数化 → 六条 GREEN → 四门禁 → 用户侧归档。`wanderchina_e2e` 首次启动自动创建，可随时删除重建。

## Risks / Trade-offs

- **R1 Windows webServer 启动**：Playwright 通过 shell 启动 `mvn`（`.cmd`）与 `npm`，需确认命令行不含 `&&`；已拆为两个 webServer 条目。若失败，退路是提供 `e2e/start-backend.ps1` 并被 webServer 调用，不改变端口/库隔离。
- **R2 种子与 V1 约束**：`created_at`/`updated_at` 非空、城市先于景点、开放时间最后；upsert 对 MySQL 5.7 使用 `VALUES(col)`。
- **R3 Flyway repeatable 时机**：`R__` 在版本化迁移之后执行；若种子 checksum 改变会自动重跑，依赖 upsert 保持幂等；若行被手工删除不会自动补回（e2e 库可重建，接受）。
- **R4 货币格式**：`Intl.NumberFormat('en-US', { style:'currency', currency:'CNY' })` 输出 `CN¥60.00`，用例只断言 `60.00` 以避免 Node/浏览器差异。
- **R5 Element Plus 动画**：使用 web-first 断言自动重试，不注入全局禁用动画样式，避免为测试改生产样式。
- **R6 端口冲突**：8081/5174 必须干净；`reuseExistingServer: false` + `strictPort` 保证失败可见，不静默串库。
- **R7 测试文件被 Vitest 收集**：用 `*.e2e.ts` + `testMatch` 隔离；若改回 `*.spec.ts` 必须在 Vitest 侧 exclude。
- **R8 排序不稳定**：dev 夹具 `created_at` 全相同；e2e 种子显式交错时间，用例仍按文本定位。

## Open Questions

无。用户已确认：复用 Flyway，种子以 `R__e2e_seed.sql` 管理，禁止手工插数。
