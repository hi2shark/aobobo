<template>
  <detail-panel
    v-if="isModuleVisible"
    variant="flat"
    class="server-detail-resource-history"
  >
    <div class="module-head-group">
      <div class="left-box">
        <span class="module-title">
          <i class="ri-line-chart-line" />
          资源历史
        </span>
      </div>
      <div class="right-box">
        <div class="time-range-group">
          <span class="time-range-label">最近</span>
          <div class="time-range-options">
            <button
              v-for="periodItem in availablePeriods"
              :key="periodItem.value"
              type="button"
              class="time-range-item"
              :class="{ active: periodItem.value === period }"
              @click="setPeriod(periodItem.value)"
            >
              {{ periodItem.label }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="history-grid">
      <article
        v-for="card in historyCards"
        :key="card.key"
        class="history-card"
      >
        <div class="history-card__head">
          <h3 class="history-card__title">
            {{ card.title }}
          </h3>
          <div class="history-card__meta">
            <span
              v-if="card.summaryValue"
              class="history-card__summary"
            >
              {{ card.summaryValue }}
            </span>
            <div
              v-if="card.legendList.length"
              class="history-card__legend-group"
            >
              <span
                v-for="legendItem in card.legendList"
                :key="`${card.key}_${legendItem.key}`"
                class="history-card__legend-item"
                :style="{ '--legend-color': legendItem.color }"
              >
                <span class="history-card__legend-dot" />
                <span class="history-card__legend-label">{{ legendItem.label }}</span>
                <span class="history-card__legend-value">{{ legendItem.value }}</span>
              </span>
            </div>

            <div
              v-if="card.stats.length"
              class="history-card__stats"
            >
              <span
                v-for="(statItem, statIndex) in card.stats"
                :key="`${card.key}_stat_${statIndex}`"
                class="history-card__stat-item"
              >
                {{ statItem }}
              </span>
            </div>
          </div>
        </div>

        <div class="history-card__chart-shell">
          <line-chart
            v-if="card.hasData"
            :date-list="card.dateList"
            :value-list="card.valueList"
            :connect-nulls="false"
            :chart-config="card.chartConfig"
            :mode="chartMode"
          />
          <div
            v-else
            class="history-card__empty"
          >
            暂无历史数据
          </div>
        </div>
      </article>
    </div>
  </detail-panel>
</template>

<script setup>
import {
  computed,
  onUnmounted,
  ref,
  watch,
} from 'vue';
import { useStore } from 'vuex';
import config from '@/config';
import request from '@/utils/request';
import { hasTsdb, isTsdbEnabled } from '@/utils/tsdb';
import LineChart from '@/components/charts/line.vue';
import DetailPanel from '@/components/server-detail/detail-panel.vue';

const props = defineProps({
  info: {
    type: Object,
    default: () => ({}),
  },
});

const RESOURCE_HISTORY_PERIOD_KEY = 'aobobo_resource_history_period';
const NO_SWAP_TEXT = 'no swap';
const METRIC_KEYS = [
  'cpu',
  'memory',
  'swap',
  'disk',
  'process_count',
  'net_in_speed',
  'net_out_speed',
  'tcp_conn',
  'udp_conn',
];
const PERIOD_OPTIONS = [{
  label: '24小时',
  value: '1d',
}, {
  label: '7天',
  value: '7d',
}, {
  label: '30天',
  value: '30d',
}];
const SERIES_COLORS = {
  cpu: '#4e90ff',
  memory: '#27c975',
  swap: '#f59e0b',
  disk: '#22d3ee',
  process_count: '#f5b199',
  net_in_speed: '#f5b199',
  net_out_speed: '#89c3eb',
  tcp_conn: '#89c3eb',
  udp_conn: '#4e90ff',
};

const store = useStore();
const chartMode = computed(() => store.state.resolvedTheme || 'dark');
const userLogin = computed(() => store.state.profile?.username);
const serverId = computed(() => props.info?.ID);
const tsdbEnabled = computed(() => isTsdbEnabled(store));
const canUseLongPeriods = computed(() => !!userLogin.value && hasTsdb(store));
const availablePeriods = computed(() => PERIOD_OPTIONS.filter((item) => {
  if (item.value === '1d') return true;
  return canUseLongPeriods.value;
}));
const isSupported = computed(() => config.aobobo.nezhaVersion === 'v1' && tsdbEnabled.value);
const period = ref(readStoredPeriod());
const metricHistory = ref(createEmptyMetricMap());

let loadMetricsTimer = null;
let requestSerial = 0;

const historyCards = computed(() => {
  const memSwapSeries = buildAlignedSeries([{
    metric: 'memory',
    name: '内存',
    color: SERIES_COLORS.memory,
  }, {
    metric: 'swap',
    name: '交换',
    color: SERIES_COLORS.swap,
  }]);
  const netSpeedSeries = buildAlignedSeries([{
    metric: 'net_in_speed',
    name: '上传',
    color: SERIES_COLORS.net_in_speed,
  }, {
    metric: 'net_out_speed',
    name: '下载',
    color: SERIES_COLORS.net_out_speed,
  }]);
  const connSeries = buildAlignedSeries([{
    metric: 'tcp_conn',
    name: 'TCP',
    color: SERIES_COLORS.tcp_conn,
  }, {
    metric: 'udp_conn',
    name: 'UDP',
    color: SERIES_COLORS.udp_conn,
  }]);
  const cpuSeries = buildAlignedSeries([{
    metric: 'cpu',
    name: 'CPU',
    color: SERIES_COLORS.cpu,
  }]);
  const diskSeries = buildAlignedSeries([{
    metric: 'disk',
    name: '磁盘',
    color: SERIES_COLORS.disk,
  }]);
  const processSeries = buildAlignedSeries([{
    metric: 'process_count',
    name: '进程',
    color: SERIES_COLORS.process_count,
  }]);

  const currentCpu = firstFinite(props.info?.State?.CPU, latestMetricValue('cpu'));
  const currentMemPercent = firstFinite(
    calcPercent(props.info?.State?.MemUsed, props.info?.Host?.MemTotal),
    latestMetricValue('memory'),
  );
  const currentSwapPercent = props.info?.Host?.SwapTotal > 0
    ? firstFinite(
      calcPercent(props.info?.State?.SwapUsed, props.info?.Host?.SwapTotal),
      latestMetricValue('swap'),
    )
    : null;
  const currentDiskPercent = firstFinite(
    calcPercent(props.info?.State?.DiskUsed, props.info?.Host?.DiskTotal),
    latestMetricValue('disk'),
  );
  const currentProcessCount = firstFinite(
    props.info?.State?.ProcessCount,
    latestMetricValue('process_count'),
  );
  const currentNetInSpeed = firstFinite(
    props.info?.State?.NetInSpeed,
    latestMetricValue('net_in_speed'),
  );
  const currentNetOutSpeed = firstFinite(
    props.info?.State?.NetOutSpeed,
    latestMetricValue('net_out_speed'),
  );
  const currentTcpCount = firstFinite(
    props.info?.State?.TcpConnCount,
    latestMetricValue('tcp_conn'),
  );
  const currentUdpCount = firstFinite(
    props.info?.State?.UdpConnCount,
    latestMetricValue('udp_conn'),
  );

  return [{
    key: 'cpu',
    title: 'CPU',
    summaryValue: formatPercent(currentCpu),
    legendList: [],
    stats: [],
    ...cpuSeries,
    chartConfig: getPercentChartConfig(),
  }, {
    key: 'memory_swap',
    title: '内存 / 交换',
    summaryValue: '',
    legendList: [{
      key: 'memory',
      label: '内存',
      value: formatPercent(currentMemPercent),
      color: SERIES_COLORS.memory,
    }, {
      key: 'swap',
      label: '交换',
      value: props.info?.Host?.SwapTotal > 0 ? formatPercent(currentSwapPercent) : NO_SWAP_TEXT,
      color: SERIES_COLORS.swap,
    }],
    stats: [
      `${formatBinaryText(props.info?.State?.MemUsed)} / ${formatBinaryText(props.info?.Host?.MemTotal)}`,
      props.info?.Host?.SwapTotal > 0
        ? `${formatBinaryText(props.info?.State?.SwapUsed)} / ${formatBinaryText(props.info?.Host?.SwapTotal)}`
        : NO_SWAP_TEXT,
    ],
    ...memSwapSeries,
    chartConfig: getPercentChartConfig(),
  }, {
    key: 'disk',
    title: '磁盘',
    summaryValue: formatPercent(currentDiskPercent),
    legendList: [],
    stats: [`${formatBinaryText(props.info?.State?.DiskUsed)} / ${formatBinaryText(props.info?.Host?.DiskTotal)}`],
    ...diskSeries,
    chartConfig: getPercentChartConfig(),
  }, {
    key: 'process_count',
    title: '进程数',
    summaryValue: formatCount(currentProcessCount),
    legendList: [],
    stats: [],
    ...processSeries,
    chartConfig: getCountChartConfig(),
  }, {
    key: 'net_speed',
    title: '上传 / 下载',
    summaryValue: '',
    legendList: [{
      key: 'net_in_speed',
      label: '上传',
      value: formatSpeedText(currentNetInSpeed),
      color: SERIES_COLORS.net_in_speed,
    }, {
      key: 'net_out_speed',
      label: '下载',
      value: formatSpeedText(currentNetOutSpeed),
      color: SERIES_COLORS.net_out_speed,
    }],
    stats: [],
    ...netSpeedSeries,
    chartConfig: getSpeedChartConfig(),
  }, {
    key: 'connections',
    title: 'TCP / UDP',
    summaryValue: '',
    legendList: [{
      key: 'tcp_conn',
      label: 'TCP',
      value: formatCount(currentTcpCount),
      color: SERIES_COLORS.tcp_conn,
    }, {
      key: 'udp_conn',
      label: 'UDP',
      value: formatCount(currentUdpCount),
      color: SERIES_COLORS.udp_conn,
    }],
    stats: [],
    ...connSeries,
    chartConfig: getCountChartConfig(),
  }];
});

const hasRenderableData = computed(() => historyCards.value.some((card) => card.hasData));
const isModuleVisible = computed(() => isSupported.value && hasRenderableData.value);

watch(availablePeriods, (options) => {
  if (options.some((item) => item.value === period.value)) {
    return;
  }
  period.value = options[0]?.value || '1d';
}, {
  immediate: true,
});

watch(period, (value) => {
  writeStoredPeriod(value);
});

watch(
  [serverId, period, isSupported],
  ([nextServerId, nextPeriod, supported]) => {
    clearLoadTimer();
    if (!supported || !nextServerId || !nextPeriod) {
      requestSerial += 1;
      metricHistory.value = createEmptyMetricMap();
      return;
    }
    loadMetrics();
  },
  { immediate: true },
);

onUnmounted(() => {
  clearLoadTimer();
});

function setPeriod(value) {
  if (value === period.value) {
    return;
  }
  period.value = value;
}

function readStoredPeriod() {
  if (typeof window === 'undefined') {
    return '1d';
  }
  const storedValue = window.localStorage.getItem(RESOURCE_HISTORY_PERIOD_KEY);
  return PERIOD_OPTIONS.some((item) => item.value === storedValue) ? storedValue : '1d';
}

function writeStoredPeriod(value) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(RESOURCE_HISTORY_PERIOD_KEY, value);
}

