<template>
  <div class="view-password-page">
    <section class="password-card">
      <div class="password-icon" aria-hidden="true">
        <i class="ri-lock-unlock-line" />
      </div>
      <h1>{{ siteTitle }}</h1>
      <p class="password-hint">此站点需要查看密码</p>
      <form class="password-form" @submit.prevent="submit">
        <label class="password-field">
          <span class="password-label">密码</span>
          <input
            ref="passwordInput"
            v-model="password"
            type="password"
            autocomplete="current-password"
            :disabled="loading"
          >
        </label>
        <p v-if="errorMessage" class="password-error">{{ errorMessage }}</p>
        <button
          type="submit"
          class="password-submit"
          :disabled="loading || !password"
        >
          <i class="ri-lock-unlock-line" />
          {{ loading ? '验证中…' : '验证' }}
        </button>
      </form>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStore } from 'vuex';
import config from '@/config';
import { verifyStzViewPassword } from '@/utils/load-stz-config';
import wsInit from '@/ws';

defineOptions({
  name: 'ViewPassword',
});

const store = useStore();
const route = useRoute();
const router = useRouter();

const password = ref('');
const passwordInput = ref(null);
const loading = ref(false);
const errorMessage = ref('');

const siteTitle = computed(() => (
  store.state.stzBootstrap?.brand
  || config.aobobo.title
  || '查看密码'
));

function safeRedirect(target) {
  if (typeof target !== 'string' || !target.startsWith('/') || target.startsWith('//')) {
    return '/';
  }
  if (target === '/view-password' || target.startsWith('/view-password?')) {
    return '/';
  }
  return target;
}

onMounted(() => {
  if (!store.state.viewPasswordRequired) {
    router.replace(safeRedirect(route.query.redirect));
    return;
  }
  passwordInput.value?.focus?.();
});

async function submit() {
  if (loading.value || !password.value) {
    return;
  }
  loading.value = true;
  errorMessage.value = '';
  try {
    await verifyStzViewPassword(password.value);
    const result = await store.dispatch('initServerInfo', { route });
    if (result?.needsPassword) {
      errorMessage.value = '查看密码不正确';
      return;
    }
    wsInit();
    await router.replace(safeRedirect(route.query.redirect));
  } catch (error) {
    errorMessage.value = error?.code === 'invalid_view_password'
      ? '查看密码不正确'
      : '验证失败，请稍后重试';
  } finally {
    loading.value = false;
  }
}
</script>

<style lang="scss" scoped>
.view-password-page {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100vh;
  height: 100dvh;
  padding: 24px;
  background: var(--page-bg);
}

.password-card {
  position: relative;
  width: min(420px, 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 32px 28px 28px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  background: var(--section-bg);
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(24px) saturate(160%);
  color: var(--text-primary);
  text-align: center;

  h1 {
    margin: 8px 0 0;
    font-size: 20px;
    font-weight: 700;
    line-height: 1.3;
  }
}

.password-icon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 16px;
  border: 1px solid rgba(var(--accent-primary-rgb), 0.22);
  background: rgba(var(--accent-primary-rgb), 0.12);
  color: var(--accent-primary);
  font-size: 22px;
}

.password-hint {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
}

.password-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
  text-align: left;
}

.password-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.password-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.password-field input {
  width: 100%;
  min-height: 42px;
  padding: 0 12px;
  border-radius: 12px;
  border: 1px solid var(--button-subtle-border);
  background: var(--button-subtle-bg);
  color: var(--text-primary);
  font-size: 14px;
  outline: none;

  &:focus {
    border-color: var(--button-subtle-hover-border);
  }
}

.password-error {
  margin: 0;
  font-size: 12px;
  color: var(--accent-danger);
}

.password-submit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 42px;
  border-radius: 999px;
  border: 1px solid var(--button-active-border);
  background: var(--button-active-bg);
  box-shadow: var(--button-active-shadow);
  color: var(--text-on-accent);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    box-shadow: none;
  }
}
</style>
