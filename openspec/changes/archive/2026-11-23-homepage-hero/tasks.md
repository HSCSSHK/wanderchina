# Tasks: homepage-hero

> 严格 RED → GREEN → REFACTOR：每个实现步骤前先有失败测试。验收一律用可执行命令（Vitest / vue-tsc build），不保留"打开浏览器看"式人工门禁。本 change 纯前端，不碰后端接口、不碰 SSR/预渲染。

## 1. 路由依赖与外壳

- [x] 1.1 `cd frontend && npm install vue-router@^4`，确认与 Vite 8 / Vue 3.5 可安装、`npm run build`（vue-tsc + vite build）通过。
- [x] 1.2 建 `src/router/index.ts`：`createWebHistory`，路由 `/`→`HomePage`、`/spots`→`Placeholder`(props title="Attractions Guide")、`/ai`→`Placeholder`(props title="AI Travel Assistant")、`/hello`→`HelloView`。`main.ts` 追加 `.use(router)`。
- [x] 1.3 建 `src/views/HelloView.vue`（仅内嵌现有 `<HelloCard />`，不改 HelloCard 组件与其测试）；`App.vue` 由 `<HelloCard />` 改为 `<router-view />`。验收（自动）：`cd frontend && npm test` 中**原 `HelloCard.test.ts` 4 用例仍全绿**（回归门，防 frontend-client 回退）。

## 2. Hero 组件（TDD）

- [x] 2.1 **RED（Hero 渲染）**：写 `src/components/home/HeroSection.test.ts`，用真实 `createRouter({ history: createMemoryHistory(), routes })` 注入 `global.plugins`。断言：① 存在 `data-testid="hero"` 根；② `hero-title`/`hero-subtitle` 文本非空；③ 存在 `cta-spots`、`cta-ai` 两个入口。运行 → 失败（组件不存在）。
- [x] 2.2 **GREEN**：建 `src/components/home/HeroSection.vue`（`<script setup lang="ts">`；根 `<section class="hero">` 背景渐变/占位图；`h1`/`p` 文案来自集中 `copy` 常量；两个 `<router-link :to>` 包 `<el-button>`，带上述 `data-testid`）+ `src/views/HomePage.vue` 组装 `<HeroSection/>`；`SCSS scoped`。跑 2.1 → 通过。
- [x] 2.3 **RED（导航可达）**：在 `HeroSection.test.ts` 补：点击 `cta-spots` → `router.currentRoute.value.path === '/spots'`；点击 `cta-ai` → `'/ai'`。运行 → 失败/待实现。
- [x] 2.4 **GREEN**：完善路由跳转（router-link 生效）。建 `src/views/Placeholder.vue`（`el-empty` + `title` prop 渲染）并接入两条路由。跑 2.3 → 通过。
- [x] 2.5 **RED+GREEN（占位页文案）**：写 `Placeholder.test.ts`——传入 `title` → 渲染含该标题文案；实现至通过。

## 3. 无数据依赖与合规约束

- [x] 3.1 **RED（零网络门）**：`HeroSection.test.ts` 补断言——以 `vi.spyOn` 监视 axios 实例/`global.fetch`，挂载 + 点击两个 CTA 全流程调用次数 `=== 0`。
- [x] 3.2 **GREEN/核验**：确认 `HeroSection.vue`/`HomePage.vue` **不 import `src/api/`**、无 `onMounted` 网络副作用；跑 3.1 → 通过。
- [x] 3.3 **REFACTOR + 合规核验**：确认未引入 React/Tailwind/AntDV/vue-i18n/SSR（`package.json` 仅新增 `vue-router`）；样式为 SCSS scoped；文案集中在 `copy` 常量（i18n-ready 未接库）。对照 design D4/D5 逐条自检。

## 4. 端到端验收（全部自动化命令，无目视门禁）

- [x] 4.1 `cd frontend && npm test` 全绿：含新增 HeroSection/Placeholder 用例，且原 HelloCard 用例不回归。
- [x] 4.2 `cd frontend && npm run build` 通过（vue-tsc 类型 + vite 构建无错）。
- [ ] 4.3 （可选补充，非门禁）`npm run dev` 后访问 `/` 显示 Hero、点两 CTA 进占位页、Network 无任何 `/api` 请求。**不作验收判定依据。**

## 5. 收尾

- [x] 5.1 核对 delta 与主 specs 关系：`homepage-hero` 为新增能力；`frontend-client` 经 `/hello` 保留不回退（proposal Impact 已记，若审阅要求显式 MODIFIED delta 则在 sync 阶段补）。
- [ ] 5.2 走归档：实现完成后把 `openspec/changes/homepage-hero/` 归档并将 delta 同步进主 `openspec/specs/`（需可用 openspec CLI）。
