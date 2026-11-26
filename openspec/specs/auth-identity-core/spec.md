# auth-identity-core Specification

## Purpose

TBD - created by archiving change auth-identity-core. Update Purpose after archive.

## Requirements

### Requirement: 身份数据模型与 Flyway V2 迁移

系统 MUST 通过 `backend/src/main/resources/db/migration/V2__create_auth_tables.sql` 新增且仅新增 `app_user`、`auth_refresh_token` 两张业务表。两表 MUST 遵守 §6：雪花 `BIGINT` 主键、`BaseEntity` 公共字段（`created_at`/`updated_at`/`created_by`/`updated_by`/`is_deleted`/`version`）、InnoDB、`utf8mb4`/`utf8mb4_general_ci`。

`app_user` MUST 包含：`email`（VARCHAR(254) NOT NULL，唯一）、`password_hash`（VARCHAR(100) NOT NULL）、`display_name`（VARCHAR(50) NOT NULL）、`avatar_url`（VARCHAR(512) NULL）、`role`（VARCHAR(16) NOT NULL DEFAULT `'user'`）、`status`（TINYINT NOT NULL DEFAULT 1，1=正常，0=禁用）。MUST NOT 在本 change 增加 `email_verified`、`last_login_at` 或独立资料表。

`auth_refresh_token` MUST 包含：`user_id`（BIGINT NOT NULL，外键 → `app_user.id`）、`token_hash`（CHAR(64) NOT NULL，唯一）、`expires_at`（DATETIME(3) NOT NULL）、`revoked_at`（DATETIME(3) NULL）。MUST 为 `user_id` 建显式索引，MUST NOT 存储刷新令牌明文。

#### Scenario: 空库启动

- **WHEN** 任一 profile 连接空库并启动应用
- **THEN** Flyway 先执行 V1 建景点表，再执行 V2 建 `app_user` 与 `auth_refresh_token`
- **AND** 两表的外键、唯一键与索引按设计存在

#### Scenario: 重复启动

- **WHEN** 应用在已迁移数据库上再次启动
- **THEN** Flyway 不重复执行 V2，表结构与数据保持不变

### Requirement: 用户注册

系统 MUST 提供 `POST /api/auth/register`，接收 `email`、`password`、`displayName`，成功返回 HTTP 201 与 `Result<AuthResponse>`（含 accessToken、refreshToken、tokenType、expiresIn、user）。注册成功后 MUST 自动登录并签发令牌对。

邮箱 MUST 去除首尾空白并转为小写后存储与查询；密码 MUST 使用 BCrypt（cost 10）哈希存储；密码长度 MUST 为 8–72 字节（UTF-8），超过 72 字节 MUST 返回 400。邮箱重复 MUST 返回 409 且不创建用户。字段缺失、邮箱格式非法、密码过短、显示名长度不合法 MUST 返回 400。响应 MUST NOT 包含明文密码或 `password_hash`。

#### Scenario: 注册成功

- **WHEN** 提交未被占用的邮箱、合法密码与显示名
- **THEN** 返回 201、`code=0`，data 含非空 accessToken/refreshToken、`tokenType="Bearer"`、`expiresIn=1800`
- **AND** data.user 的 `id` 为字符串、`email` 为小写、`role="user"`、`displayName` 与请求一致
- **AND** 数据库中 `password_hash` 以 `$2` 开头且不等于明文密码

#### Scenario: 邮箱重复

- **WHEN** 使用已注册邮箱再次注册（大小写不同也视为重复）
- **THEN** 返回 409、`code!=0`、`data=null`
- **AND** 不新增用户、不签发令牌

#### Scenario: 参数非法

- **WHEN** 邮箱格式错误、密码少于 8 字节或显示名为空
- **THEN** 返回 400、`code!=0`、`data=null`
- **AND** 响应不回显异常类名或堆栈

### Requirement: 用户登录

系统 MUST 提供 `POST /api/auth/login`，接收 `email`、`password`，成功返回 HTTP 200 与 `Result<AuthResponse>`。邮箱不存在、密码错误、账号被禁用 MUST 统一返回 401 与相同消息 `invalid email or password`，MUST NOT 暴露账号是否存在。登录成功 MUST NOT 返回密码哈希。

#### Scenario: 登录成功

