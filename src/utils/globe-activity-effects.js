/**
 * Globe activity visuals:
 * - TCP/UDP: canvas particles converging into nodes (not line trails)
 * - Traffic: fountain-style curved lines3D rays for net in/out speed
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

// Traffic rays: radial altitude (0..1 mapped by altitudeAxis) and lateral
// spread of the ray tip (degrees). Rays leave the node near-vertically then
// arc smoothly outward — a soft spray rather than straight vertical needles.
const RAY_ALT_MIN = 0.42;
const RAY_ALT_MAX = 0.72;
const RAY_SPREAD_DEG = 2.1;
const RAY_SPREAD_MIN_DEG = 0.3;
const RAY_ALT_MIN_MOBILE = 0.55;
const RAY_ALT_MAX_MOBILE = 0.85;
const RAY_SPREAD_DEG_MOBILE = 3;
const RAY_SPREAD_MIN_DEG_MOBILE = 0.4;
// Each ray's quadratic bezier is sampled into this many segments: a 3-point
// polyline renders as a kinked wire, not a curve.
const RAY_CURVE_SEGMENTS = 9;

function getLengthParams(isMobile = false) {
  if (isMobile) {
    return {
      arcMin: ARC_MIN_DEG_MOBILE,
      arcMax: ARC_MAX_DEG_MOBILE,
      rayAltMin: RAY_ALT_MIN_MOBILE,
      rayAltMax: RAY_ALT_MAX_MOBILE,
      raySpread: RAY_SPREAD_DEG_MOBILE,
      raySpreadMin: RAY_SPREAD_MIN_DEG_MOBILE,
    };
  }
  return {
    arcMin: ARC_MIN_DEG,
    arcMax: ARC_MAX_DEG,
    rayAltMin: RAY_ALT_MIN,
    rayAltMax: RAY_ALT_MAX,
    raySpread: RAY_SPREAD_DEG,
    raySpreadMin: RAY_SPREAD_MIN_DEG,
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

  const { rayAltMin, rayAltMax, raySpread, raySpreadMin } = getLengthParams(isMobile);
  const rays = [];
  const rand = mulberry32(hashString(`${activity.key}:${direction}:ray`));

  for (let i = 0; i < count; i += 1) {
    const bearing = rand() * 360;
    const spread = raySpreadMin + rand() * raySpread;
    const spreadRatio = (spread - raySpreadMin) / raySpread;
    const tip = offsetLatLng(activity.lat, activity.lng, bearing, spread);
    // Outer rays arc a little lower, like a real spray.
    const alt = (rayAltMin + rand() * (rayAltMax - rayAltMin)) * (1 - 0.28 * spreadRatio);

    // Quadratic bezier base→ctrl→tip: the control point sits mostly above the
    // node, so the ray leaves near-vertically then bends outward in one smooth
    // arc (sampled below — lines3D polyline is straight segments, not curves).
    const dLng = normalizeLng(tip.lng - activity.lng);
    const dLat = tip.lat - activity.lat;
    const lean = 0.06 + rand() * 0.14;
    const ctrlLng = activity.lng + dLng * lean;
    const ctrlLat = activity.lat + dLat * lean;
    const ctrlAlt = alt * (0.55 + rand() * 0.15);
    const tipLng = activity.lng + dLng; // unwrap before interpolating

    const coords = [];
    for (let s = 0; s <= RAY_CURVE_SEGMENTS; s += 1) {
      const t = s / RAY_CURVE_SEGMENTS;
      const u = 1 - t;
      coords.push([
        normalizeLng((u * u * activity.lng) + (2 * u * t * ctrlLng) + (t * t * tipLng)),
        (u * u * activity.lat) + (2 * u * t * ctrlLat) + (t * t * tip.lat),
        (u * u * 0.02) + (2 * u * t * ctrlAlt) + (t * t * alt),
      ]);
    }

    rays.push({
      coords: direction === 'in' ? coords.reverse() : coords,
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
      opacity: isLight ? 0.3 : 0.22,
    },
    effect: {
      show: data.length > 0,
      constantSpeed: isMobile ? 26 : 22,
      trailWidth,
      trailLength: isMobile ? 0.46 : 0.4,
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
    tcp: colors?.tcp || (isLight ? '#e08e00' : '#5eead4'),
    udp: colors?.udp || (isLight ? '#ffc44d' : '#f0abfc'),
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

function easeInQuad(t) {
  const x = clamp(t, 0, 1);
  return x * x;
}

// Decelerate into the node when converging ('in'), accelerate away from it
// when diverging ('out').
function easeParticleMotion(t, direction) {
  return direction === 'out' ? easeInQuad(t) : easeOutQuad(t);
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// Seconds for a freshly built particle to reach full brightness. Pool rebuilds
// stagger particles mid-flight, so without this they would pop in at once.
const PARTICLE_BUILD_FADE_SECONDS = 0.9;
const PARTICLE_PEAK_ALPHA = 0.92;

/**
 * Silky per-particle visuals: smoothstep fade-in after (re)spawn, then full
 * brightness until the particle actually reaches the node — the fade-out and
 * shrink only kick in over the final approach (t 0.9→1, i.e. the last ~1% of
 * the eased path), so every journey visibly completes instead of vanishing
 * just short of the marker.
 * @param {object} particle
 * @returns {{ alpha: number, scale: number }}
 */
