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
        <button
          type="button"
          class="sidebar-toggle"
          :class="{ active: sidebarOpen }"
          @click="toggleSidebar"
        >
          <i :class="sidebarOpen ? 'ri-layout-right-line' : 'ri-server-line'" />
          <span>{{ sidebarOpen ? '隐藏列表' : '服务器列表' }}</span>
        </button>
        <theme-mode-switch />
        <div class="status-item total">
          <span>总计: {{ serverCount.total }}台</span>
        </div>
      </div>
    </div>

    <div class="main-content" :class="{ 'sidebar-collapsed': !sidebarOpen }">
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

      <div class="server-list-section" :class="{ collapsed: !sidebarOpen }">
        <div class="tech-frame" aria-hidden="true" />
        <div class="section-header">
          <div class="section-title-row">
            <div class="title-block">
              <h2><i class="ri-server-line" /> 服务器列表</h2>
              <span class="section-summary">
                显示 {{ filteredServers.length }} / 总计 {{ serverCount.total }}
              </span>
            </div>
            <button
              type="button"
              class="close-sidebar"
              title="收起"
              @click="toggleSidebar"
            >
              <i class="ri-arrow-right-s-line" />
            </button>
          </div>
          <div class="section-search-row">
            <label class="search-box">
              <i class="ri-search-line" />
              <input
                v-model="searchKeyword"
                type="text"
                placeholder="搜索名称 / 地区 / 系统"
              >
            </label>
            <button
              type="button"
              class="clear-search"
              :disabled="searchKeyword.trim() === ''"
              title="清空搜索"
              @click="clearSearchKeyword"
            >
              <i class="ri-close-line" />
            </button>
          </div>
          <div class="section-filter-row">
            <button
              v-for="option in FILTER_OPTIONS"
              :key="option.value || 'all'"
              type="button"
              :class="['filter-btn', { active: filterOnline === option.value }]"
              @click="filterOnline = option.value"
            >
              <span class="filter-label">{{ option.label }}</span>
              <span class="filter-count">{{ filterStats[option.countKey] }}</span>
            </button>
          </div>
        </div>
        <server-table
          v-if="filteredServers.length > 0"
          :servers="filteredServers"
          @hover-server="handleServerHover"
        />
        <div v-else class="empty-list">
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
import { getSystemOSLabel } from '@/utils/host';
import GlobeEarth from '@/components/globe-earth/globe-earth.vue';
import ServerTable from '@/components/server-panel/server-table.vue';
import ThemeModeSwitch from '@/components/theme-mode-switch.vue';
import IconLoading from '@/components/icons/icon-loading.vue';
import IconInbox from '@/components/icons/icon-inbox.vue';
import IconEarth from '@/components/icons/icon-earth.vue';

const SERVER_HOVER_FOCUS_DELAY = 3000;
const FILTER_OPTIONS = [
  { label: '全部', value: '', countKey: 'total' },
  { label: '在线', value: '1', countKey: 'online' },
  { label: '离线', value: '-1', countKey: 'offline' },
];

const store = useStore();
const filterOnline = ref('');
const searchKeyword = ref('');
const sidebarOpen = ref(true);
const globeRef = ref(null);
let serverHoverTimer = null;

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value;
}

function clearSearchKeyword() {
  searchKeyword.value = '';
}

const serverList = computed(() => store.state.serverList);
const serverCount = computed(() => store.state.serverCount);
const resolvedTheme = computed(() => store.state.resolvedTheme);
const normalizedSearchKeyword = computed(() => searchKeyword.value.trim().toLowerCase());

