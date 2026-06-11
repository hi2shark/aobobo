<template>
  <div class="globe-earth">
    <div ref="globeContainer" class="globe-container" />
    <div v-if="!isReady" class="globe-loading">
      <template v-if="!initError">
        <i class="ri-loader-4-line spin" />
        <span>加载地球中...</span>
      </template>
      <template v-else>
        <i class="ri-earth-line" />
        <span>地球初始化失败，请刷新重试</span>
      </template>
    </div>
  </div>
</template>

<script setup>
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from 'vue';
import * as THREE from 'three';
import Globe from 'globe.gl';
import graticuleData from '@/assets/globe/graticule.json';
import worldBoundaryData from '@/assets/globe/world-boundaries.json';
import {
  createGlobeTexture,
  disposeGlobeTextures,
} from '@/utils/globe-textures';

const INITIAL_POINT_OF_VIEW = {
  lat: 24.5,
  lng: 114,
  altitude: 1.96,
};

const GRATICULE_PATHS = graticuleData.features.map((feature) => ({
  coords: feature.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
}));

const FALLBACK_PALETTE = {
  dark: {
    surface: '#1a2030',
    specular: '#2c3643',
    emissive: '#080c14',
    emissiveIntensity: 0.06,
    shininess: 6,
    surfaceOpacity: 1,
    atmosphere: '#4a6fa5',
    atmosphereAltitude: 0.025,
    fog: '#050a12',
    fogDensity: 0.00128,
    ambient: '#d8e0ea',
    ambientIntensity: 0.82,
    keyLight: '#9bacbe',
    keyLightIntensity: 0.22,
    fillLight: '#6f7b8d',
    fillLightIntensity: 0.12,
    rimLight: '#4b70d7',
    rimLightIntensity: 0.08,
    onlinePoint: '#2a9d8f',
    offlinePoint: '#6b7a85',
    onlineRing: '59, 227, 129',
    ringOpacity: 0.42,
    ringSpeed: 0.58,
    haloOpacity: 0.22,
    graticuleColor: 'transparent',
    boundaryColor: 'rgba(90, 170, 200, 0.8)',
    tooltipBg: 'rgba(9, 14, 24, 0.96)',
    tooltipBorder: 'rgba(91, 140, 255, 0.24)',
    tooltipTitle: '#edf4ff',
    tooltipText: '#9fb1cb',
  },
  light: {
    surface: '#e8f4f1',
    specular: '#a9b6cb',
    emissive: '#c8e8e0',
    emissiveIntensity: 0.035,
    shininess: 6,
    surfaceOpacity: 0.92,
    atmosphere: '#c8ddf0',
    atmosphereAltitude: 0.015,
    fog: '#eef3f9',
    fogDensity: 0.00105,
    ambient: '#f6f9fd',
    ambientIntensity: 0.88,
    keyLight: '#b4c3da',
    keyLightIntensity: 0.2,
    fillLight: '#d6e0ee',
    fillLightIntensity: 0.1,
    rimLight: '#5b8cff',
    rimLightIntensity: 0.06,
    onlinePoint: '#2a9d8f',
    offlinePoint: '#8a9aa5',
    onlineRing: '32, 168, 122',
    ringOpacity: 0.26,
    ringSpeed: 0.42,
    haloOpacity: 0.18,
    graticuleColor: 'rgba(120, 170, 160, 0.18)',
    boundaryColor: 'rgba(55, 150, 150, 0.88)',
    tooltipBg: 'rgba(255, 255, 255, 0.96)',
    tooltipBorder: 'rgba(148, 163, 184, 0.26)',
    tooltipTitle: '#182235',
    tooltipText: '#516178',
  },
};

const props = defineProps({
  locations: {
    type: Array,
    default: () => [],
  },
  autoRotate: {
    type: Boolean,
    default: true,
  },
  rotateSpeed: {
    type: Number,
    default: 0.5,
  },
  theme: {
    type: String,
    default: 'dark',
  },
});

const emit = defineEmits(['marker-click']);

const globeContainer = ref(null);
const isReady = ref(false);
const initError = ref(false);

let globe = null;
let currentMaterial = null;

function readCssVar(name, fallback = '') {
  if (typeof document === 'undefined') {
    return fallback;
  }

  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();

  return value || fallback;
}

