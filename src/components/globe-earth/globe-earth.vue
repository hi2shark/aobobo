<template>
  <div ref="rootRef" class="globe-earth">
    <div ref="globeContainer" class="globe-container" />

    <transition name="globe-popup-fade">
      <div
        v-if="selectedMarker"
        ref="popupWrapper"
        :class="[
          'popup-layer',
          {
            mobile: isMobile,
            hidden: !isMobile && !popupState.visible,
          },
        ]"
        :style="popupInlineStyle"
        @pointerenter="handlePopupEnter"
        @pointerleave="handlePopupLeave"
        @click.stop
      >
        <location-popup
          :location="selectedMarker"
          :mobile="isMobile"
          :placement="popupState.placement"
          @close="clearSelection"
        />
      </div>
    </transition>

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
  nextTick,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  watch,
} from 'vue';
import * as THREE from 'three';
import Globe from 'globe.gl';
import worldBoundaryData from '@/assets/globe/world-boundaries.json';
import LocationPopup from '@/components/globe-earth/location-popup.vue';

const INITIAL_POINT_OF_VIEW = {
  lat: 24.5,
  lng: 114,
  altitude: 1.75,
};

const MOBILE_BREAKPOINT = 768;
const POPUP_PADDING = 16;
const POPUP_OFFSET = 20;
const POPUP_ALTITUDE = 0.034;

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

const rootRef = ref(null);
const globeContainer = ref(null);
const popupWrapper = ref(null);
const isReady = ref(false);
const initError = ref(false);
const isMobile = ref(false);
const selectedMarker = ref(null);
const hoveredMarkerKey = ref(null);
const isPopupHovered = ref(false);
const isUserInteracting = ref(false);

const popupState = reactive({
  left: 0,
  top: 0,
  visible: false,
  placement: 'top',
});

let globe = null;
let markerElementCache = new Map();
let controlsStartHandler = null;
let controlsEndHandler = null;
let zoomHandler = null;

function getThemePalette(theme) {
  if (theme === 'light') {
    return {
      ocean: '#c7dce2',
      land: '#ecefe8',
      boundary: 'rgba(104, 119, 135, 0.42)',
      atmosphere: '#c9dde2',
      fog: '#e7f0f2',
      ambient: '#ffffff',
      keyLight: '#d8e6ea',
      fillLight: '#f8fbfc',
      rimLight: '#c5d8de',
      markerOnline: '#0d9f69',
      markerOnlineSoft: 'rgba(13, 159, 105, 0.26)',
      markerOffline: '#7d8b97',
      markerOfflineSoft: 'rgba(125, 139, 151, 0.22)',
      onlineRing: '13, 159, 105',
      globeGlow: 'rgba(136, 178, 186, 0.1)',
    };
  }

  return {
    ocean: '#050607',
    land: '#2b2f34',
    boundary: 'rgba(102, 108, 114, 0.28)',
    atmosphere: '#2f3438',
    fog: '#020303',
    ambient: '#f0f3f5',
    keyLight: '#d8dde1',
    fillLight: '#7c838a',
    rimLight: '#4f565c',
    markerOnline: '#58df9f',
    markerOnlineSoft: 'rgba(88, 223, 159, 0.2)',
    markerOffline: '#666d73',
    markerOfflineSoft: 'rgba(102, 109, 115, 0.2)',
    onlineRing: '88, 223, 159',
    globeGlow: 'rgba(132, 144, 154, 0.12)',
  };
}

function getMarkerDimensions(count) {
  if (count >= 10) {
    return { visualSize: 24, hitSize: 40, ringMaxR: 2.3 };
  }
  if (count >= 6) {
    return { visualSize: 20, hitSize: 38, ringMaxR: 1.9 };
  }
  if (count >= 3) {
    return { visualSize: 16, hitSize: 36, ringMaxR: 1.55 };
  }
  return { visualSize: 12, hitSize: 32, ringMaxR: 1.2 };
}

function getMarkerVector(lat, lng) {
  const latitude = THREE.MathUtils.degToRad(lat);
  const longitude = THREE.MathUtils.degToRad(lng);
  const x = Math.cos(latitude) * Math.sin(longitude);
  const y = Math.sin(latitude);
  const z = Math.cos(latitude) * Math.cos(longitude);

  return new THREE.Vector3(x, y, z).normalize();
}