function getServerSearchText(server) {
  return [
    server?.Name,
    server?.Host?.CountryCode,
    server?.PublicNote?.customData?.location,
    getSystemOSLabel(server?.Host?.Platform),
    server?.Host?.Platform,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

const searchMatchedServers = computed(() => {
  const keyword = normalizedSearchKeyword.value;

  if (!keyword) {
    return serverList.value;
  }

  return serverList.value.filter((server) => getServerSearchText(server).includes(keyword));
});

const filterStats = computed(() => searchMatchedServers.value.reduce((stats, server) => {
  const nextStats = { ...stats };
  nextStats.total += 1;
  if (server.online === 1) {
    nextStats.online += 1;
  } else if (server.online === -1) {
    nextStats.offline += 1;
  }
  return nextStats;
}, {
  total: 0,
  online: 0,
  offline: 0,
}));

const filteredServers = computed(() => {
  let list = searchMatchedServers.value;
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
    0 0 18px rgba(var(--accent-cyan-rgb), 0.08),
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
    height: 32px;
    padding: 0 12px;
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
      box-shadow: var(--status-online-glow);
    }
    &.offline {
      background: var(--accent-danger);
      box-shadow: var(--status-offline-glow);
    }
  }

  .total {
    border-color: var(--border-strong);
    background: var(--status-chip-total-bg);
    font-weight: 600;
    color: var(--text-primary);
  }

  .sidebar-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 12px;
    border-radius: 999px;
    border: 1px solid var(--button-subtle-border);
    background: var(--button-subtle-bg);
    color: var(--text-secondary);
    font-size: 13px;
    cursor: pointer;
    transition: all var(--transition-fast);

    i {
      font-size: 15px;
    }

    &:hover, &.active {
      background: var(--button-active-bg);
      border-color: var(--button-active-border);
      box-shadow: var(--button-active-shadow);
      color: var(--text-on-accent);
    }
  }

}

.main-content {
  min-height: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr);
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
  position: fixed;
  top: 64px;
  right: 16px;
  bottom: 16px;
  width: min(380px, calc(100vw - 32px));
  z-index: 20;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  border-top: 1px solid rgba(var(--accent-cyan-rgb), 0.35);
  background: var(--panel-floating-bg);
  backdrop-filter: blur(16px) saturate(135%);
  box-shadow:
    var(--shadow-lg),
    0 0 32px var(--tech-glow),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition:
    transform var(--transition-normal),
    opacity var(--transition-normal),
    visibility var(--transition-normal);

  &.collapsed {
    transform: translateX(calc(100% + 24px));
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
  }

  .tech-frame {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      linear-gradient(135deg, var(--accent-cyan) 0, transparent 8px) top left / 18px 18px no-repeat,
      linear-gradient(-135deg, var(--accent-cyan) 0, transparent 8px) top right / 18px 18px no-repeat,
      linear-gradient(45deg, var(--accent-cyan) 0, transparent 8px) bottom left / 18px 18px no-repeat,
      linear-gradient(-45deg, var(--accent-cyan) 0, transparent 8px) bottom right / 18px 18px no-repeat;
    filter: drop-shadow(0 0 4px var(--accent-cyan));
    z-index: 4;
  }

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 24px;
    right: 24px;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(var(--accent-cyan-rgb), 0.55), transparent);
    filter: drop-shadow(0 0 3px var(--accent-cyan));
    z-index: 3;
    pointer-events: none;
  }

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image:
      linear-gradient(var(--tech-grid-color) 1px, transparent 1px),
      linear-gradient(90deg, var(--tech-grid-color) 1px, transparent 1px);
    background-size: 32px 32px;
    mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.35), transparent 60%);
    -webkit-mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.35), transparent 60%);
    opacity: 0.4;
    z-index: 0;
  }

  > * {
    position: relative;
    z-index: 2;
  }

  .section-header {
    display: grid;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color);
    background: var(--section-header-bg);
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.02);
    z-index: 5;
  }

  .section-title-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .title-block {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;

    h2 {
      font-family: var(--font-mono);
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      display: flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
      margin-right: auto;
      color: var(--accent-cyan);
      text-shadow: 0 0 12px rgba(var(--accent-cyan-rgb), 0.35);

      i {
        color: var(--accent-cyan);
        text-shadow: 0 0 8px currentColor;
      }
    }
  }

  .section-summary {
    display: inline-flex;
    align-items: center;
    min-height: 28px;
    padding: 0 12px;
    border-radius: 999px;
    border: 1px solid var(--panel-chip-border);
    background: var(--panel-chip-bg);
    color: var(--panel-chip-text);
    font-size: 12px;
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
  }

  .section-search-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .search-box {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 36px;
    padding: 0 12px;
    border-radius: 14px;
    border: 1px solid var(--panel-search-border);
    background: var(--panel-search-bg);
    color: var(--panel-search-icon);
    transition:
      border-color var(--transition-fast),
      background var(--transition-fast),
      box-shadow var(--transition-fast);

    &:focus-within {
      border-color: var(--accent-cyan);
      background: var(--panel-search-focus-bg);
      box-shadow:
        0 0 0 3px rgba(var(--accent-cyan-rgb), 0.18),
        0 0 18px rgba(var(--accent-cyan-rgb), 0.12);
    }

    i {
      font-size: 16px;
      flex: 0 0 auto;
    }

    input {
      width: 100%;
      min-width: 0;
      border: none;
      background: transparent;
      color: var(--text-primary);
      font-size: 13px;
      outline: none;

      &::placeholder {
        color: var(--panel-search-placeholder);
      }
    }
  }

  .clear-search,
  .close-sidebar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border-radius: 12px;
    border: 1px solid var(--button-subtle-border);
    background: var(--button-subtle-bg);
    color: var(--text-secondary);
    font-size: 16px;
    cursor: pointer;
    transition: all var(--transition-fast);
    flex: 0 0 auto;

    &:hover:not(:disabled) {
      background: var(--button-active-bg);
      border-color: var(--button-active-border);
      color: var(--text-on-accent);
    }

    &:disabled {
      cursor: default;
      color: var(--panel-search-disabled);
      border-color: var(--panel-search-disabled-border);
      background: var(--panel-search-disabled-bg);
    }
  }

  .section-filter-row {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .filter-btn {
    min-width: 0;
    height: 32px;
    padding: 0 10px;
    border-radius: 14px;
    border: 1px solid var(--button-subtle-border);
    background: var(--button-subtle-bg);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;

    &:hover,
    &.active {
      background: var(--button-active-bg);
      border-color: var(--button-active-border);
      box-shadow: var(--button-active-shadow);
      color: var(--text-on-accent);
    }

    &.active .filter-count {
      background: rgba(var(--accent-cyan-rgb), 0.22);
      box-shadow: 0 0 12px rgba(var(--accent-cyan-rgb), 0.45);
    }

    .filter-label {
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
    }

    .filter-count {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 28px;
      height: 22px;
      padding: 0 6px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.16);
      font-size: 11px;
      font-family: var(--font-mono);
      font-variant-numeric: tabular-nums;
    }
  }
}