function clearLoadTimer() {
  if (loadMetricsTimer) {
    window.clearTimeout(loadMetricsTimer);
    loadMetricsTimer = null;
  }
}

function scheduleAutoRefresh() {
  clearLoadTimer();
  if (!isSupported.value || !serverId.value || period.value !== '1d') {
    return;
  }
  let refreshSeconds = parseInt(config.aobobo.monitorRefreshTime, 10);
  if (Number.isNaN(refreshSeconds)) {
    refreshSeconds = 30;
  }
  if (refreshSeconds <= 0) {
    return;
  }
  loadMetricsTimer = window.setTimeout(() => {
    loadMetrics();
  }, Math.max(refreshSeconds, 10) * 1000);
}

async function loadMetrics() {
  const currentServerId = serverId.value;
  if (!currentServerId) {
    metricHistory.value = createEmptyMetricMap();
    return;
  }

  const serial = requestSerial + 1;
  requestSerial = serial;

  try {
    const metricEntries = await Promise.all(METRIC_KEYS.map(async (metricKey) => {
      const history = await loadMetricHistory(currentServerId, metricKey, period.value);
      return [metricKey, normalizeMetricHistory(metricKey, history)];
    }));

    if (serial !== requestSerial) {
      return;
    }

    metricHistory.value = Object.fromEntries(metricEntries);
  } catch (error) {
    if (serial === requestSerial) {
      console.error('Failed to load resource history:', error);
    }
  } finally {
    if (serial === requestSerial) {
      scheduleAutoRefresh();
    }
  }
}

