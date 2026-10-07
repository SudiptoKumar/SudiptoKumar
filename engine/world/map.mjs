// Terrain regions: mountains (N), high forest, river (S -> harbor bay),
// bridges, and the quiet expansion reserves. Values derive from the lock.
import { TERRAIN, EXPANSION_RESERVES, inBounds } from './constants.mjs';

export const RIVER_SEGMENTS = TERRAIN.river.segments.map(([x1, y1, x2, y2]) => ({ x1, y1, x2, y2 }));
export const HARBOR_BAY = (([x, y, x2, y2]) => ({ x, y, w: x2 - x, h: y2 - y }))(TERRAIN.river.bay);
export const BRIDGES = TERRAIN.bridges.map((b) => ({ ...b }));

/**
 * Macro terrain regions (lock §2). kind in: mountains | forest | water | land.
 * Every world coordinate is inside exactly one region for terrain queries.
 */
export function terrainRegions() {
  return [
    { id: 'mountains', kind: 'mountains', rect: { x: 0, y: 0, w: 2048, h: 160 } },
    { id: 'highforest', kind: 'forest', rect: { x: 64, y: 160, w: 640, h: 224 } },
    { id: 'river', kind: 'water', rect: { x: 0, y: 1200, w: 1664, h: 64 } },
    { id: 'river-bend', kind: 'water', rect: { x: 1664, y: 1264, w: 64, h: 160 } },
    { id: 'harbor-bay', kind: 'water', rect: HARBOR_BAY },
    { id: 'lowlands', kind: 'land', rect: { x: 0, y: 160, w: 2048, h: 1376 } },
  ];
}

/** True when the point is on water (river segments, bend, or harbor bay). */
export function isWater(x, y) {
  for (const s of RIVER_SEGMENTS) {
    // distance from point to river segment; river is ~64u wide
    const dx = s.x2 - s.x1; const dy = s.y2 - s.y1;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.min(1, Math.max(0, ((x - s.x1) * dx + (y - s.y1) * dy) / len2));
    const px = s.x1 + dx * t; const py = s.y1 + dy * t;
    if (Math.hypot(x - px, y - py) <= 34) return true;
  }
  const b = HARBOR_BAY;
  return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
}

/** True when the point sits in the northern mountain band. */
export const isMountain = (x, y) => y < 160 && inBounds(x, y);

/** Expansion reserves: visually quiet, future growth land (lock §2). */
export function expansionReserves() {
  return EXPANSION_RESERVES.map((r) => ({ ...r }));
}

export const terrain = { terrainRegions, isWater, isMountain, expansionReserves, RIVER_SEGMENTS, HARBOR_BAY, BRIDGES };
