<template>
  <div class="home-view">
    <div class="status-bar">
      <div class="status-group">
        <button
          v-if="!isWideScreen"
          type="button"
          class="mobile-menu-btn"
          aria-label="展开服务器列表"
          title="展开服务器列表"
          @click="toggleSidebar"
        >
          <i class="ri-server-line" />
        </button>
        <div class="status-summary" aria-label="服务器统计">
          <span class="status-summary__total">
            <strong>{{ serverCount.total }}</strong>台
          </span>
          <template v-if="serverCount.offline > 0">
            <span class="status-summary__sep" aria-hidden="true">·</span>
            <span class="status-summary__item status-summary__item--offline">
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
          :key="globeKey"
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

      <div
        ref="panelRef"
        class="server-list-section"
        :class="{ collapsed: !sidebarOpen, expanded: panelExpanded && sidebarOpen }"
      >
        <div class="tech-frame" aria-hidden="true" />
        <div class="section-header">
          <div
            v-if="!isWideScreen"
            class="drawer-drag-handle"
            @touchstart.passive="onDragStart"
            @touchmove.passive="onDragMove"
            @touchend="onDragEnd"
            @touchcancel="onDragEnd"
          >
            <span class="drawer-drag-handle__bar" />
          </div>
          <div
            v-if="!isWideScreen"
            class="section-title-row"
          >
            <button
              type="button"
              class="close-sidebar"
              title="收起"
              @click="toggleSidebar"
            >
              <i class="ri-arrow-right-s-line" />
            </button>
          </div>
          <div class="section-toolbar">
            <div class="toolbar-row toolbar-row--primary">
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
                <div
                  v-if="hasOfflineServer"
                  class="filter-group"
                  role="group"
                  aria-label="筛选状态"
                >
                  <button
                    v-for="option in FILTER_OPTIONS"
                    :key="option.value || 'all'"
                    type="button"
                    :class="['filter-btn', { active: filterOnline === option.value }]"
                    @click="filterOnline = option.value"
                  >
                    <span class="filter-label">{{ option.label }}</span>
                  </button>
                </div>
              </div>
              <server-sort-select
                v-model="serverSortConfig"
                :options="serverSortOptionsList"
              />
            </div>
            <div
              v-if="serverGroups.length > 0"
              class="group-filter-bar"
            >
              <button
                type="button"
                :class="['group-chip', { active: selectedGroup === '' }]"
                @click="selectedGroup = ''"
              >
                全部
              </button>
              <button
                v-for="group in serverGroups"
                :key="group.name"
                type="button"
                :class="['group-chip', { active: selectedGroup === group.name }]"
                @click="selectedGroup = group.name"
              >
                {{ group.name }}
              </button>
            </div>
          </div>
        </div>
        <server-table
          v-if="filteredServers.length > 0"
          :servers="filteredServers"
          :cycle-transfer-map="cycleTransferMap"
          @hover-server="handleServerHover"
        />
        <div v-else class="empty-list">
          <icon-inbox class="empty-icon" />
          <span>没有符合条件的服务器</span>
        </div>
        <div
          v-if="listResultHint"
          class="result-hint-floating"
        >
          <span class="section-summary">{{ listResultHint }}</span>
        </div>
      </div>
    </div>

    <app-footer class="app-footer--absolute" />
  </div>
</template>

<script setup>
import {
  ref,
  computed,
  onActivated,
  onMounted,
  onUnmounted,
  watch,
  nextTick,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStore } from 'vuex';
import { resolveServerLocation, clusterLocations } from '@/utils/world-map';
import { getSystemOSLabel } from '@/utils/host';
import { loadCycleTransferMap } from '@/utils/cycle-transfer';
import config from '@/config';
import {
  serverSortOptions,
  serverSortHandler,
  defaultServerSortConfig,
} from '@/composables/server-sort';
import GlobeEarth from '@/components/globe-earth/globe-earth.vue';
import ServerTable from '@/components/server-panel/server-table.vue';
import ServerSortSelect from '@/components/server-list/server-sort-select.vue';
import ThemeModeSwitch from '@/components/theme-mode-switch.vue';
import AppFooter from '@/components/app-footer.vue';
import IconLoading from '@/components/icons/icon-loading.vue';
import IconInbox from '@/components/icons/icon-inbox.vue';
import IconEarth from '@/components/icons/icon-earth.vue';

