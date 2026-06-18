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
      <div v-if="hoveredMarkerLocalTime" class="tooltip-time">
        当地时间 {{ hoveredMarkerLocalTime }}
      </div>
    </div>

    <div
      v-if="focusBubbleMarker && !isMobile"
      ref="focusBubbleWrapper"
      :class="[
        'marker-tooltip',
        'marker-focus-bubble',
        focusBubbleState.placement,
        { 'is-visible': focusBubbleState.visible },
      ]"
      :style="focusBubbleInlineStyle"
    >
      <div class="tooltip-title">{{ focusBubbleServerName }}</div>
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
          :local-time="selectedMarkerLocalTime"
          :mobile="isMobile"
          :placement="popupState.placement"
          :cycle-transfer-map="cycleTransferMap"
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
  onActivated,
  onDeactivated,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  watch,
} from 'vue';
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import Globe from 'globe.gl';
import createGlobeMaps, { createSceneBackgroundTexture } from '@/utils/globe-textures';
import { getLandPolygonsData } from '@/utils/globe-land-polygons';
import {
  createRimAtmosphereGroup,
  disposeRimAtmosphereGroup,
  updateRimAtmosphereGroup,
  GLOW_LAYERS_LIGHT,
} from '@/utils/globe-atmosphere';
import { formatLocationLocalTime } from '@/utils/location-time';
import LocationPopup from '@/components/globe-earth/location-popup.vue';
import IconLoading from '@/components/icons/icon-loading.vue';
import IconEarth from '@/components/icons/icon-earth.vue';

const INITIAL_POINT_OF_VIEW = {
  lat: 24.5,
  lng: 114,
  altitude: 1.75,
};

const GLOBE_RADIUS = 100;
const CAMERA_FOV = 50;
const FIT_PADDING = 0.12;

function computeFitAltitude(width, height) {
  const aspect = width / height;
  const vFovRad = THREE.MathUtils.degToRad(CAMERA_FOV);
  const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * aspect);
  const minFov = Math.min(vFovRad, hFovRad) * (1 - FIT_PADDING);
  const maxAngularRadius = minFov / 2;
  const distance = GLOBE_RADIUS / Math.tan(maxAngularRadius);
  return Math.max(distance / GLOBE_RADIUS - 1, 0.1);
}

const MOBILE_BREAKPOINT = 768;
const POPUP_PADDING = 16;
const POPUP_OFFSET = 20;
const MARKER_HTML_TRANSITION_DURATION = 320;
const INTERACTION_SETTLE_DELAY = 120;
const FOCUS_ANIMATION_DURATION = 920;

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
  cycleTransferMap: {
    type: Object,
    default: () => ({}),
  },
});

const emit = defineEmits(['marker-click']);

const rootRef = ref(null);
const globeContainer = ref(null);
const popupWrapper = ref(null);
const tooltipWrapper = ref(null);
const focusBubbleWrapper = ref(null);
const isReady = ref(false);
const initError = ref(false);
const isMobile = ref(false);
const selectedMarker = ref(null);
const hoveredMarkerKey = ref(null);
const focusBubbleMarker = ref(null);
const focusBubbleServerName = ref('');
const isPopupHovered = ref(false);
const isUserInteracting = ref(false);
const isMarkerAnimationSuspended = ref(false);
const currentLocationTime = ref(Date.now());

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

