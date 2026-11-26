# Tasks: attractions-detail

## 1. 准备

- [x] 1.1 复核 ③ 契约：`SpotDetailDto` 当前字段、`findById` + 开放时间查询、`GlobalExceptionHandler` 的 404 行为
- [x] 1.2 复核前端现状：`/spots` 路由、`AttractionList.vue` 卡片结构、`api/spots.ts`、`ApiResult<T>`、vitest/data-testid 约定
- [x] 1.3 确认无迁移需求：`cityName` 来自已存在 `geo_city`，其余事实字段均已在 `scenic_spot`

## 2. 后端详情契约增强（TDD RED→GREEN）

- [x] 2.1 RED：扩展 `SpotApiTests` 夹具（`nameLocal`/`ticketCurrency`/`avgVisitDurationMin`/`transportSummary`/`englishFriendly`），强化详情断言 `cityName`、票价币种、时长、交通、封面、开放时间有序、`id` 为 String；未实现前跑 `mvn test` 见 `cityName` 断言失败
- [x] 2.2 `SpotDetailDto` 新增 `cityName`，提供与 SELECT 同序的全参构造器（D1），保留无参构造器
- [x] 2.3 `ScenicSpotRepository` 新增 `@Query` 构造器表达式 `findDetailById(...)`，ad-hoc JOIN `GeoCity` 并过滤 `published=true`，返回 `Optional<SpotDetailDto>`
- [x] 2.4 `SpotQueryService.detail(id)` 改为委托 `findDetailById`，未找到仍抛 `ResourceNotFoundException`；随后查询并装配开放时间，移除旧 `toDetail` 手工映射
- [x] 2.5 强化 404 用例：不存在与未发布 ID 均断言 HTTP 404、`code!=0`、`data=null`、无堆栈
- [x] 2.6 GREEN：`mvn test` 全绿；若构造器投影绑定失败，按 D1 退路改为单次 `GeoCityRepository.findById`，不得放宽 404 或引入迁移

## 3. 前端类型、格式化与 API（TDD RED→GREEN）

- [x] 3.1 `types/spots.ts` 新增 `OpeningHour`、`SpotDetail` 类型，`id`/`cityId` 为 string，`ticketPrice`/时间字段按可空契约声明
- [x] 3.2 RED：新增 `spotFormat.test.ts`，覆盖类别、票价 `null/0/正常/非法币种`、时长、时间、闭馆与开放时间缺失
- [x] 3.3 新增 `utils/spotFormat.ts` 并实现 D6；`AttractionList.vue` 改用共享函数，保持列表既有显示语义
- [x] 3.4 RED：新增 `api/spots.test.ts`，断言 `fetchSpot` 正常拆包、HTTP 404 转为 `SpotNotFoundError`、网络/5xx 原样抛出、`code!=0` 或 `data=null` 视为普通错误
- [x] 3.5 `api/spots.ts` 新增 `SpotNotFoundError` 与 `fetchSpot(id: string)`，禁止空对象兜底
- [x] 3.6 GREEN：格式化与 API 单测全绿

## 4. 前端详情页与入口（TDD RED→GREEN）

- [x] 4.1 RED：新增 `AttractionDetail.test.ts`，覆盖加载、完整事实卡、空值占位、票价 `null/0`、404、非法 ID 不请求、普通错误重试、路由 ID 变化与迟到响应不覆盖、列表卡片字符串 ID 链接
- [x] 4.2 新增 `composables/useSpotDetail.ts`：`loading/success/notFound/error`、ID 校验、请求序号防竞态、`watch(id,...,{immediate:true})`、`load` 重试
- [x] 4.3 新增 `views/AttractionDetail.vue`：`el-skeleton` / `el-result` / `el-alert`+Retry / 事实卡，data-testid 按 design D5，描述纯文本渲染并保留换行
- [x] 4.4 `router/index.ts` 注册 `/spots/:id`（`name: "spot-detail"`，`props: true`）
- [x] 4.5 `AttractionList.vue` 卡片增加 RouterLink 到详情，ID 保持 string；更新列表测试的 RouterLink stub，断言既有四态/分页/featured 不回归
- [x] 4.6 GREEN：`npm test` 全绿

## 5. 验收与合规

- [x] 5.1 `mvn test` 全绿：详情新字段通过，①/② 列表与 404 用例不回归
- [x] 5.2 `npm test` 全绿：详情四态、路由切换、格式化、列表链接与既有列表测试不回归
- [x] 5.3 `npm run build` 通过（vue-tsc 类型检查 + vite build）
- [x] 5.4 合规：Controller 不依赖 Repository；无新增 Flyway；前端 ID 未转 Number；描述无 `v-html`；无 React/Tailwind/其它 UI 栈
- [ ] 5.5 手测（可选，需后端 + 本地 MySQL）：dev 打开列表，点击卡片进入详情，验证封面、城市、票价、交通、开放时间与返回列表；分别验证不存在 ID 与非数字 ID 的 404 表现
- [ ] 5.6 归档（用户 CLI）：delta sync 后执行 `openspec archive attractions-detail`
