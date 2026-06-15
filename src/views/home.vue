<template>
  <div class="home-view" :class="{ 'sidebar-collapsed': !sidebarOpen }">
    <div v-if="!store.state.init" class="init-loading-overlay">
      <icon-loading class="spin init-loading-icon" />
      <span class="init-loading-text">正在连接哪吒探针...</span>
    </div>
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
            共<strong>{{ serverCount.total }}</strong>台服务器
          </span>
          <template v-if="serverCount.offline > 0">
            <span class="status-summary__item status-summary__item--offline">
              有{{ serverCount.offline }}台离线
            </span>
          </template>
        </div>
      </div>

      <div class="status-actions">
        <theme-mode-switch />
      </div>
    </div>

    <div class="globe-section">
      <current-time :panel-width="currentTimePanelWidth" />
      <div v-if="serverList.length === 0" class="empty-state">
        <icon-earth class="empty-icon" />
        <span>暂无服务器数据</span>
      </div>
      <globe-earth
        v-else
        :key="globeKey"
        ref="globeRef"
        :locations="serverLocations"
        :theme="resolvedTheme"
        :cycle-transfer-map="cycleTransferMap"
      />
      <div
        ref="globeStatsFloatingRef"
        class="globe-stats-floating"
      >
        <div class="globe-stats-count">
          <span class="stats-count-icon" aria-hidden="true">
            <i class="ri-server-line" />
          </span>
          <span class="stats-count-text">共 <strong>{{ serverCount.total }}</strong> 台服务器</span>
          <button
            type="button"
            class="stats-more-btn"
            aria-label="查看更多统计"
            title="查看更多统计"
            @click.stop="openStatsModal"
          >
            更多
          </button>
        </div>
        <div class="globe-stats-row">
          <span class="stats-label">流量</span>
          <div class="stats-pair">
            <div class="globe-stats-item globe-stats-item--in">
              <i class="ri-arrow-down-line" />
              <span class="stats-value-group">
                <span class="stats-value">{{ totalStats.netInTransfer.value }}</span>
                <span class="stats-unit">{{ totalStats.netInTransfer.unit }}</span>
              </span>
            </div>
            <div class="globe-stats-item globe-stats-item--out">
              <i class="ri-arrow-up-line" />
              <span class="stats-value-group">
                <span class="stats-value">{{ totalStats.netOutTransfer.value }}</span>
                <span class="stats-unit">{{ totalStats.netOutTransfer.unit }}</span>
              </span>
            </div>
          </div>
        </div>
        <div class="globe-stats-row">
          <span class="stats-label">网速</span>
          <div class="stats-pair">
            <div class="globe-stats-item globe-stats-item--in">
              <i class="ri-arrow-down-line" />
              <span class="stats-value-group">
                <span class="stats-value">{{ totalStats.netInSpeed.value }}</span>
                <span class="stats-unit">{{ totalStats.netInSpeed.unit }}/s</span>
              </span>
            </div>
            <div class="globe-stats-item globe-stats-item--out">
              <i class="ri-arrow-up-line" />
              <span class="stats-value-group">
                <span class="stats-value">{{ totalStats.netOutSpeed.value }}</span>
                <span class="stats-unit">{{ totalStats.netOutSpeed.unit }}/s</span>
              </span>
            </div>
          </div>
        </div>
      </div>
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
              <server-status-filter
                v-if="hasOfflineServer"
                v-model="filterOnline"
                :options="FILTER_OPTIONS"
                aria-label="筛选状态"
              />
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

    <stats-detail-modal
      :visible="statsModalVisible"
      :display="detailStats"
      @close="closeStatsModal"
    />

    <app-footer class="app-footer--absolute" />
  </div>
</template>

<script setup>
import {
  ref,
  computed,
  onActivated,
  onDeactivated,
  onMounted,
  onUnmounted,
  watch,
  nextTick,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStore } from 'vuex';
