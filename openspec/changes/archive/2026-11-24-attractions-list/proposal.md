# Attractions List (attractions-list)

## Why

景点攻略拆分的第 ② 单元：把 ① 的只读数据底座变成海外用户能"逛"的**发现列表页**，替换 `homepage-hero` 留下的 `/spots` 占位。

explore 阶段暴露一个契约缺口：① 的 `SpotSummaryDto` 只有 `id/slug/nameEn/categoryCode/cityId/featured`——列表**没有封面图、没有城市名**，对"发现流"几乎无价值。用户拍板 **Q1=(b) 增强**：本 change 附带一个对 `attractions-data-model` 的 **MODIFIED delta**，把 `coverImageUrl`、`cityName`（join `geo_city`）、`ticketPrice`、`description` 加进列表投影。

关键：**这 4 个字段的数据源都已存在**（`cover_image_url`/`ticket_price`/`description` 是 `scenic_spot` 现有列，`cityName` 来自已建的 `geo_city`），故**无需任何建表/迁移**，只改 DTO 投影与查询。

## What Changes

- **后端（投影增强）**：`GET /api/spots` 返回的摘要项新增 `coverImageUrl`、`cityName`、`ticketPrice`、`description`；`cityName` 经 `@Query` 投影 join `geo_city` 一次取回（规避 N+1）。`GET /api/spots/{id}` 详情不变。
- **前端（消费与渲染）**：新增 `AttractionList.vue` 消费列表，覆盖**加载中 / 空数据 / 错误 / 分页**四态，页码式 `el-pagination`（`total` 来自后端）+ 一个 `featured`（热门）开关；`/spots` 路由由占位页替换为列表页。新增 `api/spots.ts`、`types/spots.ts`、`useSpots()` composable。

## Impact

- **Affected specs**：MODIFIED `attractions-data-model` → 需求「只读景点列表端点」（摘要投影字段）；ADDED 能力 `attractions-list`（前端四态 + 分页 + featured 开关 + 单次请求约束）。
- **Affected code**：
  - 后端：`dto/SpotSummaryDto`（+4 字段）、`service/SpotQueryService.list`（改投影查询）、`repository/ScenicSpotRepository`（+`@Query` join 投影）、相应集成测试。**无迁移、无实体/表变更。**
  - 前端：`src/api/spots.ts`、`src/types/spots.ts`、`src/composables/useSpots.ts`、`src/views/AttractionList.vue`（+ 测试）、`src/router/index.ts`（`/spots` 指向列表页）。
- **依赖**：复用 `api/hello.ts` 的 axios 实例/Result 拆包范式、vite `/api→:8080` 代理；§3 三层纯净；§6.1 `id` 以 String 传输。
- **运行前提**：与纯静态 Hero 不同，联调需后端在跑 + MySQL 在（单测仍 mock API 层，不依赖 DB）。
- **非目标（YAGNI/后续）**：城市/分类筛选（仅留 `featured` 开关）、无限滚动/加载更多（留 P1/P2）、景点详情页 ③、多语言 i18n、图片 CDN 优化。
- **工具链**：`openspec` CLI 在 agent shell 不可达，工件手工落盘（`.openspec.yaml` 已由用户 CLI 生成）；`validate/archive` 留用户侧。
