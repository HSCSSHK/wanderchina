# Design: auth-identity-core

## Context

已确认的代码与运行事实：

- 后端 `pom.xml` 只有 web、data-jpa、Flyway、MySQL、springdoc、test；**没有 Spring Security、Bean Validation、JWT 库**。
- Flyway 只有 `V1__create_attractions_tables.sql`（3 张景点表）；`BaseEntity` 已提供雪花 ID、`created_at/updated_at`、`created_by/updated_by`、`is_deleted`、`version`；`JacksonConfig` 已把 Long 序列化为 String。
- `GlobalExceptionHandler` 目前只处理 `NoHandlerFoundException`、`ResourceNotFoundException` 和兜底 `Exception`，**没有处理参数校验异常**；兜底会把校验失败变成 500。
- 测试基线：`mvn test` 10 个、Vitest 33 个、Playwright 9 个；test profile 直连 `wanderchina_test`，e2e profile 直连 `wanderchina_e2e` 并加载 `db/e2e/R__e2e_seed.sql`（4 城市/6 景点/11 开放时间）。
- 前端没有 Pinia；`frontend/src` 中 `v-html`/`innerHTML`/`dangerously` 的检索结果为 **0**；请求统一走 `src/api/http.ts` 的 axios 实例。
- 现有安全相关回归点：`HelloControllerTests` 无令牌访问 `/api/hello` 期望 200；`SpotApiTests` 无令牌访问 `/api/spots` 期望 200；`OpenApiProdDisabledTests` 期望 `/v3/api-docs` 在 prod 为 404；`GlobalExceptionHandlerTests` 通过测试专用 `/api/boom` 断言异常包装，且未知路由期望 404。
- 用户已拍板：只做 `auth-identity-core`；V2 只建 `app_user`、`auth_refresh_token`；前端 token 放 Pinia + localStorage；JWT Secret 从 `${JWT_SECRET}` 读取；e2e 种子加固定用户。

## Goals / Non-Goals

**Goals**

- 交付可被后续社区复用的身份底座：注册、登录、刷新、登出、me、统一 401。
- 身份表严格遵守 §6，刷新令牌可撤销、可轮换、不可明文落库。
- 引入 Spring Security 后，现有景点/Hello/OpenAPI 行为不回归。
- 密钥无默认值、无硬编码，缺失即失败。
- 提供确定性的 e2e 测试用户，供 `auth-identity-ui` 的 Playwright 登录用例使用。

**Non-Goals**

- 登录/注册页面、Pinia 安装、路由守卫、401 拦截器（`auth-identity-ui`）。
- 邮箱验证、找回密码、OAuth、MFA、限流/锁定、设备管理。
- 社区表、合规方案、管理员审核接口。
- CORS 白名单、HTTPS/HSTS、密钥轮换平台化。

## Decisions

### D1: 范围边界

本 change 只改后端与 E2E 夹具；D9 的 Pinia + localStorage 是**给下一个 change 的强制契约**，本 change 不安装 Pinia、不写前端页面。这样避免在没有登录 UI 消费者时先引入状态库，也保证后端契约先稳定。

### D2: V2 数据模型

新增 `backend/src/main/resources/db/migration/V2__create_auth_tables.sql`，只建两张表：

```sql
CREATE TABLE app_user (
  id            BIGINT       NOT NULL COMMENT '雪花ID',
  email         VARCHAR(254) NOT NULL,
  password_hash VARCHAR(100) NOT NULL COMMENT 'BCrypt',
  display_name  VARCHAR(50)  NOT NULL,
  avatar_url    VARCHAR(512) NULL,
  role          VARCHAR(16)  NOT NULL DEFAULT 'user' COMMENT 'user/admin',
  status        TINYINT      NOT NULL DEFAULT 1 COMMENT '1=正常,0=禁用',
  created_at    DATETIME(3)  NOT NULL,
  updated_at    DATETIME(3)  NOT NULL,
  created_by    VARCHAR(64)  NULL,
  updated_by    VARCHAR(64)  NULL,
  is_deleted    TINYINT(1)   NOT NULL DEFAULT 0,
  version       INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_app_user_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE auth_refresh_token (
  id          BIGINT      NOT NULL COMMENT '雪花ID',
  user_id     BIGINT      NOT NULL COMMENT 'FK -> app_user.id',
  token_hash  CHAR(64)    NOT NULL COMMENT 'SHA-256 hex',
  expires_at  DATETIME(3) NOT NULL,
  revoked_at  DATETIME(3) NULL,
  created_at  DATETIME(3) NOT NULL,
  updated_at  DATETIME(3) NOT NULL,
  created_by  VARCHAR(64) NULL,
  updated_by  VARCHAR(64) NULL,
  is_deleted  TINYINT(1)  NOT NULL DEFAULT 0,
  version     INT         NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_auth_refresh_token_hash (token_hash),
  KEY idx_auth_refresh_token_user_active (user_id, revoked_at, expires_at),
  CONSTRAINT fk_auth_refresh_token_user FOREIGN KEY (user_id) REFERENCES app_user(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
```

