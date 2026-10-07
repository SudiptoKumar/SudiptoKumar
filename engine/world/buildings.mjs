// Building placement: deterministic from (world seed + repos).
// Landmarks sit on their lock anchors; repository buildings occupy plots in
// the projects district (overflow spills into the east-tech reserve).
import { ARCHETYPES, TILE, BUILDING_LIFECYCLE, inBounds } from './constants.mjs';
import { anchorById } from './districts.mjs';
import { generatePlots } from './plots.mjs';
import { nearestNode, distanceToRoad, distanceToMajorRoad } from './roads.mjs';
import { isWater } from './map.mjs';
import { subRng, normName } from '../util.mjs';
import { archetypeOf, buildingLifecycleFor } from '../domain/mapping.mjs';

// Buildings may fill their plot exactly (margin 0): plots never overlap and
// sit 16u inside their grid cell, so buildings stay >=26u apart even with the
// +/-3u placement jitter. This lets small archetypes (stall, tent, house)
// pack dense, inhabited districts.
const FIT_MARGIN = 0;

// Footprint (w x h in svg units) per archetype — tile multiples, 3/4 view.
const FOOTPRINTS = {
  castle: [10, 8], tower: [3, 3], guild_hall: [6, 5], library: [5, 4],
  workshop: [4, 4], forge: [4, 3], laboratory: [4, 4], market_hall: [5, 4],
  house: [3, 3], warehouse: [5, 4], fortress: [6, 5], shrine: [2, 2],
  observatory: [3, 3], barracks: [5, 4], watchtower: [2, 2], farmhouse: [4, 3],
  mill: [3, 4], stall: [2, 2], tent: [2, 2], dock: [4, 2], monument: [3, 3],
  wall: [4, 1], gate: [3, 2],
};
export const footprintOf = (archetype) => {
  const [w, h] = FOOTPRINTS[archetype] ?? [3, 3];
  return { w: w * TILE, h: h * TILE };
};

// Landmarks: one building per important anchor (lock §2/§3 anchor coverage).
const LANDMARKS = [
  ['castle', 'castle', 'capital'],
  ['royal_plaza', 'monument', 'capital'],
  ['hall_of_heroes', 'monument', 'capital'],
  ['vault', 'warehouse', 'capital'],
  ['west_gate', 'gate', 'capital'],
  ['east_gate', 'gate', 'capital'],
  ['main_gate', 'gate', 'capital'],
  ['automation_fortress', 'fortress', 'automation'],
  ['barracks', 'barracks', 'military'],
  ['armory', 'warehouse', 'military'],
  ['repair_depot', 'workshop', 'military'],
  ['watch_north', 'watchtower', 'warfront'],
  ['hero_guild', 'guild_hall', 'guild'],
  ['knowledge_hall', 'library', 'knowledge'],
  ['market_square', 'market_hall', 'market'],
  ['courier_station', 'house', 'market'],
  ['warehouse', 'warehouse', 'workshops'],
  ['workshop_row', 'workshop', 'workshops'],
  ['forge', 'forge', 'workshops'],
  ['builder_yard', 'warehouse', 'builderyard'],
  ['farm_entrance', 'farmhouse', 'farms'],
  ['mill', 'mill', 'orchard'],
  ['harbor_docks', 'dock', 'harbor'],
  ['hidden_shrine', 'shrine', 'highforest'],
  ['scout_lodge', 'house', 'highforest'],
  ['dungeon_gate', 'gate', 'dungeon'],
  ['ruins_cross', 'monument', 'ruins'],
];

function placeLandmarks() {
  const out = [];
  for (const [anchorId, archetype, district] of LANDMARKS) {
    const a = anchorById(anchorId);
    if (!a) continue;
    const { w, h } = footprintOf(archetype);
    const near = nearestNode(a.x, a.y);
    out.push({
      id: `landmark-${anchorId}`,
      source: 'landmark',
      anchorId,
      archetype,
      district,
      x: Math.round(a.x - w / 2), y: Math.round(a.y - h / 2),
      w, h,
      facing: a.x >= near.x ? 'w' : 'e',
      level: anchorId === 'castle' ? 7 : 3,
      lifecycle: anchorId === 'castle' ? 'flourishing' : 'active',
      health: 100,
      activity: 'normal',
      workers: 0,
      variant: 'landmark',
      anchorOffset: [0, 0],
    });
  }
  return deoverlap(out);
}

/**
 * Deterministic de-overlap: stable id order; a later building that overlaps an
 * earlier one is nudged right/down just past the overlap. Fixed iteration
 * order => identical results every run. Offsets are recorded on the building.
 */
