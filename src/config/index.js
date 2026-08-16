import { reactive } from 'vue';
import { loadProfile as loadNezhaV1Profile } from '@/utils/load-nezha-v1-config';
import loadStzBootstrap from '@/utils/load-stz-config';

const defaultNezhaVersion = import.meta.env.VITE_NEZHA_VERSION;

// 优先读取 $$aoboboConfig，同时兼容 nazhua-front 的 $$nazhuaConfig
const runtimeConfig = window.$$aoboboConfig || window.$$nazhuaConfig || {};

const config = reactive({
  init: false,
  aobobo: {
    title: '哪吒监控',
    nezhaVersion: ['v0', 'v1', 'santaizi'].includes(defaultNezhaVersion) ? defaultNezhaVersion : null,
    apiMonitorPath: '/api/v1/monitor/{id}',
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
    stzBootstrapPath: '/api/v2/public/bootstrap',
    stzWsPath: '/ws/v2/public/runtime',
    stzApiServersPath: '/api/v2/public/servers',
    stzApiNetworkPath: '/api/v2/public/network/{id}',
    stzApiMetricsPath: '/api/v2/public/metrics/{id}',
    stzApiCycleTransferPath: '/api/v2/public/cycle-transfer',
    stzApiAvailabilityPath: '/api/v2/public/servers/{id}/availability',
    stzViewPasswordPath: '/api/v2/public/view-password/session',
    detailCycleTransferRefreshTime: 60,
    hideDetailCycleTransfer: false,
    hideDetailServerGlobe: false,
    globeActivityEffects: true,
    globeConnParticleDirection: 'in',
    monitorRefreshTime: 30,
    monitorChartType: 'multi',
    monitorChartTypeToggle: true,
    statsCostCurrency: 'CNY',
    defaultCostCurrency: 'CNY',
    exchangeRateEnabled: true,
    exchangeRateApiBase: 'https://api.frankfurter.dev/v2',
    exchangeRateCacheHours: 24,
    filterGPUKeywords: ['Virtual Display'],
    ...runtimeConfig,
  },
});

if (config.aobobo.nezhaVersion) {
  config.init = true;
}

export function mergeAoboboConfig(customConfig) {
  Object.keys(customConfig).forEach((key) => {
    config.aobobo[key] = customConfig[key];
  });
}

// 保留 nazhua 的命名作为兼容别名
export const mergeNazhuaConfig = mergeAoboboConfig;
window.$mergeAoboboConfig = mergeAoboboConfig;
window.$mergeNazhuaConfig = mergeAoboboConfig;

export const hasRuntimeShowAvailability = Object.prototype.hasOwnProperty.call(
  runtimeConfig,
  'showAvailability',
);

export default config;

export const init = async () => {
  // 依次探测：santaizi 公开 bootstrap → v1 profile → 回退 v0
  const isStz = await loadStzBootstrap(true);
  if (isStz) {
    config.aobobo.nezhaVersion = 'santaizi';
    config.init = true;
    return;
  }
  await loadNezhaV1Profile(true).then((res) => {
    config.aobobo.nezhaVersion = res ? 'v1' : 'v0';
  });
  config.init = true;
};
