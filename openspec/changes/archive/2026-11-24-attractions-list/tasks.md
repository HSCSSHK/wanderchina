# Tasks: attractions-list

## 1. 准备

- [x] 1.1 复核 ① 契约：`SpotSummaryDto`/`GET /api/spots` 现状；确认无迁移需求（列均存在）
- [x] 1.2 确认 `frontend` axios / Element Plus / vitest 版本与 `data-testid` 约定（对齐 HelloCard 测试）

## 2. 后端投影增强（TDD RED→GREEN）

- [x] 2.1 RED：扩展 `SpotApiTests`——夹具补 `coverImageUrl`/`ticketPrice`/`description`，断言 `$.data.content[0].cityName`（来自 geo_city）、`coverImageUrl`、`ticketPrice`、`description` 存在；`mvn test` 见断言失败
- [x] 2.2 `SpotSummaryDto` 扩为 10 字段 + 全参构造器（D1 顺序）
- [x] 2.3 `ScenicSpotRepository` 新增 `@Query` 构造器表达式 join 投影 `findSpots(...)`（ad-hoc join GeoCity，`(:p IS NULL OR ...)` 可选过滤，硬编码 ORDER BY，无 N+1）
- [x] 2.4 `SpotQueryService.list(...)` 改为委托 `findSpots`；详情端点保持不变
- [x] 2.5 GREEN：`mvn test` 全绿（验证 R1 参数绑定；失败则按 D1 退路改接口投影）

## 3. 前端 API 与类型（TDD RED→GREEN）

- [x] 3.1 抽 `src/api/http.ts` 共享 axios 实例；`hello.ts` 改用之（保持原行为，HelloCard 测试仍绿）
- [x] 3.2 新增 `src/types/spots.ts`（`SpotListItem`/`SpotsPage`/`SpotsQuery`，id/cityId 为 string）
- [x] 3.3 新增 `src/api/spots.ts` `fetchSpots(params)`（拆 `Result`，`code!==0` 抛错）
- [x] 3.4 RED：`AttractionList.test.ts` `vi.mock('../api/spots')`，覆盖四态 + 分页 + featured + 挂载单次；未实现组件前跑 `npm test` 见失败
- [x] 3.5 新增 `src/composables/useSpots.ts` 状态机（loading/success/empty/error、page、featured、load、watch 触发）

## 4. 前端组件与路由（GREEN）

- [x] 4.1 实现 `src/views/AttractionList.vue`：el-skeleton/el-empty/el-alert+retry/列表卡片(el-image 占位 + name + cityName + 类别标签 + featured 徽标)/el-pagination/热门开关，data-testid 齐备
- [x] 4.2 `categoryLabel` 映射（O1 定价展示按 design 倾向）
- [x] 4.3 `src/router/index.ts`：`/spots` 由 Placeholder 改为 AttractionList
- [x] 4.4 GREEN：`npm test` 全绿

## 5. 验收与合规

- [x] 5.1 `mvn test` 全绿（后端 ① 用例不回归 + 新字段断言通过）
- [x] 5.2 `npm test` 全绿（AttractionList 四态/分页/featured/单次 + HelloCard 不回归）
- [x] 5.3 `npm run build` 通过（vue-tsc/vite）
- [ ] 5.4 手测（可选，需后端+MySQL 在跑）：dev 打开 `/spots`，验证列表渲染、翻页、热门开关、空/错误态；`GET /api/spots` 响应含 `cityName` 等 4 新字段
- [x] 5.5 合规：后端仍 Controller→Service→Repository 无越界；无新增迁移；前端无禁用栈（Tailwind/AntDesign/React）；无逐行二次查城市（N+1）
- [ ] 5.6 归档（用户 CLI）：delta sync（列表端点需求并入 attractions-data-model、新增 attractions-list）后 `openspec archive attractions-list`