const SERVER_HOVER_FOCUS_DELAY = 3000;
const FILTER_OPTIONS = [
  { label: '全部', value: '' },
  { label: '在线', value: '1', dot: 'online' },
  { label: '离线', value: '-1', dot: 'offline' },
];
const serverSortOptionsList = serverSortOptions();

const route = useRoute();
const router = useRouter();
const store = useStore();
const WIDE_BREAKPOINT = 1280;

const filterOnline = ref('');
const searchKeyword = ref('');
const selectedGroup = ref('');
const serverSortConfig = ref(defaultServerSortConfig());
const sidebarOpen = ref(typeof window === 'undefined' ? true : window.innerWidth > 768);
const isWideScreen = ref(false);
const globeRef = ref(null);
const globeKey = ref(0);
const cycleTransferMap = ref({});
const cycleTransferLoading = ref(false);
const panelRef = ref(null);
const panelExpanded = ref(false);
const dragState = ref(null);
const DRAG_THRESHOLD = 60;
let serverHoverTimer = null;
let cycleTransferTimer = null;

function updateWideScreen() {
  isWideScreen.value = window.innerWidth >= WIDE_BREAKPOINT;
  if (isWideScreen.value) {
    sidebarOpen.value = true;
    panelExpanded.value = false;
  }
}

function toggleSidebar() {
  if (isWideScreen.value) {
    return;
  }
  sidebarOpen.value = !sidebarOpen.value;
  if (!sidebarOpen.value) {
    panelExpanded.value = false;
  }
}

function onDragStart(e) {
  if (isWideScreen.value || !e.touches || e.touches.length === 0) {
    return;
  }
  const touch = e.touches[0];
  dragState.value = {
    startY: touch.clientY,
    startTime: Date.now(),
    startMode: panelExpanded.value ? 'expanded' : 'peek',
  };
  panelRef.value?.classList.add('is-dragging');
}

function onDragMove(e) {
  if (!dragState.value || !e.touches || e.touches.length === 0) {
    return;
  }
  const touch = e.touches[0];
  const deltaY = touch.clientY - dragState.value.startY;
  dragState.value.deltaY = deltaY;

  const panel = panelRef.value;
  if (!panel) {
    return;
  }

  // Only close direction (pull down) is visually followed; push up switches
  // to expanded on release.
  if (dragState.value.startMode === 'peek' || dragState.value.startMode === 'expanded') {
    const y = Math.max(0, deltaY);
    panel.style.transform = `translateY(${y}px)`;
  }
}

function onDragEnd() {
  if (!dragState.value) {
    return;
  }
  const { deltaY, startMode } = dragState.value;
  const panel = panelRef.value;
  panel?.classList.remove('is-dragging');
  if (panel) {
    panel.style.transform = '';
  }

  if (startMode === 'peek') {
    if (deltaY > DRAG_THRESHOLD) {
      sidebarOpen.value = false;
      panelExpanded.value = false;
    } else if (deltaY < -DRAG_THRESHOLD) {
      panelExpanded.value = true;
    }
  } else if (startMode === 'expanded') {
    if (deltaY > DRAG_THRESHOLD) {
      panelExpanded.value = false;
    }
  }
  dragState.value = null;
}

function clearSearchKeyword() {
  searchKeyword.value = '';
}

const serverList = computed(() => store.state.serverList);
const serverCount = computed(() => store.state.serverCount);
const serverGroups = computed(() => store.state.serverGroup || []);
const hasOfflineServer = computed(() => serverList.value.some((s) => s.online !== 1));
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
  normalizedSearchKeyword.value !== ''
  || filterOnline.value !== ''
  || selectedGroup.value !== ''
));

function sortServerList(list) {
  const { prop, order } = serverSortConfig.value;
  if (prop === 'DisplayIndex' && order === 'desc') {
    return list;
  }
  return [...list].sort((a, b) => serverSortHandler(a, b, prop, order));
}

