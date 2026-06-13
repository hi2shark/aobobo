<template>
  <div
    ref="rootRef"
    :class="[
      'globe-earth',
      {
        'is-interacting': isMarkerAnimationSuspended,
        'theme-light': props.theme === 'light',
        'theme-dark': props.theme === 'dark',
      },
    ]"
  >
    <div ref="globeContainer" class="globe-container" />

    <div
      v-if="hoveredMarker && !isMobile"
      ref="tooltipWrapper"
      :class="[
        'marker-tooltip',
        tooltipState.placement,
        { 'is-visible': tooltipState.visible },
      ]"
      :style="tooltipInlineStyle"
    >
      <div class="tooltip-title">{{ hoveredMarker.label }}</div>
      <div class="tooltip-meta">{{ hoveredMarker.totalCount }} 台服务器</div>
    </div>

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
        <icon-loading class="spin empty-icon" />
        <span>加载地球中...</span>
      </template>
      <template v-else>
        <icon-earth class="empty-icon" />
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
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import Globe from 'globe.gl';
import createGlobeMaps from '@/utils/globe-textures';
import { getLandPolygonsData } from '@/utils/globe-land-polygons';
import {
  createRimAtmosphereGroup,
  disposeRimAtmosphereGroup,
  updateRimAtmosphereGroup,
} from '@/utils/globe-atmosphere';
import LocationPopup from '@/components/globe-earth/location-popup.vue';
import IconLoading from '@/components/icons/icon-loading.vue';
import IconEarth from '@/components/icons/icon-earth.vue';

const INITIAL_POINT_OF_VIEW = {
  lat: 24.5,
  lng: 114,
  altitude: 1.75,
};

const MOBILE_BREAKPOINT = 768;
const POPUP_PADDING = 16;
const POPUP_OFFSET = 20;
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
const tooltipWrapper = ref(null);
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

const tooltipState = reactive({
  left: 0,
  top: 0,
  visible: false,
  placement: 'top',
});

let globe = null;
let controlsStartHandler = null;
let controlsEndHandler = null;
let zoomHandler = null;
let markerClickHandler = null;
let markerPointerDownHandler = null;
let markerPointerUpHandler = null;
let ignoreNextGlobeClick = false;
let tapHandled = false;
let pendingTap = null;
let interactionSettleTimer = null;
const GLOBE_TEXTURE_VERSION = 23;
const BLOOM_CONFIG = {
  strength: 0.28,
  radius: 0.42,
  threshold: 0.30,
};
const globeTextureCache = { light: null, dark: null };
let rimAtmosphereGroup = null;
let bloomPass = null;
let cameraKeyLight = null;

