# Playwright E2E 自动验收 (e2e-playwright)

## Why

P0 三个页面（首页 `/`、列表 `/spots`、详情 `/spots/:id`）已完成，但现有验收只有两层：Vitest 组件测试（API 全部 mock）与手工点击。组件测试无法证明「真实浏览器 + 真实 Spring Boot + 真实 MySQL」链路上的关键行为：`/spots/:id` 的 history 深链与刷新、列表卡片跳转、后端 JOIN 投影、Axios 404 转换、Element Plus 真实渲染。

进入自动化验收阶段后，需要一条命令即可重复执行的浏览器级验收，并以此取代此前预留的手工验收项（原 `attractions-detail` tasks 5.5）。

## What Changes

- **测试基建**：引入 `@playwright/test`，新增 `frontend/playwright.config.ts`、`e2e/` 用例目录与 npm scripts；失败产物（trace/截图/报告）不入库。
- **隔离运行栈**：E2E 后端使用 `e2e` profile、`wanderchina_e2e` 库、8081 端口；E2E 前端使用 5174 端口且 `/api` 代理到 8081。dev 栈（8080 + `wanderchina_dev`）不被读写。
- **确定性种子**：复用 Flyway，新增 `classpath:db/e2e/R__e2e_seed.sql`（repeatable + 幂等 upsert），固定 4 城市 / 6 景点 / 开放时间；仅在 e2e profile 加载。
- **六条用例**：首页入口、列表→详情→返回、详情深链/刷新/后退、热门筛选、详情 404、错误态与重试（一次故障注入）。
- **门禁**：`npm run test:e2e` 全绿，且既有 `npm test`、`mvn test`、`npm run build` 不回归。

## Impact

- 前端：`package.json`、`playwright.config.ts`、`e2e/*.e2e.ts`、`vite.config.ts`（代理目标参数化）、`.gitignore`。
- 后端：`application-e2e.yml`、`resources/db/e2e/R__e2e_seed.sql`。无新建表、无 V 版本迁移。
- 数据库：新增可丢弃库 `wanderchina_e2e`（首次启动自动创建），dev/prod 不受影响。
- 页面：不改动任何页面结构，不新增生产测试钩子，只复用现有 `data-testid`。

## Non-Goals

- 分页翻页、空态、AI 占位页的 E2E：分别由 Vitest 与后续 change 覆盖，不为翻页灌入假景点。
- 跨浏览器/移动端矩阵、视觉回归截图对比。
- CI 平台流水线接入（先保证本地一条命令可重复，CI 另开 change）。
- Mock 正常数据流；唯一的网络拦截用于故障注入以验证错误态。
- 性能、可访问性、i18n 专项测试。
