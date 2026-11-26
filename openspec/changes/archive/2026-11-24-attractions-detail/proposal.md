# Attractions Detail (attractions-detail)

## Why

景点攻略拆分的第 ③ 单元：用户已能从 `/spots` 发现景点，但列表卡片不可点击，系统也没有详情路由，无法查看开放时间、票价、交通与描述等结构化事实。

`GET /api/spots/{id}` 已具备详情主体与开放时间，但当前 `SpotDetailDto` 只有 `cityId`，没有用户可读的 `cityName`；前端也没有城市查询接口。若直接展示 `cityId`，详情页对海外用户没有实际价值。因此本 change 需要附带一次详情契约增强。

## What Changes

- **后端（详情投影增强）**：`SpotDetailDto` 新增 `cityName`；详情查询使用 `@Query` 构造器表达式，将 `scenic_spot` 与 `geo_city` 一次 JOIN 投影，主体与城市名一次取回，再查询开放时间。**无建表、无 Flyway 迁移**。
- **后端（行为保持）**：`id` 不存在、未发布或已逻辑删除时，继续返回 HTTP 404 与统一失败 `Result`，不回显堆栈/SQL。
- **前端（详情消费）**：新增 `SpotDetail`/`OpeningHour` 类型与 `fetchSpot(id)`；HTTP 404 映射为独立 `SpotNotFoundError`，与网络错误、5xx 分离。
- **前端（详情页）**：新增 `/spots/:id` 详情路由与 `AttractionDetail.vue`，覆盖加载、成功、404、普通错误四态；普通错误可重试，404 不提供无意义的重试。
- **前端（事实卡）**：渲染名称、城市、分类、封面、票价、游览时长、坐标、描述、交通与开放时间；缺失字段显示明确占位，票价区分未知与免费，开放时间按 `0=周一` 映射并区分闭馆与时间缺失。
- **前端（入口）**：列表卡片增加指向详情路由的链接，ID 始终按字符串使用。
- **契约**：对 `attractions-data-model` 的「只读景点详情端点与未找到路径」提交 MODIFIED delta；新增 `attractions-detail` 前端能力。

## Impact

- 后端：`dto/SpotDetailDto`、`repository/ScenicSpotRepository`、`service/SpotQueryService`、`SpotApiTests`。
- 前端：`types/spots.ts`、`api/spots.ts`、`composables/useSpotDetail.ts`、`views/AttractionDetail.vue`（含测试）、`views/AttractionList.vue`、`router/index.ts`，以及共享的景点展示格式化工具。
- 数据库：**无变更**。`cityName` 来自已存在且已建外键的 `geo_city`，其余详情字段均已是 `scenic_spot` 现有列。

## Non-Goals

- 地图 SDK、坐标交互、路线规划。
- 门票预订、评论、收藏、分享、富文本或 `v-html`。
- 多语言切换、SSR/SEO 元数据、图片裁剪与 CDN 优化。
- 从详情页继续跳转其他景点、城市筛选或分类筛选。
