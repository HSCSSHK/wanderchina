# Design: auth-identity-ui

## Context

已确认的代码与运行事实：

- `auth-identity-core` 已归档；后端注册、登录、刷新、登出、me 与 Security 链稳定，前端无需修改后端契约。
- 前端已有 Vue 3、Vite、TypeScript、Element Plus、vue-router 4、axios 1.x；**尚未安装 Pinia**。
- `src/api/http.ts` 当前只有 `baseURL: '/api'` 与 5000ms 超时，没有请求/响应拦截器。
- 当前路由 `/`、`/spots`、`/spots/:id`、`/ai`、`/hello` 全部公开；`App.vue` 只有 `<router-view />`。
- 开发与 E2E 都通过 Vite `/api` 代理访问后端，不需要 CORS credentials。
- 后端 `AuthResponse` 包含 `accessToken`、`refreshToken`、`tokenType`、`expiresIn`、`user`；`user.id` 是字符串。
- 登录 401 统一消息为 `invalid email or password`；注册重复邮箱为 409 `email already registered`；密码按 UTF-8 8–72 字节校验。
- E2E 固定用户已存在于 `R__e2e_seed.sql` 与 `frontend/e2e/fixtures.ts`，可直接用于 UI 登录测试。
- 前端现有 `v-html`/`innerHTML`/`dangerously` 扫描为 0；本 change 必须保持该约束。
- 用户已拍板：包含最小 `AccountMenu.vue`，`/ai` 为首个受保护路由；跨标签页只用 BroadcastChannel/storage 同步，**不引入 Web Locks，接受并发刷新残余竞态**。

## Goals / Non-Goals

**Goals**

- 用 Pinia + localStorage 建立唯一、可恢复、可撤销的前端会话真相。
- 用模块级 `refreshPromise` 实现单标签页 401 单飞刷新，避免并发刷新触发后端重放检测。
- 提供登录、注册、最小账户入口与 `/ai` 守卫，闭合登录到登出的用户体验。
- 保持首页、景点列表、景点详情与 `/hello` 匿名可访问。
- 以 Vitest 与 Playwright 自动化验证会话、单飞、守卫、页面和跨标签页同步。

**Non-Goals**

- 完整个人中心、资料编辑、头像上传、角色管理。
- Web Locks、跨标签页刷新互斥、设备管理、多端会话管理。
- OAuth、MFA、邮箱验证、找回密码、限流、验证码。
- HttpOnly Cookie 迁移、CORS credentials、CSRF、CSP 部署改造。
- AI 助手业务、社区页面/表/合规方案。
- 主动定时刷新、客户端 JWT 解码授权、全局导航视觉重构。
- 后端 API、Schema、Flyway、Security 或 E2E 种子变更。

## Decisions

### D1: 一个 change，一个 capability，按 Requirement 拆分

登录页、注册页、账户入口、路由守卫和刷新机制共享同一会话状态与 redirect 契约，不拆成多个 change 或 capability。`specs/auth-identity-ui/spec.md` 按以下 Requirement 组织：

1. 会话状态与 Token 持久化；
2. Auth API 与 401 单飞刷新；
3. 登录与注册页面；
4. 最小账户入口与登出；
5. 路由守卫与登录跳转；
6. 跨标签页会话同步；
7. 安全与回归门禁。

这样避免多个 Spec 重复定义 token、redirect 与错误契约，也避免形成跨 Spec 循环依赖。

### D2: 前端模块边界与依赖方向

```text
LoginView / RegisterView / AccountMenu
                 |
                 v
          stores/auth.ts
                 |
                 v
           api/auth.ts --------> 后端 /api/auth/*
                 ^
                 |
api/http.ts 业务拦截器 <------- 景点等业务 API
                 |
                 +---- 401 ----> authStore.refreshTokens()
                                      |
                                      v
                              module refreshPromise

router/index.ts <--------> stores/auth.ts
main.ts --------> 安装 Pinia、注入会话失效跳转回调
```

关键约束：

- `api/auth.ts` 使用**独立 axios 实例**，不注册业务刷新拦截器。
- `stores/auth.ts` 可以 import `api/auth.ts`，不 import router。
- `api/http.ts` 可以 import auth store，不直接 import router。
- `main.ts` 在 Pinia 安装后向 `api/http.ts` 注入会话失效回调，回调内部调用 `router.replace`。

该边界避免以下循环：

```text
store -> api/auth -> api/http -> store
router -> views -> api/http -> router
```

### D3: 类型与 Auth API 契约

新增 `src/types/auth.ts`，与后端字段一一对齐：

