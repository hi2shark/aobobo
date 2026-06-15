<template>
  <detail-panel
    variant="flat"
    class="server-detail-info"
  >
    <div class="info-grid">
      <div
        v-if="info?.Host?.CPU?.length"
        class="info-cell info-cell--full"
      >
        <div class="info-cell-label">
          <i class="ri-cpu-line" />
          <span>CPU</span>
        </div>
        <div class="info-cell-content">
          <template v-if="info?.Host?.CPU?.length === 1">
            <span
              class="cpu-info"
              :title="info.Host.CPU[0]"
            >
              {{ info.Host.CPU[0] }}
            </span>
          </template>
          <div
            v-else
            class="info-chip-group"
          >
            <span
              v-for="(cpuItem, cpuIndex) in info.Host.CPU"
              :key="`${info.ID}_cpu_${cpuIndex}`"
              class="info-chip"
            >
              <span class="info-chip-label">CPU.{{ cpuIndex + 1 }}</span>
              <span class="info-chip-value">{{ cpuItem }}</span>
            </span>
          </div>
        </div>
      </div>

      <div
        v-if="gpuList.length"
        class="info-cell info-cell--full"
      >
        <div class="info-cell-label">
          <i class="ri-gamepad-line" />
          <span>GPU</span>
        </div>
        <div class="info-cell-content">
          <template v-if="gpuList.length === 1">
            <span
              class="gpu-info"
              :title="gpuList[0]"
            >
              {{ gpuList[0] }}
            </span>
          </template>
          <div
            v-else
            class="info-chip-group"
          >
            <span
              v-for="(gpuItem, gpuIndex) in gpuList"
              :key="`${info.ID}_gpu_${gpuIndex}`"
              class="info-chip"
            >
              <span class="info-chip-label">GPU.{{ gpuIndex + 1 }}</span>
              <span class="info-chip-value">{{ gpuItem }}</span>
            </span>
          </div>
        </div>
      </div>

      <div
        v-if="temperatureData.list.length"
        class="info-cell info-cell--full"
      >
        <div class="info-cell-label">
          <i class="ri-temp-hot-line" />
          <span>温度</span>
        </div>
        <div class="info-cell-content">
          <div class="info-chip-group">
            <span
              v-for="(ttItem, ttIndex) in temperatureData.list"
              :key="`${info.ID}_temperature_${ttIndex}`"
              class="info-chip"
              :class="`temperature--${ttItem.type}`"
              :title="ttItem?.title || (`${ttItem.label}: ${ttItem.value}`)"
            >
              <span class="info-chip-label">
                <i
                  v-if="ttItem.type === 'cpu' || ttItem.label.toLowerCase().includes('cpu')"
                  class="ri-cpu-line"
                />
                <i
                  v-else-if="ttItem.type === 'gpu' || ttItem.label.toLowerCase().includes('gpu')"
                  class="ri-gamepad-line"
                />
                <i
                  v-else-if="ttItem.type === 'nvme' || ttItem.label.toLowerCase().includes('nvme')"
                  class="ri-hard-drive-3-line"
                />
                <i
                  v-else-if="ttItem.type === 'motherboard'"
                  class="ri-instance-line"
                />
                <i
                  v-else
                  class="ri-temp-hot-line"
                />
                {{ ttItem.label }}
              </span>
              <span class="info-chip-value">{{ ttItem.value }}</span>
            </span>
          </div>
        </div>
      </div>

      <div class="info-cell">
        <div class="info-cell-label">
          <i :class="systemOSIcon" />
          <span>系统</span>
        </div>
        <div class="info-cell-content">
          <span class="info-chip">
            <span class="info-chip-label">{{ systemOSLabel }}</span>
            <span
              v-if="info?.Host?.PlatformVersion"
              class="info-chip-value"
            >
              {{ info?.Host?.PlatformVersion }}
            </span>
          </span>
        </div>
      </div>

      <div class="info-cell">
        <div class="info-cell-label">
          <i class="ri-pulse-line" />
          <span>占用</span>
        </div>
        <div class="info-cell-content">
          <div class="info-chip-group">
            <span class="info-chip">
              <span class="info-chip-label">进程</span>
              <span class="info-chip-value">{{ processCount }}</span>
            </span>
            <span class="info-chip">
              <span class="info-chip-label">负载</span>
              <span class="info-chip-value">{{ sysLoadInfo }}</span>
            </span>
          </div>
        </div>
      </div>

      <div class="info-cell">
        <div class="info-cell-label">
          <i class="ri-arrow-up-down-line" />
          <span>流量</span>
        </div>
        <div class="info-cell-content">
          <div class="info-chip-group">
            <span class="info-chip transfer--in">
              <span class="info-chip-label">入网</span>
              <span class="info-chip-value">
                <span class="text-value">{{ transfer?.in?.value }}</span>
                <span class="text-unit">{{ transfer?.in?.unit }}</span>
              </span>
            </span>
            <span class="info-chip transfer--out">
              <span class="info-chip-label">出网</span>
              <span class="info-chip-value">
                <span class="text-value">{{ transfer?.out?.value }}</span>
                <span class="text-unit">{{ transfer?.out?.unit }}</span>
              </span>
            </span>
          </div>
        </div>
      </div>

      <div
        v-if="!hideConns"
        class="info-cell"
      >
        <div class="info-cell-label">
          <i class="ri-link-m" />
          <span>连接</span>
        </div>
        <div class="info-cell-content">
          <div class="info-chip-group">
            <span class="info-chip conn--tcp">
              <span class="info-chip-label">TCP</span>
              <span class="info-chip-value">{{ tcpConnCount }}</span>
            </span>
            <span class="info-chip conn--udp">
              <span class="info-chip-label">UDP</span>
              <span class="info-chip-value">{{ udpConnCount }}</span>
            </span>
          </div>
        </div>
      </div>

      <div class="info-cell">
        <div class="info-cell-label">
          <i class="ri-restart-line" />
          <span>启动</span>
        </div>
        <div class="info-cell-content">
          <span class="info-chip">
            <span class="info-chip-value">{{ bootTime }}</span>
          </span>
        </div>
      </div>

      <div class="info-cell">
        <div class="info-cell-label">
          <i class="ri-time-line" />
          <span>活跃</span>
        </div>
        <div class="info-cell-content">
          <span class="info-chip">
            <span class="info-chip-value">{{ lastActive }}</span>
          </span>
        </div>
      </div>

      <div
        v-if="billPlanData.length"
        class="info-cell info-cell--full"
      >
        <div class="info-cell-label">
          <i class="ri-vip-crown-line" />
          <span>套餐</span>
        </div>
        <div class="info-cell-content">
          <div class="info-chip-group">
            <span
              v-for="item in billPlanData"
              :key="item.label"
              class="info-chip"
            >
              <span
                v-if="item.label"
                class="info-chip-label"
              >{{ item.label }}</span>
              <span class="info-chip-value">{{ item.value }}</span>
            </span>
          </div>
        </div>
      </div>

      <div
        v-if="tagList?.length"
        class="info-cell info-cell--full"
      >
        <div class="info-cell-label">
          <i class="ri-price-tag-3-line" />
          <span>标签</span>
        </div>
        <div class="info-cell-content">
          <div class="info-tag-list">
            <span
              v-for="(tag, index) in tagList"
              :key="`${tag}_${index}`"
              class="info-tag-item"
            >
              {{ tag }}
            </span>
          </div>
        </div>
      </div>

      <div
        v-if="showBuyBtn"
        class="info-cell info-cell--full info-cell--action"
      >
        <div
          class="buy-btn"
          @click.stop="toBuy"
        >
          <span :class="buyBtnIcon" />
          <span>{{ buyBtnText }}</span>
        </div>
      </div>
    </div>
  </detail-panel>