const focusBubbleState = reactive({
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
let focusBubbleTimer = null;
let localTimeInterval = null;
const GLOBE_TEXTURE_VERSION = 25;
const BLOOM_CONFIG = {
  strength: 0.28,
  radius: 0.42,
  threshold: 0.30,
};
const globeTextureCache = { light: null, dark: null };
let rimAtmosphereGroup = null;
let bloomPass = null;
let cameraKeyLight = null;
let sceneBackgroundTexture = null;
let resizeObserver = null;
let pendingResizeRaf = null;
let fitAltitude = INITIAL_POINT_OF_VIEW.altitude;
let visibilityHandler = null;
let contextLostHandler = null;
let contextRestoredHandler = null;

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
      markerOnline: readThemeToken('--globe-marker-active', '#ffc853'),
      markerOnlineSoft: readThemeToken('--globe-marker-active-soft', 'rgba(255, 200, 83, 0.26)'),
      markerOffline: readThemeToken('--globe-marker-muted', '#9aa3af'),
      markerOfflineSoft: readThemeToken('--globe-marker-muted-soft', 'rgba(154, 163, 175, 0.2)'),
      onlineRing: readThemeToken('--globe-ring-rgb', '255, 200, 83'),
    };
  }

  return {
    ocean: '#061221',
    oceanEmissive: '#000000',
    oceanSpecular: '#1a2d40',
    land: '#b6c3d5',
    landEmissive: '#1c2128',
    landEmissiveIntensity: 0,
    landSpecular: '#6a7a8c',
    coastline: 'rgba(120, 140, 165, 0.16)',
    landSide: '#252e38',
    atmosphere: '#2d9aff',
    atmosphereAltitude: 0.018,
    polygonAltitude: 0.0008,
    polygonCurvature: 8,
    fog: '#05070c',
    fogDensity: 0.00028,
    ambient: '#c8d8e8',
    ambientIntensity: 0.58,
    keyLight: '#e8f4ff',
    keyLightIntensity: 0.80,
    fillLight: '#151e28',
    fillLightIntensity: 0.20,
    rimLight: '#5eaeff',
    rimLightIntensity: 0.20,
    markerOnline: readThemeToken('--globe-marker-active', '#2ecfff'),
    markerOnlineSoft: readThemeToken('--globe-marker-active-soft', 'rgba(46, 207, 255, 0.30)'),
    markerOffline: readThemeToken('--globe-marker-muted', '#6d7888'),
    markerOfflineSoft: readThemeToken('--globe-marker-muted-soft', 'rgba(109, 120, 136, 0.22)'),
    onlineRing: readThemeToken('--globe-ring-rgb', '46, 207, 255'),
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
    ? { innerStrengthScale: 0.32, glowIntensityScale: 0.32, layers: GLOW_LAYERS_LIGHT }
    : { innerStrengthScale: 1.18, glowIntensityScale: 1.12 };

  if (!rimAtmosphereGroup) {
    rimAtmosphereGroup = createRimAtmosphereGroup(palette.atmosphere, rimOptions);
    scene.add(rimAtmosphereGroup);
    return;
  }

  updateRimAtmosphereGroup(rimAtmosphereGroup, palette.atmosphere);
}

function syncSceneBackground() {
  const scene = globe?.scene?.();
  if (!scene) {
    return;
  }

  if (sceneBackgroundTexture) {
    sceneBackgroundTexture.dispose();
    sceneBackgroundTexture = null;
  }

  if (props.theme !== 'dark') {
    scene.background = null;
    return;
  }

  sceneBackgroundTexture = createSceneBackgroundTexture();
  scene.background = sceneBackgroundTexture;
}

function getMarkerDimensions(count) {
  if (count > 9) {
    return { visualSize: 22, hitSize: 38, dotSize: 0, isLarge: true, ringMaxR: 2.6 };
  }
  if (count >= 7) {
    return { visualSize: 20, hitSize: 36, dotSize: 5, isLarge: false, ringMaxR: 1.8 };
  }
  if (count >= 5) {
    return { visualSize: 18, hitSize: 34, dotSize: 5, isLarge: false, ringMaxR: 1.7 };
  }
  if (count >= 3) {
    return { visualSize: 16, hitSize: 32, dotSize: 5, isLarge: false, ringMaxR: 1.5 };
  }
  if (count === 2) {
    return { visualSize: 14, hitSize: 30, dotSize: 5, isLarge: false, ringMaxR: 1.4 };
  }
  return { visualSize: 10, hitSize: 26, dotSize: 5, isLarge: false, ringMaxR: 1.2 };
}

