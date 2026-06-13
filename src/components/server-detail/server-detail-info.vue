<template>
  <detail-panel
    variant="flat"
    class="server-detail-info"
  >
    <div
      v-if="info?.Host?.CPU?.length"
      class="server-info-group server-info--cpu"
    >
      <div class="server-info-label">
        CPU
      </div>
      <div class="server-info-content">
        <template v-if="info?.Host?.CPU?.length === 1">
          <span
            class="cpu-info"
            :title="info.Host.CPU[0]"
          >
            <span>{{ info.Host.CPU[0] }}</span>
          </span>
        </template>
        <div
          v-else
          class="server-info-item-group"
        >
          <span
            v-for="(cpuItem, cpuIndex) in info.Host.CPU"
            :key="`${info.ID}_cpu_${cpuIndex}`"
            class="server-info-item"
          >
            <span class="server-info-item-label">CPU.{{ cpuIndex + 1 }}</span>
            <span class="server-info-item-value">{{ cpuItem }}</span>
          </span>
        </div>
      </div>
    </div>
    <div
      v-if="gpuList.length"
      class="server-info-group server-info--gpu"
    >
      <div class="server-info-label">
        GPU
      </div>
      <div class="server-info-content">
        <template v-if="gpuList.length === 1">
          <span
            class="gpu-info"
            :title="gpuList[0]"
          >
            <span>{{ gpuList[0] }}</span>
          </span>
        </template>
        <div
          v-else
          class="server-info-item-group"
        >
          <span
            v-for="(gpuItem, gpuIndex) in gpuList"
            :key="`${info.ID}_gpu_${gpuIndex}`"
            class="server-info-item"
          >
            <span class="server-info-item-label">GPU.{{ gpuIndex + 1 }}</span>
            <span class="server-info-item-value">{{ gpuItem }}</span>
          </span>
        </div>
      </div>
    </div>
    <div
      v-if="temperatureData.list.length"
      class="server-info-group server-info--temperature"
    >
      <div class="server-info-label">
        温度
      </div>
      <div class="server-info-content">
        <div class="server-info-item-group">
          <span
            v-for="(ttItem, ttIndex) in temperatureData.list"
            :key="`${info.ID}_temperature_${ttIndex}`"
            class="server-info-item"
            :class="`temperature--${ttItem.type}`"
            :title="ttItem?.title || (`${ttItem.label}: ${ttItem.value}`)"
          >
            <span class="server-info-item-icon">
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
            </span>
            <span class="server-info-item-value">
              {{ ttItem.value }}
            </span>
          </span>
        </div>
      </div>
    </div>
    <div class="server-info-group server-info--system-os">
      <div class="server-info-label">
        系统
      </div>
      <div class="server-info-content">
        <span class="server-info-item">
          <span class="server-info-item-label">{{ systemOSLabel }}</span>
          <span
            v-if="info?.Host?.PlatformVersion"
            class="server-info-item-value"
          >
            {{ info?.Host?.PlatformVersion }}
          </span>
        </span>
      </div>
    </div>
    <div class="server-info-group server-info--load">
      <div class="server-info-label">
        占用
      </div>
      <div class="server-info-content">
        <div class="server-info-item-group">
          <span class="server-info-item process-count">
            <span class="server-info-item-label">进程数</span>
            <span class="server-info-item-value">{{ processCount }}</span>
          </span>
          <span class="server-info-item load">
            <span class="server-info-item-label">负载</span>
            <span class="server-info-item-value">
              {{ sysLoadInfo }}
            </span>
          </span>
        </div>
      </div>
    </div>
    <div class="server-info-group server-info--transfer">
      <div class="server-info-label">
        流量
      </div>
      <div class="server-info-content">
        <div class="server-info-item-group">
          <span class="server-info-item transfer--in">
            <span class="server-info-item-label">入网</span>
            <span class="server-info-item-value">
              <span class="text-value">{{ transfer?.in?.value }}</span>
              <span class="text-unit">{{ transfer?.in?.unit }}</span>
            </span>
          </span>
          <span class="server-info-item transfer--out">
            <span class="server-info-item-label">出网</span>
            <span class="server-info-item-value">
              <span class="text-value">{{ transfer?.out?.value }}</span>
              <span class="text-unit">{{ transfer?.out?.unit }}</span>
            </span>
          </span>
        </div>
      </div>
    </div>
    <div
      v-if="!hideConns"
      class="server-info-group server-info--conn"
    >
      <div class="server-info-label">
        连接
      </div>
      <div class="server-info-content">
        <div class="server-info-item-group">
          <span class="server-info-item conn--tcp">
            <span class="server-info-item-label">TCP</span>
            <span class="server-info-item-value">{{ tcpConnCount }}</span>
          </span>
          <span class="server-info-item conn--tcp">
            <span class="server-info-item-label">UDP</span>
            <span class="server-info-item-value">{{ udpConnCount }}</span>
          </span>
        </div>
      </div>
    </div>
    <div class="server-info-group server-info--boottime">
      <div class="server-info-label">
        启动
      </div>
      <div class="server-info-content">
        <span class="server-info-item runtime--boottime">
          <span class="server-info-item-value">{{ bootTime }}</span>
        </span>
      </div>
    </div>
    <div class="server-info-group server-info--lasttime">
      <div class="server-info-label">
        活跃
      </div>
      <div class="server-info-content">
        <span class="server-info-item runtime--lasttime">
          <span class="server-info-item-value">{{ lastActive }}</span>
        </span>
      </div>
    </div>
    <div
      v-if="billPlanData.length"
      class="server-info-group server-info--biil-plan"
    >
      <div class="server-info-label">
        套餐
      </div>
      <div class="server-info-content">
        <div class="server-info-item-group">
          <span
            v-for="item in billPlanData"
            :key="item.label"
            class="server-info-item"
          >
            <span
              v-if="item.label"
              class="server-info-item-label"
            >{{ item.label }}</span>
            <span class="server-info-item-value">{{ item.value }}</span>
          </span>
        </div>
      </div>
    </div>
    <div
      v-if="tagList?.length"
      class="server-info-group server-info--tag-list"
    >
      <div class="server-info-label">
        标签
      </div>
      <div class="server-info-content">
        <div class="server-info-tag-list">
          <span
            v-for="(tag, index) in tagList"
            :key="`${tag}_${index}`"
            class="server-info-tag-item"
          >
            {{ tag }}
          </span>
        </div>
      </div>
    </div>
    <div
      v-if="showBuyBtn"
      class="server-info-group server-info--order-link"
    >
      <div class="server-info-content">
        <div
          class="buy-btn"
          @click.stop="toBuy"
        >
          <span class="icon">
            <span :class="buyBtnIcon" />
          </span>
          <span class="text">{{ buyBtnText }}</span>
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
  --server-info-item-size: 24px;

  @media screen and (max-width: 480px) {
    --server-info-item-size: 30px;
  }

  .server-info-group {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
    font-size: 14px;
    padding: 8px 10px;
    margin: 0 -10px;
    border-bottom: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    transition:
      background var(--transition-fast),
      border-color var(--transition-fast);

    &:hover:not(.server-info--order-link) {
      background: var(--bg-hover);
      border-color: var(--border-strong);
    }

    &:last-child {
      border-bottom: none;
    }

    .server-info-label {
      width: 3em;
      flex-shrink: 0;
      text-align: left;
      line-height: var(--server-info-item-size);
      color: var(--text-muted);
      font-weight: 600;
      font-size: 13px;
    }

    .server-info-content {
      flex: 1;
      display: flex;
      justify-content: flex-end;
      align-items: center;
      line-height: 18px;
      text-align: right;
      cursor: default;
      min-width: 0;
      font-family: var(--font-mono);
      font-variant-numeric: tabular-nums;
    }
  }

  .server-info-item-group {
    display: flex;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 0 12px;
  }

  .server-info-item {
    display: flex;
    gap: 0.2em;
    align-items: center;

    .server-info-item-icon {
      width: 24px;
      height: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      color: var(--text-muted);
    }
  }

  .server-info-item-label {
    color: var(--text-secondary);
  }

  .server-info-item-value {
    color: var(--accent-primary);
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
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

  .server-info--order-link {
    padding: 10px 0 0;
    border-bottom: none;
  }

  .buy-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 36px;
    padding: 0 10px;
    gap: 5px;
    line-height: 1;
    font-weight: bold;
    color: var(--accent-warning);
    border: 2px solid var(--accent-warning);
    border-radius: var(--radius-sm);
    transition: all 150ms ease;
    cursor: pointer;

    &:hover {
      color: var(--text-on-accent);
      background-color: var(--accent-warning);
    }

    .icon {
      font-size: 18px;
      font-weight: normal;
    }
  }

  .server-info-tag-list {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 6px;

    .server-info-tag-item {
      height: 22px;
      padding: 0 8px;
      line-height: 22px;
      font-size: 12px;
      color: var(--list-tag-text);
      background: var(--list-tag-bg);
      border: 1px solid var(--list-tag-border);
      border-radius: 6px;
    }
  }
}
</style>
