import { getLandPolygonsData } from './globe-land-polygons.js';

const TEXTURE_WIDTH = 6144;
const TEXTURE_HEIGHT = 3072;
const BUMP_TEXTURE_WIDTH = 2048;
const BUMP_TEXTURE_HEIGHT = 1024;

const LAND_BRIGHTEN_PERCENT = -30;

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    }
    : null;
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b]
    .map((channel) => {
      const hex = Math.round(Math.max(0, Math.min(255, channel))).toString(16);
      return hex.length === 1 ? `0${hex}` : hex;
    })
    .join('')}`;
}

function brighten(hex, percent) {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return hex;
  }
  const factor = 1 + percent / 100;
  return rgbToHex(rgb.r * factor, rgb.g * factor, rgb.b * factor);
}

const BASE_LAND_COLORS = {
  light: '#f3f6fa',
  dark: '#a7b2c2',
};

export const THEME_COLORS = {
  light: {
    oceanBase: '#d0e6fa',
    land: '#eef6ff',
    coastline: 'rgba(130, 165, 205, 0.30)',
    coastlineWidth: 1.5,
  },
  dark: {
    oceanBase: '#061221',
    oceanCenter: '#071829',
    oceanMid: '#092035',
    oceanEdge: '#0b2843',
    oceanLimb: '#0d304f',
    land: brighten(BASE_LAND_COLORS.dark, LAND_BRIGHTEN_PERCENT),
    coastline: 'rgba(120, 160, 195, 0.30)',
    coastlineWidth: 1.5,
  },
};

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
  ctx.fillStyle = '#d6e9f8';
  ctx.fillRect(0, 0, width, height);

  const bodyGradient = ctx.createRadialGradient(
    width * 0.5,
    height * 0.5,
    height * 0.05,
    width * 0.5,
    height * 0.5,
    height * 0.85,
  );
  bodyGradient.addColorStop(0, '#e8f4ff');
  bodyGradient.addColorStop(0.55, '#dcedfa');
  bodyGradient.addColorStop(1, '#beddf5');
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

function addLightNoise(ctx) {
  const imageData = ctx.getImageData(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
  const { data } = imageData;

  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 2;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
  }

  ctx.putImageData(imageData, 0, 0);
}

function addDarkNoise(ctx) {
  const { width, height } = ctx.canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;

  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 1.2;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
  }

  ctx.putImageData(imageData, 0, 0);
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
export function createGlobeOceanMap(theme = 'dark') {
  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_WIDTH;
  canvas.height = TEXTURE_HEIGHT;
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
  base.addColorStop(0, '#081221');
  base.addColorStop(0.48, '#03080f');
  base.addColorStop(1, '#010306');
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
  topGlow.addColorStop(0, 'rgba(45, 154, 255, 0.32)');
  topGlow.addColorStop(0.42, 'rgba(45, 154, 255, 0.10)');
  topGlow.addColorStop(1, 'rgba(45, 154, 255, 0)');
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
  bottomGlow.addColorStop(0, 'rgba(22, 60, 140, 0.22)');
  bottomGlow.addColorStop(1, 'rgba(22, 60, 140, 0)');
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
  centerGlow.addColorStop(0, 'rgba(45, 154, 255, 0.05)');
  centerGlow.addColorStop(0.55, 'rgba(45, 154, 255, 0.02)');
  centerGlow.addColorStop(1, 'rgba(45, 154, 255, 0)');
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