import { resolveServerLocation, clusterLocations } from '@/utils/world-map';
import { getSystemOSLabel, calcTransfer, getCPUInfo } from '@/utils/host';
import { loadCycleTransferMap, getCycleTransferSummaryByServer } from '@/utils/cycle-transfer';
import {
  formatCurrencyValue,
  getCurrencySymbol,
  loadExchangeRatesForCurrencies,
  normalizeCurrencyCode,
  parseBillingCostAmount,
} from '@/utils/exchange-rate';
import config from '@/config';
import {
  serverSortOptions,
  serverSortHandler,
  defaultServerSortConfig,
} from '@/composables/server-sort';
import CurrentTime from '@/components/current-time.vue';
import GlobeEarth from '@/components/globe-earth/globe-earth.vue';
import ServerTable from '@/components/server-panel/server-table.vue';
import ServerSortSelect from '@/components/server-list/server-sort-select.vue';
import ServerStatusFilter from '@/components/server-list/server-status-filter.vue';
import ThemeModeSwitch from '@/components/theme-mode-switch.vue';
import AppFooter from '@/components/app-footer.vue';
import IconLoading from '@/components/icons/icon-loading.vue';
import IconInbox from '@/components/icons/icon-inbox.vue';
import IconEarth from '@/components/icons/icon-earth.vue';
import StatsDetailModal from '@/components/stats-detail-modal.vue';

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
const WIDE_BREAKPOINT = 1024;

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
const exchangeRateState = ref({
  targetCurrency: 'CNY',
  rates: {},
  loading: false,
  missingCurrencies: [],
  staleCurrencies: [],
  fetchedCurrencies: [],
  cachedCurrencies: [],
  updatedAt: 0,
  disabled: false,
  error: '',
});
const statsModalVisible = ref(false);
const globeStatsFloatingRef = ref(null);
const currentTimePanelWidth = ref(undefined);
const panelRef = ref(null);
const panelExpanded = ref(false);
const dragState = ref(null);
const DRAG_THRESHOLD = 60;
let serverHoverTimer = null;
let cycleTransferTimer = null;
let globeStatsResizeObserver = null;
let exchangeRateRequestId = 0;

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

function openStatsModal() {
  statsModalVisible.value = true;
}

function closeStatsModal() {
  statsModalVisible.value = false;
}

function syncCurrentTimePanelWidth() {
  const width = globeStatsFloatingRef.value?.getBoundingClientRect?.().width || 0;
  currentTimePanelWidth.value = width > 0 ? Math.round(width) : undefined;
}

function stopCurrentTimeWidthObserver() {
  if (globeStatsResizeObserver) {
    globeStatsResizeObserver.disconnect();
    globeStatsResizeObserver = null;
  }
}

async function setupCurrentTimeWidthSync() {
  stopCurrentTimeWidthObserver();

  await nextTick();

  if (!globeStatsFloatingRef.value) {
    currentTimePanelWidth.value = undefined;
    return;
  }

  syncCurrentTimePanelWidth();

  if (typeof ResizeObserver !== 'undefined') {
    globeStatsResizeObserver = new ResizeObserver(() => syncCurrentTimePanelWidth());
    globeStatsResizeObserver.observe(globeStatsFloatingRef.value);
  }
}

const serverList = computed(() => store.state.serverList);
const serverCount = computed(() => store.state.serverCount);
const serverGroups = computed(() => store.state.serverGroup || []);
const hasOfflineServer = computed(() => serverList.value.some((s) => s.online !== 1));
const resolvedTheme = computed(() => store.state.resolvedTheme);
const normalizedSearchKeyword = computed(() => searchKeyword.value.trim().toLowerCase());

const totalStats = computed(() => {
  let netInTransfer = 0;
  let netOutTransfer = 0;
  let netInSpeed = 0;
  let netOutSpeed = 0;
  serverList.value.forEach((server) => {
    const state = server.State || {};
    netInTransfer += state.NetInTransfer || 0;
    netOutTransfer += state.NetOutTransfer || 0;
    netInSpeed += state.NetInSpeed || 0;
    netOutSpeed += state.NetOutSpeed || 0;
  });
  return {
    netInTransfer: calcTransfer(netInTransfer),
    netOutTransfer: calcTransfer(netOutTransfer),
    netInSpeed: calcTransfer(netInSpeed),
    netOutSpeed: calcTransfer(netOutSpeed),
  };
});

const costTargetCurrency = computed(() => normalizeCurrencyCode(
  config.nazhua.statsCostCurrency || 'CNY',
  'CNY',
));

function getBillingCostEntries() {
  const targetCurrency = costTargetCurrency.value;
  return serverList.value
    .map((server) => {
      const billing = server?.PublicNote?.billingDataMod;
      if (!billing || billing.amount === undefined || billing.amount === null || billing.amount === '') {
        return null;
      }
      return {
        parsed: parseBillingCostAmount(billing.amount, targetCurrency),
      };
    })
    .filter(Boolean);
}

