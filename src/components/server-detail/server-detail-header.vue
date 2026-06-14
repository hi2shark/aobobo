<template>
  <div class="server-detail-header">
    <div class="server-identity">
      <div class="server-flag-box">
        <server-flag :info="info" />
      </div>
      <div class="server-name-and-meta">
        <div class="server-name-row">
          <h2 class="server-name">{{ info.Name }}</h2>
          <span class="server-status-badge">
            <span :class="['status-dot', info.online === 1 ? 'online' : 'offline']" />
            <span>{{ info.online === 1 ? '在线' : '离线' }}</span>
          </span>
        </div>

        <div
          v-if="slogan"
          class="slogan-content"
        >
          <span>“{{ slogan }}”</span>
        </div>
        <div
          v-else-if="cpuInfo?.model"
          class="cpu-model-info"
        >
          <span
            v-if="cpuInfo.company"
            class="cpu-company"
            :class="'cpu-company--' + cpuInfo.company.toLowerCase()"
          >
            {{ cpuInfo.company }}
          </span>
          <span
            v-if="cpuInfo.model"
            class="cpu-model"
          >
            {{ cpuInfo.model }}
          </span>
          <span
            v-if="cpuInfo.modelNum"
            class="cpu-model-num"
          >
            {{ cpuInfo.modelNum }}
          </span>
        </div>

        <div
          v-if="regionLabel || systemOSLabel || cpuAndMemAndDisk"
          class="meta-tag-row"
        >
          <span
            v-if="regionLabel"
            class="meta-tag meta-tag--region"
          >
            <i class="ri-map-pin-line" />
            {{ regionLabel }}
          </span>
          <span
            v-if="systemOSLabel"
            class="meta-tag meta-tag--os"
          >
            <i class="ri-ubuntu-line" />
            {{ systemOSLabel }}
          </span>
          <span
            v-if="cpuAndMemAndDisk"
            class="meta-tag meta-tag--spec"
          >
            <i class="ri-cpu-line" />
            {{ cpuAndMemAndDisk }}
          </span>
        </div>
      </div>
    </div>

    <button
      v-if="locationCode"
      type="button"
      class="globe-focus-btn"
      @click="viewOnGlobe"
    >
      <i class="ri-earth-line" />
      <span>在地球上查看</span>
    </button>
  </div>
</template>

<script setup>
import {
  computed,
} from 'vue';
import { useRouter } from 'vue-router';
import { useStore } from 'vuex';
import * as hostUtils from '@/utils/host';
import { resolveServerLocation } from '@/utils/world-map';
import useServerInfo from '@/composables/server-info';
import ServerFlag from '@/components/server-flag.vue';

const props = defineProps({
  info: {
    type: Object,
    default: () => ({}),
  },
});

const router = useRouter();
const store = useStore();

const { cpuAndMemAndDisk } = useServerInfo({ props });

const slogan = computed(() => props.info?.PublicNote?.customData?.slogan);
const cpuInfo = computed(() => hostUtils.getCPUInfo(props.info?.Host?.CPU?.[0]));
const systemOSLabel = computed(() => {
  if (props.info?.Host?.Platform) {
    return hostUtils.getSystemOSLabel(props.info.Host.Platform);
  }
  return '';
});

const resolvedLocation = computed(() => resolveServerLocation(props.info));

const locationCode = computed(() => resolvedLocation.value?.code || '');

const regionLabel = computed(() => {
  const loc = resolvedLocation.value;
  if (!loc) {
    return '';
  }
  if (loc.source === 'manual') {
    return loc.name || '自定义位置';
  }
  return loc.name || loc.code;
});

function viewOnGlobe() {
  if (!locationCode.value) {
    return;
  }
  store.dispatch('focusGlobeOnServer', {
    code: locationCode.value,
    name: props.info?.Name || '',
  });
  router.push({
    name: 'Home',
  });
}
</script>

<style lang="scss" scoped>
.server-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 18px;
  transition: 0.3s;

  .server-identity {
    display: flex;
    align-items: center;
    gap: 16px;
    min-width: 0;
  }

  .server-flag-box {
    --flag-size: 56px;
    position: relative;
    flex: 0 0 auto;
    width: calc(var(--flag-size) * 1.33333333);
    height: var(--flag-size);
    border-radius: 14px;
    overflow: hidden;
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-sm);

    .server-flag {
      position: absolute;
      top: 50%;
      left: 50%;
      width: calc(var(--flag-size) * 1.33333333);
      height: var(--flag-size);
      line-height: var(--flag-size);
      font-size: var(--flag-size);
      transform: translate(-50%, -50%);
    }
  }

  .server-name-and-meta {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .server-name-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .server-name {
    line-height: 1.2;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text-primary);
  }

  .server-status-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 26px;
    padding: 0 10px;
    border-radius: 999px;
    border: 1px solid var(--panel-chip-border);
    background: var(--panel-chip-bg);
    font-size: 12px;
    font-family: var(--font-mono);
    font-weight: 600;
    color: var(--panel-chip-text);
    white-space: nowrap;

    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;

      &.online {
        background: var(--accent-success);
        box-shadow: var(--status-online-glow);
      }

      &.offline {
        background: var(--accent-danger);
        box-shadow: var(--status-offline-glow);
      }
    }
  }

  .globe-focus-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    height: 36px;
    padding: 0 14px;
    border-radius: 999px;
    border: 1px solid var(--button-subtle-border);
    background: var(--button-subtle-bg);
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 600;
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
      font-size: 16px;
    }
  }

  .slogan-content {
    color: var(--text-secondary);
    line-height: 1.4;
    font-size: 13px;
  }

  .cpu-model-info {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    line-height: 1.4;
    color: var(--text-secondary);
    font-size: 13px;

    .cpu-company {
      height: 22px;
      line-height: 22px;
      padding: 0 6px;
      border-radius: 5px;
      color: #111;
      background: #e0fcff;
      font-size: 11px;
      font-weight: 700;

      &--intel {
        text-transform: lowercase;
        color: #fff;
        background: #0068b5;
      }

      &--amd {
        font-weight: bold;
      }

      &--apple {
        font-weight: 600;
        border-radius: 4px;
      }
    }

    .cpu-model {
      color: var(--text-primary);
      font-weight: 500;
    }

    .cpu-model-num {
      color: var(--text-muted);
    }
  }

  .meta-tag-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .meta-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 24px;
    padding: 0 8px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
    background: var(--panel-stat-bg);
    border: 1px solid var(--panel-stat-border);

    i {
      font-size: 13px;
      color: var(--accent-primary);
    }
  }
}

@media screen and (max-width: 768px) {
  .server-detail-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 14px;

    .server-flag-box {
      --flag-size: 48px;
      border-radius: 10px;
    }

    .server-name {
      font-size: 17px;
    }

    .globe-focus-btn {
      width: 100%;
      justify-content: center;
      height: 34px;
      font-size: 12px;
    }
  }
}
</style>