const markerData = computed(() => {
  const palette = getThemePalette(props.theme);

  return props.locations.map((location, index) => {
    const servers = location.servers || [];
    const totalCount = servers.length;
    const onlineCount = servers.filter((server) => server.online === 1).length;
    const offlineCount = totalCount - onlineCount;
    const hasOnline = onlineCount > 0;
    const { visualSize, hitSize, dotSize, isLarge, ringMaxR } = getMarkerDimensions(totalCount);

    return {
      key: location.key || location.code || `${location.lat}-${location.lng}-${index}`,
      code: location.code,
      codes: location.codes || (location.code ? [location.code] : []),
      aliasCode: location.aliasCode || '',
      country: location.country || '',
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
      dotSize,
      isLarge,
      ringMaxR,
      altitude: 0,
      markerColor: hasOnline ? palette.markerOnline : palette.markerOffline,
      markerColorSoft: hasOnline ? palette.markerOnlineSoft : palette.markerOfflineSoft,
      markerOfflineColor: palette.markerOffline,
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

const hoveredMarkerLocalTime = computed(() => formatLocationLocalTime(
  hoveredMarker.value,
  currentLocationTime.value,
));

const selectedMarkerLocalTime = computed(() => formatLocationLocalTime(
  selectedMarker.value,
  currentLocationTime.value,
));

const tooltipInlineStyle = computed(() => ({
  left: `${tooltipState.left}px`,
  top: `${tooltipState.top}px`,
}));

const focusBubbleInlineStyle = computed(() => ({
  left: `${focusBubbleState.left}px`,
  top: `${focusBubbleState.top}px`,
}));

function startLocalTimeTicker() {
  if (localTimeInterval) {
    window.clearInterval(localTimeInterval);
  }
  currentLocationTime.value = Date.now();
  localTimeInterval = window.setInterval(() => {
    currentLocationTime.value = Date.now();
  }, 1000);
}

function stopLocalTimeTicker() {
  if (localTimeInterval) {
    window.clearInterval(localTimeInterval);
    localTimeInterval = null;
  }
}

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
      || selectedMarker.value
      || focusBubbleMarker.value,
  );

  globe.controls().autoRotate = props.autoRotate && !shouldPause;
}

function focusLocation(location) {
  if (!globe || !location) {
    return false;
  }

  globe.pointOfView({
    lat: location.lat,
    lng: location.lng,
    altitude: isMobile.value ? 1.72 : 1.58,
  }, FOCUS_ANIMATION_DURATION);

  return true;
}

function clearFocusBubble() {
  if (focusBubbleTimer) {
    window.clearTimeout(focusBubbleTimer);
    focusBubbleTimer = null;
  }

  focusBubbleMarker.value = null;
  focusBubbleServerName.value = '';
  focusBubbleState.visible = false;
  syncMarkerElementState();
  applyAutoRotateState();
}

function updateFocusBubblePosition() {
  if (!focusBubbleMarker.value || isMobile.value) {
    focusBubbleState.visible = false;
    return;
  }

  const element = globeContainer.value?.querySelector(`.globe-marker[data-key="${focusBubbleMarker.value.key}"]`);
  if (!element || !focusBubbleWrapper.value || !rootRef.value) {
    return;
  }

  const rootRect = rootRef.value.getBoundingClientRect();
  const bubbleRect = focusBubbleWrapper.value.getBoundingClientRect();
  const markerRect = element.getBoundingClientRect();
  const markerX = markerRect.left + (markerRect.width / 2) - rootRect.left;
  const markerY = markerRect.top + (markerRect.height / 2) - rootRect.top;

  let left = markerX - (bubbleRect.width / 2);
  let top = markerY - bubbleRect.height - POPUP_OFFSET;
  let placement = 'top';

  if (top < POPUP_PADDING) {
    placement = 'bottom';
    top = markerY + POPUP_OFFSET;
  }

  const maxLeft = rootRect.width - bubbleRect.width - POPUP_PADDING;
  const maxTop = rootRect.height - bubbleRect.height - POPUP_PADDING;
  left = Math.max(POPUP_PADDING, Math.min(left, maxLeft));
  top = Math.max(POPUP_PADDING, Math.min(top, maxTop));
  focusBubbleState.left = left;
  focusBubbleState.top = top;
  focusBubbleState.placement = placement;
  focusBubbleState.visible = true;
}

function focusLocationWithHighlight(location, serverName) {
  return new Promise((resolve) => {
    if (!globe || !location) {
      resolve(false);
      return;
    }

    clearFocusBubble();

    globe.pointOfView({
      lat: location.lat,
      lng: location.lng,
      altitude: isMobile.value ? 1.72 : 1.58,
    }, FOCUS_ANIMATION_DURATION);

    if (isMobile.value) {
      resolve(true);
      return;
    }

    const marker = markerData.value.find((m) => m.key === location.key);
    if (!marker) {
      resolve(false);
      return;
    }

    focusBubbleTimer = window.setTimeout(() => {
      focusBubbleMarker.value = marker;
      focusBubbleServerName.value = serverName || marker.label;

      syncMarkerElementState();
      applyAutoRotateState();

      let positionAttempts = 0;
      const maxPositionAttempts = 30;

      const tryUpdatePosition = () => {
        positionAttempts += 1;
        updateFocusBubblePosition();
        if (focusBubbleState.visible) {
          resolve(true);
        } else if (positionAttempts >= maxPositionAttempts) {
          resolve(false);
        } else {
          focusBubbleTimer = window.setTimeout(tryUpdatePosition, 100);
        }
      };

      nextTick(tryUpdatePosition);
    }, FOCUS_ANIMATION_DURATION);
  });
}

function clearSelection(shouldEmit = true) {
  clearFocusBubble();
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
      bumpScale: 0.004,

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
  syncSceneBackground();
  configureRenderer();
  configureBloom();
  configureSceneAndLights();
}

function createMarkerElement(marker) {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = `globe-marker ${marker.hasOnline ? 'is-online' : 'is-offline'}`;
  element.dataset.key = marker.key;
  element.setAttribute('aria-label', `${marker.label}，${marker.totalCount}台服务器`);

  let badgeHTML;
  if (marker.isLarge) {
    badgeHTML = '<span class="marker-cluster marker-cluster--large" aria-hidden="true"></span>';
  } else if (marker.totalCount > 6) {
    const centerServer = marker.servers[0];
    const centerIsOffline = !centerServer || centerServer.online !== 1;
    const centerOfflineClass = centerIsOffline ? ' is-offline' : '';
    const radius = (marker.visualSize - marker.dotSize) / 2 - 1;
    const surroundingCount = marker.totalCount - 1;
    const dots = Array.from({ length: surroundingCount }, (_, index) => {
      const server = marker.servers[index + 1];
      const isOffline = !server || server.online !== 1;
      const offlineClass = isOffline ? ' is-offline' : '';
      const angle = (Math.PI * 2 * index) / surroundingCount - (Math.PI / 2);
      const x = Math.round(Math.cos(angle) * radius * 100) / 100;
      const y = Math.round(Math.sin(angle) * radius * 100) / 100;
      return `<span class="marker-dot${offlineClass}" style="transform: translate(${x}px, ${y}px)"></span>`;
    }).join('');
    badgeHTML = `
      <span class="marker-dots" aria-hidden="true">
        <span class="marker-dot marker-dot--single${centerOfflineClass}"></span>
        ${dots}
      </span>
    `;
  } else if (marker.totalCount > 1) {
    const radius = (marker.visualSize - marker.dotSize) / 2 - 1;
    const dots = Array.from({ length: marker.totalCount }, (_, index) => {
      const server = marker.servers[index];
      const isOffline = !server || server.online !== 1;
      const offlineClass = isOffline ? ' is-offline' : '';
      const angle = (Math.PI * 2 * index) / marker.totalCount - (Math.PI / 2);
      const x = Math.round(Math.cos(angle) * radius * 100) / 100;
      const y = Math.round(Math.sin(angle) * radius * 100) / 100;
      return `<span class="marker-dot${offlineClass}" style="transform: translate(${x}px, ${y}px)"></span>`;
    }).join('');
    badgeHTML = `<span class="marker-dots" aria-hidden="true">${dots}</span>`;
  } else {
    const server = marker.servers[0];
    const isOffline = !server || server.online !== 1;
    const offlineClass = isOffline ? ' is-offline' : '';
    badgeHTML = `<span class="marker-dot marker-dot--single${offlineClass}" aria-hidden="true"></span>`;
  }

  element.innerHTML = `
    <span class="marker-hit">
      ${marker.hasOnline ? '<span class="marker-pulse"></span>' : ''}
      ${badgeHTML}
    </span>
  `;

  element.style.setProperty('--marker-visual-size', `${marker.visualSize}px`);
  element.style.setProperty('--marker-hit-size', `${marker.hitSize}px`);
  element.style.setProperty('--marker-dot-size', `${marker.dotSize}px`);
  element.style.setProperty('--marker-core-color', marker.markerColor);
  element.style.setProperty('--marker-shell-color', marker.markerColorSoft);
  element.style.setProperty('--marker-shadow-color', marker.markerColorSoft);
  element.style.setProperty('--marker-offline-color', marker.markerOfflineColor);

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
  const fitDistance = GLOBE_RADIUS * (1 + fitAltitude);
  controls.minDistance = 145;
  controls.maxDistance = Math.max(285, fitDistance * 1.1);
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

function updateZoomLimits() {
  if (!globe) {
    return;
  }

  const controls = globe.controls();
  const fitDistance = GLOBE_RADIUS * (1 + fitAltitude);
  controls.minDistance = 145;
  controls.maxDistance = Math.max(285, fitDistance * 1.1);
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
  fitAltitude = computeFitAltitude(width, height);
  updateZoomLimits();

  globe.width(width).height(height);

  if (bloomPass) {
    bloomPass.setSize(width, height);
  }

  nextTick(() => {
    updatePopupPosition();
    updateTooltipPosition();
    updateFocusBubblePosition();
  });
}

function scheduleHandleResize() {
  if (pendingResizeRaf) {
    cancelAnimationFrame(pendingResizeRaf);
  }
  pendingResizeRaf = requestAnimationFrame(() => {
    pendingResizeRaf = null;
    handleResize();
  });
}

function handleVisibilityChange() {
  if (!globe) {
    return;
  }

  if (document.hidden) {
    globe.pauseAnimation?.();
    return;
  }

  nextTick(() => {
    globe.resumeAnimation?.();
    scheduleHandleResize();
    applyThemeToGlobe();
    updateLayers();
  });
}

function handleContextLost(event) {
  event.preventDefault();
  if (globe) {
    globe.pauseAnimation?.();
  }
}

function handleContextRestored() {
  if (!globe) {
    return;
  }

  // WebGL context 恢复后，旧的 GPU 纹理已失效，需要重新生成
  Object.keys(globeTextureCache).forEach((key) => {
    globeTextureCache[key] = null;
  });

  nextTick(() => {
    configureRenderer();
    applyThemeToGlobe();
    updateLayers();
    configureBloom();
    configureSceneAndLights();
    syncRimAtmosphere(getThemePalette(props.theme));
    syncSceneBackground();
    scheduleHandleResize();
    globe.resumeAnimation?.();
  });
}

function attachRendererLifecycleListeners() {
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
  }
  visibilityHandler = handleVisibilityChange;
  document.addEventListener('visibilitychange', visibilityHandler);

  const renderer = globe?.renderer?.();
  const canvas = renderer?.domElement;
  if (!canvas) {
    return;
  }

  if (contextLostHandler) {
    canvas.removeEventListener('webglcontextlost', contextLostHandler);
  }
  if (contextRestoredHandler) {
    canvas.removeEventListener('webglcontextrestored', contextRestoredHandler);
  }

  contextLostHandler = handleContextLost;
  contextRestoredHandler = handleContextRestored;
  canvas.addEventListener('webglcontextlost', contextLostHandler);
  canvas.addEventListener('webglcontextrestored', contextRestoredHandler);
}

function detachRendererLifecycleListeners() {
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = null;
  }

  const renderer = globe?.renderer?.();
  const canvas = renderer?.domElement;
  if (!canvas) {
    return;
  }

  if (contextLostHandler) {
    canvas.removeEventListener('webglcontextlost', contextLostHandler);
    contextLostHandler = null;
  }
  if (contextRestoredHandler) {
    canvas.removeEventListener('webglcontextrestored', contextRestoredHandler);
    contextRestoredHandler = null;
  }
}

function initGlobe() {
  if (!globeContainer.value) {
    return;
  }

  try {
    const { clientWidth: width, clientHeight: height } = globeContainer.value;
    fitAltitude = computeFitAltitude(width, height);
    globe = Globe()(globeContainer.value);

    zoomHandler = () => {
      if (isUserInteracting.value || interactionSettleTimer) {
        suspendMarkerAnimations();
        scheduleMarkerAnimationResume();
      }
      updatePopupPosition();
      updateTooltipPosition();
      updateFocusBubblePosition();
    };

    globe
      .width(width)
      .height(height)
      .globeOffset([0, 0])
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
    attachRendererLifecycleListeners();

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

  if (focusBubbleMarker.value) {
    const nextFocused = nextMarkers.find((marker) => marker.key === focusBubbleMarker.value.key);
    if (nextFocused) {
      focusBubbleMarker.value = nextFocused;
    } else {
      clearFocusBubble();
    }
  }

  updateLayers();
  nextTick(() => {
    updatePopupPosition();
    updateFocusBubblePosition();
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
    focusBubbleMarker,
    isMobile,
  ],
  () => {
    syncMarkerElementState();
    applyAutoRotateState();
    nextTick(() => {
      updatePopupPosition();
      updateTooltipPosition();
      updateFocusBubblePosition();
    });
  },
);

watch(hoveredMarker, () => {
  tooltipState.visible = false;
  nextTick(() => {
    updateTooltipPosition();
  });
});

function ready() {
  return new Promise((resolve) => {
    if (isReady.value) {
      resolve();
      return;
    }
    const unwatch = watch(isReady, (value) => {
      if (value) {
        unwatch();
        resolve();
      }
    });
  });
}

defineExpose({
  focusLocation,
  focusLocationWithHighlight,
  clearFocusBubble,
  resetView,
  clearSelection,
  ready,
});

onMounted(() => {
  updateViewportMode();
  startLocalTimeTicker();
  initGlobe();
  window.addEventListener('resize', handleResize);

  if (typeof ResizeObserver !== 'undefined' && globeContainer.value) {
    resizeObserver = new ResizeObserver(() => scheduleHandleResize());
    resizeObserver.observe(globeContainer.value);
  }
});

onActivated(() => {
  updateViewportMode();
  startLocalTimeTicker();

  nextTick(() => {
    scheduleHandleResize();

    if (!globeContainer.value) {
      return;
    }

    const { clientWidth, clientHeight } = globeContainer.value;
    if (clientWidth > 0 && clientHeight > 0 && globe) {
      const currentPov = globe.pointOfView();
      globe.pointOfView(currentPov, 0);
      applyThemeToGlobe();
      updateLayers();
    }
  });
});

onDeactivated(() => {
  stopLocalTimeTicker();
  clearInteractionSettleTimer();
  clearFocusBubble();
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  stopLocalTimeTicker();
  detachRendererLifecycleListeners();

  if (pendingResizeRaf) {
    cancelAnimationFrame(pendingResizeRaf);
    pendingResizeRaf = null;
  }

  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }

  clearInteractionSettleTimer();
  clearFocusBubble();

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

  if (sceneBackgroundTexture) {
    sceneBackgroundTexture.dispose();
    sceneBackgroundTexture = null;
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
  inset: -18%;
  height: 136%;
  background:
    radial-gradient(
      circle at 50% 50%,
      rgba(72, 140, 255, 0.09) 0%,
      rgba(72, 140, 255, 0.045) 30%,
      rgba(72, 140, 255, 0.016) 50%,
      rgba(72, 140, 255, 0.006) 64%,
      transparent 84%
    );
  filter: blur(92px);
  opacity: 0.76;
}

.globe-earth.theme-light::before {
  inset: -16%;
  height: 132%;
  background:
    radial-gradient(
      circle at 50% 50%,
      rgba(177, 219, 255, 0.16) 0%,
      rgba(177, 219, 255, 0.08) 30%,
      rgba(177, 219, 255, 0.03) 50%,
      rgba(177, 219, 255, 0.01) 64%,
      transparent 84%
    );
  filter: blur(84px);
  opacity: 0.88;
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
    opacity 0.24s ease,
    transform 0.24s ease;

  &.hidden {
    opacity: 0;
    pointer-events: none;
    transform: translateY(6px) scale(0.985);
  }

  &.mobile {
    inset: auto 16px 16px 16px;
    z-index: 22;
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
  padding: 10px 14px;
  border-radius: 16px;
  background: var(--globe-popup-bg);
  border: 1px solid var(--globe-popup-border);
  box-shadow: var(--globe-popup-shadow);
  backdrop-filter: blur(16px) saturate(145%);
  color: var(--text-primary);
  max-width: 260px;
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
    font-weight: 700;
    line-height: 1.3;
    margin-bottom: 2px;
  }

  .tooltip-meta {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .tooltip-time {
    margin-top: 4px;
    font-size: 11px;
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    color: var(--accent-primary);
  }
}

.marker-focus-bubble {
  .tooltip-title {
    margin-bottom: 0;
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
    transform 0.2s ease,
    opacity 0.2s ease;

  &.is-hidden {
    opacity: 0;
    pointer-events: none;
  }

  &.is-hovered {
    transform: scale(1.15);
  }

  &.is-selected {
    transform: scale(1.22);
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

:deep(.marker-dots) {
  width: var(--marker-visual-size);
  height: var(--marker-visual-size);
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

:deep(.marker-dot) {
  position: absolute;
  width: var(--marker-dot-size);
  height: var(--marker-dot-size);
  border-radius: 999px;
  background: var(--marker-core-color);
  box-shadow: 0 0 4px color-mix(in srgb, var(--marker-core-color) 50%, transparent);
}

:deep(.marker-dot--single) {
  position: static;
}

:deep(.marker-cluster--large) {
  width: var(--marker-visual-size);
  height: var(--marker-visual-size);
  border-radius: 999px;
  background: var(--marker-core-color);
  box-shadow:
    0 0 0 3px var(--marker-shell-color),
    0 0 10px color-mix(in srgb, var(--marker-core-color) 50%, transparent);
}

:deep(.marker-pulse) {
  position: absolute;
  width: calc(var(--marker-visual-size) + 8px);
  height: calc(var(--marker-visual-size) + 8px);
  border-radius: 999px;
  border: 2px solid var(--marker-core-color);
  opacity: 0.45;
  animation: marker-pulse 2.4s ease-out infinite;
}

:deep(.globe-marker.is-offline .marker-cluster--large) {
  opacity: 0.58;
}

:deep(.marker-dot.is-offline) {
  background: var(--marker-offline-color);
  opacity: 0.65;
}

.globe-earth.theme-dark {
  :deep(.marker-dot) {
    box-shadow:
      0 0 0 1px rgba(255, 250, 224, 0.15),
      0 0 6px color-mix(in srgb, var(--marker-core-color) 60%, transparent);
  }

  :deep(.marker-cluster--large) {
    box-shadow:
      0 0 0 1px rgba(255, 250, 224, 0.2),
      0 0 0 5px color-mix(in srgb, var(--marker-core-color) 10%, transparent),
      0 0 18px 2px color-mix(in srgb, var(--marker-core-color) 58%, transparent);
  }

  :deep(.marker-pulse) {
    border-width: 1.5px;
    border-color: var(--marker-core-color);
    opacity: 0.28;
    box-shadow: none;
  }
}

.globe-earth.is-interacting {
  :deep(.globe-marker) {
    transition: none;
    transform: none;
  }

  :deep(.marker-dots),
  :deep(.marker-dot),
  :deep(.marker-cluster--large) {
    transition: none;
  }

  :deep(.marker-pulse) {
    animation-play-state: paused;
    opacity: 0;
  }
}

.globe-earth.theme-light {
  :deep(.marker-dot) {
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.6),
      0 0 6px color-mix(in srgb, var(--marker-core-color) 30%, transparent);
  }

  :deep(.marker-cluster--large) {
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.7),
      0 0 0 7px color-mix(in srgb, var(--marker-core-color) 12%, transparent),
      0 0 16px 4px color-mix(in srgb, var(--marker-core-color) 20%, transparent);
  }

  :deep(.marker-pulse) {
    border-width: 1.5px;
    border-color: var(--marker-core-color);
    opacity: 0.2;
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
