# 用户鉴权核心 (auth-identity-core)

## Why

P0 景点闭环（首页、列表、详情）与 E2E 基建已完成，下一步社区（P1）需要稳定身份：帖子作者、编辑/删除归属、审核封禁、实名合规都以账号为前提。当前后端没有任何用户表、没有 Spring Security，前端也没有登录态；若先做社区 CRUD，后续补 `author_id`、权限与审核对象会触发 Flyway 迁移和权限返工。

本 change 只交付**鉴权后端核心**：身份表、JWT 签发/校验、注册/登录/刷新/登出/me、安全边界与测试。登录 UI、Pinia 状态、社区表与合规方案另开 change，避免把「身份底座」和「社区业务」混在一个变更里。

## What Changes

- **依赖**：引入 Spring Security、Bean Validation 与 jjwt（HS256）；不引入 OAuth2 客户端。
- **数据库**：新增 `V2__create_auth_tables.sql`，只建 `app_user` 与 `auth_refresh_token` 两张表，严格遵守 §6（雪花 BIGINT、BaseEntity 公共字段、逻辑删除、乐观锁、外键显式索引）。
- **Auth API**：`POST /api/auth/register|login|refresh|logout`、`GET /api/auth/me`；统一 `Result` 包装，401/403 返回 JSON 而非 HTML。
- **令牌策略**：Access Token 为 30 分钟 JWT；Refresh Token 为 256-bit 不透明随机串，14 天，只存 SHA-256 哈希，刷新即轮换并检测重放。
- **安全边界**：`GET /api/spots/**`、`/api/hello`、OpenAPI、`/error` 与匿名 auth 端点放行；`/api/auth/me` 及其它未声明路径需认证；STATELESS，关闭 CSRF/formLogin/httpBasic。
- **密钥**：`application.yml` 只引用 `${JWT_SECRET}`，无默认值；缺失或不足 32 字节启动失败，禁止硬编码。
- **E2E 夹具**：`R__e2e_seed.sql` 增加固定测试用户（BCrypt），Playwright 后端 webServer 注入运行时随机测试密钥；现有 9 条景点 E2E 不回归。
- **测试**：新增 Auth 集成测试与 JWT 单元测试，覆盖注册/登录/刷新轮换/重放/登出/me/401/景点公开；既有 `mvn test`、`npm test`、E2E、build 全绿。

## Impact

- 后端：`pom.xml`；`application.yml`、`application-test.yml`；`db/migration/V2__create_auth_tables.sql`；`entity/`、`repository/`、`dto/auth/`、`service/`、`controller/`、`config/`、`security/`、`exception/`；`db/e2e/R__e2e_seed.sql`。
- 测试：新增 `AuthApiTests`、`JwtServiceTests`；`GlobalExceptionHandlerTests` 仅调整 MockMvc 过滤器开关（断言不变），原因见 design D4。
- 前端：`playwright.config.ts` 注入 e2e JWT 密钥；`e2e/fixtures.ts` 增加测试用户常量。**无登录 UI、无 Pinia 安装、无页面结构改动。**
- 数据库：dev/test/e2e 各自执行 V2；e2e 种子新增 1 个用户。无社区表。
- 兼容性：现有景点只读 API 保持匿名可访问；`/api/hello` 与 springdoc 路径不回归。

## Non-Goals

- 登录/注册页面、Pinia auth store、路由守卫、401 拦截器（留给 `auth-identity-ui`）。
- 邮箱验证、找回密码、邮件服务、OAuth/社交登录、MFA。
- 角色管理后台、细粒度权限、管理员审核接口。
- 登录限流/账号锁定、刷新令牌清理任务、设备管理（安全加固 change）。
- 社区帖子/评论/点赞与合规方案（`community-*`）。
- CORS 白名单、HTTPS/HSTS、生产密钥轮换流程。
- 为「以后可能用到」而增加 `email_verified`、`last_login_at`、`user_profile`、`role` 表等列/表。
