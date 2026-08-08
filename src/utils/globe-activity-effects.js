/**
 * Globe activity visuals:
 * - TCP/UDP: canvas particles converging into nodes (not line trails)
 * - Traffic: short radial lines3D rays for net in/out speed
 *
 * Peer endpoints are unavailable from Nezha metrics, so particle origins are
 * stable pseudo-random directions around each node (visual cue only).
 */

const CONN_TRIGGER = 10;
const CONN_FULL = 2500;
const CONN_MAX_DESKTOP = 22;
const CONN_MAX_MOBILE = 14;

const SPEED_TRIGGER_BPS = 125000; // ~1 Mbps
const SPEED_FULL_BPS = 25_000_000; // ~200 Mbps
const RAY_MAX_DESKTOP = 12;
const RAY_MAX_MOBILE = 6;

const GLOBAL_RAY_CAP_DESKTOP = 220;
const GLOBAL_RAY_CAP_MOBILE = 80;
const GLOBAL_PARTICLE_CAP_DESKTOP = 140;
const GLOBAL_PARTICLE_CAP_MOBILE = 80;

// Connection particles approach from these surface distances (degrees).
const ARC_MIN_DEG = 4.5;
const ARC_MAX_DEG = 12;
const ARC_MIN_DEG_MOBILE = 6;
const ARC_MAX_DEG_MOBILE = 14;

// Traffic rays: radial altitude (0..1 mapped by altitudeAxis).
const RAY_ALT_MIN = 0.52;
const RAY_ALT_MAX = 0.82;
const RAY_SPREAD_DEG = 0.7;
const RAY_ALT_MIN_MOBILE = 0.72;
const RAY_ALT_MAX_MOBILE = 0.98;
const RAY_SPREAD_DEG_MOBILE = 1.15;

function getLengthParams(isMobile = false) {
  if (isMobile) {
    return {
      arcMin: ARC_MIN_DEG_MOBILE,
      arcMax: ARC_MAX_DEG_MOBILE,
      rayAltMin: RAY_ALT_MIN_MOBILE,
      rayAltMax: RAY_ALT_MAX_MOBILE,
      raySpread: RAY_SPREAD_DEG_MOBILE,
    };
  }
  return {
    arcMin: ARC_MIN_DEG,
    arcMax: ARC_MAX_DEG,
    rayAltMin: RAY_ALT_MIN,
    rayAltMax: RAY_ALT_MAX,
    raySpread: RAY_SPREAD_DEG,
  };
}

export const GLOBE_ALTITUDE_ANCHOR_SERIES_ID = 'globe-effect-altitude-anchor';

const SERIES_IDS = {
  netIn: 'globe-effect-net-in',
  netOut: 'globe-effect-net-out',
};

export const GLOBE_ACTIVITY_SERIES_IDS = Object.values(SERIES_IDS);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hashString(input) {
  const text = String(input);
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) % 2147483647;
  }
  return hash || 1;
}

function mulberry32(seed) {
  let state = Math.abs(seed % 2147483647) || 1;
  return () => {
    state = (state * 48271) % 2147483647;
    return state / 2147483647;
  };
}

function normalizeLng(lng) {
  return ((lng + 540) % 360) - 180;
}

function offsetLatLng(lat, lng, bearingDeg, distanceDeg) {
  const latRad = (lat * Math.PI) / 180;
  const bearingRad = (bearingDeg * Math.PI) / 180;
  const dLat = distanceDeg * Math.cos(bearingRad);
  const cosLat = Math.max(0.2, Math.cos(latRad));
  const dLng = (distanceDeg * Math.sin(bearingRad)) / cosLat;
  return {
    lat: clamp(lat + dLat, -85, 85),
    lng: normalizeLng(lng + dLng),
  };
}

/**
 * Log-scale map: 0 below trigger, 1..maxCount up to full.
 * @param {number} value
 * @param {number} trigger
 * @param {number} full
 * @param {number} maxCount
 * @returns {number}
 */
