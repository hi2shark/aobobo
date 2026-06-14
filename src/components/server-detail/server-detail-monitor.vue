<template>
  <detail-panel
    v-if="monitorData.length"
    variant="flat"
    class="server-detail-monitor"
    :class="{
      'chart-type--multi': config.nazhua.monitorChartTypeToggle && monitorChartType === 'multi',
      'chart-type--single': config.nazhua.monitorChartTypeToggle && monitorChartType === 'single',
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
          v-if="config.nazhua.monitorChartTypeToggle"
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
  if (!userLogin.value || !hasTsdb(store)) {
    return baseMinutes;
  }
  return [
    ...baseMinutes,
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
const localData = {
  peakShaving: window.localStorage.getItem('aobobo_monitor_peak_shaving'),
  refreshData: window.localStorage.getItem('aobobo_monitor_refresh_data'),
  chartType: window.localStorage.getItem('aobobo_monitor_chart_type'),
};
localData.peakShaving = validate.isSet(localData.peakShaving) ? localData.peakShaving === 'true' : false;
localData.refreshData = validate.isSet(localData.refreshData) ? localData.refreshData === 'true' : true;

const peakShaving = ref(localData.peakShaving);
const refreshData = ref(localData.refreshData);
const showCates = ref({});
const monitorData = ref([]);
const longPressTimer = ref(null);

const chartType = validate.isSet(localData.chartType)
  ? ref(localData.chartType)
  : ref(config.nazhua.monitorChartType === 'single' ? 'single' : 'multi');
const monitorChartType = computed(() => {
  if (config.nazhua.monitorChartTypeToggle) {
    return chartType.value;
  }
  return config.nazhua.monitorChartType;
});

const nowServerTime = computed(() => store.state.serverTime || Date.now());
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

    const isPeriodRange = minute.value === 10080 || minute.value === 43200;

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
  if (config.nazhua.nezhaVersion === 'v1') {
    if (hasTsdb(store)) {
      url = config.nazhua.v1ApiMonitorPath.replace('{id}', props.info.ID);
      if (isTsdbEnabled(store)) {
        const period = getTsdbPeriod();
        url += url.includes('?') ? `&period=${period}` : `?period=${period}`;
      }
    } else {
      url = config.nazhua.v1ApiMonitorPathFallback.replace('{id}', props.info.ID);
    }
  } else {
    url = config.nazhua.apiMonitorPath.replace('{id}', props.info.ID);
  }
  try {
    const res = await request({ url });
    const list = config.nazhua.nezhaVersion === 'v1' ? res?.data?.data : res?.data?.result;
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
  }
  if (refreshData.value || force) {
    await loadMonitor();
  }
  let monitorRefreshTime = parseInt(config.nazhua.monitorRefreshTime, 10);
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
  --line-chart-size: 300px;
  padding: 14px 18px;

  &.chart-type--single {
    --line-chart-size: 240px;
  }

  .monitor-cate-item {
    --cate-item-height: 28px;
    --cate-item-font-size: 13px;
    --cate-color: var(--text-primary);

    display: flex;
    align-items: center;
    gap: 6px;
    height: var(--cate-item-height);
    padding: 0 10px;
    font-size: var(--cate-item-font-size);
    border-radius: 999px;
    cursor: pointer;
    background: var(--panel-chip-bg);
    border: 1px solid var(--panel-chip-border);
    transition:
      background var(--transition-fast),
      border-color var(--transition-fast);

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
      border-radius: 50%;
      background: var(--cate-color);
    }

    .cate-name {
      line-height: var(--cate-item-height);
      color: var(--text-primary);
      font-weight: 500;
    }

    .cate-avg-ms {
      line-height: var(--cate-item-height);
      color: var(--text-secondary);
      font-family: var(--font-mono);
      font-size: 12px;
    }

    .cate-over-rate {
      line-height: var(--cate-item-height);
      color: var(--accent-warning);
      font-family: var(--font-mono);
      font-size: 12px;
    }

    &.disabled {
      filter: grayscale(1) brightness(0.8);
      opacity: 0.5;
    }
  }
}

.module-head-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;

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
    gap: 14px;
  }

  .control-switch {
    display: flex;
    align-items: center;
    gap: 5px;
    cursor: pointer;

    @media screen and (max-width: 1024px) {
      cursor: default;
    }

    .switch-box {
      position: relative;
      width: 32px;
      height: 18px;
      background: var(--progress-track);
      border-radius: 999px;
      transition: background-color 0.3s;

      .switch-dot {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 14px;
        height: 14px;
        background: var(--text-on-accent);
        border-radius: 50%;
        transition: left 0.3s;
      }

      &.active {
        background-color: var(--accent-success);

        .switch-dot {
          left: 16px;
          box-shadow: 1px 1px 2px rgba(0, 0, 0, 0.25);
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
      background: var(--panel-search-bg);
      border: 1px solid var(--panel-search-border);
      border-radius: 999px;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;

      &::-webkit-scrollbar {
        display: none;
      }

      .time-range-item {
        flex: 0 0 auto;
        min-width: 40px;
        height: 24px;
        line-height: 24px;
        padding: 0 6px;
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
          box-shadow: var(--button-active-shadow);
        }
      }
    }
  }
}

.monitor-cate-group {
  margin: 10px 0 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.monitor-chart-group {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 0;

  .monitor-chart-item {
    width: 50%;
    height: calc(var(--line-chart-size) + 28px);
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
  }

  &.monitor-chart-len--1 {
    .monitor-chart-item {
      width: 100%;
    }
  }
}

@media screen and (max-width: 768px) {
  .server-detail-monitor {
    padding: 12px 14px;
  }

  .module-head-group {
    .right-box {
      width: 100%;
      justify-content: flex-start;
    }
  }

  .time-range-group .time-range-options .time-range-item {
    min-width: 40px;
    padding: 0 8px;
  }
}
</style>
