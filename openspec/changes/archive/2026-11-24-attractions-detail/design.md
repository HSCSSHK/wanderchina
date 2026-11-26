# Design: attractions-detail

## Context

③ 单元：把已可浏览的景点列表接入 `/spots/:id` 详情页，展示结构化事实卡。后端 `GET /api/spots/{id}` 已返回主体与开放时间，但 `SpotDetailDto` 缺少用户可读的 `cityName`，前端也没有详情路由、详情取数层与页面。

已确认事实：

- `scenic_spot.city_id` 已外键关联 `geo_city`，`cover_image_url`/`ticket_price`/`transport_summary` 等详情字段均是现有列，因此 **不需要建表或迁移**。
- `ticket_price`：`NULL=未知`、`0.00=免费`（V1 注释与既有契约一致）。
- `spot_opening_hour.day_of_week`：`0=周一` 至 `6=周日`，`LocalTime` 经 Jackson 默认输出 `HH:mm:ss`。
- 现有列表已使用 `@Query` 构造器表达式 ad-hoc join `GeoCity`；`ScenicSpot` 刻意没有 `@ManyToOne`，避免懒加载序列化问题。
- 后端 404 已由 `GlobalExceptionHandler` 统一为 HTTP 404 + `Result(code!=0,data=null)`。
- 前端已有 `http` axios 实例、`ApiResult<T>`、`vi.mock` API 层与 `data-testid` 测试约定。

约束：§3 `Controller -> Service -> Repository`；§6.1 雪花 ID 在 API 中为 String；锁定 Vue 3 + Element Plus；禁止 React/Tailwind/其它 UI 栈。

## Goals / Non-Goals

**Goals**

- 详情主体与 `cityName` 一次 JOIN 查询取回，开放时间再查一次；无迁移。
- 前端建立 `/spots/:id` 路由与列表入口，ID 全程按字符串处理。
- 详情页覆盖加载、成功、404、普通错误四态；404 与可重试错误严格分离。
- 事实字段格式化规则集中复用，缺失值有明确占位。
- 路由参数变化时重新加载，并防止旧请求覆盖新详情。

**Non-Goals**

- 地图 SDK、外部导航链接、坐标交互。
- 富文本、`v-html`、评论、收藏、分享、预订。
- SSR/SEO 元数据、多语言、图片 CDN 与裁剪。
- 详情页之间的关联推荐与城市/分类筛选。

## Decisions

### D1（后端）: 详情构造器投影 JOIN 城市，无迁移

`SpotDetailDto` 新增 `cityName`，并提供与 SELECT 同序的全参构造器（不含 `openingHours`，该字段在 Service 中装配）。字段顺序固定为：

```text
id, slug, nameEn, nameLocal, cityId, cityName, categoryCode, description,
ticketPrice, ticketCurrency, latitude, longitude, avgVisitDurationMin,
transportSummary, englishFriendly, featured, published, coverImageUrl
```

`ScenicSpotRepository` 新增：

```java
@Query("""
  SELECT new com.wanderchina.dto.SpotDetailDto(
    s.id, s.slug, s.nameEn, s.nameLocal, s.cityId, c.nameEn,
    s.categoryCode, s.description, s.ticketPrice, s.ticketCurrency,
    s.latitude, s.longitude, s.avgVisitDurationMin, s.transportSummary,
    s.englishFriendly, s.featured, s.published, s.coverImageUrl)
  FROM ScenicSpot s
  JOIN GeoCity c ON s.cityId = c.id
  WHERE s.id = :id AND s.published = true
""")
Optional<SpotDetailDto> findDetailById(@Param("id") Long id);
```

`SpotQueryService.detail(id)` 改为：

1. `findDetailById(id)`，为空抛 `ResourceNotFoundException`；
2. 查开放时间并映射；
3. 把开放时间装配进 DTO。

逻辑删除继续由实体的 `@SQLRestriction("is_deleted=0")` 过滤。城市通过内连接带出；外键保证已发布景点必有城市。

**风险 R1**：构造器表达式参数顺序或布尔属性映射可能被 Hibernate 拒绝。若首跑失败，退路是用 `GeoCityRepository.findById(spot.getCityId()).map(GeoCity::getNameEn)` 取一次城市名；详情只查单行，不属于 N+1，行为等价。不得因此引入建表或放宽 404 语义。

