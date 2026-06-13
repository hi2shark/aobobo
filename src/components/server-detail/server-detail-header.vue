<template>
  <div class="server-detail-header">
    <div class="server-flag-box">
      <server-flag :info="info" />
    </div>
    <div class="server-name-and-meta">
      <div class="server-name-row">
        <div class="server-name-group">
          <span class="server-name">{{ info.Name }}</span>
          <span class="server-status-badge">
            <span
              :class="['status-dot', info.online === 1 ? 'online' : 'offline']"
            />
            <span>{{ info.online === 1 ? '在线' : '离线' }}</span>
          </span>
        </div>
        <button
          v-if="locationCode"
          type="button"
          class="globe-focus-btn"
          @click="viewOnGlobe"
        >
          <i class="ri-earth-line" />
          在地球上查看
        </button>
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
          {{ regionLabel }}
        </span>
        <span
          v-if="systemOSLabel"
          class="meta-tag meta-tag--os"
        >
          {{ systemOSLabel }}
        </span>
        <span
          v-if="cpuAndMemAndDisk"
          class="meta-tag meta-tag--spec"
        >
          {{ cpuAndMemAndDisk }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  computed,
} from 'vue';
import { useRouter } from 'vue-router';
import * as hostUtils from '@/utils/host';
import { alias2code, locationCode2Info } from '@/utils/world-map';
import useServerInfo from '@/composables/server-info';
import ServerFlag from '@/components/server-flag.vue';

const props = defineProps({
  info: {
    type: Object,
    default: () => ({}),
  },
});

const router = useRouter();

const { cpuAndMemAndDisk } = useServerInfo({ props });

const slogan = computed(() => props.info?.PublicNote?.customData?.slogan);
const cpuInfo = computed(() => hostUtils.getCPUInfo(props.info?.Host?.CPU?.[0]));
const systemOSLabel = computed(() => {
  if (props.info?.Host?.Platform) {
    return hostUtils.getSystemOSLabel(props.info.Host.Platform);
  }
  return '';
});

const locationCode = computed(() => {
  let aliasCode;
  let code;
  if (props.info?.PublicNote?.customData?.location) {
    aliasCode = props.info.PublicNote.customData.location;
    code = props.info.PublicNote.customData.location;
  } else if (props.info?.Host?.CountryCode) {
    aliasCode = props.info.Host.CountryCode.toUpperCase();
  }
  return alias2code(aliasCode) || code || '';
});

const regionLabel = computed(() => {
  const code = locationCode.value;
  if (!code) {
    return '';
  }
  const locInfo = locationCode2Info(code);
  if (locInfo?.name) {
    return locInfo.name;
  }
  return code;
});

function viewOnGlobe() {
  if (!locationCode.value) {
    return;
  }
  router.push({
    name: 'Home',
    query: { focus: locationCode.value },
  });
}
</script>

<style lang="scss" scoped>
.server-detail-header {
  display: flex;
  gap: 14px;
  transition: 0.3s;

  .server-flag-box {
    --flag-size: 72px;
    position: relative;
    flex: 0 0 auto;
    width: calc(var(--flag-size) * 1.33333333);
    height: var(--flag-size);
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid var(--border-color);

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

    @media screen and (max-width: 500px) {
      --flag-size: 40px;
      border-radius: 6px;
    }
  }

  .server-name-and-meta {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 4px 0;
  }

  .server-name-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .server-name-group {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    min-width: 0;

    .server-name {
      line-height: 1.3;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: var(--text-primary);
    }
  }

  .server-status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 30px;
    padding: 0 11px;
    border-radius: 999px;
    border: 1px solid var(--panel-chip-border);
    background: var(--panel-chip-bg);
    font-size: 11px;
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    color: var(--panel-chip-text);
    white-space: nowrap;

    .status-dot {
      width: 8px;
      height: 8px;
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
    min-height: 34px;
    padding: 0 12px;
    border-radius: 999px;
    border: 1px solid var(--button-subtle-border);
    background: var(--button-subtle-bg);
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition:
      color var(--transition-fast),
      background var(--transition-fast),
      border-color var(--transition-fast),
      box-shadow var(--transition-fast);

    &:hover {
      color: var(--text-on-accent);
      background: var(--button-active-bg);
      border-color: var(--button-active-border);
      box-shadow: var(--button-active-shadow);
    }
  }

  .slogan-content {
    color: var(--text-secondary);
    line-height: 1.4;
    font-size: 14px;
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
      padding: 0 5px;
      border-radius: 4px;
      color: #111;
      background: #e0fcff;
      font-size: 12px;
      font-weight: 600;

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
        border-radius: 3px;
      }
    }

    .cpu-model {
      color: var(--text-primary);
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

  @media screen and (max-width: 500px) {
    .server-name-group .server-name {
      font-size: 18px;
    }
  }
}
</style>
