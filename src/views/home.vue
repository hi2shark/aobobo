<template>
  <div class="home-view">
    <div class="status-bar">
      <div class="status-group">
        <div class="status-summary" aria-label="服务器统计">
          <span class="status-summary__total">
            <strong>{{ serverCount.total }}</strong>台
          </span>
          <template v-if="serverCount.offline > 0">
            <span class="status-summary__sep" aria-hidden="true">·</span>
            <span class="status-summary__item">
              <span class="status-dot offline" />
              {{ serverCount.offline }} 离线
            </span>
          </template>
        </div>
      </div>

      <div class="status-actions">
        <theme-mode-switch />
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

      <button
        v-if="!sidebarOpen && !isWideScreen"
        type="button"
        class="sidebar-expand-handle"
        aria-label="展开服务器列表"
        title="展开服务器列表"
        @click="toggleSidebar"
      >
        <i class="ri-server-line" />
      </button>

      <div class="server-list-section" :class="{ collapsed: !sidebarOpen }">
        <div class="tech-frame" aria-hidden="true" />
        <div class="section-header">
          <div class="section-title-row">
            <div class="title-block">
              <h2><i class="ri-server-line" /> 服务器列表</h2>
              <span v-if="listResultHint" class="section-summary">
                {{ listResultHint }}
              </span>
            </div>
            <button
              v-if="!isWideScreen"
              type="button"
              class="close-sidebar"
              title="收起"
              @click="toggleSidebar"
            >
              <i class="ri-arrow-right-s-line" />
            </button>
          </div>
          <div class="section-toolbar">
            <div class="search-filter-bar">
              <label class="search-box">
                <i class="ri-search-line" />
                <input
                  v-model="searchKeyword"
                  type="text"
                  placeholder="搜索名称 / 地区 / 系统"
                >
                <button
                  v-if="searchKeyword.trim() !== ''"
                  type="button"
                  class="clear-search"
                  title="清空搜索"
                  @click="clearSearchKeyword"
                >
                  <i class="ri-close-line" />
                </button>
              </label>
              <div class="filter-group" role="group" aria-label="筛选状态">
                <button
                  v-for="option in FILTER_OPTIONS"
                  :key="option.value || 'all'"
                  type="button"
                  :class="['filter-btn', { active: filterOnline === option.value }]"
                  @click="filterOnline = option.value"
                >
                  <span
                    v-if="option.dot"
                    :class="['status-dot', option.dot]"
                  />
                  <span class="filter-label">{{ option.label }}</span>
                </button>
              </div>
            </div>
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
      <p>Powered by 哪吒监控 · Theme By AoBoBo</p>
    </footer>
  </div>
</template>

<script setup>
import {
  ref,
  computed,
  onMounted,
  onUnmounted,
  watch,
  nextTick,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';
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
  { label: '全部', value: '' },
  { label: '在线', value: '1', dot: 'online' },
  { label: '离线', value: '-1', dot: 'offline' },
];

const route = useRoute();
const router = useRouter();
const store = useStore();
const WIDE_BREAKPOINT = 1280;

const filterOnline = ref('');
const searchKeyword = ref('');
const sidebarOpen = ref(typeof window === 'undefined' ? true : window.innerWidth > 768);
const isWideScreen = ref(false);
const globeRef = ref(null);
let serverHoverTimer = null;

function updateWideScreen() {
  isWideScreen.value = window.innerWidth >= WIDE_BREAKPOINT;
  if (isWideScreen.value) {
    sidebarOpen.value = true;
  }
}