function getRequiredCostCurrencies() {
  const targetCurrency = costTargetCurrency.value;
  const currencies = new Set();
  getBillingCostEntries().forEach(({ parsed }) => {
    if (parsed.type === 'fixed' && parsed.value > 0 && parsed.currency !== targetCurrency) {
      currencies.add(parsed.currency);
    }
  });
  return [...currencies].sort();
}

const costExchangeSignature = computed(() => JSON.stringify({
  targetCurrency: costTargetCurrency.value,
  currencies: getRequiredCostCurrencies(),
  enabled: config.nazhua.exchangeRateEnabled !== false,
  apiBase: config.nazhua.exchangeRateApiBase || '',
  cacheHours: Number(config.nazhua.exchangeRateCacheHours) || 24,
}));

const BYTE_UNITS = {
  '': 1,
  K: 1024,
  M: 1024 ** 2,
  G: 1024 ** 3,
  T: 1024 ** 4,
  P: 1024 ** 5,
  E: 1024 ** 6,
};

function parseDisplayBytes(display) {
  if (!display || display === '-') {
    return null;
  }
  const str = String(display).replace(/\s+/g, '').toUpperCase();
  const match = str.match(/^([0-9.]+)([KMGTPE]?)(I?B?)$/);
  if (!match) {
    return null;
  }
  const value = parseFloat(match[1]);
  if (Number.isNaN(value) || value <= 0) {
    return null;
  }
  const unit = match[2];
  return value * (BYTE_UNITS[unit] || 1);
}

function parseTrafficVolumeToBytes(valueStr) {
  if (!valueStr) {
    return null;
  }
  const str = String(valueStr).replace(/\s+/g, '').toUpperCase();
  if (str.includes('BPS') || str.includes('/S')) {
    return null;
  }
  const match = str.match(/^([0-9.]+)([KMGTPE]?)(I?B?)$/);
  if (!match) {
    return null;
  }
  const value = parseFloat(match[1]);
  if (Number.isNaN(value) || value <= 0) {
    return null;
  }
  const unit = match[2];
  return value * (BYTE_UNITS[unit] || 1);
}

function getCycleMonths(cycle) {
  if (cycle === null || cycle === undefined || cycle === '') {
    return 1;
  }
  // 兼容以数字表示的周期月数（如 1/3/6/12）
  if (typeof cycle === 'number' && Number.isFinite(cycle) && cycle > 0) {
    return cycle;
  }
  const cycleStr = String(cycle).trim();
  const cycleNum = Number(cycleStr);
  if (String(cycleNum) === cycleStr && Number.isFinite(cycleNum) && cycleNum > 0) {
    return cycleNum;
  }
  switch (cycleStr.toLowerCase()) {
    case '年':
    case 'y':
    case 'yr':
    case 'year':
    case 'annual':
      return 12;
    case '季':
    case 'quarterly':
      return 3;
    case '半':
    case '半年':
    case 'h':
    case 'half':
    case 'semi-annually':
      return 6;
    case '月':
    case 'm':
    case 'mo':
    case 'month':
    case 'monthly':
    default:
      return 1;
  }
}

function formatCost(value, currency = costTargetCurrency.value) {
  if (!Number.isFinite(value)) {
    return { display: '-', value: 0, currency: '' };
  }
  const num = Number(value.toFixed(2));
  return { display: formatCurrencyValue(num, currency), value: num, currency };
}

