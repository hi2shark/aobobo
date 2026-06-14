<template>
  <div
    ref="rootRef"
    class="server-sort-select"
  >
    <button
      type="button"
      class="sort-trigger"
      @click="toggleOpen"
    >
      <span class="sort-label">{{ selectedLabel }}</span>
      <span
        class="sort-order"
        title="切换升序/降序"
        @click.stop="toggleOrder"
      >
        <i :class="modelValue.order === 'desc' ? 'ri-arrow-down-line' : 'ri-arrow-up-line'" />
      </span>
    </button>
    <div
      v-show="open"
      class="sort-dropdown"
    >
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        :class="['sort-option', { active: modelValue.prop === option.value }]"
        @click="selectOption(option)"
      >
        {{ option.label }}
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
    type: Object,
    default: () => ({
      prop: 'DisplayIndex',
      order: 'desc',
    }),
  },
  options: {
    type: Array,
    default: () => [],
  },
});

const emits = defineEmits([
  'update:modelValue',
  'change',
]);

const open = ref(false);
const rootRef = ref(null);

const selectedLabel = computed(() => {
  const selected = props.options.find((opt) => opt.value === props.modelValue.prop);
  return selected?.label || '排序';
});

function emitChange(value) {
  emits('update:modelValue', value);
  emits('change', value);
}

function toggleOpen() {
  open.value = !open.value;
}

function toggleOrder() {
  emitChange({
    prop: props.modelValue.prop,
    order: props.modelValue.order === 'desc' ? 'asc' : 'desc',
  });
}

function selectOption(option) {
  const isSame = props.modelValue.prop === option.value;
  emitChange({
    prop: isSame ? 'DisplayIndex' : option.value,
    order: props.modelValue.order || 'desc',
  });
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
.server-sort-select {
  position: relative;
  flex: 0 0 auto;
}

.sort-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 40px;
  padding: 0 12px 0 14px;
  border-radius: 999px;
  border: 1px solid var(--button-subtle-border);
  background: var(--button-subtle-bg);
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1;
  font-weight: 600;
  cursor: pointer;
  transition:
    color var(--transition-fast),
    background var(--transition-fast),
    border-color var(--transition-fast);

  &:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
  }
}

.sort-label {
  white-space: nowrap;
}

.sort-order {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 6px;
  transition: background var(--transition-fast);

  i {
    font-size: 13px;
    line-height: 1;
  }

  &:hover {
    background: var(--button-subtle-border);
  }
}

.sort-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 200;
  min-width: 140px;
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

.sort-option {
  display: flex;
  align-items: center;
  min-height: 32px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition:
    color var(--transition-fast),
    background var(--transition-fast),
    border-color var(--transition-fast);

  &:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
  }

  &.active {
    background: var(--button-active-bg);
    border-color: var(--button-active-border);
    color: var(--text-on-accent);
  }
}
</style>