</template>

<script setup>
/**
 * 服务器信息盒子
 */
import {
  computed,
} from 'vue';
import { useStore } from 'vuex';
import dayjs from 'dayjs';
import config from '@/config';
import * as hostUtils from '@/utils/host';
import { isTsdbEnabled } from '@/utils/tsdb';
import useServerBillAndPlan from '@/composables/server-bill-and-plan';
import DetailPanel from '@/components/server-detail/detail-panel.vue';

const props = defineProps({
  info: {
    type: Object,
    default: () => ({}),
  },
});

const store = useStore();

const buyBtnIcon = computed(() => {
  if (props.info?.PublicNote?.customData?.buyBtnIcon) {
    return props.info?.PublicNote?.customData?.buyBtnIcon;
  }
  return config.nazhua.buyBtnIcon || 'ri-shopping-bag-3-line';
});
const buyBtnText = computed(() => {
  if (props.info?.PublicNote?.customData?.buyBtnText) {
    return props.info?.PublicNote?.customData?.buyBtnText;
  }
  return config.nazhua.buyBtnText || '购买';
});
const showBuyBtn = computed(() => !!props.info?.PublicNote?.customData?.orderLink);

function toBuy() {
  const decodeUrl = decodeURIComponent(props.info?.PublicNote?.customData?.orderLink);
  window.open(decodeUrl, '_blank');
}