- **WHEN** 使用正确邮箱与密码登录
- **THEN** 返回 200、`code=0`，data 含新的 accessToken/refreshToken 与用户资料
- **AND** 数据库中新增一条未撤销的刷新令牌记录

#### Scenario: 凭据错误不可枚举

- **WHEN** 分别使用「不存在的邮箱」与「存在邮箱 + 错误密码」登录
- **THEN** 两次均返回 401、`code!=0`、`data=null`、消息完全一致

#### Scenario: 禁用账号

- **WHEN** `status=0` 的用户提交正确密码
- **THEN** 返回 401 与统一消息，不签发令牌

### Requirement: Access Token 与密钥管理

Access Token MUST 为 JWT，使用 HS256 签名，包含 `sub`（用户雪花 ID 字符串）、`role`、`iss="wanderchina"`、`iat`、`exp`、`jti`，有效期 MUST 为 30 分钟。JWT 中 MUST NOT 包含邮箱、密码或其它 PII。

JWT 密钥 MUST 从 `application.yml` 的 `wanderchina.auth.jwt.secret: ${JWT_SECRET}` 读取，MUST NOT 提供默认值或硬编码生产密钥。`JWT_SECRET` 的 UTF-8 长度 MUST ≥32 字节；缺失时应用 MUST 启动失败，不足 32 字节时 MUST 启动失败并给出明确原因。任何日志 MUST NOT 输出密钥、完整 token 或密码。

#### Scenario: 缺失或过短密钥

- **WHEN** 启动时未设置 `JWT_SECRET`，或设置的值不足 32 字节
- **THEN** 应用启动失败，不使用任何内置/默认密钥继续运行

#### Scenario: Access Token 过期

- **WHEN** 使用已过期的 Access Token 请求受保护端点
- **THEN** 返回 401 与统一 JSON 错误，不进入 Controller

### Requirement: 刷新令牌轮换与登出

系统 MUST 提供 `POST /api/auth/refresh`，接收 `refreshToken`。Refresh Token MUST 为至少 256-bit 的密码学随机不透明串，有效期 MUST 为 14 天；数据库 MUST 只保存其 SHA-256 十六进制哈希。刷新成功 MUST 返回新的 Access Token 与新的 Refresh Token，并将旧 Refresh Token 标记为已撤销（`revoked_at` 非空）。

使用已撤销的 Refresh Token MUST 返回 401，并 MUST 撤销该用户全部未撤销的 Refresh Token（重放检测）。使用不存在、已过期或属于禁用用户的 Refresh Token MUST 返回 401。

系统 MUST 提供 `POST /api/auth/logout`，接收 `refreshToken`；命中有效令牌时撤销之，未知/已撤销令牌也 MUST 返回 200（幂等），响应 `data=null`。

#### Scenario: 正常轮换

- **WHEN** 使用有效 Refresh Token 调用刷新
- **THEN** 返回 200 与全新令牌对
- **AND** 旧 Refresh Token 再次使用返回 401
- **AND** 新 Access Token 可访问 `/api/auth/me`

#### Scenario: 重放检测

- **WHEN** 同一用户存在多个有效 Refresh Token，其中一个被轮换后其旧值再次被使用
- **THEN** 返回 401，且该用户其余有效 Refresh Token 也全部失效

#### Scenario: 登出幂等

- **WHEN** 使用有效 Refresh Token 登出，随后再次登出同一令牌
- **THEN** 两次均返回 200
- **AND** 该令牌无法再用于刷新

### Requirement: 当前用户端点

系统 MUST 提供 `GET /api/auth/me`，要求 `Authorization: Bearer <accessToken>`。成功返回 HTTP 200 与 `Result<UserProfileDto>`，字段为 `id`（字符串）、`email`、`displayName`、`avatarUrl`、`role`。缺失、格式错误、过期、签名无效的令牌，或令牌对应用户已被禁用/逻辑删除时，MUST 返回 401。

#### Scenario: 携带有效令牌

- **WHEN** 使用登录获得的 Access Token 请求 `/api/auth/me`
- **THEN** 返回 200、`code=0`，用户 ID 为字符串且与登录用户一致
- **AND** 响应不含 `password_hash`

#### Scenario: 未携带令牌

