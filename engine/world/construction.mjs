// TRUE V3 Construction gameplay (V3 §6). Builders physically travel to sites,
// carry materials, hammer, and buildings visibly progress through states.
//
// BUILDER TASK CYCLE:
//   IDLE -> WALKING -> CARRYING -> WORKING -> WALKING -> IDLE
//
// BUILDING STATES:
//   RUIN -> FOUNDATION -> UNDER_CONSTRUCTION -> ACTIVE -> (UPGRADING) -> FLOURISHING
import { rng } from '../util.mjs';
import { WAYPOINTS, PATHS, L } from './layout.mjs';

/** Builder task states. */
export const BUILDER_STATES = ['IDLE', 'WALKING', 'CARRYING', 'WORKING', 'RETURNING', 'BREAK'];

/**
 * Find a path between two waypoints using PATHS graph (BFS, deterministic).
 * Returns array of waypoint names, or null if no path.
 */
export function findPath(from, to) {
  if (from === to) return [from];
  if (!PATHS[from] || !WAYPOINTS[to]) return null;
  const visited = new Set([from]);
  const queue = [[from]];
  while (queue.length) {
    const path = queue.shift();
    const last = path[path.length - 1];
    for (const next of (PATHS[last] || [])) {
      if (next === to) return [...path, next];
      if (!visited.has(next)) {
        visited.add(next);
        queue.push([...path, next]);
      }
    }
  }
  return null;
}

/**
 * Position along a path at progress t (0..1). Deterministic interpolation.
 * path: array of [x, y] coordinates. Returns [x, y].
 */
export function pointAlongPath(coords, t) {
  if (!coords.length) return [0, 0];
  if (coords.length === 1) return coords[0];
  const segs = coords.length - 1;
  const ft = Math.min(0.999, Math.max(0, t)) * segs;
  const i = Math.floor(ft), f = ft - i;
  const [x0, y0] = coords[i], [x1, y1] = coords[i + 1];
  return [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f];
}

/**
 * Assign builders to construction sites.
 * world: the world object. tick: integer.
 * Returns array of { builderId, siteName, siteX, siteY, task, progress, path }.
 */
export function assignBuilders(world, tick = 0) {
  const r = rng(`build:${world.signature}:${tick}`);
  const sites = (world.repositories || [])
    .filter((repo) => ['building', 'construction'].includes(repo.lifecycle?.key))
    .slice(0, 3);  // max 3 active sites
  
  if (!sites.length) return [];

  const builders = (world.population?.npcs || []).filter((n) => n.role === 'builder').slice(0, 6);
  const assignments = [];

  sites.forEach((site, si) => {
    // 2 builders per site
    for (let b = 0; b < 2 && si * 2 + b < builders.length; b++) {
      const builder = builders[si * 2 + b];
      // Deterministic task based on tick: cycle through WALKING -> CARRYING -> WORKING
      const cycle = (tick + si * 2 + b) % 12;
      let task = 'IDLE';
      if (cycle < 3) task = 'WALKING';
      else if (cycle < 5) task = 'CARRYING';
      else if (cycle < 9) task = 'WORKING';
      else if (cycle < 11) task = 'RETURNING';
      // else IDLE (break)

      // Path: builder yard -> site (or reverse for RETURNING)
      const from = task === 'RETURNING' ? 'site' : 'builderyard';
      const to = task === 'RETURNING' ? 'builderyard' : 'site';
      
      // Progress: deterministic, increases with tick
      const progress = Math.min(1, ((tick % 48) + si * 7 + b * 3) / 48);

      assignments.push({
        builderId: builder.id || `builder-${si * 2 + b}`,
        builderX: builder.x, builderY: builder.y,
        siteName: site.name,
        siteX: site.x, siteY: site.y,
        task,
        progress: Math.round(progress * 100) / 100,
        // Position along path (for WALKING/CARRYING/RETURNING)
        t: task === 'WORKING' ? 1 : (cycle % 3) / 3,
      });
    }
  });

  return assignments;
}

/**
 * Construction visual state for a building.
 * Returns { state, progress } where state is one of the BUILDING_STATES.
 */
export function constructionState(repo, tick = 0) {
  const lc = repo.lifecycle?.key;
  if (lc === 'ruin' || lc === 'abandoned') return { state: 'RUIN', progress: 0 };
  if (lc === 'building' || lc === 'construction') {
    const progress = Math.min(1, ((tick % 48) / 48));
    if (progress < 0.2) return { state: 'FOUNDATION', progress };
    if (progress < 0.8) return { state: 'UNDER_CONSTRUCTION', progress };
    return { state: 'ACTIVE', progress: 1 };
  }
  if (repo.level >= 4) return { state: 'LEGENDARY', progress: 1 };
  if (repo.level >= 3) return { state: 'FLOURISHING', progress: 1 };
  return { state: 'ACTIVE', progress: 1 };
}
