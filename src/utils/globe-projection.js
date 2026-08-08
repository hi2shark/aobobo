function multiplyMat4ByVec4(matrix, vector) {
  const x = vector[0];
  const y = vector[1];
  const z = vector[2];
  const w = vector[3] ?? 1;

  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12] * w,
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13] * w,
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14] * w,
    matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15] * w,
  ];
}

function normalizeClip(clip) {
  const w = clip[3];
  if (w === 0) {
    return null;
  }
  return clip.map((v) => v / w);
}

/**
 * Snapshot globe camera/matrices once per frame. Call this once, then project
 * many points with projectLatLngWithFrame — avoid camera.update() per particle.
 * @param {object} chart
 * @param {{ width: number, height: number }} containerRect
 * @returns {object | null}
 */
export function createGlobeProjectionFrame(chart, containerRect) {
  if (!chart || !containerRect) {
    return null;
  }

  const globeModel = chart.getModel?.().getComponent?.('globe');
  const coordSys = globeModel?.coordinateSystem;
  if (!coordSys || !coordSys.viewGL) {
    return null;
  }

  const { camera } = coordSys.viewGL;
  camera.update();

  const cameraWorld = camera.worldTransform.array;
  const cameraPosition = [cameraWorld[12], cameraWorld[13], cameraWorld[14]];
  const cameraDistance = Math.sqrt(
    cameraPosition[0] ** 2 + cameraPosition[1] ** 2 + cameraPosition[2] ** 2,
  );

  return {
    coordSys,
    viewMatrix: camera.viewMatrix.array,
    projectionMatrix: camera.projectionMatrix.array,
    cameraPosition,
    cameraDistance,
    width: containerRect.width,
    height: containerRect.height,
  };
}

/**
 * @param {object} frame
 * @param {number} lng
 * @param {number} lat
 * @param {number} [altitude]
 * @returns {{ x: number, y: number, visible: boolean } | null}
 */
export function projectLatLngWithFrame(frame, lng, lat, altitude = 0) {
  if (!frame) {
    return null;
  }

  const world = frame.coordSys.dataToPoint([lng, lat, altitude]);
  const surfaceRadius = Math.sqrt(world[0] ** 2 + world[1] ** 2 + world[2] ** 2);
  const facing = (world[0] * frame.cameraPosition[0]
    + world[1] * frame.cameraPosition[1]
    + world[2] * frame.cameraPosition[2])
    / (surfaceRadius * frame.cameraDistance);

  const horizonThreshold = frame.cameraDistance > 0 ? surfaceRadius / frame.cameraDistance : 0;
  const VISIBLE_FACING_THRESHOLD = Math.min(1, horizonThreshold + 0.005);

  const view = multiplyMat4ByVec4(frame.viewMatrix, world);
  const clip = multiplyMat4ByVec4(frame.projectionMatrix, view);

  if (clip[3] <= 0) {
    return null;
  }

  const ndc = normalizeClip(clip);
  if (!ndc || ndc[2] < -1 || ndc[2] > 1) {
    return null;
  }

  const x = (ndc[0] * 0.5 + 0.5) * frame.width;
  const y = (1 - (ndc[1] * 0.5 + 0.5)) * frame.height;

  return {
    x,
    y,
    visible: facing > VISIBLE_FACING_THRESHOLD,
  };
}

export function projectLatLngToScreen(chart, containerRect, lng, lat, altitude = 0) {
  const frame = createGlobeProjectionFrame(chart, containerRect);
  if (!frame) {
    return null;
  }
  return projectLatLngWithFrame(frame, lng, lat, altitude);
}

export default projectLatLngToScreen;
