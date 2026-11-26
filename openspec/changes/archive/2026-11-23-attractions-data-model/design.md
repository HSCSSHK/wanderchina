# Design: attractions-data-model

## Context

首次落地持久层。当前后端仅 web+test+springdoc，**无 JPA/Flyway/数据源**（`pom.xml` 无相关依赖，`application.yml` 无 datasource）。本 change 建 3 张表（规范版，用户拍板一步到位），暴露只读 API，严守 §6。

约束来源：§1 锁定栈（Boot 3.3.5 + JPA + MySQL 8 + Flyway）、§3 三层/禁 Controller 业务、§6（雪花、BaseEntity、NULL 原则、索引、Flyway forward-only）、§0.5（本单元=①，是 AI 与前端 ②③ 的数据底座）。

## Goals / Non-Goals

**Goals**
- 3 表 DDL 草案（本 change 定稿结构，Flyway 脚本在 apply 落地）。
- JPA 实体 + Repository + Service + 只读 Controller，三层干净。
- 雪花主键 + API 侧 String 序列化；列表/详情两个只读端点契约。
- 可运行的集成测试基座（含测试库策略）。

**Non-Goals**
- 不做前端（②③）、不做写 API、不做 AI/RAG/spring-ai 接入。
- 不做图集/标签 M:N/结构化交通/多级区划/多语言名（YAGNI）。
- 不引入 Redis/缓存/搜索引擎（FULLTEXT 亦待有搜索需求再加）。

## Decisions

### D1: 包结构与分层

```
com.wanderchina/
  entity/           BaseEntity(@MappedSuperclass), GeoCity, ScenicSpot, SpotOpeningHour
  repository/       GeoCityRepository, ScenicSpotRepository, SpotOpeningHourRepository
  service/          SpotQueryService            (读模型装配，业务在此)
  controller/       SpotController              (仅委托 Service + 包 Result)
  dto/              SpotSummaryDto, SpotDetailDto, OpeningHourDto, PageResult
  config/           SnowflakeConfig, (JacksonConfig: Long->String)
```
Controller 无业务、不直连 Repository（§3）。

### D2: BaseEntity 承载 §6.2 公共字段

`@MappedSuperclass` 统一 `id / createdAt / updatedAt / createdBy / updatedBy / isDeleted / version`；Hibernate 物理命名策略（默认 `SpringPhysicalNamingStrategy`）映射 snake_case。`@Version` 乐观锁；`is_deleted` 逻辑删除，读查询 MUST 过滤 `=0`（Repository 默认方法/`@Where(clause="is_deleted=0")` 二选一，apply 定）。

### D3: 雪花主键生成（§6.1）

- 实现 Hibernate 6 `org.hibernate.id.IdGenerator<Long>` 组件 `SnowflakeIdGenerator`（或 `@PrePersist` 兜底赋值为 null 时生成），实体 `@Id @GeneratedValue` 绑定该生成器。
- `workerId/datacenterId` 由 `SnowflakeConfig` 从配置注入（`wanderchina.snowflake.worker-id`，默认 0）。**多实例部署前必须分配**（Open Question O2）。
- DTO/JSON：`id`、`cityId`、`spotId` 等 Long 一律序列化为 **String**（全局 `JacksonConfig` 将 `Long`/`long` 用 `ToStringSerializer`，或字段级 `@JsonSerialize`）。避免 JS `2^53` 精度丢失。

### D4: 三表 DDL 草案（MySQL 5.7/8 兼容 / utf8mb4 / InnoDB）

> 这是**审阅用草案**；apply 阶段转成 `V1__create_attractions_tables.sql`。公共字段（created_at/updated_at/created_by/updated_by/is_deleted/version）逐表内联。时间 `DATETIME(3)` NOT NULL，由 JPA 维护（种子脚本显式给值）；不用 `TIMESTAMP`（§6.2）。