const filteredServers = computed(() => {
  let list = searchMatchedServers.value;
  if (filterOnline.value !== '') {
    list = list.filter((s) => String(s.online) === filterOnline.value);
  }
  if (selectedGroup.value !== '') {
    const group = serverGroups.value.find((g) => g.name === selectedGroup.value);
    const groupServerIds = new Set((group?.servers || []).map((id) => String(id)));
    list = list.filter((s) => groupServerIds.has(String(s.ID)));
  }
  return sortServerList(list);
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
    const loc = resolveServerLocation(server);
    if (!loc) return;
    if (!locationMap[loc.code]) {
      locationMap[loc.code] = { ...loc, servers: [] };
    }
    locationMap[loc.code].servers.push(server);
  });

  const locations = Object.values(locationMap).map((loc) => {
    const onlineServers = loc.servers.filter((s) => s.online === 1);
    return {
      key: loc.code,
      lat: loc.lat,
      lng: loc.lng,
      code: loc.code,
      codes: [loc.code],
      label: loc.country ? `${loc.name}, ${loc.country}` : loc.name,
      servers: loc.servers,
      hasOnline: onlineServers.length > 0,
    };
  });
  return clusterLocations(locations);
});

function clearServerHoverTimer() {
  if (serverHoverTimer) {
    window.clearTimeout(serverHoverTimer);
    serverHoverTimer = null;
  }
}

async function refreshCycleTransfer() {
  if (cycleTransferLoading.value) {
    return;
  }
  cycleTransferLoading.value = true;
  try {
    cycleTransferMap.value = await loadCycleTransferMap(serverList.value) || {};
  } catch (error) {
    console.error('加载周期流量失败:', error);
  } finally {
    cycleTransferLoading.value = false;
  }
}

function stopCycleTransferTimer() {
  if (cycleTransferTimer) {
    window.clearInterval(cycleTransferTimer);
    cycleTransferTimer = null;
  }
}

function startCycleTransferTimer() {
  stopCycleTransferTimer();
  const seconds = Number(config.nazhua.detailCycleTransferRefreshTime) || 60;
  cycleTransferTimer = window.setInterval(refreshCycleTransfer, seconds * 1000);
}

function handleServerHover(server) {
  clearServerHoverTimer();
  globeRef.value?.clearFocusBubble?.();

  if (!server || !globeRef.value) {
    return;
  }

  serverHoverTimer = window.setTimeout(() => {
    serverHoverTimer = null;

    const loc = resolveServerLocation(server);
    if (!loc) {
      return;
    }

    const location = serverLocations.value.find((l) => l.codes?.includes(loc.code));
    if (location) {
      globeRef.value.focusLocationWithHighlight(location, server.Name);
    }
  }, SERVER_HOVER_FOCUS_DELAY);
}

async function focusLocationFromQuery(focusCode) {
  if (!focusCode || !globeRef.value || serverLocations.value.length === 0) {
    return false;
  }

  const location = serverLocations.value.find(
    (loc) => loc.codes?.includes(focusCode) || loc.code === focusCode,
  );
  if (!location) {
    return false;
  }

  const focusName = route.query.name;
  let success = false;
  if (focusName) {
    success = await globeRef.value.focusLocationWithHighlight(location, String(focusName));
  } else {
    success = globeRef.value.focusLocation(location);
  }

  if (success && route.query.focus) {
    const { focus, name, ...rest } = route.query;
    router.replace({ query: rest });
  }

  return success;
}

let focusingFromQuery = false;

async function tryFocusFromQuery() {
  if (focusingFromQuery) {
    return;
  }

  const focusCode = route.query.focus;
  if (!focusCode || !store.state.init || serverList.value.length === 0) {
    return;
  }

  focusingFromQuery = true;
  try {
    await nextTick();
    if (!globeRef.value) {
      return;
    }
    await globeRef.value.ready();
    if (!route.query.focus) {
      return;
    }
    await focusLocationFromQuery(String(focusCode));
  } finally {
    focusingFromQuery = false;
  }
}

watch(
  () => [route.query.focus, route.query.name, store.state.init, serverLocations.value.length],
  () => {
    tryFocusFromQuery();
  },
);