export function mapActivityCount(value, trigger, full, maxCount) {
  const numeric = Number(value) || 0;
  if (numeric < trigger || maxCount <= 0) {
    return 0;
  }
  const ratio = Math.log(numeric / trigger) / Math.log(full / trigger);
  return clamp(Math.round(ratio * maxCount), 1, maxCount);
}

/**
 * Aggregate online-server metrics for one globe location.
 * @param {object} location
 */
export function aggregateLocationActivity(location) {
  const servers = location?.servers || [];
  let tcp = 0;
  let udp = 0;
  let netIn = 0;
  let netOut = 0;
  let hasOnline = false;

  servers.forEach((server) => {
    if (server?.online !== 1) {
      return;
    }
    hasOnline = true;
    const state = server.State || {};
    tcp += Number(state.TcpConnCount) || 0;
    udp += Number(state.UdpConnCount) || 0;
    netIn += Number(state.NetInSpeed) || 0;
    netOut += Number(state.NetOutSpeed) || 0;
  });

  return {
    key: location?.key || location?.code || `${location?.lat}-${location?.lng}`,
    lat: Number(location?.lat),
    lng: Number(location?.lng),
    tcp,
    udp,
    netIn,
    netOut,
    hasOnline,
  };
}

/**
 * Invisible scatter3D that forces globe altitudeAxis creation so traffic rays
 * can use real radial altitude instead of being flattened onto the surface.
 * @returns {object}
 */
export function createAltitudeAnchorSeries() {
  return {
    id: GLOBE_ALTITUDE_ANCHOR_SERIES_ID,
    type: 'scatter3D',
    coordinateSystem: 'globe',
    silent: true,
    symbolSize: 0,
    itemStyle: {
      opacity: 0,
    },
    data: [
      [0, 0, 0],
      [0, 0, 1],
    ],
  };
}

function buildTrafficRays(activity, direction, count, isMobile = false) {
  if (count <= 0 || !Number.isFinite(activity.lat) || !Number.isFinite(activity.lng)) {
    return [];
  }

  const { rayAltMin, rayAltMax, raySpread } = getLengthParams(isMobile);
  const rays = [];
  const rand = mulberry32(hashString(`${activity.key}:${direction}:ray`));

  for (let i = 0; i < count; i += 1) {
    const bearing = rand() * 360;
    const spread = 0.08 + rand() * raySpread;
    const tip = offsetLatLng(activity.lat, activity.lng, bearing, spread);
    const alt = rayAltMin + rand() * (rayAltMax - rayAltMin);
    const base = [activity.lng, activity.lat, 0.02];
    const mid = [
      activity.lng * 0.65 + tip.lng * 0.35,
      activity.lat * 0.65 + tip.lat * 0.35,
      alt * 0.55,
    ];
    const far = [tip.lng, tip.lat, alt];

    rays.push({
      coords: direction === 'in' ? [far, mid, base] : [base, mid, far],
    });
  }

  return rays;
}

function createRaySeries(id, color, data, theme = 'dark', isMobile = false) {
  const isLight = theme === 'light';
  let lineWidth = 1.1;
  if (isLight && isMobile) {
    lineWidth = 1.8;
  } else if (isLight) {
    lineWidth = 1.4;
  } else if (isMobile) {
    lineWidth = 1.4;
  }

  let trailWidth = 1.8;
  if (isLight && isMobile) {
    trailWidth = 2.8;
  } else if (isLight) {
    trailWidth = 2.2;
  } else if (isMobile) {
    trailWidth = 2.4;
  }

  return {
    id,
    type: 'lines3D',
    coordinateSystem: 'globe',
    polyline: true,
    silent: true,
    blendMode: isLight ? 'source-over' : 'lighter',
    lineStyle: {
      width: lineWidth,
      color,
      opacity: isLight ? 0.38 : 0.28,
    },
    effect: {
      show: data.length > 0,
      constantSpeed: isMobile ? 26 : 22,
      trailWidth,
      trailLength: isMobile ? 0.42 : 0.36,
      trailColor: color,
      trailOpacity: isLight ? 0.85 : 0.8,
      spotIntensity: 4,
    },
    data,
  };
}

