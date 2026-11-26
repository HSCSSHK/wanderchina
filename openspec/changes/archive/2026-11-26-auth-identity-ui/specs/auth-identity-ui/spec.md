# auth-identity-ui (Delta)

## ADDED Requirements

### Requirement: 会话状态与 Token 持久化

前端 MUST 安装 Pinia，并新增 auth store 管理 Access Token、Refresh Token 与用户展示缓存。Access Token 与 Refresh Token MUST 同时存在于 Pinia 与 localStorage；只有两者同时存在时才视为已登录。

localStorage key MUST 严格使用：

- `wanderchina.auth.accessToken`
- `wanderchina.auth.refreshToken`
- `wanderchina.auth.user`（用户展示缓存，不是权限真相来源）

登录、注册、刷新成功后，前端 MUST 以一次 `setSession` 操作原子更新内存状态与持久化令牌对，MUST NOT 持久化半对令牌。应用启动 MUST 从 localStorage hydrate；仅存在一个 token 或 user 缓存无法解析时，MUST 按损坏会话安全降级，不得崩溃。localStorage 不可用时，当前页面 MUST 退化为内存会话。

#### Scenario: 有效会话恢复

- **WHEN** 应用启动且 localStorage 中 Access Token 与 Refresh Token 均存在
- **THEN** auth store 恢复两个 token 与可解析的 user 缓存
- **AND** `isAuthenticated` 为 true

#### Scenario: 半对令牌清理

- **WHEN** localStorage 只存在 Access Token 或只存在 Refresh Token
- **THEN** 前端清除全部 auth key 与对应 store 状态
- **AND** `isAuthenticated` 为 false

#### Scenario: 令牌对原子写入

- **WHEN** 登录、注册或刷新返回完整 `AuthResponse`
- **THEN** 前端同时更新 Pinia 与两个 token key
- **AND** user 缓存同步更新
- **AND** 不出现 Access Token 已更新而 Refresh Token 仍为旧值的中间持久化状态

#### Scenario: 持久化不可用

- **WHEN** localStorage 读写抛出安全或配额异常
- **THEN** 前端不崩溃
- **AND** 当前页面仍可使用内存会话，刷新页面后按无会话处理

### Requirement: Auth API 与 401 单飞刷新

前端 MUST 使用独立 axios 客户端调用 `/api/auth/register|login|refresh|logout|me`，该客户端 MUST NOT 注册业务 401 刷新拦截器。业务请求 MUST 通过现有 `src/api/http.ts` 发送，并在存在 Access Token 时附加 `Authorization: Bearer <accessToken>`。

业务请求收到 HTTP 401 且本地存在 Refresh Token 时，前端 MUST 使用模块级单一 `refreshPromise` 执行单飞刷新：同一标签页同时到达的多个 401 MUST 复用同一个刷新 Promise。刷新成功后，前端 MUST 持久化新令牌对，并让每个原请求以最新 Access Token 重放至多一次。每个原请求 MUST 有重试标记，重放后仍返回 401 时 MUST NOT 再次刷新。

刷新接口自身、登录、注册与登出的 401 MUST NOT 触发自动刷新。403、网络错误与 HTTP 5xx MUST NOT 触发刷新。前端 MUST NOT 主动定时刷新或通过客户端解码 JWT 决定权限。

刷新返回 401 时，前端 MUST 清空本地会话并执行至多一次登录跳转；刷新网络错误或 5xx 时，前端 MUST 保留本地会话、拒绝本次请求且不强制跳转登录。并发拦截器处理同一失败时，清会话与跳转 MUST 幂等。

#### Scenario: 并发 401 单飞

- **WHEN** 同一标签页三个业务请求同时收到 401
- **THEN** `/api/auth/refresh` 只被调用一次
- **AND** 三个请求等待同一个刷新结果
- **AND** 刷新成功后三个请求分别以新 Access Token 重放一次

#### Scenario: 刷新成功轮换

- **WHEN** 单飞刷新返回完整新令牌对
- **THEN** Pinia 与 localStorage 同时写入新 Access Token、新 Refresh Token 与新 user
- **AND** 等待中的请求使用新 Access Token 重放

#### Scenario: 刷新身份失效

- **WHEN** `/api/auth/refresh` 返回 401
- **THEN** 本地会话被清空
- **AND** 所有等待请求失败
- **AND** 登录跳转只发生一次