function deoverlap(buildings) {
  const sorted = [...buildings].sort((a, b) => (a.id < b.id ? -1 : 1));
  for (let pass = 0; pass < 8; pass++) {
    let moved = false;
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i]; const b = sorted[j];
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (ox > 0 && oy > 0) {
          // nudge along the smaller overlap axis
          if (ox <= oy) { b.x += ox + 8; b.anchorOffset[0] += ox + 8; }
          else { b.y += oy + 8; b.anchorOffset[1] += oy + 8; }
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
  return sorted;
}

function facingTo(x, y, node) {
  const dx = node.x - x; const dy = node.y - y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'e' : 'w';
  return dy >= 0 ? 's' : 'n';
}

/** True when rect {x,y,w,h} overlaps any rect in the list. */
function hitsAny(rect, rects) {
  return rects.some((r) => rect.x < r.x + r.w && r.x < rect.x + rect.w && rect.y < r.y + r.h && r.y < rect.y + rect.h);
}

/**
 * Place repository buildings on project plots (lock §5).
 * Plots that would collide with a landmark are skipped for this repo and the
 * next free plot is tried (deterministic order).
 * @returns {{buildings: Array, overflow: number}}
 */
export function placeRepoBuildings(repos, plots, seed, config = {}, landmarkRects = []) {
  const r = subRng(seed, 'buildings', 'repos');
  const usable = plots.filter((p) => !p.reserved && p.allowedArchetypes.length);
  const buildings = [];
  let overflow = 0;
  let pi = 0;
  const list = (repos ?? []).slice(0, 400);
  for (const repo of list) {
    // find the next plot whose building would not hit a landmark
    let placed = false;
    while (pi < usable.length && !placed) {
      const plot = usable[pi];
      const { archetype, reason, flavor } = archetypeOf(repo, config);
      const fits = (a) => { const f = footprintOf(a); return f.w <= plot.w - FIT_MARGIN && f.h <= plot.h - FIT_MARGIN; };
      const fitting = plot.allowedArchetypes.filter(fits);
      const allowed = (plot.allowedArchetypes.includes(archetype) && fits(archetype))
        ? archetype
        : fitting.length ? fitting[Math.floor(r() * fitting.length)] : plot.allowedArchetypes[0];
      const { w, h } = footprintOf(allowed);
      const cx = plot.cx + r.int(-3, 3); const cy = plot.cy + r.int(-3, 3);
      const rect = { x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w, h };
      if (hitsAny(rect, landmarkRects)) { pi++; continue; } // try the next plot
      const lifecycle = buildingLifecycleFor(repo, {
        recentPush: (repo.recentCommits ?? 0) > 0 || (repo.pushedDaysAgo ?? 999) < 30,
        featured: !!repo.featured,
        upgrading: false, damaged: false, repairing: false,
      });
      buildings.push({
        id: `repo-${normName(repo.fullName || repo.name) || `r${pi}`}`,
        source: 'repo',
        sourceId: repo.fullName || repo.name,
        archetype: allowed,
        district: plot.district,
        plot: plot.id,
        x: rect.x, y: rect.y, w, h,
        facing: facingTo(cx, cy, nearestNode(cx, cy)),
        level: 1 + Math.min(6, Math.floor(Math.log10(1 + (repo.stars ?? 0)))),
        lifecycle,
        health: 100,
        activity: (repo.recentCommits ?? 0) > 0 ? 'high' : (repo.ageDays ?? 999) > 180 ? 'low' : 'normal',
        workers: Math.min(6, Math.floor((repo.recentCommits ?? 0) / 5)),
        variant: flavor ?? reason,
      });
      pi++;
      placed = true;
    }
    if (!placed) overflow++;
  }
  return { buildings, overflow };
}

/**
 * Ambient residential/service buildings on remaining plots: houses in the
 * residential district, stalls in market, tents for visitors, farmhouses.
 * Fill rate scales with the lock density tier (lock §3 density notes):
 * low kingdoms stay sparse, prosperous/event kingdoms fill nearly every plot.
 */
const FILL_BY_TIER = { low: 0.55, normal: 0.9, prosperous: 1.0, event: 1.0 };
export function placeAmbientBuildings(plots, seed, { visitorCount = 0, landmarkRects = [], density = 'normal' } = {}) {
  const r = subRng(seed, 'buildings', 'ambient');
  const fill = FILL_BY_TIER[density] ?? FILL_BY_TIER.normal;
  const out = [];
  let vi = 0;
  for (const plot of plots) {
    if (plot.reserved || plot.allowedArchetypes.length === 0) continue;
    if (plot.district === 'projects') continue; // repo buildings own these
    if (r() > fill) continue; // some plots stay empty (lifecycle 'empty')
    let archetype = r.pick(plot.allowedArchetypes);
    if (plot.district === 'visitors' && vi < Math.max(1, visitorCount)) { archetype = 'tent'; vi++; }
    const fits = (a) => { const f = footprintOf(a); return f.w <= plot.w - FIT_MARGIN && f.h <= plot.h - FIT_MARGIN; };
    if (!fits(archetype)) {
      const fitting = plot.allowedArchetypes.filter(fits);
      if (!fitting.length) continue;
      archetype = r.pick(fitting);
    }
    const { w, h } = footprintOf(archetype);
    const cx = plot.cx + r.int(-3, 3); const cy = plot.cy + r.int(-3, 3);
    if (isWater(cx, cy)) continue;
    const rect = { x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w, h };
    if (hitsAny(rect, landmarkRects)) continue; // landmark owns this ground
    out.push({
      id: `b-${plot.id}`,
      source: 'ambient',
      archetype,
      district: plot.district,
      plot: plot.id,
      x: rect.x, y: rect.y, w, h,
      facing: facingTo(cx, cy, nearestNode(cx, cy)),
      level: r.int(1, 3),
      lifecycle: r.pick(['active', 'active', 'active', 'sleepy', 'flourishing']),
      health: 100,
      activity: 'normal',
      workers: 0,
      variant: 'ambient',
    });
  }
  return out;
}

/** Market stall ring: stalls ringing the market square plaza (lock §3: market
 * is the social anchor). Seeded ring, deterministic skips — never overlaps a
 * placed building, road corridor, water, or protected anchor. */
const STALLS_BY_TIER = { low: 6, normal: 10, prosperous: 14, event: 14 };
function placeStallRing(seed, density, placedRects) {
  const anchor = anchorById('market_square');
  if (!anchor) return [];
  const r = subRng(seed, 'buildings', 'stall-ring');
  const n = STALLS_BY_TIER[density] ?? STALLS_BY_TIER.normal;
  const { w, h } = footprintOf('stall');
  const out = [];
  const rects = placedRects.map((b) => ({ x: b.x - 6, y: b.y - 6, w: b.w + 12, h: b.h + 12 }));
  for (let i = 0; i < n; i++) {
    const base = (i / n) * Math.PI * 2;
    let spot = null;
    for (let attempt = 0; attempt < 10 && !spot; attempt++) {
      const ang = base + (r() - 0.5) * 0.7;
      const rad = 104 + r.int(0, 56);
      const cx = anchor.x + Math.cos(ang) * rad;
      const cy = anchor.y + Math.sin(ang) * rad * 0.72; // plaza is wider than tall
      const rect = { x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w, h };
      if (!inBounds(rect.x, rect.y, rect.w, rect.h)) continue;
      if (isWater(cx, cy)) continue;
      if (distanceToMajorRoad(cx, cy) < 40 || distanceToRoad(cx, cy) < 32) continue;
      if (hitsAny(rect, rects)) continue;
      spot = { rect, cx, cy };
    }
    if (!spot) continue;
    const { rect, cx, cy } = spot;
    rects.push({ x: rect.x - 6, y: rect.y - 6, w: rect.w + 12, h: rect.h + 12 });
    const dx = anchor.x - cx, dy = anchor.y - cy;
    out.push({
      id: `b-stall-ring-${i}`,
      source: 'ambient',
      archetype: 'stall',
      district: 'market',
      plot: null,
      x: rect.x, y: rect.y, w, h,
      facing: Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'e' : 'w') : (dy >= 0 ? 's' : 'n'),
      level: r.int(1, 3),
      lifecycle: r.pick(['active', 'active', 'flourishing', 'sleepy']),
      health: 100,
      activity: 'high',
      workers: 1,
      variant: 'stall-ring',
    });
  }
  return out;
}

