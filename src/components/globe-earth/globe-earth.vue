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
    <div ref="chartContainer" class="globe-container" />
    <div ref="markerLayer" class="marker-layer" />

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
          @select-server="handlePopupSelectServer"
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
/* eslint-disable no-use-before-define */
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
import * as echarts from 'echarts';
import 'echarts-gl';
import graphicGL from 'echarts-gl/lib/util/graphicGL';
import {
  createGlobeOceanMap,
  THEME_COLORS,
} from '@/utils/globe-textures';
import { getLandPolygonsData } from '@/utils/globe-land-polygons.js';
import { projectLatLngToScreen } from '@/utils/globe-projection';
import { formatLocationLocalTime } from '@/utils/location-time';
import LocationPopup from '@/components/globe-earth/location-popup.vue';
import IconLoading from '@/components/icons/icon-loading.vue';
import IconEarth from '@/components/icons/icon-earth.vue';

const INITIAL_POINT_OF_VIEW = {
  lat: 24.5,
  lng: 114,
  altitude: 1.92,
};

const GLOBE_RADIUS = 100;
const CAMERA_FOV = 50;
const DEFAULT_FILL_RATIO = 0.8;
const AUTO_ROTATE_SPEED_MULTIPLIER = 4;
// Slightly above the shrunken earth mesh to avoid z-fighting flicker.
const COASTLINE_SURFACE_OFFSET = 0.1;
const COASTLINE_SCALE = (GLOBE_RADIUS * 0.99 + COASTLINE_SURFACE_OFFSET) / GLOBE_RADIUS;

function computeFitAltitude(width, height) {
  const aspect = width / height;
  const vFovRad = (CAMERA_FOV * Math.PI) / 180;
  const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * aspect);
  const minHalfFov = Math.min(vFovRad, hFovRad) / 2;
  const targetHalfAngle = minHalfFov * DEFAULT_FILL_RATIO;
  const centerDistance = GLOBE_RADIUS / Math.sin(targetHalfAngle);
  return Math.max(centerDistance / GLOBE_RADIUS - 1, 0.1);
}

const MOBILE_BREAKPOINT = 768;
const POPUP_PADDING = 16;
const POPUP_OFFSET = 20;
const FOCUS_ANIMATION_DURATION = 920;
const INTERACTION_SETTLE_DELAY = 120;
const MARKER_HTML_TRANSITION_DURATION = 320;

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

const emit = defineEmits(['marker-click', 'select-server']);

const rootRef = ref(null);
const chartContainer = ref(null);
const markerLayer = ref(null);
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

let chart = null;
let orbitControl = null;
let ignoreNextGlobeClick = false;
let tapHandled = false;
let pendingTap = null;
let interactionSettleTimer = null;
let focusBubbleTimer = null;
let localTimeInterval = null;
let resizeObserver = null;
let pendingResizeRaf = null;
let fitAltitude = INITIAL_POINT_OF_VIEW.altitude;
let visibilityHandler = null;
let markerUpdateHandler = null;
let cachedContainerRect = null;

const globeTextureCache = {};
const coastlineDataCache = {};

const currentTargetCoord = ref([INITIAL_POINT_OF_VIEW.lng, INITIAL_POINT_OF_VIEW.lat]);
const currentDistance = ref(GLOBE_RADIUS * INITIAL_POINT_OF_VIEW.altitude);
const currentAutoRotate = ref(props.autoRotate);

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
      atmosphere: '#f0f8ff',
      markerOnline: readThemeToken('--globe-marker-active', '#ffc853'),
      markerOnlineSoft: readThemeToken('--globe-marker-active-soft', 'rgba(255, 200, 83, 0.26)'),
      markerOffline: readThemeToken('--globe-marker-muted', '#9aa3af'),
      markerOfflineSoft: readThemeToken('--globe-marker-muted-soft', 'rgba(154, 163, 175, 0.2)'),
      onlineRing: readThemeToken('--globe-ring-rgb', '255, 200, 83'),
    };
  }

  return {
    ocean: '#061221',
    atmosphere: '#89c3eb',
    markerOnline: readThemeToken('--globe-marker-active', '#2ecfff'),
    markerOnlineSoft: readThemeToken('--globe-marker-active-soft', 'rgba(46, 207, 255, 0.30)'),
    markerOffline: readThemeToken('--globe-marker-muted', '#6d7888'),
    markerOfflineSoft: readThemeToken('--globe-marker-muted-soft', 'rgba(109, 120, 136, 0.22)'),
    onlineRing: readThemeToken('--globe-ring-rgb', '46, 207, 255'),
  };
}