#### Scenario: 刷新暂时不可用

- **WHEN** `/api/auth/refresh` 网络失败或返回 5xx
- **THEN** 本地令牌对保留
- **AND** 本次请求失败且不自动跳转登录

#### Scenario: 重放后仍无权

- **WHEN** 原请求重放后再次返回 401
- **THEN** 不再触发第二次刷新
- **AND** 本地会话清空并跳转登录

#### Scenario: 认证入口不被刷新拦截

- **WHEN** 登录请求返回 401
- **THEN** 页面直接展示凭据错误
- **AND** `/api/auth/refresh` 未被调用

### Requirement: 登录与注册页面

前端 MUST 提供 `/login` 与 `/register` 路由及共享 `AuthShell`。页面 MUST 使用 Element Plus 与 scoped SCSS，UI 文案 MUST 与现有英文产品一致。

登录页 MUST 接收 email、password，校验邮箱格式与非空密码，并在提交期间禁止重复提交。登录失败 MUST 展示后端 `Result.message`，不得回显 token、密码、堆栈或账号是否存在。

注册页 MUST 接收 email、displayName、password、confirmPassword；confirmPassword 仅用于前端确认，不发送给后端。邮箱与显示名校验 MUST 对齐后端，密码 MUST 按 UTF-8 8–72 字节校验。注册成功 MUST 自动建立会话并跳转，不展示额外阻断页。重复邮箱 409 MUST 展示 `email already registered`。

登录或注册成功后的跳转目标 MUST 来自站内 `redirect`，并经过安全校验；外部 URL、协议相对 URL、反斜杠路径与登录页自身 MUST 被拒绝或回退到 `/`。

#### Scenario: 登录成功

- **WHEN** 用户提交正确凭据
- **THEN** 页面调用登录 API 并写入完整会话
- **AND** 跳转到合法 redirect 或 `/`
- **AND** 不显示错误态

#### Scenario: 凭据错误

- **WHEN** 登录返回 401 `invalid email or password`
- **THEN** 页面展示该统一消息
- **AND** 不触发 token 刷新
- **AND** 不泄露账号是否存在

#### Scenario: 注册成功自动登录

- **WHEN** 用户提交合法且未占用的邮箱、显示名与密码
- **THEN** 注册 API 返回的令牌对与 user 被写入会话
- **AND** 页面跳转到合法 redirect 或 `/`

#### Scenario: 注册参数错误

- **WHEN** 邮箱非法、显示名为空、密码少于 8 字节、超过 72 字节或两次密码不一致
- **THEN** 页面在提交前展示对应字段错误
- **AND** 不调用注册 API

#### Scenario: 重复邮箱

- **WHEN** 注册 API 返回 409
- **THEN** 页面展示 `email already registered`
- **AND** 不建立会话

#### Scenario: 防重复提交

- **WHEN** 登录或注册请求正在进行
- **THEN** 提交按钮进入 loading 且不能再次提交
- **AND** 请求结束后恢复可交互状态

### Requirement: 最小账户入口与登出

前端 MUST 在应用壳提供最小 `AccountMenu.vue`。匿名状态 MUST 显示 Login/Register 入口；已登录状态 MUST 显示 user.displayName 与 Sign out。该组件 MUST NOT 扩展为完整个人中心。

登出 MUST 使用当前 Refresh Token 调用 `/api/auth/logout`，并 MUST 在请求结束的 `finally` 中清除 Pinia 与全部 auth localStorage key，同时通知其他标签页。服务端撤销失败时，本地 MUST 仍保持登出，UI MUST 提示服务端撤销失败，不得恢复为已登录。

#### Scenario: 正常登出

- **WHEN** 已登录用户点击 Sign out 且服务端返回 200
- **THEN** 服务端撤销 Refresh Token
- **AND** 本地会话与持久化 key 被清空
- **AND** 其他标签页收到登出同步

#### Scenario: 服务端撤销失败

- **WHEN** 登出请求网络失败或返回非 2xx
- **THEN** 本地会话仍被清空
- **AND** UI 显示服务端撤销失败提示
- **AND** 页面不会恢复登录态

### Requirement: 路由守卫与登录跳转