- **WHEN** 不携带 `Authorization` 请求 `/api/auth/me`
- **THEN** 返回 401、`code!=0`、`data=null`
- **AND** 响应为 JSON，并带 `WWW-Authenticate: Bearer`

### Requirement: 安全边界与统一错误

Security MUST 为无状态（`SessionCreationPolicy.STATELESS`），MUST 关闭 CSRF、formLogin、httpBasic 与默认 logout。认证/授权失败 MUST 由自定义 `AuthenticationEntryPoint`/`AccessDeniedHandler` 输出 `Result` JSON（`code!=0`、`data=null`），MUST NOT 返回 HTML 或堆栈。

放行规则 MUST 至少满足：

| 路径 | 方法 | 访问 |
|---|---|---|
| `/api/auth/me` | GET | 需认证（必须先于 `/api/auth/**` 匹配） |
| `/api/auth/**` | 任意 | 匿名 |
| `/api/spots/**` | GET | 匿名 |
| `/api/hello` | GET | 匿名 |
| `/v3/api-docs/**`、`/swagger-ui/**`、`/swagger-ui.html` | 任意 | 匿名（prod 由 springdoc 关闭后自然 404） |
| `/error` | 任意 | 匿名 |
| 其它 | 任意 | 需认证 |

`GET /api/spots` 与 `GET /api/spots/{id}` 在无令牌时 MUST 保持现有 200/404 行为，MUST NOT 因引入 Spring Security 变为 401。

#### Scenario: 景点接口不回归

- **WHEN** 无 `Authorization` 请求 `GET /api/spots`
- **THEN** 返回 200、`code=0`、6 条 e2e 景点（e2e profile）或测试夹具数据（test profile）
- **AND** `GET /api/hello` 同样返回 200

#### Scenario: 受保护端点未认证

- **WHEN** 无令牌请求 `/api/auth/me` 或任何未声明路径
- **THEN** 返回 401 JSON，不进入 Controller，不泄漏路由细节

#### Scenario: 认证后未知路径

- **WHEN** 携带有效 Access Token 请求未声明路径
- **THEN** 返回 404 Result（由 `GlobalExceptionHandler` 处理），而非 401

#### Scenario: 生产环境接口文档

- **WHEN** 以 `test`+`prod` profile 请求 `/v3/api-docs`
- **THEN** 返回 404（springdoc 关闭），而非 401

### Requirement: E2E 固定测试用户

`backend/src/main/resources/db/e2e/R__e2e_seed.sql` MUST 增加一个固定测试用户，且仅在 `e2e` profile 的 Flyway locations 中执行。用户契约 MUST 为：ID `4000000000000000001`、email `e2e.traveler@wanderchina.test`、displayName `E2E Traveler`、password `E2ePassw0rd!`（BCrypt cost 10 哈希）、role `user`、status `1`。种子 MUST 使用 `INSERT ... ON DUPLICATE KEY UPDATE` 保持幂等，重复启动后该用户仍只有一行。明文口令 MUST 只用于 e2e 夹具（`frontend/e2e/fixtures.ts`），MUST NOT 出现在生产配置、日志或响应中。

#### Scenario: 种子可登录

- **WHEN** 以 `e2e` profile 启动后端，使用上述邮箱与口令调用 `POST /api/auth/login`
- **THEN** 返回 200 与令牌对
- **AND** `GET /api/spots` 仍返回 6 条景点

#### Scenario: 种子幂等

- **WHEN** 连续两次启动 e2e 后端
- **THEN** `app_user` 中该固定 ID 仍只有一行，景点仍为 6 条

### Requirement: 回归与验收门禁

本 change 完成后 MUST 满足：`mvn -f backend/pom.xml test` 全绿；`cd frontend; npm test` 全绿（既有 33 用例）；`npm run test:e2e` 全绿（既有 9 用例，景点匿名访问不回归）；`npm run build` 通过。代码库 MUST NOT 出现真实 JWT 密钥；`${JWT_SECRET}` 仅作为环境变量占位符，test 使用 `${random.uuid}` 运行时随机、e2e 使用 `randomUUID()`，MUST NOT 写任何字面量密钥。

#### Scenario: 全量门禁

- **WHEN** 依次执行后端测试、前端单测、E2E 与构建
- **THEN** 四条命令全部成功
- **AND** 测试报告与构建产物中不含密钥、完整 token 或密码
