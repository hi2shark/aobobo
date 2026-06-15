<template>
  <div class="current-time-widget" :style="widgetStyle" aria-label="当前时间">
    <div class="current-time-content">
      <div class="current-time__header">
        <div class="current-time__eyebrow">
          <span class="current-time__indicator" />
          <span>当前时间</span>
        </div>
        <span class="current-time__header-meta">LOCAL TIME</span>
      </div>
      <div class="current-time__main">
        <div class="current-time__clock">
          {{ currentHourMinute }}
        </div>
        <div class="current-time__seconds-block">
          <span class="current-time__seconds-label">SEC</span>
          <span class="current-time__seconds-value">{{ currentSecond }}</span>
        </div>
      </div>
      <div class="current-time__divider" aria-hidden="true" />
      <div class="current-time__meta">
        <div class="current-time__meta-item">
          <span class="current-time__meta-label">DATE</span>
          <span class="current-time__meta-value">{{ currentDate }}</span>
        </div>
        <div class="current-time__meta-item current-time__meta-item--align-end">
          <span class="current-time__meta-label">WEEK</span>
          <span class="current-time__meta-value">{{ currentWeekday }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  computed,
  ref,
  onMounted,
  onUnmounted,
} from 'vue';
import dayjs from 'dayjs';

const props = defineProps({
  panelWidth: {
    type: [Number, String],
    default: undefined,
  },
});

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const currentHourMinute = ref('--:--');
const currentSecond = ref('--');
const currentDate = ref('----/--/--');
const currentWeekday = ref('--');

let timer = null;

const widgetStyle = computed(() => {
  if (props.panelWidth === undefined || props.panelWidth === null || props.panelWidth === '') {
    return {};
  }

  const width = typeof props.panelWidth === 'number'
    ? `${props.panelWidth}px`
    : String(props.panelWidth);

  return {
    '--current-time-panel-width': width,
  };
});

function updateTime() {
  const now = new Date();
  currentHourMinute.value = dayjs(now).format('HH:mm');
  currentSecond.value = dayjs(now).format('ss');
  currentDate.value = dayjs(now).format('YYYY.MM.DD');
  currentWeekday.value = WEEKDAYS[now.getDay()];
}

onMounted(() => {
  updateTime();
  timer = window.setInterval(updateTime, 1000);
});

onUnmounted(() => {
  if (timer) {
    window.clearInterval(timer);
    timer = null;
  }
});
</script>

<style lang="scss" scoped>
.current-time-widget {
  position: absolute;
  top: 18px;
  left: 18px;
  z-index: 10;
  width: var(--current-time-panel-width, auto);
  max-width: calc(100vw - 36px);
  display: inline-flex;
  align-items: stretch;
  padding: 14px 16px 15px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  background: var(--panel-floating-bg);
  backdrop-filter: blur(18px) saturate(150%);
  box-shadow:
    var(--shadow-md),
    inset 0 1px 0 var(--surface-highlight);
  color: var(--text-secondary);
  pointer-events: none;
  user-select: none;
  overflow: hidden;
}

.current-time-widget::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.16), transparent 46%),
    radial-gradient(circle at 0% 0%, rgba(var(--accent-cyan-rgb), 0.14), transparent 34%);
  pointer-events: none;
}

.current-time-widget::after {
  content: '';
  position: absolute;
  inset: 10px 14px auto;
  height: 1px;
  background: linear-gradient(90deg, rgba(var(--accent-primary-rgb), 0.28), transparent 82%);
  pointer-events: none;
}

.current-time-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  line-height: 1.2;
}

.current-time__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.current-time__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--text-secondary);
}

.current-time__indicator {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--accent-primary);
  box-shadow: 0 0 0 4px rgba(var(--accent-primary-rgb), 0.12);
  flex: 0 0 auto;
}

.current-time__header-meta,
.current-time__seconds-label,
.current-time__meta-label {
  font-size: 10px;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.16em;
  color: var(--text-muted);
}

.current-time__header-meta {
  white-space: nowrap;
}

.current-time__main {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.current-time__clock {
  flex: 1;
  min-width: 0;
  font-size: 34px;
  font-weight: 700;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
  line-height: 0.92;
  letter-spacing: -0.04em;
}

.current-time__seconds-block {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: flex-end;
  gap: 4px;
  min-width: 64px;
  padding: 9px 10px 8px;
  border-radius: 14px;
  border: 1px solid rgba(var(--accent-primary-rgb), 0.14);
  background: rgba(var(--accent-primary-rgb), 0.08);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.58);
}

.current-time__seconds-value {
  font-size: 22px;
  line-height: 1;
  font-weight: 700;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  color: var(--accent-primary);
}

.current-time__divider {
  height: 1px;
  background: linear-gradient(90deg, rgba(var(--accent-primary-rgb), 0.24), rgba(154, 169, 191, 0.12));
}

.current-time__meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.current-time__meta-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.current-time__meta-item--align-end {
  align-items: flex-end;
  text-align: right;
}

.current-time__meta-value {
  font-size: 13px;
  font-weight: 600;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media screen and (max-width: 1023px) {
  .current-time-widget {
    top: 68px;
    left: 14px;
    max-width: calc(100vw - 28px);
    padding: 13px 14px 14px;
  }

  .current-time__clock {
    font-size: 30px;
  }

  .current-time__seconds-block {
    min-width: 56px;
    padding: 8px 9px 7px;
  }

  .current-time__seconds-value {
    font-size: 20px;
  }

  .current-time__meta-value {
    font-size: 12px;
  }
}

@media screen and (max-width: 420px) {
  .current-time-widget {
    top: 64px;
    left: 12px;
    max-width: calc(100vw - 24px);
    padding: 11px 12px 12px;
  }

  .current-time-content {
    gap: 10px;
  }

  .current-time__header {
    gap: 8px;
  }

  .current-time__header-meta {
    display: none;
  }

  .current-time__clock {
    font-size: 26px;
  }

  .current-time__seconds-block {
    min-width: 50px;
    gap: 3px;
    padding: 7px 8px 6px;
  }

  .current-time__seconds-value {
    font-size: 18px;
  }

  .current-time__meta {
    gap: 8px;
  }

  .current-time__meta-value {
    font-size: 11px;
  }

  .current-time__eyebrow,
  .current-time__seconds-label,
  .current-time__meta-label {
    font-size: 9px;
  }
}
</style>
