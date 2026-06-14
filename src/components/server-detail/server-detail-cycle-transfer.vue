<template>
  <detail-panel
    v-if="showCard"
    variant="flat"
    class="server-detail-cycle-transfer"
  >
    <div class="module-head-group">
      <div class="left-box">
        <span class="module-title">
          <i class="ri-exchange-funds-line" />
          周期流量
        </span>
      </div>
      <div class="right-box">
        <span
          v-if="refreshInterval > 0"
          class="refresh-tip"
        >
          {{ refreshInterval }}s 自动刷新
        </span>
      </div>
    </div>

    <div class="cycle-transfer-list">
      <div
        v-for="item in cycleTransferViewList"
        :key="`${item.source}_${item.ruleId}_${item.serverKey}`"
        class="cycle-transfer-item"
        :class="`status--${item.statusLevel}`"
      >
        <div class="cycle-transfer-item-head">
          <div class="rule-title-group">
            <span class="rule-name">{{ item.ruleName }}</span>
          </div>
          <span
            class="rule-status"
            :class="`status--${item.statusLevel}`"
          >
            {{ item.statusLabel }}
          </span>
        </div>

        <div class="cycle-transfer-meta">
          <span
            class="meta-item"
            :title="item.periodTitle"
          >周期 {{ item.periodText }}</span>
          <span class="meta-item">下次 {{ item.nextCheckDisplay }}</span>
        </div>

        <div class="cycle-transfer-stats">
          <span class="stats-item">已用 {{ item.currentUsageDisplay }}</span>
          <span class="stats-item">剩余 {{ item.remainingDisplay }}</span>
          <span class="stats-item">上限 {{ item.maxDisplay }}</span>
          <span
            v-if="item.showMin"
            class="stats-item"
          >
            下限 {{ item.minDisplay }}
          </span>
        </div>

        <div
          v-if="item.showProgress"
          class="progress-group"
        >
          <div class="progress-track">
            <div
              class="progress-bar"
              :class="`status--${item.statusLevel}`"
              :style="{
                width: `${item.progressWidth}%`,
              }"
            />
          </div>
          <div class="progress-text">
            {{ item.remainingDisplay }} / {{ item.remainingPercentText }}
          </div>
        </div>
      </div>
    </div>
  </detail-panel>
</template>

<script setup>
/**
 * 周期流量展示
 */
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
} from 'vue';
import dayjs from 'dayjs';
import config from '@/config';
import DetailPanel from '@/components/server-detail/detail-panel.vue';
import {
  getCycleTransferStatusLabel,
  loadCycleTransferByServer,
} from '@/utils/cycle-transfer';

function formatPeriod(start, end) {
  const startDate = dayjs(start, 'YYYY.MM.DD HH:mm:ss');
  const endDate = dayjs(end, 'YYYY.MM.DD HH:mm:ss');

  if (!startDate.isValid() || !endDate.isValid()) {
    return {
      text: `${start} - ${end}`,
      title: `${start} - ${end}`,
    };
  }

  const crossYear = startDate.year() !== endDate.year();
  const dateFormat = crossYear ? 'YYYY.MM.DD' : 'MM.DD';

  return {
    text: `${startDate.format(dateFormat)} - ${endDate.format(dateFormat)}`,
    title: `${startDate.format('YYYY.MM.DD HH:mm:ss')} - ${endDate.format('YYYY.MM.DD HH:mm:ss')}`,
  };
}

const props = defineProps({
  info: {
    type: Object,
    default: () => ({}),
  },
});

const cycleTransferList = ref([]);

const refreshInterval = computed(() => {
  let value = parseInt(config.nazhua.detailCycleTransferRefreshTime, 10);
  if (Number.isNaN(value)) {
    value = 60;
  }
  return Math.max(value, 0);
});

const showCard = computed(() => {
  if (config.nazhua.hideDetailCycleTransfer) {
    return false;
  }
  return cycleTransferList.value.length > 0;
});

const cycleTransferViewList = computed(() => cycleTransferList.value.map((item) => {
  const period = formatPeriod(item.periodStart, item.periodEnd);
  return {
    ...item,
    periodText: period.text,
    periodTitle: period.title,
    statusLabel: getCycleTransferStatusLabel(item.statusLevel),
    showProgress: Number.isFinite(item.remainingPercent),
    progressWidth: Number.isFinite(item.remainingPercent)
      ? Math.max(Math.min(item.remainingPercent, 100), 0)
      : 0,
    remainingPercentText: Number.isFinite(item.remainingPercent) ? `${item.remainingPercent.toFixed(2)}%` : '-',
    showMin: item.minDisplay && item.minDisplay !== '0B' && item.minDisplay !== '-',
  };
}));

