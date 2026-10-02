// Buildings. All numbers are art pixels. (0, 0) is the middle of the ground line, y goes up as a minus.
import { C, mix, lighten, darken } from './palette.mjs';
import { ICON, NPC, drawSprite } from './sprites.mjs';
import { hash32 } from '../util.mjs';

/** Draws into p with its own origin and scale. */
export function local(p, ox, oy, s, ctx = {}) {
  const d = {
    p, s, ox, oy, ctx,
    r: (x, y, w, h, c, op) => p.r(ox + x * s, oy + y * s, w * s, h * s, c, op),
    sprite: (spr, x, y, o = {}) => drawSprite(p, spr, ox + x * s, oy + y * s, { s, ...o }),
    anim: (cls, style, fn) => { p.raw(`<g class="${cls}"${style ? ` style="${style}"` : ''}>`); fn(d); p.raw('</g>'); },
    /** window: glass now, glow later (after the night tint) */
    win: (x, y, w, h, lit) => {
      d.r(x, y, w, h, '#3b5dc9'); d.r(x, y, w, 1, '#73eff7');
      if (lit) {
        if (ctx.lights) ctx.lights.push({ x: ox + x * s, y: oy + y * s, w: w * s, h: h * s });
        else d.r(x, y, w, h, '#ffe08a');
      }
    },
    torch: (x, y, lit = true) => {
      d.r(x, y, 1, 3, '#7a4a2b');
      if (lit) {
        d.anim('fl', '', () => { d.r(x - 1, y - 2, 3, 2, C.orange); d.r(x, y - 3, 1, 1, C.yellow); });
        if (ctx.lights) ctx.lights.push({ x: ox + (x - 1) * s, y: oy + (y - 2) * s, w: 3 * s, h: 2 * s, glow: 1 });
      }
    },
  };
  return d;
}

// ---------------------------------------------------------------- pieces
function stone(d, x, y, w, h, c = [C.stone, C.stoneD, C.stoneL]) {
  d.r(x, y, w, h, c[0]);
  for (let yy = 2; yy < h; yy += 3) d.r(x, y + yy, w, 1, c[1]);
  for (let k = 0, yy = 0; yy < h; yy += 3, k++) for (let xx = (k % 2) * 2; xx < w; xx += 4) d.r(x + xx, y + yy, 1, 2, c[1]);
  d.r(x, y, w, 1, c[2]);
  d.r(x + w - 1, y, 1, h, c[1]);
}
function crenel(d, x, y, w, c = C.stone, dk = C.stoneD) {
  for (let xx = 0; xx < w; xx += 4) { d.r(x + xx, y - 2, 2, 2, c); d.r(x + xx, y - 1, 2, 1, dk); }
}
function roofTri(d, cx, top, half, c1, c2, snow) {
  for (let i = 0; i < half; i++) {
    d.r(cx - i - 1, top + i, 2 * (i + 1), 1, i % 3 === 2 ? c2 : c1);
    d.r(cx - i - 1, top + i, 1, 1, c2); d.r(cx + i, top + i, 1, 1, c2);
    if (snow && i < 2) d.r(cx - i - 1, top + i, 2 * (i + 1), 1, '#f4f8fc');
  }
  if (snow) { d.r(cx - half, top + half - 1, 2, 1, '#f4f8fc'); d.r(cx + half - 2, top + half - 1, 2, 1, '#f4f8fc'); }
}
function cone(d, cx, top, half, c1, c2, snow) {
  for (let i = 0; i < half; i++) {
    const w = Math.min(2 * (i + 1), 2 * half);
    d.r(cx - Math.ceil(w / 2), top + i, w + (w % 2 ? 0 : 0), 1, i % 2 ? c2 : c1);
  }
  if (snow) d.r(cx - 1, top, 2, 2, '#f4f8fc');
}
function wall(d, x, y, w, h, light = '#e8d5a8', shade = '#c9b388') {
  d.r(x, y, w, h, light); d.r(x, y + h - 1, w, 1, shade); d.r(x + w - 2, y, 2, h - 1, mix(light, shade, 0.5));
}
function door(d, x, y, w, h) {
  d.r(x, y, w, h, '#7a4a2b'); d.r(x, y, w, 1, '#a86b3c'); d.r(x + w - 2, y + Math.floor(h / 2), 1, 1, C.yellow); d.r(x + 1, y + 1, 1, h - 1, '#5e3820');
}
const pick = (name, arr) => arr[hash32(String(name)) % arr.length];
const ROOFS = [['#b13e53', '#8c2f43'], ['#3b5dc9', '#29366f'], ['#257179', '#1b5560'], ['#ef7d57', '#b5593a'], ['#5d275d', '#3f1a3f'], ['#7a4a2b', '#4e2f1c']];

