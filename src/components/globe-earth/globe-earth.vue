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
import Globe from 'globe.gl';
import worldLandData from '@/assets/globe/world-land.json';
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
      markerOnline: '#18CC59',
      markerOnlineSoft: 'rgba(22, 163, 74, 0.32)',
      markerOffline: '#7d8793',
      markerOfflineSoft: 'rgba(125, 135, 147, 0.26)',
      onlineRing: '22, 163, 74',
      globeGlow: 'rgba(150, 185, 220, 0.1)',
    };
  }

  return {
    ocean: '#131922',
    oceanEmissive: '#0d1724',
    oceanSpecular: '#1c2d3d',
    land: '#2f2f33',
    landEmissive: '#3a3a40',
    coastline: 'rgba(106, 131, 152, 0.34)',
    atmosphere: '#607d97',
    fog: '#01050a',
    ambient: '#edf5fb',
    keyLight: '#bfd1de',
    fillLight: '#52697a',
    rimLight: '#708697',
    markerOnline: '#facc15',
    markerOnlineSoft: 'rgba(250, 204, 21, 0.22)',
    markerOffline: '#666d73',
    markerOfflineSoft: 'rgba(102, 109, 115, 0.2)',
    onlineRing: '250, 204, 21',
    globeGlow: 'rgba(112, 138, 160, 0.1)',
  };
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
  focusLocation(marker);
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
  const material = isLight
    ? new THREE.MeshBasicMaterial({ color: palette.ocean })
    : new THREE.MeshPhongMaterial({
      color: palette.ocean,
      emissive: palette.oceanEmissive,
      emissiveIntensity: 0.08,
      shininess: 0.04,
      specular: palette.oceanSpecular,
    });

  const landMaterial = isLight
    ? new THREE.MeshBasicMaterial({ color: palette.land })
    : new THREE.MeshLambertMaterial({
      color: palette.land,
      emissive: palette.landEmissive,
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
        <span class="marker-flat-ring"></span>
        <span class="marker-flat-dot"></span>
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
  border: 2px solid var(--marker-core-color);
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
    border-width: 0;
    background: var(--marker-core-color);
    opacity: 0.9;
  }

  :deep(.marker-flat-dot) {
    width: 36%;
    height: 36%;
    background: #fff;
  }

  :deep(.marker-pulse) {
    border-color: var(--marker-core-color);
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