function getGlobeMaps(theme) {
  const cacheKey = `${theme}`;
  if (!globeTextureCache[cacheKey]) {
    globeTextureCache[cacheKey] = {
      colorMap: createGlobeOceanMap(theme).toDataURL(),
    };
  }
  return globeTextureCache[cacheKey];
}

function getCoastlineSeriesData(theme) {
  if (coastlineDataCache[theme]) {
    return coastlineDataCache[theme];
  }

  const polygons = getLandPolygonsData();
  const data = [];
  polygons.forEach((polygon) => {
    polygon.geometry.coordinates.forEach((ring) => {
      data.push(ring.map(([lng, lat]) => [lng, lat]));
    });
  });

  coastlineDataCache[theme] = data;
  return data;
}

function getMarkerDimensions(count) {
  if (count > 9) {
    return {
      visualSize: 26, hitSize: 40, dotSize: 8, isLarge: true, ringMaxR: 2.6,
    };
  }
  if (count >= 7) {
    return {
      visualSize: 22, hitSize: 36, dotSize: 7, isLarge: false, ringMaxR: 1.8,
    };
  }
  if (count >= 5) {
    return {
      visualSize: 20, hitSize: 34, dotSize: 7, isLarge: false, ringMaxR: 1.7,
    };
  }
  if (count >= 3) {
    return {
      visualSize: 18, hitSize: 32, dotSize: 6, isLarge: false, ringMaxR: 1.5,
    };
  }
  if (count === 2) {
    return {
      visualSize: 16, hitSize: 30, dotSize: 6, isLarge: false, ringMaxR: 1.4,
    };
  }
  return {
    visualSize: 12, hitSize: 26, dotSize: 6, isLarge: false, ringMaxR: 1.2,
  };
}

