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
        <div class="action-cluster">
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
        </div>
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
      <button
        type="button"
        class="mobile-drawer-backdrop"
        :class="{ visible: sidebarOpen }"
        aria-label="关闭服务器列表抽屉"
        @click="toggleSidebar"
      />

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
const sidebarOpen = ref(typeof window === 'undefined' ? true : window.innerWidth > 768);
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
  gap: 12px;
  padding: 14px 16px 12px;
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
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 14px 18px;
  padding: 12px 18px;
  position: relative;
  overflow: hidden;
  background: var(--status-bar-bg);
  backdrop-filter: blur(18px) saturate(150%);
  border: 1px solid var(--border-color);
  border-radius: calc(var(--radius-lg) + 2px);
  box-shadow:
    var(--shadow-sm),
    inset 0 1px 0 var(--surface-highlight);
  z-index: 10;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.08), transparent 40%),
      radial-gradient(circle at 15% 0%, rgba(var(--accent-cyan-rgb), 0.08), transparent 30%);
    pointer-events: none;
  }

  .status-group,
  .status-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    position: relative;
    z-index: 1;
  }

  .status-actions {
    margin-left: auto;
    justify-content: flex-end;
  }

  .action-cluster {
    display: inline-flex;
    align-items: center;
    gap: 10px;
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
    padding: 0 14px;
    border: 1px solid var(--status-chip-border);
    border-radius: 999px;
    background: var(--status-chip-bg);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      0 8px 16px rgba(15, 23, 42, 0.04);
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);

    span:last-child {
      font-family: var(--font-mono);
      font-variant-numeric: tabular-nums;
    }
  }

  .status-dot {
    width: 9px;
    height: 9px;
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
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.1),
      0 12px 22px rgba(var(--accent-cyan-rgb), 0.12);
    font-weight: 600;
    color: var(--text-primary);
  }

  .sidebar-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
    padding: 0 14px;
    border-radius: 999px;
    border: 1px solid var(--button-subtle-border);
    background: var(--button-subtle-bg);
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition:
      color var(--transition-fast),
      background var(--transition-fast),
      border-color var(--transition-fast),
      box-shadow var(--transition-fast),
      transform var(--transition-fast);

    i {
      font-size: 15px;
    }

    &:hover,
    &.active {
      background: var(--button-active-bg);
      border-color: var(--button-active-border);
      box-shadow: var(--button-active-shadow);
      color: var(--text-on-accent);
      transform: translateY(-1px);
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
  border-radius: var(--radius-xl);
  border: 1px solid var(--globe-stage-border);
  background: var(--globe-stage-bg);
  box-shadow: var(--globe-stage-shadow);
}

.globe-section::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 50% 12%, rgba(var(--accent-cyan-rgb), 0.12), transparent 30%),
    radial-gradient(circle at 50% 68%, rgba(var(--accent-cyan-rgb), 0.08), transparent 34%);
  pointer-events: none;
}

.globe-section::after {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--globe-stage-vignette);
  pointer-events: none;
}

.mobile-drawer-backdrop {
  display: none;
}