function emptyTrafficSeries(colors, theme = 'dark', isMobile = false) {
  return [
    createRaySeries(SERIES_IDS.netIn, colors.netIn, [], theme, isMobile),
    createRaySeries(SERIES_IDS.netOut, colors.netOut, [], theme, isMobile),
  ];
}

function planLocationEffects(locations, isMobile) {
  const connMax = isMobile ? CONN_MAX_MOBILE : CONN_MAX_DESKTOP;
  const rayMax = isMobile ? RAY_MAX_MOBILE : RAY_MAX_DESKTOP;

  return locations
    .map((location) => aggregateLocationActivity(location))
    .filter((activity) => (
      activity.hasOnline
      && Number.isFinite(activity.lat)
      && Number.isFinite(activity.lng)
    ))
    .map((activity) => {
      const tcpCount = mapActivityCount(activity.tcp, CONN_TRIGGER, CONN_FULL, connMax);
      const udpCount = mapActivityCount(activity.udp, CONN_TRIGGER, CONN_FULL, connMax);
      const netInCount = mapActivityCount(
        activity.netIn,
        SPEED_TRIGGER_BPS,
        SPEED_FULL_BPS,
        rayMax,
      );
      const netOutCount = mapActivityCount(
        activity.netOut,
        SPEED_TRIGGER_BPS,
        SPEED_FULL_BPS,
        rayMax,
      );
      const score = activity.tcp + activity.udp
        + (activity.netIn / SPEED_TRIGGER_BPS)
        + (activity.netOut / SPEED_TRIGGER_BPS);

      return {
        activity,
        tcpCount,
        udpCount,
        netInCount,
        netOutCount,
        connTotal: tcpCount + udpCount,
        rayTotal: netInCount + netOutCount,
        score,
      };
    })
    .filter((item) => item.connTotal > 0 || item.rayTotal > 0)
    .sort((a, b) => b.score - a.score);
}

function scaleCounts(item, remaining, keys) {
  const next = { ...item };
  const need = keys.reduce((sum, key) => sum + next[key], 0);
  if (need <= remaining) {
    return next;
  }
  const scale = remaining / need;
  keys.forEach((key) => {
    next[key] = Math.floor(next[key] * scale);
  });
  const used = keys.reduce((sum, key) => sum + next[key], 0);
  if (used === 0 && remaining > 0) {
    const strongest = keys.find((key) => item[key] > 0);
    if (strongest) {
      next[strongest] = 1;
    }
  }
  return next;
}

/**
 * Build traffic-only lines3D series (net in/out rays).
 */
export function buildActivitySeriesOptions({
  locations,
  colors,
  isMobile = false,
  enabled = true,
  theme = 'dark',
} = {}) {
  const isLight = theme === 'light';
  const palette = {
    tcp: colors?.tcp || (isLight ? '#5eb3c9' : '#5eead4'),
    udp: colors?.udp || (isLight ? '#a78bfa' : '#f0abfc'),
    netIn: colors?.netIn || (isLight ? '#f0a07a' : '#f5b199'),
    netOut: colors?.netOut || (isLight ? '#8fa2f5' : '#89c3eb'),
  };

  if (!enabled || !Array.isArray(locations) || locations.length === 0) {
    return emptyTrafficSeries(palette, theme, isMobile);
  }

  const rayCap = isMobile ? GLOBAL_RAY_CAP_MOBILE : GLOBAL_RAY_CAP_DESKTOP;
  const planned = planLocationEffects(locations, isMobile);
  let remaining = rayCap;
  const netInData = [];
  const netOutData = [];

  planned.forEach((item) => {
    if (remaining <= 0 || item.rayTotal <= 0) {
      return;
    }
    const scaled = scaleCounts(item, remaining, ['netInCount', 'netOutCount']);
    netInData.push(...buildTrafficRays(item.activity, 'in', scaled.netInCount, isMobile));
    netOutData.push(...buildTrafficRays(item.activity, 'out', scaled.netOutCount, isMobile));
    remaining -= scaled.netInCount + scaled.netOutCount;
  });

  return [
    createRaySeries(SERIES_IDS.netIn, palette.netIn, netInData, theme, isMobile),
    createRaySeries(SERIES_IDS.netOut, palette.netOut, netOutData, theme, isMobile),
  ];
}

