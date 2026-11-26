# Tasks: auth-identity-core

## 1. 基线与依赖

- [x] 1.1 记录基线：`mvn -f backend/pom.xml test`（10 个）、`cd frontend; npm test`（33 个）、`npm run test:e2e`（9 个）、`npm run build` 当前全绿；确认本机 MySQL 可用
- [x] 1.2 `pom.xml` 增加 `spring-boot-starter-security`、`spring-boot-starter-validation`、`jjwt-api/impl/jackson 0.12.6`；执行 `mvn -q -DskipTests compile` 确认依赖可解析
- [x] 1.3 确认数据库中不存在 `app_user`/`auth_refresh_token`；备份 `wanderchina_dev`（V2 前留退路）
- [x] 1.4 确认范围：本 change 不安装 Pinia、不新增前端页面、不建社区表

## 2. 契约与 RED

- [x] 2.1 新增 `backend/src/test/java/com/wanderchina/AuthApiTests.java`，覆盖：注册 201 + BCrypt + 邮箱小写、重复邮箱 409、参数非法 400、登录成功、错误密码/未知邮箱/禁用账号统一 401、`/api/auth/me` 无 token/坏 token/有效 token、未知路径无 token 401/有 token 404、refresh 轮换、旧 refresh 401、重放撤销全部、logout 幂等、`/api/spots` 与 `/api/hello` 匿名 200
- [x] 2.2 新增 `JwtServiceTests`：claims（sub/role/iss/jti/exp）、30 分钟边界、过期 token 拒绝、短密钥启动校验
- [x] 2.3 执行 `mvn -f backend/pom.xml test`，记录 RED 证据（未实现时的 401/404、表不存在或编译失败），确认不是环境问题

## 3. V2 迁移与持久层

- [x] 3.1 新增 `backend/src/main/resources/db/migration/V2__create_auth_tables.sql`：按 design D2 建 `app_user`、`auth_refresh_token`，含唯一键、外键与 `(user_id, revoked_at, expires_at)` 索引
- [x] 3.2 新增 `entity/AppUser`（继承 `BaseEntity`，`@SQLRestriction("is_deleted = 0")`）与 `repository/AppUserRepository`（`findByEmail`、`existsByEmail`）
- [x] 3.3 新增 `entity/AuthRefreshToken` 与 `repository/AuthRefreshTokenRepository`：`findByTokenHashForUpdate`（`PESSIMISTIC_WRITE`）、`revokeAllActiveByUserId`
- [x] 3.4 在 test 库启动一次，确认 Flyway 执行 V2 且两表结构/索引正确；`mvn test` 中既有景点用例仍可运行

## 4. 密钥与 JWT

- [x] 4.1 `application.yml` 增加 `wanderchina.auth.jwt.secret: ${JWT_SECRET}`（无默认值）、`issuer`、`access-token-ttl: 30m`、`refresh-token-ttl: 14d`
- [x] 4.2 `application-test.yml` 增加 `${JWT_SECRET:${random.uuid}}`（运行期随机，不写字面量密钥），注释标明仅 test profile 使用
- [x] 4.3 新增 `config/JwtProperties`（record + `@ConfigurationProperties` + 校验）、`config/AuthConfig`（`Clock` bean）、`service/JwtService`（HS256、claims、jjwt parser 使用注入 Clock、密钥 ≥32 字节校验）
- [x] 4.4 运行 `JwtServiceTests` 转 GREEN；另用空/短 `JWT_SECRET` 启动一次，确认应用失败且异常信息明确
- [x] 4.5 检查日志与异常：不输出 secret、完整 token、password

## 5. Security 链