function toggleSidebar() {
  if (isWideScreen.value) {
    return;
  }
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

const isListFiltered = computed(() => (
  normalizedSearchKeyword.value !== '' || filterOnline.value !== ''
));

const filteredServers = computed(() => {
  let list = searchMatchedServers.value;
  if (filterOnline.value !== '') {
    list = list.filter((s) => String(s.online) === filterOnline.value);
  }
  return list;
});

const listResultHint = computed(() => {
  if (!isListFiltered.value) {
    return '';
  }
  return `${filteredServers.value.length} 条匹配`;
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

function focusLocationFromQuery(focusCode) {
  if (!focusCode || !globeRef.value || serverLocations.value.length === 0) {
    return false;
  }

  const location = serverLocations.value.find(
    (loc) => loc.codes?.includes(focusCode) || loc.code === focusCode,
  );
  if (!location) {
    return false;
  }

  globeRef.value.focusLocation(location);

  if (route.query.focus) {
    const { focus, ...rest } = route.query;
    router.replace({ query: rest });
  }

  return true;
}

function tryFocusFromQuery() {
  const focusCode = route.query.focus;
  if (!focusCode || !store.state.init || serverList.value.length === 0) {
    return;
  }

  nextTick(() => {
    if (!focusLocationFromQuery(String(focusCode))) {
      window.setTimeout(() => {
        focusLocationFromQuery(String(focusCode));
      }, 500);
    }
  });
}

watch(
  () => [route.query.focus, store.state.init, serverLocations.value.length],
  () => {
    tryFocusFromQuery();
  },
);

onMounted(() => {
  updateWideScreen();
  window.addEventListener('resize', updateWideScreen);
  tryFocusFromQuery();
});

onUnmounted(() => {
  window.removeEventListener('resize', updateWideScreen);
  clearServerHoverTimer();
});
</script>

<style lang="scss" scoped>
.home-view {
  position: relative;
  width: 100%;
  height: 100vh;
  height: 100dvh;
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

  .status-summary {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-height: 40px;
    padding: 0 16px;
    border: 1px solid var(--status-chip-border);
    border-radius: 999px;
    background: var(--status-chip-bg);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      0 8px 16px rgba(15, 23, 42, 0.04);
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    white-space: nowrap;
  }

  .status-summary__total {
    color: var(--text-primary);
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;

    strong {
      font-weight: 700;
    }
  }

  .status-summary__item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
  }

  .status-summary__sep {
    color: var(--text-muted);
    font-size: 12px;
    line-height: 1;
    user-select: none;
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
}

.main-content {
  min-height: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr);
  position: relative;
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

.sidebar-expand-handle {
  position: absolute;
  top: 50%;
  right: 0;
  z-index: 15;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 72px;
  padding: 0;
  border: 1px solid var(--border-color);
  border-right: none;
  border-radius: 14px 0 0 14px;
  background: var(--section-bg);
  color: var(--text-secondary);
  cursor: pointer;
  transform: translateY(-50%);
  box-shadow: var(--shadow-sm);
  transition:
    color var(--transition-fast),
    background var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);

  i {
    font-size: 18px;
  }

  &:hover {
    color: var(--text-on-accent);
    background: var(--button-active-bg);
    border-color: var(--button-active-border);
    box-shadow: var(--button-active-shadow);
  }
}

.server-list-section {
  min-height: 0;
  min-width: 0;
  border-radius: var(--radius-xl);
  border: 1px solid var(--border-color);
  background: var(--section-bg);
  backdrop-filter: blur(18px) saturate(150%);
  box-shadow:
    var(--shadow-sm),
    inset 0 1px 0 var(--surface-highlight);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition:
    opacity var(--transition-normal),
    visibility var(--transition-normal);

  .tech-frame {
    display: none;
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

  .section-toolbar {
    min-width: 0;
  }

  .search-filter-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 40px;
    padding: 0 4px 0 0;
    border: 1px solid var(--panel-search-border);
    border-radius: 15px;
    background: var(--panel-search-bg);
    overflow: hidden;
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
  }

  .search-box {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    height: auto;
    min-height: 38px;
    padding: 0 10px 0 13px;
    border: none;
    border-radius: 0;
    background: transparent;
    color: var(--panel-search-icon);

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

  .filter-group {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    margin: 4px 4px 4px 0;
    padding: 3px;
    border: 1px solid var(--button-subtle-border);
    border-radius: 999px;
    background: var(--button-subtle-bg);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      0 4px 10px rgba(15, 23, 42, 0.03);
    flex: 0 0 auto;
  }

  .clear-search,
  .close-sidebar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border-radius: 8px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-secondary);
    font-size: 14px;
    cursor: pointer;
    transition:
      color var(--transition-fast),
      background var(--transition-fast),
      border-color var(--transition-fast),
      box-shadow var(--transition-fast),
      transform var(--transition-fast);
    flex: 0 0 auto;

    &:hover:not(:disabled) {
      background: var(--button-subtle-bg);
      border-color: var(--button-subtle-border);
      color: var(--text-primary);
    }

    &:disabled {
      cursor: default;
      color: var(--panel-search-disabled);
      opacity: 0.45;
    }
  }

  .close-sidebar {
    width: 34px;
    height: 34px;
    border-radius: 12px;
    border: 1px solid var(--button-subtle-border);
    background: var(--button-subtle-bg);
    font-size: 15px;

    &:hover:not(:disabled) {
      background: var(--button-active-bg);
      border-color: var(--button-active-border);
      box-shadow: var(--button-active-shadow);
      color: var(--text-on-accent);
      transform: translateY(-1px);
    }
  }

  .filter-btn {
    min-width: 0;
    min-height: 28px;
    padding: 0 10px;
    border-radius: 999px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    transition:
      color var(--transition-fast),
      background var(--transition-fast),
      border-color var(--transition-fast),
      box-shadow var(--transition-fast);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;

    &:hover:not(.active) {
      color: var(--text-primary);
      background: var(--bg-hover);
    }

    &.active {
      background: var(--button-active-bg);
      border-color: var(--button-active-border);
      box-shadow: var(--button-active-shadow);
      color: var(--text-on-accent);
    }

    &.active .status-dot {
      box-shadow: none;
    }

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex: 0 0 auto;

      &.online {
        background: var(--accent-success);
        box-shadow: var(--status-online-glow);
      }

      &.offline {
        background: var(--accent-danger);
        box-shadow: var(--status-offline-glow);
      }
    }

    .filter-label {
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
    }
  }
}

