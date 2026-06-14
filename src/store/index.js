import { createStore } from 'vuex';
import dayjs from 'dayjs';
import config from '@/config';
import {
  loadServerGroup as loadNezhaV1ServerGroup,
  loadSetting as loadNezhaV1Setting,
  loadProfile as loadNezhaV1Profile,
} from '@/utils/load-nezha-v1-config';
import loadNezhaV0Config, {
  loadServerGroup as loadNezhaV0ServerGroup,
} from '@/utils/load-nezha-v0-config';
import { msg } from '@/ws';
import {
  THEME_MODES,
  applyResolvedTheme,
  getThemeMediaQuery,
  loadThemeMode,
  normalizeThemeMode,
  persistThemeMode,
  resolveTheme,
} from '@/utils/theme';

const defaultState = () => ({
  init: false,
  serverTime: 0,
  serverGroup: [],
  serverList: [],
  serverCount: {
    total: 0,
    online: 0,
    offline: 0,
  },
  profile: {},
  setting: {},
  themeMode: THEME_MODES.AUTO,
  resolvedTheme: 'dark',
  globeFocus: null,
});

function isOnline(LastActive, currentTime = Date.now()) {
  const lastActiveTime = dayjs(LastActive)?.valueOf?.() || 0;
  if (currentTime - lastActiveTime > 10 * 1000) {
    return -1;
  }
  return 1;
}

function handleServerCount(servers) {
  return {
    total: servers.length,
    online: servers.filter((i) => i.online === 1).length,
    offline: servers.filter((i) => i.online === -1).length,
  };
}

let firstSetServers = true;
let removeThemeListener = null;

const store = createStore({
  state: defaultState(),
  mutations: {
    SET_SERVER_TIME(state, time) {
      state.serverTime = time;
    },
    SET_SERVER_GROUP(state, serverGroup) {
      state.serverGroup = serverGroup;
    },
    SET_SERVERS(state, servers) {
      const newServers = [...servers];
      newServers.sort((a, b) => b.DisplayIndex - a.DisplayIndex);
      state.serverList = newServers;
      state.serverCount = handleServerCount(newServers);
      state.init = true;
    },
    UPDATE_SERVERS(state, servers) {
      const oldServersMap = {};
      state.serverList.forEach((server) => {
        oldServersMap[server.ID] = server;
      });
      let newServers = servers.map((server) => {
        const oldItem = oldServersMap[server.ID];
        const serverItem = { ...server };
        if (oldItem?.PublicNote) {
          serverItem.PublicNote = oldItem.PublicNote;
        }
        return serverItem;
      });
      newServers = newServers.filter((server) => server);
      newServers.sort((a, b) => b.DisplayIndex - a.DisplayIndex);
      state.serverList = newServers;
      state.serverCount = handleServerCount(newServers);
      state.init = true;
    },
    SET_PROFILE(state, profile) {
      state.profile = profile;
    },
    SET_SETTING(state, setting) {
      state.setting = setting;
    },
    SET_THEME_MODE(state, themeMode) {
      state.themeMode = themeMode;
    },
    SET_RESOLVED_THEME(state, resolvedTheme) {
      state.resolvedTheme = resolvedTheme;
    },
    SET_GLOBE_FOCUS(state, focus) {
      state.globeFocus = focus;
    },
    CLEAR_GLOBE_FOCUS(state) {
      state.globeFocus = null;
    },
  },
  actions: {
    initTheme({ commit, dispatch }) {
      const themeMode = loadThemeMode();
      commit('SET_THEME_MODE', themeMode);
      dispatch('syncTheme');

      if (removeThemeListener) {
        removeThemeListener();
      }

      const mediaQuery = getThemeMediaQuery();
      if (!mediaQuery) {
        return;
      }

      const handleThemeChange = () => {
        dispatch('syncTheme');
      };

      if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', handleThemeChange);
        removeThemeListener = () => {
          mediaQuery.removeEventListener('change', handleThemeChange);
        };
        return;
      }

      if (typeof mediaQuery.addListener === 'function') {
        mediaQuery.addListener(handleThemeChange);
        removeThemeListener = () => {
          mediaQuery.removeListener(handleThemeChange);
        };
      }
    },
    setThemeMode({ commit, dispatch }, themeMode) {
      const normalizedMode = normalizeThemeMode(themeMode);
      commit('SET_THEME_MODE', normalizedMode);
      persistThemeMode(normalizedMode);
      dispatch('syncTheme');
    },
    syncTheme({ commit, state }) {
      const resolvedTheme = resolveTheme(state.themeMode);
      commit('SET_RESOLVED_THEME', resolvedTheme);
      applyResolvedTheme(resolvedTheme);
    },
    async initServerInfo({ commit }, params) {
      firstSetServers = true;
      if (config.nazhua.nezhaVersion === 'v1') {
        const { route } = params || {};
        loadNezhaV1ServerGroup().then((res) => {
          if (res) commit('SET_SERVER_GROUP', res);
        });
        loadNezhaV1Setting().then((res) => {
          if (res) {
            commit('SET_SETTING', res);
            // 仅在未通过运行时配置指定标题时，才使用后端的 site_name
            if (!(window.$$aoboboConfig?.title ?? window.$$nazhuaConfig?.title)) {
              config.nazhua.title = res.config?.site_name || res.site_name;
              if (route?.name === 'Home' || !route) {
                document.title = config.nazhua.title;
              }
            }
          }
        });
        loadNezhaV1Profile().then((res) => {
          if (res) commit('SET_PROFILE', res);
        });
        return;
      }
      const serverResult = await loadNezhaV0Config();
      if (!serverResult) {
        console.error('load server config failed');
        return;
      }
      const servers = serverResult.servers?.map?.((i) => ({
        ...i,
        online: isOnline(i.LastActive, serverResult.now),
      })) || [];
      const res = loadNezhaV0ServerGroup(servers);
      if (res) commit('SET_SERVER_GROUP', res);
      firstSetServers = false;
      commit('SET_SERVERS', servers);
    },
    watchWsMsg({ commit }) {
      msg.on('servers', (res) => {
        if (res) {
          if (res.now) commit('SET_SERVER_TIME', res.now);
          const servers = res.servers?.map?.((i) => ({
            ...i,
            online: isOnline(i.LastActive, res.now),
          })) || [];
          if (firstSetServers) {
            firstSetServers = false;
            commit('SET_SERVERS', servers);
            if (config.nazhua.nezhaVersion !== 'v1') {
              const group = loadNezhaV0ServerGroup(servers);
              if (group) commit('SET_SERVER_GROUP', group);
            }
          } else {
            commit('UPDATE_SERVERS', servers);
          }
        }
      });
    },
    focusGlobeOnServer({ commit }, { code, name }) {
      commit('SET_GLOBE_FOCUS', { code, name });
    },
    clearGlobeFocus({ commit }) {
      commit('CLEAR_GLOBE_FOCUS');
    },
  },
});

export default store;
