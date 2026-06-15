<template>
  <footer class="app-footer">
    <p class="app-footer__text">
      <span class="app-footer__prefix">{{ poweredText }}</span>
      <a
        :href="resolvedNezhaUrl"
        class="app-footer__link"
        target="_blank"
        rel="noopener noreferrer"
      >
        哪吒监控
      </a>
      <span class="app-footer__sep" aria-hidden="true">·</span>
      <span class="app-footer__prefix">{{ themeText }}</span>
      <a
        :href="resolvedAoboboUrl"
        class="app-footer__link"
        target="_blank"
        rel="noopener noreferrer"
      >
        AoBoBo
      </a>
      <span v-if="resolvedVersion" class="app-footer__version">{{ resolvedVersion }}</span>
    </p>
  </footer>
</template>

<script setup>
import { computed } from 'vue';
import { version as pkgVersion } from '../../package.json';
import config from '@/config';

const props = defineProps({
  nezhaUrl: {
    type: String,
    default: null,
  },
  aoboboUrl: {
    type: String,
    default: null,
  },
  poweredText: {
    type: String,
    default: 'Powered by',
  },
  themeText: {
    type: String,
    default: 'Theme By',
  },
  version: {
    type: String,
    default: null,
  },
  showVersion: {
    type: Boolean,
    default: true,
  },
});

const resolvedNezhaUrl = computed(() => props.nezhaUrl
  || config.nazhua.nezhaFooterUrl
  || 'https://nezha.wiki');

const resolvedAoboboUrl = computed(() => props.aoboboUrl
  || config.nazhua.aoboboFooterUrl
  || 'https://github.com/hi2shark/aobobo');

const resolvedVersion = computed(() => {
  if (!props.showVersion) return null;
  return props.version
    || config.nazhua.aoboboVersion
    || pkgVersion
    || null;
});
</script>

<style lang="scss" scoped>
.app-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-muted);
  background: transparent;
  border: none;
  border-radius: 0;
  backdrop-filter: none;
  box-shadow: none;
}

.app-footer__text {
  margin: 0;
  padding: 0;
  line-height: 1.4;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.35em;
}

.app-footer__prefix {
  opacity: 0.8;
}

.app-footer__link {
  color: var(--text-secondary);
  text-decoration: none;
  transition: color var(--transition-fast), opacity var(--transition-fast);

  &:hover,
  &:focus-visible {
    color: var(--primary-color);
    text-decoration: underline;
  }
}

.app-footer__sep {
  margin: 0 0.15em;
  opacity: 0.5;
}

.app-footer__version {
  opacity: 0.8;
}

.app-footer--absolute {
  min-height: 18px;
  margin: 0 0 6px;
  padding: 0 18px;
}

@media screen and (max-width: 768px) {
  .app-footer--absolute {
    position: absolute;
    bottom: 10px;
    left: 0;
    right: 0;
    z-index: 20;
    margin: 0;
    min-height: auto;
    padding: 8px;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }
}
</style>
