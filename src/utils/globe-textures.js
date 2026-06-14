import * as THREE from 'three';
import { getLandPolygonsData } from './globe-land-polygons.js';

const TEXTURE_WIDTH = 4096;
const TEXTURE_HEIGHT = 2048;
const BUMP_TEXTURE_WIDTH = 2048;
const BUMP_TEXTURE_HEIGHT = 1024;

const LAND_BRIGHTEN_PERCENT = 10;

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

const THEME_COLORS = {
  light: {
    oceanBase: '#d9edff',
    land: BASE_LAND_COLORS.light,
  },
  dark: {
    oceanBase: '#03080f',
    oceanCenter: '#051018',
    oceanMid: '#071420',
    oceanEdge: '#091c2c',
    oceanLimb: '#0b2234',
    land: brighten(BASE_LAND_COLORS.dark, LAND_BRIGHTEN_PERCENT),
  },
};

function createColorTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function createBumpTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.anisotropy = 8;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
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

  return createBumpTexture(canvas);
}

function drawLightOcean(ctx) {
  const colors = THEME_COLORS.light;
  const { width, height } = ctx.canvas;

  ctx.fillStyle = colors.oceanBase;
  ctx.fillRect(0, 0, width, height);
}

function drawDarkOcean(ctx) {
  const colors = THEME_COLORS.dark;
  const { width, height } = ctx.canvas;

  ctx.fillStyle = colors.oceanBase;
  ctx.fillRect(0, 0, width, height);

  const bodyGradient = ctx.createRadialGradient(
    width * 0.44,
    height * 0.38,
    height * 0.04,
    width * 0.5,
    height * 0.5,
    height * 0.82,
  );
  bodyGradient.addColorStop(0, colors.oceanCenter);
  bodyGradient.addColorStop(0.38, colors.oceanMid);
  bodyGradient.addColorStop(0.72, '#0e1620');
  bodyGradient.addColorStop(0.9, colors.oceanEdge);
  bodyGradient.addColorStop(1, colors.oceanLimb);
  ctx.fillStyle = bodyGradient;
  ctx.fillRect(0, 0, width, height);

  const keyLight = ctx.createRadialGradient(
    width * 0.62,
    height * 0.32,
    0,
    width * 0.62,
    height * 0.32,
    height * 0.72,
  );
  keyLight.addColorStop(0, 'rgba(200, 220, 240, 0.025)');
  keyLight.addColorStop(0.45, 'rgba(90, 120, 160, 0.008)');
  keyLight.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = keyLight;
  ctx.fillRect(0, 0, width, height);

  const shadow = ctx.createLinearGradient(0, 0, width, height);
  shadow.addColorStop(0, 'rgba(255, 255, 255, 0.03)');
  shadow.addColorStop(0.45, 'rgba(0, 0, 0, 0)');
  shadow.addColorStop(1, 'rgba(0, 0, 0, 0.10)');
  ctx.fillStyle = shadow;
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

function drawLandColor(ctx, width, height, color) {
  const polygons = getLandPolygonsData();

  ctx.fillStyle = color;
  polygons.forEach((polygon) => {
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

  return createColorTexture(canvas);
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
    canvas.height * 0.72,
  );
  topGlow.addColorStop(0, 'rgba(45, 154, 255, 0.22)');
  topGlow.addColorStop(0.42, 'rgba(45, 154, 255, 0.08)');
  topGlow.addColorStop(1, 'rgba(45, 154, 255, 0)');
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const bottomGlow = ctx.createRadialGradient(
    canvas.width * 0.5,
    canvas.height * 0.74,
    0,
    canvas.width * 0.5,
    canvas.height * 0.74,
    canvas.height * 0.55,
  );
  bottomGlow.addColorStop(0, 'rgba(22, 60, 140, 0.14)');
  bottomGlow.addColorStop(1, 'rgba(22, 60, 140, 0)');
  ctx.fillStyle = bottomGlow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function createGlobeMaps(theme = 'dark') {
  return {
    colorMap: createGlobeOceanMap(theme),
    bumpMap: createGlobeBumpMap(),
  };
}

export default createGlobeMaps;
