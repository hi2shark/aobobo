# AoBoBo 运行时配置说明

AoBoBo 通过 `config.js` 注入运行时常量，部署时只需替换该文件即可自定义站点行为，无需重新打包镜像。

> **兼容提示**：AoBoBo 同时读取 `window.$$aoboboConfig` 与 `window.$$nazhuaConfig`，如果之前使用过 nazhua-front 的配置，可以直接复用。

---

## 基础配置

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `title` | `string` | `'哪吒监控'` | 网站标题，会显示在浏览器标签页与页面头部。 |
| `nezhaVersion` | `'v0' / 'v1' / 'santaizi' / null` | `null` | 强制指定后端兼容版本。`v0` 使用页面抓取 + WS，`v1` 使用 REST API + WS，`santaizi` 适配三太子公开 API（`/api/v2/public/*`）；不填则运行时自动探测。 |

## 监控与详情页

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `monitorChartType` | `'single' / 'multi'` | `'multi'` | 服务器详情页监控图表默认展示模式。`single` 为单图切换，`multi` 为多指标并列。 |
| `monitorChartTypeToggle` | `boolean` | `true` | 是否允许用户在详情页切换监控图表类型。 |
| `monitorRefreshTime` | `number` | `30` | 监控数据刷新间隔（秒），设置为 `0` 则不自动刷新。 |
| `hideDetailCycleTransfer` | `boolean` | `false` | 是否隐藏服务器详情页的周期流量卡片。 |
| `detailCycleTransferRefreshTime` | `number` | `60` | 详情页周期流量刷新间隔（秒）。 |
| `hideDetailServerGlobe` | `boolean` | `false` | 是否隐藏服务器详情页头部的微缩 3D 地球。 |
| `globeActivityEffects` | `boolean` | `true` | 是否启用地图首页地球节点的连接汇入点与流量射线特效。设为 `false` 可关闭。 |
| `globeConnParticleDirection` | `'in' / 'out'` | `'in'` | 连接数粒子的运动方向。`in` 为从外向内聚拢，`out` 为从内向外发散。 |

## 成本与汇率

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `statsCostCurrency` | `string` | `'CNY'` | 资源统计弹窗中成本换算的目标币种。 |
| `defaultCostCurrency` | `string` | `'CNY'` | 当服务器价格未标注币种时使用的默认币种，例如纯数字 `"99"` 会被视为该币种。 |
| `exchangeRateEnabled` | `boolean` | `true` | 是否启用汇率换算。 |
| `exchangeRateApiBase` | `string` | `'https://api.frankfurter.dev/v2'` | 汇率 API 的基础地址。 |
| `exchangeRateCacheHours` | `number` | `24` | 汇率数据本地缓存时长（小时）。 |

## GPU 过滤

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `filterGPUKeywords` | `string[]` | `['Virtual Display']` | GPU 名称中包含以下关键字时会被过滤掉，不显示在服务器详情中。 |

## v0 接口路径（一般无需修改）

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `apiMonitorPath` | `string` | `'/api/v1/monitor/{id}'` | v0 监控数据接口路径，`{id}` 为服务器 ID 占位符。 |
| `apiAvailabilityPath` | `string` | `'/api/v1/server/availability'` | 可用性数据接口路径。若后端提供该接口且返回有效数据，列表与详情页会展示服务器可用率。 |
| `availabilityRefreshTime` | `number` | `60` | 可用性数据刷新间隔（秒），设置为 `0` 则不自动刷新。 |
| `showAvailability` | `boolean` | `false` | 是否展示可用性数据。v0/v1 对应 `/api/v1/server/availability`（nezha-next 扩展）。santaizi 默认跟随 bootstrap 的 `show_availability`；仅当 `config.js` 显式设置本项时覆盖。 |
| `wsPath` | `string` | `'/ws'` | v0 WebSocket 实时数据路径。 |
| `nezhaPath` | `string` | `'/nezha/'` | v0 哪吒 Dashboard 页面路径，用于解析服务器列表与公开备注。 |
| `v0ServicePath` | `string / null` | `null` | v0 服务页路径，为空时默认使用 `{nezhaPath}service`。 |
| `nezhaV0ConfigType` | `string` | `'servers'` | v0 配置解析类型，一般保持默认。 |

## v1 接口路径（一般无需修改）

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `v1ApiMetricsPath` | `string` | `'/api/v1/server/{id}/metrics'` | v1 服务器指标历史接口路径，`{id}` 为服务器 ID 占位符。 |
| `v1ApiMonitorPath` | `string` | `'/api/v1/server/{id}/service'` | v1 监控数据接口路径，`{id}` 为服务器 ID 占位符。 |
| `v1ApiMonitorPathFallback` | `string` | `'/api/v1/service/{id}'` | v1 监控数据兜底路径，当主路径不可用或兼容旧版本时回退使用。 |
| `v1ApiServicePath` | `string` | `'/api/v1/service'` | v1 周期流量与服务信息接口路径。 |
| `v1WsPath` | `string` | `'/api/v1/ws/server'` | v1 WebSocket 实时数据路径。 |
| `v1GroupPath` | `string` | `'/api/v1/server-group'` | v1 服务器分组接口路径。 |
| `v1ApiSettingPath` | `string` | `'/api/v1/setting'` | v1 站点设置接口路径。 |
| `v1ApiProfilePath` | `string` | `'/api/v1/profile'` | v1 用户资料接口路径，用于判断是否为 v1 环境。 |

