# Attractions Data Model (attractions-data-model)

## Why

首页 Hero 已立住视觉外壳。P0 第 2 模块「景点攻略」定位为**结构化事实卡**（非富文本种草），这是后续 **AI 助手精确检索（RAG / Function Calling）** 的事实底座，也是 **SEO** 的主要抓手。`attractions-data-model` 是该模块拆分（①数据模型→②列表/发现流→③详情页）的**第一个单元**，也是整个项目**首次真正落地持久层**。

它把"热门景点/热门帖子"依赖的结构化数据一次建到位：3 张表（`scenic_spot` + `geo_city` 归一化 + `spot_opening_hour` 1:N），遵守 §6 数据库规范（雪花 BIGINT 主键、BaseEntity 公共字段、NOT NULL/索引/Flyway 纪律），并对外暴露**只读 API**，供前端 ②③ 与未来 `ai-assistant` 消费。

## What Changes

- **首次引入持久层**：后端新增 Spring Data JPA + Flyway + MySQL 依赖与数据源/迁移配置（当前 `backend/` 无任何持久化）。
- **3 张表（规范版，一步到位）**：`geo_city`（城市归一化，供筛选/坐标/FK）、`scenic_spot`（事实卡主体字段）、`spot_opening_hour`（开放时间 1:N，day_of_week 结构化）。DDL 草案见 design.md；本 change **只出草案 + Flyway 迁移在 apply 落地**。
- **只读 API**：`GET /api/spots`（分页、按 `city`/`category`/`featured` 筛选，返回 `Result<List<SpotSummary>>`）、`GET /api/spots/{id}`（含开放时间明细，未找到走全局异常返回 `Result`）。雪花 `id` **在 JSON 序列化为 String**（§6.1）。
- **分层**：`Controller -> Service -> Repository` 三层，Controller 无业务逻辑（§3 硬规则）。
- **明确不做（非目标）**：不做前端列表/详情页（属 ②③）；不做任何写操作 API/UI；不做 AI 检索/RAG（属 `ai-assistant` change）；不做图集/标签/结构化交通/多级行政区划/多语言名（YAGNI，留后续）；不接入 `spring-ai`（本 change 仅数据底座）。

## Impact

- **Affected specs**：新增能力 `attractions-data-model`（ADDED delta）。
- **Affected code**：`backend/pom.xml`（+jpa/flyway-core/flyway-mysql/mysql-connector-j，测试 +Testcontainers）、`backend/src/main/resources/application*.yml`（数据源 + JPA + Flyway）、`backend/src/main/resources/db/migration/`（新增 V1）、`com.wanderchina.entity/`、`repository/`、`service/`、`controller/SpotController`、`dto/`（新增），及对应测试。
- **依赖 §6**：3 表全部内嵌 BaseEntity 公共字段；主键雪花；索引遵循最左前缀/FK 必建/低基数不单列/计数列不建索引；Flyway forward-only 唯一 DDL 入口。
- **依赖 §1/§3**：锁定栈内（Spring Boot 3 + JPA + MySQL + Flyway），不引入境外 AI（AI 接入是 `spring-ai-alibaba`，属另一 change）。
- **测试库为新增决策**：首次集成测试需要一个**能跑 MySQL DDL 的测试库**——推荐 **Testcontainers MySQL**（保真、能验证 Flyway 脚本，但需 Docker）；备选 H2(MySQL 模式)（无 Docker，但对 MySQL 专有 DDL/行为保真度低）。见 design 决策 D7 + 待确认项。
- **前端占位不变**：`/spots` 仍为 homepage-hero 的占位页，待 ② `attractions-list` 替换；本 change 不碰前端。
- **工具链**：`openspec` CLI 在 agent shell 不可达，工件按标准结构手工落盘（`.openspec.yaml` 已由用户侧 CLI 生成）；`validate/archive` 需可用 CLI 环境。
