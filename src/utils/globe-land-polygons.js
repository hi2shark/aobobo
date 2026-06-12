import worldLandData from '@/assets/globe/world-land.json';

let cachedPolygons = null;

/**
 * 将 MultiPolygon 拆为独立 Polygon，供 globe.gl 矢量层渲染。
 * 放大时由曲面三角剖分保持海岸清晰，不依赖纹理分辨率。
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