.server-list-section {
  position: fixed;
  top: 96px;
  right: 16px;
  bottom: 88px;
  width: clamp(380px, 26vw, 460px);
  z-index: 20;
  border-radius: 28px;
  border: 1px solid var(--border-color);
  background: var(--panel-floating-bg);
  backdrop-filter: blur(22px) saturate(160%);
  box-shadow:
    var(--shadow-lg),
    inset 0 1px 0 var(--surface-highlight);
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
    display: none;
  }

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.08), transparent 14%),
      radial-gradient(circle at top center, rgba(var(--accent-cyan-rgb), 0.08), transparent 36%);
    z-index: 3;
    pointer-events: none;
  }

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(180deg, transparent 0%, rgba(255, 255, 255, 0.02) 100%);
    opacity: 0.8;
    z-index: 0;
  }

  > * {
    position: relative;
    z-index: 2;
  }

  .section-header {
    display: grid;
    gap: 12px;
    padding: 16px 16px 14px;
    border-bottom: 1px solid var(--border-color);
    background: var(--section-header-bg);
    box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.03);
    z-index: 5;
  }

  .section-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .title-block {
    min-width: 0;
    flex: 1;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;

    h2 {
      font-family: var(--font-sans);
      font-size: 17px;
      font-weight: 700;
      letter-spacing: -0.01em;
      display: flex;
      align-items: center;
      gap: 7px;
      min-width: 0;
      margin-right: 0;
      color: var(--text-primary);
      overflow: hidden;
      text-overflow: ellipsis;

      i {
        color: var(--accent-primary);
      }
    }
  }

  .section-summary {
    display: inline-flex;
    align-items: center;
    min-height: 30px;
    padding: 0 11px;
    border-radius: 999px;
    border: 1px solid var(--panel-chip-border);
    background: var(--panel-chip-bg);
    color: var(--panel-chip-text);
    font-size: 11px;
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
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
    height: 40px;
    padding: 0 13px;
    border-radius: 15px;
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
        0 0 0 4px rgba(var(--accent-cyan-rgb), 0.12),
        0 14px 28px rgba(var(--accent-cyan-rgb), 0.1);
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
      font-weight: 500;
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
    width: 34px;
    height: 34px;
    padding: 0;
    border-radius: 12px;
    border: 1px solid var(--button-subtle-border);
    background: var(--button-subtle-bg);
    color: var(--text-secondary);
    font-size: 15px;
    cursor: pointer;
    transition:
      color var(--transition-fast),
      background var(--transition-fast),
      border-color var(--transition-fast),
      box-shadow var(--transition-fast),
      transform var(--transition-fast);
    flex: 0 0 auto;

    &:hover:not(:disabled) {
      background: var(--button-active-bg);
      border-color: var(--button-active-border);
      box-shadow: var(--button-active-shadow);
      color: var(--text-on-accent);
      transform: translateY(-1px);
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
    gap: 6px;
  }

  .filter-btn {
    min-width: 0;
    min-height: 38px;
    padding: 0 11px;
    border-radius: 15px;
    border: 1px solid var(--button-subtle-border);
    background: var(--button-subtle-bg);
    color: var(--text-secondary);
    cursor: pointer;
    transition:
      color var(--transition-fast),
      background var(--transition-fast),
      border-color var(--transition-fast),
      box-shadow var(--transition-fast),
      transform var(--transition-fast);
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
      transform: translateY(-1px);
    }

    &.active .filter-count {
      background: rgba(255, 255, 255, 0.18);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14);
    }

    .filter-label {
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
    }

    .filter-count {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 26px;
      height: 22px;
      padding: 0 6px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.12);
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
  &::before {
    display: none;
  }
}

.home-footer {
  min-height: 50px;
  padding: 0 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--text-secondary);
  background: var(--footer-bg);
  border: 1px solid var(--border-color);
  border-radius: 18px;
  backdrop-filter: blur(18px) saturate(145%);
  box-shadow:
    var(--shadow-sm),
    inset 0 1px 0 var(--surface-highlight);
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
  text-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);

  .empty-icon {
    width: 42px;
    height: 42px;
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
    width: 34px;
    height: 34px;
    color: var(--empty-icon-color-soft);
  }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media screen and (min-width: 1280px) {
  .server-list-section {
    width: clamp(380px, 26vw, 460px);
  }
}

@media screen and (max-width: 1279px) {
  .main-content {
    grid-template-rows: minmax(0, 1fr) minmax(320px, 42vh);
    gap: 12px;

    &.sidebar-collapsed {
      grid-template-rows: minmax(0, 1fr);
    }
  }

  .globe-section {
    min-height: 320px;
  }

  .server-list-section {
    position: relative;
    inset: auto;
    width: auto;
    border-radius: 28px;
    border: 1px solid var(--border-color);
    background: var(--section-bg);
    backdrop-filter: blur(18px) saturate(150%);
    box-shadow:
      var(--shadow-md),
      inset 0 1px 0 var(--surface-highlight);
    transform: none;
    opacity: 1;
    visibility: visible;

    &.collapsed {
      display: none;
    }
  }
}

