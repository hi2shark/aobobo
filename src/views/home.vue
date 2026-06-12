<template>
  <div class="home-view">
    <div class="status-bar">
      <div class="status-group">
        <div class="status-item">
          <span class="status-dot online" />
          <span>在线: {{ serverCount.online }}</span>
        </div>
        <div class="status-item">
          <span class="status-dot offline" />
          <span>离线: {{ serverCount.offline }}</span>
        </div>
      </div>

      <div class="status-actions">
        <theme-mode-switch />
        <div class="status-item total">
          <span>总计: {{ serverCount.total }}台</span>
        </div>
      </div>
    </div>

    <div class="main-content">
      <div class="globe-section">
        <div v-if="!store.state.init" class="empty-state">
          <icon-loading class="spin empty-icon" />
          <span>正在连接哪吒探针...</span>
        </div>
        <div v-else-if="serverList.length === 0" class="empty-state">
          <icon-earth class="empty-icon" />
          <span>暂无服务器数据</span>
        </div>
        <globe-earth
          v-else
          ref="globeRef"
          :locations="serverLocations"
          :theme="resolvedTheme"
        />
      </div>

      <div class="server-list-section">
        <div class="section-header">
          <h2><i class="ri-server-line" /> 服务器列表</h2>
          <div class="filter-bar">
            <button
              type="button"
              :class="['filter-btn', { active: filterOnline === '' }]"
              @click="filterOnline = ''"
            >
              全部
            </button>
            <button
              type="button"
              :class="['filter-btn', { active: filterOnline === '1' }]"
              @click="filterOnline = '1'"
            >
              在线
            </button>
            <button
              type="button"
              :class="['filter-btn', { active: filterOnline === '-1' }]"
              @click="filterOnline = '-1'"
            >
              离线
            </button>
          </div>
        </div>
        <server-table :servers="filteredServers" @hover-server="handleServerHover" />
        <div v-if="filteredServers.length === 0" class="empty-list">
          <icon-inbox class="empty-icon" />
          <span>没有符合条件的服务器</span>
        </div>
      </div>
    </div>

    <footer class="home-footer">
      <p>Powered by 哪吒监控 · Theme By AoBoBo 3D Globe</p>
    </footer>
  </div>
</template>

<script setup>
import {
  ref,
  computed,
  onUnmounted,
} from 'vue';
import { useStore } from 'vuex';
import { alias2code, locationCode2Info, clusterLocations } from '@/utils/world-map';
import GlobeEarth from '@/components/globe-earth/globe-earth.vue';
import ServerTable from '@/components/server-panel/server-table.vue';
import ThemeModeSwitch from '@/components/theme-mode-switch.vue';
import IconLoading from '@/components/icons/icon-loading.vue';
import IconInbox from '@/components/icons/icon-inbox.vue';
import IconEarth from '@/components/icons/icon-earth.vue';

const SERVER_HOVER_FOCUS_DELAY = 3000;

const store = useStore();
const filterOnline = ref('');
const globeRef = ref(null);
let serverHoverTimer = null;

const serverList = computed(() => store.state.serverList);
const serverCount = computed(() => store.state.serverCount);
const resolvedTheme = computed(() => store.state.resolvedTheme);

const filteredServers = computed(() => {
  let list = serverList.value;
  if (filterOnline.value !== '') {
    list = list.filter((s) => String(s.online) === filterOnline.value);
  }
  return list;
});

const serverLocations = computed(() => {
  const locationMap = {};
  serverList.value.forEach((server) => {
    let aliasCode;
    let locationCode;
    if (server?.PublicNote?.customData?.location) {
      aliasCode = server.PublicNote.customData.location;
      locationCode = server.PublicNote.customData.location;
    } else if (server?.Host?.CountryCode) {
      aliasCode = server.Host.CountryCode.toUpperCase();
    }
    const code = alias2code(aliasCode) || locationCode;
    if (!code) return;
    if (!locationMap[code]) {
      locationMap[code] = [];
    }
    locationMap[code].push(server);
  });

  const locations = [];
  Object.entries(locationMap).forEach(([code, servers]) => {
    const info = locationCode2Info(code);
    if (info && Number.isFinite(info.lat) && Number.isFinite(info.lng)) {
      const onlineServers = servers.filter((s) => s.online === 1);
      locations.push({
        key: code,
        lat: info.lat,
        lng: info.lng,
        code,
        label: `${info.name}, ${info.country}`,
        servers,
        hasOnline: onlineServers.length > 0,
      });
    }
  });
  return clusterLocations(locations);
});

function clearServerHoverTimer() {
  if (serverHoverTimer) {
    window.clearTimeout(serverHoverTimer);
    serverHoverTimer = null;
  }
}

