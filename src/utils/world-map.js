import config from '@/config';
import CODE_MAPS, { countryCodeMapping, aliasMapping } from '@/data/code-maps';

export const ALIAS_CODE = {
  ...aliasMapping,
  ...countryCodeMapping,
};

export const alias2code = (code) => ALIAS_CODE[code];

export const locationCode2Info = (code) => {
  const maps = {
    ...CODE_MAPS,
    ...(config.nazhua.customCodeMap || {}),
  };
  let info = maps[code];
  const aliasCode = aliasMapping[code];
  if (!info && aliasCode) {
    info = maps[aliasCode];
  }
  return info;
};

export const count2size = (count) => {
  if (count < 3) return 4;
  if (count < 5) return 6;
  return 8;
};

export function findIntersectingGroups(coordinates) {
  const groups = {};
  coordinates.forEach((coordinate, index) => {
    const intersects = [];
    const n = -2;
    coordinates.forEach((otherCoordinate, otherIndex) => {
      if (index !== otherIndex) {
        if (
          coordinate.topLeft.top - otherCoordinate.bottomRight.top < n
          && coordinate.topLeft.left - otherCoordinate.bottomRight.left < n
          && coordinate.bottomRight.top - otherCoordinate.topLeft.top > -n
          && coordinate.bottomRight.left - otherCoordinate.topLeft.left > -n
        ) {
          intersects.push(otherCoordinate);
        }
      }
    });
    if (intersects.length > 0) {
      groups[coordinate.key] = intersects;
    }
  });
  return groups;
}

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function clusterLocations(locations, thresholdKm = 250) {
  if (!Array.isArray(locations) || locations.length < 2) {
    return locations;
  }

  let clusters = locations.map((location) => ({
    ...location,
    codes: [location.code],
  }));

  while (clusters.length > 1) {
    let minDistance = Infinity;
    let pair = null;

    for (let i = 0; i < clusters.length; i += 1) {
      for (let j = i + 1; j < clusters.length; j += 1) {
        const distance = haversineDistanceKm(
          clusters[i].lat,
          clusters[i].lng,
          clusters[j].lat,
          clusters[j].lng,
        );
        if (distance < minDistance) {
          minDistance = distance;
          pair = [i, j];
        }
      }
    }

    if (!pair || minDistance > thresholdKm) {
      break;
    }

    const [i, j] = pair;
    const a = clusters[i];
    const b = clusters[j];
    const totalServers = a.servers.length + b.servers.length;
    const weightA = a.servers.length / totalServers;
    const weightB = b.servers.length / totalServers;
    const onlineServers = a.servers.filter((s) => s.online === 1)
      .concat(b.servers.filter((s) => s.online === 1));

    const merged = {
      key: [a.key, b.key].sort().join(','),
      lat: a.lat * weightA + b.lat * weightB,
      lng: a.lng * weightA + b.lng * weightB,
      code: a.code,
      codes: [...a.codes, ...b.codes],
      label: [a.label, b.label].filter(Boolean).join(' / '),
      servers: [...a.servers, ...b.servers],
      hasOnline: onlineServers.length > 0,
    };

    clusters = clusters.filter((_, idx) => idx !== i && idx !== j);
    clusters.push(merged);
  }

  return clusters;
}
