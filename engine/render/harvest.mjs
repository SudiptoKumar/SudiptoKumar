// The harvest field (V2): your contribution calendar as a farm that belongs to the kingdom.
// Same sky, season and light as the map. Soil -> planted -> sprouting -> growing -> mature -> golden harvest.
// A streak is drawn as one golden, continuous harvest. Numbers live in a compact header; the farm has no legend.
import { Pix, svgDoc } from './pixel.mjs';
import { T, card, demoRibbon } from './ui.mjs';
import { drawIcon, CROP, WHEAT, ICON, drawSprite, TREE_OAK, TREE_PINE } from './sprites.mjs';
import { drawHeroPose, npcWalk, npcStand } from './actors.mjs';
import { C, SEASONS, lighten, darken, mix } from './palette.mjs';
import { skyFor } from '../world/lighting.mjs';
import { lightLayer } from './light.mjs';
import * as SC from './scenery.mjs';
import { addDays, fmt, diffDays } from '../util.mjs';
import { rng } from '../util.mjs';
import { fieldLayout } from '../world/farm.mjs';

const CELL = 22, COLS = 26;
// kept as a cross-check: the world's stageFor must agree with this one (see truev2.test.mjs)
export const stageFor = (count, steps) => { let s = 0; for (const t of steps) if (count >= t) s++; return s; };

