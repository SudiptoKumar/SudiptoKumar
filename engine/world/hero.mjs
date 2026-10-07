// TRUE V2 hero model (TRUE V2 §8). The hero is a persistent world entity with a
// real position, a destination, and a deterministic path between them.
//
//   hero = { state, spot, label, why, x, y, destination, origin, path, progress, umbrella }
//
// The scene decides the hero's state and discrete spot (unchanged). The world
// turns that into physical movement: when the hero's semantic destination differs
// from where the scene put him, he walks the road network toward it. Progress is
// a deterministic function of the driving event's age, so every rebuild of the
// same world puts the hero on the same stone of the same road.
//
// Semantic destinations (TRUE V2 §13):
//   raid / victory  -> the gate          release / milestone -> the castle
//   emergency / recovery -> the CI       harvest -> the farm
//   night / quiet   -> home              evening -> home (walking)
//   dawn            -> the plaza (walking)   busy -> the castle   tending -> the farm
import { HERO_SPOT, WAYPOINTS, WAYPOINT_IDS, PATHS } from './layout.mjs';

/** The hero's world position for a scene spot. Every spot resolves to real coordinates. */
export function heroAt(spot) {
  const [x, y] = HERO_SPOT[spot] || HERO_SPOT.plaza;
  return { x, y };
}

/** Shortest waypoint path from `from` to `to` (BFS). Returns [from, ..., to] or null. */
export function findPath(from, to) {
  if (!WAYPOINT_IDS.includes(from) || !WAYPOINT_IDS.includes(to)) return null;
  if (from === to) return [from];
  const prev = { [from]: null }, queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    for (const nxt of PATHS[cur] || []) {
      if (!(nxt in prev)) { prev[nxt] = cur; queue.push(nxt); if (nxt === to) { queue.length = 0; break; } }
    }
  }
  if (!(to in prev)) return null;
  const out = [];
  for (let c = to; c; c = prev[c]) out.unshift(c);
  return out;
}

/** Interpolate a world position along a waypoint path at progress t (0..1). */
export function pointAlongPath(path, t) {
  if (!path || !path.length) return null;
  const pts = path.map((id) => WAYPOINTS[id]).filter(Boolean);
  if (!pts.length) return null;
  if (pts.length === 1 || t <= 0) return { x: pts[0][0], y: pts[0][1] };
  if (t >= 1) return { x: pts[pts.length - 1][0], y: pts[pts.length - 1][1] };
  const segs = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const len = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    segs.push(len); total += len;
  }
  let d = t * total;
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i]) {
      const k = segs[i] ? d / segs[i] : 0;
      return { x: pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, y: pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k };
    }
    d -= segs[i];
  }
  return { x: pts[pts.length - 1][0], y: pts[pts.length - 1][1] };
}

// ---------------------------------------------------------------- journeys
const SPOT_WAYPOINT = { castle: 'castle', plaza: 'plaza', farm: 'farm', home: 'home', ci: 'ci', gate: 'gate', road: 'bridgeN', camp: 'camp' };
const DEST_SPOT = { castle: 'castle', plaza: 'plaza', farm: 'farm', home: 'home', ci: 'ci', gate: 'gate', camp: 'camp' };
const WHY_DEST = {
  raid: 'gate', victory: 'gate', emergency: 'ci', recovery: 'ci',
  release: 'castle', milestone: 'castle', harvest: 'farm',
  night: 'home', quiet: 'home', evening: 'home', dawn: 'plaza', busy: 'castle', tending: 'farm',
};
const WHY_ORIGIN = { evening: 'plaza', dawn: 'home' };
const WHY_EVENT = { raid: 'raid', victory: 'raid', emergency: 'emergency', recovery: 'recovery', release: 'release', milestone: 'milestone', harvest: 'harvest' };

/**
 * heroJourney(sceneHero, events) -> { destination, origin, path, progress }
 * Pure and deterministic. `events` are the choreographed world events.
 */
export function heroJourney(hs = {}, events = []) {
  const spot = hs.spot || 'plaza';
  const destination = WHY_DEST[hs.why] || SPOT_WAYPOINT[spot] || null;
  const at = SPOT_WAYPOINT[spot];
  if (!destination || destination === at) return { destination, origin: destination, path: null, progress: 1 };
  const origin = WHY_ORIGIN[hs.why] || at || 'plaza';
  if (origin === destination) return { destination, origin, path: null, progress: 1 };
  const path = findPath(origin, destination);
  // progress: event-driven when a driving event exists, otherwise a steady walk
  let progress = 0.5;
  const ev = events.find((e) => e.type === WHY_EVENT[hs.why]);
  if (ev && ev.phase !== 'EXPIRED') progress = ev.phase === 'START' ? Math.min(1, Math.max(0.05, ev.t / 0.15)) : 1;
  return { destination, origin, path, progress };
}

/** Build the hero world entity. Pure and deterministic. */
export function buildHero(S, events = []) {
  const hs = S.scene?.hero || { state: 'idle', spot: 'plaza' };
  const spot = hs.spot || 'plaza';
  const j = heroJourney(hs, events);
  let x, y;
  if (!j.path || j.progress >= 1) {
    // standing somewhere meaningful: the scene's spot, or the destination's spot once arrived
    const stand = j.progress >= 1 && j.destination && DEST_SPOT[j.destination] ? DEST_SPOT[j.destination] : spot;
    ({ x, y } = heroAt(stand));
  } else {
    ({ x, y } = pointAlongPath(j.path, j.progress));
  }
  return {
    state: hs.state || 'idle', spot, label: hs.label || '', why: hs.why || null,
    x, y, destination: j.destination, origin: j.origin, path: j.path, progress: j.progress,
    umbrella: !!hs.umbrella,
  };
}