async function handleGlobeFocus() {
  const focus = store.state.globeFocus;
  if (!focus?.code || !globeRef.value) {
    return;
  }

  await globeRef.value.ready();

  if (!store.state.globeFocus || serverLocations.value.length === 0) {
    return;
  }

  const location = serverLocations.value.find(
    (loc) => loc.codes?.includes(focus.code) || loc.code === focus.code,
  );
  if (!location) {
    store.dispatch('clearGlobeFocus');
    return;
  }

  const success = await globeRef.value.focusLocationWithHighlight(
    location,
    focus.name || location.label,
  );

  if (success) {
    store.dispatch('clearGlobeFocus');
  }
}

watch(
  () => store.state.globeFocus,
  (focus) => {
    if (focus && globeRef.value) {
      handleGlobeFocus();
    }
  },
  { deep: true },
);

watch(
  () => store.state.init,
  (init) => {
    if (init && serverList.value.length > 0) {
      refreshCycleTransfer();
      startCycleTransferTimer();
    }
  },
);

watch(
  () => serverList.value.length,
  (length, prevLength) => {
    if (length > 0 && prevLength === 0 && store.state.init) {
      refreshCycleTransfer();
      startCycleTransferTimer();
    }
  },
);

onMounted(() => {
  updateWideScreen();
  window.addEventListener('resize', updateWideScreen);
  tryFocusFromQuery();
  if (store.state.globeFocus) {
    handleGlobeFocus();
  }
  if (store.state.init && serverList.value.length > 0) {
    refreshCycleTransfer();
    startCycleTransferTimer();
  }
});

onActivated(() => {
  globeKey.value += 1;
  nextTick(() => {
    if (store.state.globeFocus) {
      handleGlobeFocus();
    }
  });
});

