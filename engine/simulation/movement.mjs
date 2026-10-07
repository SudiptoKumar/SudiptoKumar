// Movement: road-graph route selection + deterministic waypoint interpolation.
// Every moving actor interpolates ALONG routeBetween() polylines — never
// straight lines across districts (spec §07 §9, lock §4).
// An itinerary is a list of chained legs {from, to, startH, endH} covering
// [0, 24); consecutive legs share endpoints so position(t) is continuous and
// actors never teleport between adjacent buckets.
import { routeBetween, nodeById } from '../world/roads.mjs';
import { clamp } from '../util.mjs';

const routeCache = new Map(); // routeBetween is pure: cache is safe + deterministic
export function cachedRoute(from, to) {
  const key = `${from}>${to}`;
  if (!routeCache.has(key)) {
    const r = routeBetween(from, to);
    routeCache.set(key, r ? r.map((p) => ({ x: p.x, y: p.y })) : null);
  }
  return routeCache.get(key);
}

export function routeLength(route) {
  let len = 0;
  for (let i = 1; i < route.length; i++) {
    len += Math.hypot(route[i].x - route[i - 1].x, route[i].y - route[i - 1].y);
  }
  return len;
}

/** Arc-length interpolation: progress 0..1 -> point on the polyline. */
export function pointAt(route, progress) {
  if (!route || route.length === 0) return { x: 0, y: 0 };
  if (route.length === 1 || progress <= 0) return { x: route[0].x, y: route[0].y };
  if (progress >= 1) { const l = route[route.length - 1]; return { x: l.x, y: l.y }; }
  const total = routeLength(route);
  if (total === 0) return { x: route[0].x, y: route[0].y };
  let target = progress * total;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1]; const b = route[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (target <= seg) {
      const t = seg === 0 ? 0 : target / seg;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    target -= seg;
  }
  const l = route[route.length - 1];
  return { x: l.x, y: l.y };
}

/** Facing from a velocity vector: dominant axis, 3/4-view compass. */
export function facingFrom(dx, dy) {
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return null;
  return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'e' : 'w') : (dy >= 0 ? 's' : 'n');
}

/** Distance from a point to a polyline (used by tests to verify on-route). */
export function distToRoute(x, y, route) {
  if (!route || route.length === 0) return Infinity;
  let best = Infinity;
  for (let i = 0; i < route.length; i++) {
    const a = route[i]; const b = route[i + 1] ?? route[i];
    const abx = b.x - a.x; const aby = b.y - a.y;
    const denom = abx * abx + aby * aby;
    let t = denom === 0 ? 0 : ((x - a.x) * abx + (y - a.y) * aby) / denom;
    t = clamp(t, 0, 1);
    best = Math.min(best, Math.hypot(x - (a.x + abx * t), y - (a.y + aby * t)));
  }
  return best;
}

/**
 * Position on an itinerary at a fractional hour of day.
 * Returns { x, y, facing, routeId, progress, moving, leg } — continuous in t
 * because legs are chained (each leg's `from` equals the previous leg's `to`).
 */
export function positionOnItinerary(itinerary, t, restFacing = 's') {
  const legs = itinerary.legs;
  let leg = legs[legs.length - 1];
  for (const l of legs) {
    if (t >= l.startH && t < l.endH) { leg = l; break; }
  }
  const route = cachedRoute(leg.from, leg.to);
  const span = Math.max(leg.endH - leg.startH, 1e-6);
  const progress = clamp((t - leg.startH) / span, 0, 1);
  const p = pointAt(route ?? [{ x: 0, y: 0 }], progress);
  const p2 = pointAt(route ?? [{ x: 0, y: 0 }], clamp(progress + 0.01, 0, 1));
  const moving = Math.hypot(p2.x - p.x, p2.y - p.y) > 0.01 && progress < 1;
  return {
    x: p.x, y: p.y,
    facing: facingFrom(p2.x - p.x, p2.y - p.y) ?? restFacing,
    routeId: `${leg.from}>${leg.to}`,
    progress: Math.round(progress * 1000) / 1000,
    moving,
    leg: { from: leg.from, to: leg.to },
  };
}

/** Maximum hourly step on an itinerary (for the no-teleport test). */
export function maxHourlyStep(itinerary) {
  let m = 0;
  for (const l of itinerary.legs) {
    const route = cachedRoute(l.from, l.to);
    const len = route ? routeLength(route) : 0;
    const span = Math.max(l.endH - l.startH, 1e-6);
    m = Math.max(m, len / span);
  }
  return m;
}

/** Sanity: is `nodeId` a real road node? */
export const isRoadNode = (nodeId) => nodeById(nodeId) !== null;
