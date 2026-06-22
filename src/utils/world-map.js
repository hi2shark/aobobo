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
    ...(config.aobobo.customCodeMap || {}),
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

function parseLatLng(value) {
  if (Array.isArray(value) && value.length >= 2) {
    const lat = Number(value[0]);
    const lng = Number(value[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  }
  if (typeof value === 'string') {
    const parts = value.split(/[,，\s]+/).filter(Boolean);
    if (parts.length >= 2) {
      const lat = Number(parts[0]);
      const lng = Number(parts[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng };
      }
    }
  }
  return null;
}

/**
 * 解析单台服务器的位置信息
 * 优先级：
 * 1. customData.latlng 或 customData.lat + customData.lng（手动坐标）
 * 2. customData.location（位置代码）
 * 3. Host.CountryCode（国家代码）
 */
export function resolveServerLocation(server) {
  const customData = server?.PublicNote?.customData || {};

  // 手动坐标
  let manualLatLng = null;
  if (customData.latlng !== undefined) {
    manualLatLng = parseLatLng(customData.latlng);
  } else if (
    customData.lat !== undefined
    && customData.lng !== undefined
  ) {
    const lat = Number(customData.lat);
    const lng = Number(customData.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      manualLatLng = { lat, lng };
    }
  }

  if (manualLatLng) {
    const aliasCode = customData.location || '';
    const code = alias2code(aliasCode) || aliasCode || `${manualLatLng.lat},${manualLatLng.lng}`;
    const mapInfo = aliasCode ? locationCode2Info(code) : null;
    return {
      code,
      aliasCode,
      lat: manualLatLng.lat,
      lng: manualLatLng.lng,
      name: customData.locationLabel || mapInfo?.name || aliasCode || '自定义位置',
      country: mapInfo?.country || '',
      source: 'manual',
    };
  }

  // 位置代码 / 国家代码
  let aliasCode;
  if (customData.location) {
    aliasCode = customData.location;
  } else if (server?.Host?.CountryCode) {
    aliasCode = server.Host.CountryCode.toUpperCase();
  }
  if (!aliasCode) {
    return null;
  }
  const code = alias2code(aliasCode) || aliasCode;
  const mapInfo = locationCode2Info(code);
  if (!mapInfo || !Number.isFinite(mapInfo.lat) || !Number.isFinite(mapInfo.lng)) {
    return null;
  }
  return {
    code,
    aliasCode,
    lat: mapInfo.lat,
    lng: mapInfo.lng,
    name: mapInfo.name,
    country: mapInfo.country,
    source: 'code',
  };
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
      name: a.name || b.name || '',
      country: a.country === b.country ? a.country : (a.country || b.country || ''),
      aliasCode: a.aliasCode || b.aliasCode || '',
      servers: [...a.servers, ...b.servers],
      hasOnline: onlineServers.length > 0,
    };

    clusters = clusters.filter((_, idx) => idx !== i && idx !== j);
    clusters.push(merged);
  }

  return clusters;
}