function easeOutQuad(t) {
  const x = clamp(t, 0, 1);
  return 1 - (1 - x) * (1 - x);
}

function bezierLat(start, ctrl, dest, t) {
  const u = 1 - t;
  return (u * u * start) + (2 * u * t * ctrl) + (t * t * dest);
}

function bezierLng(start, ctrl, dest, t) {
  const ctrlAbs = start + normalizeLng(ctrl - start);
  const destAbs = start + normalizeLng(dest - start);
  const u = 1 - t;
  return normalizeLng((u * u * start) + (2 * u * t * ctrlAbs) + (t * t * destAbs));
}

function pickApproachBearing(rand, lastBearing) {
  let bearing = rand() * 360;
  if (lastBearing == null || Number.isNaN(lastBearing)) {
    return bearing;
  }
  // Avoid reusing nearly the same inbound direction as the previous life.
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const delta = Math.abs(normalizeLng(bearing - lastBearing));
    if (delta >= 48 && delta <= 312) {
      return bearing;
    }
    bearing = rand() * 360;
  }
  return normalizeLng(lastBearing + 90 + rand() * 180);
}

function assignParticlePath(particle, rand, isMobile) {
  const { arcMin, arcMax } = getLengthParams(isMobile);
  const bearing = pickApproachBearing(rand, particle.lastBearing);
  const distance = arcMin + rand() * (arcMax - arcMin);
  const start = offsetLatLng(particle.destLat, particle.destLng, bearing, distance);

  const dLat = particle.destLat - start.lat;
  const dLng = normalizeLng(particle.destLng - start.lng);
  const len = Math.hypot(dLat, dLng) || 1;
  const side = rand() < 0.5 ? 1 : -1;
  // Lateral bend so paths are arcs, not identical radial lines.
  const bend = (0.18 + rand() * 0.62) * side * len;
  const midLat = start.lat + dLat * (0.35 + rand() * 0.3);
  const midLng = normalizeLng(start.lng + dLng * (0.35 + rand() * 0.3));

  particle.startLat = start.lat;
  particle.startLng = start.lng;
  particle.ctrlLat = midLat + (-dLng / len) * bend;
  particle.ctrlLng = normalizeLng(midLng + (dLat / len) * bend);
  particle.lat = start.lat;
  particle.lng = start.lng;
  particle.t = 0;
  particle.lastBearing = bearing;
  // Long enough that a full approach is visible before respawn.
  particle.duration = 2.6 + rand() * 3.2;
  particle.size = isMobile ? (1.4 + rand() * 0.8) : (1.1 + rand() * 0.7);
}

/**
 * Build a mutable pool of connection particles that converge into nodes.
 * @returns {Array<object>}
 */
