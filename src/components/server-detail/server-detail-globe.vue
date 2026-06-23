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
      land: 'rgba(86, 145, 218, 0.66)',
      landBorder: 'rgba(35, 86, 148, 0.34)',
      highlight: '#2f6fe4',
      highlightBorder: 'rgba(246, 250, 255, 0.88)',
      marker,
      markerSoft,
      markerHalo: markerSoft,
      atmosphere: '#6a9dff',
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
      shading: 'lambert',
      environment: 'none',
      silent: true,
      light: {
        ambient: {
          intensity: resolvedTheme.value === 'light' ? 0.72 : 0.84,
        },
        main: {
          intensity: resolvedTheme.value === 'light' ? 1.16 : 1.18,
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
      postEffect: {
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
        glowPower: resolvedTheme.value === 'light' ? 24 : 64,
        innerGlowPower: resolvedTheme.value === 'light' ? 0.8 : 1.8,
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

function drawLocationMarkerOnCanvas(ctx, projection, palette) {
  const point = projection([locationLon.value, locationLat.value]);
  if (!point) {
    return;
  }

  const [x, y] = point;

  ctx.beginPath();
  ctx.arc(x, y, 18, 0, Math.PI * 2);
  ctx.fillStyle = palette.markerHalo;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.fillStyle = palette.marker;
  ctx.shadowColor = palette.markerSoft;
  ctx.shadowBlur = 24;
  ctx.fill();
  ctx.shadowBlur = 0;
}

function createGlobeTexture(geoJson, highlightFeature) {
  const textureWidth = 2048;
  const textureHeight = 1024;
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
    .precision(0.1);
  const path = geoPath(projection, ctx);

  geoJson?.features?.forEach((feature) => {
    drawFeatureOnCanvas(ctx, path, feature, palette.land, {
      strokeColor: palette.landBorder,
      lineWidth: 1,
    });
  });

  if (highlightFeature) {
    drawFeatureOnCanvas(ctx, path, highlightFeature, palette.highlight, {
      strokeColor: palette.highlightBorder,
      lineWidth: 1.5,
    });
  }

  drawLocationMarkerOnCanvas(ctx, projection, palette);

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

onMounted(async () => {
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

  const geoJson = await import('@/data/world.geo.json');
  worldGeoJson.value = geoJson.default;
  loaded.value = true;
});

onUnmounted(() => {
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
  updateBoxSize({ rerender: true });
});

onDeactivated(() => {
  isDeactivated.value = true;
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
