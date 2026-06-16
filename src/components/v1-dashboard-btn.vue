<template>
  <a
    v-if="visible"
    :href="dashboardUrl"
    class="v1-dashboard-btn"
    :title="userLogin ? '访问管理后台' : '登录管理后台'"
    target="_blank"
    rel="noopener noreferrer"
  >
    <i :class="userLogin ? 'ri-dashboard-3-line' : 'ri-user-line'" />
    <span class="btn-text">{{ userLogin ? '管理后台' : '登录' }}</span>
  </a>
</template>

<script setup>
import { computed } from 'vue';
import { useStore } from 'vuex';
import config from '@/config';

const store = useStore();

const userLogin = computed(() => store.state.profile?.username);
const visible = computed(() => (
  config.nazhua.nezhaVersion === 'v1'
  && config.nazhua.v1HideNezhaDashboardBtn !== true
));
const dashboardUrl = computed(() => config.nazhua.v1DashboardUrl || '/dashboard');
</script>

<style lang="scss" scoped>
.v1-dashboard-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 40px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid var(--button-subtle-border);
  background: var(--button-subtle-bg);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  text-decoration: none;
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
    width: 1em;
    height: 1em;
    font-size: 14px;
    line-height: 1;
  }

  &:hover {
    color: var(--text-on-accent);
    background: var(--button-active-bg);
    border-color: var(--button-active-border);
    box-shadow: var(--button-active-shadow);
    transform: translateY(-1px);
  }
}

@media screen and (max-width: 768px) {
  .v1-dashboard-btn {
    min-height: 32px;
    padding: 0 10px;
  }
}

@media screen and (max-width: 420px) {
  .v1-dashboard-btn {
    width: 32px;
    height: 32px;
    min-width: 32px;
    padding: 0;

    .btn-text {
      display: none;
    }
  }
}
</style>
