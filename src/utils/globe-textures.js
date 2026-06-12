import * as THREE from 'three';

const TEXTURE_WIDTH = 4096;
const TEXTURE_HEIGHT = 2048;

function drawBase(ctx, theme) {
  const isLight = theme === 'light';
  ctx.fillStyle = isLight ? '#e8f4f1' : '#000000';
  ctx.fillRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);

  const gradient = ctx.createRadialGradient(
    TEXTURE_WIDTH * 0.5,
    TEXTURE_HEIGHT * 0.5,
    TEXTURE_HEIGHT * 0.25,
    TEXTURE_WIDTH * 0.5,
    TEXTURE_HEIGHT * 0.5,
    TEXTURE_HEIGHT * 0.75,
  );
  gradient.addColorStop(0, isLight ? 'rgba(255,255,255,0)' : 'rgba(0,0,0,0)');
  gradient.addColorStop(1, isLight ? 'rgba(180,195,210,0.18)' : 'rgba(0,0,0,0.45)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
}

function addNoise(ctx, theme) {
  const isLight = theme === 'light';
  const imageData = ctx.getImageData(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
  const { data } = imageData;
  const amount = isLight ? 4 : 8;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * amount;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
  }
  ctx.putImageData(imageData, 0, 0);
}

export default function createGlobeTexture(theme = 'dark') {
  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_WIDTH;
  canvas.height = TEXTURE_HEIGHT;
  const ctx = canvas.getContext('2d');

  drawBase(ctx, theme);
  addNoise(ctx, theme);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}
