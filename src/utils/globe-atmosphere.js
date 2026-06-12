import * as THREE from 'three';

const GLOBE_RADIUS = 100;

/** 内侧菲涅尔：细窄柔边，避免 Bloom 后出现硬光圈 */
const INNER_FRESNEL = {
  scale: 1.002,
  strength: 0.30,
};

/** 外侧辉光：宽域柔光为主，边缘提亮极弱 */
const GLOW_LAYERS = [
  { scale: 1.015, wide: 0.024, edge: 0.005 },
  { scale: 1.04, wide: 0.015, edge: 0.0025 },
  { scale: 1.08, wide: 0.008, edge: 0.001 },
  { scale: 1.14, wide: 0.004, edge: 0.0003 },
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
  float wide = pow(rim, 0.12) * wideStrength;
  float edge = pow(smoothstep(0.58, 1.0, rim), 3.6) * edgeStrength;
  float alpha = wide + edge;
  gl_FragColor = vec4(glowColor, alpha);
}
`;

const INNER_FRESNEL_FRAGMENT = `
uniform vec3 glowColor;
uniform float fresnelStrength;
varying vec3 vNormal;
void main() {
  float viewDot = clamp(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0, 1.0);
  float rim = 1.0 - viewDot;
  float alpha = pow(smoothstep(0.2, 0.92, rim), 3.0) * fresnelStrength;
  gl_FragColor = vec4(glowColor, alpha);
}
`;

function createInnerFresnelLayer(color) {
  const geometry = new THREE.SphereGeometry(GLOBE_RADIUS * INNER_FRESNEL.scale, 72, 72);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Color(color) },
      fresnelStrength: { value: INNER_FRESNEL.strength },
    },
    vertexShader: ATMOSPHERE_VERTEX,
    fragmentShader: INNER_FRESNEL_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'globe-inner-fresnel';
  mesh.renderOrder = 1;
  return mesh;
}

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

function updateAtmosphereColor(group, color) {
  if (!group) {
    return;
  }

  group.children.forEach((mesh) => {
    if (mesh.material?.uniforms?.glowColor) {
      mesh.material.uniforms.glowColor.value.set(color);
    }
  });
}

export function createRimAtmosphereGroup(color) {
  const group = new THREE.Group();
  group.name = 'globe-rim-atmosphere';

  group.add(createInnerFresnelLayer(color));
  GLOW_LAYERS.forEach((layer) => {
    group.add(createGlowLayer(color, layer));
  });

  return group;
}

export function updateRimAtmosphereGroup(group, color) {
  updateAtmosphereColor(group, color);
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