const gpuList = computed(() => {
  const gpus = props.info?.Host?.GPU || [];
  if (config.nazhua?.filterGPUKeywords?.length) {
    const keywors = Array.isArray(config.nazhua.filterGPUKeywords)
      ? config.nazhua.filterGPUKeywords
      : [config.nazhua.filterGPUKeywords];
    return gpus.filter((i) => {
      if (keywors.length) {
        return !keywors.some((k) => i.toLowerCase().includes(k.toLowerCase()));
      }
      return true;
    });
  }
  return gpus;
});

const sysLoadInfo = computed(() => {
  if (props.info?.State?.Load1 !== undefined) {
    return [
      props.info.State?.Load1,
      props.info.State?.Load5,
      props.info.State?.Load15,
    ].filter((i) => i !== undefined).map((i) => (i).toFixed(2) * 1).join(',');
  }
  return '-';
});

const temperatureData = computed(() => {
  const data = [];
  if (props.info?.State?.Temperatures) {
    const acpitz = [];
    const coretempPackageId = [];
    const coretempCore = [];
    const nvme = [];
    const k10temp = [];
    const amdgpu = [];
    const other = [];

    props.info.State.Temperatures.forEach((item) => {
      const name = item.Name.toLowerCase();
      const temp = item.Temperature;

      if (name.startsWith('acpitz')) {
        acpitz.push(temp);
        return;
      }
      if (name.startsWith('coretemp_package_id_')) {
        const coreIndex = parseInt(name.replace('coretemp_package_id_', ''), 10);
        coretempPackageId.push({
          index: coreIndex,
          value: temp,
        });
        return;
      }
      if (name.startsWith('coretemp_core_')) {
        const coreIndex = parseInt(name.replace('coretemp_core_', ''), 10);
        coretempCore.push({
          index: coreIndex,
          value: temp,
        });
        return;
      }
      if (name.includes('nvme')) {
        nvme.push({
          name: item.Name,
          value: temp,
        });
        return;
      }
      if (name.includes('k10temp')) {
        k10temp.push({
          name: item.Name,
          value: temp,
        });
        return;
      }
      if (name.includes('amdgpu')) {
        amdgpu.push({
          name: item.Name,
          value: temp,
        });
        return;
      }
      if (name.includes('motherboard') || name.includes('mainboard') || name.includes('board')) {
        other.push({
          label: '主板',
          value: temp,
          type: 'motherboard',
        });
        return;
      }
      other.push({
        label: item.Name,
        value: temp,
        type: 'other',
      });
    });

    if (acpitz.length) {
      const acpitzMean = (acpitz.reduce((a, b) => a + b, 0) / acpitz.length).toFixed(1);
      data.push({
        label: '主板',
        value: `${acpitzMean}℃`,
        title: acpitz.map((i, index) => `传感器${index + 1}: ${parseFloat(i).toFixed(1)}℃`).join('\n'),
        type: 'motherboard',
      });
    }

    if (coretempPackageId.length || coretempCore.length) {
      const temps = [];
      const details = [];

      if (coretempPackageId.length) {
        const cpuTemps = coretempPackageId.map((i) => `${parseFloat(i.value).toFixed(1)}℃`);
        temps.push(cpuTemps.join(', '));
        details.push(
          ...coretempPackageId.map(
            (i) => `CPU.${i.index + 1}: ${parseFloat(i.value).toFixed(1)}℃`,
          ),
        );
      }

      if (coretempCore.length) {
        const coreSum = coretempCore.reduce((a, b) => a + b.value, 0);
        const coreMean = (coreSum / coretempCore.length).toFixed(1);
        temps.push(`${parseFloat(coreMean).toFixed(1)}℃`);
        details.push(
          ...coretempCore.map(
            (i) => `核心${i.index + 1}: ${parseFloat(i.value).toFixed(1)}℃`,
          ),
        );
      }

      data.push({
        label: 'CPU',
        value: temps.join(' / '),
        title: details.join('\n'),
        type: 'cpu',
      });
    }

    if (k10temp.length) {
      const tctl = k10temp.find((i) => i.name.includes('tctl'));
      if (tctl) {
        data.push({
          label: 'AMD CPU',
          value: `${parseFloat(tctl.value).toFixed(1)}℃`,
          title: k10temp.map((i) => `${i.name}: ${parseFloat(i.value).toFixed(1)}℃`).join('\n'),
          type: 'cpu',
        });
      }
    }

    if (amdgpu.length) {
      const edge = amdgpu.find((i) => i.name.includes('edge'));
      if (edge) {
        data.push({
          label: 'AMD GPU',
          value: `${parseFloat(edge.value).toFixed(1)}℃`,
          title: amdgpu.map((i) => `${i.name}: ${parseFloat(i.value).toFixed(1)}℃`).join('\n'),
          type: 'gpu',
        });
      }
    }

    if (nvme.length) {
      const composite = nvme.find((i) => i.name.includes('composite'));
      if (composite) {
        data.push({
          label: 'NVME',
          value: `${parseFloat(composite.value).toFixed(1)}℃`,
          title: nvme.map((i) => `${i.name}: ${parseFloat(i.value).toFixed(1)}℃`).join('\n'),
          type: 'nvme',
        });
      }
    }

    other.forEach((i) => {
      data.push({
        label: i.label,
        value: `${parseFloat(i.value).toFixed(1)}℃`,
        type: i.type || 'other',
      });
    });
  }
  return {
    list: data,
  };
});