@media screen and (max-width: 768px) {
  .home-view {
    gap: 10px;
    padding: 10px;
  }

  .status-bar {
    padding: 8px 10px;
    gap: 8px 10px;
    font-size: 12px;
    border-radius: 20px;
    flex-wrap: nowrap;
    align-items: center;

    .status-group {
      width: auto;
      min-width: 0;
      flex: 1 1 auto;
      gap: 6px;
      flex-wrap: nowrap;
      justify-content: flex-start;
    }

    .status-actions {
      width: auto;
      min-width: 0;
      margin-left: auto;
      justify-content: flex-end;
      gap: 8px;
      flex-wrap: nowrap;
      align-items: center;
      flex: 0 0 auto;
    }

    .action-cluster {
      gap: 6px;
      min-width: max-content;
      flex: 0 0 auto;
    }

    .status-item {
      min-height: 30px;
      padding: 0 10px;
      font-size: 11px;
      flex: 0 1 auto;
    }

    .status-item.total {
      min-width: max-content;
      min-height: 32px;
      padding: 0 12px;
      margin-left: auto;
      border-color: var(--border-strong);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.12),
        0 10px 20px rgba(var(--accent-cyan-rgb), 0.1);
    }

    .sidebar-toggle {
      width: 32px;
      min-width: 32px;
      min-height: 32px;
      padding: 0;
      justify-content: center;
      border-radius: 50%;

      i {
        font-size: 14px;
      }
    }

    .sidebar-toggle span {
      display: none;
    }
  }

  .main-content {
    grid-template-rows: minmax(0, 1fr);
    gap: 0;
  }

  .globe-section {
    min-height: 0;
    border-radius: 24px;
  }

  .mobile-drawer-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 24;
    border: none;
    padding: 0;
    background:
      linear-gradient(180deg, rgba(4, 10, 18, 0.12), rgba(4, 10, 18, 0.42));
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition:
      opacity var(--transition-normal),
      visibility var(--transition-normal);

    &.visible {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
    }
  }

  .server-list-section {
    position: fixed;
    inset: auto 10px 10px 10px;
    width: auto;
    max-height: min(68vh, 620px);
    z-index: 30;
    border-radius: 28px;
    border: 1px solid var(--border-color);
    background: var(--panel-floating-bg);
    backdrop-filter: blur(22px) saturate(160%);
    box-shadow:
      var(--shadow-lg),
      inset 0 1px 0 var(--surface-highlight);
    display: flex;
    transform: translateY(0);
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
    transition:
      transform var(--transition-normal),
      opacity var(--transition-normal),
      visibility var(--transition-normal);

    &.collapsed {
      display: flex;
      transform: translateY(calc(100% + 20px));
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }

    .section-header {
      padding: 14px;
    }

    .title-block {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .section-summary {
      min-height: 30px;
      padding: 0 10px;
    }

    .section-filter-row {
      gap: 6px;
    }

    .filter-btn {
      padding: 0 10px;
    }
  }
}

@media screen and (max-width: 420px) {
  .status-bar {
    padding: 8px;
    gap: 8px;
    flex-wrap: wrap;
    align-items: stretch;

    .status-group {
      width: 100%;
      flex: 1 1 100%;
      flex-wrap: wrap;
    }

    .status-actions {
      width: 100%;
      margin-left: 0;
      justify-content: space-between;
      gap: 8px;
      flex: 1 1 100%;
    }

    .action-cluster {
      gap: 6px;
      flex: 1 1 auto;
    }

    .status-item {
      min-height: 30px;
      padding: 0 10px;
    }

    .status-item.total,
    .sidebar-toggle {
      min-height: 32px;
    }

    .sidebar-toggle {
      width: 32px;
      min-width: 32px;
    }
  }

  .server-list-section {
    inset: auto 8px 8px 8px;
    max-height: min(72vh, 640px);

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
