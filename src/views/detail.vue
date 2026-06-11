<template>
  <div class="detail-view">
    <div class="detail-header">
      <div class="header-main">
        <button type="button" class="back-btn" @click="$router.back()">
          <i class="ri-arrow-left-line" />
          返回
        </button>
        <h2>{{ serverInfo?.Name || '服务器详情' }}</h2>
      </div>
      <theme-mode-switch />
    </div>
    <div class="detail-content">
      <server-card v-if="serverInfo" :info="serverInfo" :expanded="true" />
      <div v-else class="not-found">
        <i class="ri-error-warning-line" />
        <p>服务器不存在</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useStore } from 'vuex';
import ServerCard from '@/components/server-panel/server-card.vue';
import ThemeModeSwitch from '@/components/theme-mode-switch.vue';

const route = useRoute();
const store = useStore();

const serverInfo = computed(() => store.state.serverList
  .find((s) => String(s.ID) === route.params.id));
</script>

<style lang="scss" scoped>
.detail-view {
  width: 100%;
  height: 100vh;
  overflow-y: auto;
  background: var(--page-bg);
  position: relative;
}

.detail-view::before {
  content: '';
  position: fixed;
  inset: 0;
  background: var(--page-overlay);
  pointer-events: none;
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  padding: 16px 20px;
  background: var(--status-bar-bg);
  backdrop-filter: blur(16px) saturate(135%);
  border-bottom: 1px solid var(--border-color);
  box-shadow:
    var(--shadow-sm),
    inset 0 -1px 0 rgba(255, 255, 255, 0.03);
  position: sticky;
  top: 0;
  z-index: 10;

  .header-main {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }

  .back-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--button-subtle-border);
    background: var(--button-subtle-bg);
    color: var(--text-secondary);
    font-size: 13px;
    cursor: pointer;
    transition: all var(--transition-fast);

    &:hover {
      background: var(--bg-hover);
      border-color: var(--button-subtle-hover-border);
      color: var(--text-primary);
    }
  }

  h2 {
    font-size: 16px;
    font-weight: 600;
  }
}

.detail-content {
  padding: 20px;
  max-width: 900px;
  margin: 0 auto;
  position: relative;
  z-index: 1;
}

.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  color: var(--text-muted);
  gap: 12px;

  i {
    font-size: 48px;
    color: var(--empty-icon-color);
  }
}

@media screen and (max-width: 768px) {
  .detail-header {
    padding: 12px;
  }

  .detail-content {
    padding: 12px;
  }
}
</style>
