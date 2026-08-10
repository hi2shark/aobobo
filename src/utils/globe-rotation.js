// Persists homepage globe auto-rotate preference (on/off + speed).

export const GLOBE_ROTATION_STORAGE_KEY = 'aobobo_globe_rotation';
export const GLOBE_ROTATION_STORAGE_VERSION = 1;

export const DEFAULT_AUTO_ROTATE = true;
export const DEFAULT_ROTATE_SPEED = 0.5;
export const MIN_ROTATE_SPEED = 0.2;
export const MAX_ROTATE_SPEED = 2;
export const ROTATE_SPEED_STEP = 0.1;

function clampSpeed(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_ROTATE_SPEED;
  }
  const clamped = Math.min(MAX_ROTATE_SPEED, Math.max(MIN_ROTATE_SPEED, numeric));
  return Math.round(clamped / ROTATE_SPEED_STEP) * ROTATE_SPEED_STEP;
}

/**
 * @returns {{ autoRotate: boolean, rotateSpeed: number, showConnParticles: boolean, showNetRays: boolean }}
 */
export function loadGlobeRotation() {
  if (typeof window === 'undefined') {
    return {
      autoRotate: DEFAULT_AUTO_ROTATE,
      rotateSpeed: DEFAULT_ROTATE_SPEED,
      showConnParticles: true,
      showNetRays: true,
    };
  }

  try {
    const raw = window.localStorage.getItem(GLOBE_ROTATION_STORAGE_KEY);
    if (!raw) {
      return {
        autoRotate: DEFAULT_AUTO_ROTATE,
        rotateSpeed: DEFAULT_ROTATE_SPEED,
        showConnParticles: true,
        showNetRays: true,
      };
    }
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== GLOBE_ROTATION_STORAGE_VERSION) {
      return {
        autoRotate: DEFAULT_AUTO_ROTATE,
        rotateSpeed: DEFAULT_ROTATE_SPEED,
        showConnParticles: true,
        showNetRays: true,
      };
    }
    return {
      autoRotate: parsed.autoRotate !== false,
      rotateSpeed: clampSpeed(parsed.rotateSpeed),
      showConnParticles: parsed.showConnParticles !== false,
      showNetRays: parsed.showNetRays !== false,
    };
  } catch {
    return {
      autoRotate: DEFAULT_AUTO_ROTATE,
      rotateSpeed: DEFAULT_ROTATE_SPEED,
      showConnParticles: true,
      showNetRays: true,
    };
  }
}

/**
 * @param {{ autoRotate?: boolean, rotateSpeed?: number, showConnParticles?: boolean, showNetRays?: boolean }} prefs
 */
export function persistGlobeRotation(prefs) {
  if (typeof window === 'undefined' || !prefs) {
    return;
  }

  try {
    window.localStorage.setItem(
      GLOBE_ROTATION_STORAGE_KEY,
      JSON.stringify({
        v: GLOBE_ROTATION_STORAGE_VERSION,
        autoRotate: prefs.autoRotate !== false,
        rotateSpeed: clampSpeed(prefs.rotateSpeed),
        showConnParticles: prefs.showConnParticles !== false,
        showNetRays: prefs.showNetRays !== false,
      }),
    );
  } catch {
    // ignore storage write failures
  }
}

export function clampRotateSpeed(value) {
  return clampSpeed(value);
}