function formatExchangeRateTime(timestamp) {
  if (!timestamp) {
    return '';
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hour}:${minute}`;
}

function getExchangeRateForCurrency(currency) {
  const targetCurrency = costTargetCurrency.value;
  if (currency === targetCurrency) {
    return 1;
  }
  const rate = Number(exchangeRateState.value.rates?.[currency]?.rate);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

function buildCostRateStatus({
  hasExternalCurrency,
  ignoredCount,
  unconvertedCount,
}) {
  const state = exchangeRateState.value;
  if (state.disabled && hasExternalCurrency) {
    return '汇率已关闭';
  }
  if (state.loading) {
    return '汇率更新中';
  }
  if (unconvertedCount > 0) {
    return '部分未换算';
  }
  if (state.staleCurrencies?.length > 0) {
    return '使用缓存汇率';
  }
  if (hasExternalCurrency) {
    return state.updatedAt ? '汇率已更新' : '汇率已缓存';
  }
  if (ignoredCount > 0) {
    return '含未计入项';
  }
  return '无需汇率';
}

async function refreshCostExchangeRates() {
  exchangeRateRequestId += 1;
  const requestId = exchangeRateRequestId;
  const targetCurrency = costTargetCurrency.value;
  const currencies = getRequiredCostCurrencies();
  const enabled = config.nazhua.exchangeRateEnabled !== false;

  exchangeRateState.value = {
    ...exchangeRateState.value,
    targetCurrency,
    loading: enabled && currencies.length > 0,
    disabled: !enabled,
    error: '',
  };

  try {
    const result = await loadExchangeRatesForCurrencies(currencies, targetCurrency, {
      enabled,
      apiBase: config.nazhua.exchangeRateApiBase,
      cacheHours: config.nazhua.exchangeRateCacheHours,
    });
    if (requestId === exchangeRateRequestId) {
      exchangeRateState.value = {
        ...result,
        loading: false,
      };
    }
  } catch (error) {
    if (requestId === exchangeRateRequestId) {
      exchangeRateState.value = {
        ...exchangeRateState.value,
        targetCurrency,
        loading: false,
        error: error?.message || '汇率更新失败',
      };
    }
  }
}

const detailStats = computed(() => {
  let totalCores = 0;
  let totalMem = 0;
  let totalDisk = 0;
  let netInTransfer = 0;
  let netOutTransfer = 0;
  let remainingTrafficBytes = 0;
  let hasRemainingTrafficData = false;
  let monthlyCost = 0;
  let hasCostData = false;
  let freeCostCount = 0;
  let ignoredCostCount = 0;
  let invalidCostCount = 0;
  let unconvertedCostCount = 0;
  const sourceCurrencies = new Set();
  const convertedCurrencies = new Set();
  const cpuBrandCoresMap = {};
  const targetCurrency = costTargetCurrency.value;

  serverList.value.forEach((server) => {
    const host = server.Host || {};
    const state = server.State || {};
    const publicNote = server.PublicNote || {};

    const cpuText = host.CPU?.[0] || '';
    const cpuInfo = getCPUInfo(cpuText);
    const coreMatch = cpuText.match(/(\d+)\s*(Virtual|Physical|Physics)\s*Core/i);
    const cores = coreMatch ? parseInt(coreMatch[1], 10) || 0 : 0;
    totalCores += cores;
    if (cores > 0) {
      const brand = cpuInfo.company || '其他';
      cpuBrandCoresMap[brand] = (cpuBrandCoresMap[brand] || 0) + cores;
    }

    totalMem += host.MemTotal || 0;
    totalDisk += host.DiskTotal || 0;

    netInTransfer += state.NetInTransfer || 0;
    netOutTransfer += state.NetOutTransfer || 0;

    const cycleSummary = getCycleTransferSummaryByServer(cycleTransferMap.value, server);
    if (cycleSummary && cycleSummary.remainingDisplay !== '-') {
      const bytes = parseDisplayBytes(cycleSummary.remainingDisplay);
      if (bytes !== null) {
        remainingTrafficBytes += bytes;
        hasRemainingTrafficData = true;
      }
    } else if (publicNote.planDataMod?.trafficVol) {
      const { planDataMod } = publicNote;
      const maxBytes = parseTrafficVolumeToBytes(planDataMod.trafficVol);
      if (maxBytes) {
        const { trafficType } = planDataMod;
        let used = 0;
        if (trafficType === '1') {
          used = state.NetOutTransfer || 0;
        } else if (trafficType === '3') {
          used = Math.max(state.NetOutTransfer || 0, state.NetInTransfer || 0);
        } else {
          used = (state.NetOutTransfer || 0) + (state.NetInTransfer || 0);
        }
        remainingTrafficBytes += Math.max(maxBytes - used, 0);
        hasRemainingTrafficData = true;
      }
    }

    const billing = publicNote.billingDataMod;
    if (billing?.amount !== undefined && billing?.amount !== null && billing?.amount !== '') {
      const parsed = parseBillingCostAmount(billing.amount, targetCurrency);
      if (parsed.type === 'free') {
        freeCostCount += 1;
        hasCostData = true;
        sourceCurrencies.add(targetCurrency);
      } else if (parsed.type === 'metered') {
        ignoredCostCount += 1;
      } else if (parsed.type === 'fixed') {
        const rate = getExchangeRateForCurrency(parsed.currency);
        sourceCurrencies.add(parsed.currency);
        if (rate !== null) {
          const months = getCycleMonths(billing.cycle);
          monthlyCost += (parsed.value * rate) / months;
          convertedCurrencies.add(parsed.currency);
          hasCostData = true;
        } else {
          unconvertedCostCount += 1;
        }
      } else if (parsed.type === 'invalid') {
        invalidCostCount += 1;
      }
    }
  });

  const serverIdSet = new Set(serverList.value.map((s) => String(s.ID)));
  const groupCounts = serverGroups.value.map((group) => {
    const count = (group.servers || []).filter((id) => serverIdSet.has(String(id))).length;
    return { name: group.name, count };
  }).filter((g) => g.count > 0);

  const cpuBrandCores = Object.entries(cpuBrandCoresMap)
    .map(([brand, cores]) => ({ brand, cores }))
    .sort((a, b) => b.cores - a.cores);
  const ignoredCount = ignoredCostCount + invalidCostCount;
  const hasExternalCurrency = [...sourceCurrencies].some((currency) => currency !== targetCurrency);
  const exchangeRateStatus = buildCostRateStatus({
    hasExternalCurrency,
    ignoredCount,
    unconvertedCount: unconvertedCostCount,
  });

  return {
    totalServers: serverCount.value.total || 0,
    onlineServers: serverCount.value.online || 0,
    offlineServers: serverCount.value.offline || 0,
    groupCounts,
    totalCores,
    cpuBrandCores,
    totalMemory: calcTransfer(totalMem),
    totalDisk: calcTransfer(totalDisk),
    netInTransfer: calcTransfer(netInTransfer),
    netOutTransfer: calcTransfer(netOutTransfer),
    totalTransfer: calcTransfer(netInTransfer + netOutTransfer),
    remainingTraffic: {
      ...calcTransfer(remainingTrafficBytes),
      hasData: hasRemainingTrafficData,
    },
    monthlyCost: formatCost(monthlyCost, targetCurrency),
    yearlyCost: formatCost(monthlyCost * 12, targetCurrency),
    hasCostData,
    costSummary: {
      targetCurrency,
      targetSymbol: getCurrencySymbol(targetCurrency),
      sourceCurrencies: [...sourceCurrencies].sort(),
      convertedCurrencies: [...convertedCurrencies].sort(),
      freeCount: freeCostCount,
      ignoredCount,
      meteredCount: ignoredCostCount,
      invalidCount: invalidCostCount,
      unconvertedCount: unconvertedCostCount,
      exchangeRate: {
        enabled: config.nazhua.exchangeRateEnabled !== false,
        loading: exchangeRateState.value.loading,
        disabled: exchangeRateState.value.disabled,
        statusText: exchangeRateStatus,
        updatedAt: exchangeRateState.value.updatedAt,
        updatedAtText: formatExchangeRateTime(exchangeRateState.value.updatedAt),
        missingCurrencies: exchangeRateState.value.missingCurrencies || [],
        staleCurrencies: exchangeRateState.value.staleCurrencies || [],
        fetchedCurrencies: exchangeRateState.value.fetchedCurrencies || [],
        cachedCurrencies: exchangeRateState.value.cachedCurrencies || [],
        error: exchangeRateState.value.error,
      },
    },
  };
});

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
      aliasCode: loc.aliasCode || '',
      name: loc.name || '',
      country: loc.country || '',
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

watch(
  costExchangeSignature,
  () => {
    refreshCostExchangeRates();
  },
  { immediate: true },
);

watch(
  isWideScreen,
  () => {
    setupCurrentTimeWidthSync();
  },
);

watch(
  [resolvedTheme, serverCount, totalStats],
  async () => {
    await nextTick();
    syncCurrentTimePanelWidth();
  },
  { deep: true },
);

function handleWindowResize() {
  updateWideScreen();
  if (typeof ResizeObserver === 'undefined') {
    nextTick(() => syncCurrentTimePanelWidth());
  }
}

onMounted(() => {
  updateWideScreen();
  window.addEventListener('resize', handleWindowResize);
  setupCurrentTimeWidthSync();
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
    setupCurrentTimeWidthSync();
    if (store.state.globeFocus) {
      handleGlobeFocus();
    }
  });
});

onDeactivated(() => {
  stopCurrentTimeWidthObserver();
});

onUnmounted(() => {
  window.removeEventListener('resize', handleWindowResize);
  clearServerHoverTimer();
  stopCycleTransferTimer();
  stopCurrentTimeWidthObserver();
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

.init-loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  background: var(--page-bg);
  color: var(--text-secondary);
  font-size: 15px;
  text-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);

  .init-loading-icon {
    width: 46px;
    height: 46px;
    color: var(--empty-icon-color);
  }

  .spin {
    animation: spin 1s linear infinite;
  }
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
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: 1px;
    min-height: 32px;
    padding: 0;
    border: none;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
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
      line-height: 1.3;
      color: var(--text-muted);
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

.globe-stats-floating {
  position: absolute;
  left: 18px;
  bottom: 18px;
  z-index: 10;
  width: 236px;
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 13px 14px;
  overflow: hidden;
  border-radius: 22px;
  border: 1px solid var(--border-color);
  background:
    linear-gradient(145deg, rgba(var(--accent-primary-rgb), 0.08), transparent 42%),
    var(--panel-floating-bg);
  backdrop-filter: blur(18px) saturate(150%);
  box-shadow:
    var(--shadow-md),
    inset 0 1px 0 var(--surface-highlight);
  font-size: 12px;
  color: var(--text-secondary);
  pointer-events: none;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.14), transparent 42%),
      linear-gradient(90deg, rgba(var(--accent-primary-rgb), 0.09), transparent 60%);
    pointer-events: none;
  }

  &::after {
    content: '';
    position: absolute;
    inset: 0 18px auto;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(var(--accent-primary-rgb), 0.42), transparent);
    pointer-events: none;
  }

  .globe-stats-count {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;

    strong {
      color: var(--text-primary);
      font-weight: 700;
      font-family: var(--font-mono);
    }
  }

  .stats-count-icon {
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    flex: 0 0 auto;
    border-radius: 8px;
    border: 1px solid rgba(var(--accent-primary-rgb), 0.16);
    background: rgba(var(--accent-primary-rgb), 0.09);
    color: var(--accent-primary);

    i {
      font-size: 12px;
      line-height: 1;
    }
  }

  .stats-count-text {
    min-width: 0;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .stats-more-btn {
    position: relative;
    z-index: 2;
    margin-left: auto;
    min-height: 22px;
    padding: 0 9px;
    border-radius: 8px;
    border: 1px solid var(--button-subtle-border);
    background: var(--button-subtle-bg);
    color: var(--text-secondary);
    font-size: 10.5px;
    font-weight: 600;
    line-height: 1;
    cursor: pointer;
    pointer-events: auto;
    transition:
      color var(--transition-fast),
      background var(--transition-fast),
      border-color var(--transition-fast),
      box-shadow var(--transition-fast),
      transform var(--transition-fast);

    &:hover {
      color: var(--text-on-accent);
      background: var(--button-active-bg);
      border-color: var(--button-active-border);
      box-shadow: var(--button-active-shadow);
      transform: translateY(-1px);
    }
  }

  .globe-stats-row {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr);
    align-items: center;
    gap: 9px;
    min-height: 20px;
  }

  .stats-pair {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .globe-stats-item {
    display: inline-flex;
    align-items: baseline;
    justify-content: flex-end;
    gap: 4px;
    min-width: 0;
    white-space: nowrap;

    i {
      font-size: 12px;
      line-height: 1;
      color: var(--accent-primary);
    }

    &--in {
      i,
      .stats-value {
        color: var(--net-speed-in-color);
      }
    }

    &--out {
      i,
      .stats-value {
        color: var(--net-speed-out-color);
      }
    }
  }

  .stats-value-group {
    display: inline-flex;
    align-items: baseline;
    justify-content: flex-end;
    gap: 1px;
    min-width: 0;
  }

  .stats-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
  }

  .stats-value {
    color: var(--text-primary);
    font-size: 12px;
    font-weight: 700;
    font-family: var(--font-mono);
    line-height: 1;
  }

  .stats-unit {
    color: var(--text-muted);
    font-size: 10.5px;
    line-height: 1;
  }
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
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1em;
      height: 1em;
      font-size: 16px;
      line-height: 1;
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

  .group-filter-bar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 10px;
    padding: 0 2px;
  }

  .group-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 26px;
    padding: 0 10px;
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

@media screen and (min-width: 1024px) {
  .home-view {
    grid-template-columns: minmax(0, 1fr) clamp(380px, 28vw, 440px);

    &.sidebar-collapsed {
      grid-template-columns: minmax(0, 1fr) 0;
    }
  }

  .status-bar {
    grid-column: 2 / 3;
    grid-row: 1 / 2;
  }

  .globe-section {
    grid-column: 1 / 2;
    grid-row: 1 / 4;
  }

  .server-list-section {
    grid-column: 2 / 3;
    grid-row: 2 / 3;

    &.collapsed {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      overflow: hidden;
      border: none;
    }
  }

  .app-footer--absolute {
    grid-column: 2 / 3;
    grid-row: 3 / 4;
  }
}

@media screen and (max-width: 1023px) {
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
      padding: 0;
      gap: 1px;
      font-size: 12px;
    }
  }

  .globe-section {
    min-height: 0;
    border-radius: 0;
    border: none;
    box-shadow: none;
  }

  .globe-stats-floating {
    left: 14px;
    bottom: 42px;
    width: 218px;
    gap: 7px;
    padding: 10px 12px 11px;
    border-radius: 18px;
    box-shadow: var(--shadow-sm);

    .globe-stats-count {
      gap: 6px;
    }

    .stats-count-icon {
      width: 16px;
      height: 16px;
      border-radius: 7px;

      i {
        font-size: 11px;
      }
    }

    .stats-count-text {
      font-size: 11px;

      strong {
        font-size: 13px;
      }
    }

    .globe-stats-row {
      grid-template-columns: 32px minmax(0, 1fr);
      gap: 8px;
      min-height: 18px;
    }

    .stats-pair {
      gap: 8px;
    }

    .globe-stats-item {
      gap: 3px;

      i {
        font-size: 11px;
      }
    }

    .stats-label {
      font-size: 10px;
    }

    .stats-value {
      font-size: 11px;
    }

    .stats-unit {
      font-size: 9.5px;
    }
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

  .app-footer--absolute {
    position: absolute;
    bottom: 10px;
    left: 0;
    right: 0;
    z-index: 20;
    margin: 0;
    min-height: auto;
    padding: 8px;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  .server-list-section {
    position: fixed;
    inset: 10px 10px 10px auto;
    width: min(420px, calc(100vw - 20px));
    height: auto;
    z-index: 30;
    border-radius: 28px 0 0 28px;
    transform: translateX(0);
    transition:
      transform var(--transition-normal),
      opacity var(--transition-normal),
      visibility var(--transition-normal);

    .section-title-row {
      display: none;
    }

    .drawer-drag-handle {
      display: none;
    }

    &.collapsed {
      display: flex;
      transform: translateX(calc(100% + 20px));
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }
  }
}

@media screen and (max-width: 768px) {
  .server-list-section {
    inset: auto 10px 10px 10px;
    width: auto;
    height: min(72vh, 660px);
    height: min(72dvh, 660px);
    border-radius: 28px;
    transform: translateY(0);
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
      transform: translateY(calc(100% + 20px));
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
      padding: 0;
      gap: 1px;
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
      padding: 0 3px 0 0;
      gap: 4px;
    }

    .search-box {
      min-width: 0;
      padding: 0 8px 0 10px;
    }

    .toolbar-row--primary {
      flex-wrap: nowrap;
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

  .globe-stats-floating {
    left: 12px;
    bottom: 38px;
    width: 198px;
    gap: 6px;
    padding: 8px 10px 9px;
    border-radius: 16px;

    .stats-count-icon {
      width: 15px;
      height: 15px;
    }

    .stats-count-text {
      font-size: 10px;

      strong {
        font-size: 12px;
      }
    }

    .globe-stats-row {
      grid-template-columns: 30px minmax(0, 1fr);
      gap: 7px;
      min-height: 17px;
    }

    .stats-pair {
      gap: 6px;
    }

    .globe-stats-item {
      gap: 2px;
    }

    .stats-label {
      font-size: 9px;
    }

    .stats-value {
      font-size: 10px;
    }

    .stats-unit {
      font-size: 9px;
    }
  }
}
</style>
