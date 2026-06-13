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
  padding: 14px 16px 16px;
}

.detail-view::before {
  content: '';
  position: fixed;
  inset: 0;
  background: var(--page-overlay);
  pointer-events: none;
}

.detail-view::after {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 50% 0%, rgba(var(--accent-cyan-rgb), 0.08), transparent 34%),
    radial-gradient(circle at 50% 100%, rgba(var(--accent-cyan-rgb), 0.05), transparent 38%);
  opacity: 0.9;
  z-index: 0;
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  padding: 14px 18px;
  background: var(--status-bar-bg);
  backdrop-filter: blur(18px) saturate(145%);
  border: 1px solid var(--border-color);
  border-radius: calc(var(--radius-lg) + 2px);
  box-shadow:
    var(--shadow-sm),
    inset 0 1px 0 var(--surface-highlight);
  position: sticky;
  top: 14px;
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
    gap: 6px;
    min-height: 40px;
    padding: 0 14px;
    border-radius: 999px;
    border: 1px solid var(--button-subtle-border);
    background: var(--button-subtle-bg);
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition:
      color var(--transition-fast),
      background var(--transition-fast),
      border-color var(--transition-fast),
      box-shadow var(--transition-fast),
      transform var(--transition-fast);

    &:hover {
      background: var(--button-active-bg);
      border-color: var(--button-active-border);
      color: var(--text-on-accent);
      box-shadow: var(--button-active-shadow);
      transform: translateY(-1px);
    }
  }

  h2 {
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
}

.detail-content {
  padding: 18px 0 0;
  max-width: 980px;
  margin: 0 auto;
  position: relative;
  z-index: 1;
}

.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 320px;
  padding: 80px 24px;
  border: 1px solid var(--card-border);
  border-radius: var(--radius-lg);
  background: var(--card-bg);
  box-shadow: var(--card-shadow);
  color: var(--text-secondary);
  gap: 12px;

  i {
    font-size: 48px;
    color: var(--empty-icon-color);
  }
}

@media screen and (max-width: 768px) {
  .detail-view {
    padding: 10px;
  }

  .detail-header {
    top: 10px;
    padding: 12px;
  }

  .detail-content {
    padding: 12px 0 0;
  }

  .detail-header h2 {
    font-size: 18px;
  }
}
</style>