export function getConnectionParticleVisual(particle) {
  const t = clamp(Number(particle?.t) || 0, 0, 1);
  const fadeIn = smoothstep(0.02, 0.14, t);
  const fadeOut = 1 - smoothstep(0.9, 1, t);
  const buildFade = clamp(Number(particle?.fade ?? 1) || 0, 0, 1);
  return {
    alpha: PARTICLE_PEAK_ALPHA * fadeIn * fadeOut * buildFade,
    scale: (0.75 + t * 0.25) * (1 - 0.45 * smoothstep(0.88, 1, t)),
  };
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

function assignParticlePath(particle, rand, isMobile, direction = 'in') {
  const { arcMin, arcMax } = getLengthParams(isMobile);
  const bearing = pickApproachBearing(rand, particle.lastBearing);
  const distance = arcMin + rand() * (arcMax - arcMin);
  const far = offsetLatLng(particle.nodeLat, particle.nodeLng, bearing, distance);

  const dLat = far.lat - particle.nodeLat;
  const dLng = normalizeLng(far.lng - particle.nodeLng);
  const len = Math.hypot(dLat, dLng) || 1;
  const side = rand() < 0.5 ? 1 : -1;
  // Lateral bend so paths are arcs, not identical radial lines.
  const bend = (0.18 + rand() * 0.62) * side * len;
  const midLat = particle.nodeLat + dLat * (0.35 + rand() * 0.3);
  const midLng = normalizeLng(particle.nodeLng + dLng * (0.35 + rand() * 0.3));

  particle.ctrlLat = midLat + (-dLng / len) * bend;
  particle.ctrlLng = normalizeLng(midLng + (dLat / len) * bend);
  if (direction === 'out') {
    // Diverge: spawn at the node and fly outward to the far point.
    particle.startLat = particle.nodeLat;
    particle.startLng = particle.nodeLng;
    particle.destLat = far.lat;
    particle.destLng = far.lng;
  } else {
    // Converge (default): spawn at the far point and fall into the node.
    particle.startLat = far.lat;
    particle.startLng = far.lng;
    particle.destLat = particle.nodeLat;
    particle.destLng = particle.nodeLng;
  }
  particle.lat = particle.startLat;
  particle.lng = particle.startLng;
  particle.t = 0;
  particle.lastBearing = bearing;
  // Long enough that a full approach is visible before respawn.
  particle.duration = 2.6 + rand() * 3.2;
  particle.size = isMobile ? (1.4 + rand() * 0.8) : (1.1 + rand() * 0.7);
}

/**
 * Plan the desired connection-particle groups (per location + protocol) with
 * the global cap applied. Drives both pool reconciliation and the change
 * signature, so count changes never touch particles whose density did not move.
 * @returns {Array<{ key: string, lat: number, lng: number, protocol: string, count: number }>}
 */
export function planConnectionParticleGroups({
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
  const groups = [];

  planned.forEach((item) => {
    if (remaining <= 0 || item.connTotal <= 0) {
      return;
    }
    const scaled = scaleCounts(item, remaining, ['tcpCount', 'udpCount']);
    ['tcp', 'udp'].forEach((protocol) => {
      const count = protocol === 'tcp' ? scaled.tcpCount : scaled.udpCount;
      if (count > 0) {
        groups.push({
          key: item.activity.key,
          lat: item.activity.lat,
          lng: item.activity.lng,
          protocol,
          count,
        });
      }
    });
    remaining -= scaled.tcpCount + scaled.udpCount;
  });

  return groups;
}

function createConnectionParticle(group, isMobile, direction = 'in') {
  const particle = {
    protocol: group.protocol,
    groupKey: `${group.key}:${group.protocol}`,
    nodeLat: group.lat,
    nodeLng: group.lng,
    destLat: group.lat,
    destLng: group.lng,
    startLat: group.lat,
    startLng: group.lng,
    ctrlLat: group.lat,
    ctrlLng: group.lng,
    lat: group.lat,
    lng: group.lng,
    lastBearing: null,
    t: 0,
    duration: 1.8,
    size: 1.4,
    fade: 0,
    retire: false,
  };
  // True random each spawn — avoids looping the same few inbound tracks.
  assignParticlePath(particle, Math.random, isMobile, direction);
  // Stagger so a fresh cloud is already in motion (keep clear of the fade-out tail).
  particle.t = Math.random() * 0.82;
  const eased = easeParticleMotion(particle.t, direction);
  particle.lat = bezierLat(particle.startLat, particle.ctrlLat, particle.destLat, eased);
  particle.lng = bezierLng(particle.startLng, particle.ctrlLng, particle.destLng, eased);
  return particle;
}

/**
 * Reconcile a live pool toward the planned groups WITHOUT wiping in-flight
 * particles: matching particles keep flying, retiring ones are revived first,
 * only the deficit spawns anew, and surplus particles finish their current
 * journey (retire) instead of vanishing mid-flight.
 * @param {Array<object>} particles mutated in place
 * @param {Array<object>} groups from planConnectionParticleGroups
 * @param {boolean} [isMobile]
 * @param {string} [direction] 'in' (converge) | 'out' (diverge)
 * @returns {Array<object>} the same array
 */
export function reconcileConnectionParticlePool(particles, groups, isMobile = false, direction = 'in') {
  const pool = Array.isArray(particles) ? particles : [];
  const byGroup = new Map();
  pool.forEach((particle) => {
    if (!byGroup.has(particle.groupKey)) {
      byGroup.set(particle.groupKey, []);
    }
    byGroup.get(particle.groupKey).push(particle);
  });

  const wanted = new Set();
  (groups || []).forEach((group) => {
    const id = `${group.key}:${group.protocol}`;
    wanted.add(id);
    const existing = byGroup.get(id) || [];
    const active = existing.filter((particle) => !particle.retire);
    const retiring = existing.filter((particle) => particle.retire);

    let deficit = group.count - active.length;
    // Revive retiring particles first — the cheapest way to regain density.
    while (deficit > 0 && retiring.length > 0) {
      retiring.pop().retire = false;
      deficit -= 1;
    }
    // Keep the node anchor in sync (coords are stable per key, but stay safe).
    existing.forEach((particle) => {
      particle.nodeLat = group.lat;
      particle.nodeLng = group.lng;
    });
    for (let i = 0; i < deficit; i += 1) {
      pool.push(createConnectionParticle(group, isMobile, direction));
    }
    if (deficit < 0) {
      // Surplus: retire the ones nearest arrival so they exit soonest.
      active
        .slice()
        .sort((a, b) => b.t - a.t)
        .slice(0, -deficit)
        .forEach((particle) => {
          particle.retire = true;
        });
    }
  });

  // Groups that disappeared entirely: let their particles complete the trip.
  pool.forEach((particle) => {
    if (!wanted.has(particle.groupKey)) {
      particle.retire = true;
    }
  });

  return pool;
}

/**
 * Advance particles toward their destinations; respawn on arrival, prune
 * retired particles once their final journey completes.
 * @param {Array<object>} particles mutated in place
 * @param {number} dtSeconds
 * @param {boolean} [isMobile]
 * @param {string} [direction] 'in' (converge) | 'out' (diverge)
 */
export function stepConnectionParticles(particles, dtSeconds, isMobile = false, direction = 'in') {
  if (!Array.isArray(particles) || particles.length === 0 || dtSeconds <= 0) {
    return;
  }

  const dt = Math.min(dtSeconds, 0.05);
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const particle = particles[i];
    // Post-build brightness ramp; respawns keep the fade they already earned.
    particle.fade = Math.min(1, (Number(particle.fade) || 0) + dt / PARTICLE_BUILD_FADE_SECONDS);
    particle.t += dt / particle.duration;
    if (particle.t >= 1) {
      if (particle.retire) {
        // Final journey complete — remove instead of respawning.
        particles.splice(i, 1);
      } else {
        assignParticlePath(particle, Math.random, isMobile, direction);
      }
    } else {
      // Ease along the path: decelerate on approach ('in'), accelerate away ('out').
      const eased = easeParticleMotion(particle.t, direction);
      particle.lat = bezierLat(particle.startLat, particle.ctrlLat, particle.destLat, eased);
      particle.lng = bezierLng(particle.startLng, particle.ctrlLng, particle.destLng, eased);
    }
  }
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