- `AuthUser`：`id: string`、`email`、`displayName`、`avatarUrl: string | null`、`role`。
- `AuthTokens`：`accessToken`、`refreshToken`、`tokenType`、`expiresIn`、`user`。
- `LoginInput`、`RegisterInput`、`RefreshInput`、`LogoutInput`。

`src/api/auth.ts` 提供：

- `login(input)`；
- `register(input)`；
- `refresh(input)`；
- `logout(input)`；
- `fetchMe(accessToken)`。

所有响应按现有 `ApiResult<T>` 解包：`code === 0` 返回 data，否则抛出带 HTTP status、code、message 的 `AuthApiError`。失败响应不回传原始 Axios config 或 token。

`fetchMe` 用于 user 缓存缺失时补全展示名，不用于路由守卫的每次导航；Store 提供 `ensureUser()` 供 `AccountMenu` 调用。

### D4: Pinia Store 与 localStorage

Store 状态：

| 状态 | 类型 | 说明 |
|---|---|---|
| `accessToken` | `string \| null` | Access Token |
| `refreshToken` | `string \| null` | Refresh Token |
| `user` | `AuthUser \| null` | 展示缓存，不是权限真相来源 |

派生状态 `isAuthenticated = Boolean(accessToken && refreshToken)`。

持久化 key 严格沿用 D9：

- `wanderchina.auth.accessToken`；
- `wanderchina.auth.refreshToken`；
- `wanderchina.auth.user`。

`setSession(AuthTokens)` 的执行顺序：

1. 校验两个 token 均非空，否则按契约错误处理；
2. 更新 Pinia 内存状态；
3. 写入 refreshToken、accessToken、user；
4. 任一步持久化失败时清除全部 auth key，保留当前内存会话；
5. 全部写入后广播 `session-updated`。

localStorage 没有跨 key 事务，这里的“原子”是**逻辑原子**：调用方只见完整会话，失败时清理半对状态，其他标签页在全部写入完成后才由 BroadcastChannel 通知。

`hydrate()`：

- 两个 token 均存在：恢复 token 与可解析 user；
- 只有一个 token：清空全部 auth key；
- user JSON 损坏：仅清 user 缓存，保留 token；
- 存储不可用：不抛异常，当前页使用内存状态。

`clearSession()` 清 Pinia 与全部 auth key，并返回“此前是否存在会话”，供拦截器实现幂等失效跳转。

### D5: 401 Single-Flight Refresh

#### 正常时序

```text
业务请求 A --401--------------------------\
业务请求 B --401----------------------+---> 同一个 refreshPromise
业务请求 C --401--------------------------/            |
                                                  v
                                      POST /auth/refresh
                                      （独立 axios，无拦截器）
                                                  |
                                    成功：setSession(新令牌对)
                                                  |
                                     A/B/C 各重放一次原请求
```

实现要点：

- `refreshPromise` 是模块级变量，不进入 Pinia state。
- 第一个 401 同步创建 Promise，后续 401 直接复用。
- `refreshTokens()` 在 Promise 创建时读取当前 Refresh Token；成功后写新令牌对；`finally` 清空 Promise。
- 业务请求用 `WeakSet<InternalAxiosRequestConfig>` 标记已重试，避免污染 axios config 类型。由于 axios `request(config)` 会经 `mergeConfig` 克隆配置，额外用一个可枚举 symbol 把重试意图桥接到新配置，再由请求拦截器写入 WeakSet 并删除 symbol。
- 重放时重新调用业务客户端，让请求拦截器读取最新 Access Token；不得复用旧 Authorization header。
- 每个原请求最多重放一次。

#### 触发与失败矩阵

| 情况 | 刷新 | 会话 | 跳转 |
|---|---:|---|---:|
| 业务 401 + 有 Refresh Token | 是，单飞 | 保留至结果 | 否 |
| 多个业务 401 | 只调用一次 | 同上 | 否 |
| 刷新成功 | 结束 | 写新令牌对 | 否 |
| 刷新 401 | 结束 | 清空 | 是，至多一次 |
| 刷新网络错误/5xx | 结束 | 保留 | 否 |
| 重放后仍 401 | 不再刷新 | 清空 | 是 |
| 登录/注册/刷新/登出 401 | 否 | 不变 | 由页面处理 |
| 403 | 否 | 不变 | 否 |

刷新 401 与重放 401 都调用统一 `expireSession()`：只有 `clearSession()` 确实清掉会话的那次调用触发登录跳转，保证并发失败只跳一次。

不做主动定时刷新，不解析 JWT exp，不在 token 过期前后台轮换；统一由真实 401 驱动，保持实现与测试简单。

