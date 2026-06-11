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
import earthDarkUrl from '@/assets/globe/earth-dark.jpg';
import earthLightUrl from '@/assets/globe/earth-light.jpg';

const INITIAL_POINT_OF_VIEW = {
  lat: 24.5,
  lng: 114,
  altitude: 1.96,
};

const textureLoader = new THREE.TextureLoader();
const textureCache = new Map();

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

function getThemePalette(theme) {
  if (theme === 'light') {
    return {
      surface: '#fbfdff',
      specular: '#a9b6cb',
      emissive: '#dde5ef',
      atmosphere: '#8ca6db',
      fog: '#eef3f9',
      ambient: '#f6f9fd',
      keyLight: '#b4c3da',
      fillLight: '#d6e0ee',
      rimLight: '#91a8d8',
      onlinePoint: '#27c46c',
      offlinePoint: '#95a0ad',
      onlineRing: '39, 196, 108',
      tooltipBg: 'rgba(255, 255, 255, 0.96)',
      tooltipBorder: 'rgba(148, 163, 184, 0.26)',
      tooltipTitle: '#182235',
      tooltipText: '#516178',
    };
  }

  return {
    surface: '#dde7f0',
    specular: '#2c3643',
    emissive: '#0c1420',
    atmosphere: '#3c66d5',
    fog: '#050a12',
    ambient: '#d8e0ea',
    keyLight: '#9bacbe',
    fillLight: '#6f7b8d',
    rimLight: '#4b70d7',
    onlinePoint: '#3be381',
    offlinePoint: '#55606e',
    onlineRing: '59, 227, 129',
    tooltipBg: 'rgba(9, 14, 24, 0.96)',
    tooltipBorder: 'rgba(91, 140, 255, 0.24)',
    tooltipTitle: '#edf4ff',
    tooltipText: '#9fb1cb',
  };
}

function resolveTextureUrl(theme) {
  return theme === 'light' ? earthLightUrl : earthDarkUrl;
}

function getGlobeTexture(theme) {
  const textureUrl = resolveTextureUrl(theme);
  let texture = textureCache.get(textureUrl);

  if (!texture) {
    texture = textureLoader.load(textureUrl);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    textureCache.set(textureUrl, texture);
  }

  return texture;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const markerData = computed(() => {
  const palette = getThemePalette(props.theme);

  return props.locations.map((loc) => {
    const serverCount = loc.servers?.length || 0;
    const hasOnline = Boolean(loc.hasOnline);
    const size = hasOnline
      ? Math.min(0.1, 0.04 + serverCount * 0.006)
      : 0.024;
    const altitude = hasOnline
      ? Math.min(0.052, 0.012 + serverCount * 0.004)
      : 0.006;

    return {
      lat: loc.lat,
      lng: loc.lng,
      size,
      altitude,
      color: hasOnline ? palette.onlinePoint : palette.offlinePoint,
      label: loc.label,
      code: loc.code,
      servers: loc.servers || [],
      serverCount,
      hasOnline,
    };
  });
});

const ringData = computed(() => {
  const palette = getThemePalette(props.theme);

  return markerData.value
    .filter((marker) => marker.hasOnline)
    .map((marker) => ({
      lat: marker.lat,
      lng: marker.lng,
      maxR: Math.min(2.1, 0.82 + marker.serverCount * 0.16),
      propagationSpeed: 0.58,
      repeatPeriod: Math.max(1500, 2300 - marker.serverCount * 70),
      colorRgb: palette.onlineRing,
      opacity: props.theme === 'light' ? 0.28 : 0.42,
    }));
});

function getPointLabel(point) {
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
    scene.fog = new THREE.FogExp2(palette.fog, props.theme === 'light' ? 0.00105 : 0.00128);
  }

  const ambientLight = new THREE.AmbientLight(
    palette.ambient,
    props.theme === 'light' ? 0.96 : 0.78,
  );
  const keyLight = new THREE.DirectionalLight(
    palette.keyLight,
    props.theme === 'light' ? 0.72 : 0.82,
  );
  keyLight.position.set(-210, 160, 210);

  const fillLight = new THREE.DirectionalLight(
    palette.fillLight,
    props.theme === 'light' ? 0.34 : 0.28,
  );
  fillLight.position.set(180, -28, 165);

  const rimLight = new THREE.DirectionalLight(
    palette.rimLight,
    props.theme === 'light' ? 0.3 : 0.46,
  );
  rimLight.position.set(28, 42, -220);

  globe.lights([ambientLight, keyLight, fillLight, rimLight]);
}

function applyThemeToGlobe() {
  if (!globe) {
    return;
  }

  const palette = getThemePalette(props.theme);
  const material = globe.globeMaterial() || new THREE.MeshPhongMaterial();
  const renderer = globe.renderer();
  const texture = getGlobeTexture(props.theme);

  if (renderer?.capabilities?.getMaxAnisotropy) {
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  }

  material.map = texture;
  material.color = new THREE.Color(palette.surface);
  material.emissive = new THREE.Color(palette.emissive);
  material.emissiveIntensity = props.theme === 'light' ? 0.045 : 0.09;
  material.shininess = props.theme === 'light' ? 2.4 : 4.2;
  material.specular = new THREE.Color(palette.specular);
  material.bumpMap = null;
  material.normalMap = null;
  material.displacementMap = null;
  material.needsUpdate = true;

  globe
    .globeMaterial(material)
    .showAtmosphere(true)
    .atmosphereColor(palette.atmosphere)
    .atmosphereAltitude(props.theme === 'light' ? 0.05 : 0.068)
    .pointLabel(getPointLabel);

  configureSceneAndLights();
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
    applyThemeToGlobe();
    configureControls();

    isReady.value = true;
  } catch (error) {
    console.error('Globe initialization failed:', error);
    initError.value = true;
  }
}

watch([markerData, ringData], () => {
  updateLayers();
}, { deep: true });

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
  textureCache.forEach((texture) => texture.dispose());
  textureCache.clear();
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
  background:
    radial-gradient(circle at center, rgba(69, 106, 204, 0.12), rgba(31, 48, 101, 0.05) 48%, transparent 74%);
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
  text-shadow: 0 0 24px rgba(91, 140, 255, 0.12);

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