onUnmounted(() => {
  window.removeEventListener('resize', updateWideScreen);
  clearServerHoverTimer();
  stopCycleTransferTimer();
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
  gap: 10px 14px;
  padding: 8px 14px;
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
    gap: 8px;
    min-height: 32px;
    padding: 0 12px;
    border: 1px solid var(--status-chip-border);
    border-radius: 999px;
    background: var(--status-chip-bg);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      0 8px 16px rgba(15, 23, 42, 0.04);
    font-size: 12px;
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

    &--offline {
      gap: 0;
      font-size: 11px;
      color: var(--text-muted);
    }
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

  @media (hover: hover) {
    &:hover {
      color: var(--text-on-accent);
      background: var(--button-active-bg);
      border-color: var(--button-active-border);
      box-shadow: var(--button-active-shadow);
    }
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
    justify-content: flex-end;
    gap: 10px;
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
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .toolbar-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;

    &--primary {
      .search-filter-bar {
        flex: 1;
        min-width: 0;
      }
    }
  }

  .result-hint-floating {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 10px 12px 12px;
    background: linear-gradient(180deg, transparent, var(--section-bg) 40%);
    z-index: 5;
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
    gap: 2px;
    margin: 2px 2px 2px 0;
    padding: 2px;
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

    @media (hover: hover) {
      &:hover:not(:disabled) {
        background: var(--button-subtle-bg);
        border-color: var(--button-subtle-border);
        color: var(--text-primary);
      }
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

    @media (hover: hover) {
      &:hover:not(:disabled) {
        background: var(--button-active-bg);
        border-color: var(--button-active-border);
        box-shadow: var(--button-active-shadow);
        color: var(--text-on-accent);
        transform: translateY(-1px);
      }
    }
  }

  .filter-btn {
    min-width: 0;
    min-height: 34px;
    padding: 0 10px;
    border-radius: 999px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-secondary);
    font-size: 12px;
    line-height: 1;
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

    @media (hover: hover) {
      &:hover:not(.active) {
        color: var(--text-primary);
        background: var(--bg-hover);
      }
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

  .group-filter-bar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 10px;
    padding: 0 2px;
  }

  .group-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 28px;
    padding: 0 12px;
    border-radius: 999px;
    border: 1px solid var(--button-subtle-border);
    background: var(--button-subtle-bg);
    color: var(--text-secondary);
    font-size: 12px;
    line-height: 1;
    font-weight: 600;
    cursor: pointer;
    transition:
      color var(--transition-fast),
      background var(--transition-fast),
      border-color var(--transition-fast),
      box-shadow var(--transition-fast);

    @media (hover: hover) {
      &:hover:not(.active) {
        color: var(--text-primary);
        background: var(--bg-hover);
      }
    }

    &.active {
      background: var(--button-active-bg);
      border-color: var(--button-active-border);
      box-shadow: var(--button-active-shadow);
      color: var(--text-on-accent);
    }
  }
}

.drawer-drag-handle,
.mobile-menu-btn {
  display: none;
}

:deep(.server-table-wrap) {
  flex: 1;
  min-height: 0;
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
    gap: 0;
    padding: 0;
    grid-template-rows: 1fr;
  }

  .status-bar {
    padding: 8px 10px;
    gap: 8px 10px;
    font-size: 12px;
    border-radius: 20px;
    flex-wrap: nowrap;
    align-items: center;
    position: absolute;
    top: 10px;
    left: 10px;
    right: 10px;
    z-index: 20;

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
    min-height: 100%;
  }

  .globe-section {
    min-height: 0;
    border-radius: 0;
    border: none;
    box-shadow: none;
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

  .sidebar-expand-handle {
    display: none;
  }

  .mobile-menu-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 1px solid var(--button-subtle-border);
    border-radius: 10px;
    background: var(--button-subtle-bg);
    color: var(--text-secondary);
    cursor: pointer;
    transition:
      color var(--transition-fast),
      background var(--transition-fast),
      border-color var(--transition-fast),
      box-shadow var(--transition-fast),
      transform var(--transition-fast);

    i {
      font-size: 16px;
    }

    @media (hover: hover) {
      &:hover {
        color: var(--text-on-accent);
        background: var(--button-active-bg);
        border-color: var(--button-active-border);
        box-shadow: var(--button-active-shadow);
        transform: translateY(-1px);
      }
    }
  }

  .server-list-section {
    position: fixed;
    inset: auto 10px 10px 10px;
    width: auto;
    height: min(72vh, 660px);
    height: min(72dvh, 660px);
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
      height var(--transition-normal),
      opacity var(--transition-normal),
      visibility var(--transition-normal);

    &.is-dragging {
      transition: none;
    }

    &.expanded {
      height: calc(100vh - 20px);
      height: calc(100dvh - 20px);
    }

    .section-title-row {
      display: none;
    }

    .drawer-drag-handle {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 30px;
      margin: -14px -14px 6px;
      cursor: grab;
      touch-action: none;

      &:active {
        cursor: grabbing;
      }

      &__bar {
        width: 52px;
        height: 6px;
        border-radius: 999px;
        background: var(--text-secondary);
        opacity: 0.55;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18);
      }
    }

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

    .section-summary {
      min-height: 30px;
      padding: 0 10px;
    }

    .search-filter-bar {
      min-height: 36px;
      padding: 0 3px 0 0;
    }

    .search-box {
      min-height: 34px;
    }

    .filter-group {
      margin: 2px 2px 2px 0;
      padding: 2px;
    }

    .filter-btn {
      padding: 0 6px;
      min-height: 30px;
    }

    .group-chip {
      min-height: 26px;
      padding: 0 10px;
      line-height: 1;
    }
  }

  :deep(.server-table-wrap) {
    padding-bottom: 24px;
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
    height: min(76vh, 680px);
    height: min(76dvh, 680px);

    &.expanded {
      height: calc(100vh - 16px);
      height: calc(100dvh - 16px);
    }

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
      flex: 1 1 auto;
      margin: 0;
    }

    .filter-btn {
      flex: 1 1 0;
    }

    .toolbar-row--primary {
      flex-wrap: wrap;
    }

    .server-sort-select {
      flex: 0 0 auto;
    }

    .group-filter-bar {
      width: 100%;
      margin-top: 8px;
      gap: 4px;
    }

    .group-chip {
      flex: 1 1 0;
      min-width: 0;
      padding: 0 6px;
      min-height: 26px;
      font-size: 11px;
      line-height: 1;
    }

    .section-summary {
      width: 100%;
      justify-content: center;
    }
  }
}
</style>
