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
    <div v-if="!isReady" class="globe-stage-fallback" aria-hidden="true" />

    <div
      ref="chartContainer"
      class="globe-container"
      :style="{
        opacity: isGlobeVisible ? 1 : 0,
        transition: 'opacity 0.25s ease',
      }"
    />
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

    <transition name="globe-loading-fade">
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
    </transition>
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
  getGlobeRendererPixelRatio,
  getPreferredGlobeTextureSize,
  THEME_COLORS,
} from '@/utils/globe-textures';
import { getLandPolygonsData } from '@/utils/globe-land-polygons.js';
import { projectLatLngToScreen } from '@/utils/globe-projection';
import { formatLocationLocalTime } from '@/utils/location-time';
import {
  loadGlobeView,
  persistGlobeView,
  clearGlobeView,
} from '@/utils/globe-view';
import {
  getGlobeGLCanvas,
  isGlobeGLContextLost,
} from '@/utils/globe-gl';
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
const DEFAULT_FILL_RATIO = 0.92;
const AUTO_ROTATE_SPEED_MULTIPLIER = 2;
const MOBILE_MIN_VIEW_DISTANCE = GLOBE_RADIUS * 1.1;
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
// Periodic check that the WebGL context is still alive. Mobile browsers drop
// the GL context after backgrounding / under memory pressure; a lost context
// cannot be restored by re-optioning, so we recreate the whole echarts instance.
const CONTEXT_LOSS_CHECK_INTERVAL_MOBILE = 2500;
const CONTEXT_LOSS_CHECK_INTERVAL_DESKTOP = 6000;
// Minimum gap between recovery attempts, to avoid reentry if the context-lost
// event, the restored event and the health-check all fire close together.
const REINIT_MIN_INTERVAL = 1500;
// Extra animation frames to keep waiting after the globe texture first reports
// ready. The ocean texture is a base64 data URL that decodes asynchronously and
// needs a few frames on the GPU before the textured earth is actually painted;
// lifting the loading mask too early exposes the blank canvas as a white flash.
const READY_FRAME_BUFFER = 4;
// Delay between starting the canvas fade-in and marking the globe ready (which
// lifts the loading mask). The mask stays on top until the dark earth is fully
// painted underneath, so no blank-canvas frame is ever visible.
const GLOBE_REVEAL_DELAY = 260;
const COMPACT_GLOBE_WIDTH = 560;

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
const isGlobeVisible = ref(false);
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
let revealTimer = null;

// --- Globe view persistence ---
// Whether the current camera state should be written back to localStorage.
// We only persist views the user actively chose (drag/zoom/focus), never the
// drift produced by auto-rotate, so the saved position stays stable.
let persistOnNextSettle = false;
let persistFlushTimer = null;
const PERSIST_DEBOUNCE_MS = 800;

// --- WebGL context-loss recovery ---
let glCanvas = null;
let contextLostHandler = null;
let contextRestoredHandler = null;
let healthCheckTimer = null;
let lastReinitAt = 0;
let reinitPending = false;
// The component is alive (between onMounted/onActivated and onDeactivated/
// onUnmounted). Health checks only run while active so a backgrounded tab does
// not churn recreating the GL context.
let contextLossGuardsActive = false;

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
      markerOnline: readThemeToken('--globe-marker-active', '#ffae00'),
      markerOnlineSoft: readThemeToken('--globe-marker-active-soft', 'rgba(255, 200, 83, 0.26)'),
      markerOffline: readThemeToken('--globe-marker-muted', '#9aa3af'),
      markerOfflineSoft: readThemeToken('--globe-marker-muted-soft', 'rgba(154, 163, 175, 0.2)'),
      onlineRing: readThemeToken('--globe-ring-rgb', '255, 200, 83'),
    };
  }

  return {
    ocean: '#061221',
    atmosphere: '#89c3eb',
    markerOnline: readThemeToken('--globe-marker-active', '#eaf4fc'),
    markerOnlineSoft: readThemeToken('--globe-marker-active-soft', 'rgba(46, 207, 255, 0.30)'),
    markerOffline: readThemeToken('--globe-marker-muted', '#6d7888'),
    markerOfflineSoft: readThemeToken('--globe-marker-muted-soft', 'rgba(109, 120, 136, 0.22)'),
    onlineRing: readThemeToken('--globe-ring-rgb', '46, 207, 255'),
  };
}

