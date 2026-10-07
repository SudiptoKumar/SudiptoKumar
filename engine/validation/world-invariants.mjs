// World invariants (lock §15): structural checks every world must pass.
// Returns a list of problem strings; empty => the world is consistent.
import { WORLD_W, WORLD_H, ARCHETYPES, BUILDING_LIFECYCLE, HERO_STATES, ACTOR_STATES } from '../world/constants.mjs';
import { allAnchors } from '../world/districts.mjs';
import { reachableFrom, distanceToRoad, nodeById } from '../world/roads.mjs';

const inB = (x, y, w = 0, h = 0) => x >= 0 && y >= 0 && x + w <= WORLD_W && y + h <= WORLD_H;
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

function uniqueIds(items, kind, problems) {
  const seen = new Set();
  for (const it of items) {
    if (seen.has(it.id)) problems.push(`duplicate ${kind} id: ${it.id}`);
    seen.add(it.id);
  }
}

/**
 * Check every world invariant from lock §15 + spec §14.3.
 * @param {object} world the built world
 * @returns {string[]} problems (empty when valid)
 */
export function checkWorldInvariants(world) {
  const problems = [];
  if (!world || typeof world !== 'object') return ['world is not an object'];

  const districts = world.districts ?? [];
  const nodes = world.roads?.nodes ?? [];
  const edges = world.roads?.edges ?? [];
  const buildings = world.buildings ?? [];
  const actors = world.actors ?? [];
  const plots = world.plots ?? [];

  // --- no duplicate authority ---
  uniqueIds(districts, 'district', problems);
  uniqueIds(nodes, 'road node', problems);
  uniqueIds(edges, 'road edge', problems);
  uniqueIds(buildings, 'building', problems);
  uniqueIds(actors, 'actor', problems);
  uniqueIds(plots, 'plot', problems);

  // --- coords in bounds ---
  for (const d of districts) {
    const r = d.rect;
    if (!inB(r.x, r.y, r.w, r.h)) problems.push(`district out of bounds: ${d.id}`);
    for (const a of d.anchors ?? []) if (!inB(a.x, a.y)) problems.push(`anchor out of bounds: ${a.id}`);
  }
  for (const n of nodes) if (!inB(n.x, n.y)) problems.push(`road node out of bounds: ${n.id}`);
  for (const e of edges) for (const [x, y] of e.via ?? []) if (!inB(x, y)) problems.push(`edge waypoint out of bounds: ${e.id}`);
  for (const b of buildings) if (!inB(b.x, b.y, b.w, b.h)) problems.push(`building out of bounds: ${b.id}`);
  for (const a of actors) if (!inB(a.x, a.y)) problems.push(`actor out of bounds: ${a.id}`);
  if (world.hero && !inB(world.hero.x, world.hero.y)) problems.push('hero out of bounds');
  for (const p of plots) {
    if (!inB(p.cx - p.w / 2, p.cy - p.h / 2, p.w, p.h)) problems.push(`plot out of bounds: ${p.id}`);
  }

  // --- one castle, valid archetypes / lifecycles / states ---
  const castles = buildings.filter((b) => b.archetype === 'castle');
  if (castles.length !== 1) problems.push(`expected exactly one castle, found ${castles.length}`);
  for (const b of buildings) {
    if (!ARCHETYPES.includes(b.archetype)) problems.push(`building ${b.id}: unknown archetype ${b.archetype}`);
    if (!BUILDING_LIFECYCLE.includes(b.lifecycle)) problems.push(`building ${b.id}: unknown lifecycle ${b.lifecycle}`);
  }
  const legalStates = new Set([...HERO_STATES, ...ACTOR_STATES]);
  for (const a of actors) if (!legalStates.has(a.state)) problems.push(`actor ${a.id}: unknown state ${a.state}`);
  if (world.hero && !HERO_STATES.includes(world.hero.state)) problems.push(`hero: unknown state ${world.hero.state}`);

  // --- no building overlaps ---
  for (let i = 0; i < buildings.length; i++) {
    for (let j = i + 1; j < buildings.length; j++) {
      const a = buildings[i]; const b = buildings[j];
      if (overlap(a, b)) problems.push(`buildings overlap: ${a.id} ~ ${b.id}`);
    }
  }

  // --- buildings keep off the road corridor ---
  // Plot-based buildings (repo/ambient) must not sit on the road centerline.
  // Landmarks (gates, plazas, docks, fortress...) legitimately stand on
  // infrastructure anchors, so they are exempt.
  for (const b of buildings) {
    if (b.source === 'landmark') continue;
    if (distanceToRoad(b.x + b.w / 2, b.y + b.h / 2) < 24) {
      problems.push(`building on road: ${b.id}`);
    }
  }

  // --- road graph integrity ---
  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const e of edges) {
    if (!nodeIds.has(e.from)) problems.push(`edge ${e.id}: unknown from node ${e.from}`);
    if (!nodeIds.has(e.to)) problems.push(`edge ${e.id}: unknown to node ${e.to}`);
  }
  const reach = new Set(reachableFrom('castle_gate'));
  for (const n of nodes) {
    if (!reach.has(n.id)) problems.push(`road node unreachable from castle_gate: ${n.id}`);
  }

  // --- hero destinations connected (hero stands on / heads to real nodes) ---
  if (world.hero) {
    if (!nodeIds.has(world.hero.destination)) problems.push(`hero destination not a road node: ${world.hero.destination}`);
    else if (!reach.has(world.hero.destination)) problems.push(`hero destination unreachable: ${world.hero.destination}`);
    if (!nodeIds.has(world.hero.home)) problems.push(`hero home not a road node: ${world.hero.home}`);
  }
  for (const a of actors) {
    if (a.home && !nodeIds.has(a.home)) problems.push(`actor ${a.id}: unknown home node ${a.home}`);
  }

  // --- every district has a road connection (node within 220u of its rect) ---
  for (const d of districts) {
    const r = d.rect;
    const ok = nodes.some((n) => {
      const cx = Math.min(Math.max(n.x, r.x), r.x + r.w);
      const cy = Math.min(Math.max(n.y, r.y), r.y + r.h);
      return Math.hypot(n.x - cx, n.y - cy) <= 220;
    });
    if (!ok) problems.push(`district has no road connection: ${d.id}`);
  }

  // --- all anchors connected: within 220u of the road network ---
  for (const a of allAnchors()) {
    const nearNode = nodes.some((n) => Math.hypot(n.x - a.x, n.y - a.y) <= 220);
    const nearRoad = distanceToRoad(a.x, a.y) <= 220;
    if (!nearNode && !nearRoad) problems.push(`anchor not connected to roads: ${a.id}`);
  }

  // --- plot invariants (lock §5) ---
  for (const p of plots) {
    const d = districts.find((dd) => dd.id === p.district);
    if (!d) { problems.push(`plot ${p.id}: unknown district ${p.district}`); continue; }
    const r = d.rect;
    if (!(p.cx >= r.x && p.cx <= r.x + r.w && p.cy >= r.y && p.cy <= r.y + r.h)) {
      problems.push(`plot center outside district: ${p.id}`);
    }
    if (distanceToRoad(p.cx, p.cy) < 32) problems.push(`plot overlaps road: ${p.id}`);
    for (const arch of p.allowedArchetypes ?? []) {
      if (!ARCHETYPES.includes(arch)) problems.push(`plot ${p.id}: unknown archetype ${arch}`);
    }
    if (p.roadAccess && !nodeIds.has(p.roadAccess)) problems.push(`plot ${p.id}: unknown roadAccess ${p.roadAccess}`);
  }
  for (let i = 0; i < plots.length; i++) {
    for (let j = i + 1; j < plots.length; j++) {
      const a = plots[i]; const b = plots[j];
      if (Math.abs(a.cx - b.cx) < (a.w + b.w) / 2 && Math.abs(a.cy - b.cy) < (a.h + b.h) / 2) {
        problems.push(`plots overlap: ${a.id} ~ ${b.id}`);
      }
    }
  }
  // every building with a plot claims an existing plot, and at most one building per plot
  const plotIds = new Set(plots.map((p) => p.id));
  const plotUse = new Map();
  for (const b of buildings) {
    if (!b.plot) continue;
    if (!plotIds.has(b.plot)) problems.push(`building ${b.id}: unknown plot ${b.plot}`);
    else if (plotUse.has(b.plot)) problems.push(`plot claimed twice: ${b.plot} (${plotUse.get(b.plot)} ~ ${b.id})`);
    else plotUse.set(b.plot, b.id);
  }

  return problems;
}

/** Convenience: true when the world passes every invariant. */
export const worldIsConsistent = (world) => checkWorldInvariants(world).length === 0;

export { nodeById };
