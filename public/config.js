// AoBoBo 运行时配置
// 同时兼容 nazhua-front 的 window.$$nazhuaConfig
window.$$aoboboConfig = {
  // title: 'AoBoBo', // 网站标题
  // nezhaVersion: 'v1', // 哪吒版本：v0 | v1；不填则自动探测

  // 监控图表类型：single | multi
  // monitorChartType: 'multi',
  // monitorChartTypeToggle: true, // 是否允许切换监控图表类型

  // 监控刷新间隔（秒），0 为不刷新
  // monitorRefreshTime: 30,

  // 资源统计弹窗成本换算
  // statsCostCurrency: 'USD',
  // 当服务器价格未标注币种时使用的默认币种（如纯数字 "99" 会被视为 CNY）
  // defaultCostCurrency: 'CNY',
  // exchangeRateEnabled: true,
  // exchangeRateApiBase: 'https://api.frankfurter.dev/v2',
  // exchangeRateCacheHours: 24,

  // 是否隐藏详情页周期流量卡片
  // hideDetailCycleTransfer: false,
  // 详情页周期流量刷新间隔（秒）
  // detailCycleTransferRefreshTime: 60,
  // 是否隐藏详情页头部微缩 3D 地球
  // hideDetailServerGlobe: false,

  // GPU 名称中包含以下关键字时过滤掉
  // filterGPUKeywords: ['Virtual Display'],

  // v0 接口路径配置（一般无需修改）
  // apiMonitorPath: '/api/v1/monitor/{id}',
  // showAvailability: false, // 是否展示可用性数据
  // apiAvailabilityPath: '/api/v1/server/availability', // 可用性数据接口路径
  // availabilityRefreshTime: 60, // 可用性数据刷新间隔（秒），0 为不刷新
  // wsPath: '/ws',
  // nezhaPath: '/nezha/',
  // v0ServicePath: null,
  // nezhaV0ConfigType: 'servers',

  // v1 接口路径配置（一般无需修改）
  // v1ApiMetricsPath: '/api/v1/server/{id}/metrics',
  // v1ApiMonitorPath: '/api/v1/server/{id}/service',
  // v1ApiMonitorPathFallback: '/api/v1/service/{id}',
  // v1ApiServicePath: '/api/v1/service',
  // v1WsPath: '/api/v1/ws/server',
  // v1GroupPath: '/api/v1/server-group',
  // v1ApiSettingPath: '/api/v1/setting',
  // v1ApiProfilePath: '/api/v1/profile',

  // v1 版本控制台地址与登录入口
  // v1DashboardUrl: '/dashboard', // v1 版本管理后台地址
  // v1HideNezhaDashboardBtn: false, // 是否隐藏顶部管理后台/登录入口
};
