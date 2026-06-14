<template>
  <div
    :class="[
      'theme-mode-switch',
      { 'theme-mode-switch--compact': isCompact },
    ]"
    role="group"
    aria-label="Theme mode switch"
  >
    <template v-if="isCompact">
      <button
        type="button"
        class="switch-option active"
        :aria-label="`切换主题，当前：${activeOption.label}`"
        @click="cycleMode"
      >
        <i :class="activeOption.icon" />
      </button>
    </template>
    <template v-else>
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        :class="['switch-option', { active: themeMode === option.value }]"
        @click="setMode(option.value)"
      >
        <i :class="option.icon" />
        <span>{{ option.label }}</span>
      </button>
    </template>
  </div>
</template>

<script setup>
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
} from 'vue';
import { useStore } from 'vuex';
import { THEME_MODES } from '@/utils/theme';

const store = useStore();

const COMPACT_BREAKPOINT = '(max-width: 420px)';

const options = [
  {
    value: THEME_MODES.AUTO,
    label: 'Auto',
    icon: 'ri-computer-line',
  },
  {
    value: THEME_MODES.LIGHT,
    label: 'Light',
    icon: 'ri-sun-line',
  },
  {
    value: THEME_MODES.DARK,
    label: 'Dark',
    icon: 'ri-moon-line',
  },
];

const themeMode = computed(() => store.state.themeMode);

const isCompact = ref(false);

const activeOption = computed(() => options.find((o) => o.value === themeMode.value) || options[0]);

function checkCompact() {
  isCompact.value = window.matchMedia(COMPACT_BREAKPOINT).matches;
}

let mediaQueryList = null;

onMounted(() => {
  mediaQueryList = window.matchMedia(COMPACT_BREAKPOINT);
  isCompact.value = mediaQueryList.matches;
  mediaQueryList.addEventListener('change', checkCompact);
});

onBeforeUnmount(() => {
  if (mediaQueryList) {
    mediaQueryList.removeEventListener('change', checkCompact);
  }
});

function setMode(mode) {
  if (mode === themeMode.value) {
    return;
  }
  store.dispatch('setThemeMode', mode);
}

function cycleMode() {
  const currentIndex = options.findIndex((o) => o.value === themeMode.value);
  const nextIndex = (currentIndex + 1) % options.length;
  store.dispatch('setThemeMode', options[nextIndex].value);
}
</script>

<style lang="scss" scoped>
.theme-mode-switch {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  min-height: 40px;
  padding: 3px;
  border: 1px solid var(--button-subtle-border);
  border-radius: 999px;
  background: var(--button-subtle-bg);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 8px 16px rgba(15, 23, 42, 0.04);
  backdrop-filter: blur(18px) saturate(145%);

  &--compact {
    gap: 0;
    min-height: auto;
    padding: 0;
    border: none;
    background: transparent;
    box-shadow: none;
    backdrop-filter: none;
  }
}

.switch-option {
  min-width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 999px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background var(--transition-fast),
    color var(--transition-fast),
    box-shadow var(--transition-fast),
    border-color var(--transition-fast),
    transform var(--transition-fast);

  i {
    font-size: 14px;
  }

  span {
    display: none;
  }

  @media (hover: hover) {
    &:hover {
      color: var(--text-primary);
      background: var(--bg-hover);
      transform: translateY(-1px);
    }
  }

  &.active {
    color: var(--text-on-accent);
    background: var(--button-active-bg);
    border-color: var(--button-active-border);
    box-shadow: var(--button-active-shadow);
    transform: translateY(-1px);
  }

  .theme-mode-switch--compact & {
    width: 32px;
    height: 32px;
    min-width: 32px;
    padding: 0;
    color: var(--text-secondary);
    border: 1px solid var(--button-subtle-border);
    background: var(--button-subtle-bg);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      0 8px 16px rgba(15, 23, 42, 0.04);
    backdrop-filter: blur(18px) saturate(145%);

    &:hover,
    &:focus-visible {
      color: var(--text-on-accent);
      background: var(--button-active-bg);
      border-color: var(--button-active-border);
      box-shadow: var(--button-active-shadow);
    }

    &.active {
      color: var(--text-secondary);
      background: var(--button-subtle-bg);
      border-color: var(--button-subtle-border);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.08),
        0 8px 16px rgba(15, 23, 42, 0.04);
      transform: none;
    }
  }
}

@media screen and (max-width: 768px) {
  .theme-mode-switch {
    max-width: 100%;
    min-height: 32px;
    padding: 2px;
  }

  .switch-option {
    flex: 0 0 auto;
    min-width: 26px;
    height: 26px;

    i {
      font-size: 13px;
    }

    &:hover,
    &.active {
      transform: none;
    }

    .theme-mode-switch--compact & {
      width: 28px;
      height: 28px;
      min-width: 28px;
    }
  }
}
</style>
