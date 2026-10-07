// Project districts (V2): the featured repositories as a skyline. Each building shows its evolution level
// (five pips) and its state. The other repositories live on the kingdom map.
import { Pix, svgDoc, textW } from './pixel.mjs';
import { T, card, nameWords, demoRibbon } from './ui.mjs';
import { SEASONS } from './palette.mjs';
import * as SC from './scenery.mjs';
import { drawRepo, LEVEL_SCALE } from './growth.mjs';
import { lightLayer } from './light.mjs';
import { C, mix, lighten, darken } from './palette.mjs';
import { truncate } from '../util.mjs';

const STATE_COLOR = { failing: T.red, building: T.gold, dusty: '#94b0c2', sleepy: '#94b0c2', active: T.green, abandoned: '#566c86' };

/** Two short lines for a repository name, from its words. */
export function plateLines(name, maxChars = 8) {
  const ws = nameWords(name).map((w) => w.toUpperCase());
  const lines = []; let cur = '';
  for (const w of ws) {
    const t = cur ? `${cur} ${w}` : w;
    if (t.length <= maxChars) cur = t; else { if (cur) lines.push(cur); cur = w.length > maxChars ? `${w.slice(0, maxChars - 1)}~` : w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > 2) { lines.length = 2; if (!lines[1].endsWith('~')) lines[1] = `${lines[1].slice(0, maxChars - 1)}~`; }
  return lines;
}

export function renderDistricts(S) {
  const U = 4, GW = 160, GH = 78, W = GW * U, H = GH * U;
  const p = new Pix(U), SE = SEASONS[S.time.season], ph = S.time.phase, sc = S.scene;
  // TRUE V2: building facts come from the authoritative world repositories, not a second lookup.
  const byName = new Map(((S.world && S.world.repositories) || []).map((r) => [r.name, r]));
  const list = S.featured.map((n) => byName.get(n)).filter(Boolean);
  if (!list.length) return null;
  const lights = [], ctx = { lights, danger: [] };
  // sky, hills, ground
  p.raw(`<rect width="${W}" height="${34 * U}" fill="url(#sky)"/>`);
  SC.range(p, 0, GW - 1, 34, [[20, 12, 0.7], [70, 8, 0.8], [118, 14, 0.7], [150, 9, 0.8]], '#8da6c8', '#b6c9e0', S.time.season === 'winter' ? 6 : 3);
  p.r(0, 34, GW, GH - 34, SE.grass).r(0, 34, GW, 1, SE.grass2);
  for (let i = 0; i < 240; i++) p.r((i * 37) % GW, 36 + ((i * 53) % 40), 1, 1, i % 3 ? SE.grass2 : lighten(SE.grass, 0.18));
  p.r(0, 46, GW, 5, SE.dirt || C.dirt).r(0, 46, GW, 1, C.dirtL).r(0, 50, GW, 1, C.dirtD);
  if (ph === 'night') for (let i = 0; i < 26; i++) p.r((i * 29) % GW, 2 + ((i * 13) % 22), 1, 1, '#f4f4f4', 0.85);
  else if (ph === 'day') SC.sun(p, 140, 10);
  else SC.sun(p, ph === 'dawn' ? 22 : 140, 22, true);
  // buildings along the road
  const n = list.length, slot = GW / n, WIDTH = { tower: 16, house: 22, guild: 34, library: 28, workshop: 28, mine: 30, lab: 28 };
  // TRUE V2 (Phase 4): lighting comes from the shared world policy, not a local TINT copy.
  const LGT = S.world.lighting;
  list.forEach((r, i) => {
    const wide = WIDTH[r.archetype] || 22, big = r.level >= 3 && (slot - 4) / wide >= 1;
    const half = ((wide * (big ? 1 : 0.75)) / 2) + 3, x = Math.round(Math.max(half, Math.min(GW - half, slot * (i + 0.5)))), y = 44;
    p.r(x - 11, y - 1, 22, 2, '#000000', 0.14);
    drawRepo(p, r.archetype === 'castle' ? 'house' : r.archetype, x, y, {
      scale: big ? 1 : 0.75,
      name: r.name, level: r.level, state: r.state, recovered: r.recovered, ctx, snow: S.time.season === 'winter',
      lit: LGT.windows && ['active', 'building'].includes(r.state),
      stage: { fail: sc.stages.fail[r.name], repair: sc.stages.repair[r.name], build: sc.stages.build[r.name] },
    });
  });
  lightLayer(p, { W: GW, H: GH, tint: [LGT.tint.color, LGT.tint.alpha], lights, moon: LGT.moon, region: { x: 0, y: 0, w: GW, h: 46 } });
  // name plates and level pips (own canvas, 1 unit = 1 SVG unit)
  const h = new Pix(1);
  h.r(0, 0, W, 0, '#000');
  list.forEach((r, i) => {
    const s = 2, maxC = Math.max(6, Math.floor((slot * U - 10) / (6 * s)));
    const cx = Math.round(slot * (i + 0.5) * U), lines = plateLines(r.name, maxC);
    const pw = Math.min(slot * U - 6, maxC * 6 * s + 12);
    const y = 46 * U + 12;
    h.r(cx - pw / 2, y, pw, 10 + lines.length * 16, '#14162b', 0.9).r(cx - pw / 2, y, pw, 3, STATE_COLOR[r.state] || T.gold);
    lines.forEach((ln, k) => h.text(ln, cx, y + 8 + k * 16, s, T.white, { align: 'c' }));
    const py = y + 10 + lines.length * 16 + 6;
    for (let k = 1; k <= 5; k++) h.r(cx - 5 * 7 + (k - 1) * 14, py, 10, 8, k <= r.level ? (r.level === 5 ? T.gold : T.cyan) : '#2b2e4d').r(cx - 5 * 7 + (k - 1) * 14, py, 10, 2, k <= r.level ? '#ffffff' : '#3a3f66', k <= r.level ? 0.5 : 1);
  });
  p.raw(h.toString());
  const desc = list.map((r) => `${r.name}: ${r.evolutionName.toLowerCase()}, ${r.state}`).join('; ');
  return svgDoc({ w: W, h: H + 0, title: 'Project districts', desc: `Featured projects as buildings. ${desc}.`, body: p.toString(), defs: SC.skyDefs(ph) + p.defs.join('') });
}
