<template>
  <section
    class="detail-panel"
    :class="[panelClass, `detail-panel--${variant}`]"
  >
    <slot />
  </section>
</template>

<script setup>
defineProps({
  panelClass: {
    type: [String, Object, Array],
    default: '',
  },
  variant: {
    type: String,
    default: 'card',
    validator: (value) => ['card', 'flat'].includes(value),
  },
});
</script>

<style scoped>
.detail-panel--card {
  border-radius: var(--radius-xl);
  background: var(--section-bg);
  border: 1px solid var(--border-color);
  padding: 16px 20px;
  box-shadow: var(--shadow-sm);
}

.detail-panel--flat {
  border: none;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  padding: 16px 0;
}
</style>
