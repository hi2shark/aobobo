<template>
  <div class="current-time-widget" :style="widgetStyle" aria-label="当前时间">
    <div class="current-time-content">
      <div class="current-time__header">
        <div class="current-time__eyebrow">
          <span class="current-time__indicator" aria-hidden="true">
            <span class="current-time__indicator-core" />
          </span>
          <span>当前时间</span>
        </div>
        <span class="current-time__header-meta">LOCAL</span>
      </div>
      <div class="current-time__main">
        <div class="current-time__clock" aria-live="polite">
          <span>{{ currentHour }}</span>
          <span class="current-time__colon">:</span>
          <span>{{ currentMinute }}</span>
        </div>
        <div class="current-time__seconds-block" aria-label="当前秒数">
          <span class="current-time__seconds-label">SEC</span>
          <span class="current-time__seconds-value">{{ currentSecond }}</span>
        </div>
      </div>
      <div class="current-time__second-track" aria-hidden="true">
        <span class="current-time__second-progress" />
      </div>
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

const currentHour = ref('--');
const currentMinute = ref('--');
const currentSecond = ref('--');
const currentDate = ref('----/--/--');
const currentWeekday = ref('--');
const currentSecondProgress = ref('0%');

let timer = null;

const widgetStyle = computed(() => {
  const style = {
    '--current-time-second-progress': currentSecondProgress.value,
  };

  if (props.panelWidth === undefined || props.panelWidth === null || props.panelWidth === '') {
    return style;
  }

  const width = typeof props.panelWidth === 'number'
    ? `${props.panelWidth}px`
    : String(props.panelWidth);

  return {
    ...style,
    '--current-time-panel-width': width,
  };
});

function updateTime() {
  const now = new Date();
  const date = dayjs(now);
  currentHour.value = date.format('HH');
  currentMinute.value = date.format('mm');
  currentSecond.value = date.format('ss');
  currentDate.value = date.format('YYYY.MM.DD');
  currentWeekday.value = WEEKDAYS[now.getDay()];
  currentSecondProgress.value = `${Math.round((now.getSeconds() / 59) * 100)}%`;
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
  width: var(--current-time-panel-width, 236px);
  max-width: calc(100vw - 36px);
  display: inline-flex;
  align-items: stretch;
  padding: 0;
  border-radius: 22px;
  border: 1px solid var(--border-color);
  background:
    linear-gradient(145deg, rgba(var(--accent-primary-rgb), 0.08), transparent 42%),
    var(--panel-floating-bg);
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
    linear-gradient(180deg, rgba(255, 255, 255, 0.14), transparent 42%),
    linear-gradient(90deg, rgba(var(--accent-primary-rgb), 0.1), transparent 56%);
  pointer-events: none;
}

.current-time-widget::after {
  content: '';
  position: absolute;
  inset: 0 18px auto;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(var(--accent-primary-rgb), 0.42), transparent);
  pointer-events: none;
}

.current-time-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  padding: 14px 15px 15px;
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
  letter-spacing: 0;
  color: var(--text-secondary);
}

.current-time__indicator {
  width: 16px;
  height: 16px;
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 8px;
  border: 1px solid rgba(var(--accent-primary-rgb), 0.16);
  background: rgba(var(--accent-primary-rgb), 0.09);
}

.current-time__indicator-core {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent-primary);
  box-shadow:
    0 0 0 3px rgba(var(--accent-primary-rgb), 0.14),
    0 0 14px rgba(var(--accent-primary-rgb), 0.38);
  animation: current-time-pulse 2s ease-in-out infinite;
}

.current-time__header-meta,
.current-time__seconds-label,
.current-time__meta-label {
  font-size: 10px;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0;
  color: var(--text-muted);
}

.current-time__header-meta {
  white-space: nowrap;
  padding-top: 1px;
}

.current-time__main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.current-time__clock {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: baseline;
  font-size: 38px;
  font-weight: 760;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
  line-height: 0.88;
  letter-spacing: 0;
}

