<template>
  <div class="server-table-wrap">
    <button
      v-for="server in servers"
      :key="server.ID"
      type="button"
      :class="['server-row', { offline: server.online !== 1 }]"
      @click="goDetail(server)"
      @mouseenter="onRowEnter(server)"
      @mouseleave="onRowLeave"
      @focus="onRowEnter(server)"
      @blur="onRowLeave"
    >
      <div class="row-head">
        <div class="name-group">
          <span
            v-if="server.Host?.CountryCode"
            :class="`fi fi-${server.Host.CountryCode.toLowerCase()}`"
          />
          <span v-else class="flag-placeholder">
            <i class="ri-global-line" />
          </span>
          <span class="name-text">{{ server.Name || '-' }}</span>
        </div>
        <span :class="['status-badge', server.online === 1 ? 'online' : 'offline']">
          {{ server.online === 1 ? '在线' : '离线' }}
        </span>
      </div>

      <div class="row-info">
        <span class="info-chip">
          <i class="ri-map-pin-2-line" />
          {{ getRegion(server) }}
        </span>
        <span class="info-chip">
          <i class="ri-window-line" />
          {{ getOS(server) }}
        </span>
        <span class="info-chip spec-chip">
          <i class="ri-cpu-line" />
          {{ getSpec(server) }}
        </span>
      </div>

      <div class="row-stats">
        <div class="stat-item">
          <span class="stat-label">在线</span>
          <span class="stat-value">{{ getUptime(server) }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">网速</span>
          <span class="stat-value">{{ getSpeed(server) }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">负载</span>
          <span class="stat-value">{{ formatFloat(server.State?.Load1) }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">连接</span>
          <span class="stat-value">{{ getConn(server) }}</span>
        </div>
      </div>

      <div class="metric-grid">
        <div class="metric-item">
          <div class="metric-top">
            <span class="metric-label">CPU</span>
            <span class="metric-value">{{ formatPercent(server.State?.CPU) }}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="getProgressStyle(server.State?.CPU)" />
          </div>
        </div>
        <div class="metric-item">
          <div class="metric-top">
            <span class="metric-label">内存</span>
            <span class="metric-value">{{ formatPercent(getMemPercent(server)) }}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="getProgressStyle(getMemPercent(server))" />
          </div>
        </div>
        <div class="metric-item">
          <div class="metric-top">
            <span class="metric-label">硬盘</span>
            <span class="metric-value">{{ formatPercent(getDiskPercent(server)) }}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="getProgressStyle(getDiskPercent(server))" />
          </div>
        </div>
      </div>
    </button>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { calcTransfer, getSystemOSLabel } from '@/utils/host';
import { duration } from '@/utils/date';

defineProps({
  servers: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['hover-server']);

const router = useRouter();

function goDetail(server) {
  router.push(`/server/${server.ID}`);
}

function onRowEnter(server) {
  emit('hover-server', server);
}

function onRowLeave() {
  emit('hover-server', null);
}

function getRegion(server) {
  return server?.PublicNote?.customData?.location
    || server?.Host?.CountryCode?.toUpperCase()
    || '-';
}

function getOS(server) {
  return getSystemOSLabel(server?.Host?.Platform) || '-';
}

function getSpec(server) {
  const cpu = server.Host?.CPU?.[0] || '';
  const cores = cpu.match(/(\d+)\s*(Virtual|Physical|Physics)\s*Core/i);
  const coreStr = cores ? `${cores[1]}C` : '';
  const memGB = server.Host?.MemTotal ? (server.Host.MemTotal / 1024 / 1024 / 1024).toFixed(0) : '';
  const diskGB = server.Host?.DiskTotal ? (server.Host.DiskTotal / 1024 / 1024 / 1024).toFixed(0) : '';
  const parts = [];

  if (coreStr) parts.push(coreStr);
  if (memGB) parts.push(`${memGB}G`);
  if (diskGB) parts.push(`${diskGB}G`);

  return parts.join(' / ') || '-';
}

function getUptime(server) {
  const bootTime = server.Host?.BootTime;
  if (!bootTime) return '-';
  return duration(bootTime * 1000, Date.now(), true);
}

function getSpeed(server) {
  const inSpeed = server.State?.NetInSpeed || 0;
  const outSpeed = server.State?.NetOutSpeed || 0;
  const max = Math.max(inSpeed, outSpeed);

  if (max === 0) return '-';

  const transfer = calcTransfer(max);
  return `${transfer.value}${transfer.unit}/s`;
}

function getConn(server) {
  const tcp = server.State?.TcpConnCount || 0;
  const udp = server.State?.UdpConnCount || 0;

  if (tcp + udp === 0) return '-';

  return `${tcp + udp}`;
}

function getMemPercent(server) {
  const total = server.Host?.MemTotal || 1;
  const used = server.State?.MemUsed || 0;
  return Math.min(100, Math.round((used / total) * 100));
}

function getDiskPercent(server) {
  const total = server.Host?.DiskTotal || 1;
  const used = server.State?.DiskUsed || 0;
  return Math.min(100, Math.round((used / total) * 100));
}

function normalizePercent(val) {
  if (val === undefined || val === null) return 0;
  return Math.min(100, Math.max(0, Math.round(val)));
}

function formatPercent(val) {
  if (val === undefined || val === null) return '-';
  return `${normalizePercent(val)}%`;
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

function getProgressStyle(val) {
  const percent = normalizePercent(val);
  return {
    width: `${percent}%`,
    background: getLoadColor(percent),
  };
}
</script>

<style lang="scss" scoped>
.server-table-wrap {
  flex: 1;
  min-height: 0;
  display: grid;
  align-content: start;
  gap: 10px;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 14px;
  color: var(--text-primary);
  scrollbar-gutter: stable;
}

.server-row {
  width: 100%;
  display: grid;
  gap: 12px;
  padding: 14px;
  appearance: none;
  border: 1px solid var(--panel-row-border);
  border-radius: 18px;
  background: var(--panel-row-bg);
  box-shadow: var(--panel-row-shadow);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast);

  &:hover,
  &:focus-visible {
    transform: translateY(-1px);
    outline: none;
    border-color: var(--panel-row-hover-border);
    background: var(--panel-row-hover-bg);
    box-shadow: var(--panel-row-hover-shadow);
  }

  &.offline {
    background: var(--panel-row-offline-bg);
    border-color: var(--panel-row-offline-border);
  }
}

.row-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.name-group {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;

  .fi,
  .flag-placeholder {
    flex: 0 0 auto;
    width: 18px;
    font-size: 18px;
    border-radius: 3px;
  }

  .flag-placeholder {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--panel-chip-icon);
    background: var(--panel-chip-bg);
    border: 1px solid var(--panel-chip-border);
  }
}

.name-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  flex: 0 0 auto;

  &.online {
    background: var(--badge-online-bg);
    border-color: var(--badge-online-border);
    color: var(--badge-online-text);
  }

  &.offline {
    background: var(--badge-offline-bg);
    border-color: var(--badge-offline-border);
    color: var(--badge-offline-text);
  }
}

.row-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.info-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  max-width: 100%;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid var(--panel-chip-border);
  background: var(--panel-chip-bg);
  color: var(--panel-chip-text);
  font-size: 12px;
  line-height: 1;

  i {
    color: var(--panel-chip-icon);
  }
}

.spec-chip {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.row-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.stat-item {
  min-width: 0;
  display: grid;
  gap: 4px;
  padding: 10px 10px 9px;
  border-radius: 14px;
  border: 1px solid var(--panel-stat-border);
  background: var(--panel-stat-bg);
}

.stat-label,
.metric-label {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.stat-value,
.metric-value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 600;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.metric-item {
  display: grid;
  gap: 7px;
  padding: 10px 10px 9px;
  border-radius: 14px;
  border: 1px solid var(--panel-stat-border);
  background: var(--panel-metric-bg);
}

.metric-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.progress-bar {
  width: 100%;
  height: 6px;
  background: var(--panel-metric-track);
  border-radius: 999px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 999px;
  box-shadow: 0 0 12px var(--progress-glow);
  transition: width 0.3s ease;
}

.offline {
  .name-text,
  .stat-value,
  .metric-value {
    color: var(--text-secondary);
  }
}

@media screen and (max-width: 768px) {
  .server-table-wrap {
    padding: 12px;
    gap: 8px;
  }

  .server-row {
    padding: 12px;
    border-radius: 16px;
  }

  .name-text {
    font-size: 14px;
  }
}

@media screen and (max-width: 520px) {
  .row-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