export function renderHarvest(S, ctx = {}) {
  const W = 640, H = 372;
  const sc = S.scene, ph = S.time.phase, SE = SEASONS[S.time.season], winter = S.time.season === 'winter';
  // TRUE V2 (Phase 4): lighting comes from the shared world policy.
  const LGT = S.world.lighting;
  // TRUE V2: the field is the authoritative world farm model — plots, stages, streak, total all come from it.
  const farm = S.world.farm, fl = fieldLayout(farm);
  const p = new Pix(1), lights = [], rnd = rng('farm:' + S.profile.login);
  card(p, W, H);

  // ---- grid: columns = weeks, rows = Sun..Sat
  const anchor = fl.anchor || S.time.date;
  const wd = new Date(anchor + 'T00:00:00Z').getUTCDay();
  const first = fl.first || addDays(anchor, -((COLS - 1) * 7 + wd));
  const byDate = new Map(farm.plots.map((pl) => [pl.date, pl]));
  const total = farm.total;

  // ---- compact header: icon + number, nothing else
  drawIcon(p, 'wheat', 28, 22, 4); p.text(String(farm.streak), 70, 26, 4, T.gold, { shadow: T.dark });
  p.text('DAY STREAK', 70 + String(farm.streak).length * 24 + 12, 34, 2, T.dim);
  drawIcon(p, 'moneybag', W - 28 - 8 * 4 - 8 - String(fmt(total)).length * 24, 22, 4); p.text(fmt(total), W - 28, 26, 4, T.white, { align: 'r', shadow: T.dark });
  if (S.meta.demo) demoRibbon(p, W);

  // ---- the countryside behind the field (sky for the hour, hills, barn, windmill, trees)
  // TRUE V2 (Phase 4): the sky comes from the shared skyFor table — no local copy.
  const sx = 24, sy = 60, sw = 592, sh = 66;
  const [sa, sb] = skyFor(ph).slice(1, 3);
  p.r(sx, sy, sw, sh, sa).r(sx, sy + 30, sw, sh - 30, sb);
  if (ph === 'night') for (let i = 0; i < 30; i++) p.r(sx + 6 + ((i * 53) % 580), sy + 4 + ((i * 17) % 40), 2, 2, '#f4f4f4', 0.8);
  else p.ellipse(sx + 520, sy + 22, 10, 10, '#ffcd75').ellipse(sx + 520, sy + 22, 7, 7, '#fff0a0');
  if (ph === 'night') p.ellipse(sx + 520, sy + 22, 10, 10, '#f4f4f4').ellipse(sx + 524, sy + 19, 8, 8, sa);
  // hills
  for (let x = 0; x < sw; x += 2) { const h = 14 + Math.round(8 * Math.sin(x / 55) + 5 * Math.sin(x / 23 + 1)); p.r(sx + x, sy + sh - h, 2, h, winter ? '#dfe9f2' : darken(SE.grass, 0.18)); }
  // barn
  p.r(sx + 28, sy + 26, 54, 40, '#b13e53').r(sx + 28, sy + 26, 54, 4, '#ef7d57').r(sx + 22, sy + 16, 66, 12, '#5d275d').r(sx + 22, sy + 16, 66, 3, '#8c4a9a').r(sx + 44, sy + 38, 22, 28, '#7a4a2b').r(sx + 54, sy + 38, 2, 28, '#4e2f1c').r(sx + 46, sy + 42, 8, 2, '#a86b3c');
  p.r(sx + 50, sy + 22, 10, 6, '#f4e0b0'); lights.push({ x: sx + 52, y: sy + 23, w: 6, h: 4 });
  if (winter) p.r(sx + 22, sy + 16, 66, 3, '#f4f8fc');
  // windmill: the blades turn slowly
  p.r(sx + 470, sy + 24, 30, 42, '#e8d5a8').r(sx + 470, sy + 24, 30, 3, '#f4e8c8').r(sx + 464, sy + 14, 42, 12, '#7a4a2b').r(sx + 480, sy + 44, 10, 22, '#7a4a2b');
  p.raw(`<g class="sp" style="transform-origin:${sx + 485}px ${sy + 20}px;animation:sp 12s linear infinite">`);
  p.r(sx + 483, sy - 8, 4, 28, '#a86b3c').r(sx + 465, sy + 18, 40, 4, '#a86b3c').r(sx + 478, sy - 2, 14, 4, '#f4f4f4', 0.7);
  p.raw('</g>');
  // trees
  for (const tx of [150, 215, 330, 395, 560]) drawSprite(p, tx % 2 ? TREE_PINE : TREE_OAK, sx + tx, sy + sh - 30 + ((tx * 7) % 6), { s: 3, pal: winter ? { L: '#2c6b6a', l: '#eef6fb', D: '#1b4a55', t: '#5e3820' } : { L: S.time.season === 'autumn' ? '#ef7d57' : '#2f9e5b', l: S.time.season === 'autumn' ? '#ffcd75' : S.time.season === 'spring' ? '#ffc8e0' : '#4fd070', D: S.time.season === 'autumn' ? '#b13e53' : '#257179', t: '#7a4a2b' } });

  // ---- the field
  const x0 = 24 + (592 - COLS * CELL) / 2, y0 = 142;
  p.r(24, 126, 592, 176, '#7a4a2b').r(28, 130, 584, 168, SE.grass);
  for (let i = 0; i < 60; i++) p.r(32 + ((i * 97) % 570), 132 + ((i * 53) % 160), 6, 2, SE.grass2);
  for (let i = 0; i < 74; i++) p.r(24 + i * 8, 120, 3, 8, '#a86b3c');                                       // fence
  p.r(24, 122, 592, 3, '#a86b3c');
  p.symbol('soil', (q) => q.r(1, 1, 20, 20, '#6b4226').r(1, 1, 20, 2, '#8c5a36').r(1, 19, 20, 2, '#4e2f1c').r(1, 8, 20, 1, '#5e3820').r(1, 14, 20, 1, '#5e3820'));
  p.symbol('soilg', (q) => q.r(1, 1, 20, 20, '#8a6a2b').r(1, 1, 20, 2, '#b08a3a').r(1, 19, 20, 2, '#5e4a1c').r(1, 8, 20, 1, '#6e5420').r(1, 14, 20, 1, '#6e5420'));
  p.symbol('frost', (q) => q.r(1, 1, 20, 20, '#ffffff', 0.35));
  CROP.forEach((spr, i) => { if (spr) p.symbol(`c${i}`, (q) => q.sprite(spr, 0, 0, { s: 2 })); });
  p.symbol('wheat', (q) => q.sprite(WHEAT, 0, 0, { s: 2 }));

  // the streak = the last N days. Mark its cells so the harvest reads as one golden body.
  const idx = new Map();           // date -> [col,row]
  const cells = [];
  for (let c = 0; c < COLS; c++) for (let r = 0; r < 7; r++) { const date = addDays(first, c * 7 + r); idx.set(date, [c, r]); }
  const streakDates = new Set();
  for (let k = 0; k < farm.streak; k++) { const d = addDays(anchor, -k); if (idx.has(d)) streakDates.add(d); }
  let todayX = 0, todayY = 0;
  for (let c = 0; c < COLS; c++) for (let r = 0; r < 7; r++) {
    const date = addDays(first, c * 7 + r), x = x0 + c * CELL, y = y0 + r * CELL;
    if (diffDays(date, anchor) < 0) { p.r(x + 1, y + 1, 20, 20, darken(SE.grass, 0.12)); continue; }
    const d = byDate.get(date);
    p.use(d?.gold ? 'soilg' : 'soil', x, y);
    const st = d?.stage || 0;
    if (st > 0) p.use(d.gold ? 'wheat' : `c${st}`, x + 1, y + 1); else if (winter) p.use('frost', x, y);
    if (d?.gold && (c + r) % 3 === 0) p.raw(`<g class="tw" style="animation-delay:${-((c * 3 + r) % 7) * 0.4}s">`).r(x + 6 + ((c * 5) % 9), y + 4 + ((r * 3) % 8), 2, 2, '#fff6a0').raw('</g>');
    if (date === anchor) { todayX = x; todayY = y; }
  }
  // golden outline round the streak (only the outer edges, so it is one shape)
  p.raw('<g class="pu" style="animation-duration:4s">');
  for (const date of streakDates) {
    const [c, r] = idx.get(date), x = x0 + c * CELL, y = y0 + r * CELL;
    const has = (dc, dr) => { const rr = r + dr, cc = c + dc; if (rr < 0 || rr > 6) return false; if (cc < 0 || cc >= COLS) return false; return streakDates.has(addDays(first, cc * 7 + rr)); };
    if (!has(0, -1)) p.r(x, y, CELL, 2, '#fff0a0'); if (!has(0, 1)) p.r(x, y + CELL - 2, CELL, 2, '#fff0a0');
    if (!has(-1, 0)) p.r(x, y, 2, CELL, '#fff0a0'); if (!has(1, 0)) p.r(x + CELL - 2, y, 2, CELL, '#fff0a0');
  }
  p.raw('</g>');
  if (todayX) { p.raw('<g class="bob">'); drawSprite(p, ICON.arrow, todayX + 3, todayY - 18, { s: 2 }); p.raw('</g>'); }

  // ---- the road: the hero and the farmers work here
  p.r(24, 302, 592, 40, '#b98a54').r(24, 302, 592, 3, '#d3a66e').r(24, 339, 592, 3, '#94683c');
  for (let i = 0; i < 18; i++) p.r(40 + i * 33, 314 + ((i * 7) % 18), 8, 2, '#a07846');
  const hs = S.world.hero.state, pose = hs === 'fighting' ? 'idle' : hs;
  if (pose === 'sleeping') { p.r(sx + 30, 310, 50, 24, '#3a2214', 0.0); drawHeroPose(p, 300, 306, S.hero.class.archetype, 'sleeping', { s: 2.2 }); }
  else { p.ellipse(318, 338, 14, 3, '#000000', 0.25); drawHeroPose(p, 300, 292, S.hero.class.archetype, pose === 'traveling' ? 'walking' : pose === 'idle' ? 'idle' : pose, { s: 3 }); }
  const farmers = sc.behavior.farmersIn ? 0 : Math.min(3, sc.npcs.farmer);
  for (let i = 0; i < farmers; i++) npcWalk(p, 'farmer', 60 + i * 150, 336, { dx: 130, s: 2.5, t: 16 + i * 3, delay: i * 5 });
  if (sc.fx.includes('harvestFestival')) { const cols = [C.red, C.yellow, C.cyan, C.lime]; for (let i = 0; i < 30; i++) p.raw(`<g class="${i % 2 ? 'f1' : 'f2'}">`).r(28 + i * 19, 114, 6, 6, cols[i % 4]).raw('</g>'); }
  // lamp posts on the road (lit when it is dark)
  for (const lx of [90, 540]) { p.r(lx, 306, 3, 28, '#4e2f1c'); if (LGT.torches) { p.raw('<g class="fl">').r(lx - 3, 298, 9, 8, C.orange).r(lx, 294, 3, 4, C.yellow).raw('</g>'); lights.push({ x: lx - 3, y: 298, w: 9, h: 8, glow: 1 }); } else p.r(lx - 3, 298, 9, 8, '#566c86'); }

  // ---- weather and light (TRUE V2, Phase 4: the shared world lighting policy)
  if (sc.weather.rain) SC.rain(p, rnd, sc.weather.rain > 1, { w: 148, h: 93 });
  else if (S.time.season === 'winter') SC.fallers(p, rnd, 'winter', { w: 148, h: 93 });
  lightLayer(p, { W, H, tint: [LGT.tint.color, LGT.tint.alpha], lights, moon: false, region: { x: 24, y: 60, w: 592, h: 282 } });
  return svgDoc({
    w: W, h: H, title: 'Harvest field',
    desc: `Contributions of the last ${COLS} weeks as crops. Streak ${farm.streak} days, shown as a golden harvest. ${fmt(total)} harvests in total.`,
    body: p.toString(), defs: p.defs.join(''),
  });
}
