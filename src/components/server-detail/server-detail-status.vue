<template>
  <detail-panel
    variant="flat"
    class="server-detail-status"
  >
    <div class="status-section">
      <h3 class="section-title">
        <i class="ri-dashboard-3-line" />
        资源使用
      </h3>
      <div
        class="resource-grid"
        :class="'resource-count--' + serverStatusList.length"
      >
        <div
          v-for="item in serverStatusList"
          :key="item.type"
          class="resource-card"
          :class="'resource-card--' + item.type"
        >
          <div class="resource-card-head">
            <div class="resource-icon">
              <i :class="resourceIcon(item.type)" />
            </div>
            <div class="resource-value">
              <span class="resource-percent">{{ item.valPercent }}</span>
              <span class="resource-label">{{ item.label }}</span>
            </div>
          </div>
          <div class="resource-capacity">
            <span class="resource-used">{{ item.valText }}</span>
            <span class="resource-total">/ {{ item.content?.default }}</span>
          </div>
          <div class="resource-progress">
            <div
              class="resource-progress-bar"
              :style="progressStyle(item)"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="status-section">
      <h3 class="section-title">
        <i class="ri-speed-line" />
        实时数据
      </h3>
      <server-real-time :info="info" />
    </div>
  </detail-panel>
</template>

<script setup>
/**
 * 服务器状态组
 */
import useServerStatus from '@/composables/server-status';
import DetailPanel from '@/components/server-detail/detail-panel.vue';
import ServerRealTime from '@/components/server/server-real-time.vue';

const props = defineProps({
  info: {
    type: Object,
    default: () => ({}),
  },
});

const {
  serverStatusList,
} = useServerStatus({
  props,
  statusListTpl: 'cpu,mem,swap,disk',
});

function resourceIcon(type) {
  const map = {
    cpu: 'ri-cpu-line',
    mem: 'ri-server-line',
    swap: 'ri-hard-drive-2-line',
    disk: 'ri-database-2-line',
  };
  return map[type] || 'ri-dashboard-line';
}

function progressStyle(item) {
  const style = { width: `${Math.min(item.used, 100)}%` };
  const color = typeof item.colors === 'string' ? item.colors : item.colors?.used;
  if (color) {
    if (Array.isArray(color)) {
      style.background = `linear-gradient(90deg, ${color.join(',')})`;
    } else {
      style.backgroundColor = color;
    }
  }
  return style;
}
</script>

<style lang="scss" scoped>
.server-detail-status {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 16px 18px;

  --real-time-value-font-size: 24px;
  --real-time-text-font-size: 12px;
  --real-time-label-font-size: 11px;

  .status-section {
    display: flex;
    flex-direction: column;
    gap: 10px;

    &:not(:first-child) {
      padding-top: 14px;
      border-top: 1px solid var(--border-color);
    }

  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    font-size: 14px;
    font-weight: 700;
    color: var(--text-primary);

    i {
      color: var(--accent-primary);
      font-size: 16px;
    }
  }
}

.resource-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(4, minmax(0, 1fr));

  &.resource-count--1 {
    grid-template-columns: 1fr;
  }

  &.resource-count--2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  &.resource-count--3 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media screen and (max-width: 900px) {
  .resource-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));

    &.resource-count--3 {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
}

.resource-card {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  background: var(--panel-metric-bg);
  border: 1px solid var(--panel-stat-border);
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast),
    transform var(--transition-fast);

  &:hover {
    background: var(--bg-hover);
    border-color: var(--border-strong);
    transform: translateY(-1px);
  }
}

.resource-card-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.resource-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background: rgba(var(--accent-primary-rgb), 0.12);
  color: var(--accent-primary);
  font-size: 17px;
}

.resource-value {
  display: flex;
  flex-direction: column;
  line-height: 1.15;

  .resource-percent {
    font-size: 19px;
    font-weight: 700;
    font-family: var(--font-mono);
    color: var(--text-primary);
  }

  .resource-label {
    font-size: 11px;
    color: var(--text-muted);
  }
}

.resource-capacity {
  display: flex;
  align-items: baseline;
  gap: 4px;
  font-size: 11px;
  color: var(--text-secondary);

  .resource-used {
    font-weight: 600;
    color: var(--text-primary);
  }

  .resource-total {
    color: var(--text-muted);
  }
}

.resource-progress {
  height: 5px;
  border-radius: 999px;
  background: var(--progress-track);
  overflow: hidden;
}

.resource-progress-bar {
  height: 100%;
  border-radius: 999px;
  transition: width 0.4s ease;
  min-width: 2px;
}

@media screen and (max-width: 480px) {
  .server-detail-status {
    padding: 14px 16px;
    --real-time-value-font-size: 20px;
  }

  .resource-grid {
    grid-template-columns: 1fr;
  }

  .resource-card:last-child:nth-child(odd) {
    grid-column: auto;
  }
}
</style>
