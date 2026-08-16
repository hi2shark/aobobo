<template>
  <div id="app-root" class="app-root">
    <router-view v-slot="{ Component }">
      <keep-alive :exclude="['ViewPassword']">
        <component :is="Component" />
      </keep-alive>
    </router-view>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStore } from 'vuex';
import config, { init as initConfig } from '@/config';
import wsInit from '@/ws';

const store = useStore();
const route = useRoute();
const router = useRouter();

function safeRedirect(target) {
  if (typeof target !== 'string' || !target.startsWith('/') || target.startsWith('//')) {
    return '/';
  }
  if (target === '/view-password' || target.startsWith('/view-password?')) {
    return '/';
  }
  return target;
}

onMounted(async () => {
  if (!config.init) {
    await initConfig();
  }
  store.dispatch('watchWsMsg');
  const result = await store.dispatch('initServerInfo', { route });
  if (result?.needsPassword) {
    if (route.name !== 'ViewPassword') {
      await router.replace({
        name: 'ViewPassword',
        query: { redirect: route.fullPath },
      });
    }
    return;
  }
  if (route.name === 'ViewPassword') {
    await router.replace(safeRedirect(route.query.redirect));
  }
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
