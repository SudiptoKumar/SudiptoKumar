// 19 districts straight from the lock. Rects, anchors, and purposes are the
// canonical geography — nothing here is invented.
import { DISTRICTS, densityTier } from './constants.mjs';

/** All 19 districts, in lock order. */
export function districts() {
  return DISTRICTS.map((d) => ({
    id: d.id,
    rect: { x: d.rect[0], y: d.rect[1], w: d.rect[2], h: d.rect[3] },
    purpose: d.purpose,
    anchors: d.anchors.map((a) => ({ id: a.id, x: a.x, y: a.y })),
  }));
}

export const districtById = (id) => districts().find((d) => d.id === id) ?? null;

/** First district (lock order) containing the point, or null. */
export function districtAt(x, y) {
  for (const d of districts()) {
    const r = d.rect;
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return d;
  }
  return null;
}

/** Every anchor in the kingdom, tagged with its district. */
export function allAnchors() {
  const out = [];
  for (const d of districts()) for (const a of d.anchors) out.push({ ...a, district: d.id });
  return out;
}

export const anchorById = (id) => allAnchors().find((a) => a.id === id) ?? null;

/**
 * Attach the deterministic density tier for a kingdom power tier.
 * 'event' tier applies when a celebration/war event is active.
 */
export function districtsWithDensity(powerTier, eventActive = false) {
  const tier = densityTier(powerTier, eventActive);
  return districts().map((d) => ({ ...d, density: tier }));
}