.current-time__colon {
  color: var(--accent-primary);
  margin: 0 1px;
  transform: translateY(-1px);
}

.current-time__seconds-block {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  width: 58px;
  min-width: 58px;
  aspect-ratio: 1;
  padding: 7px;
  overflow: hidden;
  border-radius: 18px;
  border: 1px solid rgba(var(--accent-primary-rgb), 0.17);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), transparent),
    rgba(var(--accent-primary-rgb), 0.08);
  box-shadow:
    inset 0 1px 0 var(--surface-highlight),
    0 10px 24px rgba(var(--accent-primary-rgb), 0.12);
}

.current-time__seconds-block::before {
  content: '';
  position: absolute;
  inset: 0;
  background: conic-gradient(
    from -90deg,
    rgba(var(--accent-primary-rgb), 0.72) var(--current-time-second-progress),
    rgba(154, 169, 191, 0.16) 0
  );
  opacity: 0.28;
}

.current-time__seconds-block::after {
  content: '';
  position: absolute;
  inset: 4px;
  border-radius: 14px;
  background: var(--panel-floating-bg);
  box-shadow: inset 0 1px 0 var(--surface-highlight);
}

.current-time__seconds-label,
.current-time__seconds-value {
  position: relative;
  z-index: 1;
}

.current-time__seconds-value {
  font-size: 20px;
  line-height: 1;
  font-weight: 760;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  color: var(--accent-primary);
}

.current-time__second-track {
  height: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(154, 169, 191, 0.14);
}

.current-time__second-progress {
  display: block;
  width: var(--current-time-second-progress);
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--accent-primary), var(--accent-success), var(--accent-warning));
  box-shadow: 0 0 12px rgba(var(--accent-primary-rgb), 0.24);
  transition: width 0.28s ease;
}

.current-time__meta {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 14px;
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

@keyframes current-time-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }

  50% {
    transform: scale(0.72);
    opacity: 0.72;
  }
}

@media screen and (max-width: 1023px) {
  .current-time-widget {
    top: 68px;
    left: 14px;
    width: min(var(--current-time-panel-width, 218px), 218px);
    max-width: calc(100vw - 28px);
    border-radius: 18px;
  }

  .current-time-content {
    gap: 8px;
    padding: 10px 12px 11px;
  }

  .current-time__indicator {
    width: 14px;
    height: 14px;
    border-radius: 7px;
  }

  .current-time__indicator-core {
    width: 6px;
    height: 6px;
  }

  .current-time__header,
  .current-time__main,
  .current-time__meta {
    gap: 10px;
  }

  .current-time__clock {
    font-size: 30px;
  }

  .current-time__seconds-block {
    width: 46px;
    min-width: 46px;
    padding: 5px;
    border-radius: 14px;
  }

  .current-time__seconds-block::after {
    inset: 3px;
    border-radius: 11px;
  }

  .current-time__seconds-value {
    font-size: 17px;
  }

  .current-time__second-track {
    height: 3px;
  }

  .current-time__meta-value {
    font-size: 11px;
  }

  .current-time__eyebrow,
  .current-time__header-meta,
  .current-time__seconds-label,
  .current-time__meta-label {
    font-size: 9px;
  }
}

@media screen and (max-width: 420px) {
  .current-time-widget {
    top: 64px;
    left: 12px;
    width: min(var(--current-time-panel-width, 198px), 198px);
    max-width: calc(100vw - 24px);
    border-radius: 16px;
  }

  .current-time-content {
    gap: 7px;
    padding: 8px 10px 9px;
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
    width: 40px;
    min-width: 40px;
    gap: 2px;
    padding: 4px;
    border-radius: 12px;
  }

  .current-time__seconds-block::after {
    border-radius: 9px;
  }

  .current-time__seconds-value {
    font-size: 15px;
  }

  .current-time__meta {
    gap: 7px;
  }

  .current-time__meta-value {
    font-size: 10px;
  }

  .current-time__eyebrow,
  .current-time__seconds-label,
  .current-time__meta-label {
    font-size: 9px;
  }
}
</style>
