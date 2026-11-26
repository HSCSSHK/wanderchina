# attractions-data-model (Delta)

## MODIFIED Requirements

### Requirement: 只读景点详情端点与未找到路径

系统 SHALL 提供 `GET /api/spots/{id}` 返回单景点事实卡（含开放时间数组），以 `Result<T>` 包装。当 `id` 不存在（或已逻辑删除/未发布）时，MUST 经全局异常处理返回可解析的 `Result`（`code!=0`、`data=null`），**不回显堆栈/SQL**，HTTP 语义 404。

详情载荷 MUST 额外包含用户可读的 `cityName`。`cityName` MUST 由 `scenic_spot` join 关联 `geo_city.name_en`，与详情主体在**同一次查询内**投影取回；此增强 MUST NOT 引入建表/迁移（所依赖表与列均已存在）。响应中的雪花 `id` MUST 序列化为 **String**。

#### Scenario: 请求不存在的景点

- **WHEN** 客户端 `GET /api/spots/{不存在或已删除的id}`
- **THEN** 返回 `Result`（`code!=0`、`data` 为 null），响应体不含异常堆栈关键字

#### Scenario: 已发布景点详情携带城市名与完整事实字段

- **WHEN** 客户端请求一个已发布景点的详情
- **THEN** 返回 HTTP 200、`code=0`，载荷包含 `cityName`、票价与币种、坐标、游览时长、交通摘要、英文友好标记、封面及开放时间数组
- **AND** `cityName` 来自关联 `geo_city`，详情主体与城市名由一次 JOIN 投影查询取回
- **AND** 响应中的 `id` 为字符串形式

#### Scenario: 未发布景点不通过详情接口泄露

- **WHEN** 客户端请求一个存在但 `is_published=0` 的景点 ID
- **THEN** 按未找到路径返回 HTTP 404 与统一失败 `Result`，不返回该景点事实卡