// ---------------------------------------------------------------- effects
export function smoke(d, x, y, dark = false) {
  for (let i = 0; i < 3; i++) d.anim('sm', `animation-delay:${-i * 1.05}s`, () => { d.r(x, y, 2, 2, dark ? '#566c86' : '#d6dde6'); });
}
export function fire(d, x, y) {
  d.anim('f1', '', () => d.sprite(ICON.flame, x - 4, y - 8));
  d.anim('f2', '', () => d.sprite(ICON.flame, x - 4, y - 8, { flip: true }));
  if (d.ctx.lights) d.ctx.lights.push({ x: d.ox + (x - 3) * d.s, y: d.oy + (y - 7) * d.s, w: 6 * d.s, h: 6 * d.s, glow: 2 });
}
function warnFlag(d, x, y) {
  d.r(x, y - 10, 1, 10, '#4e2f1c');
  d.anim('fl', '', () => { d.r(x + 1, y - 10, 5, 4, C.red); d.r(x + 1, y - 10, 5, 1, C.orange); d.r(x + 3, y - 9, 1, 2, C.white); });
}
function scaffold(d, x0, x1, top) {
  const w = x1 - x0;
  d.r(x0, top, 1, -top, '#a86b3c'); d.r(x1, top, 1, -top, '#a86b3c');
  for (let y = top + 3; y < 0; y += 5) d.r(x0, y, w + 1, 1, '#d3a66e');
  for (let y = top + 4; y < -1; y += 5) { d.r(x0 + 1, y, 1, 1, '#a86b3c'); d.r(x1 - 1, y + 1, 1, 1, '#a86b3c'); }
}
function crates(d, x, y) {
  d.r(x, y - 4, 4, 4, '#a86b3c'); d.r(x, y - 4, 4, 1, '#d3a66e'); d.r(x + 1, y - 3, 2, 2, '#7a4a2b');
  d.r(x + 4, y - 3, 3, 3, '#7a4a2b'); d.r(x + 4, y - 3, 3, 1, '#a86b3c');
}
function dust(d, x, y, w) {
  for (let i = 0; i < 5; i++) d.r(x + Math.round(((i * 7 + 3) % w)), y - (i % 2), 2, 1, '#b8c2d0', 0.7);
}
function vines(d, x, y, h) {
  for (let i = 0; i < h; i++) d.r(x + (i % 4 < 2 ? 0 : 1), y - i, 1, 1, '#2f9e5b');
  for (let i = 1; i < h; i += 3) d.r(x + (i % 4 < 2 ? 1 : -1), y - i, 1, 1, '#4fd070');
}
function web(d, x, y) { d.r(x, y, 1, 1, '#f4f4f4', 0.8); d.r(x + 1, y + 1, 1, 1, '#f4f4f4', 0.8); d.r(x + 2, y + 2, 1, 1, '#f4f4f4', 0.8); d.r(x + 2, y, 1, 1, '#f4f4f4', 0.6); }
function sparkle(d, x, y, delay) { d.anim('tw', `animation-delay:${delay}s`, () => { d.r(x, y - 1, 1, 3, C.yellow); d.r(x - 1, y, 3, 1, C.yellow); }); }
export function builder(d, x, y, work = true) {
  const spr = NPC.builder;
  d.anim(work ? 'bob' : '', '', () => d.sprite(spr, x, y - spr.h));
  if (work) d.anim('f1', '', () => { d.r(x + 6, y - 6, 1, 1, C.yellow); d.r(x + 7, y - 7, 1, 1, C.white); });
}
function sleeper(d, x, y) {
  d.sprite(NPC.sleeper, x, y - NPC.sleeper.h);
  for (let i = 0; i < 2; i++) d.anim('zz', `animation-delay:${-i * 1.5}s`, () => { d.r(x + 4, y - 11, 3, 1, C.white); d.r(x + 5, y - 10, 1, 1, C.white); d.r(x + 4, y - 9, 3, 1, C.white); });
}

