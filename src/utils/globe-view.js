// Persists the 3D globe camera state (latitude / longitude / view distance)
// across page reloads and remounts, mirroring the localStorage conventions used
// by the theme mode and monitor preferences (`aobobo-*` keys, try/catch guarded,
// SSR safe). Only the data needed to reproduce a view is stored.

export const GLOBE_VIEW_STORAGE_KEY = 'aobobo_globe_view';
export const GLOBE_VIEW_STORAGE_VERSION = 1;

// Tolerances are intentionally loose: the values come straight from the
// OrbitControl camera angles and only need to round-trip back into it.
const VALID_LAT = (v) => Number.isFinite(v) && v >= -90 && v <= 90;
const VALID_LNG = (v) => Number.isFinite(v) && v >= -180 && v <= 180;
const VALID_DISTANCE = (v) => Number.isFinite(v) && v > 0;

/**
 * Read the persisted globe view.
 * @returns {{ lat:number, lng:number, distance:number } | null}
 */
export function loadGlobeView() {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(GLOBE_VIEW_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== GLOBE_VIEW_STORAGE_VERSION) {
      return null;
    }
    const { lat, lng, distance } = parsed;
    if (!VALID_LAT(lat) || !VALID_LNG(lng) || !VALID_DISTANCE(distance)) {
      return null;
    }
    return { lat, lng, distance };
  } catch {
    return null;
  }
}

/**
 * Persist the globe view. Invalid values are ignored silently.
 * @param {{ lat:number, lng:number, distance:number }} view
 */
export function persistGlobeView(view) {
  if (typeof window === 'undefined') {
    return;
  }
  if (!view || !VALID_LAT(view.lat) || !VALID_LNG(view.lng) || !VALID_DISTANCE(view.distance)) {
    return;
  }
  try {
    window.localStorage.setItem(
      GLOBE_VIEW_STORAGE_KEY,
      JSON.stringify({
        lat: view.lat,
        lng: view.lng,
        distance: view.distance,
        v: GLOBE_VIEW_STORAGE_VERSION,
      }),
    );
  } catch {
    // ignore storage write failures (e.g. private mode / quota)
  }
}

export function clearGlobeView() {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.removeItem(GLOBE_VIEW_STORAGE_KEY);
  } catch {
    // ignore storage write failures
  }
}
