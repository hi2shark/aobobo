import { reactive } from 'vue';
import { loadProfile as loadNezhaV1Profile } from '@/utils/load-nezha-v1-config';

const defaultNezhaVersion = import.meta.env.VITE_NEZHA_VERSION;

// 优先读取 $$aoboboConfig，同时兼容 nazhua-front 的 $$nazhuaConfig
const runtimeConfig = window.$$aoboboConfig || window.$$nazhuaConfig || {};

const config = reactive({
  init: false,
  nazhua: {
    title: '哪吒监控',
    nezhaVersion: ['v0', 'v1'].includes(defaultNezhaVersion) ? defaultNezhaVersion : null,
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
    detailCycleTransferRefreshTime: 60,
    hideDetailCycleTransfer: false,
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

if (config.nazhua.nezhaVersion) {
  config.init = true;
}

export function mergeAoboboConfig(customConfig) {
  Object.keys(customConfig).forEach((key) => {
    config.nazhua[key] = customConfig[key];
  });
}

// 保留 nazhua 的命名作为兼容别名
export const mergeNazhuaConfig = mergeAoboboConfig;
window.$mergeAoboboConfig = mergeAoboboConfig;
window.$mergeNazhuaConfig = mergeAoboboConfig;

export default config;

export const init = async () => {
  await loadNezhaV1Profile(true).then((res) => {
    config.nazhua.nezhaVersion = res ? 'v1' : 'v0';
  });
  config.init = true;
};
