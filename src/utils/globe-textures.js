import { getLandPolygonsData } from './globe-land-polygons.js';

const BASE_TEXTURE_WIDTH = 4096;
const MIN_TEXTURE_WIDTH = 2048;
const BUMP_TEXTURE_WIDTH = 2048;
const BUMP_TEXTURE_HEIGHT = 1024;
const MAX_RENDERER_PIXEL_RATIO = 3;

let cachedMaxTextureSize = null;

const BASE_LAND_COLORS = {
  light: '#eef6ff',
  dark: '#6b798f',
};

export const THEME_COLORS = {
  light: {
    oceanBase: '#d0e6fa',
    land: BASE_LAND_COLORS.light,
    coastline: 'rgba(96, 140, 184, 0.36)',
    coastlineWidth: 0.9,
    coastlineHalo: 'rgba(255, 255, 255, 0.68)',
    coastlineHaloWidth: 2.2,
    mobileCoastline: 'rgba(72, 118, 166, 0.44)',
    mobileCoastlineWidth: 0.72,
    mobileCoastlineHalo: 'rgba(255, 255, 255, 0.48)',
    mobileCoastlineHaloWidth: 1.5,
  },
  dark: {
    oceanBase: '#061221',
    oceanCenter: '#071829',
    oceanMid: '#092035',
    oceanEdge: '#0b2843',
    oceanLimb: '#0d304f',
    land: BASE_LAND_COLORS.dark,
    coastline: 'rgba(136, 176, 205, 0.34)',
    coastlineWidth: 0.9,
    coastlineHalo: 'rgba(2, 9, 20, 0.66)',
    coastlineHaloWidth: 2.4,
    mobileCoastline: 'rgba(166, 206, 230, 0.30)',
    mobileCoastlineWidth: 0.58,
    mobileCoastlineHalo: 'rgba(0, 5, 14, 0.52)',
    mobileCoastlineHaloWidth: 1.65,
  },
};

function getPowerOfTwoAtMost(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return BASE_TEXTURE_WIDTH;
  }

  return 2 ** Math.floor(Math.log2(value));
}

function getMaxTextureSize() {
  if (cachedMaxTextureSize !== null) {
    return cachedMaxTextureSize;
  }

  if (typeof document === 'undefined') {
    cachedMaxTextureSize = BASE_TEXTURE_WIDTH;
    return cachedMaxTextureSize;
  }

  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

  if (!gl) {
    cachedMaxTextureSize = BASE_TEXTURE_WIDTH;
    return cachedMaxTextureSize;
  }

  cachedMaxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) || BASE_TEXTURE_WIDTH;

  const loseContext = gl.getExtension('WEBGL_lose_context');
  if (loseContext) {
    loseContext.loseContext();
  }

  return cachedMaxTextureSize;
}

export function getGlobeRendererPixelRatio() {
  if (typeof window === 'undefined') {
    return 1;
  }

  const dpr = Number(window.devicePixelRatio) || 1;
  return Math.min(Math.max(dpr, 1), MAX_RENDERER_PIXEL_RATIO);
}

export function getPreferredGlobeTextureSize(options = {}) {
  const {
    maxWidth = BASE_TEXTURE_WIDTH,
  } = options;
  const maxTextureSize = getPowerOfTwoAtMost(getMaxTextureSize());
  const minimumWidth = Math.min(MIN_TEXTURE_WIDTH, maxTextureSize);
  const requestedWidth = Math.min(BASE_TEXTURE_WIDTH, maxWidth, maxTextureSize);
  const width = Math.max(minimumWidth, requestedWidth);

  return {
    width,
    height: width / 2,
  };
}

function projectGeoToCanvas(lng, lat, width, height) {
  const x = ((lng + 180) / 360) * width;
  const y = ((90 - lat) / 180) * height;
  return { x, y };
}

