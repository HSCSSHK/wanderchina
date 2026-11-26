# backend-service Specification

## Purpose

TBD - created by archiving change init-skeleton. Update Purpose after archive.

## Requirements

### Requirement: 应用可启动

后端 SHALL 提供一个基于 Spring Boot 3.3.x（Java 17）的可启动应用，Maven 坐标 groupId 为 `com.wanderchina`，启动类为 `com.wanderchina.WanderChinaApplication`，默认在 `8080` 端口提供 HTTP 服务。

#### Scenario: 无外部依赖即可启动

- **WHEN** 执行 `mvn -f backend/pom.xml spring-boot:run`
- **THEN** 应用在 8080 端口成功启动，且启动过程不依赖 MySQL 或其他外部服务

### Requirement: 统一响应结构 Result

后端所有 HTTP 接口 SHALL 返回统一包装 `Result<T>`，字段与语义 MUST 精确如下：

| 字段 | 类型 | 语义 |
| --- | --- | --- |
| `code` | `int` | 业务码；`0` = 成功，非 `0` = 业务失败（本 change 约定失败从 `1` 起） |
| `message` | `String` | 可读提示；成功为 `"ok"`，失败为可展示给用户的简短原因 |
| `data` | `T` | 业务载荷；成功可为具体值或 `null`，失败固定为 `null` |

`Result` 的 JSON 序列化字段名 MUST 恰为 `code` / `message` / `data`（不加 `@class`、不包外层）。

#### Scenario: 成功响应结构确定

- **WHEN** 一次成功的接口调用返回
- **THEN** 响应体严格为 `{"code":0,"message":"ok","data":<载荷>}`

### Requirement: Hello 接口契约

后端 SHALL 提供 `GET /api/hello`，返回 `Result<String>`，其中 `data` 为后端生成的非空问候消息字符串；问候消息的生成逻辑 MUST 位于 Service 层，Controller 仅负责接收请求并调用 Service。

#### Scenario: 请求 hello 返回问候消息

- **WHEN** 客户端发起 `GET /api/hello`
- **THEN** 返回 HTTP 200，响应体为 `{"code":0,"message":"ok","data":"<问候消息>"}` 且 `data` 为非空字符串

#### Scenario: 分层约束不可违反

- **WHEN** 检视 `HelloController` 的实现
- **THEN** 其中不包含业务逻辑，也不直接访问 Repository，仅委托 `HelloService`

### Requirement: 全局异常处理

后端 SHALL 提供基于 `@RestControllerAdvice` 的全局异常处理器，将未捕获异常统一转换为 `Result`（`code != 0`、`data` 为 `null`）。响应 MUST NOT 泄漏内部实现细节（异常栈、SQL、类名、堆栈帧）；详细堆栈仅写入服务端日志。

#### Scenario: 异常被统一包装且不泄漏堆栈

- **WHEN** 处理请求过程中抛出未捕获异常
- **THEN** 返回 `Result`（`code` 非 `0`、`data` 为 `null`、`message` 为可读文案），响应体中不含异常栈信息

#### Scenario: 未知路由不返回裸错误页

- **WHEN** 客户端请求一个不存在的接口路径
- **THEN** 返回可解析的 `Result` 错误结构，而非默认白页或堆栈页

### Requirement: 接口契约可被发现

后端 SHALL 集成 springdoc-openapi 暴露 OpenAPI schema 端点（`/v3/api-docs`）作为前后端契约来源，但该暴露 MUST 按 profile 收敛：仅在 dev/test 开启，prod profile 下默认关闭以防接口结构信息泄漏。

#### Scenario: 开发环境获取 OpenAPI schema

- **WHEN** 在 dev/test profile 下客户端请求 `/v3/api-docs`
- **THEN** 返回包含 `/api/hello` 定义的 OpenAPI JSON

#### Scenario: 生产环境默认关闭接口文档

- **WHEN** 以 prod profile 启动并请求 `/v3/api-docs` 或 swagger-ui
- **THEN** 端点不可访问（返回 404 或被禁用），不暴露接口结构

### Requirement: 后端测试可运行

后端 SHALL 提供 JUnit 5 测试，`mvn -f backend/pom.xml test` 可运行且覆盖 Hello 接口的分层行为、`Result` 结构、异常路径。

#### Scenario: 运行后端测试

- **WHEN** 执行 `mvn -f backend/pom.xml test`
- **THEN** 全部测试通过

#### Scenario: 成功路径断言结构

- **WHEN** 通过 MockMvc 调用 `GET /api/hello`
- **THEN** 断言 HTTP 200、`code == 0`、`data` 非空

#### Scenario: 异常路径断言不泄漏

- **WHEN** 触发一个抛异常的测试端点或模拟异常
- **THEN** 断言响应 `code != 0`、`data == null`，且响应体不含异常栈关键字
