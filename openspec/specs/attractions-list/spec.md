# attractions-list Specification

## Purpose

TBD - created by archiving change attractions-list. Update Purpose after archive.

## Requirements

### Requirement: 景点发现列表渲染

系统 SHALL 在 `/spots` 路由提供景点发现列表页，消费 `GET /api/spots` 并渲染每个摘要项为一张卡片，卡片 MUST 展示 `nameEn`、`cityName`、`categoryCode`（映射为英文标签）、`featured`（热门徽标）、`coverImageUrl`（缺图时有占位），并可用 `ticketPrice`/`description` 作辅助信息。`id`/`slug` MUST 作为不透明标识用于构造详情跳转入口（详情页属 ③，本页不实现其内容）。

#### Scenario: 成功渲染景点卡片

- **WHEN** 列表请求成功返回 N 个景点
- **THEN** 渲染 N 张卡片，每张含景点名与城市名，且每个 `id` 按字符串使用

### Requirement: 列表加载中态

系统 SHALL 在列表请求 pending 期间展示加载占位（`el-skeleton`），且此时 MUST NOT 渲染列表内容、错误提示或空态。

#### Scenario: 请求未返回时显示加载占位

- **WHEN** 已发起请求且尚未收到响应
- **THEN** 显示加载占位，隐藏列表/错误/空态

### Requirement: 列表空数据态

系统 SHALL 在请求成功但 `content` 为空（`code=0`）时展示空态（`el-empty`），而非错误态或列表。

#### Scenario: 无匹配景点时显示空态

- **WHEN** 接口返回 `code=0` 且 `content` 为空数组
- **THEN** 显示空态提示，隐藏列表与错误提示

### Requirement: 列表错误态与重试

系统 SHALL 在请求被拒/超时，或返回 `code!=0` 时展示错误态（`el-alert`）并提供"重试"入口；错误态 MUST 隐藏列表与空态。重试 MUST 重新发起列表请求。

#### Scenario: 网络失败显示错误并可重试

- **WHEN** 请求 reject 或返回 `code!=0`
- **THEN** 显示错误提示与重试按钮，隐藏列表；点击重试重新请求

### Requirement: 页码分页

系统 SHALL 使用页码式分页（`el-pagination`），`total` 取自后端返回；切换页码 MUST 以对应 `page` 重新请求并渲染该页数据。MUST NOT 采用无限滚动（本 change 非目标）。

#### Scenario: 翻到第 N 页重新拉取

- **WHEN** 用户切换到第 N 页
- **THEN** 以 `page=N` 重新请求并渲染新页内容，分页器反映 `total`

### Requirement: 热门筛选开关

系统 SHALL 提供一个 `featured`（热门）开关，开启时以 `featured=true` 请求、关闭时不带该过滤；切换 MUST 使结果回到第 0 页并重新请求。城市/分类筛选不在本 change 范围。

#### Scenario: 仅看热门

- **WHEN** 用户开启热门开关
- **THEN** 以 `featured=true` 重新请求并渲染结果，页码重置为第 0 页

### Requirement: 挂载单次请求

系统 SHALL 在列表组件挂载时仅发起一次列表请求，避免重复触发（沿用骨架期门禁）。

#### Scenario: 挂载只请求一次

- **WHEN** 组件首次挂载
- **THEN** 仅发起一次 `GET /api/spots`
