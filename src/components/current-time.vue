<template>
  <div class="current-time-widget" aria-label="当前时间">
    <div class="current-time-content">
      <div class="current-time__clock">
        {{ currentTime }}
      </div>
      <div class="current-time__date">
        <span>{{ currentDate }}</span>
        <span>{{ currentWeekday }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  ref,
  onMounted,
  onUnmounted,
} from 'vue';
import dayjs from 'dayjs';

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const currentTime = ref('--:--:--');
const currentDate = ref('----/--/--');
const currentWeekday = ref('--');

let timer = null;

function updateTime() {
  const now = new Date();
  currentTime.value = dayjs(now).format('HH:mm:ss');
  currentDate.value = dayjs(now).format('YYYY-MM-DD');
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
  display: inline-flex;
  align-items: center;
  padding: 12px 16px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  background: var(--panel-floating-bg);
  backdrop-filter: blur(18px) saturate(150%);
  box-shadow: var(--shadow-md);
  color: var(--text-secondary);
  pointer-events: none;
  user-select: none;
}

.current-time-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  line-height: 1.2;
}

.current-time__clock {
  font-size: 24px;
  font-weight: 700;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
}

.current-time__date {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  color: var(--text-muted);
}

@media screen and (max-width: 1023px) {
  .current-time-widget {
    top: 68px;
    left: 14px;
  }

  .current-time__clock {
    font-size: 20px;
  }

  .current-time__date {
    font-size: 11px;
    gap: 8px;
  }
}

@media screen and (max-width: 420px) {
  .current-time-widget {
    top: 64px;
    left: 12px;
    padding: 10px 14px;
  }

  .current-time__clock {
    font-size: 18px;
  }

  .current-time__date {
    font-size: 10px;
    gap: 6px;
  }
}
</style>