function readNumberCssVar(name, fallback) {
  const value = Number.parseFloat(readCssVar(name, String(fallback)));
  return Number.isFinite(value) ? value : fallback;
}

function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) {
    return null;
  }

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function toRgba(color, alpha) {
  if (!color) {
    return `rgba(0, 0, 0, ${alpha})`;
  }

  if (color.startsWith('rgba(') || color.startsWith('rgb(')) {
    return color;
  }

  const rgb = hexToRgb(color);
  if (!rgb) {
    return color;
  }

  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function getThemePalette(theme) {
  const fallback = FALLBACK_PALETTE[theme === 'light' ? 'light' : 'dark'];

  return {
    surface: readCssVar('--globe-surface', fallback.surface),
    specular: readCssVar('--globe-specular', fallback.specular),
    emissive: readCssVar('--globe-emissive', fallback.emissive),
    emissiveIntensity: readNumberCssVar('--globe-emissive-intensity', fallback.emissiveIntensity),
    shininess: readNumberCssVar('--globe-shininess', fallback.shininess),
    surfaceOpacity: readNumberCssVar('--globe-surface-opacity', fallback.surfaceOpacity),
    roughness: readNumberCssVar('--globe-roughness', fallback.roughness),
    metalness: readNumberCssVar('--globe-metalness', fallback.metalness),
    atmosphere: readCssVar('--globe-atmosphere', fallback.atmosphere),
    atmosphereAltitude: readNumberCssVar('--globe-atmosphere-altitude', fallback.atmosphereAltitude),
    fog: readCssVar('--globe-fog', fallback.fog),
    fogDensity: readNumberCssVar('--globe-fog-density', fallback.fogDensity),
    ambient: readCssVar('--globe-ambient-light', fallback.ambient),
    ambientIntensity: readNumberCssVar('--globe-ambient-light-intensity', fallback.ambientIntensity),
    keyLight: readCssVar('--globe-key-light', fallback.keyLight),
    keyLightIntensity: readNumberCssVar('--globe-key-light-intensity', fallback.keyLightIntensity),
    fillLight: readCssVar('--globe-fill-light', fallback.fillLight),
    fillLightIntensity: readNumberCssVar('--globe-fill-light-intensity', fallback.fillLightIntensity),
    rimLight: readCssVar('--globe-rim-light', fallback.rimLight),
    rimLightIntensity: readNumberCssVar('--globe-rim-light-intensity', fallback.rimLightIntensity),
    onlinePoint: readCssVar('--globe-online-point', fallback.onlinePoint),
    offlinePoint: readCssVar('--globe-offline-point', fallback.offlinePoint),
    onlineRing: readCssVar('--globe-ring-rgb', fallback.onlineRing),
    ringOpacity: readNumberCssVar('--globe-ring-opacity', fallback.ringOpacity),
    ringSpeed: readNumberCssVar('--globe-ring-speed', fallback.ringSpeed),
    haloOpacity: readNumberCssVar('--globe-halo-opacity', fallback.haloOpacity),
    graticuleColor: readCssVar('--globe-graticule-color', fallback.graticuleColor),
    boundaryColor: readCssVar('--globe-boundary-color', fallback.boundaryColor),
    tooltipBg: readCssVar('--globe-tooltip-bg', fallback.tooltipBg),
    tooltipBorder: readCssVar('--globe-tooltip-border', fallback.tooltipBorder),
    tooltipTitle: readCssVar('--globe-tooltip-title', fallback.tooltipTitle),
    tooltipText: readCssVar('--globe-tooltip-text', fallback.tooltipText),
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildMarkerEntry(loc, palette) {
  const serverCount = loc.servers?.length || 0;
  const hasOnline = Boolean(loc.hasOnline);
  const size = hasOnline
    ? Math.max(0.022, Math.min(0.055, 0.025 + serverCount * 0.003))
    : 0.016;
  const altitude = hasOnline
    ? Math.min(0.04, 0.008 + serverCount * 0.002)
    : 0.004;
  const pointColor = hasOnline ? palette.onlinePoint : palette.offlinePoint;

  const core = {
    layer: 'core',
    lat: loc.lat,
    lng: loc.lng,
    size,
    altitude,
    color: pointColor,
    label: loc.label,
    code: loc.code,
    servers: loc.servers || [],
    serverCount,
    hasOnline,
  };

  if (!hasOnline) {
    return [core];
  }

  const halo = {
    layer: 'halo',
    lat: loc.lat,
    lng: loc.lng,
    size: size * 3.5,
    altitude: altitude * 0.85,
    color: toRgba(pointColor, palette.haloOpacity * 0.6),
    label: '',
    code: loc.code,
    servers: loc.servers || [],
    serverCount,
    hasOnline,
  };

  return [halo, core];
}

const markerData = computed(() => {
  const palette = getThemePalette(props.theme);
  return props.locations.flatMap((loc) => buildMarkerEntry(loc, palette));
});

const ringData = computed(() => []);

function getPointLabel(point) {
  if (point.layer === 'halo' || !point.label) {
    return '';
  }

  const palette = getThemePalette(props.theme);
  return `
    <div style="
      min-width: 132px;
      padding: 10px 12px;
      border-radius: 10px;
      background: ${palette.tooltipBg};
      border: 1px solid ${palette.tooltipBorder};
      color: ${palette.tooltipTitle};
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.16);
      font-size: 13px;
      line-height: 1.45;
    ">
      <div style="font-weight: 600; margin-bottom: 4px;">${escapeHtml(point.label)}</div>
      <div style="color: ${palette.tooltipText}; font-size: 12px;">服务器: ${point.serverCount}台</div>
    </div>
  `;
}

function configureRenderer() {
  const renderer = globe.renderer();
  if (!renderer) {
    return;
  }

  const { devicePixelRatio = 1 } = window;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
}

function configureSceneAndLights() {
  const palette = getThemePalette(props.theme);
  const scene = globe.scene();

  if (scene) {
    scene.fog = new THREE.FogExp2(palette.fog, palette.fogDensity);
  }

  const ambientLight = new THREE.AmbientLight(
    palette.ambient,
    palette.ambientIntensity,
  );
  const keyLight = new THREE.DirectionalLight(
    palette.keyLight,
    palette.keyLightIntensity,
  );
  keyLight.position.set(-210, 160, 210);

  const fillLight = new THREE.DirectionalLight(
    palette.fillLight,
    palette.fillLightIntensity,
  );
  fillLight.position.set(180, -28, 165);

  const rimLight = new THREE.DirectionalLight(
    palette.rimLight,
    palette.rimLightIntensity,
  );
  rimLight.position.set(28, 42, -220);

  globe.lights([ambientLight, keyLight, fillLight, rimLight]);
}

const surfacePaths = computed(() => (
  props.theme === 'light'
    ? GRATICULE_PATHS.map((path) => ({ ...path, type: 'graticule' }))
    : []
));

function applyThemeToGlobe() {
  if (!globe) {
    return;
  }

  const palette = getThemePalette(props.theme);
  const renderer = globe.renderer();
  const texture = createGlobeTexture(props.theme, worldBoundaryData);

  if (renderer?.capabilities?.getMaxAnisotropy) {
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  }

  const oldMaterial = currentMaterial || globe.globeMaterial();
  const material = new THREE.MeshPhongMaterial({
    map: texture,
    color: new THREE.Color(0xffffff),
    emissive: new THREE.Color(palette.emissive),
    emissiveIntensity: palette.emissiveIntensity,
    shininess: palette.shininess,
    specular: new THREE.Color(palette.specular),
    transparent: palette.surfaceOpacity < 1,
    opacity: palette.surfaceOpacity,
  });

  currentMaterial = material;

  if (oldMaterial && oldMaterial !== material) {
    oldMaterial.dispose();
  }

  globe
    .globeMaterial(material)
    .showAtmosphere(true)
    .atmosphereColor(palette.atmosphere)
    .atmosphereAltitude(palette.atmosphereAltitude)
    .pointLabel(getPointLabel)
    .pathsData(surfacePaths.value)
    .pathPoints('coords')
    .pathPointLat('lat')
    .pathPointLng('lng')
    .pathColor(() => palette.graticuleColor)
    .pathStroke(0.3);

  configureSceneAndLights();
}

function updateSurfaceLines() {
  if (!globe) {
    return;
  }

  const palette = getThemePalette(props.theme);
  globe
    .pathsData(surfacePaths.value)
    .pathColor(() => palette.graticuleColor)
    .pathStroke(0.3);
}

function updateLayers() {
  if (!globe) {
    return;
  }

  globe
    .pointsData(markerData.value)
    .ringsData(ringData.value)
    .pointLabel(getPointLabel);
}

function configureControls() {
  const controls = globe.controls();
  controls.autoRotate = props.autoRotate;
  controls.autoRotateSpeed = props.rotateSpeed * 0.38;
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.enablePan = false;
  controls.minDistance = 140;
  controls.maxDistance = 290;
  controls.rotateSpeed = 0.58;
}

function focusLocation(location) {
  if (!globe || !location) {
    return;
  }

  globe.pointOfView({
    lat: location.lat,
    lng: location.lng,
    altitude: 1.58,
  }, 950);
}

function resetView() {
  if (!globe) {
    return;
  }

  globe.pointOfView(INITIAL_POINT_OF_VIEW, 1100);
}

function handleResize() {
  if (!globe || !globeContainer.value) {
    return;
  }

  const { clientWidth: width, clientHeight: height } = globeContainer.value;
  globe.width(width).height(height);
}

function initGlobe() {
  if (!globeContainer.value) {
    return;
  }

  try {
    const { clientWidth: width, clientHeight: height } = globeContainer.value;
    globe = Globe()(globeContainer.value);

    globe
      .width(width)
      .height(height)
      .globeOffset([0, 10])
      .backgroundColor('rgba(0,0,0,0)')
      .showAtmosphere(true)
      .pointOfView(INITIAL_POINT_OF_VIEW)
      .pointResolution(20)
      .pointsTransitionDuration(560)
      .pointsData(markerData.value)
      .pointLat('lat')
      .pointLng('lng')
      .pointColor('color')
      .pointAltitude('altitude')
      .pointRadius('size')
      .pointLabel(getPointLabel)
      .onPointClick((point) => {
        if (point.layer === 'halo') {
          return;
        }
        emit('marker-click', point);
      })
      .onGlobeClick(() => {
        emit('marker-click', null);
      })
      .ringsData(ringData.value)
      .ringLat('lat')
      .ringLng('lng')
      .ringColor((ring) => (time) => `rgba(${ring.colorRgb}, ${Math.max(0, ring.opacity * (1 - time))})`)
      .ringMaxRadius('maxR')
      .ringPropagationSpeed('propagationSpeed')
      .ringRepeatPeriod('repeatPeriod');

    globe.globeMaterial(new THREE.MeshPhongMaterial());
    configureRenderer();
    configureControls();
    applyThemeToGlobe();

    isReady.value = true;
  } catch (error) {
    console.error('Globe initialization failed:', error);
    initError.value = true;
  }
}

watch([markerData, ringData], () => {
  updateLayers();
}, { deep: true });

watch(surfacePaths, () => {
  updateSurfaceLines();
});

watch(() => props.autoRotate, (value) => {
  if (!globe) {
    return;
  }

  globe.controls().autoRotate = value;
});

watch(() => props.rotateSpeed, (value) => {
  if (!globe) {
    return;
  }

  globe.controls().autoRotateSpeed = value * 0.38;
});

watch(() => props.theme, () => {
  applyThemeToGlobe();
  updateLayers();
});

defineExpose({
  focusLocation,
  resetView,
});

onMounted(() => {
  initGlobe();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  if (currentMaterial) {
    currentMaterial.dispose();
    currentMaterial = null;
  }
  disposeGlobeTextures();
  globe = null;
});
</script>

<style lang="scss" scoped>
.globe-earth {
  width: 100%;
  height: 100%;
  position: relative;
}

.globe-earth::before {
  content: '';
  position: absolute;
  inset: 15% 17% auto;
  height: 30%;
  border-radius: 50%;
  background: var(--globe-ambient-glow);
  filter: blur(24px);
  opacity: 0.72;
  pointer-events: none;
  z-index: 0;
}

.globe-container {
  width: 100%;
  height: 100%;
  position: relative;
  z-index: 1;

  :deep(canvas) {
    display: block;
    outline: none;
  }
}

.globe-loading {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-secondary);
  font-size: 14px;
  text-shadow: var(--globe-loading-glow);

  i {
    font-size: 32px;
    color: var(--empty-icon-color-soft);
  }

  .spin {
    animation: spin 1s linear infinite;
  }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
