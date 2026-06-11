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
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--button-subtle-border);
  border-radius: 999px;
  background: var(--button-subtle-bg);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(16px) saturate(130%);
}

.switch-option {
  min-width: 72px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 12px;
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
    border-color var(--transition-fast);

  i {
    font-size: 14px;
  }

  &:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
  }

  &.active {
    color: #f8fbff;
    background: linear-gradient(180deg, rgba(91, 140, 255, 0.98), rgba(63, 114, 255, 0.92));
    border-color: rgba(255, 255, 255, 0.18);
    box-shadow: 0 10px 24px rgba(63, 114, 255, 0.24);
  }
}

@media screen and (max-width: 768px) {
  .theme-mode-switch {
    max-width: 100%;
  }

  .switch-option {
    flex: 1 1 auto;
    min-width: 68px;
  }
}
</style>