### D2（前端）: 详情类型镜像后端契约

在 `types/spots.ts` 增加：

```ts
interface OpeningHour {
  dayOfWeek: number
  openTime: string | null
  closeTime: string | null
  closed: boolean
  note: string | null
}

interface SpotDetail {
  id: string
  slug: string
  nameEn: string
  nameLocal: string | null
  cityId: string
  cityName: string
  categoryCode: string
  description: string | null
  ticketPrice: number | null
  ticketCurrency: string | null
  latitude: number
  longitude: number
  avgVisitDurationMin: number | null
  transportSummary: string | null
  englishFriendly: boolean
  featured: boolean
  published: boolean
  coverImageUrl: string | null
  openingHours: OpeningHour[]
}
```

`id`/`cityId` 为 `string`，`LocalTime` 为 `HH:mm:ss` 字符串；页面只做展示，不把 ID 转数值。

### D3（前端）: `fetchSpot` 将 HTTP 404 类型化

在 `api/spots.ts` 增加 `SpotNotFoundError` 与 `fetchSpot(id: string)`：

- 请求 `GET /spots/{encodeURIComponent(id)}`。
- 捕获 Axios 错误，若 `response.status === 404`，抛 `SpotNotFoundError`；其它错误原样抛出。
- 响应 `code!==0` 或无 `data` 视为契约失败，抛普通 `Error`。
- 不返回空对象兜底。详情没有“空数据对象”这种合法状态。

这样调用方可用 `instanceof SpotNotFoundError` 明确区分 404 与网络/5xx。

### D4（前端）: `useSpotDetail(id)` 状态机与防竞态

```text
status: 'loading' | 'success' | 'notFound' | 'error'
spot: SpotDetail | null
load(): 递增请求序号 -> 校验 id
  -> 非法 id: notFound，且不请求
  -> 合法 id: loading + 清空旧 spot -> fetchSpot
  -> 成功且序号仍最新: spot + success
  -> SpotNotFoundError 且序号最新: notFound
  -> 其它异常且序号最新: error
watch(id, load, { immediate: true })
```

- 组件把 `route.params.id` 转成字符串后传入，ID 不转 `Number`。
- 路由切换时序号递增，旧响应即使晚到也不能覆盖新状态。
- `Retry` 调用 `load()`，继续使用当前 ID。

### D5（前端）: 页面四态与事实卡

`AttractionDetail.vue`：

- `loading`：`el-skeleton`，`data-testid="detail-loading"`。
- `notFound`：`el-result`（`Attraction not found`）+ 返回 `/spots` 链接，`data-testid="detail-not-found"`；**无 Retry**。
- `error`：`el-alert` + `Retry` 按钮，`data-testid="detail-error"` / `"detail-retry"`。
- `success`：`article data-testid="spot-detail"`。

事实卡内容：

```text
Back to attractions
Cover（缺失显示 No image）
nameEn / nameLocal
cityName / categoryLabel / Featured / English-friendly
Ticket | Visit duration | Coordinates
Description
Getting there
Opening hours
```

- 描述用插值渲染，CSS `white-space: pre-line` 保留换行，禁止 `v-html`。
- 不展示 `published`、`slug`、`cityId` 等内部或非用户价值字段。
- 开放时间每行 `data-testid="opening-hour-row"`；空数组显示 `Opening hours not available`。
- 城市、交通、描述、封面缺失均显示明确占位，不出现 `null`/`undefined`。

### D6（前端）: 共享格式化工具

把列表已有的类别与票价辅助函数抽到 `src/utils/spotFormat.ts`，列表与详情共同使用。新增：

- `categoryLabel(code)`：五类英文标签，未知 code 原样回落。
- `ticketLabel(price, currency)`：
  - `null` -> `Not listed`
  - `0` -> `Free`
  - 非零且币种合法 -> `Intl.NumberFormat('en-US', {style:'currency', currency})`
  - 币种缺失或非法 -> 数字字符串（必要时附原始币种），不得抛异常。
