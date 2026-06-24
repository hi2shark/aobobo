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

export function projectLatLngToScreen(chart, containerRect, lng, lat, altitude = 0) {
  if (!chart || !containerRect) {
    return null;
  }

  const globeModel = chart.getModel?.().getComponent?.('globe');
  const coordSys = globeModel?.coordinateSystem;
  if (!coordSys || !coordSys.viewGL) {
    return null;
  }

  const world = coordSys.dataToPoint([lng, lat, altitude]);
  const { camera } = coordSys.viewGL;
  camera.update();

  const viewMatrix = camera.viewMatrix.array;
  const projectionMatrix = camera.projectionMatrix.array;
  const cameraWorld = camera.worldTransform.array;
  const cameraPosition = [cameraWorld[12], cameraWorld[13], cameraWorld[14]];

  const surfaceRadius = Math.sqrt(world[0] ** 2 + world[1] ** 2 + world[2] ** 2);
  const cameraDistance = Math.sqrt(
    cameraPosition[0] ** 2 + cameraPosition[1] ** 2 + cameraPosition[2] ** 2,
  );
  const facing = (world[0] * cameraPosition[0]
    + world[1] * cameraPosition[1]
    + world[2] * cameraPosition[2])
    / (surfaceRadius * cameraDistance);

  // Keep markers hidden until they are clearly in front of the visible horizon.
  // `surfaceRadius / cameraDistance` is the cosine of the horizon angle for a
  // surface point; add a tiny angular margin so the marker billboard does not
  // clip the globe limb. The margin is kept small so markers remain visible
  // near the edge even when zoomed in close.
  const horizonThreshold = cameraDistance > 0 ? surfaceRadius / cameraDistance : 0;
  const VISIBLE_FACING_THRESHOLD = Math.min(1, horizonThreshold + 0.005);

  const view = multiplyMat4ByVec4(viewMatrix, world);
  const clip = multiplyMat4ByVec4(projectionMatrix, view);

  if (clip[3] <= 0) {
    return null;
  }

  const ndc = normalizeClip(clip);
  if (!ndc || ndc[2] < -1 || ndc[2] > 1) {
    return null;
  }

  const x = (ndc[0] * 0.5 + 0.5) * containerRect.width;
  const y = (1 - (ndc[1] * 0.5 + 0.5)) * containerRect.height;

  return {
    x,
    y,
    visible: facing > VISIBLE_FACING_THRESHOLD,
  };
}

export default projectLatLngToScreen;