/** State effects: fire, scaffolds, dust, vines ... `b` = size of the building. */
export function stateFx(d, o, b) {
  const st = o.state || 'active';
  if (o.recovered) { sparkle(d, b.x0 + 2, b.top + 4, 0); sparkle(d, b.x1 - 2, b.top + 8, -1); sparkle(d, 0, b.top - 2, -2); }
  if (st === 'failing') { fire(d, 0, b.top + 3); smoke(d, 0, b.top - 6, true); smoke(d, 3, b.top - 4, true); warnFlag(d, b.x1 + 2, 0); }
  else if (st === 'building') { scaffold(d, b.x1 - 6, b.x1 + 1, b.top + 4); crates(d, b.x0 - 8, 0); builder(d, b.x1 + 3, 0, true); }
  else if (st === 'active') { builder(d, b.x1 + 3, 0, false); }
  else if (st === 'dusty') { dust(d, b.x0 - 2, 0, b.x1 - b.x0 + 4); vines(d, b.x0 + 1, 0, 8); web(d, b.x0 + 2, b.top + 6); sleeper(d, b.x1 + 2, 0); }
  else if (st === 'abandoned') { d.r(-3, b.top + 6, 6, 4, C.ink, 0.65); vines(d, b.x0 + 1, 0, 12); vines(d, b.x1 - 1, 0, 9); dust(d, b.x0 - 2, 0, b.x1 - b.x0 + 4); web(d, b.x1 - 4, b.top + 6); }
}

