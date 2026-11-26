# attractions-detail Specification

## Purpose

TBD - created by archiving change attractions-detail. Update Purpose after archive.

## Requirements

### Requirement: 景点详情入口与路由参数

系统 SHALL 提供 `/spots/:id` 详情路由，并允许用户从景点列表卡片进入对应详情。列表入口 MUST 使用景点 `id` 的原始字符串构造路由参数，MUST NOT 转换为 JavaScript `Number` 或其他会损失雪花 ID 精度的数值类型。

#### Scenario: 从列表进入详情

- **WHEN** 用户点击某个景点卡片
- **THEN** 浏览器进入该景点的 `/spots/:id` 路由
- **AND** 路由参数与卡片 `id` 字符串完全一致

### Requirement: 详情加载生命周期

系统 SHALL 在详情请求 pending 期间展示加载占位，且 MUST NOT 同时展示旧详情、错误态或未找到态。进入详情页时 MUST 对当前 `id` 发起请求；路由 `id` 变化时 MUST 重新加载对应景点。较早请求的迟到响应 MUST NOT 覆盖较新 `id` 的结果。

#### Scenario: 打开详情页

- **WHEN** 用户进入 `/spots/:id`
- **THEN** 页面立即展示加载占位，并仅对当前 `id` 发起一次初始请求
- **AND** 请求成功后加载占位消失

#### Scenario: 同一组件切换到另一个景点

- **WHEN** 路由从一个合法景点 `id` 变化为另一个合法 `id`
- **THEN** 系统重新发起详情请求，且旧请求的迟到响应不得覆盖新景点的展示状态

### Requirement: 结构化事实卡渲染

系统 SHALL 在详情加载成功后渲染景点名称、城市、分类、封面、票价、游览时长、坐标、描述、交通摘要与开放时间。可空字段 MUST 显示明确占位，MUST NOT 直接渲染 `null` 或 `undefined`。描述 MUST 按纯文本渲染，MUST NOT 作为 HTML 注入。

票价 MUST 遵循：`null` 表示未知，显示 `Not listed`；`0` 表示免费，显示 `Free`；非零值按 `ticketCurrency` 格式化。开放时间 MUST 遵循 `0=周一` 至 `6=周日`；`closed=true` 显示 `Closed`，不得再展示开闭馆时间；开闭馆时间缺失但未标记闭馆时显示 `Hours not available`；开放时间数组为空时显示明确占位。

#### Scenario: 完整事实卡渲染

- **WHEN** 详情请求成功并返回完整字段
- **THEN** 页面展示景点名、城市名、分类、票价、游览时长、坐标、描述、交通与开放时间
- **AND** 每张卡片入口的 `id` 与详情载荷中的 `id` 均按字符串处理

#### Scenario: 缺失字段与开放时间格式

- **WHEN** 票价为 `null`、描述为空、封面缺失，或开放时间标记为闭馆/时间为空
- **THEN** 页面显示对应占位或 `Closed`/`Hours not available`
- **AND** 票价为 `0` 时显示 `Free`，不与未知票价混淆

### Requirement: 景点未找到态

系统 SHALL 将详情接口的 HTTP 404，或非法详情路由 `id`，呈现为独立未找到态。未找到态 MUST 提供返回景点列表的入口，MUST NOT 提供请求重试操作，也 MUST NOT 展示内部异常、堆栈或 SQL。

#### Scenario: 请求不存在的景点

- **WHEN** 详情接口返回 HTTP 404
- **THEN** 页面显示 `Attraction not found` 与返回列表链接
- **AND** 页面不显示事实卡、加载占位或普通错误重试按钮

#### Scenario: 非法路由 ID

- **WHEN** 路由 `id` 不是合法数字字符串
- **THEN** 页面直接呈现未找到态，不向详情接口发起请求

### Requirement: 详情错误与重试

系统 SHALL 将网络错误、HTTP 5xx、`code!=0`，以及 `code=0` 但 `data` 为空的非预期成功响应归为普通错误态。错误态 MUST 展示可读提示与重试操作，MUST NOT 暴露堆栈、SQL 或内部类名。重试 MUST 使用当前详情 `id`。

#### Scenario: 请求失败后重试成功

- **WHEN** 详情请求因网络错误或服务端错误失败
- **THEN** 页面显示错误提示和 `Retry`，不显示事实卡
- **WHEN** 用户点击 `Retry`
- **THEN** 系统使用当前 `id` 重新请求，成功后展示事实卡
