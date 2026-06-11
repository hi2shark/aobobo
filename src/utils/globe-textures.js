import * as THREE from 'three';

const TEXTURE_WIDTH = 2048;
const TEXTURE_HEIGHT = 1024;

function projectLngLat(lng, lat) {
  return {
    x: ((lng + 180) / 360) * TEXTURE_WIDTH,
    y: ((90 - lat) / 180) * TEXTURE_HEIGHT,
  };
}

function drawBaseGradient(ctx, theme) {
  const isLight = theme === 'light';

  const baseGradient = ctx.createLinearGradient(0, 0, 0, TEXTURE_HEIGHT);
  if (isLight) {
    baseGradient.addColorStop(0, '#ffffff');
    baseGradient.addColorStop(0.5, '#f8fbfc');
    baseGradient.addColorStop(1, '#eff6f7');
  } else {
    baseGradient.addColorStop(0, '#1c2632');
    baseGradient.addColorStop(0.5, '#172029');
    baseGradient.addColorStop(1, '#111820');
  }

  ctx.fillStyle = baseGradient;
  ctx.fillRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);

  const sheen = ctx.createRadialGradient(
    TEXTURE_WIDTH * 0.28,
    TEXTURE_HEIGHT * 0.22,
    0,
    TEXTURE_WIDTH * 0.5,
    TEXTURE_HEIGHT * 0.5,
    TEXTURE_WIDTH * 0.95,
  );

  if (isLight) {
    sheen.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    sheen.addColorStop(0.35, 'rgba(255, 255, 255, 0.25)');
    sheen.addColorStop(1, 'rgba(170, 210, 215, 0.18)');
  } else {
    sheen.addColorStop(0, 'rgba(255, 255, 255, 0.06)');
    sheen.addColorStop(0.5, 'rgba(255, 255, 255, 0.02)');
    sheen.addColorStop(1, 'rgba(0, 0, 0, 0)');
  }

  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
}

function drawBoundaries(ctx, geojson, theme) {
  const isLight = theme === 'light';
  ctx.strokeStyle = isLight ? 'rgba(55, 150, 150, 0.88)' : 'rgba(90, 170, 200, 0.8)';
  ctx.lineWidth = isLight ? 1.5 : 1.1;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  geojson.features.forEach((feature) => {
    const { geometry } = feature;
    if (!geometry) return;

    const rings = [];
    if (geometry.type === 'Polygon') {
      rings.push(...geometry.coordinates);
    } else if (geometry.type === 'MultiPolygon') {
      geometry.coordinates.forEach((polygon) => rings.push(...polygon));
    }

    rings.forEach((ring) => {
      if (ring.length < 2) return;
      ctx.beginPath();
      ring.forEach(([lng, lat], index) => {
        const { x, y } = projectLngLat(lng, lat);
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          // Handle antimeridian wrap to avoid drawing lines across the whole texture
          const prev = ring[index - 1];
          const dx = Math.abs(lng - prev[0]);
          if (dx > 180) {
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
      });
      ctx.stroke();
    });
  });
}

function createCleanGlobeTexture(theme = 'dark', boundaryGeojson = null) {
  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_WIDTH;
  canvas.height = TEXTURE_HEIGHT;
  const ctx = canvas.getContext('2d');

  drawBaseGradient(ctx, theme);

  if (boundaryGeojson) {
    drawBoundaries(ctx, boundaryGeojson, theme);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function createStarTexture() {
  const width = 2048;
  const height = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 2200; i += 1) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const radius = Math.random() * 1.0 + 0.3;
    const alpha = Math.random() * 0.5 + 0.15;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.fill();
  }

  for (let i = 0; i < 60; i += 1) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const radius = Math.random() * 1.3 + 0.8;
    const alpha = Math.random() * 0.35 + 0.35;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(200, 220, 255, ${alpha})`;
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function createGlobeTexture(theme = 'dark', boundaryGeojson = null) {
  return createCleanGlobeTexture(theme, boundaryGeojson);
}

export function createStarfieldTexture() {
  return createStarTexture();
}

export function disposeGlobeTextures() {
  // No-op: textures are created on demand and disposed with materials
}
