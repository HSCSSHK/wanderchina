# Init Full-Stack Skeleton (init-skeleton)

## Why

仓库当前是"名义上全栈、实际上空壳"：`backend/` 是完全空目录（无 pom.xml、无源码），`frontend/` 只有 Vite 脚手架（Vue 3.5 / Vite 8 / TS 6.0），且未安装 Element Plus、无 SCSS、无测试框架、无 dev proxy。AGENTS.md 已锁定技术栈与硬规则（Controller→Service→Repository 三层、TDD、OpenSpec），但没有任何一处能真正跑起来，也没有任何 spec 固化这些约定。

在写任何业务功能之前，先立一个**能跑通端到端链路的最小骨架**，让后续每个业务 change 都落在已验证的结构与工具链上，而不是各自临时搭。

## What Changes

- **后端骨架**：新建 Maven 单模块 Spring Boot 3.3.x（Java 17）工程，包根 `com.wanderchina`，启动类 `com.wanderchina.WanderChinaApplication`；提供 `GET /api/hello`，遵循 Controller→Service 分层；统一响应 `Result<T>`（`code=0` 为成功）+ `@RestControllerAdvice` 全局异常（不回显堆栈）；集成 springdoc-openapi（prod 默认关闭）；`mvn test` 可运行 JUnit 5 测试。
- **前端骨架**：在既有 Vite 工程上补齐锁定栈——Element Plus、SCSS、axios、dev proxy（`/api -> localhost:8080`）；新增 `api/` 封装层与一个展示页，调用 `/api/hello` 并渲染返回结果。
- **前端测试**：引入 Vitest（+ @vue/test-utils + jsdom），`npm test` 可运行，覆盖 `api/` 层与展示组件（落实"TDD 前后端都要覆盖，不能后补"）。
- **端到端验收（薄标准，均为自动化可执行）**：`curl` 断言后端 `/api/hello` 返回 `code=0` 且 `data` 非空；一条 `@SpringBootTest` 集成测试断言 200+非空 data；前端 Vitest 断言页面渲染出后端返回值。不再保留“浏览器目视”作为唯一验收。（dev proxy 链路可附一次人工目测作为补充，不作关键门禁。）
- **明确不做**：完整 CRUD、数据库持久化、用户管理示例——留到下一个 change 示范分层与 Repository。

## Impact

- **Affected specs**：新增能力 `backend-service`、`frontend-client`（`openspec/specs/` 目前为空，本 change 引入首批 delta）。
- **Affected code**：`backend/**`（全新）、`frontend/package.json`、`frontend/vite.config.ts`、`frontend/src/**`（新增 `api/`、展示视图、测试）。
- **锁定栈一致性**：严格遵循 AGENTS.md——Vue 3 + Vite + TS + Element Plus、SCSS、无 React/Tailwind/AntDV；后端三层架构、springdoc 契约。
- **Database（MySQL）本 change 不接入**：为保证"无 DB 也能启动跑通链路"的薄验收，暂缓 spring-data-jpa + 数据源配置，避免启动期依赖外部 MySQL。此决策记入 design.md，Repository 层随下一个 CRUD change 落地。
- **工具链缺口**：`openspec` CLI 在 agent shell 的 PATH 上不可达（IDE 集成方式），工件按标准 spec-driven 结构手工落盘；后续 `openspec validate/archive` 需在可用 CLI 环境执行。
