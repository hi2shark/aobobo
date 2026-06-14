<template>
  <div class="detail-view">
    <div
      v-if="info"
      class="detail-main"
      :class="{
        'server--offline': info.online !== 1,
      }"
    >
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

      <div class="detail-stack">
        <server-detail-header :info="info" class="stack-item stack-item--header" />
        <server-detail-status :info="info" class="stack-item stack-item--status" />
        <server-detail-cycle-transfer :info="info" class="stack-item stack-item--cycle" />
        <server-detail-info :info="info" class="stack-item stack-item--info" />
        <server-detail-monitor :info="info" class="stack-item stack-item--monitor" />
      </div>

      <app-footer class="detail-footer" />
    </div>
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
import AppFooter from '@/components/app-footer.vue';
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
  height: 100dvh;
  padding: 0;
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

.detail-main {
  min-height: 0;
  height: 100%;
  overflow-y: auto;
  width: 100%;
  position: relative;
  z-index: 1;

  &.server--offline {
    filter: grayscale(1);
  }
}

.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 14px 18px;
  width: calc(100% - 28px);
  margin: 14px 14px 12px;
  padding: 10px 16px;
  position: sticky;
  top: 14px;
  z-index: 100;
  overflow: hidden;
  background: var(--status-bar-bg);
  backdrop-filter: blur(18px) saturate(150%);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow:
    var(--shadow-sm),
    inset 0 1px 0 var(--surface-highlight);

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
    justify-content: center;
    gap: 5px;
    min-height: 36px;
    padding: 0 12px;
    border-radius: 999px;
    border: 1px solid var(--button-subtle-border);
    background: var(--button-subtle-bg);
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 600;
    line-height: 1;
    cursor: pointer;
    transition:
      color var(--transition-fast),
      background var(--transition-fast),
      border-color var(--transition-fast),
      box-shadow var(--transition-fast),
      transform var(--transition-fast);

    i {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      line-height: 1;
    }

    &:hover {
      background: var(--button-active-bg);
      border-color: var(--button-active-border);
      color: var(--text-on-accent);
      box-shadow: var(--button-active-shadow);
      transform: translateY(-1px);
    }
  }

  .detail-title {
    font-size: 17px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text-primary);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.detail-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  padding-bottom: 2px;
}

.stack-item {
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  background: var(--section-bg);
  backdrop-filter: blur(18px) saturate(150%);
  box-shadow:
    var(--shadow-sm),
    inset 0 1px 0 var(--surface-highlight);
  overflow: hidden;
}

.detail-footer {
  width: calc(100% - 28px);
  margin: 12px 14px 6px;
  padding: 0 16px;
}

@media screen and (max-width: 768px) {
  .detail-view {
    padding: 0;
  }

  .status-bar {
    width: calc(100% - 24px);
    margin: 12px 12px 10px;
    padding: 8px 12px;
    top: 12px;

    .detail-title {
      font-size: 15px;
    }

    .back-btn {
      min-height: 32px;
      padding: 0 10px;
      font-size: 12px;
    }
  }

  .detail-stack {
    gap: 8px;
    width: calc(100% - 24px);
    margin: 0 12px;
    padding-bottom: 24px;
  }

  .stack-item {
    border-radius: var(--radius-md);
  }

  .detail-footer {
    width: calc(100% - 24px);
    margin: 8px 12px 24px;
    padding: 0 12px;
  }
}
</style>
