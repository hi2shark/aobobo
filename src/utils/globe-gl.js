// Helpers to detect WebGL context loss on echarts-gl globes.
//
// echarts-gl renders to an offscreen canvas whose WebGL context lives at
// chart → component views → globe view → viewGL → layer → renderer. Mobile
// browsers drop that context after backgrounding / under memory pressure, and
// the only reliable recovery is to recreate the echarts instance (a plain
// setOption cannot re-upload textures on a dead context).
//
// These helpers centralise the internal-path traversal so both the main globe
// and the server-detail mini globe can share it. Everything is guarded so a
// future echarts-gl internals change degrades to a safe no-op instead of
// throwing.

/**
 * Resolve the WebGL rendering context behind an echarts-gl chart instance.
 * @param {object | null | undefined} chart echarts instance
 * @returns {WebGLRenderingContext | WebGL2RenderingContext | null}
 */
export function getGlobeGLContext(chart) {
  if (!chart) {
    return null;
  }
  try {
    const views = chart._componentsViews;
    if (!Array.isArray(views)) {
      return null;
    }
    return views
      .map((view) => view?.viewGL?.layer?.renderer?.gl)
      .find((gl) => Boolean(gl)) || null;
  } catch {
    return null;
  }
}

/**
 * Resolve the offscreen GL canvas of an echarts-gl chart instance (used to
 * attach webglcontextlost / webglcontextrestored listeners).
 * @param {object | null | undefined} chart echarts instance
 * @returns {HTMLCanvasElement | null}
 */
export function getGlobeGLCanvas(chart) {
  if (!chart) {
    return null;
  }
  try {
    const views = chart._componentsViews;
    if (!Array.isArray(views)) {
      return null;
    }
    return views
      .map((view) => view?.viewGL?.layer?.renderer?.canvas)
      .find((canvas) => Boolean(canvas)) || null;
  } catch {
    return null;
  }
}

/**
 * Whether the globe's WebGL context has been lost.
 * @param {object | null | undefined} chart echarts instance
 * @returns {boolean}
 */
export function isGlobeGLContextLost(chart) {
  const gl = getGlobeGLContext(chart);
  return Boolean(gl && typeof gl.isContextLost === 'function' && gl.isContextLost());
}
