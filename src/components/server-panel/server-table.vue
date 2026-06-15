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
            v-if="getSpec(server)"
            class="server-list-item__head-spec"
          >
            <i :class="getPlatformLogoClass(server)" />
            <span>{{ getSpec(server) }}</span>
          </span>
        </div>
        <div
          v-if="getCPUCompany(server) || getCPUModel(server) || getTraffic(server)"
          class="server-list-item__resource"
        >
          <span v-if="getCPUCompany(server)" class="meta-tag meta-tag--cpu">
            {{ getCPUCompany(server) }}
          </span>
          <span v-if="getCPUModel(server)" class="resource-text resource-text--cpu">
            {{ getCPUModel(server) }}
          </span>
          <span v-if="getTraffic(server)" class="resource-text resource-text--traffic">
            <i class="ri-arrow-up-down-line" />
            <span>{{ getTraffic(server) }}</span>
          </span>
        </div>
        <div
          v-if="getUptime(server)
            || getBilling(server)
            || getRemainingTime(server)
            || getPlanTags(server).length"
          class="server-list-item__tags server-list-item__tags--bill"
        >
          <span v-if="getUptime(server)" class="meta-tag meta-tag--uptime">
            <i class="ri-time-line" />
            <span>在线 {{ getUptime(server) }}</span>
          </span>
          <span v-if="getBilling(server)" class="meta-tag meta-tag--billing">
            <i class="ri-price-tag-3-line" />
            <span>{{ getBilling(server) }}</span>
          </span>
          <span
            v-if="getRemainingTime(server)"
            :class="['meta-tag', 'meta-tag--remaining', getRemainingClass(server)]"
          >
            <i class="ri-hourglass-line" />
            <span>{{ getRemainingTime(server) }}</span>
          </span>
          <span
            v-for="tag in getPlanTags(server)"
            :key="tag"
            class="meta-tag meta-tag--plan"
          >
            {{ tag }}
          </span>
        </div>
        <div
          v-if="getConnCount(server) || getSpeedUp(server) || getSpeedDown(server)"
          class="server-list-item__network"
        >
          <span v-if="getConnCount(server)" class="network-stat network-stat--conn">
            <i class="ri-link-m" />
            <span>连接 {{ getConnCount(server) }}</span>
          </span>
          <span
            v-if="getSpeedUp(server) || getSpeedDown(server)"
            class="network-stat network-stat--speed"
          >
            <span v-if="getSpeedUp(server)" class="speed-up">↑ {{ getSpeedUp(server) }}</span>
            <span class="speed-sep">|</span>
            <span v-if="getSpeedDown(server)" class="speed-down">↓ {{ getSpeedDown(server) }}</span>
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
import { duration } from '@/utils/date';
import { getBillAndPlanByServer } from '@/composables/server-bill-and-plan';

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

function getCPUCompany(server) {
  const cpu = server?.Host?.CPU?.[0];
  if (!cpu) return '';
  const info = getCPUInfo(cpu);
  return info.company || '';
}

function getCPUModel(server) {
  const cpu = server?.Host?.CPU?.[0];
  if (!cpu) return '';
  const info = getCPUInfo(cpu);
  const parts = [];
  if (info.model) parts.push(info.model);
  if (info.modelNum) parts.push(info.modelNum);
  return parts.join(' ');
}

function getPlatformLogoClass(server) {
  return getPlatformLogoIconClassName(server?.Host?.Platform);
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

function formatTransferValue(value) {
  if (!value) return '0';
  const t = calcTransfer(value);
  return `${t.value}${t.unit}`;
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
      return '不限制';
  }
}

function getConnCount(server) {
  const tcp = server.State?.TcpConnCount || 0;
  const udp = server.State?.UdpConnCount || 0;
  if (!tcp && !udp) return '';
  return `${tcp}/${udp}`;
}

function getSpeedUp(server) {
  const netOut = server.State?.NetOutSpeed || 0;
  if (!netOut) return '';
  const t = calcTransfer(netOut);
  return `${t.value}${t.unit}/s`;
}

function getSpeedDown(server) {
  const netIn = server.State?.NetInSpeed || 0;
  if (!netIn) return '';
  const t = calcTransfer(netIn);
  return `${t.value}${t.unit}/s`;
}

function getUptime(server) {
  const bt = server?.Host?.BootTime;
  if (!bt) return '';
  return duration(bt * 1000, Date.now(), true);
}

function getBillAndPlan(server) {
  return getBillAndPlanByServer(server);
}

function getBilling(server) {
  const { billing } = getBillAndPlan(server);
  if (!billing) return '';
  if (billing.isFree) return billing.value;
  if (billing.value === '按量') return billing.value;
  if (billing.cycleLabel) {
    return `${billing.value}/${billing.cycleLabel}`;
  }
  return String(billing.value);
}

function getRemainingTime(server) {
  const { remainingTime: remaining } = getBillAndPlan(server);
  if (!remaining) return '';
  return `${remaining.label} ${remaining.value}`;
}

function getRemainingClass(server) {
  const { remainingTime: remaining } = getBillAndPlan(server);
  if (!remaining) return '';
  if (remaining.type === 'expired') return 'remaining-status--danger';
  if (remaining.type === 'infinity') return 'remaining-status--success';
  const days = remaining.value2;
  if (days <= 7) return 'remaining-status--danger';
  if (days <= 30) return 'remaining-status--warning';
  return 'remaining-status--success';
}

function getPlanTags(server) {
  const list = [];
  const {
    networkRoute,
    extra,
    IPv4,
    IPv6,
  } = server?.PublicNote?.planDataMod || {};
  if (networkRoute) {
    list.push(...String(networkRoute).split(','));
  }
  if (extra) {
    list.push(...String(extra).split(','));
  }
  if (IPv4 === '1' && IPv6 === '1') {
    list.push('双栈IP');
  } else if (IPv4 === '1') {
    list.push('仅IPv4');
  } else if (IPv6 === '1') {
    list.push('仅IPv6');
  }
  return list;
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