const {
  billAndPlan,
} = useServerBillAndPlan({
  props,
});

const billPlanData = computed(() => ['billing', 'remainingTime', 'bandwidth', 'traffic'].map((i) => {
  if (billAndPlan.value[i]) {
    return {
      label: billAndPlan.value[i].label,
      value: billAndPlan.value[i].value,
    };
  }
  return null;
}).filter((i) => i));

const tagList = computed(() => {
  const list = [];
  const {
    networkRoute,
    extra,
    IPv4,
    IPv6,
  } = props?.info?.PublicNote?.planDataMod || {};
  if (networkRoute) {
    list.push(...String(networkRoute).split(','));
  }
  if (extra) {
    list.push(...String(extra).split(','));
  }
  if (IPv4 === '1' && IPv6 === '1') {
    list.push('双栈IP');
  } else if (IPv4 === '1') {
    list.push('仅IPv4');
  } else if (IPv6 === '1') {
    list.push('仅IPv6');
  }
  return list;
});

const systemOSLabel = computed(() => {
  if (props?.info?.Host?.Platform) {
    return hostUtils.getSystemOSLabel(props.info.Host.Platform);
  }
  return '';
});

const systemOSIcon = computed(() => {
  if (props?.info?.Host?.Platform) {
    return hostUtils.getPlatformLogoIconClassName(props.info.Host.Platform);
  }
  return 'ri-server-line';
});

