<template>
  <detail-panel
    v-if="monitorData.length"
    variant="flat"
    class="server-detail-monitor"
    :class="{
      'chart-type--multi': config.aobobo.monitorChartTypeToggle && monitorChartType === 'multi',
      'chart-type--single': config.aobobo.monitorChartTypeToggle && monitorChartType === 'single',
    }"
  >
    <div class="module-head-group">
      <div class="left-box">
        <span class="module-title">
          <i class="ri-pulse-line" />
          网络监控
        </span>
      </div>
      <div class="right-box">
        <div
          v-if="config.aobobo.monitorChartTypeToggle"
          class="control-switch"
          title="监控折线图是否聚合"
          @click="switchChartType"
        >
          <span class="label-text">聚合</span>
          <div
            class="switch-box"
            :class="{ active: monitorChartType === 'multi' }"
          >
            <span class="switch-dot" />
          </div>
        </div>
        <div
          class="control-switch"
          title="是否自动刷新"
          @click="switchRefresh"
        >
          <span class="label-text">刷新</span>
          <div
            class="switch-box"
            :class="{ active: refreshData }"
          >
            <span class="switch-dot" />
          </div>
        </div>
        <div
          class="control-switch"
          title="过滤太高或太低的数据"
          @click="switchPeakShaving"
        >
          <span class="label-text">削峰</span>
          <div
            class="switch-box"
            :class="{ active: peakShaving }"
          >
            <span class="switch-dot" />
          </div>
        </div>
        <div class="time-range-group">
          <span class="time-range-label">最近</span>
          <div class="time-range-options">
            <div
              v-for="minuteItem in minutes"
              :key="minuteItem.value"
              class="time-range-item"
              :class="{ active: minuteItem.value === minute }"
              @click="toggleMinute(minuteItem.value)"
            >
              <span>{{ minuteItem.label }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template v-if="monitorChartType === 'single'">
      <div
        class="monitor-chart-group"
        :class="'monitor-chart-len--' + monitorChartData.cateList.length"
      >
        <div
          v-for="(cateItem, index) in monitorChartData.cateList"
          :key="cateItem.id"
          class="monitor-chart-item"
        >
          <div class="cate-name-box">
            <div
              class="monitor-cate-item"
              :class="{ disabled: showCates[cateItem.id] === false }"
              :style="{ '--cate-color': cateItem.color }"
              :title="cateItem.title"
            >
              <span class="cate-legend" />
              <span class="cate-name">{{ cateItem.name }}</span>
              <span
                v-if="cateItem.avg !== 0"
                class="cate-avg-ms"
              >
                {{ cateItem.avg }}ms
              </span>
              <span
                v-if="cateItem.over !== 0"
                class="cate-over-rate"
              >
                {{ cateItem.over }}%
              </span>
            </div>
          </div>
          <line-chart
            :date-list="monitorChartData.dateList"
            :value-list="[monitorChartData.valueList[index]]"
            :size="240"
            :connect-nulls="false"
            :mode="chartMode"
          />
        </div>
      </div>
    </template>
    <template v-else>
      <div class="monitor-cate-group">
        <div
          v-for="cateItem in monitorChartData.cateList"
          :key="cateItem.id"
          class="monitor-cate-item"
          :class="{ disabled: showCates[cateItem.id] === false }"
          :style="{ '--cate-color': cateItem.color }"
          :title="cateItem.title"
          @click="toggleShowCate(cateItem.id)"
          @touchstart="handleTouchStart(cateItem.id)"
          @touchend="handleTouchEnd(cateItem.id)"
          @touchmove="handleTouchMove(cateItem.id)"
        >
          <span class="cate-legend" />
          <span class="cate-name">{{ cateItem.name }}</span>
          <span
            v-if="cateItem.avg !== 0"
            class="cate-avg-ms"
          >
            {{ cateItem.avg }}ms
          </span>
        </div>
      </div>

      <line-chart
        :date-list="monitorChartData.dateList"
        :value-list="monitorChartData.valueList"
        :connect-nulls="false"
        :mode="chartMode"
      />
    </template>
  </detail-panel>
</template>

<script setup>
/**
 * 服务器监控
 */
import {
  ref,
  computed,
  watch,
  onMounted,
  onUnmounted,
} from 'vue';
import { useStore } from 'vuex';
import config from '@/config';
import request from '@/utils/request';
import validate from '@/utils/validate';
import { isTsdbEnabled, hasTsdb } from '@/utils/tsdb';
import LineChart from '@/components/charts/line.vue';
import DetailPanel from '@/components/server-detail/detail-panel.vue';
import {
  getThreshold,
  getLineColor,
} from '@/composables/server-monitor';

const props = defineProps({
  info: {
    type: Object,
    default: () => ({}),
  },
});

const store = useStore();

const userLogin = computed(() => store.state.profile?.username);
const chartMode = computed(() => store.state.resolvedTheme || 'dark');
const isV1 = computed(() => config.aobobo.nezhaVersion === 'v1');
const canUseLongPeriods = computed(() => !!userLogin.value && hasTsdb(store));

const minute = ref(1440);
const baseMinutes = [{
  label: '30分钟',
  value: 30,
}, {
  label: '1小时',
  value: 60,
}, {
  label: '3小时',
  value: 180,
}, {
  label: '6小时',
  value: 360,
}, {
  label: '12小时',
  value: 720,
}, {
  label: '24小时',
  value: 1440,
}];
const minutes = computed(() => {
  const visibleBaseMinutes = canUseLongPeriods.value
    ? baseMinutes.filter((item) => item.value !== 180 && item.value !== 360)
    : baseMinutes;
  if (!canUseLongPeriods.value) {
    return visibleBaseMinutes;
  }
  return [
    ...visibleBaseMinutes,
    {
      label: '7天',
      value: 10080,
    },
    {
      label: '30天',
      value: 43200,
    },
  ];
});

watch(minutes, (options) => {
  if (options.some((item) => item.value === minute.value)) {
    return;
  }
  minute.value = options[options.length - 1]?.value || 1440;
}, {
  immediate: true,
});
const localData = {
  peakShaving: window.localStorage.getItem('aobobo_monitor_peak_shaving'),
  refreshData: window.localStorage.getItem('aobobo_monitor_refresh_data'),
  chartType: window.localStorage.getItem('aobobo_monitor_chart_type'),
};
localData.peakShaving = validate.isSet(localData.peakShaving)
  ? localData.peakShaving === 'true'
  : false;
localData.refreshData = validate.isSet(localData.refreshData)
  ? localData.refreshData === 'true'
  : true;

const peakShaving = ref(localData.peakShaving);
const refreshData = ref(localData.refreshData);
const showCates = ref({});
const monitorData = ref([]);
const longPressTimer = ref(null);

const chartType = validate.isSet(localData.chartType)
  ? ref(localData.chartType)
  : ref(config.aobobo.monitorChartType === 'single' ? 'single' : 'multi');
const monitorChartType = computed(() => {
  if (config.aobobo.monitorChartTypeToggle) {
    return chartType.value;
  }
  return config.aobobo.monitorChartType;
});

const nowServerTime = computed(() => store.state.serverTime || Date.now());
const isLongPeriod = computed(() => minute.value === 10080 || minute.value === 43200);
const acceptShowTime = computed(() => {
  const minuteFloor = Math.floor(nowServerTime.value / 60000);
  return (minuteFloor - minute.value) * 60000;
});

const monitorChartData = computed(() => {
  const cateList = [];
  const cateMap = {};
  const dateSet = new Set();
  let valueList = [];
  monitorData.value.forEach((i) => {
    const dateMap = new Map();
    const {
      monitor_name: monitorName,
      monitor_id: monitorId,
      created_at: createdAt,
      avg_delay: avgDelayList,
    } = i;
    if (!cateMap[monitorName]) {
      cateMap[monitorName] = {
        id: monitorId,
      };
    }
    const cateDelayMap = new Map();
    const cateAcceptTimeMap = new Map();
    const cateCreateTime = new Set();

    const isPeriodRange = isLongPeriod.value;

    let earliestTimestamp = nowServerTime.value;
    createdAt.forEach((time, index) => {
      if (time < earliestTimestamp) {
        earliestTimestamp = time;
      }
      const status = isPeriodRange || time >= acceptShowTime.value;

      if (status) {
        cateAcceptTimeMap.set(time, avgDelayList[index]);
      }
    });

    const actualStartTime = isPeriodRange
      ? earliestTimestamp
      : Math.max(acceptShowTime.value, earliestTimestamp);

    const allMintues = Math.floor((Date.now() - actualStartTime) / 60000);

    for (let j = 0; j < allMintues; j += 1) {
      const time = actualStartTime + j * 60000;
      cateCreateTime.add(time);
      const timeProp = cateAcceptTimeMap.get(time);
      cateDelayMap.set(time, timeProp ?? undefined);
    }

    const {
      median,
      tolerancePercent,
    } = peakShaving.value ? getThreshold(Array.from(cateDelayMap.values())) : {};

    cateCreateTime.values().forEach((time) => {
      const avgDelay = cateDelayMap.get(time) * 1;

      if (peakShaving.value) {
        const threshold = median * tolerancePercent;
        if (Math.abs(avgDelay - median) > threshold) {
          dateMap.set(time, null);
          return;
        }
      }
      if (Number.isNaN(avgDelay)) {
        dateMap.set(time, undefined);
      } else {
        dateMap.set(time, (avgDelay).toFixed(2) * 1);
      }
    });

    const lineData = [];
    const validatedData = [];
    const overValidatedData = [];
    let delayTotal = 0;
    dateMap.forEach((val, key) => {
      const time = parseInt(key, 10);
      lineData.push([time, val || null]);
      if (val) {
        dateSet.add(time);
        validatedData.push([time, val]);
        delayTotal += val;
      }
      if (val !== undefined) {
        overValidatedData.push([time, val]);
      }
    });

    const id = monitorId;
    const avgDelay = delayTotal / validatedData.length || 0;

    if (lineData && lineData.length) {
      if (!validate.hasOwn(showCates.value, id)) {
        showCates.value[id] = true;
      }
      const color = getLineColor(id);
      const over = overValidatedData.length > 0 ? overValidatedData.length / lineData.length : 0;
      const validRate = 1 - ((validatedData.length > 0 && overValidatedData.length > 0)
        ? validatedData.length / overValidatedData.length : 0);
      const cateItem = {
        id,
        name: monitorName,
        color,
        avg: avgDelay.toFixed(2) * 1,
        over: (over * 100).toFixed(2) * 1,
        validRate: (validRate * 100).toFixed(2) * 1,
      };
      const titles = [
        cateItem.name,
        cateItem.avg === 0 ? '' : `平均延迟：${cateItem.avg}ms`,
        `成功率：${cateItem.over}%`,
      ];
      if (peakShaving.value) {
        titles.push(`削峰率: ${cateItem.validRate}%`);
      }
      cateItem.title = titles.filter((s) => s).join('\n');
      cateList.push(cateItem);
      valueList.push({
        id,
        name: monitorName,
        data: lineData,
        itemStyle: {
          color,
        },
        lineStyle: {
          color,
        },
      });
    }
  });

  const dateList = Array.from(dateSet).sort((a, b) => a - b);
  valueList = valueList.filter((i) => showCates.value[i.id]);

  return {
    dateList,
    cateList,
    valueList,
  };
});

function switchPeakShaving() {
  peakShaving.value = !peakShaving.value;
  window.localStorage.setItem('aobobo_monitor_peak_shaving', peakShaving.value);
}

function switchRefresh() {
  refreshData.value = !refreshData.value;
  window.localStorage.setItem('aobobo_monitor_refresh_data', refreshData.value);
}

function switchChartType() {
  chartType.value = chartType.value === 'single' ? 'multi' : 'single';
  window.localStorage.setItem('aobobo_monitor_chart_type', chartType.value);
}

function getTsdbPeriod() {
  if (minute.value === 10080) return '7d';
  if (minute.value === 43200) return '30d';
  return '1d';
}

async function loadMonitor() {
  let url;
  if (isV1.value) {
    if (hasTsdb(store)) {
      url = config.aobobo.v1ApiMonitorPath.replace('{id}', props.info.ID);
      if (isTsdbEnabled(store)) {
        const period = getTsdbPeriod();
        url += url.includes('?') ? `&period=${period}` : `?period=${period}`;
      }
    } else {
      url = config.aobobo.v1ApiMonitorPathFallback.replace('{id}', props.info.ID);
    }
  } else {
    url = config.aobobo.apiMonitorPath.replace('{id}', props.info.ID);
  }
  try {
    const res = await request({ url });
    const list = isV1.value ? res?.data?.data : res?.data?.result;
    if (Array.isArray(list)) {
      monitorData.value = list;
    }
  } catch (err) {
    console.error(err);
  }
}

async function toggleMinute(value) {
  minute.value = value;
  if (value === 10080 || value === 43200) {
    await loadMonitor();
  }
}

function toggleShowCate(id) {
  if (window.innerWidth < 768) {
    return;
  }
  showCates.value[id] = !showCates.value[id];
}

function handleTouchStart(id) {
  longPressTimer.value = setTimeout(() => {
    showCates.value[id] = !showCates.value[id];
  }, 500);
}

function handleTouchEnd() {
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value);
    longPressTimer.value = null;
  }
}

