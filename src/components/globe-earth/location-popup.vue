<template>
  <div :class="['location-popup', { mobile, below: placement === 'bottom' }]" @click.stop>
    <div class="popup-header">
      <div class="title-group">
        <h3>{{ location.label }}</h3>
        <div class="popup-stats">
          <span class="stat-chip total">{{ location.totalCount }}台</span>
          <span class="stat-chip online">在线 {{ location.onlineCount }}</span>
          <span class="stat-chip offline">离线 {{ location.offlineCount }}</span>
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
        :class="['server-row', { offline: server.online !== 1 }]"
        @click="openServer(server)"
      >
        <div class="server-main">
          <div class="server-title">
            <span
              v-if="server.Host?.CountryCode"
              :class="`fi fi-${server.Host.CountryCode.toLowerCase()}`"
            />
            <span class="server-name">{{ server.Name }}</span>
          </div>
          <span :class="['status-badge', server.online === 1 ? 'online' : 'offline']">
            {{ server.online === 1 ? '在线' : '离线' }}
          </span>
        </div>
        <div class="server-summary">
          {{ formatSummary(server) }}
        </div>
      </button>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { duration } from '@/utils/date';
import { getSystemOSLabel } from '@/utils/host';

defineEmits(['close']);

defineProps({
  location: {
    type: Object,
    required: true,
  },
  mobile: {
    type: Boolean,
    default: false,
  },
  placement: {
    type: String,
    default: 'top',
  },
});

const router = useRouter();

function openServer(server) {
  router.push(`/server/${server.ID}`);
}

function formatSpec(server) {
  const cpu = server.Host?.CPU?.[0] || '';
  const cores = cpu.match(/(\d+)\s*(Virtual|Physical|Physics)\s*Core/i);
  const coreStr = cores ? `${cores[1]}C` : '';
  const memGB = server.Host?.MemTotal
    ? (server.Host.MemTotal / 1024 / 1024 / 1024).toFixed(0)
    : '';
  const parts = [];

  if (coreStr) {
    parts.push(coreStr);
  }
  if (memGB) {
    parts.push(`${memGB}G`);
  }

  return parts.join('/') || '-';
}

function formatUptime(server) {
  const bootTime = server.Host?.BootTime;
  if (!bootTime) {
    return '-';
  }
  return duration(bootTime * 1000, Date.now(), true);
}

function formatSummary(server) {
  return [
    getSystemOSLabel(server.Host?.Platform) || '-',
    formatSpec(server),
    formatUptime(server),
  ].join(' / ');
}
</script>

<style lang="scss" scoped>
.location-popup {
  position: relative;
  width: min(360px, calc(100vw - 32px));
  max-height: min(440px, calc(100vh - 64px));
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border-radius: 18px;
  background: var(--globe-popup-bg);
  border: 1px solid var(--globe-popup-border);
  box-shadow: var(--globe-popup-shadow);
  backdrop-filter: blur(18px) saturate(145%);
  color: var(--text-primary);

  &::after {
    content: '';
    position: absolute;
    left: 50%;
    width: 14px;
    height: 14px;
    background: var(--globe-popup-bg);
    border-right: 1px solid var(--globe-popup-border);
    border-bottom: 1px solid var(--globe-popup-border);
    transform: translateX(-50%) rotate(45deg);
  }

  &:not(.below)::after {
    bottom: -8px;
  }

  &.below::after {
    top: -8px;
    transform: translateX(-50%) rotate(225deg);
  }

  &.mobile {
    width: 100%;
    max-height: min(56vh, 480px);
    border-radius: 20px 20px 0 0;
    padding: 18px 16px 16px;

    &::after {
      display: none;
    }
  }
}

.popup-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.title-group {
  min-width: 0;

  h3 {
    font-size: 15px;
    font-weight: 700;
    line-height: 1.25;
  }
}

.popup-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.stat-chip {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid var(--globe-popup-chip-border);
  background: var(--globe-popup-chip-bg);
  font-size: 12px;
  color: var(--globe-popup-muted);

  &.total {
    color: var(--text-primary);
  }

  &.online {
    color: var(--badge-online-text);
  }

  &.offline {
    color: var(--badge-offline-text);
  }
}

.close-btn {
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--button-subtle-border);
  border-radius: 10px;
  background: var(--button-subtle-bg);
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    color var(--transition-fast),
    background var(--transition-fast),
    border-color var(--transition-fast);

  &:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
    border-color: var(--button-subtle-hover-border);
  }

  i {
    font-size: 18px;
  }
}

.server-list {
  display: grid;
  gap: 8px;
  min-height: 0;
  overflow-y: auto;
  padding-right: 2px;
}

.server-row {
  width: 100%;
  display: grid;
  gap: 8px;
  padding: 12px 13px;
  border: 1px solid var(--globe-popup-chip-border);
  border-radius: 14px;
  background: var(--globe-popup-list-bg);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast);

  &:hover {
    transform: translateY(-1px);
    background: var(--table-row-hover-bg);
    border-color: var(--border-strong);
    box-shadow: 0 14px 26px rgba(15, 23, 42, 0.1);
  }

  &.offline {
    opacity: 0.84;
  }
}

.server-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.server-title {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;

  .fi {
    font-size: 16px;
    border-radius: 2px;
    flex: 0 0 auto;
  }
}

.server-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
}

.status-badge {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 42px;
  min-height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 11px;
  font-weight: 700;

  &.online {
    color: var(--badge-online-text);
    background: var(--badge-online-bg);
    border-color: var(--badge-online-border);
  }

  &.offline {
    color: var(--badge-offline-text);
    background: var(--badge-offline-bg);
    border-color: var(--badge-offline-border);
  }
}

.server-summary {
  color: var(--globe-popup-muted);
  font-size: 12px;
  line-height: 1.45;
}

@media screen and (max-width: 768px) {
  .location-popup {
    width: 100%;
    max-height: min(58vh, 500px);
  }
}
</style>
