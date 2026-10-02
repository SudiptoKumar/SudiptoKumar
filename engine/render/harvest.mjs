// The harvest graph: your contribution calendar as a small farm. The hero walks the road.
import { Pix, svgDoc, textW } from './pixel.mjs';
import { T, card, box, header } from './ui.mjs';
import { drawIcon, drawHero, drawSprite, CROP, WHEAT, NPC } from './sprites.mjs';
import { C } from './palette.mjs';
import { addDays, MONTHS, fmt, diffDays } from '../util.mjs';

const CELL = 22, COLS = 26;

export function stageFor(count, steps) {
  let s = 0;
  for (const t of steps) if (count >= t) s++;
  return s;
}

export function renderHarvest(state, ctx = {}) {
  const W = 640, H = 460;
  const steps = ctx.cfg?.cropSteps || [1, 3, 6, 10, 15];
  const cal = state.calendar;
  const p = new Pix(1);
  card(p, W, H);
  header(p, W, 'HARVEST FIELD', 'wheat', `STREAK ${state.streak}`, T.gold);

  // ----- build the grid (columns = weeks, rows = Sun..Sat) -----
  const anchor = cal.length ? cal[cal.length - 1].date : state.time.date;
  const wd = new Date(anchor + 'T00:00:00Z').getUTCDay();
  const first = addDays(anchor, -((COLS - 1) * 7 + wd));
  const byDate = new Map(cal.map((d) => [d.date, d]));
  let total = 0;
  for (let c = 0; c < COLS; c++) for (let r = 0; r < 7; r++) {
    const date = addDays(first, c * 7 + r);
    if (diffDays(date, anchor) >= 0) total += byDate.get(date)?.count || 0;
  }
  p.text(`LAST ${COLS} WEEKS`, 28, 68, 3, T.dim);
  p.text(`${fmt(total)} HARVESTS`, W - 28, 68, 3, T.white, { align: 'r' });

  // month names
  const x0 = 24 + (592 - COLS * CELL) / 2, y0 = 138;
  let lastMonth = -1, lastX = -999;
  for (let c = 0; c < COLS; c++) {
    const m = +addDays(first, c * 7).slice(5, 7) - 1;
    if (m !== lastMonth) {
      const x = x0 + c * CELL;
      if (x - lastX >= 66 && c < COLS - 2) { p.text(MONTHS[m], x, 100, 3, T.dim); lastX = x; }
      lastMonth = m;
    }
  }

  // ----- the farm -----
  p.r(24, 120, 592, 220, '#2e7d4f').r(24, 120, 592, 4, '#4fd070');
  box(p, 24, 120, 592, 220, { fill: 'rgba(0,0,0,0)', border: '#7a4a2b', t: 4, n: 4 });
  p.r(28, 124, 584, 212, '#2e7d4f');
  for (let i = 0; i < 40; i++) p.r(34 + ((i * 97) % 560), 128 + ((i * 53) % 200), 6, 2, '#3a9a5f');
  p.symbol('soil', (q) => { q.r(1, 1, 20, 20, '#6b4226').r(1, 1, 20, 2, '#8c5a36').r(1, 19, 20, 2, '#4e2f1c').r(1, 8, 20, 1, '#5e3820').r(1, 14, 20, 1, '#5e3820'); });
  p.symbol('soilg', (q) => { q.r(1, 1, 20, 20, '#8a6a2b').r(1, 1, 20, 2, '#b08a3a').r(1, 19, 20, 2, '#5e4a1c').r(1, 8, 20, 1, '#6e5420').r(1, 14, 20, 1, '#6e5420'); });
  CROP.forEach((spr, i) => { if (spr) p.symbol(`c${i}`, (q) => q.sprite(spr, 0, 0, { s: 2 })); });
  p.symbol('wheat', (q) => q.sprite(WHEAT, 0, 0, { s: 2 }));
  let todayX = 0, todayY = 0;
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < 7; r++) {
      const date = addDays(first, c * 7 + r);
      const x = x0 + c * CELL, y = y0 + r * CELL;
      if (diffDays(date, anchor) < 0) { p.r(x + 1, y + 1, 20, 20, '#256b43'); continue; }
      const d = byDate.get(date) || { count: 0 };
      p.use(d.gold && d.count > 0 ? 'soilg' : 'soil', x, y);
      const st = stageFor(d.count, steps);
      if (st > 0) p.use(d.gold ? 'wheat' : `c${st}`, x + 1, y + 1);
      if (date === anchor) { todayX = x; todayY = y; }
    }
  }
  if (todayX) {
    p.frame(todayX, todayY, CELL, CELL, 2, '#fff0a0');
    p.raw('<g class="bob">').sprite(drawArrow, todayX + 4, todayY - 14, { s: 2 }).raw('</g>');
  }

  // ----- the road: the hero walks here -----
  p.r(28, 296, 584, 36, '#b98a54').r(28, 296, 584, 3, '#d3a66e').r(28, 329, 584, 3, '#94683c');
  for (let i = 0; i < 18; i++) p.r(40 + i * 33, 306 + ((i * 7) % 18), 8, 2, '#a07846');
  // barn on the left, castle on the right
  p.r(34, 262, 38, 34, '#b13e53').r(34, 262, 38, 4, '#ef7d57').r(30, 256, 46, 8, '#5d275d').r(44, 274, 18, 22, '#7a4a2b').r(46, 276, 14, 18, '#a86b3c').r(52, 276, 2, 18, '#4e2f1c');
  p.r(570, 258, 36, 38, '#8a94a6').r(566, 252, 8, 8, '#8a94a6').r(578, 252, 8, 8, '#8a94a6').r(590, 252, 8, 8, '#8a94a6').r(602, 252, 8, 8, '#8a94a6').r(582, 276, 12, 20, '#4e2f1c');
  const h = state.hero;
  const range = h.sleeping || h.activity === 'low' ? 0 : h.activity === 'high' ? 470 : 250;
  const hy = 298;
  if (range === 0) {
    p.sprite(NPC.sleeper, 92, 312, { s: 3 });
    for (let i = 0; i < 3; i++) p.raw(`<g class="zz" style="animation-delay:${-i}s">`).text('Z', 118 + i * 8, 296 - i * 6, 2.5, T.white).raw('</g>');
  } else {
    const dur = Math.round(range / 14);
    p.raw(`<g class="wk" style="--dx:${range}px;--t:${dur * 2}s"><g class="fc" style="--t:${dur * 2}s">`);
    p.raw('<g class="bob">').sprite(heroSpr(h.class.archetype), 84, hy, { s: 2 }).raw('</g>').raw('</g></g>');
  }
  // a farmer walks too
  p.raw('<g class="wk" style="--dx:200px;--t:24s;animation-delay:-8s"><g class="fc" style="--t:24s;animation-delay:-8s">').raw('<g class="bob">').sprite(NPC.farmer, 330, 306, { s: 3 }).raw('</g></g></g>');
  if (h.position === 'plaza') for (let i = 0; i < 6; i++) p.raw(`<g class="cf" style="animation-delay:${-i * 0.8}s">`).r(120 + i * 70, 130 + ((i * 37) % 60), 5, 5, [C.red, C.yellow, C.cyan, C.lime][i % 4]).raw('</g>');

  // ----- legend -----
  p.text('CONTRIBUTIONS PER DAY', 28, 356, 3, T.dim);
  const items = [[0, '0'], [1, `${steps[0]}+`], [2, `${steps[1]}+`], [3, `${steps[2]}+`], [4, `${steps[3]}+`], [5, `${steps[4]}+`]];
  items.forEach(([st, label], i) => {
    const x = 28 + i * 98;
    p.r(x, 386, 22, 22, '#6b4226');
    if (st > 0) p.sprite(CROP[st], x + 1, 387, { s: 2 });
    p.text(label, x + 30, 392, 3, T.white);
  });
  p.r(28, 420, 22, 22, '#8a6a2b').sprite(WHEAT, 29, 421, { s: 2 });
  p.text('7 DAY RUN = GOLD', 60, 426, 3, '#e0a030');
  return svgDoc({
    w: W, h: H, title: 'Harvest field',
    desc: `A farm made from the last ${COLS} weeks of contributions. ${fmt(total)} contributions. Current streak ${state.streak} days. Golden crops mark runs of seven days or more.`,
    body: p.toString(), defs: p.defs.join(''),
  });
}

import { makeSprite } from './pixel.mjs';
const drawArrow = makeSprite(['YYYYYYY', '.YYYYY.', '..YYY..', '...Y...'], { Y: '#fff0a0' });
// a tiny hero for the road (no items)
import { HERO_STYLE } from './sprites.mjs';
import { makeSprite as ms } from './pixel.mjs';
const heroCache = new Map();
function heroSpr(arch) {
  if (!heroCache.has(arch)) {
    const tmp = new Pix(1);
    heroCache.set(arch, (q, x, y, o) => drawHero(q, x, y, arch, { ...o, items: false }));
  }
  return { __fn: heroCache.get(arch) };
}