决策说明：

- **不建资料表/角色表**：展示名与头像只有两个字段；MVP 只有 `user/admin` 两种角色，低基数短码足够。
- **`email` 唯一且 NOT NULL**：MySQL 唯一索引允许多个 NULL，必须避免；`utf8mb4_general_ci` 使大小写不同的邮箱也冲突。
- **复合索引 `(user_id, revoked_at, expires_at)`**：左前缀满足外键索引要求，同时支撑「撤销某用户全部有效令牌」。
- **逻辑删除与邮箱复用**：`is_deleted=1` 的用户仍占用邮箱唯一键；MVP 不做邮箱回收，后续如需复用另开 change。
- **不加 `email_verified`、`last_login_at`**：当前没有邮件/风控消费者，加了就是无主字段。

### D3: 令牌模型

**Access Token**：JWT，HS256，30 分钟。

| Claim | 值 |
|---|---|
| `sub` | 用户雪花 ID 十进制字符串 |
| `role` | `user` / `admin` |
| `iss` | `wanderchina` |
| `iat` / `exp` | 签发/过期时间 |
| `jti` | UUID，为将来 denylist 留位 |

不把 email 放进 JWT，避免 PII 随 token 扩散。

**Refresh Token**：32 字节 `SecureRandom` → Base64 URL 无 padding（43 字符），14 天。数据库只存 SHA-256 十六进制（64 字符），原文只在响应中返回一次。

**轮换与重放**：

1. `refresh` 对传入 token 求哈希，按 `token_hash` 加 `PESSIMISTIC_WRITE` 行锁查询。
2. 未找到 → 401。
3. `revoked_at` 非空（重放）→ 撤销该用户全部未撤销令牌 → 401。
4. `expires_at` 已过或用户被禁用/删除 → 401。
5. 正常：旧令牌写 `revoked_at`，插入新令牌，签发新 Access Token。

并发刷新可能被重放检测误判：前端必须单飞刷新 + 跨标签页串行（D9）。这是安全优先的取舍，见 R3。

**事务边界**：`refresh` 标注 `@Transactional(noRollbackFor = AuthException.class)`。重放/禁用场景必须先批量撤销再抛 401；默认回滚会把撤销一起回滚，导致重放检测失效。刷新方法内写操作仅限轮换与撤销，因此该设置不会掩盖其它写入失败。

**登录时序**：邮箱不存在时也执行一次 `BCryptPasswordEncoder.matches(raw, dummyHash)`，降低通过响应时间枚举账号的可能。

**禁用即时生效**：JWT 过滤器每次请求按 `sub` 查 `app_user` 并检查 `status=1`、`is_deleted=0`；被封禁用户即使 Access Token 未过期也立即 401。代价是每个认证请求一次主键查询，MVP 可接受。授权 authorities 以数据库 `role` 为准，JWT 的 `role` 仅作冗余/审计，避免降权后旧 token 保留高权限。

### D4: Security 链与放行矩阵

`SecurityConfig` 关键配置：

```java
http
    .csrf(AbstractHttpConfigurer::disable)
    .cors(AbstractHttpConfigurer::disable)          // 同源走 Vite proxy，无跨域
    .formLogin(AbstractHttpConfigurer::disable)
    .httpBasic(AbstractHttpConfigurer::disable)
    .logout(AbstractHttpConfigurer::disable)
    .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
    .exceptionHandling(e -> e
        .authenticationEntryPoint(restAuthenticationEntryPoint)
        .accessDeniedHandler(restAccessDeniedHandler))
    .authorizeHttpRequests(a -> a
        .requestMatchers(HttpMethod.GET, "/api/auth/me").authenticated()   // 必须先于 /api/auth/**
        .requestMatchers("/api/auth/**").permitAll()
        .requestMatchers(HttpMethod.GET, "/api/spots/**", "/api/hello").permitAll()
        .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html", "/error").permitAll()
        .anyRequest().authenticated())
    .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
```

