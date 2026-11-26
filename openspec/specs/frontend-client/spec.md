# frontend-client Specification

## Purpose

TBD - created by archiving change init-skeleton. Update Purpose after archive.

## Requirements

### Requirement: 前端应用可启动

前端 SHALL 基于 Vue 3（`<script setup>` Composition API）+ Vite + TypeScript + Element Plus 运行，默认在 `5173` 端口提供开发服务，样式采用 SCSS。禁止引入 React / Next.js / Angular / Tailwind / Ant Design 等锁定栈之外的方案。

#### Scenario: 启动开发服务

- **WHEN** 执行 `cd frontend && npm install && npm run dev`
- **THEN** Vite 在 5173 端口成功启动；根组件挂载且渲染出预期的 Element Plus 容器元素（可被测试查询到），无未捕获错误

### Requirement: 通过代理消费后端 Hello

前端 SHALL 通过 Vite dev proxy 将 `/api` 请求转发到 `http://localhost:8080`，并在页面中调用 `GET /api/hello`，将后端返回的 `data` 消息渲染展示。请求 MUST 收敛到 `src/api/` 封装层，组件不直接裸调 axios。`api/` 层 MUST 设置请求超时（默认 5000ms），超时归入错误态；页面仅在挂载时拉取一次，无重复触发/并发路径。

#### Scenario: 端到端链路打通

- **WHEN** 后端运行于 8080、前端运行于 5173，页面挂载
- **THEN** 页面显示来自后端 `/api/hello` 的 `data` 消息，且请求经由 dev proxy 无 CORS 报错

#### Scenario: 请求失败有反馈

- **WHEN** `/api/hello` 请求失败（后端未起、返回 `code != 0` 或超时）
- **THEN** 页面渲染指定的错误文案/元素（测试可断言），而非白屏或静默失败

#### Scenario: 成功但空数据有空态

- **WHEN** 请求成功但 `data` 为空字符串或 `null`
- **THEN** 页面显示占位/空态提示，不崩溃、不显示未渲染的模板变量

#### Scenario: 无重复触发

- **WHEN** 页面已发起一次拉取且未完成
- **THEN** 不存在并发重复请求（本 change 页面无重试按钮，仅挂载时拉取一次）

### Requirement: 前端测试可运行（TDD 不可后补）

前端 SHALL 引入 Vitest（含 @vue/test-utils 与 jsdom），`npm test` 可运行，并覆盖 `src/api/` 层与 hello 展示组件的行为。

#### Scenario: 运行前端测试

- **WHEN** 执行 `cd frontend && npm test`
- **THEN** hello 相关组件与 api 封装的单元测试全部通过

#### Scenario: 存在 package.json 测试脚本

- **WHEN** 检视 `frontend/package.json`
- **THEN** 其中定义了可被 `npm test` 调用的 Vitest 脚本
