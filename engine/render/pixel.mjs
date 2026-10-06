// A tiny "pixel canvas". Everything in the world is drawn as squares.
// p.r(x, y, w, h, colour) works in grid units. One grid unit = `u` SVG units.
import { esc } from '../util.mjs';
import { GLYPHS, hasGlyphs, textUnits } from './font.mjs';

const f = (n) => {
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) ? '0' : String(r);
};

export class Pix {
  constructor(u = 1) {
    this.u = u;
    this.parts = [];
    this.cur = null;
    this.defs = [];
    this.defIds = new Set();
  }
  flush() {
    if (!this.cur) return;
    const { fill, op, d } = this.cur;
    this.parts.push(`<path fill="${fill}"${op < 1 ? ` fill-opacity="${op}"` : ''} d="${d.join('')}"/>`);
    this.cur = null;
  }
  /** Filled rectangle (grid units). Neighbour rectangles of one colour share one <path>. */
  r(x, y, w, h, fill, op = 1) {
    if (!(w > 0) || !(h > 0) || !fill) return this;
    const u = this.u;
    if (!this.cur || this.cur.fill !== fill || this.cur.op !== op) {
      this.flush();
      this.cur = { fill, op, d: [] };
    }
    this.cur.d.push(`M${f(x * u)} ${f(y * u)}h${f(w * u)}v${f(h * u)}h${f(-w * u)}z`);
    return this;
  }
  raw(s) { this.flush(); this.parts.push(s); return this; }
  g(attrs, fn) { this.raw(`<g ${attrs}>`); fn(this); this.raw('</g>'); return this; }
  toString() { this.flush(); return this.parts.join(''); }

  /** Re-usable piece of art. Defined once, placed many times with <use>. */
  symbol(id, fn) {
    if (this.defIds.has(id)) return this;
    this.defIds.add(id);
    const q = new Pix(this.u);
    fn(q);
    this.defs.push(`<g id="${id}">${q}</g>`);
    return this;
  }
  use(id, x, y, attrs = '') {
    return this.raw(`<use xlink:href="#${id}" x="${f(x * this.u)}" y="${f(y * this.u)}"${attrs ? ' ' + attrs : ''}/>`);
  }

  // ----- shapes -----
  frame(x, y, w, h, t, fill) {
    this.r(x, y, w, t, fill).r(x, y + h - t, w, t, fill).r(x, y + t, t, h - 2 * t, fill).r(x + w - t, y + t, t, h - 2 * t, fill);
    return this;
  }
  /** Pixel ellipse */
  ellipse(cx, cy, rx, ry, fill, op = 1) {
    for (let dy = -Math.floor(ry); dy <= Math.floor(ry); dy++) {
      const k = Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry + 0.0001)));
      const hw = Math.round(rx * k);
      if (hw >= 0) this.r(cx - hw, cy + dy, hw * 2 + 1, 1, fill, op);
    }
    return this;
  }
  line(x1, y1, x2, y2, fill) {
    let dx = Math.abs(x2 - x1), dy = -Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1, sy = y1 < y2 ? 1 : -1;
    let err = dx + dy, x = x1, y = y1;
    for (let i = 0; i < 4000; i++) {
      this.r(x, y, 1, 1, fill);
      if (x === x2 && y === y2) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
    }
    return this;
  }

  // ----- sprites -----
  sprite(spr, x, y, o = {}) { drawSprite(this, spr, x, y, o); return this; }

  // ----- text (pixel font) -----
  /** s = size of one font pixel, in grid units. */
  text(str, x, y, s, fill, o = {}) {
    str = String(str ?? '');
    const up = str.toUpperCase();
    const w = textUnits(up) * s;
    const u = this.u;
    let x0 = x;
    if (o.align === 'c') x0 = x - w / 2;
    else if (o.align === 'r') x0 = x - w;
    x0 = Math.round(x0 * u) / u;
    if (!hasGlyphs(up)) {
      // Letters that are not in the pixel font (other languages) use normal text.
      const anchor = o.align === 'c' ? 'middle' : o.align === 'r' ? 'end' : 'start';
      const ax = o.align === 'c' ? x : o.align === 'r' ? x : x0;
      this.raw(`<text x="${f(ax * u)}" y="${f((y + 6.2 * s) * u)}" font-size="${f(7 * s * u)}" font-weight="700" fill="${fill}" text-anchor="${anchor}" font-family="ui-monospace,Menlo,Consolas,'DejaVu Sans Mono',monospace">${esc(str)}</text>`);
      return this;
    }
    if (o.shadow) this._glyphs(up, x0 + s / 3, y + s / 3, s, o.shadow);
    this._glyphs(up, x0, y, s, fill);
    return this;
  }
  _glyphs(up, x0, y, s, fill) {
    let cx = x0;
    for (const ch of up) {
      const runs = GLYPHS[ch];
      if (runs) for (const [rx, ry, rw] of runs) this.r(cx + rx * s, y + ry * s, rw * s, s, fill);
      cx += 6 * s;
    }
  }
}
export const textW = (str, s) => textUnits(String(str).toUpperCase()) * s;

