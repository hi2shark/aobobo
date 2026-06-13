<template>
  <detail-panel
    variant="flat"
    class="server-detail-status"
  >
    <div
      class="server-status-group type--progress"
      :class="'status-list--' + serverStatusList.length"
    >
      <server-status-progress
        v-for="item in serverStatusList"
        :key="item.type"
        :type="item.type"
        :used="item.used"
        :colors="item.colors"
        :val-text="item.valText"
        :label="item.label"
        :content="item.content"
      />
    </div>
    <server-real-time :info="info" />
  </detail-panel>
</template>

<script setup>
/**
 * 服务器状态组
 */
import useServerStatus from '@/composables/server-status';
import DetailPanel from '@/components/server-detail/detail-panel.vue';
import ServerRealTime from '@/components/server/server-real-time.vue';
import ServerStatusProgress from '@/components/server/server-status-progress.vue';

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
</script>

<style lang="scss" scoped>
.server-detail-status {
  display: flex;
  flex-direction: column;
  gap: 20px;

  --real-time-value-font-size: 24px;
  --real-time-text-font-size: 14px;
  --real-time-label-font-size: 14px;
  --progress-bar-height: 24px;

  @media screen and (max-width: 1024px) {
    --real-time-value-font-size: 24px;
  }

  @media screen and (max-width: 720px) {
    --real-time-value-font-size: 22px;
    --real-time-text-font-size: 13px;
    --real-time-label-font-size: 13px;
  }

  @media screen and (max-width: 320px) {
    --real-time-value-font-size: 20px;
    --real-time-text-font-size: 12px;
    --real-time-label-font-size: 12px;
    --progress-bar-height: 18px;
  }
}

.server-status-group {
  display: flex;
  flex-wrap: wrap;
  padding: 0;
  gap: 10px;

  &.type--progress {
    --progress-bar-height: 24px;

    @media screen and (max-width: 350px) {
      --progress-bar-height: 16px;
    }
  }
}
</style>