async function loadCycleTransfer() {
  if (config.nazhua.hideDetailCycleTransfer || !props.info?.ID) {
    cycleTransferList.value = [];
    return;
  }

  try {
    const list = await loadCycleTransferByServer(props.info);
    cycleTransferList.value = Array.isArray(list) ? list : [];
  } catch (error) {
    cycleTransferList.value = [];
    console.error('Failed to load cycle transfer data:', error);
  }
}

let refreshTimer = null;

function clearRefreshTimer() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

function setCycleTransferRefreshTimer() {
  clearRefreshTimer();
  if (refreshInterval.value <= 0 || config.nazhua.hideDetailCycleTransfer) {
    return;
  }
  refreshTimer = setTimeout(async () => {
    await loadCycleTransfer();
    setCycleTransferRefreshTimer();
  }, refreshInterval.value * 1000);
}

onMounted(async () => {
  await loadCycleTransfer();
  setCycleTransferRefreshTimer();
});

onUnmounted(() => {
  clearRefreshTimer();
});
</script>

<style lang="scss" scoped>
.server-detail-cycle-transfer {
  padding: 14px 18px;

  .module-head-group {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
  }

  .module-title {
    display: flex;
    align-items: center;
    gap: 7px;
    font-family: var(--font-sans);
    font-size: 17px;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: var(--text-primary);

    i {
      color: var(--accent-primary);
      font-size: 18px;
    }
  }

  .refresh-tip {
    color: var(--text-muted);
    font-size: 12px;
    line-height: 1.5;
  }

  .cycle-transfer-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .cycle-transfer-item {
    padding: 12px 14px;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    background: var(--surface-subtle);

    &.status--fine {
      border-color: rgba(39, 201, 117, 0.28);
    }

    &.status--warning {
      border-color: rgba(255, 190, 86, 0.28);
    }

    &.status--alert {
      border-color: rgba(255, 150, 102, 0.28);
    }

    &.status--over {
      border-color: rgba(255, 104, 126, 0.28);
    }
  }

  .cycle-transfer-item-head,
  .cycle-transfer-meta,
  .cycle-transfer-stats {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 14px;
  }

  .cycle-transfer-meta,
  .cycle-transfer-stats {
    margin-top: 8px;
  }

  .rule-title-group {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .rule-name {
    color: var(--text-primary);
    font-size: 14px;
    line-height: 1.4;
  }

  .rule-status {
    padding: 2px 8px;
    font-size: 12px;
    line-height: 18px;
    border-radius: 999px;
    border: 1px solid transparent;
  }

  .meta-item,
  .stats-item {
    color: var(--text-secondary);
    font-size: 12px;
    line-height: 1.5;
  }

  .progress-group {
    margin-top: 10px;
  }

  .progress-track {
    height: 10px;
    overflow: hidden;
    background: var(--progress-track);
    border-radius: 999px;
  }

  .progress-bar {
    height: 100%;
    border-radius: 999px;
    transition: width 0.3s ease;
  }

  .progress-text {
    margin-top: 6px;
    color: var(--text-secondary);
    font-size: 12px;
    text-align: right;
  }

  .status--fine {
    &.rule-status {
      color: var(--metric-good);
      border-color: rgba(39, 201, 117, 0.35);
      background: rgba(39, 201, 117, 0.12);
    }

    &.progress-bar {
      background: linear-gradient(90deg, #2fc96f, var(--metric-good));
    }
  }

  .status--warning {
    &.rule-status {
      color: var(--metric-warn);
      border-color: rgba(255, 190, 86, 0.35);
      background: rgba(255, 190, 86, 0.12);
    }

    &.progress-bar {
      background: linear-gradient(90deg, #f9a826, var(--metric-warn));
    }
  }

  .status--alert {
    &.rule-status {
      color: #ff9666;
      border-color: rgba(255, 150, 102, 0.35);
      background: rgba(255, 150, 102, 0.12);
    }

    &.progress-bar {
      background: linear-gradient(90deg, #ff7a45, #ff9666);
    }
  }

  .status--over {
    &.rule-status {
      color: var(--metric-danger);
      border-color: rgba(255, 104, 126, 0.35);
      background: rgba(255, 104, 126, 0.12);
    }

    &.progress-bar {
      background: linear-gradient(90deg, #ff5468, var(--metric-danger));
    }
  }

  @media screen and (max-width: 768px) {
  .server-detail-cycle-transfer {
    padding: 12px 14px;
  }
}

.status--neutral {
    &.rule-status {
      color: var(--text-muted);
      border-color: var(--border-color);
      background: var(--surface-subtle);
    }

    &.progress-bar {
      background: linear-gradient(90deg, #768595, var(--text-muted));
    }
  }
}
</style>