const markerData = computed(() => {
  const palette = getThemePalette(props.theme);

  return props.locations.map((location, index) => {
    const servers = location.servers || [];
    const totalCount = servers.length;
    const onlineCount = servers.filter((server) => server.online === 1).length;
    const hasOnline = onlineCount > 0;
    const {
      visualSize,
      hitSize,
      dotSize,
      isLarge,
      ringMaxR,
    } = getMarkerDimensions(totalCount);

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
      offlineCount: totalCount - onlineCount,
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

function setHoveredMarker(key) {
  hoveredMarkerKey.value = key;
}

function clearHoveredMarker(key) {
  if (!key || hoveredMarkerKey.value === key) {
    hoveredMarkerKey.value = null;
  }
}

function clearInteractionSettleTimer() {
  if (interactionSettleTimer) {
    window.clearTimeout(interactionSettleTimer);
    interactionSettleTimer = null;
  }
}

function setMarkerAnimationSuspended(suspended) {
  isMarkerAnimationSuspended.value = suspended;

  if (markerLayer.value) {
    markerLayer.value.style.setProperty(
      '--marker-transition-duration',
      suspended ? '0ms' : `${MARKER_HTML_TRANSITION_DURATION}ms`,
    );
  }
}

function getOrbitControl() {
  if (orbitControl) {
    return orbitControl;
  }

  const views = chart?._componentsViews;
  if (!Array.isArray(views)) {
    return null;
  }

  const globeView = views.find((view) => view && view._control);
  orbitControl = globeView?._control || null;
  return orbitControl;
}

function applyAutoRotateState() {
  const control = getOrbitControl();
  if (!control) {
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

  const nextAutoRotate = props.autoRotate && !shouldPause;
  if (currentAutoRotate.value !== nextAutoRotate) {
    currentAutoRotate.value = nextAutoRotate;
    control.autoRotate = nextAutoRotate;
  }
}

function getViewDistanceOptions() {
  const fitDistance = GLOBE_RADIUS * fitAltitude;
  return {
    distance: currentDistance.value,
    minDistance: GLOBE_RADIUS * 0.5,
    maxDistance: Math.max(360, fitDistance * 1.5),
  };
}

function getGlobeOption() {
  const maps = getGlobeMaps(props.theme);

  return {
    backgroundColor: 'transparent',
    tooltip: {
      show: false,
    },
    globe: {
      show: true,
      baseTexture: maps.colorMap,
      globeRadius: GLOBE_RADIUS,
      globeOuterRadius: GLOBE_RADIUS,
      shading: 'color',
      environment: 'none',
      atmosphere: {
        show: false,
      },
      postEffect: {
        enable: false,
      },
      temporalSuperSampling: {
        enable: false,
      },
      viewControl: {
        autoRotate: currentAutoRotate.value,
        autoRotateSpeed: props.rotateSpeed * AUTO_ROTATE_SPEED_MULTIPLIER,
        autoRotateDirection: 'ccw',
        autoRotateAfterStill: 3,
        rotateSensitivity: 1,
        zoomSensitivity: 1,
        panSensitivity: 0,
        damping: 0.8,
        targetCoord: [...currentTargetCoord.value],
        ...getViewDistanceOptions(),
        animation: false,
      },
    },
    series: [
      {
        type: 'lines3D',
        coordinateSystem: 'globe',
        polyline: true,
        silent: true,
        lineStyle: {
          width: THEME_COLORS[props.theme].coastlineWidth,
          color: THEME_COLORS[props.theme].coastline,
          opacity: 1,
        },
        data: getCoastlineSeriesData(props.theme),
      },
    ],
  };
}

function sharpenGlobeTextures() {
  if (!chart) {
    return;
  }

  try {
    const globeModel = chart.getModel().getComponent('globe');
    const globeView = globeModel && chart.getViewOfComponentModel(globeModel);
    const earthMesh = globeView && globeView._earthMesh;
    const material = earthMesh && earthMesh.material;
    if (!material) {
      return;
    }

    const texture = material.get('diffuseMap');
    if (texture && texture.useMipmap !== false) {
      texture.useMipmap = false;
      texture.minFilter = graphicGL.Texture.LINEAR;
      texture.magFilter = graphicGL.Texture.LINEAR;
      texture.dirty();
    }
  } catch {
    // Internal APIs may change; ignore if unavailable.
  }
}

function syncCoastlineDepth() {
  if (!chart) {
    return;
  }

  try {
    // echarts-gl shrinks the earth mesh to 0.99 * globeRadius to avoid
    // z-fighting, while lines3D coastlines are generated at full radius.
    // Scale the lines just a hair above the mesh surface so they are clearly
    // in front without visibly floating.
    const seriesModel = chart.getModel().getSeriesByType('lines3D')[0];
    const view = seriesModel && chart.getViewOfSeriesModel(seriesModel);
    if (view && view.groupGL) {
      view.groupGL.scale.set(COASTLINE_SCALE, COASTLINE_SCALE, COASTLINE_SCALE);
    }
  } catch {
    // Internal APIs may change; ignore if unavailable.
  }
}

function applyThemeToGlobe() {
  if (!chart) {
    return;
  }

  chart.setOption(getGlobeOption(), { notMerge: true });
  sharpenGlobeTextures();

  // setOption with notMerge may recreate the GL view and its OrbitControl.
  // Drop the cached reference so marker updates attach to the new control.
  orbitControl = null;
  applyAutoRotateState();
  attachMarkerUpdateListener();
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

function createMarkerElement(marker) {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = `globe-marker ${marker.hasOnline ? 'is-online' : 'is-offline'}`;
  element.dataset.key = marker.key;
  element.setAttribute('aria-label', `${marker.label}，${marker.totalCount}台服务器`);
  element.__data__ = marker;

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

  return element;
}

function syncMarkerElementState() {
  if (!markerLayer.value) {
    return;
  }

  markerLayer.value.querySelectorAll('.globe-marker').forEach((element) => {
    const marker = element.__data__;
    const key = marker?.key || element.dataset.key;
    if (marker?.key && element.dataset.key !== marker.key) {
      element.dataset.key = marker.key;
    }
    element.classList.toggle('is-hovered', hoveredMarkerKey.value === key);
    element.classList.toggle('is-selected', selectedMarker.value?.key === key);
    const isPressed = selectedMarker.value?.key === key ? 'true' : 'false';
    element.setAttribute('aria-pressed', isPressed);
  });
}

function updateMarkerPositions() {
  if (!chart || !markerLayer.value) {
    return;
  }

  const container = chartContainer.value;
  if (!container) {
    return;
  }

  if (!cachedContainerRect) {
    cachedContainerRect = container.getBoundingClientRect();
  }

  const rect = cachedContainerRect;

  markerLayer.value.querySelectorAll('.globe-marker').forEach((element) => {
    const marker = element.__data__;
    if (!marker) {
      return;
    }

    const position = projectLatLngToScreen(
      chart,
      rect,
      marker.lng,
      marker.lat,
      marker.altitude,
    );
    if (!position) {
      element.classList.add('is-hidden');
      return;
    }

    const size = marker.hitSize;
    const x = position.x - size / 2;
    const y = position.y - size / 2;
    element.style.transform = `translate3d(${x}px, ${y}px, 0)`;

    if (position.visible) {
      element.classList.remove('is-hidden');
    } else {
      element.classList.add('is-hidden');
    }
  });
}

function attachMarkerUpdateListener() {
  const control = getOrbitControl();
  if (!control) {
    return;
  }

  if (markerUpdateHandler) {
    control.off('update', markerUpdateHandler);
  }

  markerUpdateHandler = () => updateMarkerPositions();
  control.on('update', markerUpdateHandler);
}

function renderMarkers() {
  if (!markerLayer.value) {
    return;
  }

  markerLayer.value.innerHTML = '';
  markerData.value.forEach((marker) => {
    const element = createMarkerElement(marker);
    markerLayer.value.appendChild(element);
  });

  syncMarkerElementState();
  updateMarkerPositions();
}

function clearMarkers() {
  if (!markerLayer.value) {
    return;
  }

  markerLayer.value.innerHTML = '';
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

  const selector = `.globe-marker[data-key="${focusBubbleMarker.value.key}"]`;
  const element = markerLayer.value?.querySelector(selector);
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

function clearSelection(shouldEmit = true) {
  clearFocusBubble();
  selectedMarker.value = null;
  isPopupHovered.value = false;
  popupState.visible = false;
  popupState.placement = 'top';
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

  const selector = `.globe-marker[data-key="${hoveredMarker.value.key}"]`;
  const element = markerLayer.value?.querySelector(selector);
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

function normalizeLng(delta) {
  return ((delta + 540) % 360) - 180;
}

function animateView({ targetCoord, distance, duration = FOCUS_ANIMATION_DURATION }) {
  return new Promise((resolve) => {
    const control = getOrbitControl();
    if (!control) {
      resolve();
      return;
    }

    const startCoord = [...currentTargetCoord.value];
    const startDistance = currentDistance.value;
    const startTime = performance.now();

    const lngDelta = normalizeLng(targetCoord[0] - startCoord[0]);
    const latDelta = targetCoord[1] - startCoord[1];
    const distanceDelta = distance - startDistance;

    function frame(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - (1 - progress) ** 3;

      currentTargetCoord.value = [
        startCoord[0] + lngDelta * eased,
        startCoord[1] + latDelta * eased,
      ];
      currentDistance.value = startDistance + distanceDelta * eased;

      const alpha = currentTargetCoord.value[1];
      const beta = currentTargetCoord.value[0] + 90;
      const centerDistance = GLOBE_RADIUS + currentDistance.value;
      control.setAlpha(alpha);
      control.setBeta(beta);
      control.setDistance(centerDistance);
      control._needsUpdate = true;

      updateMarkerPositions();

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        resolve();
      }
    }

    requestAnimationFrame(frame);
  });
}

function focusLocation(location) {
  if (!chart || !location) {
    return false;
  }

  animateView({
    targetCoord: [location.lng, location.lat],
    distance: GLOBE_RADIUS * (isMobile.value ? 2.6 : 2.4),
  });

  return true;
}

function focusLocationWithHighlight(location, serverName) {
  return new Promise((resolve) => {
    if (!chart || !location) {
      resolve(false);
      return;
    }

    clearFocusBubble();

    animateView({
      targetCoord: [location.lng, location.lat],
      distance: GLOBE_RADIUS * (isMobile.value ? 2.6 : 2.4),
    }).then(() => {
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
        const maxPositionAttempts = 40;

        const tryUpdatePosition = () => {
          positionAttempts += 1;
          syncMarkerElementState();
          updateFocusBubblePosition();
          if (focusBubbleState.visible) {
            resolve(true);
          } else if (positionAttempts >= maxPositionAttempts) {
            resolve(false);
          } else {
            focusBubbleTimer = window.setTimeout(tryUpdatePosition, 80);
          }
        };

        nextTick(() => {
          window.requestAnimationFrame(tryUpdatePosition);
        });
      }, 180);
    });
  });
}

function resetView() {
  if (!chart) {
    return;
  }

  animateView({
    targetCoord: [INITIAL_POINT_OF_VIEW.lng, INITIAL_POINT_OF_VIEW.lat],
    distance: GLOBE_RADIUS * INITIAL_POINT_OF_VIEW.altitude,
    duration: 1100,
  });
}

function handleContainerClick() {
  if (ignoreNextGlobeClick) {
    ignoreNextGlobeClick = false;
    return;
  }

  clearSelection();
}

function handleContainerPointerDown() {
  isUserInteracting.value = true;
  suspendMarkerAnimations();
}

function handleContainerPointerUp() {
  isUserInteracting.value = false;
  scheduleMarkerAnimationResume();
  nextTick(() => {
    updatePopupPosition();
  });
}

function handlePopupEnter() {
  isPopupHovered.value = true;
}

function handlePopupLeave() {
  isPopupHovered.value = false;
}

function handlePopupSelectServer(server) {
  emit('select-server', server);
}

function updateViewportMode() {
  isMobile.value = window.innerWidth <= MOBILE_BREAKPOINT;
}

function handleResize() {
  updateViewportMode();

  if (!chart || !chartContainer.value) {
    return;
  }

  const { clientWidth: width, clientHeight: height } = chartContainer.value;
  fitAltitude = computeFitAltitude(width, height);
  cachedContainerRect = chartContainer.value.getBoundingClientRect();
  chart.resize();

  chart.setOption({
    globe: {
      viewControl: {
        ...getViewDistanceOptions(),
      },
    },
  });

  attachMarkerUpdateListener();

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
  if (!chart) {
    return;
  }

  if (document.hidden) {
    return;
  }

  nextTick(() => {
    chart.resize();
    scheduleHandleResize();
    applyThemeToGlobe();
    renderMarkers();
  });
}

function attachLifecycleListeners() {
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
  }
  visibilityHandler = handleVisibilityChange;
  document.addEventListener('visibilitychange', visibilityHandler);
}

function detachLifecycleListeners() {
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = null;
  }
}

function initChart() {
  if (!chartContainer.value) {
    return;
  }

  try {
    const { clientWidth: width, clientHeight: height } = chartContainer.value;
    fitAltitude = computeFitAltitude(width, height);
    currentDistance.value = GLOBE_RADIUS * INITIAL_POINT_OF_VIEW.altitude;
    currentTargetCoord.value = [INITIAL_POINT_OF_VIEW.lng, INITIAL_POINT_OF_VIEW.lat];

    chart = echarts.init(chartContainer.value, null, {
      renderer: 'canvas',
    });

    chart.setOption(getGlobeOption(), { notMerge: true });
    sharpenGlobeTextures();

    chart.on('finished', syncCoastlineDepth);
    syncCoastlineDepth();

    getOrbitControl();

    chartContainer.value.addEventListener('click', handleContainerClick);
    chartContainer.value.addEventListener('pointerdown', handleContainerPointerDown, true);
    chartContainer.value.addEventListener('pointerup', handleContainerPointerUp, true);

    attachLifecycleListeners();

    renderMarkers();

    const control = getOrbitControl();
    if (control) {
      control.autoRotate = currentAutoRotate.value;
      control.autoRotateSpeed = props.rotateSpeed * AUTO_ROTATE_SPEED_MULTIPLIER;

      if (markerLayer.value) {
        markerLayer.value.addEventListener('click', handleMarkerClick, true);
        markerLayer.value.addEventListener('pointerdown', handleMarkerPointerDown, true);
        markerLayer.value.addEventListener('pointerup', handleMarkerPointerUp, true);
      }
    }

    attachMarkerUpdateListener();

    isReady.value = true;
  } catch (error) {
    console.error('Globe initialization failed:', error);
    initError.value = true;
  }
}

watch(markerData, (nextMarkers) => {
  if (!chart) {
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

  renderMarkers();
  nextTick(() => {
    updatePopupPosition();
    updateFocusBubblePosition();
  });
});

watch(() => props.autoRotate, () => {
  applyAutoRotateState();
});

watch(() => props.rotateSpeed, (value) => {
  if (orbitControl) {
    orbitControl.autoRotateSpeed = value * AUTO_ROTATE_SPEED_MULTIPLIER;
  }
});

watch(() => props.theme, () => {
  applyThemeToGlobe();
  renderMarkers();
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
  initChart();
  window.addEventListener('resize', handleResize);

  if (typeof ResizeObserver !== 'undefined' && chartContainer.value) {
    resizeObserver = new ResizeObserver(() => scheduleHandleResize());
    resizeObserver.observe(chartContainer.value);
  }
});

onActivated(() => {
  updateViewportMode();
  startLocalTimeTicker();

  nextTick(() => {
    scheduleHandleResize();

    if (!chartContainer.value) {
      return;
    }

    const { clientWidth, clientHeight } = chartContainer.value;
    if (clientWidth > 0 && clientHeight > 0 && chart) {
      chart.resize();
      applyThemeToGlobe();
      renderMarkers();
      updatePopupPosition();
      updateFocusBubblePosition();
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
  detachLifecycleListeners();

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

  if (markerUpdateHandler && orbitControl) {
    orbitControl.off('update', markerUpdateHandler);
    markerUpdateHandler = null;
  }

  if (markerLayer.value) {
    markerLayer.value.removeEventListener('click', handleMarkerClick, true);
    markerLayer.value.removeEventListener('pointerdown', handleMarkerPointerDown, true);
    markerLayer.value.removeEventListener('pointerup', handleMarkerPointerUp, true);
  }

  if (chartContainer.value) {
    chartContainer.value.removeEventListener('click', handleContainerClick);
    chartContainer.value.removeEventListener('pointerdown', handleContainerPointerDown, true);
    chartContainer.value.removeEventListener('pointerup', handleContainerPointerUp, true);
  }

  clearMarkers();

  if (chart) {
    chart.dispose();
    chart = null;
  }

  orbitControl = null;
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
  top: 50%;
  left: 50%;
  width: min(86%, 86vh);
  aspect-ratio: 1 / 1;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background:
    radial-gradient(circle at center, var(--globe-orb-glow), transparent 70%);
  filter: blur(28px);
  opacity: 0.6;
  pointer-events: none;
  z-index: 0;
}

.globe-earth.theme-dark::before {
  --globe-orb-glow: rgba(72, 148, 255, 0.55);
  filter: blur(36px);
  opacity: 0.55;
}

.globe-earth.theme-light::before {
  --globe-orb-glow: rgba(160, 210, 255, 0.42);
  filter: blur(30px);
  opacity: 0.42;
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

.marker-layer {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  overflow: hidden;
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
  position: absolute;
  top: 0;
  left: 0;
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
  will-change: transform;
  transition: opacity 0.12s ease;

  &.is-hidden {
    opacity: 0;
    pointer-events: none;
    transition: none;
  }

  &.is-hovered {
    transform: scale(1.15);
    transition: transform 0.15s ease, opacity 0.12s ease;
  }

  &.is-selected {
    transform: scale(1.22);
    transition: transform 0.15s ease, opacity 0.12s ease;
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
