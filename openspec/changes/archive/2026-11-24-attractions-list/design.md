# Design: attractions-list

## Context

② 单元：后端把 `GET /api/spots` 摘要投影增强（+`coverImageUrl`/`cityName`/`ticketPrice`/`description`），前端把 `/spots` 占位换成消费该端点的发现列表页（四态 + 页码分页 + featured 开关）。

依据：① 已归档（`scenic_spot`/`geo_city` 三表 + 只读端点，实测 5.7+general_ci）；`cityId`/`viewCount` 为标量、`ScenicSpot` 无 `@ManyToOne` 关联（① 刻意避免懒加载序列化）。现有前端：`api/hello.ts` 自建 axios 实例（baseURL `/api`, timeout 5000）+ 手动拆 `Result`；`types/result.ts` 有 `ApiResult<T>`；测试 `vi.mock` API 层 + `data-testid`。

约束：§3 三层、§6.1 id→String、vite `/api→:8080` 代理、锁定栈（Element Plus，禁其它 UI/CSS）。

## Goals / Non-Goals

**Goals**
- 列表投影一次查询带出城市名，禁 N+1；无迁移。
- 前端四态完备（加载/空/错误+重试/成功）+ 页码分页 + featured 开关 + 挂载单次请求。
- 前端类型镜像后端契约（id/cityId 为 string）。

**Non-Goals**
- 城市/分类筛选、无限滚动、详情页③、i18n、图片优化。

## Decisions

### D1（后端）: 用 `@Query` 构造器表达式做 join 投影，替换列表的 Specification 实现

`SpotSummaryDto` 扩为 10 字段并加**全参构造器**（顺序即 SELECT 顺序）：
`id, slug, nameEn, categoryCode, cityId, featured, coverImageUrl, cityName, ticketPrice, description`。

`ScenicSpotRepository` 新增：
```java
@Query("""
  SELECT new com.wanderchina.dto.SpotSummaryDto(
    s.id, s.slug, s.nameEn, s.categoryCode, s.cityId, s.featured,
    s.coverImageUrl, c.nameEn, s.ticketPrice, s.description)
  FROM ScenicSpot s
  JOIN GeoCity c ON s.cityId = c.id
  WHERE s.published = true
    AND (:category IS NULL OR s.categoryCode = :category)
    AND (:featured  IS NULL OR s.featured = :featured)
    AND (:cityId   IS NULL OR s.cityId = :cityId)
  ORDER BY s.featured DESC, s.createdAt DESC
""")
Page<SpotSummaryDto> findSpots(@Param("cityId") Long cityId,
        @Param("category") String category,
        @Param("featured") Boolean featured, Pageable pageable);
```
- 因 `ScenicSpot` 无城市关联，用 **HQL ad-hoc join**（`JOIN GeoCity c ON s.cityId = c.id`）单条查询带出 `cityName`，无 N+1。
- 逻辑删除由实体 `@SQLRestriction("is_deleted=0")` 自动施加；此处再叠 `published=true`。
- 排序写死在 JPQL（`featured DESC, created_at DESC`，复用组合索引前缀），`Pageable` 只带分页不带 sort（避免投影查询 sort 属性歧义）。
- `SpotQueryService.list(...)` 改为委托此方法；详情端点不变（仍 `findById` + 开放时间）。
- `cityId`/`featured`/`category` 走可选参数（`(:p IS NULL OR ...)`），本 change 仅 `featured` 会被前端用到。

**风险 R1**：Hibernate 对 `:param IS NULL` + 类型推断偶有挑剔。若 MySQL/Hibernate 绑定报错，退路是改用接口投影（`interface SpotSummaryView{...}`，`@Query` 里 `AS cityName` 别名对齐 getter），行为等价、仍单查询。apply 首跑 `mvn test` 验证绑定。

### D2（前端）: 抽取共享 axios 实例

现两处需要 `/api` 客户端，抽 `src/api/http.ts`：
```ts
import axios from 'axios'
export const http = axios.create({ baseURL: '/api', timeout: 5000 })
```
`hello.ts` 改为 `import { http } from './http'`（行为不变，去重复）。这是"两处真实复用"后的 DRY，非预防性抽象。

### D3（前端）: `api/spots.ts` 消费 + 拆包

```ts
export async function fetchSpots(p: SpotsQuery): Promise<SpotsPage> {
  const res = await http.get<ApiResult<SpotsPage>>('/spots', { params: p })
  const body = res.data
  if (body.code !== 0) throw new Error(body.message || '请求失败')
  return body.data
}
```
`SpotsQuery { city?: string; category?: string; featured?: boolean; page?: number; size?: number }`（`undefined` 项 axios 自动省略，故 featured 关闭时不带）。

