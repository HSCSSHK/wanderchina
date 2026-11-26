# attractions-data-model (Delta)

## ADDED Requirements

### Requirement: 结构化事实卡数据主体

系统 SHALL 以 `scenic_spot` 表承载景点"结构化事实卡"主体数据，字段 MUST 遵守 §6（雪花 `BIGINT` 主键、BaseEntity 公共字段、NOT NULL/NULL 原则、DECIMAL 表钱与坐标）。MUST 包含对外检索/展示所需的核心事实字段：`slug`、`name_en`、`name_local`(可空)、`city_id`、`category_code`、`description`(可空)、`ticket_price`(可空 DECIMAL)、`ticket_currency`、`latitude`/`longitude`(DECIMAL NOT NULL)、`avg_visit_duration_min`(可空)、`transport_summary`(可空)、`english_friendly`、`is_featured`、`view_count`、`is_published`、`cover_image_url`(可空)。

#### Scenario: 事实卡字段完整落库与读回

- **WHEN** 通过 Repository/迁移写入一条景点并读取
- **THEN** 上述核心字段可按契约读回；`latitude`/`longitude`/`ticket_price` 以 DECIMAL 精确存储，`ticket_price` 为空表示"未知/免费另计"而非 0 混淆

### Requirement: 开放时间以 1:N 结构化建模

系统 SHALL 用 `spot_opening_hour` 表以**每天一条**记录表达景点开放时间（`day_of_week` 0–6、`open_time`/`close_time` 可空、`is_closed` 标记当日闭馆、`note` 可空），而非把一周时间塞进单个字符串/JSON，以支撑 AI 精确检索。一景点 MUST 对应至多 7 条 `(spot_id, day_of_week)` 唯一记录。

#### Scenario: 读取景点携带开放时间明细

- **WHEN** 请求某景点详情
- **THEN** 返回其开放时间数组（按 `day_of_week` 有序），每元素含周几、开/闭馆时间、当日是否闭馆

### Requirement: 城市归一化与外键

系统 SHALL 用 `geo_city` 表归一化景点所在城市，`scenic_spot.city_id` MUST 为指向 `geo_city.id` 的外键且**显式建立索引**（§6.4：MySQL 不因 FK 自动建索引）。`geo_city` MUST 含 `name_en`(NOT NULL)、`country_code`(NOT NULL)、可空 `name_local`/`admin1`/坐标。

#### Scenario: 按城市筛选景点

- **WHEN** 以 `city` 作为查询条件请求景点列表
- **THEN** 系统经 `city_id` 外键索引过滤返回该城市的已发布景点

### Requirement: 只读景点列表端点

系统 SHALL 提供 `GET /api/spots`，支持分页与按 `city`/`category`/`featured` 过滤，返回统一 `Result<T>`（`code=0` 成功）。列表 MUST 仅返回 `is_deleted=0` 且 `is_published=1` 的景点，按"热门优先 + 创建时间"排序（复用 §6.4 组合索引前缀）。响应中的雪花 `id` MUST 序列化为 **String**。

#### Scenario: 拉取已发布景点列表

- **WHEN** 客户端 `GET /api/spots`
- **THEN** 返回 HTTP 200、`code=0`、分页后的景点摘要数组，其中不含逻辑删除/未发布项，且每个 `id` 为字符串形式

#### Scenario: 计数列不参与索引排序导致的全表扫描

- **WHEN** 列表默认按 `is_featured`、`created_at` 排序
- **THEN** `view_count`（写热点计数列）MUST NOT 被单独建索引，也不作为默认排序键（§6.4）

### Requirement: 只读景点详情端点与未找到路径

系统 SHALL 提供 `GET /api/spots/{id}` 返回单景点事实卡（含开放时间数组），以 `Result<T>` 包装。当 `id` 不存在（或已逻辑删除/未发布）时，MUST 经全局异常处理返回可解析的 `Result`（`code!=0`、`data=null`），**不回显堆栈/SQL**，HTTP 语义 404。

#### Scenario: 请求不存在的景点

- **WHEN** 客户端 `GET /api/spots/{不存在或已删除的id}`
- **THEN** 返回 `Result`（`code!=0`、`data` 为 null），响应体不含异常堆栈关键字

### Requirement: 分层与迁移纪律

系统 MUST 遵循 `Controller -> Service -> Repository` 三层，Controller 不含业务逻辑、不直连 Repository（§3）。所有建表 MUST 通过 Flyway 版本化脚本（`db/migration/V{n}__*.sql`）落地，`spring.jpa.hibernate.ddl-auto` MUST NOT 参与生产 schema（§6.5）。三表 MUST 使用 `utf8mb4` + InnoDB，字符集/排序规则在迁移中钉死。

#### Scenario: 迁移建表可执行且幂等于版本

- **WHEN** 在测试库启动应用触发 Flyway
- **THEN** `V1` 迁移成功创建 `geo_city`、`scenic_spot`、`spot_opening_hour` 三表及约定索引/外键；重复启动不重复执行、不改写已上线脚本
