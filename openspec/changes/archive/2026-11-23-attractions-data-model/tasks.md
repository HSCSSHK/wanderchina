# Tasks: attractions-data-model

> TDD 不可绕过：每组功能先 RED（失败测试）再 GREEN。所有建表走 Flyway，禁 `ddl-auto` 生成生产 schema（§6.5）。
> **前置门**：任务 0 未通过（DDL 与开放问题未签字）前，不进入实现。

## 0. 对齐与前置确认（已签字）
- [x] 0.1 用户已审阅 design.md D4 的 3 表 DDL 草案与 D5 索引计划，定稿
- [x] 0.2 开放问题敲定：O1 直连本地 MySQL 8（wanderchina_test，auto-create）+ `@Transactional` 回滚；O2 雪花 workerId 默认 0；O3 排序规则 `utf8mb4_0900_ai_ci`；O4 `category_code` 最小集 historic/natural/museum/theme_park/viewpoint
- [x] 0.3 环境：本地无 Docker、有真实 MySQL 8（root/root:3306）；数据源按 application-test.yml 配置

## 1. 持久化依赖与测试基座（使构建可运行，不含业务断言）
- [x] 1.1 `pom.xml` 新增 `spring-boot-starter-data-jpa`、`flyway-core`、`flyway-mysql`、runtime `mysql-connector-j`（无 Docker，不引入 Testcontainers/H2）
- [x] 1.2 `application.yml` 加 JPA/Flyway 公共配置（`ddl-auto: none`，Flyway 基线）+ `wanderchina.snowflake.worker-id/datacenter-id`；新增 `application-dev.yml`（dev 数据源 auto-create）与 `src/test/resources/application-test.yml`（用户指定 URL）
- [x] 1.3 骨架回归：将 Hello/GlobalException 测试纳入 `test` profile、prod-docs 测试用 `{"test","prod"}`；`mvn -f backend/pom.xml test` 现有测试仍绿（首次真连 MySQL，验证连通+Flyway V1 建表成功）

## 2. 列表端点（RED → GREEN）
- [x] 2.1 **RED**：`SpotApiTests` 用 MockMvc 断言 `GET /api/spots` 返回 200、`code=0`、分页结构、仅含 `is_published=1 且 is_deleted=0` 项、`id` 为 JSON String；运行确认失败（无实体/表/端点）
- [x] 2.2 GREEN：写 `V1__create_attractions_tables.sql`（3 表，照 design D4/D5，utf8mb4+InnoDB，索引/FK 齐全）+ Flyway 迁移测试（`geo_city` 种子 1 城、`scenic_spot` 种子 2 景点其中 1 未发布）
- [x] 2.3 GREEN：`BaseEntity` + `GeoCity`/`ScenicSpot`/`SpotOpeningHour` 实体、雪花 `IdGenerator`、`SpotSummaryDto`/`PageResult`、Repository、`SpotQueryService`、`SpotController`（仅委托）、`JacksonConfig`(Long→String)；跑 2.1 → 通过

## 3. 详情端点与开放时间 1:N（RED → GREEN）
- [x] 3.1 **RED**：`GET /api/spots/{id}` 断言返回主体事实字段 + `openingHours` 数组（按 `day_of_week` 升序、含 `is_closed`）；未知/已删除 id 断言 `Result.code!=0`、`data=null`、HTTP 404、响应不含堆栈关键字；运行确认失败
- [x] 3.2 GREEN：`SpotDetailDto`/`OpeningHourDto` + `spot_opening_hour` 种子 + Service 装配 + Controller 详情方法 + 复用 `GlobalExceptionHandler` 未找到路径；跑 3.1 → 通过

## 4. 筛选、排序与契约合规（RED → GREEN → REFACTOR）
- [x] 4.1 **RED**：`GET /api/spots?city=&category=&featured=` 过滤断言；默认按 `is_featured, created_at` 排序断言；`view_count` 不被用作排序断言
- [x] 4.2 GREEN：Service 组合查询条件（JPA `Specification` 或派生查询）实现筛选/排序
- [x] 4.3 REFACTOR：核对三层纯净（Controller 无业务/不直连 Repository，§3）、DTO 不外泄 Entity、每表二级索引 ≤5、FK 有索引、`view_count` 无索引；补 springdoc：dev `/v3/api-docs` 列出两新端点，prod 关闭（复用骨架期 prod-disabled 测试模式）

## 5. 验收与收尾
- [x] 5.1 `mvn -f backend/pom.xml test` 全绿（含骨架回归 + 本 change 新测试）
- [x] 5.2 Flyway 在测试库成功执行 `V1`，schema 与 design D4 一致（索引/外键/字符集校验）
- [ ] 5.3 （可选 dev 手测）本地起服务 + MySQL，`curl GET /api/spots` 返回 `code=0`
- [x] 5.4 spec 场景逐条对照已通过测试，确认无遗漏/无悄悄收窄
- [ ] 5.5 归档：待可用 `openspec` CLI 执行 delta sync + archive（agent shell 不可达，留用户侧）
