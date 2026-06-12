<template>
  <div
    ref="rootRef"
    :class="['globe-earth', { 'is-interacting': isMarkerAnimationSuspended }]"
  >
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
import worldLandData from '@/assets/globe/world-land.json';
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
const MARKER_HTML_TRANSITION_DURATION = 320;
const INTERACTION_SETTLE_DELAY = 120;

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
const isMarkerAnimationSuspended = ref(false);

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
let interactionSettleTimer = null;

function getThemePalette(theme) {
  if (theme === 'light') {
    return {
      ocean: '#9eb8e8',
      oceanEmissive: '#9eb8e8',
      oceanSpecular: '#9eb8e8',
      land: '#e8e4dc',
      landEmissive: '#e8e4dc',
      coastline: 'rgba(160, 150, 135, 0.35)',
      atmosphere: '#b8cdf0',
      fog: '#f4f8fc',
      ambient: '#ffffff',
      keyLight: '#ffffff',
      fillLight: '#ffffff',
      rimLight: '#ffffff',
      markerOnline: '#0e9b66',
      markerOnlineSoft: 'rgba(14, 155, 102, 0.26)',
      markerOffline: '#7d8793',
      markerOfflineSoft: 'rgba(125, 135, 147, 0.22)',
      onlineRing: '14, 155, 102',
      globeGlow: 'rgba(150, 185, 220, 0.1)',
    };
  }

  return {
    ocean: '#050b13',
    oceanEmissive: '#09131e',
    oceanSpecular: '#10202d',
    land: '#1c2733',
    landEmissive: '#253341',
    coastline: 'rgba(106, 131, 152, 0.34)',
    atmosphere: '#607d97',
    fog: '#01050a',
    ambient: '#edf5fb',
    keyLight: '#bfd1de',
    fillLight: '#52697a',
    rimLight: '#708697',
    markerOnline: '#58df9f',
    markerOnlineSoft: 'rgba(88, 223, 159, 0.2)',
    markerOffline: '#666d73',
    markerOfflineSoft: 'rgba(102, 109, 115, 0.2)',
    onlineRing: '88, 223, 159',
    globeGlow: 'rgba(112, 138, 160, 0.1)',
  };
}

