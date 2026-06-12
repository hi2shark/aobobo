<template>
  <div class="server-card" :class="{ offline: info.online !== 1, expanded }" @click="goDetail">
    <div class="card-header">
      <div class="header-left">
        <span
          v-if="info.Host?.CountryCode"
          :class="`fi fi-${info.Host.CountryCode.toLowerCase()}`"
        />
        <span class="server-name">{{ info.Name }}</span>
        <span :class="['status-dot', info.online === 1 ? 'online' : 'offline']" />
      </div>
      <div class="header-right">
        <span class="uptime">{{ uptime }}</span>
        <i class="ri-arrow-right-s-line" />
      </div>
    </div>

    <div class="card-body">
      <div class="info-row">
        <div class="info-item">
          <span class="label">系统</span>
          <span class="value">{{ osLabel }}</span>
        </div>
        <div class="info-item">
          <span class="label">规格</span>
          <span class="value">{{ spec }}</span>
        </div>
        <div class="info-item">
          <span class="label">负载</span>
          <span class="value">{{ formatFloat(info.State?.Load1) }}</span>
        </div>
      </div>

      <div class="metrics-row">
        <div class="metric">
          <span class="metric-label">CPU</span>
          <div class="metric-bar">
            <div
              class="metric-fill"
              :style="{ width: `${info.State?.CPU || 0}%`, background: getLoadColor(info.State?.CPU) }"
            />
          </div>
          <span class="metric-value">{{ formatPercent(info.State?.CPU) }}</span>
        </div>
        <div class="metric">
          <span class="metric-label">内存</span>
          <div class="metric-bar">
            <div class="metric-fill" :style="{ width: `${memPercent}%`, background: getLoadColor(memPercent) }" />
          </div>
          <span class="metric-value">{{ formatPercent(memPercent) }}</span>
        </div>
        <div class="metric">
          <span class="metric-label">硬盘</span>
          <div class="metric-bar">
            <div class="metric-fill" :style="{ width: `${diskPercent}%`, background: getLoadColor(diskPercent) }" />
          </div>
          <span class="metric-value">{{ formatPercent(diskPercent) }}</span>
        </div>
      </div>

      <div v-if="expanded" class="expanded-info">
        <div class="detail-row">
          <span class="detail-label">网络 ↑</span>
          <span class="detail-value">{{ speedUp }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">网络 ↓</span>
          <span class="detail-value">{{ speedDown }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">流量 ↑</span>
          <span class="detail-value">{{ transferOut }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">流量 ↓</span>
          <span class="detail-value">{{ transferIn }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">TCP/UDP</span>
          <span class="detail-value">{{ connCount }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">进程</span>
          <span class="detail-value">{{ info.State?.ProcessCount || '-' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { calcTransfer, getSystemOSLabel } from '@/utils/host';
import { duration } from '@/utils/date';

const props = defineProps({
  info: {
    type: Object,
    required: true,
  },
  expanded: {
    type: Boolean,
    default: false,
  },
});

const router = useRouter();

const osLabel = computed(() => getSystemOSLabel(props.info.Host?.Platform));

const uptime = computed(() => {
  const bt = props.info.Host?.BootTime;
  if (!bt) return '-';
  return duration(bt * 1000, Date.now(), true);
});

const spec = computed(() => {
  const cpu = props.info.Host?.CPU?.[0] || '';
  const cores = cpu.match(/(\d+)\s*(Virtual|Physical|Physics)\s*Core/i);
  const coreStr = cores ? `${cores[1]}核` : '';
  const memGB = props.info.Host?.MemTotal ? (props.info.Host.MemTotal / 1024 / 1024 / 1024).toFixed(0) : '';
  const parts = [];
  if (coreStr) parts.push(coreStr);
  if (memGB) parts.push(`${memGB}G内存`);
  return parts.join(' / ') || '-';
});

const memPercent = computed(() => {
  const total = props.info.Host?.MemTotal || 1;
  const used = props.info.State?.MemUsed || 0;
  return Math.min(100, Math.round((used / total) * 100));
});

const diskPercent = computed(() => {
  const total = props.info.Host?.DiskTotal || 1;
  const used = props.info.State?.DiskUsed || 0;
  return Math.min(100, Math.round((used / total) * 100));
});

const speedUp = computed(() => {
  const speed = props.info.State?.NetOutSpeed || 0;
  if (!speed) return '-';
  const t = calcTransfer(speed);
  return `${t.value}${t.unit}/s`;
});

const speedDown = computed(() => {
  const speed = props.info.State?.NetInSpeed || 0;
  if (!speed) return '-';
  const t = calcTransfer(speed);
  return `${t.value}${t.unit}/s`;
});

const transferIn = computed(() => {
  const val = props.info.State?.NetInTransfer || 0;
  if (!val) return '-';
  const t = calcTransfer(val);
  return `${t.value}${t.unit}`;
});

const transferOut = computed(() => {
  const val = props.info.State?.NetOutTransfer || 0;
  if (!val) return '-';
  const t = calcTransfer(val);
  return `${t.value}${t.unit}`;
});

const connCount = computed(() => {
  const tcp = props.info.State?.TcpConnCount || 0;
  const udp = props.info.State?.UdpConnCount || 0;
  return `${tcp}/${udp}`;
});

function goDetail() {
  router.push(`/server/${props.info.ID}`);
}

function formatPercent(val) {
  if (val === undefined || val === null) return '-';
  return `${Math.round(val)}%`;
}

function formatFloat(val) {
  if (val === undefined || val === null) return '-';
  return val.toFixed(2);
}

function getLoadColor(val) {
  if (val === undefined || val === null) return 'var(--text-muted)';
  if (val < 50) return 'var(--metric-good)';
  if (val < 80) return 'var(--metric-warn)';
  return 'var(--metric-danger)';
}
</script>

<style lang="scss" scoped>
.server-card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: all var(--transition-fast);
  box-shadow: var(--card-shadow);

  &:hover {
    transform: translateY(-1px);
    border-color: var(--card-hover-border);
    box-shadow: var(--card-hover-shadow);
  }

  &.offline {
    opacity: 0.82;
    border-color: var(--card-offline-border);
  }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;

    .fi {
      font-size: 18px;
      border-radius: 2px;
    }

    .server-name {
      font-weight: 600;
      font-size: 14px;
      color: var(--text-primary);
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;

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

  .header-right {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--text-muted);
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    font-size: 12px;

    i {
      font-size: 16px;
    }
  }
}

.card-body {
  .info-row {
    display: flex;
    gap: 20px;
    margin-bottom: 12px;
    flex-wrap: wrap;

    .info-item {
      display: flex;
      align-items: center;
      gap: 6px;

      .label {
        font-size: 12px;
        color: var(--text-muted);
      }
      .value {
        font-size: 13px;
        font-weight: 500;
        color: var(--text-primary);
      }
    }

    .info-item:nth-child(2) .value,
    .info-item:nth-child(3) .value {
      font-family: var(--font-mono);
      font-variant-numeric: tabular-nums;
    }
  }

  .metrics-row {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .metric {
      display: grid;
      grid-template-columns: 36px 1fr 40px;
      align-items: center;
      gap: 8px;

      .metric-label {
        font-size: 12px;
        color: var(--text-muted);
      }

      .metric-bar {
        height: 6px;
        background: var(--progress-track);
        border-radius: 999px;
        overflow: hidden;
      }

      .metric-fill {
        height: 100%;
        border-radius: 999px;
        box-shadow: 0 0 14px var(--progress-glow);
        transition: width 0.5s ease;
      }

      .metric-value {
        font-family: var(--font-mono);
        font-variant-numeric: tabular-nums;
        font-size: 12px;
        font-weight: 500;
        text-align: right;
      }
    }
  }

  .expanded-info {
    margin-top: 12px;
    border-top: 1px solid var(--border-color);
    background: var(--surface-subtle);
    border-radius: 8px;
    padding: 12px;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 8px;

    .detail-row {
      display: flex;
      justify-content: space-between;
      font-size: 12px;

      .detail-label {
        color: var(--text-muted);
      }
      .detail-value {
        font-family: var(--font-mono);
        font-variant-numeric: tabular-nums;
        font-weight: 500;
      }
    }
  }
}
</style>
