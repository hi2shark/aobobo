<template>
  <div class="theme-mode-switch" role="group" aria-label="Theme mode switch">
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
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useStore } from 'vuex';
import { THEME_MODES } from '@/utils/theme';

const store = useStore();

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

function setMode(mode) {
  if (mode === themeMode.value) {
    return;
  }
  store.dispatch('setThemeMode', mode);
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

  &:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
    transform: translateY(-1px);
  }

  &.active {
    color: var(--text-on-accent);
    background: var(--button-active-bg);
    border-color: var(--button-active-border);
    box-shadow: var(--button-active-shadow);
    transform: translateY(-1px);
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
  }
}
</style>
