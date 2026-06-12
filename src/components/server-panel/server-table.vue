<template>
  <div class="server-table-wrap">
    <table class="server-table">
      <thead>
        <tr>
          <th class="col-status">
            状态
          </th>
          <th class="col-name">
            名称
          </th>
          <th class="col-region hide-mobile">
            地区
          </th>
          <th class="col-os hide-mobile">
            系统
          </th>
          <th class="col-spec hide-mobile">
            规格
          </th>
          <th class="col-uptime hide-mobile">
            在线
          </th>
          <th class="col-speed">
            网速
          </th>
          <th class="col-transfer hide-mobile">
            流量
          </th>
          <th class="col-conn hide-mobile">
            连接
          </th>
          <th class="col-load hide-mobile">
            负载
          </th>
          <th class="col-cpu">
            CPU
          </th>
          <th class="col-mem">
            内存
          </th>
          <th class="col-disk hide-mobile">
            硬盘
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="server in servers"
          :key="server.ID"
          :class="{ offline: server.online !== 1 }"
          tabindex="0"
          @click="goDetail(server)"
          @mouseenter="onRowEnter(server)"
          @mouseleave="onRowLeave"
          @focus="onRowEnter(server)"
          @blur="onRowLeave"
        >
          <td class="col-status">
            <span :class="['status-badge', server.online === 1 ? 'online' : 'offline']">
              {{ server.online === 1 ? '在线' : '离线' }}
            </span>
          </td>
          <td class="col-name">
            <div class="name-cell">
              <span v-if="server.Host?.CountryCode" :class="`fi fi-${server.Host.CountryCode.toLowerCase()}`" />
              <span class="name-text">{{ server.Name }}</span>
            </div>
          </td>
          <td class="col-region hide-mobile">
            {{ getRegion(server) }}
          </td>
          <td class="col-os hide-mobile">
            {{ getOS(server) }}
          </td>
          <td class="col-spec hide-mobile">
            {{ getSpec(server) }}
          </td>
          <td class="col-uptime hide-mobile">
            {{ getUptime(server) }}
          </td>
          <td class="col-speed">
            {{ getSpeed(server) }}
          </td>
          <td class="col-transfer hide-mobile">
            {{ getTransfer(server) }}
          </td>
          <td class="col-conn hide-mobile">
            {{ getConn(server) }}
          </td>
          <td class="col-load hide-mobile">
            {{ formatFloat(server.State?.Load1) }}
          </td>
          <td class="col-cpu">
            <div class="progress-cell">
              <span>{{ formatPercent(server.State?.CPU) }}</span>
              <div class="progress-bar">
                <div
                  class="progress-fill"
                  :style="{ width: `${server.State?.CPU || 0}%`, background: getLoadColor(server.State?.CPU) }"
                />
              </div>
            </div>
          </td>
          <td class="col-mem">
            <div class="progress-cell">
              <span>{{ formatPercent(getMemPercent(server)) }}</span>
              <div class="progress-bar">
                <div
                  class="progress-fill"
                  :style="{ width: `${getMemPercent(server)}%`, background: getLoadColor(getMemPercent(server)) }"
                />
              </div>
            </div>
          </td>
          <td class="col-disk hide-mobile">
            <div class="progress-cell">
              <span>{{ formatPercent(getDiskPercent(server)) }}</span>
              <div class="progress-bar">
                <div
                  class="progress-fill"
                  :style="{ width: `${getDiskPercent(server)}%`, background: getLoadColor(getDiskPercent(server)) }"
                />
              </div>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { calcTransfer } from '@/utils/host';
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
  const cc = server.Host?.CountryCode;
  if (!cc) return '-';
  return cc.toUpperCase();
}

function getOS(server) {
  const platform = server.Host?.Platform;
  if (!platform) return '-';
  const map = {
    linux: 'Linux',
    windows: 'Windows',
    darwin: 'macOS',
    debian: 'Debian',
    ubuntu: 'Ubuntu',
    centos: 'CentOS',
    alpine: 'Alpine',
    arch: 'Arch',
  };
  return map[platform.toLowerCase()] || platform;
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
  return parts.join('/') || '-';
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
  const t = calcTransfer(max);
  return `${t.value}${t.unit}/s`;
}

function getTransfer(server) {
  const total = (server.State?.NetInTransfer || 0) + (server.State?.NetOutTransfer || 0);
  if (total === 0) return '-';
  const t = calcTransfer(total);
  return `${t.value}${t.unit}`;
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

function formatPercent(val) {
  if (val === undefined || val === null) return '-';
  return `${Math.round(val)}%`;
}

function formatFloat(val) {
  if (val === undefined || val === null) return '-';
  return val.toFixed(2);
}

function getLoadColor(val) {
  if (val === undefined || val === null) return '#64748b';
  if (val < 50) return '#22c55e';
  if (val < 80) return '#f59e0b';
  return '#ef4444';
}
</script>

<style lang="scss" scoped>
.server-table-wrap {
  position: relative;
  overflow-x: auto;
  color: var(--text-primary);
}

.server-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;

  th, td {
    padding: 10px 12px;
    text-align: left;
    white-space: nowrap;
    border-bottom: 1px solid var(--border-color);
    vertical-align: middle;
  }

  th {
    font-weight: 600;
    color: var(--text-secondary);
    background: var(--section-header-bg);
    position: sticky;
    top: 0;
    z-index: 2;
    font-size: 12px;
    text-transform: uppercase;
    box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.03);
  }

  tbody tr {
    cursor: pointer;
    transition: background var(--transition-fast);
    background: var(--table-row-bg);

    &:nth-child(even) {
      background: var(--table-row-alt-bg);
    }

    &:hover {
      background: var(--table-row-hover-bg);
      box-shadow: inset 3px 0 0 var(--accent-primary);
    }

    &.offline {
      opacity: 0.7;
    }
  }

  .col-status { width: 60px; }
  .col-name { min-width: 140px; }
  .col-region { width: 80px; }
  .col-os { width: 80px; }
  .col-spec { width: 100px; }
  .col-uptime { width: 80px; }
  .col-speed { width: 90px; }
  .col-transfer { width: 90px; }
  .col-conn { width: 60px; }
  .col-load { width: 60px; }
  .col-cpu { width: 80px; }
  .col-mem { width: 80px; }
  .col-disk { width: 80px; }

  .col-region,
  .col-spec,
  .col-uptime,
  .col-speed,
  .col-transfer,
  .col-conn,
  .col-load,
  .col-cpu,
  .col-mem,
  .col-disk {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
  }
}

.status-badge {
  display: inline-block;
  padding: 3px 8px;
  border: 1px solid transparent;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;

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

.name-cell {
  display: flex;
  align-items: center;
  gap: 8px;

  .fi {
    font-size: 16px;
    border-radius: 2px;
  }

  .name-text {
    font-weight: 500;
    color: var(--text-primary);
  }
}

.progress-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;

  span {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    font-size: 12px;
    font-weight: 500;
  }
}

.progress-bar {
  width: 100%;
  height: 5px;
  background: var(--progress-track);
  border-radius: 999px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 999px;
  box-shadow: 0 0 12px var(--progress-glow);
  transition: width 0.3s ease;
}

@media screen and (max-width: 768px) {
  .server-table {
    font-size: 12px;

    th, td {
      padding: 8px;
    }

    .col-name {
      min-width: 120px;
    }
  }
}
</style>