function getGlobeMaps(theme) {
  const textureSize = getPreferredGlobeTextureSize();
  const cacheKey = `${theme}-${textureSize.width}`;
  if (!globeTextureCache[cacheKey]) {
    globeTextureCache[cacheKey] = {
      colorMap: createGlobeOceanMap(theme, textureSize).toDataURL(),
    };
  }
  return globeTextureCache[cacheKey];
}

function getSceneEnvironment(theme) {
  if (theme === 'light') {
    return 'none';
  }

  return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
    { offset: 0, color: '#07162b' },
    { offset: 0.48, color: '#031020' },
    { offset: 1, color: '#010814' },
  ]);
}

function isCompactGlobeViewport() {
  const fallbackWidth = typeof window !== 'undefined'
    ? window.innerWidth
    : COMPACT_GLOBE_WIDTH + 1;
  const width = chartContainer.value?.clientWidth || fallbackWidth;
  return isMobile.value || width <= COMPACT_GLOBE_WIDTH;
}

function getAtmosphereOption(theme) {
  const compact = isCompactGlobeViewport();

  if (theme === 'light') {
    return compact ? {
      show: true,
      offset: 1,
      color: '#D1E8FF',
      glowPower: 2,
      innerGlowPower: 5,
    } : {
      show: true,
      offset: 2,
      color: '#a8d8ff',
      glowPower: 4,
      innerGlowPower: 3.5,
    };
  }

  return compact ? {
    show: true,
    offset: 1.2,
    color: '#9bd2ff',
    glowPower: 3.2,
    innerGlowPower: 4,
  } : {
    show: true,
    offset: 4,
    color: '#9bd2ff',
    glowPower: 6,
    innerGlowPower: 2,
  };
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

function getCoastlineLayerStyles(theme) {
  const colors = THEME_COLORS[theme];
  const compact = isCompactGlobeViewport();

  if (!compact) {
    return [
      {
        width: colors.coastlineWidth,
        color: colors.coastline,
      },
    ];
  }

  if (theme === 'dark') {
    return [
      {
        width: colors.mobileCoastlineWidth,
        color: colors.mobileCoastline,
      },
    ];
  }

  return [
    {
      width: colors.mobileCoastlineHaloWidth,
      color: colors.mobileCoastlineHalo,
    },
    {
      width: colors.mobileCoastlineWidth,
      color: colors.mobileCoastline,
    },
  ];
}

function getMarkerDimensions(count) {
  if (count > 9) {
    return {
      visualSize: 26, hitSize: 40, dotSize: 8, isLarge: true, ringMaxR: 2.6,
    };
  }
  if (count >= 7) {
    return {
      visualSize: 22, hitSize: 36, dotSize: 6, isLarge: false, ringMaxR: 1.8,
    };
  }
  if (count >= 5) {
    return {
      visualSize: 20, hitSize: 34, dotSize: 6, isLarge: false, ringMaxR: 1.7,
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
    visualSize: 12, hitSize: 26, dotSize: 8, isLarge: false, ringMaxR: 1.2,
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
    minDistance: isMobile.value ? MOBILE_MIN_VIEW_DISTANCE : GLOBE_RADIUS * 0.5,
    maxDistance: Math.max(360, fitDistance * 1.5),
  };
}

function getGlobeOption() {
  const isLight = props.theme === 'light';
  const maps = getGlobeMaps(props.theme);
  const coastlineData = getCoastlineSeriesData(props.theme);
  const coastlineLayers = getCoastlineLayerStyles(props.theme);

  return {
    backgroundColor: isLight ? 'transparent' : '#020a16',
    tooltip: {
      show: false,
    },
    globe: {
      show: true,
      baseTexture: maps.colorMap,
      globeRadius: GLOBE_RADIUS,
      globeOuterRadius: GLOBE_RADIUS,
      shading: 'color',
      environment: getSceneEnvironment(props.theme),
      atmosphere: getAtmosphereOption(props.theme),
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
        rotateSensitivity: 1.5,
        zoomSensitivity: 1.5,
        panSensitivity: 0,
        damping: 0.5,
        targetCoord: [...currentTargetCoord.value],
        ...getViewDistanceOptions(),
        animation: false,
      },
    },
    series: coastlineLayers.map((lineStyle) => (
      {
        type: 'lines3D',
        coordinateSystem: 'globe',
        polyline: true,
        silent: true,
        blendMode: 'source-over',
        lineStyle: {
          width: lineStyle.width,
          color: lineStyle.color,
          opacity: 1,
        },
        data: coastlineData,
      }
    )),
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
    if (texture) {
      let changed = false;

      if (texture.useMipmap !== false) {
        texture.useMipmap = false;
        changed = true;
      }
      if (texture.minFilter !== graphicGL.Texture.LINEAR) {
        texture.minFilter = graphicGL.Texture.LINEAR;
        changed = true;
      }
      if (texture.magFilter !== graphicGL.Texture.LINEAR) {
        texture.magFilter = graphicGL.Texture.LINEAR;
        changed = true;
      }
      if (!texture.anisotropic || texture.anisotropic < 8) {
        texture.anisotropic = 8;
        changed = true;
      }

      if (changed) {
        texture.dirty();
      }
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
    const seriesModels = chart.getModel().getSeriesByType('lines3D');
    seriesModels.forEach((seriesModel) => {
      const view = seriesModel && chart.getViewOfSeriesModel(seriesModel);
      if (view && view.groupGL) {
        view.groupGL.scale.set(COASTLINE_SCALE, COASTLINE_SCALE, COASTLINE_SCALE);
      }
    });
  } catch {
    // Internal APIs may change; ignore if unavailable.
  }
}

function clearRevealTimer() {
  if (revealTimer) {
    window.clearTimeout(revealTimer);
    revealTimer = null;
  }
}

function isGlobeTextureReady() {
  if (!chart) {
    return true;
  }

  try {
    const globeModel = chart.getModel().getComponent('globe');
    const globeView = globeModel && chart.getViewOfComponentModel(globeModel);
    const material = globeView && globeView._earthMesh && globeView._earthMesh.material;
    const texture = material && material.get('diffuseMap');
    return Boolean(texture && texture.isRenderable && texture.isRenderable());
  } catch {
    // Internal APIs may change; treat as not ready so we keep polling.
    return false;
  }
}

function showGlobeWhenReady(bufferFrames) {
  if (!chart) {
    isGlobeVisible.value = true;
    isReady.value = true;
    return;
  }

  // Keep polling each frame until the ocean texture has decoded and uploaded.
  if (!isGlobeTextureReady()) {
    requestAnimationFrame(() => showGlobeWhenReady(READY_FRAME_BUFFER));
    return;
  }

  // Texture is ready — burn a few more frames so the GPU actually paints the
  // textured earth before we reveal anything.
  if (bufferFrames > 0) {
    requestAnimationFrame(() => showGlobeWhenReady(bufferFrames - 1));
    return;
  }

  // Reveal in two steps: fade the canvas in first, and only after that fade
  // finishes lift the loading mask. The dark mask covers the canvas throughout,
  // so the untextured/blank canvas is never exposed as a white flash.
  isGlobeVisible.value = true;
  clearRevealTimer();
  revealTimer = window.setTimeout(() => {
    revealTimer = null;
    isReady.value = true;
  }, GLOBE_REVEAL_DELAY);
}

function applyThemeToGlobe() {
  if (!chart) {
    return;
  }

  chart.setOption(getGlobeOption(), { notMerge: true });
  showGlobeWhenReady(READY_FRAME_BUFFER);
  sharpenGlobeTextures();

  // setOption with notMerge may recreate the GL view and its OrbitControl.
  // Drop the cached reference so marker updates attach to the new control.
  orbitControl = null;
  applyAutoRotateState();
  attachMarkerUpdateListener();
  // The offscreen GL canvas is also recreated, so re-attach the context-loss
  // listeners onto the new canvas.
  attachContextLossListeners();
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

  markerUpdateHandler = () => {
    // Keep the reactive camera refs in sync with the live OrbitControl so that
    // any GL-view rebuild (theme switch / visibility change) reproduces the view
    // the user actually sees instead of a stale value.
    syncCameraStateToRefs();
    updateMarkerPositions();
    // Persist the user's last manual view after they stop interacting.
    schedulePersistGlobeView();
  };
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

// Read the live camera angles back from the OrbitControl into the reactive refs.
// Without this, currentTargetCoord/currentDistance go stale whenever the user
// drags/zooms (or while auto-rotating), and the next time the GL view is
// rebuilt (theme switch / visibility change) the globe snaps back to a stale
// position. Returns null when the control is unavailable.
function syncCameraStateToRefs() {
  const control = getOrbitControl();
  if (!control) {
    return null;
  }
  const lat = control.getAlpha();
  const lng = normalizeLng(control.getBeta() - 90);
  const distance = control.getDistance() - GLOBE_RADIUS;
  currentTargetCoord.value = [lng, lat];
  currentDistance.value = distance;
  return { lat, lng, distance };
}

function clearPersistFlushTimer() {
  if (persistFlushTimer) {
    window.clearTimeout(persistFlushTimer);
    persistFlushTimer = null;
  }
}

// Persist (debounced) the current camera view to localStorage. Only meaningful
// when persistOnNextSettle is true (i.e. the user just finished interacting);
// auto-rotate drift never triggers a write.
function schedulePersistGlobeView() {
  if (!persistOnNextSettle) {
    return;
  }
  clearPersistFlushTimer();
  persistFlushTimer = window.setTimeout(() => {
    persistFlushTimer = null;
    const view = syncCameraStateToRefs();
    if (view) {
      persistGlobeView(view);
    }
    persistOnNextSettle = false;
  }, PERSIST_DEBOUNCE_MS);
}

// Persist immediately (e.g. right before unmounting). No-op unless a user-driven
// view change is pending.
function flushPersistGlobeView() {
  clearPersistFlushTimer();
  if (!persistOnNextSettle) {
    return;
  }
  const view = syncCameraStateToRefs();
  if (view) {
    persistGlobeView(view);
  }
  persistOnNextSettle = false;
}

// Compute the default globe center from the supplied locations: the first
// marker with valid coordinates. Because serverLocations is built from the
// DisplayIndex-descending server list, that first marker corresponds to the
// location of the highest-sort server — i.e. "排序值降序第 1 个的地点".
function getDefaultTargetCoord() {
  const first = props.locations?.find(
    (loc) => Number.isFinite(loc?.lat) && Number.isFinite(loc?.lng),
  );
  if (first) {
    return [first.lng, first.lat];
  }
  return [INITIAL_POINT_OF_VIEW.lng, INITIAL_POINT_OF_VIEW.lat];
}

// --- WebGL context-loss recovery ---
// Mobile browsers reclaim the WebGL context after backgrounding / under memory
// pressure. Once lost it cannot be restored with a plain setOption, so the only
// reliable fix is to dispose the echarts instance and recreate it (which spins
// up a fresh GL context). The persisted view is restored from localStorage, so
// the user lands back exactly where they were.

function attachContextLossListeners() {
  detachContextLossListeners();
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
    scheduleReinit('context-lost');
  };
  contextRestoredHandler = () => {
    scheduleReinit('context-restored');
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
  if (!contextLossGuardsActive || !chart || !isReady.value) {
    return;
  }
  // Skip while the user is actively dragging/zooming to avoid tearing the globe
  // out from under them, and while the tab is hidden (no point recovering a
  // surface that is not visible — visibilitychange handles re-entry).
  if (isUserInteracting.value || document.hidden) {
    return;
  }
  if (isGlobeGLContextLost(chart)) {
    scheduleReinit('health-check');
  }
}

function scheduleHealthCheck() {
  stopHealthCheck();
  if (typeof window === 'undefined') {
    return;
  }
  const interval = isMobile.value
    ? CONTEXT_LOSS_CHECK_INTERVAL_MOBILE
    : CONTEXT_LOSS_CHECK_INTERVAL_DESKTOP;
  healthCheckTimer = window.setInterval(runHealthCheck, interval);
}

function teardownChartInstance() {
  detachContextLossListeners();
  clearRevealTimer();
  clearInteractionSettleTimer();

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
}

// Recreate the echarts instance to recover from a lost WebGL context. Idempotent
// and debounced: overlapping triggers (lost event + restored event + health
// check) collapse into a single rebuild.
function scheduleReinit(reason) {
  // A recovery is already queued — let it run and decide whether another pass
  // is needed (health checks will catch a still-broken context afterwards).
  if (reinitPending) {
    return;
  }
  reinitPending = true;
  const now = performance.now();
  const wait = Math.max(0, REINIT_MIN_INTERVAL - (now - lastReinitAt));
  window.setTimeout(() => {
    reinitPending = false;
    if (!contextLossGuardsActive) {
      return;
    }
    // Still in a bad state (or proactively rebuilding on context-lost)?
    const lost = chart ? isGlobeGLContextLost(chart) : true;
    if (!lost && reason !== 'context-lost') {
      return;
    }
    lastReinitAt = performance.now();
    try {
      // Preserve the current view across the recreate, then drop into the
      // loading state so the canvas never shows a frozen/blank frame.
      flushPersistGlobeView();
      isReady.value = false;
      isGlobeVisible.value = false;
      initError.value = false;
      teardownChartInstance();
      initChart();
    } catch (error) {
      console.error('Globe context-loss recovery failed:', error);
      initError.value = true;
      isReady.value = true;
    }
  }, wait);
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
    distance: currentDistance.value,
  }).then(() => {
    // Persist the focus destination as the user's chosen view.
    persistOnNextSettle = true;
    flushPersistGlobeView();
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
      distance: currentDistance.value,
    }).then(() => {
      // Persist the focus destination as the user's chosen view.
      persistOnNextSettle = true;
      flushPersistGlobeView();

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

  // Reset to the default center (highest-sort server's location), dropping any
  // saved view so a fresh load also lands here.
  const defaultCoord = getDefaultTargetCoord();
  clearPersistFlushTimer();
  clearGlobeView();
  persistOnNextSettle = false;

  animateView({
    targetCoord: defaultCoord,
    distance: GLOBE_RADIUS * fitAltitude,
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
  // The user just finished dragging/zooming — remember this view once it
  // settles. Auto-rotate drift after release is excluded by the debounce
  // (persistOnNextSettle is consumed on the first settle).
  persistOnNextSettle = true;
  schedulePersistGlobeView();
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

  // Capture the live camera state first so the user's rotation/zoom survives the
  // re-option (the OrbitControl is not recreated here, but we still want the
  // most up-to-date values), then clamp the distance into the new min/max range
  // instead of resetting it to fit-to-screen and discarding the user's zoom.
  syncCameraStateToRefs();
  const fitDistance = GLOBE_RADIUS * fitAltitude;
  const minDistance = isMobile.value ? MOBILE_MIN_VIEW_DISTANCE : GLOBE_RADIUS * 0.5;
  const maxDistance = Math.max(360, fitDistance * 1.5);
  currentDistance.value = Math.max(
    Math.min(currentDistance.value, maxDistance),
    minDistance,
  );

  cachedContainerRect = chartContainer.value.getBoundingClientRect();
  chart.resize();

  chart.setOption({
    globe: {
      atmosphere: getAtmosphereOption(props.theme),
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

  // Coming back from the background is the most common trigger for a mobile GL
  // context loss. Detect it first and rebuild the instance; re-optioning a dead
  // context only produces a blank frame.
  if (isGlobeGLContextLost(chart)) {
    scheduleReinit('visibility');
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

    // Restore the last user-driven view from storage; otherwise fall back to the
    // default center (location of the highest-sort server) with a fit-to-screen
    // distance. This also covers the keep-alive remount triggered by globeKey++.
    const saved = loadGlobeView();
    if (saved) {
      currentTargetCoord.value = [saved.lng, saved.lat];
      currentDistance.value = saved.distance;
    } else {
      currentTargetCoord.value = getDefaultTargetCoord();
      currentDistance.value = GLOBE_RADIUS * fitAltitude;
    }
    persistOnNextSettle = false;
    clearPersistFlushTimer();

    chart = echarts.init(chartContainer.value, null, {
      renderer: 'canvas',
      devicePixelRatio: getGlobeRendererPixelRatio(),
    });

    chart.setOption(getGlobeOption(), { notMerge: true });
    sharpenGlobeTextures();

    chart.on('finished', syncCoastlineDepth);
    showGlobeWhenReady(READY_FRAME_BUFFER);
    // Fallback: show the globe even if texture readiness cannot be detected.
    setTimeout(() => {
      clearRevealTimer();
      isGlobeVisible.value = true;
      isReady.value = true;
    }, 2000);
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
    // Guard against the mobile-only WebGL context-loss case: listen for loss on
    // the offscreen GL canvas and poll its health on an interval.
    attachContextLossListeners();
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
  contextLossGuardsActive = true;
  initChart();
  scheduleHealthCheck();
  window.addEventListener('resize', handleResize);

  if (typeof ResizeObserver !== 'undefined' && chartContainer.value) {
    resizeObserver = new ResizeObserver(() => scheduleHandleResize());
    resizeObserver.observe(chartContainer.value);
  }
});

onActivated(() => {
  updateViewportMode();
  startLocalTimeTicker();
  contextLossGuardsActive = true;

  nextTick(() => {
    scheduleHandleResize();

    if (!chartContainer.value) {
      return;
    }

    // Returning to the tab after backgrounding is the classic trigger for a
    // mobile GL context loss — recover before touching the chart further.
    if (chart && isGlobeGLContextLost(chart)) {
      scheduleReinit('activated');
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
    scheduleHealthCheck();
  });
});

onDeactivated(() => {
  stopLocalTimeTicker();
  stopHealthCheck();
  contextLossGuardsActive = false;
  clearInteractionSettleTimer();
  clearRevealTimer();
  clearFocusBubble();
});

onUnmounted(() => {
  // Persist the current view before teardown so navigating away (e.g. into a
  // server detail route) remembers the last position.
  flushPersistGlobeView();

  contextLossGuardsActive = false;
  stopHealthCheck();
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

  clearPersistFlushTimer();
  // Tears down the chart, OrbitControl, marker/container listeners, context-loss
  // listeners and markers in one place (shared with scheduleReinit).
  teardownChartInstance();
  clearFocusBubble();
});
</script>

<style lang="scss" scoped>
.globe-earth {
  width: 100%;
  height: 100%;
  position: relative;
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

// Dark stage-coloured backdrop shown only before the globe is ready. It sits
// beneath the canvas so the briefly blank/untextured canvas never reveals a
// white page; once ready it is removed together with the loading mask, leaving
// the real stage background untouched.
.globe-stage-fallback {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: var(--globe-stage-bg);
  pointer-events: none;
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
  background-color: var(--bg-primary);
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

.globe-loading-fade-leave-active {
  transition: opacity 0.25s ease;
}

.globe-loading-fade-leave-to {
  opacity: 0;
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
    box-shadow: none;
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