:deep(.server-table-wrap) {
  flex: 1;
  min-height: 0;
}

:deep(.server-row) {
  position: relative;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 14px;
    bottom: 14px;
    width: 4px;
    border-radius: 0 999px 999px 0;
    background: rgba(var(--accent-cyan-rgb), 0.55);
    box-shadow: 0 0 14px rgba(var(--accent-cyan-rgb), 0.5);
    pointer-events: none;
  }

  &.offline::before {
    background: rgba(var(--accent-danger-rgb), 0.45);
    box-shadow: 0 0 12px rgba(var(--accent-danger-rgb), 0.35);
  }
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
  text-shadow: 0 0 24px rgba(var(--accent-primary-rgb), 0.12);

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
  flex: 1;
  min-height: 0;
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
  .server-list-section {
    width: 380px;
  }
}

@media screen and (max-width: 1279px) {
  .main-content {
    grid-template-rows: minmax(0, 1fr) minmax(320px, 42vh);

    &.sidebar-collapsed {
      grid-template-rows: minmax(0, 1fr);
    }
  }

  .globe-section {
    min-height: 300px;
  }

  .server-list-section {
    position: relative;
    inset: auto;
    width: auto;
    border-radius: 0;
    border: none;
    border-top: 1px solid var(--border-color);
    background: var(--section-bg);
    backdrop-filter: none;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
    transform: none;
    opacity: 1;
    visibility: visible;

    &.collapsed {
      display: none;
    }
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

    .sidebar-toggle span {
      display: none;
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

    .title-block {
      gap: 8px;
    }

    .section-summary {
      min-height: 26px;
      padding: 0 10px;
    }

    .section-filter-row {
      gap: 6px;
    }

    .filter-btn {
      padding: 8px;
    }
  }
}

@media screen and (max-width: 420px) {
  .server-list-section {
    .section-title-row,
    .section-search-row {
      align-items: stretch;
    }

    .section-summary {
      width: 100%;
      justify-content: center;
    }

    .section-filter-row {
      grid-template-columns: 1fr;
    }
  }
}
</style>