:deep(.server-table-wrap) {
  flex: 1;
  min-height: 0;
}

.home-footer {
  min-height: 50px;
  margin: 0 0 14px;
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
  .main-content {
    grid-template-columns: minmax(0, 1fr) clamp(380px, 28vw, 440px);
    gap: 12px;
    transition: grid-template-columns var(--transition-normal);

    &.sidebar-collapsed {
      grid-template-columns: minmax(0, 1fr) 0;
    }
  }

  .server-list-section.collapsed {
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    overflow: hidden;
    border: none;
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

    .status-summary {
      min-height: 32px;
      padding: 0 12px;
      gap: 8px;
      font-size: 12px;
    }

    .status-summary__sep {
      font-size: 11px;
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

  .home-footer {
    margin-bottom: 12px;
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

    .search-filter-bar {
      min-height: 36px;
      padding: 0 3px 0 0;
    }

    .filter-group {
      margin: 3px 3px 3px 0;
      padding: 2px;
    }

    .filter-btn {
      padding: 0 8px;
      min-height: 26px;
    }
  }
}

@media screen and (max-width: 420px) {
  .status-bar {
    padding: 8px 10px;
    gap: 8px;
    flex-wrap: nowrap;
    align-items: center;

    .status-group {
      width: auto;
      min-width: 0;
      flex: 1 1 auto;
      flex-wrap: nowrap;
      justify-content: flex-start;
    }

    .status-actions {
      width: auto;
      min-width: 0;
      margin-left: auto;
      justify-content: flex-end;
      gap: 8px;
      flex: 0 0 auto;
      flex-wrap: nowrap;
      align-items: center;
    }

    .status-summary {
      min-height: 30px;
      padding: 0 10px;
      gap: 6px;
    }

    .status-summary__sep {
      display: none;
    }
  }

  .server-list-section {
    inset: auto 8px 8px 8px;
    max-height: min(72vh, 640px);

    .section-title-row {
      align-items: stretch;
    }

    .search-filter-bar {
      flex-wrap: wrap;
      padding: 4px;
      gap: 4px;
    }

    .search-box {
      width: 100%;
      padding: 0 8px 0 10px;
    }

    .filter-group {
      width: 100%;
      margin: 0;
      justify-content: center;
    }

    .filter-btn {
      flex: 1 1 0;
    }

    .section-summary {
      width: 100%;
      justify-content: center;
    }
  }
}
</style>
