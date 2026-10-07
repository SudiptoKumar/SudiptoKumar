// hud.mjs — L10: small top status strip, event banner, hero state chip,
// quest marker, small building labels. Panels used sparingly; no
// dashboard chrome (spec §04.9). All text escaped; vector only.
import { R, T, C, P, LN, G } from './svg.mjs';
import { esc } from '../util.mjs';
import { activeStory } from './camera.mjs';

const prettify = (s) => String(s ?? '').replace(/^(landmark|repo|plot)-/, '').replace(/_/g, ' ')
  .replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 26);

function pill(x, y, w, h, fill, opacity) {
  const r = Math.min(10, h / 2);
  return `<rect x="${Math.round(x)}" y="${Math.round(y)}" width="${Math.round(w)}" height="${Math.round(h)}"`
    + ` rx="${r}" fill="${fill}" opacity="${opacity}"/>`;
}

/** Top status strip: identity, time, weather, power — one quiet line.
 * Right-aligned: the castle dominates the top-center, so the HUD lives in
 * the top-right corner clear of it. */
function statusStrip(world, snap, ctx, rect, fs) {
  const k = world.kingdom ?? {};
  const bits = [String(k.name ?? 'Kingdom').slice(0, 24), ctx.band, ctx.season, ctx.pal.weather, k.powerTier]
    .filter(Boolean)
    .map((b) => esc(String(b)));
  const text = bits.join(' · ');
  const w = text.length * fs * 0.62 + fs * 1.6;
  const h = fs * 1.9;
  const x = rect.x + rect.w - w - fs * 0.8, y = rect.y + fs * 0.6;
  return G(pill(x, y, w, h, '#141a26', 0.78)
    + T(x + fs * 0.8, y + h * 0.68, text, fs, '#e8dcc0'), { 'aria-hidden': 'true' });
}

/** Event banner: only when something meaningful is happening. Right-aligned
 * under the status strip. */
function eventBanner(world, snap, rect, fs) {
  const story = activeStory(world, snap);
  if (!story) return '';
  const phase = story.phase ? ` — ${esc(String(story.phase)).toLowerCase().replace(/_/g, ' ')}` : '';
  const anchor = story.anchor ? ` · ${esc(String(story.anchor).replace(/_/g, ' '))}` : '';
  const text = `» ${esc(String(story.title).slice(0, 52))}${phase}${anchor}`;
  const w = text.length * fs * 0.62 + fs * 1.6;
  const h = fs * 1.9;
  const x = rect.x + rect.w - w - fs * 0.8, y = rect.y + fs * 0.6 + fs * 2.4;
  return G(pill(x, y, w, h, '#5e3a1e', 0.85)
    + T(x + fs * 0.8, y + h * 0.68, text, fs, '#f7d774'), { 'aria-hidden': 'true' });
}

/** Hero state chip: who, doing what, heading where. */
function heroChip(snap, ctx, rect, fs) {
  const hero = (snap.actors ?? []).find((a) => a.id === 'hero');
  if (!hero) return '';
  const dest = hero.destinationKind && hero.destinationKind !== 'routine'
    ? ` → ${esc(String(hero.destinationKind).replace(/-/g, ' '))}` : '';
  const text = `${esc(String(hero.name ?? 'Hero').slice(0, 18))} · ${esc(String(hero.state ?? 'idle').replace(/-/g, ' '))}${dest}`;
  const w = text.length * fs * 0.62 + fs * 1.6;
  const h = fs * 1.9;
  const x = rect.x + fs * 0.8, y = rect.y + rect.h - h - fs * 0.6;
  return G(pill(x, y, w, h, '#1d2433', 0.8)
    + T(x + fs * 0.8, y + h * 0.68, text, fs, '#bfe0f2'), { 'aria-hidden': 'true' });
}

/** Quest marker: flag + ring at the hero's destination anchor (world-space). */
function questMarker(world, snap, ctx) {
  const hero = (snap.actors ?? []).find((a) => a.id === 'hero');
  if (!hero || !hero.destinationKind || hero.destinationKind === 'routine') return '';
  const nodeId = { war: 'war_front', 'ci-failure': 'automation_fortress', release: 'royal_plaza', achievement: 'hall_of_heroes', visitor: 'visitor_camp' }[hero.destinationKind];
  if (!nodeId) return '';
  const n = (world.roads.nodes ?? []).find((nd) => nd.id === nodeId);
  if (!n) return '';
  const s = 1; // world units marker
  return G(
    C(n.x, n.y, 26, 'none', { stroke: '#f2c14e', 'stroke-width': 4, opacity: 0.9 })
    + LN(n.x, n.y, n.x, n.y - 44, '#8a5a33', 4)
    + P([[n.x, n.y - 44], [n.x + 26, n.y - 37], [n.x, n.y - 30]], '#f2c14e'),
    { 'aria-hidden': 'true' });
}

/** Small labels over landmark buildings (LOD1+), capped. */
function buildingLabels(world, ctx, rect, fs) {
  if (ctx.lod < 1) return '';
  const LANDMARK = new Set(['castle', 'guild_hall', 'fortress', 'library', 'market_hall', 'mill', 'shrine', 'observatory', 'barracks']);
  const vis = world.buildings
    .filter((b) => LANDMARK.has(b.archetype))
    .filter((b) => b.x < rect.x + rect.w && b.x + b.w > rect.x && b.y < rect.y + rect.h && b.y + b.h > rect.y)
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .slice(0, 10);
  let s = '';
  for (const b of vis) {
    const label = esc(prettify(b.archetype));
    const cx = b.x + b.w / 2;
    const ly = b.y - 14;
    const w = label.length * fs * 0.62 + fs;
    s += G(pill(cx - w / 2, ly - fs * 1.5, w, fs * 1.7, '#141a26', 0.65)
      + T(cx, ly - fs * 0.28, label, fs, '#e8dcc0', { 'text-anchor': 'middle' }), { 'aria-hidden': 'true' });
  }
  return s;
}

export function paintHud(world, snap, ctx, camera) {
  const rect = camera.rect;
  const fs = Math.max(13, Math.round(rect.w * 0.02)); // ≥13u keeps mobile legible
  let s = statusStrip(world, snap, ctx, rect, fs);
  s += eventBanner(world, snap, rect, fs);
  s += heroChip(snap, ctx, rect, fs);
  if (ctx.lod >= 1) s += questMarker(world, snap, ctx);
  s += buildingLabels(world, ctx, rect, fs);
  return `<g id="k-hud">${s}</g>`;
}
