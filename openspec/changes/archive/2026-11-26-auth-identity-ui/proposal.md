# 前端身份界面与会话管理 (auth-identity-ui)

## Why

`auth-identity-core` 已归档并交付稳定的注册、登录、刷新、登出、me 与 Security 链，但前端仍没有登录态、登录入口和受保护路由。下一步 AI 助手与社区都依赖“当前用户”边界；若先做业务页面再补会话管理，会在每个页面重复处理 token、401 和登录跳转。

本 change 把已批准的后端契约接到前端：Pinia + localStorage 会话、401 单飞刷新、登录/注册页、最小账户入口和路由守卫。范围保持克制，不做完整个人中心，也不引入跨标签页刷新互斥。

## What Changes

- **会话状态**：安装 Pinia，新增 auth store；Access Token、Refresh Token 与用户展示缓存按 D9 key 持久化；启动 hydrate，令牌对原子写入，损坏会话整体清理。
- **Auth API**：新增独立 axios 客户端处理 register/login/refresh/logout/me，避免刷新请求进入业务拦截器形成递归。
- **401 单飞刷新**：模块级 `refreshPromise` 保证同一标签页同时只刷新一次；并发失败请求等待同一结果，成功后以新 Access Token 各重放一次；刷新 401 清会话并跳登录，网络/5xx 保留会话。
- **跨标签页同步**：使用 BroadcastChannel 与 storage 事件同步登录/登出状态，消息不携带 token；**接受跨标签页并发刷新的残余竞态风险，不引入 Web Locks**。
- **登录/注册 UI**：新增 `/login`、`/register`、共享 `AuthShell`；对齐后端字段与 UTF-8 8–72 字节密码规则，处理 loading、字段错误、401/409 与安全跳转。
- **账户入口**：新增最小 `AccountMenu.vue`，提供 Login/Register 与 displayName/Sign out；不做资料编辑或个人中心。
- **路由守卫**：`/ai` 成为首个 `requiresAuth` 路由；`/`、`/spots/**`、`/hello` 保持公开；`/login`、`/register` 为 guestOnly；未登录跳转保留站内 `redirect`。
- **验证**：按 Phase 1–5 执行 TDD，新增 Vitest 与 Playwright 覆盖，特别是并发 401 单飞；四道门禁全绿。

## Impact

- 前端依赖：`package.json`、`package-lock.json` 增加 Pinia。
- 前端状态/API：新增 `src/types/auth.ts`、`src/stores/auth.ts`、`src/api/auth.ts`；修改 `src/api/http.ts`。
- 前端路由/启动：修改 `src/router/index.ts`、`src/main.ts`，新增 RouteMeta 类型声明。
- 前端 UI：新增 `src/components/auth/AuthShell.vue`、`src/components/auth/AccountMenu.vue`、`src/views/LoginView.vue`、`src/views/RegisterView.vue`；`App.vue` 挂载最小账户入口。
- 前端工具：新增站内 redirect 校验与跨标签页同步模块。
- 测试：新增 store/API/interceptor/guard/component Vitest 与 auth Playwright E2E；既有景点用例不得回归。
- 后端与数据库：**无 API、Schema、Flyway、Security 或种子数据变更**；若联调发现契约瑕疵，按项目规则回后端修复并暂停本 change 评估。

## Non-Goals

- 完整个人中心、资料编辑、头像上传、角色管理界面。
- Web Locks、跨标签页刷新互斥、设备管理、多端会话管理。
- OAuth/社交登录、MFA、邮箱验证、找回密码、登录限流。
- HttpOnly Cookie 迁移、CORS credentials、CSRF 方案、CSP 部署改造。
- AI 助手业务实现、社区表/页面/合规方案。
- 主动定时刷新、JWT 客户端解码授权、全局导航视觉重构。
- 任何后端契约或数据库结构变更。
