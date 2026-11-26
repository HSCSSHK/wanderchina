# homepage-hero Specification

## Purpose

TBD - created by archiving change homepage-hero. Update Purpose after archive.

## Requirements

### Requirement: 首页 Hero 视觉区渲染

系统 SHALL 在路由 `/` 渲染首页 Hero 区（`HeroSection` 由 `HomePage` 组装），面向外国游客展示具有视觉冲击力的主标题与副标题，技术栈 MUST 为 Vue 3 `<script setup>` + Element Plus + SCSS scoped。禁止引入 React / Tailwind / Ant Design 等锁定栈之外的方案。

#### Scenario: 访问首页渲染 Hero

- **WHEN** 用户访问 `/`（首页路由挂载）
- **THEN** 页面渲染出 Hero 主标题、副标题两个文本元素（测试可经 `data-testid` / 语义标签查询到），并渲染两个导航 CTA，无未捕获错误

#### Scenario: Hero 具有视觉呈现容器

- **WHEN** Hero 渲染完成
- **THEN** 存在承载背景视觉（渐变或背景图占位）的 Hero 容器元素，其具有可断言的 Hero 根类名/`data-testid`，文案在其内可读展示（区别于普通白底正文）

### Requirement: 首页导航入口可达核心功能

首页 Hero SHALL 提供两个明确的导航入口——"景点攻略 / Explore Attractions" 与 "AI 助手 / Ask AI Assistant"，二者 MUST 为 `vue-router` 链接（`router-link`，分别指向 `/spots` 与 `/ai`），点击进入对应路由；目标页面在本 change 允许为占位页（`Placeholder`），但导航闭环 MUST 可用。

#### Scenario: 点击景点攻略入口

- **WHEN** 用户点击"景点攻略"CTA
- **THEN** 路由切换到 `/spots`，渲染景点攻略占位页（含可断言的标题文案），无后端请求发出

#### Scenario: 点击 AI 助手入口

- **WHEN** 用户点击"AI 助手"CTA
- **THEN** 路由切换到 `/ai`，渲染 AI 助手占位页（含可断言的标题文案），无后端请求发出

### Requirement: Hero 无数据依赖且纯客户端渲染

`homepage-hero` MUST 是无数据依赖的展示单元：Hero 组件不得 import `src/api/`、不得发起任何 HTTP/后端请求、不得依赖数据库或后端接口；且 MUST 为纯客户端渲染，本 change 不引入 SSR / 预渲染（遵循 project.md §2 SEO 例外与 §3 禁止动作）。

#### Scenario: 挂载不触发网络请求

- **WHEN** 首页 Hero 挂载并完成渲染
- **THEN** 不存在对 `/api/**` 或任何后端的请求（测试中 axios/fetch 调用次数为 0），页面在完全无后端的情况下仍正常渲染

#### Scenario: 后端不可用不影响首页

- **WHEN** 后端服务未运行
- **THEN** 访问 `/` 仍完整渲染 Hero 与两个 CTA，不出现错误态或白屏

### Requirement: 文案 i18n-ready 但不引入 i18n 库

Hero 面向海外用户，主/副标题与 CTA 文案 SHALL 以英文为主，并 MUST 以集中、易替换的方式组织（i18n-ready），但本 change MUST NOT 引入任何 i18n 国际化库（YAGNI，多语言切换属后续 change）。

#### Scenario: 文案集中可替换

- **WHEN** 检视 Hero 组件实现
- **THEN** 展示文案集中定义（如组件内常量对象/props），不散落硬编码于模板多处，且未引入 `vue-i18n` 等国际化依赖

### Requirement: 首页壳改造不回退骨架期 Hello 能力

引入路由后，`App.vue` MUST 改为 `<router-view>` 出口；骨架期 `HelloCard`（消费 `/api/hello`）能力 MUST 保留可达（迁至 `/hello` 路由）且其既有 Vitest 用例 MUST 不回归。

#### Scenario: HelloCard 仍可访问且测试不回归

- **WHEN** 用户访问 `/hello`
- **THEN** 渲染原 `HelloCard`（保持骨架期消费 `/api/hello` 的行为）；且 `cd frontend && npm test` 中原 `HelloCard.test.ts` 用例全部仍通过