function handleServerHover(server) {
  clearServerHoverTimer();

  if (!server || !globeRef.value) {
    return;
  }

  serverHoverTimer = window.setTimeout(() => {
    serverHoverTimer = null;

    const aliasCode = server?.PublicNote?.customData?.location
      || server?.Host?.CountryCode?.toUpperCase();
    const code = alias2code(aliasCode) || aliasCode;
    if (!code) {
      return;
    }

    const location = serverLocations.value.find((loc) => loc.codes?.includes(code));
    if (location) {
      globeRef.value.focusLocation(location);
    }
  }, SERVER_HOVER_FOCUS_DELAY);
}

onUnmounted(() => {
  clearServerHoverTimer();
});
</script>

<style lang="scss" scoped>
.home-view {
  position: relative;
  width: 100%;
  height: 100vh;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
  background: var(--page-bg);
}

.home-view::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--page-overlay);
  pointer-events: none;
}

.status-bar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  padding: 10px 20px;
  background: var(--status-bar-bg);
  backdrop-filter: blur(16px) saturate(135%);
  border-bottom: 1px solid var(--border-color);
  box-shadow:
    var(--shadow-sm),
    inset 0 -1px 0 rgba(255, 255, 255, 0.03);
  z-index: 10;

  .status-group,
  .status-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .status-actions {
    margin-left: auto;
    justify-content: flex-end;
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: 1px solid var(--status-chip-border);
    border-radius: 999px;
    background: var(--status-chip-bg);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
    font-size: 13px;
    color: var(--text-secondary);

    span:last-child {
      font-family: var(--font-mono);
      font-variant-numeric: tabular-nums;
    }
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;

    &.online {
      background: var(--accent-success);
      box-shadow: 0 0 10px rgba(33, 208, 122, 0.7);
    }
    &.offline {
      background: var(--accent-danger);
      box-shadow: 0 0 8px rgba(255, 107, 122, 0.45);
    }
  }

  .total {
    border-color: var(--border-strong);
    background: var(--status-chip-total-bg);
    font-weight: 600;
    color: var(--text-primary);
  }
}

.main-content {
  min-height: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr) minmax(260px, 40vh);
  position: relative;
  overflow: hidden;
}

.globe-section {
  min-height: 0;
  position: relative;
  overflow: hidden;
  background: var(--globe-stage-bg);
}

.globe-section::after {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--globe-stage-vignette);
  pointer-events: none;
}

.server-list-section {
  min-height: 0;
  background: var(--section-bg);
  border-top: 1px solid var(--border-color);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    padding: 12px 20px;
    border-bottom: 1px solid var(--border-color);
    background: var(--section-header-bg);
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.02);
    z-index: 5;

    h2 {
      font-size: 15px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;

      i {
        color: var(--accent-cyan);
      }
    }
  }

  .filter-bar {
    display: flex;
    gap: 4px;

    .filter-btn {
      min-width: 48px;
      padding: 5px 12px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--button-subtle-border);
      background: var(--button-subtle-bg);
      color: var(--text-secondary);
      font-size: 12px;
      cursor: pointer;
      transition: all var(--transition-fast);

      &:hover, &.active {
        background: linear-gradient(180deg, rgba(91, 140, 255, 0.96), rgba(63, 114, 255, 0.9));
        border-color: rgba(255, 255, 255, 0.12);
        box-shadow: 0 10px 22px rgba(63, 114, 255, 0.2);
        color: #fff;
      }
    }
  }
}

:deep(.server-table-wrap) {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.home-footer {
  padding: 8px 20px;
  text-align: center;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-muted);
  background: var(--footer-bg);
  border-top: 1px solid var(--border-color);
}

.empty-state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-secondary);
  font-size: 14px;
  text-shadow: 0 0 24px rgba(91, 140, 255, 0.1);

  .empty-icon {
    width: 40px;
    height: 40px;
    color: var(--empty-icon-color);
  }

  .spin {
    animation: spin 1s linear infinite;
  }
}

.empty-list {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 20px;
  color: var(--text-muted);
  font-size: 13px;

  .empty-icon {
    width: 32px;
    height: 32px;
    color: var(--empty-icon-color-soft);
  }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media screen and (min-width: 1280px) {
  .main-content {
    grid-template-columns: minmax(0, 3fr) minmax(420px, 2fr);
    grid-template-rows: minmax(0, 1fr);
  }

  .globe-section {
    min-width: 0;
  }

  .server-list-section {
    min-width: 0;
    border-left: 1px solid var(--border-color);
    border-top: none;
  }
}

@media screen and (max-width: 1279px) and (min-width: 769px) {
  .main-content {
    grid-template-rows: minmax(0, 1fr) minmax(320px, 42vh);
  }

  .globe-section {
    min-height: 300px;
  }
}

@media screen and (max-width: 768px) {
  .status-bar {
    padding: 8px 12px;
    gap: 12px;
    font-size: 12px;

    .status-actions {
      width: 100%;
      margin-left: 0;
      justify-content: space-between;
    }
  }

  .main-content {
    grid-template-rows: minmax(220px, 35vh) minmax(0, 1fr);
  }

  .globe-section {
    min-height: 220px;
  }

  .server-list-section {
    .section-header {
      padding: 10px 12px;
    }
  }
}
</style>
