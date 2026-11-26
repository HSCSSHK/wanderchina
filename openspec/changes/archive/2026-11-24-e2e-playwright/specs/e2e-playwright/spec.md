# e2e-playwright (Delta)

## ADDED Requirements

### Requirement: E2E 运行环境隔离

E2E MUST 在独立于开发栈的端口与数据库上运行：后端 `e2e` profile 监听 8081 并连接 `wanderchina_e2e`，前端监听 5174 且将 `/api` 代理到 8081。E2E MUST NOT 读写 `wanderchina_dev`，MUST NOT 复用 8080/5173 上正在运行的开发服务。

#### Scenario: 一键启动全栈

- **WHEN** 在 `frontend/` 执行 `npm run test:e2e`
- **THEN** 系统自动启动 e2e 后端与前端，等待两者就绪后执行用例
- **AND** 所有页面请求只到达 8081 与 `wanderchina_e2e`
- **AND** 运行结束后自动关闭由测试启动的进程

#### Scenario: 端口被占用

- **WHEN** 8081 或 5174 已被其它进程占用
- **THEN** 运行快速失败并指出冲突端口，不静默连接其它服务

### Requirement: E2E 种子数据由 Flyway 管理

E2E 种子 MUST 由 `classpath:db/e2e/R__e2e_seed.sql` 提供，且仅在 `e2e` profile 的 Flyway locations 中生效。种子 MUST 幂等：重复启动后数据条数与内容一致。种子 MUST 使用固定 ID 写入 4 个城市、6 个已发布景点（其中 5 个热门）与开放时间。MUST NOT 通过手工 SQL、临时脚本或业务 API 写入种子；dev/prod 的 Flyway locations MUST NOT 包含 `db/e2e`。

#### Scenario: 首次启动建库

- **WHEN** `wanderchina_e2e` 不存在或为空
- **THEN** Flyway 先执行 V1 建表，再执行 `R__e2e_seed.sql` 写入固定夹具

#### Scenario: 重复启动

- **WHEN** 再次启动 e2e 后端
- **THEN** 种子按主键 upsert，不产生重复行，列表仍为 6 条

#### Scenario: 详情夹具可断言

- **WHEN** 查询 `2000000000000000001`
- **THEN** 返回 Forbidden City：城市 `Beijing`、票价 `60.00 CNY`、时长 180 分钟、交通 `Metro Line 1 to Tianjinweizhan, then walk`、7 条开放时间（周一 `Closed`，周二至周日 `08:30-17:00`）

### Requirement: 首页入口金路径

系统 MUST 支持从首页 Hero 进入景点列表。

#### Scenario: 点击 Explore Attractions

- **WHEN** 访问 `/` 并点击 `Explore Attractions`
- **THEN** 浏览器进入 `/spots`
- **AND** 列表展示景点卡片

### Requirement: 列表到详情再返回金路径

系统 MUST 支持「列表 → 详情 → 返回列表」的完整浏览闭环，且详情 MUST 展示真实后端数据。

#### Scenario: 打开 Forbidden City 详情

- **WHEN** 用户点击文本为 `Forbidden City` 的卡片
- **THEN** URL 为 `/spots/2000000000000000001`
- **AND** 详情展示 `Forbidden City`、`故宫`、`Beijing`、`Historic`、票价含 `60.00`、`3 hr`、`Metro Line 1 to Tianjinweizhan, then walk`
- **AND** 开放时间为 7 行，其中 `Mon` 显示 `Closed`，`Tue` 显示 `08:30-17:00`

#### Scenario: 返回列表

- **WHEN** 用户点击 `Back to attractions`
- **THEN** 浏览器回到 `/spots` 并重新展示列表

### Requirement: 详情深链与历史导航

系统 MUST 支持直接访问详情 URL，并正确处理刷新与浏览器前进后退。

#### Scenario: 深链直达与刷新

- **WHEN** 直接访问 `/spots/2000000000000000002`
- **THEN** 无需经过列表即可展示 `Badaling Great Wall` 事实卡
- **WHEN** 刷新页面
- **THEN** 事实卡仍完整展示，雪花 ID 保持字符串、无精度损失

#### Scenario: 浏览器后退

- **WHEN** 从列表进入详情后触发浏览器后退
- **THEN** 回到 `/spots`，列表可用

### Requirement: 热门筛选

系统 MUST 支持在列表页切换热门筛选，并只展示热门景点。

#### Scenario: 开启与关闭热门

- **WHEN** 点击 `Featured: Off`
- **THEN** 按钮变为 `Featured: On`，列表只剩 5 条，`Oriental Pearl Tower` 消失，其余卡片均含 `Featured` 标签
- **WHEN** 再次点击
- **THEN** 恢复 6 条，`Oriental Pearl Tower` 重新出现

### Requirement: 详情未找到

系统 MUST 将不存在或非法 ID 的详情请求呈现为独立未找到态。

#### Scenario: 不存在的数字 ID

- **WHEN** 访问 `/spots/99999999999`
- **THEN** 展示 `Attraction not found`，不提供 `Retry`，返回列表链接可用

#### Scenario: 非数字 ID

- **WHEN** 访问 `/spots/not-a-number`
- **THEN** 展示未找到态，且不向详情接口发起请求

### Requirement: 错误态与重试

系统 MUST 在列表或详情接口发生 5xx 时展示错误态，并允许用户重试恢复。故障注入 MUST 只用于测试错误分支，MUST NOT 修改真实接口契约或种子数据。

#### Scenario: 列表 5xx 后重试恢复

- **WHEN** 对列表接口注入 HTTP 500 并访问 `/spots`
- **THEN** 展示错误提示与 `Retry`
- **WHEN** 解除注入并点击 `Retry`
- **THEN** 列表恢复展示

#### Scenario: 详情 5xx 后重试恢复

- **WHEN** 对详情接口注入 HTTP 500 并访问 `/spots/2000000000000000001`
- **THEN** 展示错误提示与 `Retry`
- **WHEN** 解除注入并点击 `Retry`
- **THEN** 事实卡展示

### Requirement: 验收门禁与产物

E2E MUST 使用现有 `data-testid` 与 web-first 断言，MUST NOT 使用固定 `sleep`。失败时 MUST 留下 trace 与截图。验收 MUST 同时满足 `npm run test:e2e`、`npm test`、`mvn test`、`npm run build` 全绿。运行产物 MUST NOT 提交到仓库。

#### Scenario: 失败可诊断

- **WHEN** 某条 E2E 用例失败
- **THEN** `test-results/` 中保留对应 trace 与截图，HTML 报告可本地打开

#### Scenario: 全量回归

- **WHEN** 执行四项门禁命令
- **THEN** 全部通过，且 `wanderchina_dev` 数据不被改写