const markerData = computed(() => {
  const palette = getThemePalette(props.theme);

  return props.locations.map((location, index) => {
    const servers = location.servers || [];
    const totalCount = servers.length;
    const onlineCount = servers.filter((server) => server.online === 1).length;
    const offlineCount = totalCount - onlineCount;
    const hasOnline = onlineCount > 0;
    const { visualSize, hitSize, ringMaxR } = getMarkerDimensions(totalCount);

    return {
      key: location.key || location.code || `${location.lat}-${location.lng}-${index}`,
      code: location.code,
      lat: location.lat,
      lng: location.lng,
      label: location.label,
      servers,
      hasOnline,
      totalCount,
      onlineCount,
      offlineCount,
      visualSize,
      hitSize,
      ringMaxR,
      altitude: hasOnline ? 0.017 : 0.014,
      markerColor: hasOnline ? palette.markerOnline : palette.markerOffline,
      markerColorSoft: hasOnline ? palette.markerOnlineSoft : palette.markerOfflineSoft,
    };
  });
});

const ringData = computed(() => {
  const palette = getThemePalette(props.theme);

  return markerData.value
    .filter((marker) => marker.hasOnline)
    .flatMap((marker) => {
      const rings = [{
        lat: marker.lat,
        lng: marker.lng,
        maxR: marker.ringMaxR,
        propagationSpeed: 0.22,
        repeatPeriod: 2700,
        colorRgb: palette.onlineRing,
        opacity: props.theme === 'light' ? 0.26 : 0.34,
      }];

      if (marker.totalCount >= 6) {
        rings.push({
          lat: marker.lat,
          lng: marker.lng,
          maxR: marker.ringMaxR + 0.65,
          propagationSpeed: 0.18,
          repeatPeriod: 3400,
          colorRgb: palette.onlineRing,
          opacity: props.theme === 'light' ? 0.18 : 0.24,
        });
      }

      return rings;
    });
});

const popupInlineStyle = computed(() => {
  if (isMobile.value) {
    return {};
  }

  return {
    left: `${popupState.left}px`,
    top: `${popupState.top}px`,
  };
});

function configureRenderer() {
  const renderer = globe?.renderer?.();
  if (!renderer) {
    return;
  }

  const { devicePixelRatio = 1 } = window;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
}

function configureSceneAndLights() {
  const palette = getThemePalette(props.theme);
  const scene = globe?.scene?.();
  if (scene) {
    scene.fog = new THREE.FogExp2(palette.fog, props.theme === 'light' ? 0.00088 : 0.00064);
  }

  const ambientLight = new THREE.AmbientLight(
    palette.ambient,
    props.theme === 'light' ? 0.78 : 0.46,
  );
  const keyLight = new THREE.DirectionalLight(
    palette.keyLight,
    props.theme === 'light' ? 0.48 : 0.26,
  );
  keyLight.position.set(-210, 145, 220);

  const fillLight = new THREE.DirectionalLight(
    palette.fillLight,
    props.theme === 'light' ? 0.14 : 0.14,
  );
  fillLight.position.set(180, -18, 165);

  const rimLight = new THREE.DirectionalLight(
    palette.rimLight,
    props.theme === 'light' ? 0.08 : 0.16,
  );
  rimLight.position.set(36, 30, -220);

  globe.lights([ambientLight, keyLight, fillLight, rimLight]);
}

function setHoveredMarker(key) {
  hoveredMarkerKey.value = key;
}

function clearHoveredMarker(key) {
  if (!key || hoveredMarkerKey.value === key) {
    hoveredMarkerKey.value = null;
  }
}

function syncMarkerElementState() {
  markerElementCache.forEach((element, key) => {
    element.classList.toggle('is-hovered', hoveredMarkerKey.value === key);
    element.classList.toggle('is-selected', selectedMarker.value?.key === key);
    element.setAttribute('aria-pressed', selectedMarker.value?.key === key ? 'true' : 'false');
  });
}

function applyAutoRotateState() {
  if (!globe) {
    return;
  }

  const shouldPause = Boolean(
    hoveredMarkerKey.value
      || isPopupHovered.value
      || isUserInteracting.value
      || selectedMarker.value,
  );

  globe.controls().autoRotate = props.autoRotate && !shouldPause;
}

