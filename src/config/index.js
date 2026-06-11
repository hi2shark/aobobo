import { reactive } from 'vue';
import { loadProfile as loadNezhaV1Profile } from '@/utils/load-nezha-v1-config';

const defaultNezhaVersion = import.meta.env.VITE_NEZHA_VERSION;

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
    ...(window.$$nazhuaConfig || {}),
  },
});

if (config.nazhua.nezhaVersion) {
  config.init = true;
}

export function mergeNazhuaConfig(customConfig) {
  Object.keys(customConfig).forEach((key) => {
    config.nazhua[key] = customConfig[key];
  });
}
window.$mergeNazhuaConfig = mergeNazhuaConfig;

export default config;

export const init = async () => {
  await loadNezhaV1Profile(true).then((res) => {
    config.nazhua.nezhaVersion = res ? 'v1' : 'v0';
  });
  config.init = true;
};