- [x] 5.1 新增 `security/AuthPrincipal`、`security/JwtAuthenticationFilter`：解析 `Authorization: Bearer`，校验签名/issuer/exp，按 `sub` 查用户并检查 `status=1`/未删除，authorities 用 DB role；无效 token 不抛异常，留待 EntryPoint；不要用 `@Component` 让 Boot 重复注册为容器 Filter
- [x] 5.2 新增 `security/RestAuthenticationEntryPoint`（401 + `WWW-Authenticate: Bearer` + Result JSON）与 `security/RestAccessDeniedHandler`（403 + Result JSON）
- [x] 5.3 新增 `config/SecurityConfig`：STATELESS、关闭 CSRF/formLogin/httpBasic/logout；`GET /api/auth/me` 先于 `/api/auth/**`；`GET /api/spots/**`、`GET /api/hello`、docs、`/error` 放行；`anyRequest().authenticated()`
- [x] 5.4 `GlobalExceptionHandlerTests` 改为 `@AutoConfigureMockMvc(addFilters = false)`，断言不变；在类注释说明它验证异常包装而非认证
- [x] 5.5 运行 `mvn test`：`HelloControllerTests`、`SpotApiTests`、`OpenApiProdDisabledTests`、`GlobalExceptionHandlerTests` 全绿，证明公开端点未回归

## 6. Auth 业务与端点

- [x] 6.1 新增 `dto/auth` 请求/响应 record：`RegisterRequest`（email compact constructor 归一化 + `@Email`；password 仅 `@NotBlank`）、`LoginRequest`（同 email 归一化）、`RefreshRequest`、`LogoutRequest`、`AuthResponse`、`UserProfileDto`；新增 `exception/AuthException`
- [x] 6.2 新增 `service/AuthService`：邮箱 trim+lowercase、密码 UTF-8 8–72 字节、BCrypt cost 10、重复邮箱 409（`saveAndFlush` 捕获并发唯一键）、登录统一 401（含 dummy hash 等时）、refresh 轮换/重放撤销（`noRollbackFor=AuthException` 保证撤销提交）、logout 幂等、me 查询；写操作加 `@Transactional`
- [x] 6.3 新增 `controller/AuthController`：register 201、login/refresh/logout 200、me 200；仅委托 Service，不写业务逻辑
- [x] 6.4 `GlobalExceptionHandler` 增加 `AuthException`、`MethodArgumentNotValidException`、`HttpMessageNotReadableException`；失败统一 `code=1`、`data=null`、不回显堆栈
- [x] 6.5 运行 `mvn test`，`AuthApiTests` 与 `JwtServiceTests` 全绿；补测密码 73 字节、坏 Bearer、禁用用户持有效 token 三个边界
- [x] 6.6 手工验证：无 token `GET /api/spots` 为 200；无 token `GET /api/auth/me` 为 401 JSON；登录后可访问 me

## 7. E2E 种子与 Playwright

- [x] 7.1 用 `BCryptPasswordEncoder(10)` 为 `E2ePassw0rd!` 生成哈希，在 `R__e2e_seed.sql` 末尾按 design D8 写入固定用户 `4000000000000000001`；明文只进 `e2e/fixtures.ts`
- [x] 7.2 `frontend/e2e/fixtures.ts` 增加 `E2E_USER_ID/E2E_USER_EMAIL/E2E_USER_PASSWORD/E2E_USER_DISPLAY_NAME`
- [x] 7.3 `frontend/playwright.config.ts` 后端 webServer 增加 `JWT_SECRET: e2e-${randomUUID()}-${randomUUID()}`，使用 `node:crypto`，不硬编码
- [x] 7.4 以 e2e profile 启动后端，使用种子账号 `POST /api/auth/login` 得 200；`GET /api/spots` 仍 6 条；重启一次，`app_user` 中该 ID 仍只有一行
- [x] 7.5 执行 `npm run test:e2e`，既有 9 条景点用例全绿（证明 Security 未误伤公开 API）

## 8. 门禁与归档

- [x] 8.1 `mvn -f backend/pom.xml test` 全绿（既有 10 + 新增 Auth/JWT 用例）
- [x] 8.2 `cd frontend; npm test` 全绿（33 个），E2E 文件未被 Vitest 收集
- [x] 8.3 `cd frontend; npm run build` 通过
- [x] 8.4 密钥与泄漏扫描：全仓无真实 JWT 密钥；`JWT_SECRET` 仅为占位符，test/e2e 仅运行时随机；日志与响应无 token/password/hash
- [x] 8.5 复查 diff：无前端页面/Pinia/社区表越界改动；V2 仅两张表；`/api/spots`、`/api/hello`、docs 放行规则与测试一致
- [ ] 8.6 归档（用户 CLI）：`openspec archive auth-identity-core`