const bootTime = computed(() => {
  if (props?.info?.Host?.BootTime) {
    return dayjs(props.info.Host.BootTime * 1000).format('YYYY.MM.DD HH:mm:ss');
  }
  return '-';
});

const lastActive = computed(() => {
  if (props?.info?.Host?.BootTime && props?.info?.LastActive) {
    return dayjs(props.info.LastActive).format('YYYY.MM.DD HH:mm:ss');
  }
  return '-';
});

const transfer = computed(() => {
  const stats = {
    in: 0,
    out: 0,
    total: 0,
  };
  if (props?.info?.State?.NetInTransfer) {
    stats.total += props.info.State.NetInTransfer;
    stats.in = props.info.State.NetInTransfer;
  }
  if (props?.info?.State?.NetOutTransfer) {
    stats.total += props.info.State.NetOutTransfer;
    stats.out = props.info.State.NetOutTransfer;
  }
  return {
    in: hostUtils.calcTransfer(stats.in),
    out: hostUtils.calcTransfer(stats.out),
    total: hostUtils.calcTransfer(stats.total),
    stats,
  };
});

const hideConns = computed(() => {
  if (isTsdbEnabled(store)) {
    return true;
  }
  const tcp = props.info?.State?.TcpConnCount;
  const udp = props.info?.State?.UdpConnCount;
  return (tcp == null) && (udp == null);
});
const tcpConnCount = computed(() => props.info?.State?.TcpConnCount);
const udpConnCount = computed(() => props.info?.State?.UdpConnCount);
const processCount = computed(() => props.info?.State?.ProcessCount);
</script>

<style lang="scss" scoped>
.server-detail-info {
  padding: 16px 18px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.info-cell {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
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
    }
  }

  &--full {
    grid-column: 1 / -1;
  }

  &--action {
    background: transparent;
    border-color: transparent;
    padding: 4px 0 0;

    &:hover {
      background: transparent;
      border-color: transparent;
      transform: none;
    }
  }
}

.info-cell-label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-muted);
  font-weight: 600;
  font-size: 12px;

  i {
    font-size: 14px;
    color: var(--accent-primary);
  }
}

.info-cell-content {
  display: flex;
  align-items: center;
  min-width: 0;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 13px;
}

.info-chip-group {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.info-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding: 0 8px;
  border-radius: 6px;
  background: var(--panel-chip-bg);
  border: 1px solid var(--panel-chip-border);
  font-size: 12px;
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast);

  @media (hover: hover) {
    &:hover {
      background: var(--bg-hover);
      border-color: var(--border-strong);
    }
  }
}

.info-chip-label {
  color: var(--text-secondary);
}

.info-chip-value {
  color: var(--accent-primary);
}

.cpu-info,
.gpu-info {
  color: var(--text-primary);
  line-height: 1.5;
}

.transfer--in {
  .text-value {
    color: var(--transfer-in-color);
  }
}

.transfer--out {
  .text-value {
    color: var(--transfer-out-color);
  }
}

.buy-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 40px;
  padding: 0 10px;
  gap: 6px;
  line-height: 1;
  font-weight: 700;
  color: var(--accent-warning);
  border: 1.5px solid var(--accent-warning);
  border-radius: var(--radius-md);
  transition: all 150ms ease;
  cursor: pointer;

  &:hover {
    color: var(--text-on-accent);
    background-color: var(--accent-warning);
  }

  & > [class^="ri-"] {
    font-size: 18px;
  }
}

.info-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;

  .info-tag-item {
    height: 24px;
    padding: 0 8px;
    line-height: 24px;
    font-size: 12px;
    color: var(--list-tag-text);
    background: var(--list-tag-bg);
    border: 1px solid var(--list-tag-border);
    border-radius: 6px;
  }
}

@media screen and (max-width: 768px) {
  .server-detail-info {
    padding: 12px 14px;
  }

  .info-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .info-cell {
    gap: 6px;
    padding: 10px 12px;
  }

  .info-chip {
    height: 22px;
    padding: 0 6px;
    font-size: 11px;
  }
}
</style>