function focusLocation(location) {
  if (!globe || !location) {
    return;
  }

  globe.pointOfView({
    lat: location.lat,
    lng: location.lng,
    altitude: isMobile.value ? 1.72 : 1.58,
  }, 920);
}

function clearSelection(shouldEmit = true) {
  selectedMarker.value = null;
  isPopupHovered.value = false;
  popupState.visible = false;
  popupState.placement = 'top';
  syncMarkerElementState();
  applyAutoRotateState();

  if (shouldEmit) {
    emit('marker-click', null);
  }
}

function isMarkerFacingCamera(marker) {
  if (!globe || !marker) {
    return false;
  }

  const camera = globe.camera?.();
  if (!camera?.position) {
    return true;
  }

  const cameraVector = camera.position.clone().normalize();
  const coords = globe.getCoords?.(marker.lat, marker.lng, marker.altitude);
  const markerVector = coords
    ? new THREE.Vector3(coords.x, coords.y, coords.z).normalize()
    : getMarkerVector(marker.lat, marker.lng);

  return markerVector.dot(cameraVector) > 0.08;
}

function updatePopupPosition() {
  if (!selectedMarker.value) {
    popupState.visible = false;
    return;
  }

  if (isMobile.value) {
    popupState.visible = true;
    popupState.placement = 'top';
    return;
  }

  if (!globe || !popupWrapper.value || !rootRef.value) {
    return;
  }

  if (!isMarkerFacingCamera(selectedMarker.value)) {
    popupState.visible = false;
    return;
  }

  const coords = globe.getScreenCoords?.(
    selectedMarker.value.lat,
    selectedMarker.value.lng,
    selectedMarker.value.altitude + POPUP_ALTITUDE,
  );
  if (!coords) {
    popupState.visible = false;
    return;
  }

  const rootRect = rootRef.value.getBoundingClientRect();
  const popupRect = popupWrapper.value.getBoundingClientRect();
  const markerX = coords.x - rootRect.left;
  const markerY = coords.y - rootRect.top;

  let left = markerX - (popupRect.width / 2);
  let top = markerY - popupRect.height - POPUP_OFFSET;
  let placement = 'top';

  if (top < POPUP_PADDING) {
    placement = 'bottom';
    top = markerY + POPUP_OFFSET;
  }

  left = Math.max(POPUP_PADDING, Math.min(left, rootRect.width - popupRect.width - POPUP_PADDING));
  top = Math.max(POPUP_PADDING, Math.min(top, rootRect.height - popupRect.height - POPUP_PADDING));

  popupState.left = left;
  popupState.top = top;
  popupState.placement = placement;
  popupState.visible = true;
}

function selectMarker(marker) {
  selectedMarker.value = marker;
  isPopupHovered.value = false;
  emit('marker-click', marker);
  focusLocation(marker);
  syncMarkerElementState();
  applyAutoRotateState();

  nextTick(() => {
    updatePopupPosition();
  });
}

function applyThemeToGlobe() {
  if (!globe) {
    return;
  }

  const palette = getThemePalette(props.theme);
  const material = globe.globeMaterial() || new THREE.MeshPhongMaterial();

  material.map = null;
  material.color = new THREE.Color(palette.ocean);
  material.emissive = new THREE.Color(palette.ocean);
  material.emissiveIntensity = props.theme === 'light' ? 0.008 : 0.015;
  material.shininess = props.theme === 'light' ? 0.45 : 0.08;
  material.specular = new THREE.Color(props.theme === 'light' ? '#b9ced4' : '#0b0d0f');
  material.bumpMap = null;
  material.normalMap = null;
  material.displacementMap = null;
  material.needsUpdate = true;

  globe
    .globeMaterial(material)
    .showAtmosphere(true)
    .atmosphereColor(palette.atmosphere)
    .atmosphereAltitude(props.theme === 'light' ? 0.022 : 0.026)
    .polygonsData(worldBoundaryData.features)
    .polygonGeoJsonGeometry('geometry')
    .polygonCapMaterial(new THREE.MeshPhongMaterial({
      color: palette.land,
      emissive: new THREE.Color(palette.land),
      emissiveIntensity: props.theme === 'light' ? 0.004 : 0.015,
      shininess: props.theme === 'light' ? 0.35 : 0.06,
      specular: new THREE.Color(props.theme === 'light' ? '#c7d5d9' : '#0d0f12'),
    }))
    .polygonSideColor(() => 'rgba(0,0,0,0)')
    .polygonStrokeColor(() => palette.boundary)
    .polygonAltitude(props.theme === 'light' ? 0.0055 : 0.006)
    .polygonLabel('')
    .onPolygonClick(() => {
      clearSelection();
    });

  configureSceneAndLights();
}