async function loadMetricHistory(id, metricKey, periodValue) {
  const baseUrl = config.aobobo.v1ApiMetricsPath.replace('{id}', id);
  const query = new URLSearchParams({
    metric: metricKey,
    period: periodValue,
  }).toString();
  const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${query}`;
  const res = await request({ url });
  const data = res?.data?.data || {};
  const dataPoints = data?.data_points || data?.dataPoints || data?.DataPoints;
  return Array.isArray(dataPoints) ? dataPoints : [];
}

function normalizeMetricHistory(metricKey, history) {
  return history
    .map((item) => normalizeMetricPoint(metricKey, item))
    .filter((item) => item && Number.isFinite(item.ts) && Number.isFinite(item.value))
    .sort((a, b) => a.ts - b.ts);
}

function normalizeMetricPoint(metricKey, point) {
  const ts = Number(point?.ts ?? point?.timestamp ?? point?.time);
  let value = Number(point?.value ?? point?.avg ?? point?.usage);
  if (!Number.isFinite(ts) || !Number.isFinite(value)) {
    return null;
  }

  switch (metricKey) {
    case 'memory':
      value = normalizeUsageValue(value, props.info?.Host?.MemTotal);
      break;
    case 'swap':
      value = normalizeUsageValue(value, props.info?.Host?.SwapTotal);
      break;
    case 'disk':
      value = normalizeUsageValue(value, props.info?.Host?.DiskTotal);
      break;
    default:
      break;
  }

  return Number.isFinite(value) ? { ts, value } : null;
}

function normalizeUsageValue(value, total) {
  if (!Number.isFinite(value)) {
    return null;
  }
  if (value <= 100) {
    return value;
  }
  return calcPercent(value, total);
}

function buildAlignedSeries(seriesDefs) {
  const timestampSet = new Set();
  const metricMaps = {};

  seriesDefs.forEach((seriesDef) => {
    const metricItems = metricHistory.value[seriesDef.metric] || [];
    metricMaps[seriesDef.metric] = new Map();
    metricItems.forEach((item) => {
      timestampSet.add(item.ts);
      metricMaps[seriesDef.metric].set(item.ts, item.value);
    });
  });

  const dateList = Array.from(timestampSet).sort((a, b) => a - b);
  const valueList = seriesDefs.map((seriesDef) => ({
    id: seriesDef.metric,
    name: seriesDef.name,
    data: dateList.map((timestamp) => [
      timestamp,
      metricMaps[seriesDef.metric].has(timestamp)
        ? metricMaps[seriesDef.metric].get(timestamp)
        : null,
    ]),
    itemStyle: {
      color: seriesDef.color,
    },
    lineStyle: {
      color: seriesDef.color,
    },
  }));

  const hasData = valueList.some((seriesItem) => seriesItem.data.some(([, value]) => value !== null));

  return {
    dateList,
    valueList,
    hasData,
  };
}

function latestMetricValue(metricKey) {
  const history = metricHistory.value[metricKey] || [];
  if (!history.length) {
    return null;
  }
  return history[history.length - 1]?.value ?? null;
}

function calcPercent(usedRaw, totalRaw) {
  const used = Number(usedRaw);
  const total = Number(totalRaw);
  if (!Number.isFinite(used) || !Number.isFinite(total) || total <= 0) {
    return null;
  }
  return Number(((used / total) * 100).toFixed(4));
}

function firstFinite(...values) {
  for (let index = 0; index < values.length; index += 1) {
    const value = Number(values[index]);
    if (Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function formatPercent(value) {
  return value == null ? '-' : `${formatCompactNumber(value)}%`;
}

function formatCount(value) {
  return value == null ? '-' : `${Math.round(Number(value))}`;
}

function formatCompactNumber(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return '-';
  }
  const absValue = Math.abs(numericValue);
  if (absValue >= 100 || Number.isInteger(numericValue)) {
    return `${Number(numericValue.toFixed(0))}`;
  }
  if (absValue >= 10) {
    return `${Number(numericValue.toFixed(1))}`;
  }
  return `${Number(numericValue.toFixed(2))}`;
}

function formatBinaryText(bytes, options = {}) {
  const parts = formatBinaryParts(bytes, options);
  if (parts.value === '-') {
    return '-';
  }
  return `${parts.value}${parts.unit}`;
}

function formatSpeedText(bytes) {
  if (bytes == null) {
    return '-';
  }
  return formatBinaryText(bytes, { perSecond: true });
}

function formatBinaryParts(bytes, options = {}) {
  const {
    perSecond = false,
  } = options;
  const numericBytes = Number(bytes);
  if (!Number.isFinite(numericBytes) || numericBytes < 0) {
    return {
      value: '-',
      unit: '',
    };
  }

  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
  let unitIndex = 0;
  let resultValue = numericBytes;

  while (resultValue >= 1024 && unitIndex < units.length - 1) {
    resultValue /= 1024;
    unitIndex += 1;
  }

  let digits;
  if (resultValue >= 100) {
    digits = 0;
  } else if (resultValue >= 10) {
    digits = 1;
  } else {
    digits = 2;
  }

  return {
    value: `${Number(resultValue.toFixed(digits))}`,
    unit: `${units[unitIndex]}${perSecond ? '/s' : ''}`,
  };
}

function getPercentChartConfig() {
  return {
    showDataZoom: false,
    grid: {
      top: 10,
      left: 2,
      right: 6,
      bottom: 20,
    },
    yAxis: {
      min: 0,
      max: 100,
      formatter: (value) => `${value}%`,
    },
    tooltip: {
      valueFormatter: (value) => formatPercent(value),
    },
    series: {
      lineWidth: 1.6,
      areaOpacity: 1,
      areaAlpha: 0.08,
    },
  };
}

function getCountChartConfig() {
  return {
    showDataZoom: false,
    grid: {
      top: 10,
      left: 2,
      right: 6,
      bottom: 20,
    },
    yAxis: {
      min: 0,
      formatter: (value) => `${Math.round(value)}`,
    },
    tooltip: {
      valueFormatter: (value) => formatCount(value),
    },
    series: {
      lineWidth: 1.6,
      areaOpacity: 1,
      areaAlpha: 0.08,
    },
  };
}

function getSpeedChartConfig() {
  return {
    showDataZoom: false,
    grid: {
      top: 10,
      left: 2,
      right: 6,
      bottom: 20,
    },
    yAxis: {
      min: 0,
      formatter: (value) => formatBinaryText(value, { perSecond: true }),
    },
    tooltip: {
      valueFormatter: (value) => formatSpeedText(value),
    },
    series: {
      lineWidth: 1.6,
      areaOpacity: 1,
      areaAlpha: 0.08,
    },
  };
}

function createEmptyMetricMap() {
  return Object.fromEntries(METRIC_KEYS.map((metricKey) => [metricKey, []]));
}
</script>

<style lang="scss" scoped>
.server-detail-resource-history {
  --resource-history-card-bg:
    linear-gradient(180deg, var(--panel-metric-bg), rgba(var(--accent-primary-rgb), 0.025)),
    var(--panel-metric-bg);

  padding: 16px 18px 18px;

  :deep(.line-box) {
    height: 100%;
    min-height: 0;
  }

  :deep(.chart) {
    border-radius: inherit;
  }
}

.module-head-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;

  .module-title {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 28px;
    line-height: 1.3;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: var(--text-primary);

    i {
      color: var(--accent-primary);
      font-size: 18px;
    }
  }

  .right-box {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    min-width: 0;
    margin-left: auto;
  }
}

.time-range-group {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  min-width: 0;

  .time-range-label {
    flex: 0 0 auto;
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 500;
  }

  .time-range-options {
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
    gap: 3px;
    padding: 3px;
    max-width: min(100%, 320px);
    background: var(--panel-chip-bg);
    border: 1px solid var(--panel-chip-border);
    border-radius: 999px;
    box-shadow: inset 0 1px 0 var(--surface-highlight);
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  .time-range-item {
    flex: 0 0 auto;
    min-width: 48px;
    height: 24px;
    line-height: 24px;
    padding: 0 10px;
    font-size: 11px;
    font-weight: 600;
    text-align: center;
    white-space: nowrap;
    cursor: pointer;
    color: var(--text-secondary);
    border-radius: 999px;
    border: 1px solid transparent;
    background: transparent;
    transition:
      color var(--transition-fast),
      background var(--transition-fast),
      border-color var(--transition-fast),
      box-shadow var(--transition-fast);

    &:hover:not(.active) {
      color: var(--text-primary);
      background: var(--bg-hover);
    }

    &.active {
      color: var(--text-on-accent);
      background: var(--button-active-bg);
      border-color: var(--button-active-border);
      box-shadow: 0 8px 18px rgba(var(--accent-primary-rgb), 0.18);
    }
  }
}

.history-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.history-card {
  display: grid;
  grid-template-rows: 56px 180px;
  gap: 10px;
  min-width: 0;
  padding: 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--panel-stat-border);
  background: var(--resource-history-card-bg);
  box-shadow: inset 0 1px 0 var(--surface-highlight);
}

.history-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.history-card__title {
  flex: 1 1 auto;
  margin: 0;
  min-width: 0;
  font-size: 17px;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-primary);
}

.history-card__meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex: 0 1 auto;
  max-width: 60%;
  min-width: 0;
}

.history-card__summary {
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 17px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-card__legend-group {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px 10px;
}

.history-card__legend-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.3;
}

.history-card__legend-dot {
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--legend-color);
  box-shadow: 0 0 0 3px var(--surface-subtle);
}

.history-card__legend-label {
  color: var(--text-secondary);
}

.history-card__legend-value {
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.history-card__stats {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 4px 10px;
  color: var(--text-secondary);
  font-size: 11px;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  line-height: 1.3;
}

.history-card__stat-item {
  min-width: 0;
}

.history-card__chart-shell {
  display: flex;
  align-items: stretch;
  height: 180px;
  min-height: 0;
  border-radius: 12px;
  border: 1px solid var(--panel-stat-border);
  background: rgba(255, 255, 255, 0.016);
  overflow: hidden;
}

.history-card__empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  color: var(--text-muted);
  font-size: 12px;
  text-align: center;
}

@media screen and (max-width: 768px) {
  .server-detail-resource-history {
    padding: 12px 14px;
  }

  .module-head-group {
    .right-box {
      width: 100%;
      margin-left: 0;
      justify-content: flex-start;
    }
  }

  .time-range-group {
    width: 100%;

    .time-range-options {
      flex: 1;
      max-width: 100%;
    }
  }

  .history-grid {
    gap: 8px;
    grid-template-columns: 1fr;
  }

  .history-card {
    grid-template-rows: 50px 140px;
    padding: 10px;
    gap: 8px;
  }

  .history-card__head {
    gap: 8px;
  }

  .history-card__title,
  .history-card__summary {
    font-size: 14px;
  }

  .history-card__meta {
    gap: 2px;
  }

  .history-card__chart-shell {
    height: 140px;
    min-height: 0;
  }
}
</style>
