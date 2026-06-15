<template>
  <div
    v-if="option"
    class="line-box"
    :style="boxStyle"
  >
    <v-chart
      ref="chartRef"
      class="chart"
      :option="option"
    />
  </div>
</template>

<script setup>
/**
 * 折线图
 */
import {
  ref,
  computed,
  onMounted,
  onUnmounted,
} from 'vue';
import VChart from 'vue-echarts';
import lineChart from './line';

const props = defineProps({
  dateList: {
    type: Array,
    default: () => [],
  },
  valueList: {
    type: Array,
    default: () => [],
  },
  size: {
    type: [Number, String],
    default: null,
  },
  connectNulls: {
    type: [Boolean, String],
    default: true,
  },
  mode: {
    type: String,
    default: 'dark',
  },
});

function getCssVar(name, fallback = '') {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name).trim();
  return value || fallback;
}

const themeColors = computed(() => {
  const isDark = props.mode === 'dark';
  return {
    textPrimary: getCssVar('--text-primary', isDark ? '#f4f8ff' : '#1c2840'),
    textSecondary: getCssVar('--text-secondary', isDark ? '#a2b0c5' : '#5a6b84'),
    textMuted: getCssVar('--text-muted', isDark ? '#6f7c92' : '#8290a5'),
    borderColor: getCssVar(
      '--border-color',
      isDark ? 'rgba(146,169,204,0.18)' : 'rgba(154,169,191,0.28)',
    ),
    accentPrimary: getCssVar('--accent-primary', isDark ? '#4e90ff' : '#4383ff'),
    panelBg: getCssVar(
      '--panel-metric-bg',
      isDark ? 'rgba(255,255,255,0.028)' : 'rgba(245,249,255,0.92)',
    ),
    surfaceSubtle: getCssVar(
      '--surface-subtle',
      isDark ? 'rgba(255,255,255,0.03)' : 'rgba(154,169,191,0.08)',
    ),
    progressTrack: getCssVar(
      '--progress-track',
      isDark ? 'rgba(154,170,190,0.16)' : 'rgba(161,177,202,0.18)',
    ),
  };
});

const chartRef = ref();
const option = computed(() => {
  if (props.dateList && props.valueList) {
    return lineChart({
      dateList: props.dateList,
      valueList: props.valueList,
      connectNulls: props.connectNulls,
      mode: props.mode,
      themeColors: themeColors.value,
    });
  }
  return null;
});
const boxStyle = computed(() => {
  const style = {};
  if (props.size > 0) {
    style.height = `${props.size}px`;
  }
  return style;
});

function handleResize() {
  chartRef.value?.resize?.();
}

onMounted(() => {
  handleResize();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});
</script>

<style lang="scss" scoped>
.line-box {
  width: 100%;
  height: var(--line-chart-size, 300px);
  min-height: 220px;
}

.chart {
  width: 100%;
  height: 100%;
}
</style>