## v1 登录/管理后台入口

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `v1DashboardUrl` | `string` | `'/dashboard'` | v1 版本管理后台地址，顶部登录入口跳转目标。 |
| `v1HideNezhaDashboardBtn` | `boolean` | `false` | 是否隐藏顶部的管理后台/登录入口。仅在 `nezhaVersion` 为 `v1` 时生效。 |

## santaizi（三太子）接口路径（一般无需修改）

仅在 `nezhaVersion` 为 `'santaizi'` 时生效，对应三太子公开 API（`/api/v2/public/*`）。

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `stzBootstrapPath` | `string` | `'/api/v2/public/bootstrap'` | santaizi 站点引导配置接口路径，用于版本自动探测、站点标题、查看密码与可用性开关。 |
| `stzWsPath` | `string` | `'/ws/v2/public/runtime'` | santaizi WebSocket 实时数据路径。 |
| `stzApiServersPath` | `string` | `'/api/v2/public/servers'` | santaizi 公开服务器列表快照。启动时先拉此接口再连接 WebSocket。 |
| `stzApiNetworkPath` | `string` | `'/api/v2/public/network/{id}'` | santaizi 网络监控（延迟）历史接口路径，`{id}` 为服务器 ID 占位符。 |
| `stzApiMetricsPath` | `string` | `'/api/v2/public/metrics/{id}'` | santaizi 资源历史（CPU/内存/磁盘/网速/进程数/TCP/UDP）接口路径，`{id}` 为服务器 ID 占位符。 |
| `stzApiCycleTransferPath` | `string` | `'/api/v2/public/cycle-transfer'` | santaizi 周期流量接口路径，单服务器查询时自动附加 `server_id` 参数。 |
| `stzApiAvailabilityPath` | `string` | `'/api/v2/public/servers/{id}/availability'` | santaizi 单服务器 30 天可用率接口路径，`{id}` 为服务器 ID 占位符。 |
| `stzViewPasswordPath` | `string` | `'/api/v2/public/view-password/session'` | santaizi 查看密码校验接口路径。站点启用访问密码时，未验证会跳转 `/view-password`。 |

说明：

- 服务器分组由 `tag` 字段在前端派生，无需单独接口。
- 可用性默认跟随 bootstrap 的 `show_availability`。若 `config.js` 显式设置了 `showAvailability`，则以配置为准。
- 资源历史的时间范围：24 小时内使用 `1m` 粒度，7 天/30 天自动改用 `1h` 粒度。公开 metrics 不含 Swap 历史。

---

## 完整示例

```js
window.$$aoboboConfig = {
  title: 'AoBoBo',
  nezhaVersion: 'v1',

  monitorChartType: 'multi',
  monitorChartTypeToggle: true,
  monitorRefreshTime: 30,

  hideDetailCycleTransfer: false,
  detailCycleTransferRefreshTime: 60,
  hideDetailServerGlobe: false,
  globeActivityEffects: true,
  globeConnParticleDirection: 'in',

  statsCostCurrency: 'USD',
  defaultCostCurrency: 'CNY',
  exchangeRateEnabled: true,
  exchangeRateApiBase: 'https://api.frankfurter.dev/v2',
  exchangeRateCacheHours: 24,

  filterGPUKeywords: ['Virtual Display'],

  // 以下通常保持默认
  apiMonitorPath: '/api/v1/monitor/{id}',
  // nezha-next 才有的功能、原版nezha不存在这个功能
  showAvailability: false,
  apiAvailabilityPath: '/api/v1/server/availability',
  availabilityRefreshTime: 60,
  wsPath: '/ws',
  nezhaPath: '/nezha/',
  v0ServicePath: null,
  nezhaV0ConfigType: 'servers',

  v1ApiMetricsPath: '/api/v1/server/{id}/metrics',
  v1ApiMonitorPath: '/api/v1/server/{id}/service',
  v1ApiMonitorPathFallback: '/api/v1/service/{id}',
  v1ApiServicePath: '/api/v1/service',
  v1WsPath: '/api/v1/ws/server',
  v1GroupPath: '/api/v1/server-group',
  v1ApiSettingPath: '/api/v1/setting',
  v1ApiProfilePath: '/api/v1/profile',

  v1DashboardUrl: '/dashboard',
  v1HideNezhaDashboardBtn: false,

  // santaizi（nezhaVersion: 'santaizi' 时生效）
  stzBootstrapPath: '/api/v2/public/bootstrap',
  stzWsPath: '/ws/v2/public/runtime',
  stzApiServersPath: '/api/v2/public/servers',
  stzApiNetworkPath: '/api/v2/public/network/{id}',
  stzApiMetricsPath: '/api/v2/public/metrics/{id}',
  stzApiCycleTransferPath: '/api/v2/public/cycle-transfer',
  stzApiAvailabilityPath: '/api/v2/public/servers/{id}/availability',
  stzViewPasswordPath: '/api/v2/public/view-password/session',
};
```

更多部署方式见 [README.md](../README.md)。
