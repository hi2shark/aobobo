import * as THREE from 'three';

const TEXTURE_WIDTH = 4096;
const TEXTURE_HEIGHT = 2048;

const THEME_COLORS = {
  light: {
    oceanBase: '#b0c8ee',
    oceanCenter: '#d4e6fb',
    oceanMid: '#b8d0f5',
    oceanEdge: '#8aa8d8',
  },
  dark: {
    oceanBase: '#05070a',
    oceanCenter: '#080b10',
    oceanMid: '#0c1018',
    oceanEdge: '#161e2a',
    oceanLimb: '#1c2838',
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

function drawLightOcean(ctx) {
  const colors = THEME_COLORS.light;
  ctx.fillStyle = colors.oceanBase;
  ctx.fillRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);

  const centerGradient = ctx.createRadialGradient(
    TEXTURE_WIDTH * 0.46,
    TEXTURE_HEIGHT * 0.44,
    TEXTURE_HEIGHT * 0.08,
    TEXTURE_WIDTH * 0.5,
    TEXTURE_HEIGHT * 0.5,
    TEXTURE_HEIGHT * 0.62,
  );
  centerGradient.addColorStop(0, colors.oceanCenter);
  centerGradient.addColorStop(0.42, colors.oceanMid);
  centerGradient.addColorStop(0.78, '#9eb8e8');
  centerGradient.addColorStop(1, colors.oceanEdge);
  ctx.fillStyle = centerGradient;
  ctx.fillRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
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
  bodyGradient.addColorStop(0.72, '#121820');
  bodyGradient.addColorStop(0.9, colors.oceanEdge);
  bodyGradient.addColorStop(1, colors.oceanLimb);
  ctx.fillStyle = bodyGradient;
  ctx.fillRect(0, 0, width, height);

  const keyLight = ctx.createRadialGradient(
    width * 0.32,
    height * 0.28,
    0,
    width * 0.32,
    height * 0.28,
    height * 0.72,
  );
  keyLight.addColorStop(0, 'rgba(180, 200, 220, 0.09)');
  keyLight.addColorStop(0.45, 'rgba(100, 130, 160, 0.03)');
  keyLight.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = keyLight;
  ctx.fillRect(0, 0, width, height);

  const shadow = ctx.createLinearGradient(0, 0, width, height);
  shadow.addColorStop(0, 'rgba(255, 255, 255, 0.04)');
  shadow.addColorStop(0.42, 'rgba(0, 0, 0, 0)');
  shadow.addColorStop(1, 'rgba(0, 0, 0, 0.14)');
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

/** 仅生成海洋渐变纹理；陆地由 GeoJSON 矢量层单独渲染 */
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
  }

  return createColorTexture(canvas);
}

export function createGlobeMaps(theme = 'dark') {
  return {
    colorMap: createGlobeOceanMap(theme),
    bumpMap: null,
  };
}

export default createGlobeMaps;