`JwtAuthenticationFilter` MUST NOT 以 `@Component` 交给 Boot 自动注册：否则它会同时成为容器级 Servlet Filter，在安全链之外再执行一次。由 `SecurityConfig` 构造并加入链，或注册 `FilterRegistrationBean` 并 `setEnabled(false)`。

放行矩阵：

| 路径 | 方法 | 访问 | 说明 |
|---|---|---|---|
| `/api/auth/me` | GET | 认证 | 放在 `/api/auth/**` 之前 |
| `/api/auth/**` | 任意 | 匿名 | 满足用户「放行 auth」要求；新增 auth 子路径需 review |
| `/api/spots/**` | GET | 匿名 | 现有只读 API 不回归；未来写接口不会被误放行 |
| `/api/hello` | GET | 匿名 | 既有骨架测试不回归 |
| `/v3/api-docs/**`、`/swagger-ui/**`、`/swagger-ui.html` | 任意 | 匿名 | prod 由 springdoc 关闭，仍应得到 404 而非 401 |
| `/error` | 任意 | 匿名 | 避免错误转发被二次拦截 |
| 其它 | 任意 | 认证 | 默认拒绝 |

**现有测试的处置**：

- `HelloControllerTests`、`SpotApiTests` 保留 Security 过滤器，作为「公开端点不回归」的真实证据。
- `OpenApiProdDisabledTests` 保留过滤器，验证 docs 放行 + springdoc 关闭后为 404。
- `GlobalExceptionHandlerTests` 改用 `@AutoConfigureMockMvc(addFilters = false)`：它断言的是 MVC 异常包装，不是认证；`/api/boom` 与未知路由在全局认证下会先被 401 拦截，继续开过滤器会让测试测不到目标行为。安全矩阵由新的 `AuthApiTests` 覆盖。
- 未认证访问未知路径现在返回 401 而不是 404，这是默认拒绝的预期行为；旧测试在关闭过滤器后仍验证 404 处理链。
- `AuthApiTests` 额外覆盖：未知路径无 token → 401 JSON；携带有效 token → 404 Result，证明 `GlobalExceptionHandler` 在认证后仍可达。

### D5: 密钥管理

`application.yml`：

```yaml
wanderchina:
  auth:
    jwt:
      secret: ${JWT_SECRET}
      issuer: wanderchina
      access-token-ttl: 30m
      refresh-token-ttl: 14d
```

- **无默认值**：未设置 `JWT_SECRET` 时 Spring 占位符解析失败，应用启动失败；不生成随机默认密钥。
- `JwtService` 构造时校验 UTF-8 字节数 ≥32，不足则抛 `IllegalStateException("JWT_SECRET must be at least 32 bytes")`。
- `application-test.yml` 使用 `${JWT_SECRET:${random.uuid}}`：优先读环境变量，未注入时由 Spring Boot 在运行期生成随机 UUID 作为 36 字符密钥；**不写任何字面量密钥**，test profile 永不用于生产。
- e2e 不在 yml 写密钥；由 Playwright 后端 `webServer.env` 注入运行时随机值（D8）。
- 本地 dev 启动前必须设置环境变量，例如 PowerShell：`$env:JWT_SECRET = "<至少 32 字节的随机值>"`，再执行 `mvn -f backend/pom.xml spring-boot:run`。
- 任何日志不得输出 `secret`、完整 JWT、refresh token 或密码；异常消息只给安全文案。

### D6: API 契约

| 方法 | 路径 | 认证 | 请求体 | 成功 |
|---|---|---|---|---|
| POST | `/api/auth/register` | 匿名 | `{email,password,displayName}` | 201 `Result<AuthResponse>` |
| POST | `/api/auth/login` | 匿名 | `{email,password}` | 200 `Result<AuthResponse>` |
| POST | `/api/auth/refresh` | 匿名 | `{refreshToken}` | 200 `Result<AuthResponse>` |
| POST | `/api/auth/logout` | 匿名 | `{refreshToken}` | 200 `Result<Void>`（`data=null`） |
| GET | `/api/auth/me` | Bearer | — | 200 `Result<UserProfileDto>` |

