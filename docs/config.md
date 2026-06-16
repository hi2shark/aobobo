# AoBoBo 运行时配置说明

AoBoBo 通过 `config.js` 注入运行时常量，部署时只需替换该文件即可自定义站点行为，无需重新打包镜像。

> **兼容提示**：AoBoBo 同时读取 `window.$$aoboboConfig` 与 `window.$$nazhuaConfig`，如果之前使用过 nazhua-front 的配置，可以直接复用。

---

## 基础配置

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `title` | `string` | `'哪吒监控'` | 网站标题，会显示在浏览器标签页与页面头部。 |
| `nezhaVersion` | `'v0' / 'v1' / null` | `null` | 强制指定哪吒版本。`v0` 使用页面抓取 + WS，`v1` 使用 REST API + WS；不填则运行时自动探测。 |

## 监控与详情页

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `monitorChartType` | `'single' / 'multi'` | `'multi'` | 服务器详情页监控图表默认展示模式。`single` 为单图切换，`multi` 为多指标并列。 |
| `monitorChartTypeToggle` | `boolean` | `true` | 是否允许用户在详情页切换监控图表类型。 |
| `monitorRefreshTime` | `number` | `30` | 监控数据刷新间隔（秒），设置为 `0` 则不自动刷新。 |
| `hideDetailCycleTransfer` | `boolean` | `false` | 是否隐藏服务器详情页的周期流量卡片。 |
| `detailCycleTransferRefreshTime` | `number` | `60` | 详情页周期流量刷新间隔（秒）。 |

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
| `wsPath` | `string` | `'/ws'` | v0 WebSocket 实时数据路径。 |
| `nezhaPath` | `string` | `'/nezha/'` | v0 哪吒 Dashboard 页面路径，用于解析服务器列表与公开备注。 |
| `v0ServicePath` | `string / null` | `null` | v0 服务页路径，为空时默认使用 `{nezhaPath}service`。 |
| `nezhaV0ConfigType` | `string` | `'servers'` | v0 配置解析类型，一般保持默认。 |

## v1 接口路径（一般无需修改）

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
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

  statsCostCurrency: 'USD',
  defaultCostCurrency: 'CNY',
  exchangeRateEnabled: true,
  exchangeRateApiBase: 'https://api.frankfurter.dev/v2',
  exchangeRateCacheHours: 24,

  filterGPUKeywords: ['Virtual Display'],

  // 以下通常保持默认
  apiMonitorPath: '/api/v1/monitor/{id}',
  wsPath: '/ws',
  nezhaPath: '/nezha/',
  v0ServicePath: null,
  nezhaV0ConfigType: 'servers',

  v1ApiMonitorPath: '/api/v1/server/{id}/service',
  v1ApiMonitorPathFallback: '/api/v1/service/{id}',
  v1ApiServicePath: '/api/v1/service',
  v1WsPath: '/api/v1/ws/server',
  v1GroupPath: '/api/v1/server-group',
  v1ApiSettingPath: '/api/v1/setting',
  v1ApiProfilePath: '/api/v1/profile',

  v1DashboardUrl: '/dashboard',
  v1HideNezhaDashboardBtn: false,
};
```

更多部署方式见 [README.md](../README.md)。
