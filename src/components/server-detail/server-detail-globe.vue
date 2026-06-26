<template>
  <div
    ref="boxRef"
    class="server-detail-globe"
    :class="{
      'server-detail-globe--ready': ready && globeTextureCanvas,
      'server-detail-globe--has-location': hasLocation,
    }"
  >
    <v-chart
      v-if="ready && globeTextureCanvas && sizeReady"
      :key="chartRenderKey"
      ref="chartRef"
      class="server-detail-globe__chart"
      :option="option"
      :init-options="chartInitOptions"
      autoresize
    />
    <div
      v-else
      class="server-detail-globe__placeholder"
      aria-hidden="true"
    >
      <i class="ri-earth-line" />
    </div>
    <div
      v-if="locationName && ready && globeTextureCanvas"
      class="server-detail-globe__label"
    >
      {{ locationName }}
    </div>
  </div>
</template>

<script setup>
import {
  computed,
  nextTick,
  onActivated,
  onDeactivated,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from 'vue';
import { useStore } from 'vuex';
import VChart from 'vue-echarts';
import {
  geoEquirectangular,
  geoPath,
} from 'd3-geo';
import 'echarts-gl';
import {
  getGlobeRendererPixelRatio,
  getPreferredGlobeTextureSize,
} from '@/utils/globe-textures';
import {
  getGlobeGLCanvas,
  isGlobeGLContextLost,
} from '@/utils/globe-gl';

const props = defineProps({
  location: {
    type: Object,
    default: () => ({}),
  },
});

const store = useStore();

const boxRef = ref(null);
const chartRef = ref(null);
const boxSize = ref({
  width: 0,
  height: 0,
});
const worldGeoJson = ref(null);
const loaded = ref(false);
const isDeactivated = ref(false);
const globeTextureCanvas = ref(null);
const chartRenderKey = ref(0);

let resizeObserver = null;
let resizeFrame = 0;

// --- WebGL context-loss recovery ---
// The mini globe is a plain (non-interactive) echarts-gl globe, but its WebGL
// context is just as prone to being dropped by mobile browsers after
// backgrounding. Recovery is simple here: bumping chartRenderKey forces the
// <v-chart :key> to recreate the chart (and thus a fresh GL context).
const CONTEXT_LOSS_CHECK_INTERVAL_MOBILE = 3000;
const CONTEXT_LOSS_CHECK_INTERVAL_DESKTOP = 8000;
const RECOVER_MIN_INTERVAL = 1500;
let glCanvas = null;
let contextLostHandler = null;
let contextRestoredHandler = null;
let healthCheckTimer = null;
let lastRecoverAt = 0;
let recoverPending = false;
let guardsActive = false;
let visibilityHandler = null;

function normalizeCountryCode(code) {
  if (typeof code !== 'string') {
    return '';
  }

  const normalized = code.trim().toLowerCase();
  if (normalized === 'uk') {
    return 'gb';
  }
  return normalized.length === 2 ? normalized : '';
}

const sizeReady = computed(() => !isDeactivated.value
  && boxSize.value.width > 0
  && boxSize.value.height > 0);

const resolvedTheme = computed(() => store.state.resolvedTheme || 'dark');

const chartInitOptions = computed(() => ({
  renderer: 'canvas',
  devicePixelRatio: getGlobeRendererPixelRatio(),
}));

function readThemeToken(name, fallback) {
  if (typeof window === 'undefined') {
    return fallback;
  }
  const value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function readThemePalette() {
  const accentRgb = readThemeToken('--accent-primary-rgb', '78, 144, 255');
  const marker = readThemeToken('--globe-marker-active', resolvedTheme.value === 'light' ? '#ffc853' : '#2ecfff');
  const markerSoft = readThemeToken('--globe-marker-active-soft', `rgba(${accentRgb}, 0.26)`);

  if (resolvedTheme.value === 'light') {
    return {
      ocean: '#cfe5fb',
      land: '#f5f7fa',
      landBorder: 'rgba(100, 150, 200, 0.65)',
      highlight: 'rgba(59, 130, 246, 0.52)',
      highlightBorder: 'rgba(255, 255, 255, 0.92)',
      marker: '#facc15',
      markerSoft: 'rgba(250, 204, 21, 0.35)',
      markerHalo: 'transparent',
      atmosphere: '#e8f4ff',
    };
  }

  return {
    ocean: '#07111d',
    land: `rgba(${accentRgb}, 0.26)`,
    landBorder: `rgba(${accentRgb}, 0.20)`,
    highlight: `rgba(${accentRgb}, 0.46)`,
    highlightBorder: `rgba(${accentRgb}, 0.34)`,
    marker,
    markerSoft,
    markerHalo: `rgba(${accentRgb}, 0.36)`,
    atmosphere: marker,
  };
}

const locationLat = computed(() => Number(props.location?.lat));
const locationLon = computed(() => Number(
  props.location?.lng !== undefined ? props.location.lng : props.location?.lon,
));
const hasLocation = computed(() => Number.isFinite(locationLat.value)
  && Number.isFinite(locationLon.value));

const countryCode = computed(() => normalizeCountryCode(props.location?.countryCode));
const locationName = computed(() => props.location?.name || '');
const ready = computed(() => loaded.value && hasLocation.value);

const targetCountryFeature = computed(() => {
  if (!ready.value || !worldGeoJson.value || !countryCode.value) {
    return null;
  }

  return worldGeoJson.value.features?.find((feature) => (
    normalizeCountryCode(feature.properties?.iso_a2) === countryCode.value
  )) || null;
});

const targetCoord = computed(() => {
  if (!ready.value) {
    return null;
  }

  return [
    locationLon.value,
    locationLat.value,
  ];
});

const option = computed(() => {
  if (!ready.value || !globeTextureCanvas.value || !targetCoord.value) {
    return null;
  }

  const palette = readThemePalette();

  return {
    backgroundColor: 'transparent',
    globe: {
      baseTexture: globeTextureCanvas.value,
      shading: resolvedTheme.value === 'light' ? 'color' : 'lambert',
      environment: 'none',
      silent: true,
      light: resolvedTheme.value === 'light' ? null : {
        ambient: {
          intensity: 0.84,
        },
        main: {
          intensity: 1.18,
          shadow: true,
          alpha: 25,
          beta: 20,
        },
      },
      viewControl: {
        autoRotate: false,
        autoRotateSpeed: 0,
        rotateSensitivity: 0,
        zoomSensitivity: 0,
        panSensitivity: 0,
        targetCoord: targetCoord.value,
        distance: 150,
        minDistance: 100,
        maxDistance: 300,
      },
      postEffect: resolvedTheme.value === 'light' ? null : {
        enable: true,
        SSAO: {
          enable: true,
          radius: 3,
          intensity: 0.58,
          quality: 'medium',
        },
      },
      atmosphere: {
        show: true,
        color: palette.atmosphere,
        glowPower: resolvedTheme.value === 'light' ? 6 : 64,
        innerGlowPower: resolvedTheme.value === 'light' ? 2.8 : 1.8,
        offset: 0,
      },
    },
    series: [],
  };
});

function scheduleChartRerender() {
  if (
    resizeFrame
    || !ready.value
    || !globeTextureCanvas.value
    || !sizeReady.value
    || typeof window === 'undefined'
  ) {
    return;
  }

  resizeFrame = window.requestAnimationFrame(() => {
    resizeFrame = 0;
    chartRenderKey.value += 1;
  });
}

function getEchartsInstance() {
  return chartRef.value?.chart || chartRef.value || null;
}

// Re-create the chart so a fresh WebGL context is allocated. The :key on
// <v-chart> makes this a one-liner; debounced to avoid stacking with the
// context events / health check / visibility handler firing together.
function recoverGLContext(reason) {
  if (recoverPending) {
    return;
  }
  if (!ready.value || !globeTextureCanvas.value || !sizeReady.value) {
    return;
  }
  recoverPending = true;
  const now = performance.now();
  const wait = Math.max(0, RECOVER_MIN_INTERVAL - (now - lastRecoverAt));
  window.setTimeout(() => {
    recoverPending = false;
    if (!guardsActive || !ready.value || !globeTextureCanvas.value || !sizeReady.value) {
      return;
    }
    const chart = getEchartsInstance();
    const lost = chart ? isGlobeGLContextLost(chart) : true;
    // On context-lost we always rebuild; otherwise only rebuild if still lost.
    if (!lost && reason !== 'context-lost') {
      return;
    }
    lastRecoverAt = performance.now();
    chartRenderKey.value += 1;
  }, wait);
}

function attachContextLossListeners() {
  detachContextLossListeners();
  const chart = getEchartsInstance();
  if (!chart) {
    return;
  }
  const canvas = getGlobeGLCanvas(chart);
  if (!canvas) {
    return;
  }
  glCanvas = canvas;
  contextLostHandler = (event) => {
    event.preventDefault();
    recoverGLContext('context-lost');
  };
  contextRestoredHandler = () => {
    recoverGLContext('context-restored');
  };
  canvas.addEventListener('webglcontextlost', contextLostHandler);
  canvas.addEventListener('webglcontextrestored', contextRestoredHandler);
}

function detachContextLossListeners() {
  if (glCanvas && contextLostHandler) {
    glCanvas.removeEventListener('webglcontextlost', contextLostHandler);
  }
  if (glCanvas && contextRestoredHandler) {
    glCanvas.removeEventListener('webglcontextrestored', contextRestoredHandler);
  }
  glCanvas = null;
  contextLostHandler = null;
  contextRestoredHandler = null;
}

function stopHealthCheck() {
  if (healthCheckTimer) {
    window.clearInterval(healthCheckTimer);
    healthCheckTimer = null;
  }
}

function runHealthCheck() {
  if (!guardsActive || document.hidden) {
    return;
  }
  const chart = getEchartsInstance();
  if (!chart || isGlobeGLContextLost(chart)) {
    recoverGLContext('health-check');
  }
}

function scheduleHealthCheck() {
  stopHealthCheck();
  if (typeof window === 'undefined') {
    return;
  }
  const mobile = typeof window.matchMedia === 'function'
    && window.matchMedia('(max-width: 768px)').matches;
  const interval = mobile
    ? CONTEXT_LOSS_CHECK_INTERVAL_MOBILE
    : CONTEXT_LOSS_CHECK_INTERVAL_DESKTOP;
  healthCheckTimer = window.setInterval(runHealthCheck, interval);
}

function handleVisibilityChange() {
  if (document.hidden) {
    return;
  }
  const chart = getEchartsInstance();
  if (chart && isGlobeGLContextLost(chart)) {
    recoverGLContext('visibility');
  }
}

function setBoxSize(width, height, options = {}) {
  const nextSize = {
    width: Math.round(width),
    height: Math.round(height),
  };
  const widthChanged = Math.abs(nextSize.width - boxSize.value.width) >= 1;
  const heightChanged = Math.abs(nextSize.height - boxSize.value.height) >= 1;

  if (!widthChanged && !heightChanged) {
    return;
  }

  boxSize.value = nextSize;

  if (options.rerender) {
    scheduleChartRerender();
  }
}

function updateBoxSize(options = {}) {
  if (!boxRef.value) {
    return;
  }
  const rect = boxRef.value.getBoundingClientRect();
  setBoxSize(rect.width, rect.height, options);
}

function drawFeatureOnCanvas(ctx, path, feature, color, options = {}) {
  if (!feature) {
    return;
  }

  const {
    strokeColor = '',
    lineWidth = 0,
  } = options;

  ctx.beginPath();
  path(feature);
  ctx.fillStyle = color;
  ctx.fill('evenodd');

  if (strokeColor && lineWidth > 0) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function drawLocationMarkerOnCanvas(ctx, projection, palette, scale = 1) {
  const point = projection([locationLon.value, locationLat.value]);
  if (!point) {
    return;
  }

  const [x, y] = point;

  // 核心圆点，无外围光晕
  ctx.beginPath();
  ctx.arc(x, y, 14 * scale, 0, Math.PI * 2);
  ctx.fillStyle = palette.marker;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
  ctx.shadowBlur = 8 * scale;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2 * scale;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // 中心高光点，增强对比
  ctx.beginPath();
  ctx.arc(x, y, 5 * scale, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.fill();
}

function createGlobeTexture(geoJson, highlightFeature) {
  const textureSize = getPreferredGlobeTextureSize({
    maxWidth: 4096,
  });
  const textureWidth = textureSize.width;
  const textureHeight = textureSize.height;
  const textureScale = textureWidth / 2048;
  const canvas = document.createElement('canvas');
  const palette = readThemePalette();

  canvas.width = textureWidth;
  canvas.height = textureHeight;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = palette.ocean;
  ctx.fillRect(0, 0, textureWidth, textureHeight);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const projection = geoEquirectangular()
    .scale(textureWidth / (2 * Math.PI))
    .translate([textureWidth / 2, textureHeight / 2])
    .precision(0.05);
  const path = geoPath(projection, ctx);

  geoJson?.features?.forEach((feature) => {
    drawFeatureOnCanvas(ctx, path, feature, palette.land, {
      strokeColor: palette.landBorder,
      lineWidth: textureScale,
    });
  });

  if (highlightFeature) {
    drawFeatureOnCanvas(ctx, path, highlightFeature, palette.highlight, {
      strokeColor: palette.highlightBorder,
      lineWidth: 1.5 * textureScale,
    });
  }

  drawLocationMarkerOnCanvas(ctx, projection, palette, textureScale);

  return canvas;
}

function updateGlobeTexture() {
  globeTextureCanvas.value = null;

  if (!ready.value || !worldGeoJson.value) {
    return;
  }

  globeTextureCanvas.value = createGlobeTexture(worldGeoJson.value, targetCountryFeature.value);
  scheduleChartRerender();
}

watch(() => [
  ready.value,
  countryCode.value,
  locationLon.value,
  locationLat.value,
  resolvedTheme.value,
], updateGlobeTexture, {
  immediate: true,
});

// Re-attach context-loss listeners whenever the chart is (re)created — the
// offscreen GL canvas is replaced on each chartRenderKey bump.
watch(chartRenderKey, () => {
  nextTick(attachContextLossListeners);
});

onMounted(async () => {
  guardsActive = true;
  updateBoxSize();
  if (typeof ResizeObserver !== 'undefined' && boxRef.value) {
    resizeObserver = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) {
        return;
      }
      setBoxSize(cr.width, cr.height, { rerender: true });
    });
    resizeObserver.observe(boxRef.value);
  }

  visibilityHandler = handleVisibilityChange;
  document.addEventListener('visibilitychange', visibilityHandler);
  scheduleHealthCheck();

  const geoJson = await import('@/data/world.geo.json');
  worldGeoJson.value = geoJson.default;
  loaded.value = true;
});

onUnmounted(() => {
  guardsActive = false;
  stopHealthCheck();
  detachContextLossListeners();
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = null;
  }
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (resizeFrame && typeof window !== 'undefined') {
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = 0;
  }
});