`AuthResponse`：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "accessToken": "<jwt>",
    "refreshToken": "<opaque>",
    "tokenType": "Bearer",
    "expiresIn": 1800,
    "user": {
      "id": "4000000000000000001",
      "email": "e2e.traveler@wanderchina.test",
      "displayName": "E2E Traveler",
      "avatarUrl": null,
      "role": "user"
    }
  }
}
```

`UserProfileDto` 的 `id` 为 Long，经现有 `JacksonConfig` 序列化为字符串；测试断言 `\d+` 字符串。

DTO 归一化与校验：`RegisterRequest`/`LoginRequest` 的 compact constructor 先对 email 做 trim + lowercase，再由 `@Email` 校验；密码只加 `@NotBlank`，8–72 字节由 `AuthService` 按 UTF-8 精确校验（避免 `@Size` 的字符数与字节数错位）。

注册写库使用 `saveAndFlush` 并捕获 `DataIntegrityViolationException` 转 409，覆盖并发注册竞态；`existsByEmail` 预检查仅用于常见路径的友好提示。

类与包：

- `controller/AuthController`
- `service/AuthService`、`service/JwtService`
- `security/JwtAuthenticationFilter`、`security/RestAuthenticationEntryPoint`、`security/RestAccessDeniedHandler`、`security/AuthPrincipal`
- `config/SecurityConfig`、`config/JwtProperties`、`config/AuthConfig`（`Clock`）
- `dto/auth/RegisterRequest`、`LoginRequest`、`RefreshRequest`、`LogoutRequest`、`AuthResponse`、`UserProfileDto`（record + Jakarta Validation）
- `entity/AppUser`、`entity/AuthRefreshToken`
- `repository/AppUserRepository`、`repository/AuthRefreshTokenRepository`
- `exception/AuthException`

### D7: 错误语义

| HTTP | 触发 | 安全文案 |
|---|---|---|
| 400 | 参数校验失败、JSON 不可读、密码 >72 字节 | 首个字段错误信息或 `invalid request` |
| 401 | 邮箱不存在/密码错误/禁用、缺失/过期/签名错误 token、无效 refresh | `invalid email or password` / `invalid or expired token` / `unauthorized` |
| 403 | 已认证但角色不足（为未来预留） | `forbidden` |
| 409 | 注册邮箱重复 | `email already registered` |
| 500 | 未捕获异常 | `internal error` |

- 所有失败保持既有约定：`code=1`、`data=null`；HTTP status 是主要区分手段。
- 401 由 `RestAuthenticationEntryPoint` 写出，带 `WWW-Authenticate: Bearer`、`Content-Type: application/json;charset=UTF-8`；403 由 `RestAccessDeniedHandler` 写出。
- 新增 `AuthException(HttpStatus, String)`；`GlobalExceptionHandler` 增加 `AuthException`、`MethodArgumentNotValidException`、`HttpMessageNotReadableException` 处理。禁止回显异常类名、SQL、堆栈。
- 注册重复必然暴露邮箱已存在（409），这是 UX 取舍；登录保持统一 401 不可枚举。

### D8: E2E 种子与 Playwright

`R__e2e_seed.sql` 末尾追加：

```sql
-- 固定测试用户：仅 e2e；明文口令只用于 e2e 夹具（frontend/e2e/fixtures.ts），不得进入生产配置/日志。
INSERT INTO app_user (
  id, email, password_hash, display_name, avatar_url, role, status, created_at, updated_at
)
VALUES (
  4000000000000000001,
  'e2e.traveler@wanderchina.test',
  '<BCrypt(cost=10) of E2ePassw0rd!>',
  'E2E Traveler', NULL, 'user', 1,
  '2026-11-01 09:00:00.000', '2026-11-01 09:00:00.000'
)
ON DUPLICATE KEY UPDATE
  password_hash = VALUES(password_hash),
  display_name = VALUES(display_name),
  avatar_url = VALUES(avatar_url),
  role = VALUES(role),
  status = VALUES(status),
  is_deleted = 0,
  updated_at = VALUES(updated_at);
