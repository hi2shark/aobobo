<template>
  <div
    class="server-status-progress"
    :class="'server-status--' + type"
  >
    <div class="progress-bar-box">
      <div
        class="progress-bar-inner"
        :style="progressStyle"
      />
      <div
        class="progress-bar-label"
        :title="label + '使用' + used + '%'"
      >
        <span
          v-if="label"
          class="server-status-label"
        >
          {{ label }}:
        </span>
        <span class="server-status-val-text">
          {{ valText }}
        </span>
      </div>
    </div>

    <div
      v-if="content"
      class="server-status-progress-content"
    >
      <span>{{ content?.default }}</span>
    </div>
  </div>
</template>

<script setup>
/**
 * 服务器状态进度调单项
 */

import {
  computed,
} from 'vue';

const props = defineProps({
  type: {
    type: String,
    default: '',
  },
  size: {
    type: Number,
    default: 100,
  },
  used: {
    type: [Number, String],
    default: 1,
  },
  colors: {
    type: Object,
    default: () => ({}),
  },
  valText: {
    type: String,
    default: '',
  },
  label: {
    type: String,
    default: '',
  },
  content: {
    type: [String, Object],
    default: '',
  },
});

const progressStyle = computed(() => {
  const style = {};
  style.width = `${Math.min(props.used, 100)}%`;
  const color = typeof props.colors === 'string' ? props.colors : props.colors?.used;
  if (color) {
    if (Array.isArray(color)) {
      style.background = `linear-gradient(-35deg, ${color.join(',')})`;
    } else {
      style.backgroundColor = color;
    }
  }
  return style;
});
</script>

<style lang="scss" scoped>
.server-status-progress {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 5px;

  @media screen and (max-width: 480px) {
    flex: none;
    width: var(--progress-bar-width, calc(50% - 5px));
  }

  .progress-bar-box {
    position: relative;
    width: 100%;
    height: var(--progress-bar-height);
    background: var(--progress-track);
    border-radius: calc(var(--progress-bar-height) / 2);
    overflow: hidden;
  }

  .progress-bar-inner {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    background-color: var(--accent-primary);
    border-radius: calc(var(--progress-bar-height) / 2);
  }

  .progress-bar-label {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    line-height: var(--progress-bar-height);
    font-size: 12px;
    text-align: center;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.6), 0 0 1px rgba(255, 255, 255, 0.3);
    cursor: default;
  }

  .server-status-val-text {
    color: var(--server-status-value-color);
  }

  .server-status-label {
    color: var(--server-status-label-color);
  }

  .server-status-progress-content {
    color: var(--server-status-content-color);
    @media screen and (max-width: 480px) {
      line-height: 20px;
      font-size: 12px;
    }
  }
}
</style>
