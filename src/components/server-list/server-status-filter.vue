<template>
  <div
    ref="rootRef"
    class="server-status-filter"
    role="group"
    :aria-label="ariaLabel"
  >
    <button
      type="button"
      class="status-filter-trigger"
      :class="{ active: open }"
      @click="toggleOpen"
    >
      <span
        v-if="selectedOption?.dot"
        class="status-dot"
        :class="selectedOption.dot"
      />
      <span class="status-filter-label">{{ selectedLabel }}</span>
      <i class="ri-arrow-down-s-line" />
    </button>
    <div
      v-show="open"
      class="status-filter-dropdown"
    >
      <button
        v-for="option in options"
        :key="option.value || 'all'"
        type="button"
        :class="['status-filter-option', { active: modelValue === option.value }]"
        @click="selectOption(option)"
      >
        <span
          v-if="option.dot"
          class="status-dot"
          :class="option.dot"
        />
        <span>{{ option.label }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import {
  computed,
  ref,
  onMounted,
  onUnmounted,
} from 'vue';

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  options: {
    type: Array,
    default: () => [],
  },
  ariaLabel: {
    type: String,
    default: '筛选状态',
  },
});

const emits = defineEmits([
  'update:modelValue',
  'change',
]);

const open = ref(false);
const rootRef = ref(null);

const selectedOption = computed(() => (
  props.options.find((opt) => opt.value === props.modelValue) || props.options[0]
));

const selectedLabel = computed(() => selectedOption.value?.label || '全部');

function emitChange(value) {
  emits('update:modelValue', value);
  emits('change', value);
}

function toggleOpen() {
  open.value = !open.value;
}

function selectOption(option) {
  emitChange(option.value);
  open.value = false;
}

function handleDocumentClick(event) {
  if (open.value && rootRef.value && !rootRef.value.contains(event.target)) {
    open.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick);
});

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick);
});
</script>

<style lang="scss" scoped>
.server-status-filter {
  position: relative;
  flex: 0 0 auto;
}

.status-filter-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 34px;
  padding: 0 8px 0 11px;
  border-radius: 999px;
  border: 1px solid var(--button-subtle-border);
  background: var(--button-subtle-bg);
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1;
  font-weight: 600;
  cursor: pointer;
  transition:
    color var(--transition-fast),
    background var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 4px 10px rgba(15, 23, 42, 0.03);

  i {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1em;
    height: 1em;
    font-size: 14px;
    line-height: 1;
    color: var(--text-muted);
    transition: transform var(--transition-fast);
  }

  &:hover,
  &.active {
    color: var(--text-primary);
    background: var(--bg-hover);
    border-color: var(--button-subtle-border);
  }

  &.active i {
    transform: rotate(180deg);
  }
}

.status-filter-label {
  white-space: nowrap;
  line-height: 1;
}

.status-filter-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 200;
  min-width: 110px;
  max-height: 260px;
  overflow-y: auto;
  padding: 6px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  background: var(--section-bg);
  backdrop-filter: blur(18px) saturate(150%);
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.status-filter-option {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 32px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  text-align: left;
  cursor: pointer;
  transition:
    color var(--transition-fast),
    background var(--transition-fast),
    border-color var(--transition-fast);

  @media (hover: hover) {
    &:hover:not(.active) {
      color: var(--text-primary);
      background: var(--bg-hover);
    }
  }

  &.active {
    background: var(--button-active-bg);
    border-color: var(--button-active-border);
    color: var(--text-on-accent);

    .status-dot {
      box-shadow: none;
    }
  }
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex: 0 0 auto;

  &.online {
    background: var(--accent-success);
    box-shadow: var(--status-online-glow);
  }

  &.offline {
    background: var(--accent-danger);
    box-shadow: var(--status-offline-glow);
  }
}
</style>
