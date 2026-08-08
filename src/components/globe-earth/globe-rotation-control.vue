<template>
  <div
    class="globe-rotation-control"
    :class="{
      'is-paused': !modelAutoRotate,
      'is-embedded': embedded,
    }"
    role="group"
    aria-label="地球自转控制"
  >
    <button
      type="button"
      class="rotation-toggle"
      :class="{ 'is-active': modelAutoRotate }"
      :aria-pressed="modelAutoRotate ? 'true' : 'false'"
      :title="modelAutoRotate ? '关闭自转' : '开启自转'"
      :aria-label="modelAutoRotate ? '关闭地球自转' : '开启地球自转'"
      @click="toggleAutoRotate"
    >
      <i :class="modelAutoRotate ? 'ri-pause-mini-fill' : 'ri-play-mini-fill'" />
      <span>{{ modelAutoRotate ? '自转中' : '已暂停' }}</span>
    </button>

    <div class="rotation-speed-slot" :aria-hidden="modelAutoRotate ? 'false' : 'true'">
      <div class="rotation-speed">
        <i class="ri-speed-line" aria-hidden="true" />
        <input
          class="rotation-speed__range"
          type="range"
          :min="minSpeed"
          :max="maxSpeed"
          :step="speedStep"
          :value="modelRotateSpeed"
          :disabled="!modelAutoRotate"
          :tabindex="modelAutoRotate ? 0 : -1"
          :aria-label="`地球转速 ${speedLabel}`"
          :style="speedTrackStyle"
          @input="handleSpeedInput"
        >
        <span class="rotation-speed__value" aria-hidden="true">{{ speedLabel }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  computed,
} from 'vue';
import {
  MIN_ROTATE_SPEED,
  MAX_ROTATE_SPEED,
  ROTATE_SPEED_STEP,
  clampRotateSpeed,
} from '@/utils/globe-rotation';

defineProps({
  embedded: {
    type: Boolean,
    default: false,
  },
});

const modelAutoRotate = defineModel('autoRotate', {
  type: Boolean,
  default: true,
});

const modelRotateSpeed = defineModel('rotateSpeed', {
  type: Number,
  default: 0.5,
});

const minSpeed = MIN_ROTATE_SPEED;
const maxSpeed = MAX_ROTATE_SPEED;
const speedStep = ROTATE_SPEED_STEP;

const speedLabel = computed(() => `${Number(modelRotateSpeed.value).toFixed(1)}x`);

const speedTrackStyle = computed(() => {
  const min = minSpeed;
  const max = maxSpeed;
  const value = clampRotateSpeed(modelRotateSpeed.value);
  const percent = ((value - min) / (max - min)) * 100;
  return {
    '--speed-progress': `${percent}%`,
  };
});

function toggleAutoRotate() {
  modelAutoRotate.value = !modelAutoRotate.value;
}

function handleSpeedInput(event) {
  modelRotateSpeed.value = clampRotateSpeed(event.target.value);
}
</script>

<style lang="scss" scoped>
.globe-rotation-control {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px 6px 6px;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background:
    linear-gradient(145deg, rgba(var(--accent-primary-rgb), 0.08), transparent 48%),
    var(--panel-floating-bg);
  backdrop-filter: blur(18px) saturate(150%);
  box-shadow:
    var(--shadow-md),
    inset 0 1px 0 var(--surface-highlight);
  pointer-events: auto;
  transition:
    gap 0.28s ease,
    padding 0.28s ease;

  &.is-paused {
    gap: 0;
    padding-right: 6px;
  }

  &.is-embedded {
    display: flex;
    width: 100%;
    gap: 6px;
    padding: 0;
    border: none;
    border-radius: 0;
    background: transparent;
    backdrop-filter: none;
    box-shadow: none;

    &.is-paused {
      gap: 0;
      padding-right: 0;
    }
  }
}