function readThemeToken(name, fallback) {
  if (typeof window === 'undefined') {
    return fallback;
  }

  const value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function getThemePalette(theme) {
  if (theme === 'light') {
    return {
      ocean: '#e8f4ff',
      oceanEmissive: '#ffffff',
      oceanSpecular: '#ffffff',
      land: '#e8eef4',
      landEmissive: '#f5f8fb',
      coastline: 'rgba(150, 170, 190, 0.28)',
      landSide: 'rgba(140, 160, 180, 0.18)',
      atmosphere: '#f0f8ff',
      atmosphereAltitude: 0.045,
      polygonAltitude: 0.003,
      polygonCurvature: 2,
      fog: '#f5f9ff',
      fogDensity: 0.00035,
      ambient: '#ffffff',
      ambientIntensity: 1.0,
      keyLight: '#ffffff',
      keyLightIntensity: 0.45,
      fillLight: '#f5f9ff',
      fillLightIntensity: 0.2,
      rimLight: '#ffffff',
      rimLightIntensity: 0.25,
      markerOnline: readThemeToken('--globe-marker-active', '#8ab4ff'),
      markerOnlineSoft: readThemeToken('--globe-marker-active-soft', 'rgba(138, 180, 255, 0.28)'),
      markerOffline: readThemeToken('--globe-marker-muted', '#8e96a3'),
      markerOfflineSoft: readThemeToken('--globe-marker-muted-soft', 'rgba(142, 150, 163, 0.22)'),
      onlineRing: readThemeToken('--globe-ring-rgb', '138, 180, 255'),
    };
  }

  return {
    ocean: '#060a12',
    oceanEmissive: '#000000',
    oceanSpecular: '#203448',
    land: '#626d7c',
    landEmissive: '#2a3038',
    landEmissiveIntensity: 0,
    landSpecular: '#707a88',
    coastline: 'rgba(130, 150, 172, 0.28)',
    landSide: '#2f3a46',
    atmosphere: '#4d9be8',
    atmosphereAltitude: 0.018,
    polygonAltitude: 0.0008,
    polygonCurvature: 8,
    fog: '#080a0f',
    fogDensity: 0.00028,
    ambient: '#d8e4f0',
    ambientIntensity: 0.60,
    keyLight: '#f0f6ff',
    keyLightIntensity: 0.80,
    fillLight: '#1e2834',
    fillLightIntensity: 0.25,
    rimLight: '#7ec0f8',
    rimLightIntensity: 0.14,
    markerOnline: readThemeToken('--globe-marker-active', '#66a9e8'),
    markerOnlineSoft: readThemeToken('--globe-marker-active-soft', 'rgba(102, 169, 232, 0.24)'),
    markerOffline: readThemeToken('--globe-marker-muted', '#5f6b78'),
    markerOfflineSoft: readThemeToken('--globe-marker-muted-soft', 'rgba(95, 107, 120, 0.22)'),
    onlineRing: readThemeToken('--globe-ring-rgb', '102, 169, 232'),
  };
}

function getGlobeMaps(theme) {
  const cacheKey = `${theme}-v${GLOBE_TEXTURE_VERSION}`;
  if (!globeTextureCache[cacheKey]) {
    globeTextureCache[cacheKey] = createGlobeMaps(theme);
  }
  return globeTextureCache[cacheKey];
}

function syncRimAtmosphere(palette) {
  const scene = globe?.scene?.();
  if (!scene) {
    return;
  }

  const isLight = props.theme === 'light';
  const rimOptions = isLight
    ? { innerStrengthScale: 0.32, glowIntensityScale: 0.32 }
    : {};

  if (!rimAtmosphereGroup) {
    rimAtmosphereGroup = createRimAtmosphereGroup(palette.atmosphere, rimOptions);
    scene.add(rimAtmosphereGroup);
    return;
  }

  updateRimAtmosphereGroup(rimAtmosphereGroup, palette.atmosphere);
}

function getMarkerDimensions(count) {
  if (count >= 12) {
    return { visualSize: 28, hitSize: 48, ringMaxR: 2.3 };
  }
  if (count >= 8) {
    return { visualSize: 24, hitSize: 44, ringMaxR: 1.9 };
  }
  if (count >= 4) {
    return { visualSize: 20, hitSize: 40, ringMaxR: 1.55 };
  }
  return { visualSize: 16, hitSize: 36, ringMaxR: 1.2 };
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
  const isDark = props.theme === 'dark';

  return markerData.value
    .filter((marker) => marker.hasOnline)
    .flatMap((marker) => {
      const rings = [{
        lat: marker.lat,
        lng: marker.lng,
        maxR: marker.ringMaxR,
        propagationSpeed: isDark ? 0.16 : 0.22,
        repeatPeriod: isDark ? 3600 : 2700,
        colorRgb: palette.onlineRing,
        opacity: isDark ? 0.18 : 0.26,
      }];

      if (marker.totalCount >= 6) {
        rings.push({
          lat: marker.lat,
          lng: marker.lng,
          maxR: marker.ringMaxR + (isDark ? 0.5 : 0.65),
          propagationSpeed: isDark ? 0.13 : 0.18,
          repeatPeriod: isDark ? 4200 : 3400,
          colorRgb: palette.onlineRing,
          opacity: isDark ? 0.12 : 0.18,
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

const hoveredMarker = computed(() => {
  if (!hoveredMarkerKey.value) {
    return null;
  }
  return markerData.value.find((marker) => marker.key === hoveredMarkerKey.value) || null;
});

const tooltipInlineStyle = computed(() => ({
  left: `${tooltipState.left}px`,
  top: `${tooltipState.top}px`,
}));

function configureRenderer() {
  const renderer = globe?.renderer?.();
  if (!renderer) {
    return;
  }

  const { devicePixelRatio = 1 } = window;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  if (props.theme === 'dark') {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
  } else {
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.toneMappingExposure = 1.0;
  }
}

function getGlobeDimensions() {
  if (!globeContainer.value) {
    return { width: 1, height: 1 };
  }

  const { clientWidth: width, clientHeight: height } = globeContainer.value;
  return { width, height };
}

function disposeBloomPass() {
  if (!bloomPass) {
    return;
  }

  const composer = globe?.postProcessingComposer?.();
  if (composer) {
    composer.removePass(bloomPass);
  }

  bloomPass.dispose();
  bloomPass = null;
}

function configureBloom() {
  const composer = globe?.postProcessingComposer?.();
  if (!composer) {
    return;
  }

  if (props.theme !== 'dark') {
    disposeBloomPass();
    return;
  }

  const { width, height } = getGlobeDimensions();

  if (!bloomPass) {
    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      BLOOM_CONFIG.strength,
      BLOOM_CONFIG.radius,
      BLOOM_CONFIG.threshold,
    );
    composer.addPass(bloomPass);
    return;
  }

  bloomPass.setSize(width, height);
  bloomPass.strength = BLOOM_CONFIG.strength;
  bloomPass.radius = BLOOM_CONFIG.radius;
  bloomPass.threshold = BLOOM_CONFIG.threshold;
}

function configureSceneAndLights() {
  const palette = getThemePalette(props.theme);
  const scene = globe?.scene?.();
  if (scene) {
    scene.fog = props.theme === 'dark'
      ? null
      : new THREE.FogExp2(palette.fog, palette.fogDensity);
  }

  const ambientLight = new THREE.AmbientLight(
    palette.ambient,
    palette.ambientIntensity,
  );

  const fillLight = new THREE.DirectionalLight(
    palette.fillLight,
    palette.fillLightIntensity,
  );
  fillLight.position.set(150, -55, 125);

  const rimLight = new THREE.DirectionalLight(
    palette.rimLight,
    palette.rimLightIntensity,
  );
  rimLight.position.set(36, 30, -220);

  globe.lights([ambientLight, fillLight, rimLight]);

  const camera = globe?.camera?.();
  if (camera) {
    if (cameraKeyLight) {
      camera.remove(cameraKeyLight);
      cameraKeyLight.dispose?.();
    }
    cameraKeyLight = new THREE.DirectionalLight(
      palette.keyLight,
      palette.keyLightIntensity,
    );
    cameraKeyLight.position.set(80, 120, 180);
    camera.add(cameraKeyLight);
  }
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
  if (!globeContainer.value) {
    return;
  }

  globeContainer.value.querySelectorAll('.globe-marker').forEach((element) => {
    const marker = element.__data__;
    const key = marker?.key || element.dataset.key;
    if (marker?.key && element.dataset.key !== marker.key) {
      element.dataset.key = marker.key;
    }
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

  if (!popupWrapper.value || !rootRef.value) {
    return;
  }

  const rootRect = rootRef.value.getBoundingClientRect();
  const popupRect = popupWrapper.value.getBoundingClientRect();

  const left = (rootRect.width - popupRect.width) / 2;
  const top = (rootRect.height - popupRect.height) / 2;

  const maxLeft = rootRect.width - popupRect.width - POPUP_PADDING;
  const maxTop = rootRect.height - popupRect.height - POPUP_PADDING;
  popupState.left = Math.max(POPUP_PADDING, Math.min(left, maxLeft));
  popupState.top = Math.max(POPUP_PADDING, Math.min(top, maxTop));
  popupState.placement = 'top';
  popupState.visible = true;
}

function updateTooltipPosition() {
  if (!hoveredMarker.value || isMobile.value) {
    tooltipState.visible = false;
    return;
  }

  const element = globeContainer.value?.querySelector(`.globe-marker[data-key="${hoveredMarker.value.key}"]`);
  if (!element || !tooltipWrapper.value || !rootRef.value) {
    return;
  }

  const rootRect = rootRef.value.getBoundingClientRect();
  const tooltipRect = tooltipWrapper.value.getBoundingClientRect();
  const markerRect = element.getBoundingClientRect();
  const markerX = markerRect.left + (markerRect.width / 2) - rootRect.left;
  const markerY = markerRect.top + (markerRect.height / 2) - rootRect.top;

  let left = markerX - (tooltipRect.width / 2);
  let top = markerY - tooltipRect.height - POPUP_OFFSET;
  let placement = 'top';

  if (top < POPUP_PADDING) {
    placement = 'bottom';
    top = markerY + POPUP_OFFSET;
  }

  const maxLeft = rootRect.width - tooltipRect.width - POPUP_PADDING;
  const maxTop = rootRect.height - tooltipRect.height - POPUP_PADDING;
  left = Math.max(POPUP_PADDING, Math.min(left, maxLeft));
  top = Math.max(POPUP_PADDING, Math.min(top, maxTop));

  tooltipState.left = left;
  tooltipState.top = top;
  tooltipState.placement = placement;
  tooltipState.visible = true;
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
  ignoreNextGlobeClick = true;
  selectedMarker.value = marker;
  isPopupHovered.value = false;
  emit('marker-click', marker);
  syncMarkerElementState();
  applyAutoRotateState();

  window.setTimeout(() => {
    ignoreNextGlobeClick = false;
  }, 80);

  nextTick(() => {
    updatePopupPosition();
    window.requestAnimationFrame(() => {
      if (selectedMarker.value && !popupState.visible) {
        updatePopupPosition();
      }
    });
  });
}

function resolveMarkerFromElement(element) {
  return element?.__data__
    || markerData.value.find((m) => m.key === element?.dataset?.key);
}

function handleMarkerClick(event) {
  if (tapHandled) {
    return;
  }

  const markerElement = event.target.closest('.globe-marker');
  const currentMarker = resolveMarkerFromElement(markerElement);
  if (!currentMarker) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  selectMarker(currentMarker);
}

function handleMarkerPointerDown(event) {
  const markerElement = event.target.closest('.globe-marker');
  if (!markerElement) {
    pendingTap = null;
    return;
  }

  pendingTap = {
    x: event.clientX,
    y: event.clientY,
    marker: resolveMarkerFromElement(markerElement),
  };
}

function handleMarkerPointerUp(event) {
  if (!pendingTap?.marker) {
    return;
  }

  const dx = event.clientX - pendingTap.x;
  const dy = event.clientY - pendingTap.y;
  const { marker } = pendingTap;
  pendingTap = null;

  if (Math.sqrt(dx * dx + dy * dy) > 8) {
    return;
  }

  tapHandled = true;
  window.setTimeout(() => {
    tapHandled = false;
  }, 50);

  event.preventDefault();
  event.stopPropagation();
  selectMarker(marker);
}

function applyThemeToGlobe() {
  if (!globe) {
    return;
  }

  const palette = getThemePalette(props.theme);
  const isLight = props.theme === 'light';
  const { colorMap, bumpMap } = getGlobeMaps(props.theme);
  const renderer = globe?.renderer?.();
  const maxAnisotropy = renderer?.capabilities?.getMaxAnisotropy?.() || 16;
  colorMap.anisotropy = maxAnisotropy;
  if (bumpMap) {
    bumpMap.anisotropy = maxAnisotropy;
  }

  const oceanMaterial = isLight
    ? new THREE.MeshBasicMaterial({
      map: colorMap,
      color: '#ffffff',
    })
    : new THREE.MeshPhongMaterial({
      map: colorMap,
      bumpMap,
      bumpScale: 0.008,

      color: '#ffffff',
      emissive: palette.oceanEmissive,
      emissiveIntensity: 0,
      shininess: 10,
      specular: palette.oceanSpecular,
    });

  globe
    .globeMaterial(oceanMaterial)
    .showAtmosphere(isLight)
    .showGraticules(false)
    .globeCurvatureResolution(4)
    .atmosphereColor(palette.atmosphere)
    .atmosphereAltitude(isLight ? palette.atmosphereAltitude : 0)
    .pathsData([])
    .polygonsData(getLandPolygonsData())
    .polygonGeoJsonGeometry((d) => d.geometry)
    .polygonCapMaterial(() => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }))
    .polygonSideMaterial(() => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }))
    .polygonStrokeColor(() => palette.coastline)
    .polygonAltitude(0)
    .polygonCapCurvatureResolution(5)
    .polygonsTransitionDuration(0);

  syncRimAtmosphere(palette);
  configureRenderer();
  configureBloom();
  configureSceneAndLights();
}

function createMarkerElement(marker) {
  const ringStyle = props.theme === 'dark'
    ? { ringWidth: 2.5, showDot: true }
    : { ringWidth: 2, showDot: true };
  const element = document.createElement('button');
  element.type = 'button';
  element.className = `globe-marker ${marker.hasOnline ? 'is-online' : 'is-offline'}`;
  element.dataset.key = marker.key;
  element.setAttribute('aria-label', `${marker.label}，${marker.totalCount}台服务器`);
  element.innerHTML = `
    <span class="marker-hit">
      ${marker.hasOnline ? '<span class="marker-pulse"></span>' : ''}
      <span class="marker-badge" aria-hidden="true">
        <span class="marker-flat-ring"></span>
        ${ringStyle.showDot ? '<span class="marker-flat-dot"></span>' : ''}
      </span>
    </span>
  `;

  element.style.setProperty('--marker-visual-size', `${marker.visualSize}px`);
  element.style.setProperty('--marker-hit-size', `${marker.hitSize}px`);
  element.style.setProperty('--marker-ring-width', `${ringStyle.ringWidth}px`);
  element.style.setProperty('--marker-core-color', marker.markerColor);
  element.style.setProperty('--marker-shell-color', marker.markerColorSoft);
  element.style.setProperty('--marker-shadow-color', marker.markerColorSoft);
  element.style.setProperty('--marker-highlight-color', marker.hasOnline ? 'rgba(255, 255, 255, 0.94)' : 'rgba(255, 255, 255, 0.82)');

  element.addEventListener('pointerenter', () => setHoveredMarker(marker.key));
  element.addEventListener('pointerleave', () => clearHoveredMarker(marker.key));
  element.addEventListener('focus', () => setHoveredMarker(marker.key));
  element.addEventListener('blur', () => clearHoveredMarker(marker.key));

  syncMarkerElementState();
  return element;
}

function updateLayers() {
  if (!globe) {
    return;
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

  if (bloomPass) {
    bloomPass.setSize(width, height);
  }

  nextTick(() => {
    updatePopupPosition();
    updateTooltipPosition();
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
      updateTooltipPosition();
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
        if (ignoreNextGlobeClick) {
          ignoreNextGlobeClick = false;
          return;
        }
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

    markerClickHandler = (event) => handleMarkerClick(event);
    markerPointerDownHandler = (event) => handleMarkerPointerDown(event);
    markerPointerUpHandler = (event) => handleMarkerPointerUp(event);
    globeContainer.value.addEventListener('click', markerClickHandler, true);
    globeContainer.value.addEventListener('pointerdown', markerPointerDownHandler, true);
    globeContainer.value.addEventListener('pointerup', markerPointerUpHandler, true);

    globe.globeMaterial(new THREE.MeshPhongMaterial());
    configureRenderer();
    applyThemeToGlobe();
    updateLayers();
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

  updateLayers();
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
  updateLayers();
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
      updateTooltipPosition();
    });
  },
);

watch(hoveredMarker, () => {
  tooltipState.visible = false;
  nextTick(() => {
    updateTooltipPosition();
  });
});

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
  if (markerClickHandler && globeContainer.value) {
    globeContainer.value.removeEventListener('click', markerClickHandler, true);
  }
  if (markerPointerDownHandler && globeContainer.value) {
    globeContainer.value.removeEventListener('pointerdown', markerPointerDownHandler, true);
  }
  if (markerPointerUpHandler && globeContainer.value) {
    globeContainer.value.removeEventListener('pointerup', markerPointerUpHandler, true);
  }

  if (rimAtmosphereGroup) {
    globe?.scene?.()?.remove(rimAtmosphereGroup);
    disposeRimAtmosphereGroup(rimAtmosphereGroup);
    rimAtmosphereGroup = null;
  }

  if (cameraKeyLight) {
    globe?.camera?.()?.remove(cameraKeyLight);
    cameraKeyLight.dispose?.();
    cameraKeyLight = null;
  }

  disposeBloomPass();
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

.globe-earth.theme-dark::before {
  inset: -20%;
  height: 140%;
  background:
    radial-gradient(
      circle at 50% 50%,
      rgba(77, 155, 232, 0.07) 0%,
      rgba(77, 155, 232, 0.04) 30%,
      rgba(77, 155, 232, 0.015) 50%,
      rgba(77, 155, 232, 0.006) 64%,
      transparent 84%
    );
  filter: blur(96px);
  opacity: 0.72;
}

.globe-earth.theme-light::before {
  inset: -18%;
  height: 136%;
  background:
    radial-gradient(
      circle at 50% 50%,
      rgba(200, 225, 255, 0.10) 0%,
      rgba(200, 225, 255, 0.05) 30%,
      rgba(200, 225, 255, 0.02) 50%,
      rgba(200, 225, 255, 0.008) 64%,
      transparent 84%
    );
  filter: blur(90px);
  opacity: 0.85;
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

  .empty-icon {
    width: 32px;
    height: 32px;
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

.marker-tooltip {
  position: absolute;
  z-index: 3;
  pointer-events: none;
  padding: 8px 12px;
  border-radius: 10px;
  background: var(--globe-popup-bg);
  border: 1px solid var(--globe-popup-border);
  box-shadow: var(--globe-popup-shadow);
  backdrop-filter: blur(12px) saturate(140%);
  color: var(--text-primary);
  max-width: 240px;
  opacity: 0;
  transform: translateY(6px);
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;

  &.is-visible {
    opacity: 1;
    transform: translateY(0);
  }

  .tooltip-title {
    font-size: 13px;
    font-weight: 600;
    line-height: 1.3;
    margin-bottom: 2px;
  }

  .tooltip-meta {
    font-size: 12px;
    color: var(--text-secondary);
  }
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
  pointer-events: auto;
  touch-action: none;
  transition:
    transform 0.18s ease,
    opacity 0.18s ease;

  &.is-hidden {
    opacity: 0;
    pointer-events: none;
  }

  &.is-hovered {
    transform: scale(1.12);
  }

  &.is-selected {
    transform: scale(1.2);
  }

  &.is-selected .marker-flat-ring {
    border-width: 3px;
  }

  &:focus-visible .marker-flat-ring {
    border-width: 3px;
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
  background: transparent;
  overflow: visible;
}

:deep(.marker-flat-ring) {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  border: var(--marker-ring-width, 2px) solid var(--marker-core-color);
  background: transparent;
  opacity: 0.92;
  transition: border-width 0.18s ease;
}

:deep(.marker-flat-dot) {
  width: 32%;
  height: 32%;
  border-radius: 999px;
  background: var(--marker-core-color);
}

:deep(.globe-marker.is-offline .marker-flat-ring) {
  border-color: var(--marker-core-color);
  opacity: 0.65;
}

:deep(.globe-marker.is-offline .marker-flat-dot) {
  opacity: 0.65;
}

:deep(.marker-pulse) {
  position: absolute;
  width: calc(var(--marker-visual-size) + 6px);
  height: calc(var(--marker-visual-size) + 6px);
  border-radius: 999px;
  border: 2px solid var(--marker-core-color);
  opacity: 0.45;
  animation: marker-pulse 2.4s ease-out infinite;
}

.globe-earth.theme-dark {
  :deep(.marker-flat-ring) {
    border: 2.5px solid var(--marker-core-color);
    background: transparent;
    opacity: 0.95;
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.12),
      0 0 10px 2px color-mix(in srgb, var(--marker-core-color) 55%, transparent);
  }

  :deep(.marker-flat-dot) {
    width: 36%;
    height: 36%;
    background: #ffffff;
    box-shadow: 0 0 4px 1px color-mix(in srgb, var(--marker-core-color) 60%, transparent);
  }

  :deep(.marker-pulse) {
    border-width: 1.5px;
    border-color: var(--marker-core-color);
    opacity: 0.35;
    box-shadow: none;
  }

  :deep(.globe-marker.is-offline .marker-flat-ring) {
    border-color: var(--marker-core-color);
    background: transparent;
    opacity: 0.65;
    box-shadow: none;
  }

  :deep(.globe-marker.is-offline .marker-flat-dot) {
    background: rgba(255, 255, 255, 0.7);
    box-shadow: none;
  }
}

.globe-earth.is-interacting {
  :deep(.globe-marker) {
    transition: none;
    transform: none;
  }

  :deep(.marker-badge),
  :deep(.marker-flat-ring),
  :deep(.marker-flat-dot) {
    transition: none;
  }

  :deep(.marker-pulse) {
    animation-play-state: paused;
    opacity: 0;
  }
}

.globe-earth.theme-light {
  :deep(.marker-flat-ring) {
    border: 1px solid rgba(255, 255, 255, 0.55);
    background: color-mix(in srgb, var(--marker-core-color) 88%, #ffffff);
    opacity: 0.92;
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.35),
      0 0 14px 4px color-mix(in srgb, var(--marker-core-color) 22%, transparent);
  }

  :deep(.marker-flat-dot) {
    display: none;
  }

  :deep(.marker-pulse) {
    border-width: 1.5px;
    border-color: var(--marker-core-color);
    opacity: 0.28;
    box-shadow: none;
  }

  :deep(.globe-marker.is-offline .marker-flat-ring) {
    background: var(--marker-core-color);
    border-color: rgba(255, 255, 255, 0.35);
    opacity: 0.65;
    box-shadow: none;
  }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes marker-pulse {
  0% {
    transform: scale(0.86);
    opacity: 0.42;
  }
  55% {
    opacity: 0.12;
  }
  100% {
    transform: scale(1.68);
    opacity: 0;
  }
}

@media screen and (max-width: 768px) {
  .popup-layer.mobile {
    inset: auto 12px 12px 12px;
  }
}
</style>