- `durationLabel(min)`：`null` -> `Not listed`；分钟/小时/小时+分钟。
- `timeLabel(time)`：取 `HH:mm`；空 -> `Hours not available`。
- `openingHourLabel(hour)`：`closed` -> `Closed`；时间齐全 -> `HH:mm-HH:mm`；时间缺失 -> `Hours not available`；有 `note` 时追加。

列表的显示行为保持不变（仅复用抽出的函数），避免两套格式化逻辑漂移。

### D7（前端）: 列表入口与路由

- `router/index.ts` 注册 `/spots/:id`，名称 `spot-detail`，组件 `AttractionDetail.vue`。
- `AttractionList.vue` 卡片外包 `RouterLink`，`to={ name:'spot-detail', params:{ id:s.id } }`；`id` 不转数值。
- 既有列表四态、分页、featured 开关不改变。
- 测试环境为 `RouterLink` 使用 `RouterLinkStub`，断言目标参数与字符串 ID。

## Test Plan

### 后端 RED -> GREEN

扩展 `SpotApiTests`：

1. 夹具补齐 `nameLocal`/`ticketCurrency`/`avgVisitDurationMin`/`transportSummary`/`englishFriendly`。
2. 新增/强化详情用例，断言 `cityName=Beijing`、票价、币种、坐标、时长、交通、英文友好、封面、开放时间有序、`id` 为字符串。
3. 断言不存在与未发布 ID 返回 HTTP 404、失败 `Result`，且不含堆栈。
4. 先跑 `mvn test` 观察到 `cityName` 缺失导致 RED，再实现 D1 转 GREEN。

### 前端 RED -> GREEN

`AttractionDetail.test.ts`（`vi.mock('../api/spots')`）：

1. pending -> 仅加载态，无详情/错误/404。
2. 成功 -> 渲染名称、城市、分类、票价、时长、坐标、描述、交通、开放时间。
3. 空值 -> 封面/描述/交通/开放时间占位正确，`null` 显示 `Not listed`，`0` 显示 `Free`。
4. `SpotNotFoundError` -> 未找到态，有返回列表，无 Retry。
5. 非法 ID -> 未找到态且 `fetchSpot` 未被调用。
6. 普通失败 -> 错误态；点击 Retry 使用同一 ID 重新请求并成功。
7. 路由 ID 变化 -> 对新 ID 请求；构造旧请求迟到场景，断言不覆盖新详情。
8. 列表卡片链接 -> `to.name='spot-detail'`，`to.params.id` 保持字符串。

补充 `spotFormat` 单测覆盖票价、时长、星期映射与缺失时间。现有 `AttractionList` 用例只更新 RouterLink stub，四态与分页行为不回归。

## Migration Plan

无数据库迁移。实现顺序：

1. 后端先写失败断言，扩 DTO、详情投影、Service，跑 `mvn test` GREEN。
2. 前端先补类型/格式化/API，再写 `AttractionDetail` 失败测试，完成 composable、页面、列表入口、路由，跑 `npm test` GREEN。
3. 跑 `npm run build` 做 vue-tsc 与构建门禁。
4. 合规检查：Controller 不依赖 Repository、无新增迁移、ID 未转 Number、无 `v-html`、无禁用前端栈。
5. 归档由用户侧 OpenSpec CLI 执行。

## Risks / Trade-offs

- **R1 后端构造器投影**：若 Hibernate 不接受，按 D1 退路改为单次城市查询；详情单行不构成 N+1。
- **R2 Axios 404 语义**：404 会先于 `Result` 拆包被 Axios reject；必须在 API 层显式转换，否则会落入普通错误态。
- **R3 路由复用**：`/spots/:id` 在相同组件内切换 ID 时不会重新挂载；必须 watch 参数，不能只依赖 `onMounted`。
- **R4 金额格式化**：`Intl.NumberFormat` 对非法币种会抛 `RangeError`，必须降级。
- **R5 测试中的 RouterLink**：列表测试需补 stub，否则新增链接会产生未解析组件告警。

## Open Questions

无。用户已确认：

- 同意详情契约增强 `cityName`，JOIN `geo_city`，无迁移。
- 票价区分 `null` 与 `0`。
- 开放时间按 `0=周一` 映射。
- 404 独立于普通错误态。
- 不引入地图与富文本。
