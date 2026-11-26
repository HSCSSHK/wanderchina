# Design: init-skeleton

## Context

AGENTS.md 锁定了技术栈与硬规则，但代码层几乎为空：`backend/` 无工程，`frontend/` 仅有 Vite 脚手架（Vue 3.5.44 / Vite 8.3.6 / TS 6.0.3 / vue-tsc 3.3.14），缺 Element Plus、SCSS、测试框架、dev proxy。本 change 只解决"跑通最小端到端链路"，为后续业务 change 提供已验证的地基。

三个已确认决策（来自用户）：
1. 本步引入 Vitest，前端测试框架就位——TDD 前后端都要覆盖，不能后补。
2. Java 包根 `com.wanderchina`，启动类 `com.wanderchina.WanderChinaApplication`。
3. 薄验收——前后端能起、前端经 proxy 调 `/api/hello` 展示结果即可；完整 CRUD 留下一 change。

## Goals / Non-Goals

**Goals**
- 后端 Spring Boot 3.3.x 工程可启动、可测试，暴露 `GET /api/hello` 与 OpenAPI schema。
- 前端补齐锁定栈依赖，可启动、可测试，经 dev proxy 消费 `/api/hello` 并渲染。
- 端到端链路一次跑通，作为验收标准。

**Non-Goals**
- 不接 MySQL / JPA / Repository 持久化（避免启动期依赖外部 DB，与薄验收冲突）。
- 不做完整 CRUD、用户管理、鉴权、路由/状态管理的业务化。
- 不引入 CI/CD、Docker、多模块 Maven。
- 不做鉴权/越权控制、不做接口限流：`/api/hello` 为无参、无写操作的只读常量接口，限流/鉴权随下一个带用户输入的接口引入时再评估。

## Decisions

### D1: 后端 Maven 单模块，包根 com.wanderchina

- 单模块 `backend/pom.xml`，parent = `spring-boot-starter-parent` 3.3.x，`java.version=17`，groupId `com.wanderchina`。
- 依赖仅 `spring-boot-starter-web` + `spring-boot-starter-test` + `springdoc-openapi-starter-webmvc-ui`（2.x）。
- 包结构镜像分层约定，为下一 change 预留目录：
  ```
  com.wanderchina/
    WanderChinaApplication.java
    controller/HelloController.java
    service/HelloService.java        (+ impl/ 若需接口/实现分离)
    dto/Result.java                  统一响应包装 code/message/data
    config/OpenApiConfig.java
  ```
  `repository/` `entity/` 目录随 CRUD change 引入，本 change 不建空壳（YAGNI）。

### D2: 分层落到 Hello——Controller→Service，无 Repository

- `HelloController` 只做入参接收 + 调 `HelloService.greeting()` + 包 `Result`。业务（问候消息生成）在 Service。
- 硬规则"禁止 Controller 直接访问 Repository"天然满足：hello 无数据访问，故不引入 Repository。这是薄骨架下的正确取舍，非违规。

### D3: 统一响应 Result + 全局异常 + OpenAPI

- **`Result<T>` 确切定义**（跨端契约地基，钉死）：
  ```java
  public class Result<T> {
      int code;       // 0 = 成功；非 0 = 业务失败（本 change 约定失败从 1 起）
      String message; // 成功 "ok"；失败为可展示给用户的简短原因
      T data;         // 成功为载荷（可为 null）；失败固定 null
  }
  ```
  JSON 序列化字段名恰为 `code`/`message`/`data`。`/api/hello` 返回 `Result<String>`，成功即 `{"code":0,"message":"ok","data":"<问候>"}`。
- **全局异常**：新增 `@RestControllerAdvice`（如 `GlobalExceptionHandler`），将未捕获异常统一转 `Result`（`code!=0`、`data=null`）；**不回显内部栈/SQL/类名**，详细堆栈只进服务端日志（对应 S1/L1）。未知路由也返回可解析的 `Result`，不出默认错误页。
- **OpenAPI profile 收敛**：springdoc 暴露 `/v3/api-docs`（及 `/swagger-ui`），但用 `springdoc.api-docs.enabled` / `springdoc.swagger-ui.enabled` 按 profile 控制——**dev/test 开，prod 默认关**，防接口结构信息泄漏。前端类型对齐后续从 schema 生成，本 change 手写最小 `HelloResponse` 类型即可。

### D4: 前端补齐锁定栈，不新增原子化 CSS

- 新增依赖：`element-plus`、`axios`、`sass`（devDep：`vitest`、`@vue/test-utils`、`jsdom`）。
- `main.ts` 全局注册 Element Plus（含内置样式）；页面用 Element Plus 组件展示。
- 目录最小化，按需创建（不建空壳）：
  ```
  src/
    api/hello.ts        封装 GET /api/hello，设超时 5000ms，返回类型化结果
    components/HelloCard.vue  展示消息 + 加载/错误态
    App.vue             挂载 HelloCard
    types/              hello 响应类型
  ```
  `router/` `stores/`（vue-router / pinia）本 change 不引入——单页 hello 用不到，避免做没要求的事。

### D5: Vite dev proxy 打通链路（跨域只在 dev，白名单 CORS）

- `vite.config.ts` 配 `server.proxy['/api'] -> http://localhost:8080`（`changeOrigin:true`）。开发期走 proxy，浏览器无跨域。
- **CORS 策略（S2/L2）**：后端仅当脱离 proxy 直连时才需 CORS。本 change **不写 `allowedOrigins=*`**；若配，仅限 dev profile 且用显式白名单（如 `http://localhost:5173`），禁与 `allowCredentials` + `*` 并存。若不需要则彻底不配，避免悬空不可验证的代码（对应验收 L2）。

### D6: 测试栈（决策 1 落地）

- **后端**：`@SpringBootTest` + `MockMvc`，RED→GREEN 先写失败测试断言 `/api/hello` 返回 200 且 `data` 非空。
- **前端**：Vitest + @vue/test-utils + jsdom。`package.json` 加 `"test": "vitest run"`（并 `vitest.config.ts` 或 vite config 内 test 段，environment: jsdom）。用例：mock `api/hello.ts`，断言 `HelloCard` 渲染出消息、错误态有反馈。

## Risks / Trade-offs

- **版本兼容**：Vite 8 属较新版本，需确认 element-plus / vitest / @vitejs/plugin-vue 与其兼容；实施时以能安装、能跑测试为准，必要时锁定可用版本。
- **无 DB 的"分层完整性"观感**：hello 不体现 Repository 层。取舍已在 D2 说明，CRUD change 补齐；不在骨架期为凑三层接 MySQL。
- **openspec CLI 不在 agent PATH**：工件手工按标准结构落盘，`validate/archive` 依赖用户侧 CLI；若格式有偏差，以 CLI 校验结果为准回修。

## Migration Plan

纯新增骨架，无数据迁移、无破坏性变更。落地顺序：后端可启动可测 → 前端补依赖可启动 → 前端测试就位 → 两端联调 proxy 打通。

## Open Questions

- 问候消息的具体文案内容（供人工目测）——实施时定一个，非阻塞。（`Result.code/message` 语义已在 D3 钉死：`code=0` 为成功。）
- springdoc 与 Element Plus 的确切版本号在实施首步（能安装/能编译）时钉死。