function handleTouchMove() {
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value);
    longPressTimer.value = null;
  }
}

let loadMonitorTimer = null;
async function setTimeLoadMonitor(force = false) {
  if (loadMonitorTimer) {
    clearTimeout(loadMonitorTimer);
    loadMonitorTimer = null;
  }

  const canAutoRefresh = !isLongPeriod.value;

  if (refreshData.value || force) {
    await loadMonitor();
  }

  if (!canAutoRefresh) {
    return;
  }

  let monitorRefreshTime = parseInt(config.aobobo.monitorRefreshTime, 10);
  if (monitorRefreshTime === 0) {
    return;
  }
  if (Number.isNaN(monitorRefreshTime)) {
    monitorRefreshTime = 30;
  }
  const sTime = Math.max(monitorRefreshTime, 10);
  loadMonitorTimer = setTimeout(() => {
    setTimeLoadMonitor();
  }, sTime * 1000);
}

onMounted(() => {
  setTimeLoadMonitor(true);
});

onUnmounted(() => {
  if (loadMonitorTimer) {
    clearTimeout(loadMonitorTimer);
  }
});
</script>

<style lang="scss" scoped>
.server-detail-monitor {
  --line-chart-size: 306px;
  --monitor-chart-stage-bg:
    linear-gradient(180deg, var(--panel-metric-bg), rgba(var(--accent-primary-rgb), 0.025)),
    var(--panel-metric-bg);

  padding: 16px 18px 18px;

  &.chart-type--single {
    --line-chart-size: 236px;
  }

  :deep(.line-box) {
    overflow: hidden;
    padding: 8px 10px 2px;
    border: 1px solid var(--panel-stat-border);
    border-radius: var(--radius-md);
    background: var(--monitor-chart-stage-bg);
    box-shadow: inset 0 1px 0 var(--surface-highlight);
    transition:
      background var(--transition-fast),
      border-color var(--transition-fast);
  }

  .monitor-cate-item {
    --cate-item-height: 30px;
    --cate-item-font-size: 12px;
    --cate-color: var(--text-primary);

    display: flex;
    align-items: center;
    gap: 6px;
    height: var(--cate-item-height);
    max-width: 100%;
    padding: 0 11px;
    font-size: var(--cate-item-font-size);
    line-height: 1;
    border-radius: 999px;
    cursor: pointer;
    background: var(--panel-chip-bg);
    border: 1px solid var(--panel-chip-border);
    box-shadow: inset 0 1px 0 var(--surface-highlight);
    transition:
      background var(--transition-fast),
      border-color var(--transition-fast),
      opacity var(--transition-fast);

    @media screen and (max-width: 768px) {
      cursor: default;
    }

    &:hover:not(.disabled) {
      background: var(--bg-hover);
      border-color: var(--border-strong);
    }

    .cate-legend {
      width: 7px;
      height: 7px;
      flex: 0 0 auto;
      border-radius: 50%;
      background: var(--cate-color);
      box-shadow: 0 0 0 3px var(--surface-subtle);
    }

    .cate-name {
      min-width: 0;
      line-height: var(--cate-item-height);
      color: var(--text-primary);
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .cate-avg-ms {
      line-height: var(--cate-item-height);
      color: var(--text-secondary);
      font-family: var(--font-mono);
      font-size: 12px;
      font-variant-numeric: tabular-nums;
    }

    .cate-over-rate {
      line-height: var(--cate-item-height);
      color: var(--accent-warning);
      font-family: var(--font-mono);
      font-size: 12px;
      font-variant-numeric: tabular-nums;
    }

    &.disabled {
      filter: grayscale(0.85);
      opacity: 0.46;
    }
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
    font-family: var(--font-sans);
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
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    min-width: 0;
  }

  .control-switch {
    display: flex;
    align-items: center;
    gap: 7px;
    min-height: 30px;
    padding: 0 9px;
    border: 1px solid var(--panel-chip-border);
    border-radius: 999px;
    background: var(--panel-chip-bg);
    box-shadow: inset 0 1px 0 var(--surface-highlight);
    cursor: pointer;
    transition:
      background var(--transition-fast),
      border-color var(--transition-fast);

    @media screen and (max-width: 1024px) {
      cursor: default;
    }

    &:hover {
      background: var(--bg-hover);
      border-color: var(--button-subtle-hover-border);
    }

    .switch-box {
      position: relative;
      width: 30px;
      height: 16px;
      background: var(--progress-track);
      border: 1px solid var(--panel-stat-border);
      border-radius: 999px;
      transition:
        background-color var(--transition-fast),
        border-color var(--transition-fast);

      .switch-dot {
        position: absolute;
        top: 1px;
        left: 2px;
        width: 12px;
        height: 12px;
        background: var(--text-on-accent);
        border-radius: 50%;
        box-shadow: 0 2px 5px rgba(2, 7, 19, 0.24);
        transition: left var(--transition-fast);
      }

      &.active {
        background-color: rgba(var(--accent-success-rgb), 0.86);
        border-color: rgba(var(--accent-success-rgb), 0.26);

        .switch-dot {
          left: 16px;
        }
      }
    }

    .label-text {
      color: var(--text-secondary);
      font-size: 12px;
      font-weight: 500;
    }
  }

  .time-range-group {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 30px;
    min-width: 0;
    padding-left: 4px;

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
      max-width: min(100%, 520px);
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

      .time-range-item {
        flex: 0 0 auto;
        min-width: 42px;
        height: 24px;
        line-height: 24px;
        padding: 0 8px;
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
  }
}

.monitor-cate-group {
  margin: 8px 0 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.monitor-chart-group {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;

  .monitor-chart-item {
    width: calc((100% - 12px) / 2);
    min-width: 0;
  }

  @media screen and (max-width: 768px) {
    .monitor-chart-item {
      width: 100%;
    }
  }

  .cate-name-box {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    margin-bottom: 8px;
  }

  &.monitor-chart-len--1 {
    .monitor-chart-item {
      width: 100%;
    }
  }
}

@media screen and (max-width: 768px) {
  .server-detail-monitor {
    --line-chart-size: 260px;
    padding: 12px 14px;

    &.chart-type--single {
      --line-chart-size: 230px;
    }

    :deep(.line-box) {
      padding: 6px 6px 0;
      border-radius: 12px;
    }
  }

  .module-head-group {
    .right-box {
      width: 100%;
      justify-content: flex-start;
      gap: 7px;
    }
  }

  .module-head-group .control-switch {
    min-height: 28px;
    padding: 0 8px;
  }

  .module-head-group .time-range-group {
    width: 100%;
    padding-left: 0;
  }

  .module-head-group .time-range-group .time-range-options {
    flex: 1;
  }

  .time-range-group .time-range-options .time-range-item {
    min-width: 40px;
    padding: 0 8px;
  }
}
</style>
