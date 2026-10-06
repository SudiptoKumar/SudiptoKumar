// Kingdom history (V2): a growth timeline, not a chart.
// A few snapshots of the kingdom (the start, every new castle tier, today), joined by a road. Each snapshot is a
// small landscape: the castle of that time, the houses of that time. Dots on the road are the levels gained.
// Pale, dashed snapshots are estimated from the contribution calendar (the same rule as V1).
import { Pix, svgDoc, textW } from './pixel.mjs';
import { T, card, demoRibbon } from './ui.mjs';
import { drawIcon } from './sprites.mjs';
import { local, ARCHETYPES } from './buildings.mjs';
import { C, SEASONS, mix, lighten, darken } from './palette.mjs';
import { castleTier } from '../rules.mjs';
import { MONTHS, fmt, diffDays } from '../util.mjs';

const label = (d) => `${MONTHS[+d.slice(5, 7) - 1]} ${d.slice(2, 4)}`;
export const houseCount = (level) => Math.min(7, 1 + Math.floor(level / 2));

/** Which points tell the story: the first one, the first point of each new castle tier, and today. At most `max`. */
export function pickSnapshots(points, max = 4) {
  if (!points.length) return [];
  const out = [points[0]];
  let tier = castleTier(points[0].l);
  for (const q of points) { const t = castleTier(q.l); if (t > tier) { out.push(q); tier = t; } }
  const last = points[points.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  while (out.length > max) out.splice(1 + Math.floor((out.length - 2) / 2), 1);   // drop from the middle
  return out;
}

function snapshot(p, x, y, w, h, q, S, { today, estimated }) {
  const SE = SEASONS[S.time.season], tier = castleTier(q.l);
  const sky = today ? ['#6cbcf7', '#a8e2fb'] : estimated ? ['#8a98b0', '#b9c3d2'] : ['#6cbcf7', '#a8e2fb'];
  const gy = y + Math.round(h * 0.62);
  p.r(x, y, w, h, sky[0]).r(x, y + 30, w, gy - y - 30, sky[1]);
  const grass = estimated ? mix(SE.grass, '#8a94a6', 0.45) : SE.grass;
  p.r(x, gy, w, y + h - gy, grass).r(x, gy, w, 2, estimated ? mix(SE.grass2, '#8a94a6', 0.4) : SE.grass2);
  for (let i = 0; i < 16; i++) p.r(x + 4 + ((i * 41) % (w - 8)), gy + 4 + ((i * 29) % (h * 0.3)), 4, 1, darken(grass, 0.12));
  // castle of that time (the tier changes the shape, the size grows with the level).
  // Castles and houses are drawn once as symbols and placed with <use>, which keeps this picture small.
  const s = tier >= 3 ? 1.1 : tier === 2 ? 1.4 : 1.8, snow = S.time.season === 'winter';
  const castleId = `hc-${tier}-${snow ? 'w' : 'n'}`;
  p.symbol(castleId, (q) => { const d = local(q, 0, 0, s, { lights: [], danger: [] }); ARCHETYPES.castle(d, { ctx: { lights: [], danger: [] }, tier, flag: C.red, lit: false, snow }); });
  p.use(castleId, x + w / 2, gy + 2);
  // the settlement: houses along the foot of the hill
  p.symbol('hh', (q) => { const d = local(q, 0, 0, 0.55, { lights: [], danger: [] }); ARCHETYPES.house(d, { ctx: { lights: [], danger: [] }, lit: false, smoke: false }); });
  const n = houseCount(q.l);
  for (let i = 0; i < n; i++) p.use('hh', x + 14 + ((i + 0.5) * (w - 28)) / n, y + h - 8 - (i % 2) * 7);
  if (estimated) p.r(x, y, w, h, '#14162b', 0.28);
  // frame: solid for a measured day, broken for an estimate
  const col = today ? T.gold : estimated ? '#566c86' : '#8a94a6';
  if (!estimated) p.frame(x - 4, y - 4, w + 8, h + 8, 4, col);
  else for (let i = 0; i < w + 8; i += 16) { p.r(x - 4 + i, y - 4, 10, 4, col).r(x - 4 + i, y + h, 10, 4, col); for (let k = 0; k < h + 8; k += 16) { p.r(x - 4, y - 4 + k, 4, 10, col).r(x + w, y - 4 + k, 4, 10, col); } }
  if (today) { p.raw('<g class="tw">').r(x + w - 18, y + 8, 3, 3, '#fff').r(x + 12, y + 20, 3, 3, '#fff').raw('</g>'); }
}

export function renderHistory(S) {
  const W = 640, H = 300;
  const pts = S.history.points, p = new Pix(1);
  card(p, W, H);
  drawIcon(p, 'book', 28, 22, 4);
  p.text(`LV ${S.level}`, 72, 26, 4, T.gold, { shadow: T.dark });
  if (S.meta.demo) demoRibbon(p, W);
  const snaps = pickSnapshots(pts, 4);
  if (pts.length < 2 || snaps.length < 2) {
    // the very first day: only a foundation and a flag
    p.r(24, 72, 592, 204, '#20223a');
    snapshot(p, 232, 92, 176, 128, { d: S.time.date, l: S.level }, S, { today: true, estimated: false });
    p.text('DAY ONE', W / 2, 240, 3, T.dim, { align: 'c' });
    return svgDoc({ w: W, h: H, title: 'Kingdom history', desc: 'The history starts today.', body: p.toString(), defs: p.defs.join('') });
  }
  const n = snaps.length, gap = 34, pw = Math.floor((592 - gap * (n - 1) - 16) / n), ph = Math.round(pw * 0.78), top = 80;
  p.r(24, 68, 592, 212, '#20223a');
  // the road under the panels
  const ry = top + ph + 20;
  p.r(40, ry, 560, 8, '#7a4a2b').r(40, ry, 560, 2, '#a86b3c');
  snaps.forEach((q, i) => {
    const x = 32 + i * (pw + gap), today = i === n - 1, est = !!q.e && !today;
    snapshot(p, x, top, pw, ph, q, S, { today, estimated: est });
    // footer: the level and the date
    const cx = x + pw / 2;
    p.text(`LV${q.l}`, cx, ry + 18, 4, today ? T.gold : est ? '#94b0c2' : T.white, { align: 'c', shadow: T.dark });
    p.text(today ? 'TODAY' : `${label(q.d)}${est ? '~' : ''}`, cx, ry + 54, 2.5, today ? T.gold : T.dim, { align: 'c' });
    // milestone dots on the road towards the next snapshot: one for each level gained
    if (i < n - 1) {
      const gained = Math.min(14, Math.max(0, snaps[i + 1].l - q.l)), x0 = x + pw + 4, x1 = x + pw + gap - 4;
      for (let k = 0; k < gained; k++) { const dx = x0 + ((k + 0.5) * (x1 - x0)) / Math.max(1, gained); p.r(Math.round(dx), ry - 7 - (k % 2) * 5, 4, 4, T.gold); }
      p.raw('<g class="bob">').r(Math.round((x0 + x1) / 2) - 3, ry - 18, 6, 4, T.cyan).raw('</g>');
    }
  });
  const desc = snaps.map((q) => `level ${q.l}, ${q.d === snaps[n - 1].d ? 'today' : q.d}${q.e ? ' (estimated)' : ''}`).join('; ');
  return svgDoc({ w: W, h: H, title: 'Kingdom history', desc: `The kingdom over time: ${desc}.`, body: p.toString(), defs: p.defs.join('') });
}