```

- 哈希在实现阶段用 `BCryptPasswordEncoder(10)` 生成，写入后必须能用明文 `E2ePassw0rd!` 登录；不得把明文写进 SQL 注释或生产配置。
- `R__` 是 repeatable，checksum 变化会在既有 `wanderchina_e2e` 上重跑；V2 先于 repeatable 执行，表已存在。
- `frontend/e2e/fixtures.ts` 增加：

```ts
export const E2E_USER_ID = '4000000000000000001'
export const E2E_USER_EMAIL = 'e2e.traveler@wanderchina.test'
export const E2E_USER_PASSWORD = 'E2ePassw0rd!'
export const E2E_USER_DISPLAY_NAME = 'E2E Traveler'
```

- `playwright.config.ts` 后端 webServer 增加运行时随机密钥，避免硬编码：

```ts
import { randomUUID } from 'node:crypto'

const e2eJwtSecret = `e2e-${randomUUID()}-${randomUUID()}`

// ...
webServer: [
  {
    command: 'mvn -f backend/pom.xml spring-boot:run -Dspring-boot.run.profiles=e2e',
    cwd: '..',
    url: 'http://localhost:8081/api/spots',
    timeout: 180_000,
    reuseExistingServer: false,
    env: { JWT_SECRET: e2eJwtSecret },
  },
  // 前端 webServer 不变
]
```

`reuseExistingServer: false` 保证不会复用一个没有正确密钥的旧后端。

### D9: 前端 Token 存储（Pinia + localStorage，用户拍板）

本 change 不安装 Pinia；以下为 `auth-identity-ui` 必须遵守的契约：

- 安装 `pinia`，新增 `src/stores/auth.ts`；应用启动时从 localStorage hydrate。
- localStorage key：
  - `wanderchina.auth.accessToken`
  - `wanderchina.auth.refreshToken`
  - `wanderchina.auth.user`（可选，仅展示用）
- axios 请求拦截器加 `Authorization: Bearer <accessToken>`；401 时执行**单飞刷新**（同一时刻只允许一个 refresh 请求，其余请求排队），刷新失败则清空 store 并跳转登录。
- 禁止把 token 放进 URL、日志、错误上报；登出必须同时清 localStorage 与服务端 refresh token。
- 跨标签页用 `BroadcastChannel` 或 `storage` 事件同步登录态，降低并发刷新触发重放检测的概率。

**XSS 风险（必须正视）**：

- localStorage 对同源任意 JavaScript 可读。一旦发生 XSS，攻击者可同时拿走 Access 与 Refresh Token，后者有效期 14 天，等同于账号接管。
- 该风险无法通过前端代码完全消除；这是选择 localStorage 的代价。

**已落地/可落地的缓解**：

- 全仓检索 `v-html`/`innerHTML`/`dangerously` 为 **0**；详情页等所有后端文本均用 Vue 插值，默认 HTML 转义。
- 禁止新增 `v-html`；如未来确需富文本，必须先过 DOMPurify 等白名单清洗，并在独立 change 评审。
- CSP（`script-src 'self'` 等）在部署 change 中补充；第三方脚本默认不引入。
- Access Token 仅 30 分钟；Refresh 轮换 + 重放检测 + 登出撤销，缩短被盗窗口。
- 不把 token 写入日志/监控；错误上报前脱敏。

**残余风险与迁移路径**：若安全评审要求消除 localStorage 读取面，改为「Access Token 内存 + Refresh Token HttpOnly/Secure/SameSite=Lax Cookie」，需要 CORS credentials、CSRF 防护与服务端 Cookie 解析，另开 change；不得在本 change 中顺手引入。

### D10: 测试策略（TDD）

**RED**：先写 `AuthApiTests`（注册/登录/me/刷新/登出/公开端点），在 V2 与 Security 未实现时运行 `mvn test`，预期出现 401/404/表不存在等失败并记录证据；再写 `JwtServiceTests`（固定 `Clock` 的过期、claims、短密钥）。

**GREEN**：按 D2 → D5 → D3/D4 → D6/D7 的顺序实现，直到：

- `AuthApiTests` 全绿；
- `JwtServiceTests` 全绿；
- 既有 `SpotApiTests`、`HelloControllerTests`、`OpenApiProdDisabledTests` 全绿（证明公开端点不回归）；
- `GlobalExceptionHandlerTests` 在关闭过滤器后全绿；
- e2e 种子登录与 6 条景点验证通过。

**关键用例**：注册 201 + BCrypt + 邮箱小写；重复 409；校验 400；登录成功/失败/禁用统一 401；me 无 token/坏 token/有效 token；未知路径无 token 401、有 token 404；refresh 轮换、旧 token 401、重放撤销全部；logout 幂等；`GET /api/spots` 与 `/api/hello` 匿名 200；`/v3/api-docs` 在 test+prod 为 404。

**命令**：

```powershell
mvn -f backend/pom.xml test
cd frontend; npm test
cd frontend; npm run test:e2e
cd frontend; npm run build
```

### D11: 依赖与版本

| 依赖 | 版本 | 用途 |
|---|---|---|
| `spring-boot-starter-security` | Boot 管理 | 过滤器链、BCrypt、认证异常 |
| `spring-boot-starter-validation` | Boot 管理 | `@Valid`、`@Email`、`@Size` |
| `io.jsonwebtoken:jjwt-api` | 0.12.6 | JWT API |
| `io.jsonwebtoken:jjwt-impl` | 0.12.6（runtime） | JWT 实现 |
| `io.jsonwebtoken:jjwt-jackson` | 0.12.6（runtime） | Claims JSON |

不引入 `spring-security-oauth2-*`；当前是自建账号，不是 OAuth2 资源服务器。

## Risks / Trade-offs

| # | 风险 | 影响 | 处置 |
|---|---|---|---|
| R1 | localStorage 被 XSS 读取 | 账号接管 | 无 `v-html`、Vue 转义、短 Access、刷新轮换/撤销、CSP 后续；残余风险明确接受 |
| R2 | `JWT_SECRET` 缺失/过短 | 启动失败 | 失败即停，不生成默认密钥；部署清单写入 env |
| R3 | 并发刷新触发重放检测 | 误登出 | 前端单飞 + 跨标签页同步；接受极小概率 |
| R4 | Security 误伤公开接口 | 景点/Hello/文档 401 | 显式矩阵 + 回归测试；`/api/boom` 测试关闭过滤器 |
| R5 | 注册 409 暴露邮箱存在 | 枚举 | 登录统一 401；注册 UX 取舍 |
| R6 | BCrypt 72 字节截断 | 安全/行为不一致 | 服务层按 UTF-8 字节校验，>72 返回 400 |
| R7 | 日志泄漏 token/密钥 | 安全 | 禁止打印；异常文案固定；测试含“不泄漏”断言 |
| R8 | 既有库执行 V2 | 迁移风险 | 仅加表不改旧表；生产先备份；forward-only |
| R9 | 无登录限流 | 暴力破解 | 明确 Non-Goal，后续安全加固 change；上线前评估网关限流 |
| R10 | 每请求查用户 | 性能 | 主键查询，MVP 可接受；后续可加 token version/缓存 |
| R11 | test/e2e 测试密钥被误用 | 生产风险 | test 用 `${random.uuid}` 运行时随机，e2e 用 `randomUUID()`；生产只允许 `${JWT_SECRET}` |

## Migration Plan

1. 部署后端前设置 `JWT_SECRET`（≥32 字节随机值），再启动应用；Flyway 自动执行 V2。
2. dev/test/e2e 三库各自迁移；无历史用户，无需回填。
3. 前端现有页面不发 auth 请求，部署顺序不敏感；登录 UI 在 `auth-identity-ui` 接入。
4. 回滚只回滚应用版本，不删表（表和旧代码共存无害）；如需纠正 schema，新增 V3，禁止修改 V2。
5. e2e 夹具变更后首次运行会因 `R__` checksum 变化重跑；验证用户仍只有一行、景点仍 6 条。

## Test Plan

- **RED 证据**：新增 `AuthApiTests` 后先跑 `mvn test`，记录未实现时的失败（表不存在/401/404）。
- **GREEN**：实现后跑 `mvn test`，要求 Auth 用例 + 既有 10 个用例全绿。
- **E2E 种子**：以 e2e profile 启动，`POST /api/auth/login` 用 `e2e.traveler@wanderchina.test` / `E2ePassw0rd!` 得 200；`GET /api/spots` 仍 6 条；重启一次仍只有一行用户。
- **回归**：`npm test` 33/33；`npm run test:e2e` 9/9；`npm run build` 通过。
- **密钥扫描**：全仓检索 `JWT_SECRET`，确认只有占位符与明确测试值；检索常见密钥关键词，确认无真实密钥。
