<template>
  <div class="detail-view">
    <div class="status-bar">
      <div class="status-group">
        <button type="button" class="back-btn" @click="router.back()">
          <i class="ri-arrow-left-line" />
          返回
        </button>
        <h1 class="detail-title">
          {{ info?.Name || '服务器详情' }}
        </h1>
      </div>
      <div class="status-actions">
        <theme-mode-switch />
      </div>
    </div>

    <div
      v-if="info"
      class="detail-main"
      :class="{
        'server--offline': info.online !== 1,
      }"
    >
      <div class="detail-section">
        <div class="section-header">
          <server-detail-header :info="info" />
        </div>
        <div class="detail-body">
          <div class="detail-body-col detail-body-col--primary">
            <server-detail-status :info="info" />
            <server-detail-cycle-transfer :info="info" />
          </div>
          <div class="detail-body-col detail-body-col--secondary">
            <server-detail-info :info="info" />
            <server-detail-monitor :info="info" />
          </div>
        </div>
      </div>
    </div>

    <footer class="home-footer">
      <p>Powered by 哪吒监控 · Theme By AoBoBo 3D Globe</p>
    </footer>
  </div>
</template>

<script setup>
import {
  computed,
  watch,
  provide,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStore } from 'vuex';
import ThemeModeSwitch from '@/components/theme-mode-switch.vue';
import ServerDetailHeader from '@/components/server-detail/server-detail-header.vue';
import ServerDetailStatus from '@/components/server-detail/server-detail-status.vue';
import ServerDetailCycleTransfer from '@/components/server-detail/server-detail-cycle-transfer.vue';
import ServerDetailInfo from '@/components/server-detail/server-detail-info.vue';
import ServerDetailMonitor from '@/components/server-detail/server-detail-monitor.vue';

const route = useRoute();
const router = useRouter();
const store = useStore();

const serverId = computed(() => route.params.id);
const info = computed(() => store.state.serverList
  .find((s) => String(s.ID) === String(serverId.value)));
const dataInit = computed(() => store.state.init);

const currentTime = computed(() => store.state.serverTime || Date.now());
provide('currentTime', currentTime);

watch(info, (val) => {
  if (val?.Name) {
    document.title = `${val.Name} · 哪吒监控`;
  }
}, { immediate: true });

watch([dataInit, info], () => {
  if (dataInit.value && !info.value) {
    router.replace('/');
  }
}, { immediate: true });
</script>

<style lang="scss" scoped>
.detail-view {
  position: relative;
  width: 100%;
  height: 100vh;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 12px;
  padding: 14px 16px 12px;
  overflow: hidden;
  background: var(--page-bg);
}

.detail-view::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--page-overlay);
  pointer-events: none;
}

.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 14px 18px;
  padding: 12px 18px;
  position: relative;
  overflow: hidden;
  background: var(--status-bar-bg);
  backdrop-filter: blur(18px) saturate(150%);
  border: 1px solid var(--border-color);
  border-radius: calc(var(--radius-lg) + 2px);
  box-shadow:
    var(--shadow-sm),
    inset 0 1px 0 var(--surface-highlight);
  z-index: 10;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.08), transparent 40%),
      radial-gradient(circle at 15% 0%, rgba(var(--accent-cyan-rgb), 0.08), transparent 30%);
    pointer-events: none;
  }

  .status-group,
  .status-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    position: relative;
    z-index: 1;
  }

  .status-actions {
    margin-left: auto;
    justify-content: flex-end;
  }

  .back-btn {
    display: inline-flex;
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

  .detail-title {
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text-primary);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.detail-main {
  min-height: 0;
  overflow-y: auto;
  width: 100%;
  position: relative;
  z-index: 1;

  &.server--offline {
    filter: grayscale(1);
  }
}

.detail-section {
  min-height: 100%;
  border-radius: var(--radius-xl);
  border: 1px solid var(--border-color);
  background: var(--section-bg);
  backdrop-filter: blur(18px) saturate(150%);
  box-shadow:
    var(--shadow-sm),
    inset 0 1px 0 var(--surface-highlight);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.section-header {
  padding: 16px 16px 14px;
  border-bottom: 1px solid var(--border-color);
  background: var(--section-header-bg);
  box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.03);
}

.detail-body {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0 16px 16px;
}

.detail-body-col {
  display: flex;
  flex-direction: column;
  min-width: 0;

  :deep(.detail-panel--flat + .detail-panel--flat) {
    border-top: 1px solid var(--border-color);
  }
}

.home-footer {
  min-height: 50px;
  padding: 0 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--text-secondary);
  background: var(--footer-bg);
  border: 1px solid var(--border-color);
  border-radius: 18px;
  backdrop-filter: blur(18px) saturate(145%);
  box-shadow:
    var(--shadow-sm),
    inset 0 1px 0 var(--surface-highlight);
  position: relative;
  z-index: 1;
}

@media screen and (min-width: 1280px) {
  .detail-body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
    gap: 0 20px;
    padding: 0 16px 16px;
  }

  .detail-body-col--secondary {
    border-left: 1px solid var(--border-color);
    padding-left: 20px;
  }
}

@media screen and (max-width: 1279px) {
  .detail-body-col--secondary {
    border-top: 1px solid var(--border-color);
    margin-top: 0;
    padding-top: 0;
  }
}

@media screen and (max-width: 768px) {
  .detail-view {
    gap: 10px;
    padding: 10px;
  }

  .status-bar {
    padding: 10px 12px;

    .detail-title {
      font-size: 17px;
    }
  }

  .section-header {
    padding: 12px 12px 10px;
  }

  .detail-body {
    padding: 0 12px 12px;
  }
}
</style>
