# Design: homepage-hero

## Context

P0 定位（project.md §0）：首页 = 面向外国游客的品牌视觉展示 + 产品功能入口。`homepage-hero` 是首页第一个**无数据依赖**单元。

当前前端事实（已核对）：
- `frontend/src/App.vue` 直接 `<HelloCard />`，**无 vue-router**、无 `views/` 目录。
- `main.ts` 已全局注册 Element Plus（`import ElementPlus` + 样式）。
- 依赖：Vue ^3.5.44 / Vite ^8.3.6 / TS ~6.0.3 / element-plus ^2.14.8 / sass ^1.108 / vitest ^5.1.1 + @vue/test-utils ^2.6.0 + jsdom ^29。
- `HelloCard.test.ts`（骨架期 4 用例）与 `api/hello.ts` 已存在且 `npm test` 通过。

约束：Vue 3 `<script setup>` + Element Plus + SCSS；不碰后端接口、不碰 SSR/预渲染（project.md §2/§3）。

## Goals / Non-Goals

**Goals**
- 引入 vue-router，`/` 渲染有视觉冲击力的 Hero，并提供两个可达的导航入口（景点攻略 / AI 助手）。
- Hero 纯前端、零后端请求，无后端也能渲染。
- 改造 App 壳的同时不回归骨架期 `frontend-client`（HelloCard 迁 `/hello`，用例仍绿）。
- 全部验收用可执行命令（Vitest / vue-tsc build），无"打开浏览器看"式门禁。

**Non-Goals**
- 不做景点攻略 / AI 助手真实页面（占位除外）。
- 不接任何后端接口 / 数据库（与 §6 无耦合）。
- 不引入 SSR/预渲染/i18n 库/pinia/组件库之外的 UI 方案。
- 不做后端改动、不做像素级视觉验收（用结构化可断言元素替代）。

## Decisions

### D1: 引入 vue-router 作为首页导航机制（已批准，项目基础设施）

- **决策已确认（用户批准）**：引入 `vue-router@^4`（Vue 3 官方路由，属锁定栈允许范围，非新 UI/CSS 方案）。理由：首页双导航入口必须可跳转；且后续 `景点攻略`/`AI 助手` 均需**页面级路由**，vue-router 是项目基础设施，不是本 change 的临时依赖。
- 基础路由采用用户指定的命名 `/`、`/spots`、`/ai`；`/spots`→景点攻略、`/ai`→AI 助手。

### D2: 路由表与应用壳

```
src/router/index.ts
  createWebHistory
  routes:
    /       -> views/HomePage.vue        (组装 HeroSection)
    /spots  -> views/Placeholder.vue     (props: title="Attractions Guide")
    /ai     -> views/Placeholder.vue     (props: title="AI Travel Assistant")
    /hello  -> 现有 HelloCard 的宿主视图 (保留骨架期能力不回退)
```
- `main.ts`：`createApp(App).use(ElementPlus).use(router).mount('#app')`。
- `App.vue`：由 `<HelloCard />` 改为 `<router-view />`。
- `/hello` 处理方式：新建极薄 `views/HelloView.vue` 内嵌 `<HelloCard />`（HelloCard 组件本身与测试**不改**），确保 `frontend-client` 行为不回退。

### D3: 组件结构与视觉方案

```
src/views/HomePage.vue                 <HeroSection/> 的页面容器
src/components/home/HeroSection.vue    Hero 本体（script setup）
```
- Hero 结构：根 `<section class="hero" data-testid="hero">` → 承载背景（CSS 渐变打底 + 可选 `assets/hero-bg` 占位图，`background-size: cover`）→ `<h1 data-testid="hero-title">` 主标题、`<p data-testid="hero-subtitle">` 副标题、`.hero__cta` 两个按钮。
- CTA 用 Element Plus：`<router-link :to="'/spots'"><el-button type="primary" size="large">`（景点攻略）与 `<router-link :to="'/ai'"><el-button size="large">`（AI 助手），并带 `data-testid="cta-spots"` / `cta-ai`。
- 样式：**SCSS scoped**，主色/间距用局部 SCSS 变量占位（品牌视觉后续 change 精修）；响应式用 `clamp()`/媒体查询保证移动端不破版。禁止 Tailwind/其它原子 CSS。
- 视觉"冲击力"落地为**可测结构断言**（hero 根元素/标题/CTA 存在、背景类存在），不做像素比对。

### D4: 无数据依赖与 SSR 边界（对应红线）

- Hero 与 HomePage **不 import `src/api/`**、不调用 axios/fetch；组件无 `onMounted` 网络副作用。
- 仍为纯 SPA 客户端渲染：本 change **不加** vite-ssg / prerender / SSR。公开页 SEO 需求按 project.md §2 例外，将来用 Vite 预渲染或**单独立 change** 评估，禁止为 SEO 改用 Next/Nuxt。

### D5: 文案 i18n-ready（不接库）

- 主/副标题/CTA 文案集中为 HeroSection 内 `const copy = { title, subtitle, ctaAttractions, ctaAssistant }`（或 props 默认值），模板只引用变量。
- 不引入 vue-i18n（YAGNI）。多语言切换属后续独立 change。

### D6: 测试栈与用例（TDD，Vitest + @vue/test-utils）

- 复用现有 `vitest.config.ts`（jsdom）。测路由用**真实 router 实例**：`createRouter({ history: createMemoryHistory(), routes })` 注入 `global.plugins`，避免额外 mock 库。
- `HeroSection.test.ts` 覆盖：
  1. 渲染 `hero-title` / `hero-subtitle` / 两个 `cta-*`（存在且文案非空）。
  2. 点击 `cta-spots` → `router.push` 生效、`router.currentRoute.value.path === '/spots'`（或断言 `router-link` 的 `to`）。
  3. 点击 `cta-ai` → 进入 `/ai`。
  4. **零网络**：以 `vi.spyOn` 监视 axios 实例/`fetch`，断言挂载与点击全流程调用次数为 0。
- `Placeholder.test.ts`：传入 title props → 渲染 `el-empty` 且含该标题文案。
- **回归门**：改壳后 `npm test` 必须仍全绿（含原 `HelloCard.test.ts` 4 用例不回归）。

## Risks / Trade-offs

- **新依赖 vue-router 与 Vite 8/Vue 3.5 兼容**：实施首步以"能安装 + 能 build + 能跑测试"为准，必要时锁定可用版本（沿用骨架期同类处置）。
- **主观"视觉冲击力"难验收**：以结构化可断言元素替代像素判定，视觉精修留给后续品牌 change。
- **改 App 壳触碰骨架期能力**：以 D2 `/hello` 保留 + 回归门兜底，防 `frontend-client` 回退。
- **openspec CLI 不在 agent PATH**：工件手工按标准结构落盘，`validate/archive` 依赖用户侧 CLI；格式若有偏差以 CLI 校验为准回修。

## Migration Plan

纯前端增量 + 壳改造，无数据迁移、无后端变更。落地顺序：装 vue-router 可 build → 写 Hero/占位 失败测试(RED) → 实现组件与路由(GREEN) → 改 App 壳并把 HelloCard 迁 /hello → 全量 `npm test` + `npm run build` 通过。

## Open Questions

- Hero 具体英文文案与背景素材（占位先行，实施时定一版非阻塞）。
- 品牌主色（先用 SCSS 变量占位，留给品牌 change 钉死）。
- ~~是否接受 D1 引入 vue-router~~：**已批准**（用户确认必须引入，作为项目基础设施）。
