import * as THREE from 'three';

const TEXTURE_WIDTH = 2048;
const TEXTURE_HEIGHT = 1024;

function projectLngLat(lng, lat) {
  return {
    x: ((lng + 180) / 360) * TEXTURE_WIDTH,
    y: ((90 - lat) / 180) * TEXTURE_HEIGHT,
  };
}

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

function drawLandmass(ctx, geojson, theme) {
  const isLight = theme === 'light';
  ctx.fillStyle = isLight ? '#c8d0db' : '#2a303a';
  ctx.strokeStyle = isLight ? 'rgba(140,155,175,0.22)' : 'rgba(60,70,85,0.35)';
  ctx.lineWidth = isLight ? 1 : 0.8;
  ctx.lineJoin = 'round';

  ctx.beginPath();
  geojson.features.forEach(({ geometry }) => {
    if (!geometry) return;

    const polygons = [];
    if (geometry.type === 'Polygon') {
      polygons.push(geometry.coordinates);
    } else if (geometry.type === 'MultiPolygon') {
      polygons.push(...geometry.coordinates);
    }

    polygons.forEach((polygon) => {
      polygon.forEach((ring) => {
        if (ring.length < 3) return;
        let first = true;
        let prevLng = null;
        ring.forEach((point) => {
          const [lng, lat] = point;
          if (prevLng !== null && Math.abs(lng - prevLng) > 180) {
            ctx.closePath();
            first = true;
          }
          const { x, y } = projectLngLat(lng, lat);
          if (first) {
            ctx.moveTo(x, y);
            first = false;
          } else {
            ctx.lineTo(x, y);
          }
          prevLng = lng;
        });
        ctx.closePath();
      });
    });
  });

  ctx.fill('evenodd');
  ctx.stroke();
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

export function createGlobeTexture(theme = 'dark', boundaryGeojson = null) {
  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_WIDTH;
  canvas.height = TEXTURE_HEIGHT;
  const ctx = canvas.getContext('2d');

  drawBase(ctx, theme);

  if (boundaryGeojson) {
    drawLandmass(ctx, boundaryGeojson, theme);
  }

  addNoise(ctx, theme);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

export function disposeGlobeTextures() {
  // Textures are created on demand and disposed with materials
}
