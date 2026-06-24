import worldLandData from '@/assets/globe/world-land.json';

let cachedPolygons = null;

/**
 * 将 MultiPolygon 拆为独立 Polygon，供地球纹理绘制使用。
 */
export function getLandPolygonsData() {
  if (cachedPolygons) {
    return cachedPolygons;
  }

  const source = worldLandData.features[0];
  const { coordinates } = source.geometry;

  cachedPolygons = coordinates.map((polygonCoords, index) => ({
    id: index,
    geometry: {
      type: 'Polygon',
      coordinates: polygonCoords,
    },
  }));

  return cachedPolygons;
}

export default getLandPolygonsData;
