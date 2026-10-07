// Plot model (lock §5): {center, w/h in tile multiples, facing toward nearest
// road node, roadAccess required, district, allowedArchetypes, elevation,
// reserved}. Invariants: no plot overlaps a road, the river/bay, or another
// plot; centers stay inside district rects; protected anchors unplottable.
//
// Layout: each plottable district gets an even cols×rows grid. Cells never
// overlap, and plots are inset 16u from their cell, so plots can never
// overlap each other either. Buildings are filtered to fit inside their plot.
import { TILE, PLOT_RULES, ARCHETYPES } from './constants.mjs';
import { districtById, anchorById } from './districts.mjs';
import { nearestNode, distanceToRoad, distanceToMajorRoad } from './roads.mjs';
import { isWater } from './map.mjs';
import { subRng } from '../util.mjs';

// Anchors that may never have a plot on top of them (lock §5).
const PROTECTED_ANCHORS = new Set([
  'castle', 'west_gate', 'east_gate', 'main_gate', 'royal_plaza',
  'farm_bridge', 'orchard_bridge', 'main_bridge',
]);
const PROTECTED_RADIUS = 96; // svg units of clearance around protected anchors
const PLOT_INSET = 16; // plots sit 16u inside their grid cell

// district -> grid + plot size (tiles) + candidate archetypes
// Grid sizes are the DENSITY lever (lock §3 density notes): medium/large
// districts carry enough plots that a normal-tier kingdom places ~120-200
// buildings. Rects stay fixed; only counts change inside them. Plot sizes
// stay >= largest allowed footprint + 8u so the fits-filter keeps variety.
const PLOTTABLE = {
  projects: { cols: 4, rows: 3, wTiles: 7, hTiles: 7, archetypes: ['tower', 'workshop', 'laboratory', 'fortress', 'observatory', 'library'] },
  residential: { cols: 9, rows: 6, wTiles: 3, hTiles: 3, archetypes: ['house', 'stall'] },
  workshops: { cols: 5, rows: 1, wTiles: 4, hTiles: 8, archetypes: ['forge', 'workshop', 'warehouse', 'laboratory'] },
  visitors: { cols: 4, rows: 2, wTiles: 4, hTiles: 6, archetypes: ['tent', 'stall', 'house'] },
  market: { cols: 3, rows: 2, wTiles: 7, hTiles: 5, archetypes: ['stall', 'market_hall'] },
  knowledge: { cols: 4, rows: 3, wTiles: 5, hTiles: 4, archetypes: ['library', 'observatory', 'shrine'] },
  guild: { cols: 2, rows: 2, wTiles: 9, hTiles: 7, archetypes: ['guild_hall', 'house', 'shrine'] },
  farms: { cols: 6, rows: 3, wTiles: 5, hTiles: 4, archetypes: ['farmhouse', 'mill'] },
  military: { cols: 3, rows: 2, wTiles: 7, hTiles: 5, archetypes: ['barracks', 'watchtower', 'wall'] },
  builderyard: { cols: 3, rows: 1, wTiles: 5, hTiles: 5, archetypes: ['workshop', 'warehouse', 'tent'] },
  harbor: { cols: 3, rows: 2, wTiles: 5, hTiles: 5, archetypes: ['warehouse', 'house', 'stall'] },
  warfront: { cols: 4, rows: 3, wTiles: 5, hTiles: 6, archetypes: ['watchtower', 'tent', 'barracks'] },
};

const ELEVATIONS = [...PLOT_RULES.elevation];

function facingToward(cx, cy, node) {
  const dx = node.x - cx; const dy = node.y - cy;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'e' : 'w';
  return dy >= 0 ? 's' : 'n';
}

/**
 * Deterministically generate the plot grid for one district.
 * @param {string} districtId
 * @param {string} seed world seed; plots are an independent sub-stream
 * @param {string} density lock density tier — higher tiers hold fewer plots
 *   in reserve (low: every 7th, normal: every 10th, prosperous/event: none)
 * @returns {Array} plots in row-major order
 */
export function generatePlots(districtId, seed, density = 'normal') {
  const spec = PLOTTABLE[districtId];
  const district = districtById(districtId);
  if (!spec || !district) return [];
  const r = subRng(seed, 'plots', districtId);
  const reserveMod = density === 'low' ? 7 : density === 'normal' ? 10 : 0;
  const rect = district.rect;
  const cellW = rect.w / spec.cols; const cellH = rect.h / spec.rows;
  const w = Math.min(spec.wTiles * TILE, Math.floor((cellW - PLOT_INSET) / TILE) * TILE);
  const h = Math.min(spec.hTiles * TILE, Math.floor((cellH - PLOT_INSET) / TILE) * TILE);
  if (w < 2 * TILE || h < 2 * TILE) return [];
  const plots = [];
  let n = 0;
  for (let row = 0; row < spec.rows; row++) {
    for (let col = 0; col < spec.cols; col++) {
      const cx = Math.round(rect.x + (col + 0.5) * cellW);
      const cy = Math.round(rect.y + (row + 0.5) * cellH);
      const node = nearestNode(cx, cy);
      const plot = {
        id: `plot-${districtId}-${n}`,
        district: districtId,
        cx, cy, w, h,
        roadAccess: node.id,
        facing: facingToward(cx, cy, node),
        allowedArchetypes: [...spec.archetypes].filter((a) => ARCHETYPES.includes(a)),
        elevation: r.pick(ELEVATIONS),
        reserved: reserveMod > 0 && n % reserveMod === reserveMod - 1, // held for expansion
      };
      if (plotClear(plot)) plots.push(plot);
      n++;
    }
  }
  return plots;
}

/** Plot-level clearance: not on water, not on a road, not on a protected anchor.
 * Road berth is width-aware: major roads (wider render) need 46u, minor 34u —
 * buildings front the street without covering the cobble. */
function plotClear(plot) {
  if (isWater(plot.cx, plot.cy)) return false;
  if (distanceToMajorRoad(plot.cx, plot.cy) < 46) return false;
  if (distanceToRoad(plot.cx, plot.cy) < 34) return false;
  for (const id of PROTECTED_ANCHORS) {
    const a = anchorById(id);
    if (a && Math.hypot(plot.cx - a.x, plot.cy - a.y) < PROTECTED_RADIUS) return false;
  }
  return true;
}

/** Generate plots for every plottable district (lock order). */
export function allPlots(seed, density = 'normal') {
  const out = [];
  for (const id of Object.keys(PLOTTABLE)) out.push(...generatePlots(id, seed, density));
  return out;
}

/** True when two plots' bounds overlap. */
export function plotsOverlap(a, b) {
  return (
    Math.abs(a.cx - b.cx) < (a.w + b.w) / 2 &&
    Math.abs(a.cy - b.cy) < (a.h + b.h) / 2
  );
}

export const plottableDistricts = () => Object.keys(PLOTTABLE);