// ----- sprite helpers -----
/** rows: array of equal length strings. '.' = empty. Other chars map to colours in pal. */
export function makeSprite(rows, pal = {}) {
  const w = rows[0].length;
  rows.forEach((r, i) => {
    if (r.length !== w) throw new Error(`Sprite row ${i} has length ${r.length}, expected ${w}: "${r}"`);
  });
  const runs = new Map();
  rows.forEach((row, y) => {
    let x = 0;
    while (x < w) {
      const c = row[x];
      if (c === '.' || c === ' ') { x++; continue; }
      let e = x;
      while (e < w && row[e] === c) e++;
      if (!runs.has(c)) runs.set(c, []);
      runs.get(c).push([x, y, e - x]);
      x = e;
    }
  });
  return { w, h: rows.length, rows, runs, pal };
}
export function drawSprite(p, spr, x, y, o = {}) {
  if (spr.__fn) return spr.__fn(p, x, y, o);
  const s = o.s ?? 1;
  const pal = o.pal ? { ...spr.pal, ...o.pal } : spr.pal;
  for (const [c, list] of spr.runs) {
    const col = pal[c];
    if (!col) continue;
    for (const [rx, ry, rw] of list) {
      const px = o.flip ? spr.w - rx - rw : rx;
      p.r(x + px * s, y + ry * s, rw * s, s, col, o.op ?? 1);
    }
  }
}
/** Replace the first rows of a sprite (used for hats and helmets). */
export function withRows(rows, top) { return [...top, ...rows.slice(top.length)]; }

// ----- animation styles (shared by all pictures) -----
export const ANIM_CSS = [
  '.fl{animation:fl 1s steps(1) infinite}@keyframes fl{0%{opacity:1}50%{opacity:.5}}',
  '.f1{animation:f1 .8s steps(1) infinite}@keyframes f1{0%{opacity:1}50%{opacity:0}}',
  '.f2{animation:f2 .8s steps(1) infinite}@keyframes f2{0%{opacity:0}50%{opacity:1}}',
  '.tw{animation:tw 2.6s ease-in-out infinite}@keyframes tw{0%,100%{opacity:.2}50%{opacity:1}}',
  '.bob{animation:bob .9s steps(1) infinite}@keyframes bob{0%{transform:translateY(0)}50%{transform:translateY(-4px)}}',
  '.bob2{animation:bob2 1.6s steps(1) infinite}@keyframes bob2{0%{transform:translateY(0)}50%{transform:translateY(-8px)}}',
  '.dr{animation:dr 90s linear infinite}@keyframes dr{from{transform:translateX(-160px)}to{transform:translateX(720px)}}',
  '.sm{animation:sm 3.2s linear infinite}@keyframes sm{0%{transform:translateY(0);opacity:0}15%{opacity:.85}100%{transform:translateY(-44px);opacity:0}}',
  '.wk{animation:wk var(--t,12s) linear infinite}@keyframes wk{0%,100%{transform:translateX(0)}50%{transform:translateX(var(--dx,48px))}}',
  '.wy{animation:wy var(--t,12s) linear infinite}@keyframes wy{0%,100%{transform:translateY(0)}50%{transform:translateY(var(--dy,40px))}}',
  '.fc{transform-box:fill-box;transform-origin:center;animation:fc var(--t,12s) steps(1) infinite}@keyframes fc{0%{transform:scaleX(1)}50%{transform:scaleX(-1)}}',
  '.rn{animation:rn .8s linear infinite}@keyframes rn{from{transform:translate(0,0)}to{transform:translate(-22px,88px)}}',
  '.lt{animation:lt 7s steps(1) infinite}@keyframes lt{0%,90%,94%,100%{opacity:0}91%,95%{opacity:.85}}',
  '.zz{animation:zz 3s linear infinite}@keyframes zz{0%{transform:translate(0,0);opacity:0}20%{opacity:1}100%{transform:translate(8px,-24px);opacity:0}}',
  '.fw{transform-box:fill-box;transform-origin:center;animation:fw 3s ease-out infinite}@keyframes fw{0%{transform:scale(.1);opacity:1}70%{opacity:1}100%{transform:scale(1.2);opacity:0}}',
  '.cf{animation:cf 5s linear infinite}@keyframes cf{from{transform:translateY(-20px)}to{transform:translateY(260px)}}',
  '.sw{transform-box:fill-box;transform-origin:50% 100%;animation:sw .9s steps(2) infinite}@keyframes sw{0%{transform:rotate(-35deg)}50%{transform:rotate(30deg)}}',
  '@keyframes sp{to{transform:rotate(360deg)}}',
  '.pu{animation:pu 3s ease-in-out infinite}@keyframes pu{0%,100%{opacity:.35}50%{opacity:.9}}',
  '.fa{animation:fa 9s linear infinite}@keyframes fa{0%{transform:translate(0,-10px)}100%{transform:translate(-36px,320px)}}',
  '@media (prefers-reduced-motion:reduce){*{animation:none!important}}',
].join('');

/** Wrap a finished picture in an <svg>. Title and desc help screen readers.
 *  Pass viewBox to crop into a larger drawing (TRUE V2 cameras); w/h are the
 *  display size and the viewBox is scaled to fit. */
export function svgDoc({ w, h, title, desc, body, defs = '', css = ANIM_CSS, viewBox = null }) {
  const vb = viewBox || `0 0 ${w} ${h}`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${vb}" width="${w}" height="${h}" role="img" aria-labelledby="t d" shape-rendering="crispEdges">` +
    `<title id="t">${esc(title)}</title><desc id="d">${esc(desc)}</desc>` +
    (css ? `<style>${css}</style>` : '') +
    (defs ? `<defs>${defs}</defs>` : '') +
    body +
    '</svg>\n'
  );
}