export function buildConnectionParticlePool({
  locations,
  isMobile = false,
  enabled = true,
} = {}) {
  if (!enabled || !Array.isArray(locations) || locations.length === 0) {
    return [];
  }

  const particleCap = isMobile ? GLOBAL_PARTICLE_CAP_MOBILE : GLOBAL_PARTICLE_CAP_DESKTOP;
  const planned = planLocationEffects(locations, isMobile);
  let remaining = particleCap;
  const particles = [];
  // Fresh salt each rebuild so paths are not identical across pool rebuilds.
  const poolSalt = `${Date.now().toString(36)}:${Math.floor(Math.random() * 1e9)}`;

  planned.forEach((item) => {
    if (remaining <= 0 || item.connTotal <= 0) {
      return;
    }
    const scaled = scaleCounts(item, remaining, ['tcpCount', 'udpCount']);
    ['tcp', 'udp'].forEach((protocol) => {
      const count = protocol === 'tcp' ? scaled.tcpCount : scaled.udpCount;
      for (let i = 0; i < count; i += 1) {
        const rand = mulberry32(hashString(`${item.activity.key}:${protocol}:p:${i}:${poolSalt}`));
        const particle = {
          protocol,
          destLat: item.activity.lat,
          destLng: item.activity.lng,
          startLat: item.activity.lat,
          startLng: item.activity.lng,
          ctrlLat: item.activity.lat,
          ctrlLng: item.activity.lng,
          lat: item.activity.lat,
          lng: item.activity.lng,
          lastBearing: null,
          t: 0,
          duration: 1.8,
          size: 1.4,
        };
        assignParticlePath(particle, rand, isMobile);
        // Stagger so the cloud is already in motion (keep clear of the fade-out tail).
        particle.t = rand() * 0.82;
        const eased = easeOutQuad(particle.t);
        particle.lat = bezierLat(particle.startLat, particle.ctrlLat, particle.destLat, eased);
        particle.lng = bezierLng(particle.startLng, particle.ctrlLng, particle.destLng, eased);
        particles.push(particle);
      }
    });
    remaining -= scaled.tcpCount + scaled.udpCount;
  });

  return particles;
}

/**
 * Advance particles toward their destinations; respawn on arrival.
 * @param {Array<object>} particles
 * @param {number} dtSeconds
 * @param {boolean} [isMobile]
 */
export function stepConnectionParticles(particles, dtSeconds, isMobile = false) {
  if (!Array.isArray(particles) || particles.length === 0 || dtSeconds <= 0) {
    return;
  }

  const dt = Math.min(dtSeconds, 0.05);
  particles.forEach((particle) => {
    particle.t += dt / particle.duration;
    if (particle.t >= 1) {
      // True random each life — avoids looping the same few inbound tracks.
      assignParticlePath(particle, Math.random, isMobile);
      return;
    }
    // Ease-out: linger near the node so the approach finishes before fade/respawn.
    const eased = easeOutQuad(particle.t);
    particle.lat = bezierLat(particle.startLat, particle.ctrlLat, particle.destLat, eased);
    particle.lng = bezierLng(particle.startLng, particle.ctrlLng, particle.destLng, eased);
  });
}

/**
 * Signature based on planned particle counts (not raw TCP/UDP), so small WS
 * jitter that does not change visible density will not rebuild the pool mid-flight.
 * @param {Array<object>} locations
 * @param {boolean} [isMobile]
 * @returns {string}
 */
export function buildConnectionParticleCountSignature(locations, isMobile = false) {
  if (!Array.isArray(locations) || locations.length === 0) {
    return 'empty';
  }
  const planned = planLocationEffects(locations, isMobile);
  const particleCap = isMobile ? GLOBAL_PARTICLE_CAP_MOBILE : GLOBAL_PARTICLE_CAP_DESKTOP;
  let remaining = particleCap;
  return planned.map((item) => {
    if (remaining <= 0 || item.connTotal <= 0) {
      return `${item.activity.key}:0:0`;
    }
    const scaled = scaleCounts(item, remaining, ['tcpCount', 'udpCount']);
    remaining -= scaled.tcpCount + scaled.udpCount;
    return `${item.activity.key}:${scaled.tcpCount}:${scaled.udpCount}`;
  }).join('|');
}

/**
 * @param {string | undefined | null} id
 * @returns {boolean}
 */
export function isGlobeActivitySeriesId(id) {
  return typeof id === 'string' && id.startsWith('globe-effect-');
}

export default buildActivitySeriesOptions;
