<template>
  <div :class="['location-popup', { mobile }]" @click.stop>
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
    inset: 0 0 auto;
    height: 76px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.08), transparent 78%),
      radial-gradient(circle at top left, rgba(var(--accent-cyan-rgb), 0.08), transparent 46%);
    pointer-events: none;
  }

  &.mobile {
    width: 100%;
    max-height: min(56vh, 480px);
    border-radius: 24px 24px 0 0;
    padding: 18px 16px 16px;
  }
}

.popup-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  position: relative;
  z-index: 1;
}

.title-group {
  min-width: 0;

  h3 {
    font-size: 17px;
    font-weight: 700;
    line-height: 1.25;
    letter-spacing: -0.01em;
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
  gap: 10px;
  min-height: 0;
  overflow-y: auto;
  padding-right: 2px;
  position: relative;
  z-index: 1;
}

.server-row {
  width: 100%;
  display: grid;
  gap: 8px;
  padding: 13px 14px;
  border: 1px solid var(--globe-popup-chip-border);
  border-radius: 18px;
  background: var(--globe-popup-list-bg);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);

  &:hover {
    transform: translateY(-2px);
    background: var(--table-row-hover-bg);
    border-color: var(--border-strong);
    box-shadow:
      0 16px 30px rgba(15, 23, 42, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  &.offline {
    opacity: 0.92;
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
  font-size: 14px;
  font-weight: 650;
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
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);

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