function createMarkerElement(marker) {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = `globe-marker ${marker.hasOnline ? 'is-online' : 'is-offline'}`;
  element.dataset.key = marker.key;
  element.setAttribute('aria-label', `${marker.label}，${marker.totalCount}台服务器`);
  element.innerHTML = `
    <span class="marker-hit">
      ${marker.hasOnline ? '<span class="marker-pulse"></span>' : ''}
      <svg class="marker-svg" viewBox="0 0 100 100" aria-hidden="true">
        <circle class="marker-shell" cx="50" cy="50" r="30" />
        <circle class="marker-core" cx="50" cy="50" r="18" />
        <circle class="marker-center" cx="50" cy="50" r="6" />
      </svg>
    </span>
  `;

  element.style.setProperty('--marker-visual-size', `${marker.visualSize}px`);
  element.style.setProperty('--marker-hit-size', `${marker.hitSize}px`);
  element.style.setProperty('--marker-core-color', marker.markerColor);
  element.style.setProperty('--marker-shell-color', marker.markerColorSoft);

  element.addEventListener('mouseenter', () => setHoveredMarker(marker.key));
  element.addEventListener('mouseleave', () => clearHoveredMarker(marker.key));
  element.addEventListener('focus', () => setHoveredMarker(marker.key));
  element.addEventListener('blur', () => clearHoveredMarker(marker.key));
  element.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    selectMarker(marker);
  });

  markerElementCache.set(marker.key, element);
  syncMarkerElementState();
  return element;
}

function updateLayers(resetMarkerCache = false) {
  if (!globe) {
    return;
  }

  if (resetMarkerCache) {
    markerElementCache = new Map();
  }

  globe
    .htmlElementsData(markerData.value)
    .ringsData(ringData.value);

  syncMarkerElementState();
}

function configureControls() {
  const controls = globe.controls();
  controls.autoRotateSpeed = props.rotateSpeed * 0.16;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 145;
  controls.maxDistance = 285;
  controls.rotateSpeed = 0.42;

  controlsStartHandler = () => {
    isUserInteracting.value = true;
  };
  controlsEndHandler = () => {
    isUserInteracting.value = false;
    nextTick(() => {
      updatePopupPosition();
    });
  };

  controls.addEventListener('start', controlsStartHandler);
  controls.addEventListener('end', controlsEndHandler);
  applyAutoRotateState();
}

function resetView() {
  if (!globe) {
    return;
  }

  globe.pointOfView(INITIAL_POINT_OF_VIEW, 1100);
}

function handlePopupEnter() {
  isPopupHovered.value = true;
}

function handlePopupLeave() {
  isPopupHovered.value = false;
}

function updateViewportMode() {
  isMobile.value = window.innerWidth <= MOBILE_BREAKPOINT;
}

function handleResize() {
  updateViewportMode();

  if (!globe || !globeContainer.value) {
    return;
  }

  const { clientWidth: width, clientHeight: height } = globeContainer.value;
  globe.width(width).height(height);

  nextTick(() => {
    updatePopupPosition();
  });
}

function initGlobe() {
  if (!globeContainer.value) {
    return;
  }

  try {
    const { clientWidth: width, clientHeight: height } = globeContainer.value;
    globe = Globe()(globeContainer.value);

    zoomHandler = () => {
      updatePopupPosition();
    };

    globe
      .width(width)
      .height(height)
      .globeOffset([0, 10])
      .backgroundColor('rgba(0,0,0,0)')
      .pointOfView(INITIAL_POINT_OF_VIEW)
      .htmlLat('lat')
      .htmlLng('lng')
      .htmlAltitude('altitude')
      .htmlElement((marker) => createMarkerElement(marker))
      .htmlTransitionDuration(320)
      .htmlElementVisibilityModifier((element, visible) => {
        element.classList.toggle('is-hidden', !visible);
      })
      .onGlobeClick(() => {
        clearSelection();
      })
      .onZoom(zoomHandler)
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
    updateLayers(true);
    configureControls();

    isReady.value = true;
  } catch (error) {
    console.error('Globe initialization failed:', error);
    initError.value = true;
  }
}