onActivated(() => {
  isDeactivated.value = false;
  guardsActive = true;
  updateBoxSize({ rerender: true });
  scheduleHealthCheck();
  nextTick(() => {
    const chart = getEchartsInstance();
    if (chart && isGlobeGLContextLost(chart)) {
      recoverGLContext('activated');
    }
  });
});

onDeactivated(() => {
  isDeactivated.value = true;
  guardsActive = false;
  stopHealthCheck();
  if (resizeFrame && typeof window !== 'undefined') {
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = 0;
  }
});
</script>

<style lang="scss" scoped>
.server-detail-globe {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  overflow: visible;
  border-radius: 0;
  pointer-events: none;

  &__chart,
  &__placeholder {
    width: 100%;
    height: 100%;
  }

  &__chart {
    filter: drop-shadow(0 10px 18px rgba(var(--accent-primary-rgb), 0.18));
  }

  &__placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--globe-marker-active);
    background: transparent;

    i {
      font-size: 30px;
      line-height: 1;
      opacity: 0.76;
    }
  }

  &__label {
    position: absolute;
    right: 8px;
    bottom: 8px;
    max-width: calc(100% - 16px);
    padding: 2px 7px;
    border: 1px solid var(--panel-chip-border);
    border-radius: 999px;
    overflow: hidden;
    background: var(--globe-popup-bg);
    color: var(--text-primary);
    font-size: 10px;
    font-weight: 600;
    line-height: 1.4;
    text-overflow: ellipsis;
    white-space: nowrap;
    opacity: 0;
    transform: translateY(3px);
    transition:
      opacity var(--transition-fast),
      transform var(--transition-fast);
  }
}

@media (hover: hover) {
  :global(.globe-focus-btn--visual:hover) .server-detail-globe__label,
  :global(.globe-focus-btn--visual:focus-visible) .server-detail-globe__label {
    opacity: 1;
    transform: translateY(0);
  }
}

@media screen and (max-width: 768px) {
  .server-detail-globe {
    &__chart {
      filter: drop-shadow(0 8px 14px rgba(var(--accent-primary-rgb), 0.14));
    }

    &__placeholder i {
      font-size: 24px;
    }

    &__label {
      display: none;
    }
  }
}
</style>
