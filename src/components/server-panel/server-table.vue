<template>
  <div class="server-table-wrap">
    <button
      v-for="server in servers"
      :key="server.ID"
      type="button"
      :class="['server-list-item', { offline: server.online !== 1 }]"
      @click="goDetail(server)"
      @mouseenter="onRowEnter(server)"
      @mouseleave="onRowLeave"
      @focus="onRowEnter(server)"
      @blur="onRowLeave"
    >
      <div class="server-list-item__content">
        <div class="server-list-item__head">
          <div class="server-list-item__name-group">
            <span
              v-if="server.Host?.CountryCode"
              :class="`fi fi-${server.Host.CountryCode.toLowerCase()}`"
            />
            <span v-else class="flag-placeholder">
              <i class="ri-global-line" />
            </span>
            <span class="server-list-item__name" :title="server.Name">
              {{ server.Name || '-' }}
            </span>
          </div>
          <span
            v-if="getPlatformLogoClass(server) || getSpec(server)"
            class="server-list-item__head-spec"
          >
            <i v-if="getPlatformLogoClass(server)" :class="getPlatformLogoClass(server)" />
            <span v-if="getSpec(server)">{{ getSpec(server) }}</span>
          </span>
        </div>
        <div
          v-if="getCPUCompany(server)
            || getTraffic(server)
            || getConnCount(server)
            || getSpeed(server)"
          class="server-list-item__tags"
        >
          <span v-if="getCPUCompany(server)" class="meta-tag meta-tag--cpu">
            {{ getCPUCompany(server) }}
          </span>
          <span
            v-if="getTraffic(server)"
            :class="['meta-tag', 'meta-tag--traffic', getTrafficWarningClass(server)]"
          >
            {{ getTraffic(server) }}
          </span>
          <span v-if="getConnCount(server)" class="meta-tag meta-tag--conn">
            连接 {{ getConnCount(server) }}
          </span>
          <span v-if="getSpeed(server)" class="meta-tag meta-tag--speed">
            {{ getSpeed(server) }}
          </span>
        </div>
      </div>
    </button>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';
import {
  calcTransfer,
  getCPUInfo,
  getPlatformLogoIconClassName,
} from '@/utils/host';
import {
  getCycleTransferSummaryByServer,
} from '@/utils/cycle-transfer';

const props = defineProps({
  servers: {
    type: Array,
    default: () => [],
  },
  cycleTransferMap: {
    type: Object,
    default: () => ({}),
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

function getPlatformLogoClass(server) {
  return getPlatformLogoIconClassName(server?.Host?.Platform);
}

function getCPUCompany(server) {
  const cpu = server?.Host?.CPU?.[0];
  if (!cpu) return '';
  const info = getCPUInfo(cpu);
  return info.company || '';
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

  return parts.join('') || '';
}

function getCycleTransferSummary(server) {
  return getCycleTransferSummaryByServer(props.cycleTransferMap, server);
}

function hasTrafficWarning(server) {
  const summary = getCycleTransferSummary(server);
  if (!summary) return false;
  return ['warning', 'alert', 'over'].includes(summary.statusLevel);
}

function getTrafficWarningClass(server) {
  const summary = getCycleTransferSummary(server);
  if (!summary) return '';
  return `traffic-status--${summary.statusLevel}`;
}

function formatTransferValue(value) {
  if (!value) return '0';
  const t = calcTransfer(value);
  return `${t.value}${t.unit}`;
}

function getTraffic(server) {
  const summary = getCycleTransferSummary(server);
  if (summary && hasTrafficWarning(server)) {
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
      if (summary && summary.maxDisplay && summary.maxDisplay !== '-') {
        return `双向 ${formatTransferValue(netIn + netOut)}`;
      }
      return '不限制';
  }
}

function getConnCount(server) {
  const tcp = server.State?.TcpConnCount || 0;
  const udp = server.State?.UdpConnCount || 0;
  if (!tcp && !udp) return '';
  return `${tcp}/${udp}`;
}

function getSpeed(server) {
  const netIn = server.State?.NetInSpeed || 0;
  const netOut = server.State?.NetOutSpeed || 0;
  if (!netIn && !netOut) return '';
  const sIn = calcTransfer(netIn);
  const sOut = calcTransfer(netOut);
  return `↑${sOut.value}${sOut.unit}/s ↓${sIn.value}${sIn.unit}/s`;
}
</script>

<style lang="scss" scoped>
.server-table-wrap {
  flex: 1;
  min-height: 0;
  display: grid;
  align-content: start;
  gap: 6px;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 10px 12px 14px;
  color: var(--text-primary);
  scrollbar-gutter: stable;
}

@media screen and (max-width: 768px) {
  .server-table-wrap {
    padding: 12px;
    gap: 6px;
  }
}
</style>
