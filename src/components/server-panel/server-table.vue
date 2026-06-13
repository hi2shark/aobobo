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
          <span class="server-list-item__status">
            <span
              :class="['status-dot', server.online === 1 ? 'online' : 'offline']"
            />
            <span>{{ server.online === 1 ? '在线' : '离线' }}</span>
          </span>
        </div>
        <div
          v-if="getRegion(server) || getOS(server) || getSpec(server)"
          class="server-list-item__tags"
        >
          <span v-if="getRegion(server)" class="meta-tag meta-tag--region">
            {{ getRegion(server) }}
          </span>
          <span v-if="getOS(server)" class="meta-tag meta-tag--os">
            {{ getOS(server) }}
          </span>
          <span v-if="getSpec(server)" class="meta-tag meta-tag--spec">
            {{ getSpec(server) }}
          </span>
        </div>
      </div>
    </button>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { alias2code, locationCode2Info } from '@/utils/world-map';
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
  const raw = server?.PublicNote?.customData?.location
    || server?.Host?.CountryCode?.toUpperCase();
  if (!raw) {
    return '';
  }
  const code = alias2code(raw) || raw;
  const info = locationCode2Info(code);
  if (info?.name) {
    return info.country && info.name !== info.country
      ? `${info.name}`
      : info.name;
  }
  return raw;
}

function getOS(server) {
  return getSystemOSLabel(server?.Host?.Platform) || '';
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

  return parts.join(' / ') || '';
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