```sql
-- 1) 城市归一化
CREATE TABLE geo_city (
  id            BIGINT       NOT NULL COMMENT '雪花ID',
  name_en       VARCHAR(120) NOT NULL,
  name_local    VARCHAR(120) NULL,
  country_code  CHAR(2)      NOT NULL COMMENT 'ISO3166-1 alpha-2',
  admin1        VARCHAR(120) NULL COMMENT '省/州',
  latitude      DECIMAL(9,6) NULL,
  longitude     DECIMAL(9,6) NULL,
  created_at    DATETIME(3)  NOT NULL,
  updated_at    DATETIME(3)  NOT NULL,
  created_by    VARCHAR(64)  NULL,
  updated_by    VARCHAR(64)  NULL,
  is_deleted    TINYINT(1)   NOT NULL DEFAULT 0,
  version       INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_geo_city_country_name (country_code, name_en),
  KEY idx_geo_city_country (country_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 2) 景点事实卡主体
CREATE TABLE scenic_spot (
  id                      BIGINT       NOT NULL COMMENT '雪花ID',
  slug                    VARCHAR(120) NOT NULL COMMENT 'SEO/对外不透明标识, 与主键分离',
  name_en                 VARCHAR(200) NOT NULL,
  name_local              VARCHAR(200) NULL,
  city_id                 BIGINT       NOT NULL COMMENT 'FK -> geo_city.id',
  category_code           VARCHAR(32)  NOT NULL COMMENT '短码枚举 historic/natural/museum/...',
  description             TEXT         NULL COMMENT '简短描述(MVP), 富文本后续',
  ticket_price            DECIMAL(10,2) NULL COMMENT 'NULL=未知; 0.00=免费(§6.3)',
  ticket_currency         CHAR(3)      NULL DEFAULT 'CNY',
  latitude                DECIMAL(9,6) NOT NULL,
  longitude               DECIMAL(9,6) NOT NULL,
  avg_visit_duration_min  INT          NULL,
  transport_summary       VARCHAR(500) NULL,
  english_friendly        TINYINT(1)   NOT NULL DEFAULT 0,
  is_featured             TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '低基数,仅作组合前缀',
  view_count              BIGINT       NOT NULL DEFAULT 0 COMMENT '写热点,不建索引',
  is_published            TINYINT(1)   NOT NULL DEFAULT 0,
  cover_image_url         VARCHAR(512) NULL,
  created_at  DATETIME(3) NOT NULL,
  updated_at  DATETIME(3) NOT NULL,
  created_by  VARCHAR(64) NULL,
  updated_by  VARCHAR(64) NULL,
  is_deleted  TINYINT(1)  NOT NULL DEFAULT 0,
  version     INT         NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_scenic_spot_slug (slug),
  KEY idx_scenic_spot_city (city_id),
  KEY idx_scenic_spot_featured_created (is_featured, created_at),
  KEY idx_scenic_spot_list (is_deleted, is_published, created_at),
  CONSTRAINT fk_scenic_spot_city FOREIGN KEY (city_id) REFERENCES geo_city(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 3) 开放时间 1:N（每天一条, day_of_week 0=周一..6=周日）
CREATE TABLE spot_opening_hour (
  id          BIGINT      NOT NULL COMMENT '雪花ID',
  spot_id     BIGINT      NOT NULL COMMENT 'FK -> scenic_spot.id',
  day_of_week TINYINT     NOT NULL COMMENT '0..6',
  open_time   TIME        NULL,
  close_time  TIME        NULL,
  is_closed   TINYINT(1)  NOT NULL DEFAULT 0 COMMENT '当日闭馆',
  note        VARCHAR(255) NULL,
  created_at  DATETIME(3) NOT NULL,
  updated_at  DATETIME(3) NOT NULL,
  created_by  VARCHAR(64) NULL,
  updated_by  VARCHAR(64) NULL,
  is_deleted  TINYINT(1)  NOT NULL DEFAULT 0,
  version     INT         NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_spot_opening_day (spot_id, day_of_week),
  CONSTRAINT fk_spot_opening_spot FOREIGN KEY (spot_id) REFERENCES scenic_spot(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
```

### D5: 索引决策（对照 §6.4，逐条）

- `uk_scenic_spot_slug`：SEO/外部唯一标识；唯一列 NOT NULL（§6.3）。
- `idx_scenic_spot_city`：FK 必建 + 城市筛选高频。
- `idx_scenic_spot_featured_created (is_featured, created_at)`：热门列表；低基数 `is_featured` 作**前缀**而非单列索引（§6.4）。
- `idx_scenic_spot_list (is_deleted, is_published, created_at)`：发现流"未删除+已发布+时间"过滤/排序，等值前缀→排序。
- `uk_spot_opening_day (spot_id, day_of_week)`：其**最左前缀 `spot_id` 已充当 FK 索引**，故不再单建 `spot_id` 索引（省一个）。
- `view_count`：写热点，**不建索引、不作默认排序键**（§6.4 + spec 场景）。
- 每表二级索引数 ≤5（除主键），符合 §6.4。
- 搜索（name/description）留 `FULLTEXT`，**本 change 不做**，待 `attractions-list` 有站内搜索需求再立迁移。