// ---------------------------------------------------------------- archetypes
function house(d, o) {
  const [r1, r2] = pick(o.name || 'x', ROOFS);
  const lit = o.lit;
  wall(d, -9, -10, 18, 10);
  roofTri(d, 0, -20, 11, r1, r2, o.snow);
  door(d, -2, -6, 4, 6);
  d.win(-7, -8, 3, 3, lit); d.win(4, -8, 3, 3, lit);
  d.r(5, -22, 3, 7, C.stone); d.r(5, -22, 3, 1, C.stoneD);
  if (o.smoke) smoke(d, 6, -24);
  return { x0: -11, x1: 11, top: -22 };
}
function castle(d, o) {
  const t = o.tier || 3;
  const roof = t >= 3 ? ['#ffcd75', '#e0a030'] : ['#b13e53', '#8c2f43'];
  stone(d, -22, -12, 44, 12); crenel(d, -22, -12, 44);
  if (t >= 2) for (const sx of [-24, 14]) {
    stone(d, sx, -30, 10, 30); crenel(d, sx, -30, 10);
    cone(d, sx + 5, -40, 10, roof[0], roof[1], o.snow);
    d.win(sx + 4, -24, 2, 4, o.lit); d.win(sx + 4, -12, 2, 4, o.lit);
    d.r(sx + 5, -48, 1, 8, '#4e2f1c'); d.r(sx + 6, -48, 4, 3, o.flag || C.red);
  }
  stone(d, -10, -32, 20, 32); crenel(d, -10, -32, 20);
  if (t >= 4) { stone(d, -4, -38, 8, 6); crenel(d, -4, -38, 8); }
  d.r(0, -(t >= 4 ? 50 : 44), 1, 12, '#4e2f1c');
  d.anim('fl', '', () => d.r(1, -(t >= 4 ? 50 : 44), 6, 4, o.flag || C.red));
  d.win(-7, -26, 3, 5, o.lit); d.win(4, -26, 3, 5, o.lit); d.win(-1, -20, 2, 4, o.lit);
  d.r(-4, -10, 8, 10, C.ink); d.r(-3, -11, 6, 1, C.ink); d.r(-4, -10, 1, 10, '#4e2f1c'); d.r(3, -10, 1, 10, '#4e2f1c');
  for (let y = -9; y < 0; y += 2) d.r(-3, y, 6, 1, '#7a4a2b');
  d.torch(-6, -7, !!o.lit); d.torch(5, -7, !!o.lit);
  return { x0: -24, x1: 24, top: t >= 2 ? -48 : -44 };
}
function tower(d, o) {
  const h = o.h || 34;
  stone(d, -6, -h, 12, h); crenel(d, -6, -h, 12);
  d.r(-8, -h - 1, 16, 2, '#7a4a2b'); d.r(-8, -h - 1, 16, 1, '#a86b3c');
  d.win(-1, -h + 6, 2, 4, o.lit); d.win(-1, -h + 15, 2, 4, o.lit);
  door(d, -2, -6, 4, 6);
  // lamp on top
  const lamp = o.beacon || C.cyan;
  d.r(0, -h - 7, 1, 6, C.silver);
  d.anim('pu', '', () => { d.r(-2, -h - 10, 4, 4, lamp); d.r(-1, -h - 11, 2, 1, lighten(lamp, 0.5)); });
  if (o.dish) { d.r(-5, -h - 6, 3, 1, C.silver); d.r(-6, -h - 7, 1, 1, C.silver); d.r(3, -h - 6, 3, 1, C.silver); d.r(6, -h - 7, 1, 1, C.silver); }
  if (o.ctx.lights) o.ctx.lights.push({ x: d.ox - 3 * d.s, y: d.oy + (-h - 11) * d.s, w: 6 * d.s, h: 6 * d.s, glow: 2, color: lamp });
  return { x0: -8, x1: 8, top: -h - 11 };
}
function guild(d, o) {
  wall(d, -15, -16, 30, 16, '#d9c7a0', '#b8a27a');
  for (let x = -15; x <= 14; x += 6) d.r(x, -16, 1, 16, '#7a4a2b');
  d.r(-17, -20, 34, 5, '#b13e53'); d.r(-17, -20, 34, 1, '#ef7d57'); d.r(-13, -23, 26, 3, '#b13e53'); d.r(-13, -23, 26, 1, '#ef7d57');
  if (o.snow) { d.r(-13, -23, 26, 1, '#f4f8fc'); d.r(-17, -20, 34, 1, '#f4f8fc'); }
  d.r(-4, -10, 8, 10, '#7a4a2b'); d.r(-4, -10, 8, 1, '#a86b3c'); d.r(0, -10, 1, 10, '#4e2f1c'); d.r(2, -5, 1, 1, C.yellow);
  d.win(-12, -12, 3, 4, o.lit); d.win(9, -12, 3, 4, o.lit);
  d.r(-12, -15, 1, 6, C.blue); d.r(-11, -15, 3, 7, C.blue); d.r(10, -15, 3, 7, C.blue);
  d.r(-2, -14, 4, 3, C.yellow); d.r(-1, -13, 2, 1, C.goldD);
  return { x0: -17, x1: 17, top: -23 };
}
function library(d, o) {
  wall(d, -11, -16, 22, 16, '#cfd6e0', '#9aa5b5');
  roofTri(d, 0, -29, 13, '#257179', '#1b5560', o.snow);
  d.r(-11, -16, 22, 1, '#9aa5b5');
  for (const x of [-8, -1, 6]) { d.win(x, -13, 3, 7, o.lit); d.r(x, -14, 3, 1, '#3b5dc9'); }
  d.r(-2, -7, 4, 7, '#7a4a2b'); d.r(-2, -8, 4, 1, '#7a4a2b'); d.r(-1, -8, 2, 1, '#a86b3c');
  d.r(-13, -1, 26, 1, '#b8c2d0'); d.r(-14, 0, 28, 1, '#8a94a6');
  d.sprite(ICON.book, -3, -26, { s: d.s * 0.375 });
  return { x0: -14, x1: 14, top: -29 };
}
function workshop(d, o) {
  wall(d, -12, -11, 24, 11, '#a86b3c', '#7a4a2b');
  for (let x = -12; x < 12; x += 3) d.r(x, -11, 1, 11, '#7a4a2b');
  for (let i = 0; i < 6; i++) d.r(-14 + i * 1, -11 - 6 + i, 28 - i * 2, 1, i % 2 ? '#5e3820' : '#7a4a2b');
  d.r(-14, -17, 28, 1, '#8a5a35');
  d.r(-6, -9, 7, 9, C.ink); d.r(-5, -4, 5, 3, C.orange); d.r(-4, -3, 3, 1, C.yellow);
  if (o.lit || (o.state || 'active') === 'active' || o.state === 'building') o.ctx.lights?.push({ x: d.ox - 5 * d.s, y: d.oy - 4 * d.s, w: 5 * d.s, h: 3 * d.s, glow: 1 });
  d.r(5, -26, 4, 16, C.stone); d.r(5, -26, 4, 1, C.stoneD); d.r(5, -26, 1, 16, C.stoneL);
  if (o.smoke !== false) smoke(d, 6, -28, true);
  d.r(9, -4, 4, 2, C.stoneD); d.r(8, -5, 6, 1, C.silver);
  return { x0: -14, x1: 14, top: -26 };
}
function mine(d, o) {
  for (let y = 0; y < 16; y++) { const hw = 13 - Math.floor(y * 0.35); d.r(-hw, -16 + y, hw * 2, 1, y % 5 === 4 ? '#4b5563' : '#6b7280'); }
  d.r(-13, -3, 26, 3, '#4b5563');
  d.r(-9, -15, 5, 3, '#8a94a6'); d.r(4, -12, 4, 2, '#8a94a6');
  if (o.snow) { d.r(-8, -16, 16, 2, '#f4f8fc'); }
  d.r(-5, -10, 10, 10, C.ink); d.r(-6, -11, 12, 1, '#7a4a2b'); d.r(-6, -11, 1, 11, '#7a4a2b'); d.r(5, -11, 1, 11, '#7a4a2b'); d.r(-6, -12, 12, 1, '#a86b3c');
  d.r(-1, -6, 2, 1, C.yellow);
  d.torch(-8, -6, true);
  d.r(7, -2, 10, 1, '#7a4a2b'); d.r(9, -1, 1, 1, C.silver); d.r(14, -1, 1, 1, C.silver);
  d.r(9, -6, 6, 4, '#7a4a2b'); d.r(9, -7, 6, 1, C.silver); d.r(10, -8, 4, 1, C.sky); d.r(11, -9, 2, 1, C.cyan);
  return { x0: -14, x1: 16, top: -16 };
}
export const ARCHETYPES = { house, castle, tower, guild, library, workshop, mine };

/** Draw a repository building with its state. (ox, oy) = ground centre in p's grid. */
export function drawBuilding(p, kind, ox, oy, s, o = {}) {
  const ctx = o.ctx || {};
  const d = local(p, ox, oy, s, ctx);
  const fn = ARCHETYPES[kind] || house;
  const lit = o.lit ?? false;
  const oo = { ...o, lit, ctx, state: o.state || 'active', smoke: o.smoke ?? (o.state === 'active' || o.state === 'building') };
  const b = fn(d, oo);
  stateFx(d, oo, b);
  return b;
}
export { stone, crenel, roofTri, cone, wall, door, pick, ROOFS };
