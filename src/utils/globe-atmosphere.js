import * as THREE from 'three';

const GLOBE_RADIUS = 100;

/**
 * 参考 Server Distribution：宽域柔光为主，极弱边缘提亮为辅，避免窄边光圈
 */
const GLOW_LAYERS = [
  { scale: 1.018, wide: 0.022, edge: 0.006 },
  { scale: 1.036, wide: 0.018, edge: 0.0045 },
  { scale: 1.058, wide: 0.014, edge: 0.0032 },
  { scale: 1.084, wide: 0.011, edge: 0.0022 },
  { scale: 1.115, wide: 0.0085, edge: 0.0015 },
  { scale: 1.15, wide: 0.0065, edge: 0.001 },
  { scale: 1.19, wide: 0.0048, edge: 0.0007 },
  { scale: 1.24, wide: 0.0035, edge: 0.0005 },
  { scale: 1.3, wide: 0.0025, edge: 0.00035 },
  { scale: 1.36, wide: 0.0018, edge: 0.00025 },
  { scale: 1.44, wide: 0.0012, edge: 0.00015 },
  { scale: 1.54, wide: 0.0008, edge: 0.0001 },
];

const ATMOSPHERE_VERTEX = `
varying vec3 vNormal;
void main() {
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const ATMOSPHERE_FRAGMENT = `
uniform vec3 glowColor;
uniform float wideStrength;
uniform float edgeStrength;
varying vec3 vNormal;
void main() {
  float viewDot = clamp(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0, 1.0);
  float rim = 1.0 - viewDot;
  float wide = pow(rim, 0.06) * wideStrength;
  float edge = pow(smoothstep(0.35, 1.0, rim), 2.8) * edgeStrength;
  float alpha = wide + edge;
  gl_FragColor = vec4(glowColor, alpha);
}
`;

function createGlowLayer(color, layer) {
  const geometry = new THREE.SphereGeometry(GLOBE_RADIUS * layer.scale, 72, 72);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Color(color) },
      wideStrength: { value: layer.wide },
      edgeStrength: { value: layer.edge },
    },
    vertexShader: ATMOSPHERE_VERTEX,
    fragmentShader: ATMOSPHERE_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 2;
  return mesh;
}

export function createRimAtmosphereGroup(color) {
  const group = new THREE.Group();
  group.name = 'globe-rim-atmosphere';

  GLOW_LAYERS.forEach((layer) => {
    group.add(createGlowLayer(color, layer));
  });

  return group;
}

export function updateRimAtmosphereGroup(group, color) {
  if (!group) {
    return;
  }

  group.children.forEach((mesh, index) => {
    const layer = GLOW_LAYERS[index];
    if (!layer || !mesh.material?.uniforms) {
      return;
    }

    mesh.material.uniforms.glowColor.value.set(color);
    mesh.material.uniforms.wideStrength.value = layer.wide;
    mesh.material.uniforms.edgeStrength.value = layer.edge;
  });
}

export function disposeRimAtmosphereGroup(group) {
  if (!group) {
    return;
  }

  group.traverse((child) => {
    if (child.isMesh) {
      child.geometry?.dispose?.();
      child.material?.dispose?.();
    }
  });
}
