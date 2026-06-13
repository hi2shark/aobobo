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
          <span class="name-text-wrap">
            <span class="name-text" :title="server.Name">{{ server.Name || '-' }}</span>
          </span>
        </div>
        <span :class="['status-badge', server.online === 1 ? 'online' : 'offline']">
          {{ server.online === 1 ? '在线' : '离线' }}
        </span>
      </div>

      <div class="row-summary" :title="getSummary(server)">
        {{ getSummary(server) }}
      </div>
    </button>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { getSystemOSLabel } from '@/utils/host';

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

function getSummary(server) {
  const parts = [
    getRegion(server),
    getOS(server),
    getSpec(server),
  ].filter((value) => value && value !== '-');

  return parts.join(' · ') || '-';
}
</script>

<style lang="scss" scoped>
.server-table-wrap {
  flex: 1;
  min-height: 0;
  display: grid;
  align-content: start;
  gap: 8px;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px 12px 14px;
  color: var(--text-primary);
  scrollbar-gutter: stable;
}

.server-row {
  width: 100%;
  display: grid;
  gap: 8px;
  padding: 16px 18px;
  appearance: none;
  border: 1px solid var(--panel-row-border);
  border-radius: 18px;
  background: var(--panel-row-bg);
  box-shadow: var(--panel-row-shadow);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast);

  &::after {
    content: '';
    position: absolute;
    inset: 0 0 auto;
    height: 38px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.06), transparent 86%),
      radial-gradient(circle at top left, rgba(var(--accent-cyan-rgb), 0.05), transparent 48%);
    pointer-events: none;
  }

  &:hover,
  &:focus-visible {
    transform: translateY(-2px);
    outline: none;
    border-color: var(--panel-row-hover-border);
    background: var(--panel-row-hover-bg);
    box-shadow: var(--panel-row-hover-shadow);
  }

  &.offline {
    background: var(--panel-row-offline-bg);
    border-color: var(--panel-row-offline-border);
    opacity: 0.94;
  }
}

.row-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  min-width: 0;
  position: relative;
  z-index: 1;
}

.name-group {
  min-width: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 8px;
  align-items: center;

  .fi,
  .flag-placeholder {
    width: 16px;
    font-size: 16px;
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

.name-text-wrap {
  min-width: 0;
  width: 100%;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.7;
}

.name-text {
  font-size: 14px;
  font-weight: 700;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 0 9px;
  border: 1px solid transparent;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
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

.row-summary {
  min-width: 0;
  position: relative;
  z-index: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  line-height: 1.45;
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.offline {
  .name-text,
  .row-summary {
    color: var(--text-secondary);
  }
}

@media screen and (max-width: 768px) {
  .server-table-wrap {
    padding: 14px;
    gap: 8px;
  }

  .server-row {
    padding: 12px 13px;
    border-radius: 18px;
  }
}
</style>
