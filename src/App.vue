<template>
  <div id="app-root" class="app-root">
    <router-view v-slot="{ Component }">
      <keep-alive>
        <component :is="Component" />
      </keep-alive>
    </router-view>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useStore } from 'vuex';
import config, { init as initConfig } from '@/config';
import wsInit from '@/ws';

const store = useStore();

onMounted(async () => {
  if (!config.init) {
    await initConfig();
  }
  store.dispatch('initServerInfo');
  store.dispatch('watchWsMsg');
  wsInit();
});
</script>

<style lang="scss" scoped>
.app-root {
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: transparent;
  color: var(--text-primary);
}
</style>