### D4（前端）: `types/spots.ts` 镜像契约

```ts
interface SpotListItem { id: string; slug: string; nameEn: string; categoryCode: string;
  cityId: string; featured: boolean; coverImageUrl: string | null; cityName: string;
  ticketPrice: number | null; description: string | null }
interface SpotsPage { content: SpotListItem[]; total: number; page: number; size: number }
```
`id/cityId` 为 `string`（后端 Long→String）；`ticketPrice` 后端 DECIMAL→JSON number（`null`=未知，`0`=免费）。

### D5（前端）: `useSpots()` 状态机

```
status: 'loading' | 'success' | 'empty' | 'error'
state: items[], total, page, size, featured(bool), error
load(): set loading -> fetchSpots -> code ok: items/total, items.length? 'success':'empty'; throw: 'error'
watch([page, featured]): featured 变更时先 page=0 再 load；page 变更直接 load
onMounted: load()  // 单次
```
挂载仅一次请求；分页/热门切换各自触发一次。

### D6（前端）: `AttractionList.vue` 与 data-testid

- `v-if="status==='loading'"` → `el-skeleton`（`data-testid="loading"`）
- `'error'` → `el-alert` + "Retry" 按钮（`data-testid="error"` / `"retry"`）
- `'empty'` → `el-empty`（`data-testid="empty"`）
- `'success'` → `div[data-testid="spots-list"]` 内 `v-for` `el-card`（`data-testid="spot-card"`）：`el-image`(cover，失败/空→占位) + `nameEn` + `cityName` + 类别标签（`categoryLabel` 映射）+ featured 徽标（`el-tag`）
- 底部 `el-pagination`（`data-testid="pagination"`，`layout="prev, pager, next"`，`:total`/`:page-size`/`v-model:current-page`）
- 顶部 `el-switch`/`el-button` 热门开关（`data-testid="featured-toggle"`）
- `categoryLabel`：`{historic:'Historic',natural:'Nature',museum:'Museum',theme_park:'Theme Park',viewpoint:'Viewpoint'}`，未匹配回落原 code。

### D7（前端）: 路由

`/spots` 路由 `component` 由 `Placeholder` 改为 `AttractionList.vue`。`/ai`/`/`/`/hello` 不动。

## 前端测试（RED→GREEN）

`AttractionList.test.ts`：`vi.mock('../api/spots')`，注入桩：
1. loading：给 fetchSpots 返回 pending（延迟 resolve）→ 断言 `[data-testid="loading"]` 存在、无 `spots-list`。
2. success：返回 2 项 → 断言 2 张 `spot-card`、含城市名/景点名、`pagination` 存在。
3. empty：`{content:[],total:0}` → 断言 `empty` 存在、无 `spots-list`/`error`。
4. error：`mockRejectedValue` → 断言 `error` 存在；点 `retry` → 断言再次调用 fetchSpots。
5. pagination：翻到 page 1 → 断言 fetchSpots 以 `page:1` 被调用。
6. featured：开启热门 → 断言以 `featured:true` 调用且 `page` 重置 0。
7. 挂载单次：初始 `mockResolvedValue` 一次结果 → `toHaveBeenCalledTimes(1)`。

## Risks / Trade-offs

- **R1** 见 D1（`IS NULL` 参数绑定，退路接口投影）。
- **运行依赖变重**：列表联调需后端 + MySQL 在跑；单测靠 mock 不受影响。
- **`coverImageUrl` 多为空**：MVP 无图时走占位，不强依赖真实图片资源。
- **无 i18n**：类别/文案先英文硬映射（面向海外用户，符合愿景）；中文/多语留后续。

## Migration Plan

无 DB 迁移。落地顺序：后端扩 DTO + `@Query` 投影 →（改 `SpotApiTests` 断言新字段，先 RED）→ `mvn test` GREEN；前端抽 http + api/types/composable/组件/路由 →（`AttractionList.test.ts` 先 RED）→ `npm test` GREEN；最后 `npm run build`。

## Open Questions

- O1：`ticketPrice` 展示格式（如 `Free` / `¥xx` / 含币种）MVP 先直接显示数值 + 币种还是简单 `Free/?`？（倾向：`0→Free`、`null→'—'`、其余 `¥{price}`）
- O2：热门开关文案与默认态——默认关闭（展示全部）是否符合预期？（倾向是）
