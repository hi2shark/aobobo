<template>
  <div :class="['location-popup', { mobile }]" @click.stop>
    <div class="popup-header">
      <div class="title-group">
        <h3>{{ location.label }}</h3>
        <div class="popup-stats">
          <span class="stat-chip total">{{ location.totalCount }}台</span>
          <span v-if="localTime" class="stat-chip stat-chip--time">当地 {{ localTime }}</span>
        </div>
      </div>
      <button type="button" class="close-btn" aria-label="关闭位置弹窗" @click="$emit('close')">
        <i class="ri-close-line" />
      </button>
    </div>

    <div class="server-list">
      <button
        v-for="server in location.servers"
        :key="server.ID"
        type="button"
        :class="['server-list-item', { offline: server.online !== 1 }]"
        @click="openServer(server)"
      >
        <div class="server-list-item__content">
          <div class="server-list-item__head">
            <div class="server-list-item__name-group">
              <span class="server-list-item__name">{{ server.Name }}</span>
            </div>
            <span
              v-if="getSpec(server)"
              class="server-list-item__head-spec"
            >
              <i :class="getPlatformLogoClass(server)" />
              <span>{{ getSpec(server) }}</span>
            </span>
          </div>
          <div class="server-list-item__tags">
            <span
              :class="[
                'meta-tag',
                'meta-tag--status',
                server.online === 1 ? 'online' : 'offline',
              ]"
            >
              {{ server.online === 1 ? '在线' : '离线' }}
            </span>
            <span v-if="getCPUCompany(server)" class="meta-tag meta-tag--cpu">
              {{ getCPUCompany(server) }}
            </span>
            <span v-if="getTraffic(server)" class="meta-tag">
              {{ getTraffic(server) }}
            </span>
            <span v-if="getUptime(server)" class="meta-tag">{{ getUptime(server) }}</span>
          </div>
        </div>
      </button>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { duration } from '@/utils/date';
import {
  calcTransfer,
  getCPUInfo,
  getPlatformLogoIconClassName,
} from '@/utils/host';
import {
  getCycleTransferSummaryByServer,
} from '@/utils/cycle-transfer';

defineEmits(['close']);

const props = defineProps({
  location: {
    type: Object,
    required: true,
  },
  localTime: {
    type: String,
    default: '',
  },
  mobile: {
    type: Boolean,
    default: false,
  },
  placement: {
    type: String,
    default: 'top',
  },
  cycleTransferMap: {
    type: Object,
    default: () => ({}),
  },
});

const router = useRouter();

function openServer(server) {
  router.push(`/server/${server.ID}`);
}

function getCPUCompany(server) {
  const cpu = server?.Host?.CPU?.[0];
  if (!cpu) {
    return '';
  }
  const info = getCPUInfo(cpu);
  return info.company || '';
}

function formatTransferValue(value) {
  if (!value) {
    return '0';
  }
  const t = calcTransfer(value);
  return `${t.value}${t.unit}`;
}

function getCycleTransferSummary(server) {
  return getCycleTransferSummaryByServer(props.cycleTransferMap, server);
}

function getTraffic(server) {
  const summary = getCycleTransferSummary(server);
  if (summary) {
    return `剩余 ${summary.remainingDisplay}`;
  }

  const trafficType = server?.PublicNote?.planDataMod?.trafficType;
  const netIn = server.State?.NetInTransfer || 0;
  const netOut = server.State?.NetOutTransfer || 0;

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
      return `双向 ${formatTransferValue(netIn + netOut)}`;
  }
}

function getPlatformLogoClass(server) {
  return getPlatformLogoIconClassName(server?.Host?.Platform);
}

function getSpec(server) {
  const cpu = server.Host?.CPU?.[0] || '';
  const cores = cpu.match(/(\d+)\s*(Virtual|Physical|Physics)\s*Core/i);
  const coreStr = cores ? `${cores[1]}C` : '';
  const memGB = server.Host?.MemTotal
    ? (server.Host.MemTotal / 1024 / 1024 / 1024).toFixed(0)
    : '';
  const diskGB = server.Host?.DiskTotal
    ? (server.Host.DiskTotal / 1024 / 1024 / 1024).toFixed(0)
    : '';
  const parts = [];

  if (coreStr) {
    parts.push(coreStr);
  }
  if (memGB) {
    parts.push(`${memGB}G`);
  }
  if (diskGB) {
    parts.push(`${diskGB}G`);
  }

  return parts.join('') || '';
}

function getUptime(server) {
  const bootTime = server.Host?.BootTime;
  if (!bootTime) {
    return '';
  }
  return duration(bootTime * 1000, Date.now(), true);
}
</script>

<style lang="scss" scoped>
.location-popup {
  position: relative;
  width: min(380px, calc(100vw - 32px));
  max-height: min(440px, calc(100vh - 64px));
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px;
  border-radius: 24px;
  background: var(--globe-popup-bg);
  border: 1px solid var(--globe-popup-border);
  box-shadow: var(--globe-popup-shadow);
  backdrop-filter: blur(20px) saturate(150%);
  color: var(--text-primary);
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.1) 0%, transparent 72%),
      radial-gradient(ellipse at 0% 0%, rgba(var(--accent-cyan-rgb), 0.12), transparent 60%);
    pointer-events: none;
  }

  &.mobile {
    width: 100%;
    max-height: min(60vh, 480px);
    max-height: min(60dvh, 480px);
    border-radius: 24px 24px 0 0;
    padding: 18px 16px 16px;
  }
}

.popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  position: relative;
  z-index: 1;
}

.title-group {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;

  h3 {
    flex: 0 0 auto;
    font-size: 17px;
    font-weight: 700;
    line-height: 1.25;
    letter-spacing: -0.01em;
  }
}

.popup-stats {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.stat-chip {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid var(--globe-popup-chip-border);
  background: var(--globe-popup-chip-bg);
  font-size: 12px;
  color: var(--globe-popup-muted);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);

  &.total {
    color: var(--text-primary);
  }

  &.online {
    color: var(--badge-online-text);
  }

  &.offline {
    color: var(--badge-offline-text);
  }

  &.stat-chip--time {
    color: var(--accent-primary);
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
  }
}

.close-btn {
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--button-subtle-border);
  border-radius: 14px;
  background: var(--button-subtle-bg);
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    color var(--transition-fast),
    background var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    transform var(--transition-fast);

  &:hover {
    color: var(--text-on-accent);
    background: var(--button-active-bg);
    border-color: var(--button-active-border);
    box-shadow: var(--button-active-shadow);
    transform: translateY(-1px);
  }

  i {
    font-size: 18px;
  }
}

.server-list {
  display: grid;
  gap: 6px;
  min-height: 0;
  overflow-y: auto;
  padding-right: 2px;
  position: relative;
  z-index: 1;
}

.meta-tag--status {
  padding: 0 9px;

  &.online {
    color: var(--accent-success);
    border-color: rgba(var(--accent-success-rgb), 0.28);
    background: rgba(var(--accent-success-rgb), 0.08);
  }

  &.offline {
    color: var(--accent-danger);
    border-color: rgba(var(--accent-danger-rgb), 0.28);
    background: rgba(var(--accent-danger-rgb), 0.08);
  }
}

@media screen and (max-width: 768px) {
  .location-popup {
    width: 100%;
    max-height: min(60vh, 500px);
    max-height: min(60dvh, 500px);
  }
}
</style>
