# Tasks: init-skeleton

> 严格 RED → GREEN → REFACTOR：每个实现步骤前先有失败测试。验收一律用可执行命令（curl 断言 / JUnit / Vitest），不保留"浏览器打开看看"式人工门禁。

## 1. 后端工程与统一契约（TDD）

- [x] 1.1 建 `backend/pom.xml`：spring-boot-starter-parent 3.3.x、java.version=17、groupId `com.wanderchina`；依赖 web + test + springdoc-openapi-starter-webmvc-ui（钉可用版本）。确认 `mvn -f backend/pom.xml test` 能空跑（无源码也能构建）。
- [x] 1.2 **RED（成功契约）**：写 `HelloControllerTests`——`@SpringBootTest` + MockMvc，断言 `GET /api/hello` 返回 HTTP 200、`code == 0`、`message == "ok"`、`data` 非空字符串。运行 → 失败（无类）。
- [x] 1.3 **GREEN**：建 `com.wanderchina.WanderChinaApplication` + `dto/Result.java`（字段/语义严格照 design D3：`code` int 且 `0` 成功、`message`、`data`）+ `service/HelloService.java` + `controller/HelloController.java`（仅委托 Service，返回 `Result<String>`）。再跑 1.2 → 通过。
- [x] 1.4 **RED（异常契约）**：加 `GlobalExceptionHandlerTests`——模拟异常路径，断言返回 `Result` 且 `code != 0`、`data == null`，响应体不含 `Exception`/栈关键字；未知路由返回可解析 `Result` 而非错误页。运行 → 失败。
- [x] 1.5 **GREEN**：建 `exception/GlobalExceptionHandler.java`（`@RestControllerAdvice`），统一转 `Result`，堆栈仅入日志。跑 1.4 → 通过。
- [x] 1.6 **REFACTOR + OpenAPI profile**：核对 Controller 无业务逻辑、不碰 Repository；建 `config/OpenApiConfig.java`；`application.yml` 用 profile 控制：`dev`/`test` 下 `springdoc.api-docs.enabled=true`，`prod` 下 `false`。验收（自动）：
  - `mvn -f backend/pom.xml test` 全绿；
  - 以 `prod` profile 启动后 `curl -s -o /dev/null -w "%{http_code}" localhost:8080/v3/api-docs` 断言 `== 404`（或非 200），`dev` profile 下断言 `== 200`。

## 2. 前端依赖与结构

- [x] 2.1 `cd frontend && npm install` 后新增依赖：`element-plus`、`axios`、`sass`；devDep：`vitest`、`@vue/test-utils`、`jsdom`。确认与 Vite 8 兼容可安装。
- [x] 2.2 `main.ts` 全局注册 Element Plus（引入其样式）；确保 `npm run build`（vue-tsc + vite build）仍通过。
- [x] 2.3 建 `src/api/hello.ts`：封装 `GET /api/hello`，**设超时 5000ms**，返回类型化 `Result<HelloResponse>`；`src/types` 手写与后端对齐的类型（`code`/`message`/`data`）。

## 3. 前端 Hello 展示（TDD，含异常/空/错误路径）

- [x] 3.1 **RED**：`vitest.config.ts`（或 vite test 段，environment: jsdom）；`package.json` 加 `"test": "vitest run"`。写 `HelloCard.test.ts`，覆盖四条：① mock `api/hello.ts` 成功返回 → 渲染出 `data` 文本；② 请求失败/超时（reject）→ 渲染错误文案；③ 成功但 `data` 为空/`null` → 渲染空态；④ 挂载仅触发一次请求（断言 api 调用次数 == 1）。运行 → 失败（组件不存在）。
- [x] 3.2 **GREEN**：建 `src/components/HelloCard.vue`（Element Plus 展示 message，含加载/错误/空态），`App.vue` 挂载时调用 `api/hello.ts` 一次。跑 `cd frontend && npm test` → 全部通过。

## 4. 端到端验收（全部自动化命令，无目视门禁）

- [x] 4.1 `vite.config.ts` 配 `server.proxy['/api'] -> http://localhost:8080`（`changeOrigin:true`）。
- [x] 4.2 **后端可执行断言**：起后端（`dev` profile）后执行
  `curl -s localhost:8080/api/hello` → 断言 JSON 中 `code==0` 且 `data` 非空（脚本化，如 `curl -s ... | grep -E '"code":\s*0'` 且 data 非空）。
- [x] 4.3 **后端集成测试作为验收门**：`mvn -f backend/pom.xml test`（1.2/1.4 用例）必须通过——这是端到端契约的自动化验收，取代"打开浏览器看"。
- [x] 4.4 **前端渲染断言作为验收门**：`cd frontend && npm test`（3.1/3.2 用例）通过，其中含"页面渲染出 mock 的后端 `data` 文本"断言。
- [ ] 4.5 （可选补充，非门禁）dev proxy 链路人工目测一次：两端起后首页显示后端消息、Network 无 CORS 报错。**不作为验收判定依据。**

## 5. 收尾

- [x] 5.1 全量验证：`mvn -f backend/pom.xml test` 与 `cd frontend && npm test` 均通过；4.2 的 curl 断言通过。
- [x] 5.2 更新/确认 AGENTS.md 启动测试命令与实际一致（前端 `npm test` 现已真实存在）。
- [ ] 5.3 走归档：实现完成后把 `openspec/changes/init-skeleton/` 归档并把 delta 同步进主 `openspec/specs/`（需可用 openspec CLI）。
