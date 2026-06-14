import * as THREE from 'three';

const GLOBE_RADIUS = 100;

/** 内侧菲涅尔：更贴近球面，并拉长过渡 */
const INNER_FRESNEL = {
  scale: 1.0008,
  strength: 0.55,
};

/** 外侧辉光：内移并拉长，形成沿球面延伸的轮廓光 */
const GLOW_LAYERS = [
  { scale: 1.003, wide: 0.035, edge: 0.007 },
  { scale: 1.011, wide: 0.026, edge: 0.0048 },
  { scale: 1.023, wide: 0.018, edge: 0.003 },
  { scale: 1.039, wide: 0.011, edge: 0.0016 },
  { scale: 1.060, wide: 0.0065, edge: 0.0009 },
  { scale: 1.088, wide: 0.0035, edge: 0.00045 },
  { scale: 1.120, wide: 0.0018, edge: 0.00022 },
  { scale: 1.135, wide: 0.0012, edge: 0.00015 },
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
  float alpha = pow(smoothstep(0.05, 0.92, rim), 3.0) * fresnelStrength;
  gl_FragColor = vec4(glowColor, alpha);
}
`;

function createInnerFresnelLayer(color, strengthScale = 1) {
  const geometry = new THREE.SphereGeometry(GLOBE_RADIUS * INNER_FRESNEL.scale, 72, 72);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Color(color) },
      fresnelStrength: { value: INNER_FRESNEL.strength * strengthScale },
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

function createGlowLayer(color, layer, intensityScale = 1) {
  const geometry = new THREE.SphereGeometry(GLOBE_RADIUS * layer.scale, 72, 72);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Color(color) },
      wideStrength: { value: layer.wide * intensityScale },
      edgeStrength: { value: layer.edge * intensityScale },
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

export function createRimAtmosphereGroup(color, options = {}) {
  const { innerStrengthScale = 1, glowIntensityScale = 1 } = options;
  const group = new THREE.Group();
  group.name = 'globe-rim-atmosphere';

  group.add(createInnerFresnelLayer(color, innerStrengthScale));
  GLOW_LAYERS.forEach((layer) => {
    group.add(createGlowLayer(color, layer, glowIntensityScale));
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