### D6: 会话失效跳转与安全 redirect

`api/http.ts` 导出 `setSessionExpiredHandler(handler)`，由 `main.ts` 注入：

- 当前已在 `/login` 或 `/register`：不重复跳转；
- 否则 `router.replace({ name: 'login', query: { redirect: currentRoute.fullPath } })`。

新增 `src/utils/authRedirect.ts`：

- 只接受以单个 `/` 开头的站内路径；
- 拒绝 `//`、`\`、绝对 URL、控制字符；
- 拒绝 `/login` 自身，避免循环；
- 非法值回退 `/`。

token 不进入 redirect、URL、日志或错误上报。

### D7: 跨标签页同步与已接受风险

新增 `src/utils/authSessionSync.ts`，在应用启动时注册一次：

- 优先使用 `BroadcastChannel('wanderchina.auth')`；
- 消息类型仅为 `session-updated` / `logged-out`，不携带 token 或 user；
- 收到通知后重新读取 localStorage，并调用 `authStore.hydrate(false)`；启动时仍调用默认 `hydrate()`，以便清理半对令牌或损坏 user 缓存；
- storage 事件作为降级，只处理 `wanderchina.auth.` 前缀 key；
- 同步触发的 `hydrate(false)` 不写回、不广播，避免回声循环；消息校验只接受单个 `type` 字段，拒绝夹带 token/user 的额外数据。

**明确接受的风险**：BroadcastChannel/storage 只同步状态，不提供跨标签页刷新互斥。两个标签页同时使用同一旧 Refresh Token 刷新时，后端重放检测可能撤销该用户全部 Refresh Token，导致所有标签页登出。

本 change **不引入 Web Locks**。未来若要求跨标签页硬保证，另开 change 评估 Web Locks 或服务端幂等刷新方案。

### D8: 登录页、注册页与 AuthShell

新增：

- `src/components/auth/AuthShell.vue`；
- `src/views/LoginView.vue`；
- `src/views/RegisterView.vue`。

共用视觉：品牌标题、卡片、返回首页、登录/注册互链。使用 Element Plus `el-form`、`el-input`、`el-button`、`el-alert` 与 scoped SCSS；不引入新 UI/CSS 框架。

登录页：

- email、password；
- `autocomplete="email"` / `current-password`；
- 校验邮箱格式与非空密码；
- loading 期间禁用提交；
- 401 展示后端统一消息；
- 成功后 `setSession` 再 `router.replace(safeRedirect)`。

注册页：

- email、displayName、password、confirmPassword；
- confirmPassword 不发送后端；
- 使用 `TextEncoder` 按 UTF-8 8–72 字节校验密码；
- 显示名非空且不超过 50 字符；
- 409 展示重复邮箱；
- 成功后按后端契约自动登录并跳转。

不增加后端未要求的密码复杂度规则。

### D9: AccountMenu 与登出

新增 `src/components/auth/AccountMenu.vue` 并挂载到 `App.vue`：

- 匿名：Login / Register；
- 已登录：displayName + Sign out；
- user 缓存缺失且有会话时调用 `ensureUser()` 补全；
- 不做头像、资料、角色或权限界面。

登出流程：

1. 读取当前 Refresh Token；
2. 调用独立 auth client 的 `/auth/logout`；
3. 在 `finally` 清本地会话并广播 `logged-out`；
4. 若当前路由受保护，`router.replace('/')`；
5. 服务端失败时用 Element Plus 警告提示“本机已退出，服务端撤销失败”，不恢复登录态。

### D10: 路由守卫

新增 RouteMeta 类型：

- `requiresAuth?: boolean`；
- `guestOnly?: boolean`。

路由策略：

| 路由 | meta |
|---|---|
| `/` | 公开 |
| `/spots`、`/spots/:id` | 公开 |
| `/hello` | 公开 |
| `/login`、`/register` | `guestOnly` |
| `/ai` | `requiresAuth` |

守卫规则：

- `requiresAuth && !isAuthenticated`：跳 `/login?redirect=<fullPath>`；
- `guestOnly && isAuthenticated`：跳合法 redirect 或 `/`；
- 其余放行；
- 登录态跳转使用 `router.replace`；
- Pinia 必须在 router 首次导航前安装。

守卫只判断本地会话存在性，不调用 `/me`，不构成安全边界；后端 Security 仍是真相来源。

### D11: 安全约束

- 禁止新增 `v-html`、`innerHTML`、`dangerouslySetInnerHTML`。
- token 不进入 URL、日志、错误上报、BroadcastChannel、测试报告。
- 不记录原始 AxiosError config、Authorization header 或响应 data。
- localStorage 的 XSS 读取风险沿用 core D9 的已接受结论；本 change 不顺手改 Cookie/CSP。
- Access Token 30 分钟、Refresh 轮换与重放检测仍由后端提供。
- 不修改后端、数据库、Flyway、Security 或 E2E 种子。

## File Map

| 文件 | 动作 | 职责 |
|---|---|---|
| `frontend/package.json` / lock | 修改 | 安装 Pinia |
| `src/types/auth.ts` | 新增 | Auth 类型 |
| `src/stores/auth.ts` | 新增 | 会话状态、持久化、单飞、登出 |
| `src/api/auth.ts` | 新增 | 独立 Auth axios client |
| `src/api/http.ts` | 修改 | Bearer、401 单飞接入、失效回调 |
| `src/utils/authRedirect.ts` | 新增 | 站内 redirect 校验 |
| `src/utils/authSessionSync.ts` | 新增 | BroadcastChannel/storage 同步 |
| `src/router/index.ts` | 修改 | 登录/注册路由、meta、guard |
| `src/main.ts` | 修改 | Pinia、同步注册、失效回调 |
| `src/App.vue` | 修改 | 挂载 AccountMenu |
| `src/components/auth/AuthShell.vue` | 新增 | 登录/注册共享外壳 |
| `src/components/auth/AccountMenu.vue` | 新增 | 最小账户入口 |
| `src/views/LoginView.vue` | 新增 | 登录页 |
| `src/views/RegisterView.vue` | 新增 | 注册页 |
| `src/types/router.d.ts` | 新增 | RouteMeta 类型扩展 |

## Test Strategy

### Vitest

- `stores/auth.test.ts`：hydrate、半对清理、原子写入、存储异常、user 补全、logout finally、单飞 Promise 复用。
- `api/auth.test.ts`：五个端点、Result 解包、`AuthApiError`、独立客户端不经过业务拦截器。
- `api/http.test.ts`：Bearer 注入；三个并发 401 只刷新一次；重放使用新 token；刷新 401 清会话且只跳一次；网络/5xx 保留；重放 401 不循环；登录 401/403 不刷新。
- `authRedirect.test.ts`：站内路径接受，外部/协议相对/反斜杠/登录页拒绝。
- `router/guard.test.ts`：匿名 `/ai` 跳转、redirect 保留、已登录 guestOnly 跳转、公开路由放行。
- `AccountMenu.test.ts`：匿名入口、展示名、Sign out、失败提示。
- `LoginView.test.ts` / `RegisterView.test.ts`：校验、loading、401/409、成功写会话与安全跳转。

### Playwright

新增 `frontend/e2e/auth.e2e.ts` 与跨标签页用例：

- 种子用户 UI 登录，localStorage 出现完整令牌对；
- 刷新页面后会话保持；
- 匿名 `/ai` 跳 `/login?redirect=/ai`，登录后回到 `/ai`；
- 注册唯一邮箱后自动登录；
- Sign out 清本地会话，旧 Refresh Token 无法再刷新；
- 两个同 context 页面同步登录/登出；
- 既有 9 条景点 E2E 保持全绿。

单飞的核心并发保证由 Vitest 精确断言调用次数；E2E 负责真实浏览器、路由与持久化闭环。

### 门禁

依次执行：

1. `mvn -f backend/pom.xml test`；
2. `cd frontend; npm test`；
3. `cd frontend; npm run test:e2e`；
4. `cd frontend; npm run build`。

完成后扫描 token/密码泄漏、危险 HTML API 与越界 diff。

## Risks and Mitigations

| 风险 | 影响 | 处置 |
|---|---|---|
| localStorage 可被同源 XSS 读取 | 双 token 泄露 | 禁止危险 HTML、不记录 token；Cookie/CSP 另开 change |
| 跨标签页并发刷新 | 后端重放撤销全部 token | 本 change 明确接受；状态同步降低误操作，未来硬化 |
| 刷新网络失败 | 用户暂时无法继续受保护请求 | 保留会话、拒绝本次请求，允许后续重试 |
| 登出网络失败 | 服务端 token 可能仍有效 | 本地强制登出并提示撤销失败 |
| redirect 开放重定向 | 钓鱼或站外跳转 | 严格站内路径白名单 |
| 守卫误判为安全边界 | 绕过前端直达 API | 文档明确后端 Security 为真相来源 |
| AccountMenu 影响现有视觉 | 首页/详情布局回归 | 最小固定入口，不重构全局导航；E2E 回归 |
