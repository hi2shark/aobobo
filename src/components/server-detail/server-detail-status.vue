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
          <div class="resource-icon">
            <i :class="resourceIcon(item.type)" />
          </div>
          <div class="resource-body">
            <div class="resource-main">
              <div class="resource-value">
                <span class="resource-percent">{{ item.valPercent }}</span>
                <span class="resource-label">{{ item.label }}</span>
              </div>
              <div class="resource-capacity">
                <span class="resource-used">{{ item.valText }}</span>
                <span class="resource-total resource-total--desktop">/ {{ item.content?.default }}</span>
                <span class="resource-total resource-total--mobile">/ {{ item.content?.mobile || item.content?.default }}</span>
              </div>
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
    </div>

    <div class="status-section">
      <h3 class="section-title">
        <i class="ri-speed-line" />
        实时数据
      </h3>
      <server-real-time
        :info="info"
        server-real-time-list-tpls="availability,duration,transfer,speeds"
      />
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
  gap: 14px;
  padding: 14px 18px;

  --real-time-value-font-size: 22px;
  --real-time-text-font-size: 11px;
  --real-time-label-font-size: 11px;

  .status-section {
    display: flex;
    flex-direction: column;
    gap: 8px;

    &:not(:first-child) {
      padding-top: 12px;
      border-top: 1px solid var(--border-color);
    }

  }

  .section-title {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin: 0;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: -0.01em;
    line-height: 1;
    color: var(--text-primary);

    i {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--accent-primary);
      font-size: 16px;
      line-height: 1;
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
  }
}

.resource-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  background: var(--panel-metric-bg);
  border: 1px solid var(--panel-stat-border);
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast),
    transform var(--transition-fast);

  @media (hover: hover) {
    &:hover {
      background: var(--bg-hover);
      border-color: var(--border-strong);
      transform: translateY(-1px);
    }
  }
}

.resource-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: rgba(var(--accent-primary-rgb), 0.12);
  color: var(--accent-primary);
  font-size: 15px;
}

.resource-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.resource-main {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px;
}

.resource-value {
  display: flex;
  align-items: baseline;
  flex-shrink: 0;
  gap: 5px;
  line-height: 1;

  .resource-percent {
    font-size: 16px;
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
  gap: 3px;
  min-width: 0;
  font-size: 10px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  .resource-used {
    font-weight: 600;
    color: var(--text-primary);
  }

  .resource-total {
    color: var(--text-muted);
  }
}

.resource-progress {
  height: 4px;
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

.resource-total--mobile {
  display: none;
}

@media screen and (max-width: 900px) {
  .resource-total--desktop {
    display: none;
  }

  .resource-total--mobile {
    display: inline;
  }
}

@media screen and (max-width: 768px) {
  .server-detail-status {
    padding: 10px 12px;
    gap: 10px;
    --real-time-value-font-size: 16px;
    --real-time-text-font-size: 10px;
    --real-time-label-font-size: 10px;

    .status-section {
      gap: 6px;

      &:not(:first-child) {
        padding-top: 10px;
      }
    }

    .section-title {
      font-size: 13px;

      i {
        font-size: 15px;
      }
    }
  }

  .resource-grid {
    gap: 8px;
    grid-template-columns: 1fr;

    &.resource-count--1,
    &.resource-count--2,
    &.resource-count--3 {
      grid-template-columns: 1fr;
    }
  }

  .resource-card {
    padding: 8px 10px;
    gap: 8px;
  }

  .resource-icon {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    font-size: 13px;
  }

  .resource-body {
    gap: 5px;
  }

  .resource-value {
    .resource-percent {
      font-size: 15px;
    }

    .resource-label {
      font-size: 10px;
    }
  }

  .resource-capacity {
    font-size: 9px;
  }

  .resource-progress {
    height: 3px;
  }

  .resource-card:last-child:nth-child(odd) {
    grid-column: auto;
  }
}
</style>
