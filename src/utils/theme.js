export const THEME_STORAGE_KEY = 'aobobo-theme-mode';

export const THEME_MODES = Object.freeze({
  AUTO: 'auto',
  LIGHT: 'light',
  DARK: 'dark',
});

export const RESOLVED_THEMES = Object.freeze({
  LIGHT: 'light',
  DARK: 'dark',
});

export function normalizeThemeMode(mode) {
  if (Object.values(THEME_MODES).includes(mode)) {
    return mode;
  }
  return THEME_MODES.AUTO;
}

export function getSystemTheme() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return RESOLVED_THEMES.DARK;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? RESOLVED_THEMES.DARK
    : RESOLVED_THEMES.LIGHT;
}

export function resolveTheme(mode) {
  if (mode === THEME_MODES.DARK) {
    return RESOLVED_THEMES.DARK;
  }
  if (mode === THEME_MODES.LIGHT) {
    return RESOLVED_THEMES.LIGHT;
  }
  return getSystemTheme();
}

export function loadThemeMode() {
  if (typeof window === 'undefined') {
    return THEME_MODES.AUTO;
  }
  try {
    return normalizeThemeMode(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return THEME_MODES.AUTO;
  }
}

export function persistThemeMode(mode) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, normalizeThemeMode(mode));
  } catch {
    // ignore storage write failures
  }
}

export function applyResolvedTheme(theme) {
  if (typeof document === 'undefined') {
    return;
  }
  document.documentElement.dataset.theme = theme;
}

export function getThemeMediaQuery() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null;
  }
  return window.matchMedia('(prefers-color-scheme: dark)');
}
