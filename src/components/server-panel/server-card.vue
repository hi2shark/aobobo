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

      <div class="tags-row">
        <span
          v-if="specNazhua && specNazhua !== '-'"
          class="meta-tag meta-tag--spec-with-logo"
        >
          <i :class="platformLogoClass" />
          <span>{{ specNazhua }}</span>
        </span>
        <span v-if="cpuCompany" class="meta-tag meta-tag--cpu">{{ cpuCompany }}</span>
        <span
          v-if="trafficLabel && trafficLabel !== '-'"
          :class="['meta-tag', trafficWarningClass]"
        >{{ trafficLabel }}</span>
      </div>
      <div class="tags-row">
        <span v-if="connCount && connCount !== '0|0'" class="meta-tag">连接 {{ connCount }}</span>
        <span v-if="speedLabel && speedLabel !== '-'" class="meta-tag">{{ speedLabel }}</span>
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
import {
  calcTransfer,
  getCPUInfo,
  getPlatformLogoIconClassName,
  getSystemOSLabel,
} from '@/utils/host';
import { duration } from '@/utils/date';
import {
  getCycleTransferSummaryByServer,
} from '@/utils/cycle-transfer';

const props = defineProps({
  info: {
    type: Object,
    required: true,
  },
  expanded: {
    type: Boolean,
    default: false,
  },
  cycleTransferMap: {
    type: Object,
    default: () => ({}),
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
  return parts.join('') || '-';
});

const specNazhua = computed(() => {
  const cpu = props.info.Host?.CPU?.[0] || '';
  const cores = cpu.match(/(\d+)\s*(Virtual|Physical|Physics)\s*Core/i);
  const coreStr = cores ? `${cores[1]}C` : '';
  const memGB = props.info.Host?.MemTotal ? (props.info.Host.MemTotal / 1024 / 1024 / 1024).toFixed(0) : '';
  const diskGB = props.info.Host?.DiskTotal ? (props.info.Host.DiskTotal / 1024 / 1024 / 1024).toFixed(0) : '';
  const parts = [];
  if (coreStr) parts.push(coreStr);
  if (memGB) parts.push(`${memGB}G`);
  if (diskGB) parts.push(`${diskGB}G`);
  return parts.join('') || '-';
});

const platformLogoClass = computed(() => getPlatformLogoIconClassName(props.info.Host?.Platform));

const cpuCompany = computed(() => {
  const cpu = props.info.Host?.CPU?.[0];
  if (!cpu) return '';
  const info = getCPUInfo(cpu);
  return info.company || '';
});

const cycleTransferSummary = computed(() => getCycleTransferSummaryByServer(
  props.cycleTransferMap,
  props.info,
));

const hasTrafficWarning = computed(() => {
  if (!cycleTransferSummary.value) return false;
  return ['warning', 'alert', 'over'].includes(cycleTransferSummary.value.statusLevel);
});

const trafficWarningClass = computed(() => {
  if (!cycleTransferSummary.value) return '';
  return `traffic-status--${cycleTransferSummary.value.statusLevel}`;
});

function formatTransferValue(value) {
  if (!value) return '0';
  const t = calcTransfer(value);
  return `${t.value}${t.unit}`;
}

const trafficLabel = computed(() => {
  if (cycleTransferSummary.value && hasTrafficWarning.value) {
    return `剩余 ${cycleTransferSummary.value.remainingDisplay}`;
  }

  const trafficType = props.info.PublicNote?.planDataMod?.trafficType;
  const netIn = props.info.State?.NetInTransfer || 0;
  const netOut = props.info.State?.NetOutTransfer || 0;

  switch (+trafficType) {
    case 1:
      return `单向出 ${formatTransferValue(netOut)}`;
    case 3: {
      const isOut = netOut >= netIn;
      return `${isOut ? '最大出' : '最大入'} ${formatTransferValue(isOut ? netOut : netIn)}`;
    }
    case 2:
      return `双向 ${formatTransferValue(netIn + netOut)}`;
    default:
      if (cycleTransferSummary.value && cycleTransferSummary.value.maxDisplay !== '-') {
        return `双向 ${formatTransferValue(netIn + netOut)}`;
      }
      return '不限制';
  }
});

const speedLabel = computed(() => {
  const netIn = props.info.State?.NetInSpeed || 0;
  const netOut = props.info.State?.NetOutSpeed || 0;
  if (!netIn && !netOut) return '-';
  const sIn = calcTransfer(netIn);
  const sOut = calcTransfer(netOut);
  return `↑${sOut.value}${sOut.unit}/s ↓${sIn.value}${sIn.unit}/s`;
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
  position: relative;
  overflow: hidden;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-lg);
  padding: 18px 20px;
  margin-bottom: 12px;
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    opacity var(--transition-fast);
  box-shadow:
    var(--card-shadow),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(16px) saturate(145%);

  &::before {
    content: '';
    position: absolute;
    inset: 0 0 auto;
    height: 72px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.08), transparent 78%),
      radial-gradient(circle at top left, rgba(var(--accent-cyan-rgb), 0.1), transparent 48%);
    pointer-events: none;
  }

  &:hover {
    transform: translateY(-2px);
    border-color: var(--card-hover-border);
    box-shadow:
      var(--card-hover-shadow),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }

  &.offline {
    opacity: 0.96;
    border-color: var(--card-offline-border);
    box-shadow:
      var(--card-shadow),
      inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  position: relative;
  z-index: 1;

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;

    .fi {
      font-size: 18px;
      border-radius: 3px;
    }

    .server-name {
      font-weight: 700;
      font-size: 16px;
      letter-spacing: -0.01em;
      color: var(--text-primary);
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .status-dot {
      width: 9px;
      height: 9px;
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
    gap: 8px;
    color: var(--text-muted);
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    font-size: 12px;
    flex: 0 0 auto;

    i {
      font-size: 16px;
    }
  }
}

.card-body {
  position: relative;
  z-index: 1;

  .info-row {
    display: flex;
    gap: 16px;
    margin-bottom: 12px;
    flex-wrap: wrap;

    .info-item {
      display: grid;
      gap: 4px;
      padding: 10px 12px;
      border: 1px solid var(--panel-stat-border);
      border-radius: 16px;
      background: var(--panel-stat-bg);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);

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

  .tags-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 16px;
  }

  .metrics-row {
    display: flex;
    flex-direction: column;
    gap: 10px;

    .metric {
      display: grid;
      grid-template-columns: 42px 1fr 42px;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 16px;
      border: 1px solid var(--panel-stat-border);
      background: var(--panel-metric-bg);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);

      .metric-label {
        font-size: 12px;
        color: var(--text-muted);
      }

      .metric-bar {
        height: 7px;
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
    margin-top: 16px;
    border-top: 1px solid var(--border-color);
    background: var(--surface-subtle);
    border-radius: 18px;
    padding: 14px;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 10px;

    .detail-row {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      gap: 10px;

      .detail-label {
        color: var(--text-muted);
      }
      .detail-value {
        font-family: var(--font-mono);
        font-variant-numeric: tabular-nums;
        font-weight: 600;
      }
    }
  }
}

@media screen and (max-width: 768px) {
  .server-card {
    padding: 16px;
    border-radius: 20px;
  }

  .card-header .header-left .server-name {
    font-size: 15px;
  }

  .card-body .info-row {
    gap: 10px;
  }

  .card-body .info-row .info-item {
    flex: 1 1 140px;
  }

  .card-body .expanded-info {
    grid-template-columns: 1fr;
  }
}
</style>
