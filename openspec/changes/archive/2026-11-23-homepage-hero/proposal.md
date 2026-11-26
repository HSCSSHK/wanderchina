# Homepage Hero (homepage-hero)

## Why

P0 已锁定：首页 = 面向外国游客的**品牌视觉展示 + 产品功能入口**兼具。当前前端只有骨架期的 `HelloCard` demo 直接挂在 `App.vue` 上，没有任何真正的首页，也没有把用户导向核心功能（景点攻略 / AI 助手）的导航。

`homepage-hero` 是首页第一个**无数据依赖**的展示单元：先用一个有视觉冲击力的 Hero 区把外国游客留住，再用两个清晰的导航入口把他们送进 P0 核心功能。它不接后端接口、不碰数据库、不碰 SSR/预渲染——纯前端外壳，先立起来，后续 `景点结构化攻略` / `AI 实时助手` 各自独立 change 再往里挂真实能力。

## What Changes

- **新增前端路由外壳**：引入 `vue-router`（Vue 3 兼容版本），`App.vue` 从"直接挂 HelloCard"改为 `<router-view>`。路由：`/`（首页 Hero）、`/spots`（景点攻略·占位）、`/ai`（AI 助手·占位）、`/hello`（**保留**骨架期 HelloCard，避免 `frontend-client` 能力回退）。
- **新增 Hero 视觉区**：`HeroSection.vue` + `HomePage.vue`——大面积 Hero（渐变/背景图占位 + 面向外国游客的英文主副标题 + 两个 CTA）。仅用 Vue 3 `<script setup>` + Element Plus + SCSS scoped。
- **导航入口可达**：两个 CTA 为 `router-link`（分别指向 `/spots`、`/ai`），点击进入对应占位页（复用单一 `Placeholder.vue`，`el-empty` + 标题）。占位仅证明导航闭环，**真实功能属后续 P0 change**。
- **硬约束（可测行为）**：Hero **不发起任何后端请求**、不 import `src/api/`、纯客户端渲染；文案以英文为主且 i18n-ready（集中管理），但**本 change 不引入 i18n 库**（YAGNI）。
- **明确不做（非目标）**：不接任何真实数据/接口、不做 SSR/预渲染（见 project.md §2 SEO 例外，留待独立 change）、不做景点攻略/AI 助手实体页面、不做多语言切换、不做后端改动。

## Impact

- **Affected specs**：新增能力 `homepage-hero`（`specs/homepage-hero/spec.md` 为 ADDED delta）。
- **Impact on existing capability**：`frontend-client` 的应用根由直接挂载改为路由出口，并把 HelloCard 迁至 `/hello`——其行为不回退（组件与其 Vitest 用例保留），本 change 以"保留可达 + 用例不回归"满足，不单独出 `frontend-client` MODIFIED delta；若审阅认为应显式记为 MODIFIED，可在 sync 阶段补。
- **Affected code**：`frontend/package.json`（+`vue-router`）、`frontend/src/main.ts`（注册 router）、`frontend/src/App.vue`（改 router-view）、`frontend/src/router/`（新增）、`frontend/src/views/`（`HomePage.vue`/`Placeholder.vue` 新增）、`frontend/src/components/home/HeroSection.vue`（新增）及对应测试。
- **锁定栈一致性**：严守 project.md §1/§3——Vue 3 + Vite + TS + Element Plus + SCSS；禁 React/Tailwind/AntDV；禁 SSR 元框架。`vue-router` 为锁定栈允许的官方路由，非引入新 UI/CSS 方案。
- **无后端 / 无 DB / 无 SSR**：本 change 纯前端展示外壳，与 §6 数据库规范、后端接口均无耦合。
- **工具链**：`openspec` CLI 在 agent shell 不可达，工件按标准 spec-driven 结构手工落盘（脚手架 `.openspec.yaml` 已由用户侧 `openspec new change` 生成）；`validate/archive` 需在可用 CLI 环境执行。