前端 MUST 使用 vue-router 路由元数据声明 `requiresAuth` 与 `guestOnly`。`/ai` MUST 为第一个受保护路由；`/`、`/spots/**`、`/hello` MUST 保持公开；`/login`、`/register` MUST 为 guestOnly。

未登录访问受保护路由时，守卫 MUST 跳转 `/login` 并通过 `redirect` 查询参数保留当前 `fullPath`。已登录访问 guestOnly 路由时 MUST 跳转到合法 redirect 或 `/`。守卫 MUST 使用 `router.replace` 完成登录态跳转，并避免登录页重定向循环。

路由守卫 MUST 只作为 UX 边界，不得替代后端 Security；后端仍是认证与权限真相来源。

#### Scenario: 匿名访问受保护路由

- **WHEN** 未登录用户访问 `/ai`
- **THEN** 页面跳转至 `/login?redirect=/ai`
- **AND** 不渲染 AI 占位页

#### Scenario: 登录后返回原路由

- **WHEN** 用户从 `/login?redirect=/ai` 成功登录
- **THEN** 页面通过 replace 返回 `/ai`

#### Scenario: 已登录访问登录页

- **WHEN** 已登录用户访问 `/login` 或 `/register`
- **THEN** 页面跳转到合法 redirect 或 `/`

#### Scenario: 公开内容不回归

- **WHEN** 未登录用户访问 `/`、`/spots`、`/spots/:id` 或 `/hello`
- **THEN** 守卫放行
- **AND** 现有景点与首页行为保持不变

#### Scenario: 拒绝外部 redirect

- **WHEN** redirect 为外部 URL、协议相对 URL、反斜杠路径或登录页自身
- **THEN** 前端回退到 `/`
- **AND** 不导航到站外地址

### Requirement: 跨标签页会话同步

前端 MUST 使用 BroadcastChannel 或 storage 事件同步登录与登出状态。BroadcastChannel 消息 MUST NOT 携带 Access Token、Refresh Token 或密码；其他标签页 MUST 在收到通知后重新读取 localStorage。同步 hydration MUST NOT 再次写 localStorage 或广播，避免回声循环。

本 change 明确 **MUST NOT 引入 Web Locks**，并接受跨标签页并发刷新可能触发后端重放检测、导致用户全部标签页登出的残余竞态风险。未来硬化 MUST 另开 change 评估跨标签页刷新互斥。

#### Scenario: 登录状态跨标签页同步

- **WHEN** 标签页 A 登录或刷新成功
- **THEN** 标签页 B 收到不含 token 的通知并重新读取会话
- **AND** 标签页 B 的 Pinia 状态与 localStorage 一致

#### Scenario: 登出状态跨标签页同步

- **WHEN** 标签页 A 登出
- **THEN** 标签页 B 清除内存会话
- **AND** 不再次广播或写入存储

#### Scenario: 残余竞态明确接受

- **WHEN** 两个标签页同时使用同一旧 Refresh Token 发起刷新
- **THEN** 本 change 不承诺跨标签页刷新互斥
- **AND** 后端重放检测仍可撤销该用户全部 Refresh Token

### Requirement: 安全与回归门禁

前端 MUST NOT 新增 `v-html`、`innerHTML` 或 `dangerouslySetInnerHTML`。Token MUST NOT 进入 URL、日志、错误上报、BroadcastChannel 消息或测试报告；错误处理 MUST NOT 记录原始 Axios config、Authorization header 或响应中的 token。

本 change MUST NOT 修改后端 API、数据库 Schema、Flyway、Security 链或 E2E 种子数据。完成后 MUST 通过：

- `mvn -f backend/pom.xml test`
- `cd frontend; npm test`
- `cd frontend; npm run test:e2e`
- `cd frontend; npm run build`

既有景点 E2E MUST 保持全绿，公开端点匿名行为 MUST NOT 回归。

#### Scenario: 全量门禁

- **WHEN** 依次执行后端测试、前端单测、Playwright E2E 与生产构建
- **THEN** 四条命令全部成功
- **AND** 新增 auth 场景全部通过

#### Scenario: 泄漏与越界扫描

- **WHEN** 扫描前端源码、测试与构建产物
- **THEN** 无 token/密码进入 URL、日志或报告
- **AND** 无新增危险 HTML 渲染 API
- **AND** 无后端、数据库或社区表越界改动
