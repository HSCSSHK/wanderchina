# Tasks: auth-identity-ui

## Phase 1: 会话底座（Store / Auth API）

- [x] 1.1 记录基线：`mvn -f backend/pom.xml test`（31 个）、`cd frontend; npm test`（33 个）、`npm run test:e2e`（9 个）、`npm run build` 当前全绿
- [x] 1.2 确认范围：包含 Pinia、localStorage、登录/注册、AccountMenu、`/ai` 守卫；不包含 Web Locks、个人中心、后端/Schema/Flyway/Security 改动
- [x] 1.3 **RED**：新增 `src/stores/auth.test.ts`，覆盖有效 hydrate、半对令牌清理、user 缓存损坏、`setSession` 完整写入、持久化异常内存降级、`clearSession` 返回值、`ensureUser`、logout `finally` 清理
- [x] 1.4 **RED**：新增 `src/api/auth.test.ts`，覆盖 register/login/refresh/logout/me 五个端点、`ApiResult` 解包、`AuthApiError`、独立 axios 不进入业务刷新拦截器
- [x] 1.5 运行 Phase 1 定向测试并记录 RED 证据，确认失败来自未实现功能而非环境问题
- [x] 1.6 安装 Pinia；新增 `src/types/auth.ts`、`src/stores/auth.ts`、`src/api/auth.ts`，实现 D3/D4 会话契约与三个固定 localStorage key
- [x] 1.7 Phase 1 定向测试转 GREEN；确认既有 33 个 Vitest 用例仍通过

## Phase 2: 401 Single-Flight Refresh

- [x] 2.1 **RED**：新增 `src/api/http.test.ts` 并发场景，三个业务请求同时 401 时 `/api/auth/refresh` 只调用一次，三个请求分别以最新 Access Token 重放一次
- [x] 2.2 **RED**：补充失败矩阵：刷新 401 清会话且登录跳转仅一次、刷新网络错误/5xx 保留会话、重放后仍 401 不循环、登录/注册/刷新/登出 401 不触发刷新、403 不触发刷新、Bearer 请求头正确
- [x] 2.3 运行 Phase 2 定向测试并记录 RED 证据
- [x] 2.4 修改 `src/api/http.ts`：接入 auth store、模块级 `refreshPromise`、`WeakSet` 重试标记、最新 token 重放、幂等 `expireSession` 与 `setSessionExpiredHandler`
- [x] 2.5 Phase 2 定向测试转 GREEN；确认无递归刷新、无重复登录跳转、无旧 Authorization 重放

## Phase 3: 路由守卫与登录跳转

- [x] 3.1 **RED**：新增 `src/utils/authRedirect.test.ts` 与 `src/router/guard.test.ts`，覆盖站内 redirect、外部/协议相对/反斜杠/登录页拒绝、匿名 `/ai` 跳转、redirect 保留、已登录 guestOnly 跳转、公开路由放行
- [x] 3.2 运行 Phase 3 定向测试并记录 RED 证据
- [x] 3.3 修改 `src/router/index.ts`：新增 `/login`、`/register`，声明 `requiresAuth`/`guestOnly`，将 `/ai` 设为受保护；新增 RouteMeta 类型；在 `main.ts` 按 Pinia → 失效回调 → router 顺序安装
- [x] 3.4 Phase 3 定向测试转 GREEN；确认 `/`、`/spots/**`、`/hello` 仍匿名放行

## Phase 4: 登录/注册 UI 与 AccountMenu

- [x] 4.1 **RED**：新增 `AuthShell`、`LoginView`、`RegisterView`、`AccountMenu` 组件测试，覆盖字段校验、UTF-8 8–72 字节、confirmPassword、loading 防重复、401/409 错误、成功写会话、安全 redirect、匿名入口、displayName、Sign out 与失败提示
- [x] 4.2 运行 Phase 4 定向测试并记录 RED 证据
- [x] 4.3 新增 `src/components/auth/AuthShell.vue`、`src/components/auth/AccountMenu.vue`、`src/views/LoginView.vue`、`src/views/RegisterView.vue`；修改 `App.vue` 挂载最小账户入口
- [x] 4.4 Phase 4 定向测试转 GREEN；确认登录/注册成功后 `router.replace`，登出在 `finally` 清本地并处理服务端失败

## Phase 5: 跨标签页同步、E2E 与门禁

- [x] 5.1 **RED**：新增 `authSessionSync` 单测与 `frontend/e2e/auth.e2e.ts`，覆盖 BroadcastChannel/storage 同步、消息不含 token、无回声循环、UI 登录、刷新持久化、`/ai` 守卫、注册自动登录、Sign out、跨标签页登录/登出
- [x] 5.2 运行 Phase 5 定向测试并记录 RED 证据
- [x] 5.3 新增 `src/utils/authSessionSync.ts`，实现 BroadcastChannel 优先、storage 降级、无写入 hydrate；明确不引入 Web Locks，保留跨标签页并发刷新残余竞态说明
- [x] 5.4 Playwright auth E2E 转 GREEN；既有 9 条景点 E2E 保持全绿
- [x] 5.5 依次执行四道门禁：`mvn -f backend/pom.xml test`、`cd frontend; npm test`、`cd frontend; npm run test:e2e`、`cd frontend; npm run build`，全部通过
- [x] 5.6 扫描 token/密码泄漏、URL/日志/错误上报、BroadcastChannel 消息与 `v-html`/`innerHTML`/`dangerouslySetInnerHTML`，确认无新增风险
- [x] 5.7 复查 diff：无后端、数据库、Flyway、Security、社区表越界改动；无 Web Locks、无完整个人中心；V2 与 E2E 种子保持不变
- [x] 5.8 更新本 tasks.md：已完成项勾选，归档项保留未勾选

## 6. 归档

- [ ] 6.1 归档（用户 CLI）：`openspec archive auth-identity-ui`
