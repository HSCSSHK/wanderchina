# attractions-data-model (Delta)

## MODIFIED Requirements

### Requirement: 只读景点列表端点

系统 SHALL 提供 `GET /api/spots`，支持分页与按 `city`/`category`/`featured` 过滤，返回统一 `Result<T>`（`code=0` 成功）。列表 MUST 仅返回 `is_deleted=0` 且 `is_published=1` 的景点，按"热门优先 + 创建时间"排序（复用 §6.4 组合索引前缀）。响应中的雪花 `id` MUST 序列化为 **String**。

列表摘要项 MUST 包含发现页展示所需的投影字段：`id`、`slug`、`nameEn`、`categoryCode`、`cityId`、`featured`，并新增 `coverImageUrl`(可空)、`cityName`、`ticketPrice`(可空)、`description`(可空)。`cityName` MUST 由 `scenic_spot` join 关联 `geo_city.name_en` 于**一次查询内**投影取回，MUST NOT 对每行再发起城市查询（禁止 N+1）。此增强 MUST NOT 引入建表/迁移（所依赖列均已存在于 ① 的 schema）。

#### Scenario: 拉取已发布景点列表

- **WHEN** 客户端 `GET /api/spots`
- **THEN** 返回 HTTP 200、`code=0`、分页后的景点摘要数组，其中不含逻辑删除/未发布项，且每个 `id` 为字符串形式

#### Scenario: 列表摘要含封面与城市名投影

- **WHEN** 客户端 `GET /api/spots`
- **THEN** 每个摘要项含 `coverImageUrl`、`cityName`、`ticketPrice`、`description` 字段；`cityName` 来自关联 `geo_city`，整页数据由一次 join 投影查询取回（不因每行再查城市）

#### Scenario: 计数列不参与索引排序导致的全表扫描

- **WHEN** 列表默认按 `is_featured`、`created_at` 排序
- **THEN** `view_count`（写热点计数列）MUST NOT 被单独建索引，也不作为默认排序键（§6.4）