watch(markerData, (nextMarkers) => {
  if (!globe) {
    return;
  }

  if (selectedMarker.value) {
    const nextSelected = nextMarkers.find((marker) => marker.key === selectedMarker.value.key);
    if (nextSelected) {
      selectedMarker.value = nextSelected;
    } else {
      clearSelection();
    }
  }

  updateLayers(true);
  nextTick(() => {
    updatePopupPosition();
  });
});

watch(() => props.autoRotate, () => {
  applyAutoRotateState();
});

watch(() => props.rotateSpeed, (value) => {
  if (!globe) {
    return;
  }

  globe.controls().autoRotateSpeed = value * 0.16;
});

watch(() => props.theme, () => {
  applyThemeToGlobe();
  updateLayers(true);
  nextTick(() => {
    updatePopupPosition();
  });
});

watch(
  [hoveredMarkerKey, isPopupHovered, isUserInteracting, selectedMarker, isMobile],
  () => {
    syncMarkerElementState();
    applyAutoRotateState();
    nextTick(() => {
      updatePopupPosition();
    });
  },
);

defineExpose({
  focusLocation,
  resetView,
  clearSelection,
});

onMounted(() => {
  updateViewportMode();
  initGlobe();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);

  const controls = globe?.controls?.();
  if (controls && controlsStartHandler) {
    controls.removeEventListener('start', controlsStartHandler);
  }
  if (controls && controlsEndHandler) {
    controls.removeEventListener('end', controlsEndHandler);
  }
  if (zoomHandler) {
    globe?.onZoom?.(() => {});
  }

  markerElementCache.clear();
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
  inset: 14% 16% auto;
  height: 32%;
  border-radius: 50%;
  background:
    radial-gradient(circle at center, var(--globe-orb-glow), transparent 70%);
  filter: blur(28px);
  opacity: 0.88;
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

.popup-layer {
  position: absolute;
  z-index: 4;
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;

  &.hidden {
    opacity: 0;
    pointer-events: none;
    transform: scale(0.98);
  }

  &.mobile {
    inset: auto 12px 12px 12px;
  }
}

.globe-loading {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-secondary);
  font-size: 14px;
  text-shadow: 0 0 24px rgba(15, 23, 42, 0.08);

  i {
    font-size: 32px;
    color: var(--empty-icon-color-soft);
  }

  .spin {
    animation: spin 1s linear infinite;
  }
}

.globe-popup-fade-enter-active,
.globe-popup-fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.globe-popup-fade-enter-from,
.globe-popup-fade-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

:deep(.globe-marker) {
  width: var(--marker-hit-size);
  height: var(--marker-hit-size);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    opacity 0.18s ease,
    filter 0.18s ease;

  &.is-hidden {
    opacity: 0;
    pointer-events: none;
  }

  &.is-hovered,
  &.is-selected {
    transform: scale(1.08);
    filter: drop-shadow(0 10px 22px rgba(15, 23, 42, 0.16));
  }
}

:deep(.marker-hit) {
  position: relative;
  width: var(--marker-hit-size);
  height: var(--marker-hit-size);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

:deep(.marker-svg) {
  width: var(--marker-visual-size);
  height: var(--marker-visual-size);
  overflow: visible;
}

:deep(.marker-shell) {
  fill: var(--marker-shell-color);
}

:deep(.marker-core) {
  fill: var(--marker-core-color);
}

:deep(.marker-center) {
  fill: rgba(255, 255, 255, 0.92);
}

:deep(.globe-marker.is-offline .marker-center) {
  fill: rgba(255, 255, 255, 0.7);
}

:deep(.marker-pulse) {
  position: absolute;
  width: calc(var(--marker-visual-size) + 6px);
  height: calc(var(--marker-visual-size) + 6px);
  border-radius: 999px;
  border: 1px solid var(--marker-core-color);
  opacity: 0.42;
  animation: marker-pulse 2.8s ease-out infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes marker-pulse {
  0% {
    transform: scale(0.78);
    opacity: 0.42;
  }
  70% {
    opacity: 0;
  }
  100% {
    transform: scale(2);
    opacity: 0;
  }
}

@media screen and (max-width: 768px) {
  .popup-layer.mobile {
    inset: auto 12px 12px 12px;
  }
}
</style>