function drawLandForBump(ctx, width, height) {
  const polygons = getLandPolygonsData();
  ctx.fillStyle = '#ffffff';
  ctx.filter = 'blur(3px)';

  polygons.forEach((polygon) => {
    const rings = polygon.geometry.coordinates;
    if (!rings || rings.length === 0) {
      return;
    }

    ctx.beginPath();
    rings.forEach((ring) => {
      ring.forEach(([lng, lat], index) => {
        const { x, y } = projectGeoToCanvas(lng, lat, width, height);
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
    });
    ctx.closePath();
    ctx.fill();
  });

  ctx.filter = 'none';
}

export function createGlobeBumpMap() {
  const canvas = document.createElement('canvas');
  canvas.width = BUMP_TEXTURE_WIDTH;
  canvas.height = BUMP_TEXTURE_HEIGHT;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawLandForBump(ctx, canvas.width, canvas.height);

  return canvas;
}

function drawLightOcean(ctx) {
  const { width, height } = ctx.canvas;

  // Use a centered, subtle radial gradient so the sphere looks uniformly
  // round without visible seams or directional shadows when mapped onto the
  // globe with `shading: 'color'`.
  ctx.fillStyle = '#c4ddf0';
  ctx.fillRect(0, 0, width, height);

  const bodyGradient = ctx.createRadialGradient(
    width * 0.5,
    height * 0.5,
    height * 0.05,
    width * 0.5,
    height * 0.5,
    height * 0.85,
  );
  bodyGradient.addColorStop(0, '#dff0ff');
  bodyGradient.addColorStop(0.55, '#c6e2f5');
  bodyGradient.addColorStop(1, '#a8ccea');
  ctx.fillStyle = bodyGradient;
  ctx.fillRect(0, 0, width, height);
}

function drawDarkOcean(ctx) {
  const colors = THEME_COLORS.dark;
  const { width, height } = ctx.canvas;

  // Centered radial gradient for a uniform, flat sphere look without
  // directional light/shadow seams.
  ctx.fillStyle = colors.oceanBase;
  ctx.fillRect(0, 0, width, height);

  const bodyGradient = ctx.createRadialGradient(
    width * 0.5,
    height * 0.5,
    height * 0.05,
    width * 0.5,
    height * 0.5,
    height * 0.85,
  );
  bodyGradient.addColorStop(0, colors.oceanCenter);
  bodyGradient.addColorStop(0.45, colors.oceanMid);
  bodyGradient.addColorStop(0.8, colors.oceanEdge);
  bodyGradient.addColorStop(1, colors.oceanLimb);
  ctx.fillStyle = bodyGradient;
  ctx.fillRect(0, 0, width, height);
}

function addTextureNoise(ctx, opacity) {
  const patternSize = 256;
  const noiseCanvas = document.createElement('canvas');
  noiseCanvas.width = patternSize;
  noiseCanvas.height = patternSize;
  const noiseCtx = noiseCanvas.getContext('2d');
  const imageData = noiseCtx.createImageData(patternSize, patternSize);
  const { data } = imageData;

  for (let i = 0; i < data.length; i += 4) {
    const value = Math.round(128 + (Math.random() - 0.5) * 64);
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
    data[i + 3] = 255;
  }

  noiseCtx.putImageData(imageData, 0, 0);

  const noisePattern = ctx.createPattern(noiseCanvas, 'repeat');
  if (!noisePattern) {
    return;
  }

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = noisePattern;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

function addLightNoise(ctx) {
  addTextureNoise(ctx, 0.018);
}

function addDarkNoise(ctx) {
  addTextureNoise(ctx, 0.014);
}

function drawDarkGraticules(ctx, width, height) {
  ctx.strokeStyle = 'rgba(140, 190, 255, 0.018)';
  ctx.lineWidth = 1;

  for (let lng = -150; lng <= 150; lng += 30) {
    const { x } = projectGeoToCanvas(lng, 0, width, height);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let lat = -60; lat <= 60; lat += 30) {
    const { y } = projectGeoToCanvas(0, lat, width, height);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function traceLandPath(ctx, width, height, polygon) {
  const rings = polygon.geometry.coordinates;
  ctx.beginPath();
  rings.forEach((ring) => {
    ring.forEach(([lng, lat], index) => {
      const { x, y } = projectGeoToCanvas(lng, lat, width, height);
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.closePath();
  });
}

function drawLandColor(ctx, width, height, color) {
  const polygons = getLandPolygonsData();

  ctx.fillStyle = color;
  polygons.forEach((polygon) => {
    traceLandPath(ctx, width, height, polygon);
    ctx.fill('evenodd');
  });
}

/** 生成海洋 + 陆地的球面纹理；陆地直接绘制在纹理上以获得平滑光照 */
export function createGlobeOceanMap(theme = 'dark', textureSize = getPreferredGlobeTextureSize()) {
  const canvas = document.createElement('canvas');
  canvas.width = textureSize.width;
  canvas.height = textureSize.height;
  const ctx = canvas.getContext('2d');

  if (theme === 'light') {
    drawLightOcean(ctx);
    addLightNoise(ctx);
  } else {
    drawDarkOcean(ctx);
    addDarkNoise(ctx);
    drawDarkGraticules(ctx, canvas.width, canvas.height);
  }

  drawLandColor(ctx, canvas.width, canvas.height, THEME_COLORS[theme].land);

  // Coastlines are rendered separately as a screen-space constant-width
  // lines3D overlay so they stay crisp at any zoom level.

  return canvas;
}

const SCENE_BG_SIZE = 1024;

export function createSceneBackgroundTexture(theme = 'dark') {
  if (theme !== 'dark') {
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = SCENE_BG_SIZE;
  canvas.height = SCENE_BG_SIZE;
  const ctx = canvas.getContext('2d');

  const base = ctx.createLinearGradient(0, 0, 0, canvas.height);
  base.addColorStop(0, '#07162b');
  base.addColorStop(0.48, '#031020');
  base.addColorStop(1, '#010814');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const topGlow = ctx.createRadialGradient(
    canvas.width * 0.5,
    canvas.height * 0.30,
    0,
    canvas.width * 0.5,
    canvas.height * 0.30,
    canvas.height * 0.92,
  );
  topGlow.addColorStop(0, 'rgba(56, 128, 220, 0.16)');
  topGlow.addColorStop(0.46, 'rgba(56, 128, 220, 0.06)');
  topGlow.addColorStop(1, 'rgba(56, 128, 220, 0)');
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const bottomGlow = ctx.createRadialGradient(
    canvas.width * 0.5,
    canvas.height * 0.74,
    0,
    canvas.width * 0.5,
    canvas.height * 0.74,
    canvas.height * 0.78,
  );
  bottomGlow.addColorStop(0, 'rgba(25, 74, 150, 0.12)');
  bottomGlow.addColorStop(1, 'rgba(25, 74, 150, 0)');
  ctx.fillStyle = bottomGlow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const centerGlow = ctx.createRadialGradient(
    canvas.width * 0.5,
    canvas.height * 0.50,
    0,
    canvas.width * 0.5,
    canvas.height * 0.50,
    canvas.height * 0.80,
  );
  centerGlow.addColorStop(0, 'rgba(28, 132, 140, 0.035)');
  centerGlow.addColorStop(0.58, 'rgba(56, 128, 220, 0.014)');
  centerGlow.addColorStop(1, 'rgba(56, 128, 220, 0)');
  ctx.fillStyle = centerGlow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  return canvas;
}

export function createGlobeMaps(theme = 'dark') {
  return {
    colorMap: createGlobeOceanMap(theme),
  };
}

export default createGlobeMaps;
