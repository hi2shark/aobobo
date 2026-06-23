<template>
  <div
    class="server-real-time-group"
    :class="'real-time-count--' + serverRealTimeList.length"
  >
    <div
      v-for="item in serverRealTimeList"
      :key="item.key"
      class="server-real-time-item"
      :class="[`server-real-time--${item.key}`, item.class]"
    >
      <span class="item-label">{{ item.label }}</span>
      <div class="item-content">
        <div
          v-if="item.show && item.values"
          class="item-content-sub-group"
        >
          <span
            v-for="subItem in item.values"
            :key="`${item.key}_${subItem.key}`"
            class="item-content-sub-item"
            :class="`item-content-sub-item--${item.key}-${subItem.key}`"
          >
            <span class="item-content-sub-label">
              {{ subItem.label }}
            </span>
            <span class="item-content-sub-content">
              <span class="item-value">{{ subItem.show ? subItem?.value : '-' }}</span>
              <span
                v-if="subItem.show"
                class="item-unit item-text"
              >{{ subItem?.unit }}</span>
            </span>
          </span>
        </div>
        <template v-else>
          <span class="item-value">{{ item.show ? item?.value : '-' }}</span>
          <span
            v-if="item.show"
            class="item-unit item-text"
          >{{ item?.unit }}</span>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * 服务器数据统计
 */
import {
  inject,
} from 'vue';
import handleServerRealTime from '@/composables/server-real-time';

const props = defineProps({
  info: {
    type: Object,
    default: () => ({}),
  },
  serverRealTimeListTpls: {
    type: String,
    default: undefined,
  },
});

const currentTime = inject('currentTime', {
  value: Date.now(),
});

const {
  serverRealTimeList,
} = handleServerRealTime({
  props,
  currentTime,
  serverRealTimeListTpls: props.serverRealTimeListTpls,
});
</script>

<style lang="scss" scoped>
.server-real-time-group {
  display: grid;
  gap: 8px;

  &.real-time-count--1 {
    grid-template-columns: 1fr;
  }

  &.real-time-count--2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  &.real-time-count--3 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  &.real-time-count--4,
  &.real-time-count--5,
  &.real-time-count--6 {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .server-real-time-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 3px;
    padding: 8px 10px;
    border-radius: var(--radius-md);
    background: var(--panel-stat-bg);
    border: 1px solid var(--panel-stat-border);
    cursor: default;
    transition:
      background var(--transition-fast),
      border-color var(--transition-fast),
      transform var(--transition-fast);

    &:hover {
      background: var(--bg-hover);
      border-color: var(--border-strong);
      transform: translateY(-1px);
    }

    .item-value {
      line-height: 1.1;
      font-size: var(--real-time-value-font-size, 22px);
      font-family: var(--font-mono);
      font-variant-numeric: tabular-nums;
      font-weight: 700;
    }

    .item-content {
      display: flex;
      align-items: flex-end;
      gap: 2px;
    }

    .item-text {
      line-height: 1.3em;
      font-size: var(--real-time-text-font-size, 11px);
      color: var(--text-secondary);
    }

    .item-label {
      line-height: 1.2em;
      font-size: var(--real-time-label-font-size, 11px);
      color: var(--text-muted);
      font-weight: 500;
    }

    .item-content-sub-group {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 3px;

      .item-content-sub-item {
        display: flex;
        align-items: center;
        gap: 0.3em;
      }

      --real-time-label-line-height: calc(var(--real-time-label-font-size, 11px) * 1.5);

      .item-content-sub-label {
        height: var(--real-time-label-line-height);
        line-height: var(--real-time-label-line-height);
        white-space: nowrap;
        color: var(--text-muted);
        font-size: var(--real-time-label-font-size, 11px);
      }

      .item-content-sub-content {
        display: flex;
        align-items: center;
        white-space: nowrap;
      }

      .item-value,
      .item-text,
      .item-label {
        height: var(--real-time-label-line-height);
        line-height: var(--real-time-label-line-height);
        font-size: var(--real-time-label-font-size, 11px);
      }

      .item-content-sub-item--L-A-P-load {
        .item-value {
          color: var(--load-color);
        }
      }
      .item-content-sub-item--L-A-P-process {
        .item-value {
          color: var(--process-color);
        }
      }

      .item-content-sub-item--D-A-T-duration {
        .item-value {
          color: var(--duration-color);
        }
      }
      .item-content-sub-item--D-A-T-transfer {
        .item-value {
          color: var(--transfer-color);
        }
      }

      .item-content-sub-item--speeds-in {
        .item-value {
          color: var(--net-speed-in-color);
        }
      }
      .item-content-sub-item--speeds-out {
        .item-value {
          color: var(--net-speed-out-color);
        }
      }

      .item-content-sub-item--conn-tcp {
        .item-value {
          color: var(--conn-tcp-color);
        }
      }
      .item-content-sub-item--conn-udp {
        .item-value {
          color: var(--conn-udp-color);
        }
      }
    }
  }

  .server-real-time--duration {
    .item-value {
      color: var(--duration-color);
    }
  }
  .server-real-time--transfer {
    .item-value {
      color: var(--transfer-color);
    }
  }
  .server-real-time--inSpeed,
  .server-real-time--speed {
    .item-value {
      color: var(--net-speed-in-color);
    }
  }
  .server-real-time--outSpeed {
    .item-value {
      color: var(--net-speed-out-color);
    }
  }

  .server-real-time--availability {
    &.availability-status--success .item-value {
      color: var(--accent-success);
    }

    &.availability-status--warning .item-value {
      color: var(--accent-warning);
    }

    &.availability-status--danger .item-value {
      color: var(--accent-danger);
    }
  }
}

@media screen and (max-width: 900px) {
  .server-real-time-group {
    &.real-time-count--1,
    &.real-time-count--2,
    &.real-time-count--3,
    &.real-time-count--4,
    &.real-time-count--5,
    &.real-time-count--6 {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
}

@media screen and (max-width: 768px) {
  .server-real-time-group {
    gap: 6px;

    --real-time-value-font-size: 16px;
    --real-time-text-font-size: 10px;
    --real-time-label-font-size: 10px;

    .server-real-time-item {
      padding: 6px 8px;
      gap: 2px;
    }

    .item-content-sub-group {
      gap: 2px;
    }
  }
}
</style>