function getMarkerDimensions(count) {
  if (count >= 10) {
    return { visualSize: 34, hitSize: 52, ringMaxR: 2.3 };
  }
  if (count >= 6) {
    return { visualSize: 30, hitSize: 48, ringMaxR: 1.9 };
  }
  if (count >= 3) {
    return { visualSize: 26, hitSize: 44, ringMaxR: 1.55 };
  }
  return { visualSize: 22, hitSize: 40, ringMaxR: 1.2 };
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
    scene.fog = new THREE.FogExp2(palette.fog, props.theme === 'light' ? 0.00076 : 0.00046);
  }

  const ambientLight = new THREE.AmbientLight(
    palette.ambient,
    props.theme === 'light' ? 0.72 : 0.4,
  );
  const keyLight = new THREE.DirectionalLight(
    palette.keyLight,
    props.theme === 'light' ? 0.4 : 0.22,
  );
  keyLight.position.set(-210, 145, 220);

  const fillLight = new THREE.DirectionalLight(
    palette.fillLight,
    props.theme === 'light' ? 0.11 : 0.12,
  );
  fillLight.position.set(180, -18, 165);

  const rimLight = new THREE.DirectionalLight(
    palette.rimLight,
    props.theme === 'light' ? 0.09 : 0.14,
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

function getActiveRingData() {
  return isMarkerAnimationSuspended.value ? [] : ringData.value;
}

function clearInteractionSettleTimer() {
  if (interactionSettleTimer) {
    window.clearTimeout(interactionSettleTimer);
    interactionSettleTimer = null;
  }
}

function setMarkerAnimationSuspended(suspended) {
  isMarkerAnimationSuspended.value = suspended;

  if (!globe) {
    return;
  }

  globe
    .htmlTransitionDuration(suspended ? 0 : MARKER_HTML_TRANSITION_DURATION)
    .ringsData(getActiveRingData());
}

function applyAutoRotateState() {
  if (!globe) {
    return;
  }

  const shouldPause = Boolean(
    hoveredMarkerKey.value
      || isPopupHovered.value
      || isMarkerAnimationSuspended.value
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

function suspendMarkerAnimations() {
  clearInteractionSettleTimer();
  setMarkerAnimationSuspended(true);
}

function scheduleMarkerAnimationResume() {
  clearInteractionSettleTimer();
  interactionSettleTimer = window.setTimeout(() => {
    interactionSettleTimer = null;

    if (isUserInteracting.value) {
      return;
    }

    setMarkerAnimationSuspended(false);
    nextTick(() => {
      updatePopupPosition();
    });
  }, INTERACTION_SETTLE_DELAY);
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
  const isLight = props.theme === 'light';
  const material = isLight
    ? new THREE.MeshBasicMaterial({ color: palette.ocean })
    : (globe.globeMaterial() || new THREE.MeshPhongMaterial());

  if (!isLight) {
    material.map = null;
    material.color = new THREE.Color(palette.ocean);
    material.emissive = new THREE.Color(palette.oceanEmissive);
    material.emissiveIntensity = 0.08;
    material.shininess = 0.04;
    material.specular = new THREE.Color(palette.oceanSpecular);
    material.bumpMap = null;
    material.normalMap = null;
    material.displacementMap = null;
    material.needsUpdate = true;
  }

  const landMaterial = isLight
    ? new THREE.MeshBasicMaterial({ color: palette.land })
    : new THREE.MeshLambertMaterial({
      color: palette.land,
      emissive: new THREE.Color(palette.landEmissive),
      emissiveIntensity: 0.065,
    });

  globe
    .globeMaterial(material)
    .showAtmosphere(true)
    .atmosphereColor(palette.atmosphere)
    .atmosphereAltitude(isLight ? 0.016 : 0.02)
    .polygonsData(worldLandData.features)
    .polygonGeoJsonGeometry('geometry')
    .polygonCapMaterial(landMaterial)
    .polygonSideColor(() => 'rgba(0,0,0,0)')
    .polygonStrokeColor(() => palette.coastline)
    .polygonAltitude(props.theme === 'light' ? 0.0014 : 0.0018)
    .polygonCapCurvatureResolution(2)
    .polygonsTransitionDuration(0)
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
      <span class="marker-badge" aria-hidden="true">
        <span class="marker-aura"></span>
        <span class="marker-shell"></span>
        <span class="marker-core"></span>
        <span class="marker-center"></span>
      </span>
    </span>
  `;

  element.style.setProperty('--marker-visual-size', `${marker.visualSize}px`);
  element.style.setProperty('--marker-hit-size', `${marker.hitSize}px`);
  element.style.setProperty('--marker-core-color', marker.markerColor);
  element.style.setProperty('--marker-shell-color', marker.markerColorSoft);
  element.style.setProperty('--marker-shadow-color', marker.markerColorSoft);
  element.style.setProperty('--marker-highlight-color', marker.hasOnline ? 'rgba(255, 255, 255, 0.94)' : 'rgba(255, 255, 255, 0.82)');

  element.addEventListener('pointerenter', () => setHoveredMarker(marker.key));
  element.addEventListener('pointerleave', () => clearHoveredMarker(marker.key));
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
    .ringsData(getActiveRingData());

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
    suspendMarkerAnimations();
  };
  controlsEndHandler = () => {
    isUserInteracting.value = false;
    scheduleMarkerAnimationResume();
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
      if (isUserInteracting.value || interactionSettleTimer) {
        suspendMarkerAnimations();
        scheduleMarkerAnimationResume();
      }
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
      .htmlTransitionDuration(MARKER_HTML_TRANSITION_DURATION)
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
  [
    hoveredMarkerKey,
    isPopupHovered,
    isMarkerAnimationSuspended,
    isUserInteracting,
    selectedMarker,
    isMobile,
  ],
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
  clearInteractionSettleTimer();

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
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
  outline: none;
  transition:
    transform 0.18s ease,
    opacity 0.18s ease,
    filter 0.18s ease;

  &.is-hidden {
    opacity: 0;
    pointer-events: none;
  }

  &.is-hovered {
    transform: scale(1.04);
    filter: drop-shadow(0 10px 22px rgba(15, 23, 42, 0.16));
  }

  &.is-selected {
    filter: drop-shadow(0 12px 26px rgba(15, 23, 42, 0.2));
  }

  &.is-selected .marker-badge {
    border-color: color-mix(in srgb, var(--marker-core-color) 52%, rgba(255, 255, 255, 0.42));
    box-shadow:
      0 0 0 2px color-mix(in srgb, var(--marker-core-color) 20%, transparent),
      0 14px 28px color-mix(in srgb, var(--marker-shadow-color) 90%, transparent),
      inset 0 1px 0 rgba(255, 255, 255, 0.24);
  }

  &:focus-visible .marker-badge {
    box-shadow:
      0 0 0 3px color-mix(in srgb, var(--marker-core-color) 26%, transparent),
      0 14px 28px color-mix(in srgb, var(--marker-shadow-color) 88%, transparent),
      inset 0 1px 0 rgba(255, 255, 255, 0.24);
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

:deep(.marker-badge) {
  width: var(--marker-visual-size);
  height: var(--marker-visual-size);
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background:
    radial-gradient(circle at 32% 28%, rgba(255, 255, 255, 0.24), transparent 36%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0)),
    rgba(8, 12, 15, 0.86);
  border: 1px solid color-mix(in srgb, var(--marker-shell-color) 74%, rgba(255, 255, 255, 0.12));
  box-shadow:
    0 12px 24px color-mix(in srgb, var(--marker-shadow-color) 82%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.18);
  overflow: visible;
}

:deep(.marker-aura) {
  position: absolute;
  inset: -18%;
  border-radius: 999px;
  background: radial-gradient(circle, color-mix(in srgb, var(--marker-core-color) 22%, transparent) 0%, transparent 72%);
  opacity: 0.95;
}

:deep(.marker-shell),
:deep(.marker-core) {
  position: absolute;
  border-radius: 999px;
}

:deep(.marker-shell) {
  inset: 16%;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0)),
    color-mix(in srgb, var(--marker-shell-color) 92%, rgba(255, 255, 255, 0.04));
}

:deep(.marker-core) {
  inset: 28%;
  background:
    radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.32), transparent 42%),
    var(--marker-core-color);
  box-shadow:
    0 0 16px color-mix(in srgb, var(--marker-core-color) 42%, transparent),
    inset 0 -1px 0 rgba(0, 0, 0, 0.14);
}

:deep(.marker-center) {
  width: 18%;
  height: 18%;
  position: absolute;
  border-radius: 999px;
  background: var(--marker-highlight-color);
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.24);
}

:deep(.globe-marker.is-offline .marker-badge) {
  background:
    radial-gradient(circle at 32% 28%, rgba(255, 255, 255, 0.18), transparent 34%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0)),
    rgba(12, 15, 19, 0.8);
}

:deep(.marker-pulse) {
  position: absolute;
  width: calc(var(--marker-visual-size) + 10px);
  height: calc(var(--marker-visual-size) + 10px);
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--marker-core-color) 68%, rgba(255, 255, 255, 0.12));
  box-shadow: 0 0 16px color-mix(in srgb, var(--marker-core-color) 18%, transparent);
  opacity: 0.32;
  animation: marker-pulse 3.2s ease-out infinite;
}

.globe-earth.is-interacting {
  :deep(.globe-marker) {
    transition: none;
    transform: none;
    filter: none;
  }

  :deep(.marker-badge),
  :deep(.marker-aura),
  :deep(.marker-shell),
  :deep(.marker-core),
  :deep(.marker-center) {
    transition: none;
  }

  :deep(.marker-pulse) {
    animation-play-state: paused;
    opacity: 0;
  }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes marker-pulse {
  0% {
    transform: scale(0.86);
    opacity: 0.32;
  }
  55% {
    opacity: 0.08;
  }
  100% {
    transform: scale(1.58);
    opacity: 0;
  }
}

@media screen and (max-width: 768px) {
  .popup-layer.mobile {
    inset: auto 12px 12px 12px;
  }
}
</style>