/** Full building set for a world. Pure + deterministic. */
export function placeBuildings({ seed, repos = [], config = {}, visitorCount = 0, density = 'normal' }) {
  const plots = generatePlots('projects', seed, density)
    .concat(generatePlots('residential', seed, density))
    .concat(generatePlots('workshops', seed, density))
    .concat(generatePlots('visitors', seed, density))
    .concat(generatePlots('market', seed, density))
    .concat(generatePlots('knowledge', seed, density))
    .concat(generatePlots('guild', seed, density))
    .concat(generatePlots('farms', seed, density))
    .concat(generatePlots('military', seed, density))
    .concat(generatePlots('builderyard', seed, density))
    .concat(generatePlots('harbor', seed, density))
    .concat(generatePlots('warfront', seed, density));
  const landmarks = placeLandmarks();
  const landmarkRects = landmarks.map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h }));
  const { buildings: repoBuildings, overflow } = placeRepoBuildings(repos, plots.filter((p) => p.district === 'projects'), seed, config, landmarkRects);
  const ambient = placeAmbientBuildings(plots, seed, { visitorCount, landmarkRects, density });
  const placed = [...landmarks, ...repoBuildings, ...ambient];
  const stalls = placeStallRing(seed, density, placed);
  const buildings = [...placed, ...stalls];
  // lifecycle sanity (all 11 lock states legal)
  for (const b of buildings) {
    if (!ARCHETYPES.includes(b.archetype)) throw new Error(`bad archetype ${b.archetype}`);
    if (!BUILDING_LIFECYCLE.includes(b.lifecycle)) throw new Error(`bad lifecycle ${b.lifecycle}`);
  }
  return { buildings, plots, overflow };
}