.rotation-toggle {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: 0 0 auto;
  min-height: 30px;
  padding: 0 10px 0 8px;
  border-radius: 999px;
  border: 1px solid var(--button-subtle-border);
  background: var(--button-subtle-bg);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background var(--transition-fast),
    color var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);

  i {
    font-size: 15px;
    line-height: 1;
  }

  @media (hover: hover) {
    &:hover {
      color: var(--text-primary);
      background: var(--bg-hover);
    }
  }

  &.is-active {
    color: var(--text-on-accent);
    background: var(--button-active-bg);
    border-color: var(--button-active-border);
    box-shadow: var(--button-active-shadow);
  }

  .is-embedded & {
    min-height: 26px;
    padding: 0 8px 0 6px;
    font-size: 10.5px;
    border-radius: 8px;
  }
}

.rotation-speed-slot {
  display: grid;
  grid-template-columns: 1fr;
  min-width: 0;
  max-width: 148px;
  opacity: 1;
  overflow: hidden;
  transition:
    max-width 0.28s ease,
    opacity 0.22s ease,
    transform 0.28s ease;
  transform-origin: left center;

  .is-paused & {
    max-width: 0;
    opacity: 0;
    transform: translateX(-6px);
    pointer-events: none;
  }

  .is-embedded & {
    flex: 1 1 auto;
    max-width: none;
  }

  .is-embedded.is-paused & {
    max-width: 0;
  }
}

.rotation-speed {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: max-content;
  padding-right: 2px;
  color: var(--text-secondary);

  .is-embedded & {
    width: 100%;
    min-width: 0;
  }

  > i {
    font-size: 13px;
    line-height: 1;
    flex: 0 0 auto;
  }
}

.rotation-speed__range {
  width: 84px;

  .is-embedded & {
    flex: 1 1 auto;
    width: auto;
    min-width: 0;
  }
  height: 18px;
  margin: 0;
  appearance: none;
  background: transparent;
  cursor: pointer;

  &:disabled {
    cursor: not-allowed;
  }

  &::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: 999px;
    background: linear-gradient(
      90deg,
      var(--accent-primary) 0%,
      var(--accent-primary) var(--speed-progress),
      rgba(var(--accent-primary-rgb), 0.18) var(--speed-progress),
      rgba(var(--accent-primary-rgb), 0.18) 100%
    );
  }

  &::-webkit-slider-thumb {
    appearance: none;
    width: 12px;
    height: 12px;
    margin-top: -4px;
    border-radius: 50%;
    border: 2px solid var(--bg-card-strong, #fff);
    background: var(--accent-primary);
    box-shadow: 0 0 0 1px rgba(var(--accent-primary-rgb), 0.28);
  }

  &::-moz-range-track {
    height: 4px;
    border-radius: 999px;
    background: rgba(var(--accent-primary-rgb), 0.18);
  }

  &::-moz-range-progress {
    height: 4px;
    border-radius: 999px;
    background: var(--accent-primary);
  }

  &::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid var(--bg-card-strong, #fff);
    background: var(--accent-primary);
    box-shadow: 0 0 0 1px rgba(var(--accent-primary-rgb), 0.28);
  }
}

.rotation-speed__value {
  min-width: 2.4em;
  font-family: var(--font-mono);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: var(--text-primary);
  text-align: right;
}

@media screen and (max-width: 768px) {
  .globe-rotation-control {
    gap: 6px;
    padding: 5px 7px 5px 5px;

    &.is-paused {
      padding-right: 5px;
    }

    &.is-embedded {
      gap: 5px;
      padding: 0;

      &.is-paused {
        padding-right: 0;
      }
    }
  }

  .rotation-toggle {
    min-height: 28px;
    padding: 0 8px 0 6px;
    font-size: 10.5px;

    span {
      display: none;
    }

    i {
      font-size: 16px;
    }
  }

  .rotation-speed-slot {
    max-width: 128px;

    .is-embedded & {
      max-width: none;
    }

    .is-embedded.is-paused & {
      max-width: 0;
    }
  }

  .rotation-speed__range {
    width: 72px;
  }

  .rotation-speed__value {
    min-width: 2.2em;
    font-size: 10.5px;
  }
}
</style>