### D6: 只读端点与 DTO

- `GET /api/spots`：入参 `city`(id)、`category`(code)、`featured`(bool)、`page`、`size`；Service 组装 `Page<SpotSummaryDto>`；Controller 包 `Result<PageResult<SpotSummaryDto>>`（`PageResult` 含 `content/total/page/size`，避免直接外泄 Spring `Page` 序列化怪癖）。
- `GET /api/spots/{id}`：`SpotDetailDto` 含主体字段 + `openingHours: List<OpeningHourDto>`（按 day_of_week 升序）。未找到→抛业务异常/`EntityNotFound`→`GlobalExceptionHandler`→`Result(code!=0,data=null)` + 404（复用骨架期全局异常，不回显堆栈）。
- DTO 内所有 id 字段以 String 序列化（D3）。

### D7: 测试库策略（已定稿 · O1）

用户本地无 Docker、但装有**真实 MySQL 8**（root/root，localhost:3306）。为 100% 保真，集成测试**直连本地 MySQL**，不用 H2/Testcontainers。

- 数据源置于 `src/test/resources/application-test.yml`，连 `jdbc:mysql://localhost:3306/wanderchina_test?createDatabaseIfNotExist=true&useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai`（库不存在时自动建）。
- 表结构由 **Flyway** 初始化；测试类加 `@Transactional`，DML 夹具回滚（DDL 由 Flyway 提交、不受回滚影响，符合 MySQL 特性）。
- **上下文启动即需库**：骨架期 3 个 `@SpringBootTest`（Hello/GlobalException/prod-docs）现依赖数据源，统一纳入 `test` profile（prod-docs 用 `{"test","prod"}` 组合：datasource 取 test、docs-off 取 prod）。这是引入持久层后保持回归绿灯的必要改动（tasks 1.3）。
- dev 运行用 `application-dev.yml`（指向本地 `wanderchina_dev`，同样 auto-create），使 `mvn spring-boot:run` 不依赖测试库。
- 时区说明：连接串按用户给定使用 `serverTimezone=Asia/Shanghai`；§6.2 建议 UTC 存储，二者存在轻微张力，MVP 先遵从用户显式配置，标注为后续可统一项（非阻塞）。

## Risks / Trade-offs

- **首次接 DB 的启动耦合**：骨架期刻意"无 DB 也能起"。本 change 起 dev/test 需 MySQL。用 profile 隔离：测试走 Testcontainers；dev 数据源默认指向本地 3306（`application-dev.yml`），文档写清。
- **Testcontainers/Docker 环境不确定**：见 D7，apply 首步探测并回退。
- **逻辑删除读过滤**：`@Where`/查询显式过滤需统一，否则列表可能漏 `is_deleted` 条件（spec 已约束）。
- **springdoc 与 JPA 实体暴露**：只读端点走 DTO，不直接暴露 Entity，避免懒加载序列化异常与信息泄漏。
- **openspec CLI 不在 agent PATH**：工件手工落盘；`validate/archive` 依赖用户侧 CLI。

## Migration Plan

无历史数据（新表），纯建表。落地顺序：加依赖+测试基座可构建 → 写端点失败测试(RED) → `V1` 迁移 + 实体/Repository(GREEN 之一) → Service/Controller/DTO + 序列化(GREEN) → 详情/404/筛选补全 → `mvn test` 全绿 + 迁移在测试库执行成功。

## Resolved Questions（原 Open Questions，用户已拍板）

- **O1 测试库**：直连本地真实 MySQL（实际 **5.7.25**，`wanderchina_test`，auto-create）+ Flyway 迁移 + 测试类 `@Transactional` 回滚；不用 H2/Testcontainers。
- **O2 雪花 workerId**：单实例默认 `workerId=0`/`datacenterId=0`，由配置 `wanderchina.snowflake.*` 注入；多实例分配留后续。
- **O3 排序规则**：因本地实为 **MySQL 5.7.25**（`utf8mb4_0900_ai_ci` 仅 MySQL 8.0.1+ 支持），改用 `utf8mb4_general_ci`（5.7/8 通用、向前兼容）。
- **O4 `category_code` 最小枚举集（MVP）**：`historic` / `natural` / `museum` / `theme_park` / `viewpoint`（应用层校验取值；DDL 存 `VARCHAR(32)` 短码，非 DB ENUM，遵 §6.3）。
