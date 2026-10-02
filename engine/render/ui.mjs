// Shared building blocks for the cards: frames, bars, chips, headers.
import { Pix, textW } from './pixel.mjs';
import { drawIcon, ICON } from './sprites.mjs';
import { lighten, darken } from './palette.mjs';

export const T = {
  bg: '#14162b', panel: '#20223a', panel2: '#2b2e4d', gold: '#ffcd75', goldD: '#b07a1c', white: '#f4f4f4', dim: '#94b0c2',
  dark: '#0e1024', cyan: '#73eff7', green: '#a7f070', red: '#ef5a5a', orange: '#ef7d57', blue: '#41a6f6', purple: '#b48cf0',
};

/** Pixel panel with stepped corners. */
export function box(p, x, y, w, h, { fill = T.panel, border = T.gold, t = 4, n = 4 } = {}) {
  p.r(x + n, y, w - 2 * n, h, border).r(x, y + n, w, h - 2 * n, border);
  p.r(x + t + n, y + t, w - 2 * t - 2 * n, h - 2 * t, fill).r(x + t, y + t + n, w - 2 * t, h - 2 * t - 2 * n, fill);
}
export function card(p, w, h, { border = T.goldD } = {}) {
  p.r(0, 0, w, h, T.dark);
  box(p, 0, 0, w, h, { fill: T.bg, border, t: 4, n: 8 });
}
export function bar(p, x, y, w, h, pct, { fill = T.green, back = T.dark, border = '#3a3f66', t = 3 } = {}) {
  p.r(x, y, w, h, border).r(x + t, y + t, w - 2 * t, h - 2 * t, back);
  const iw = w - 2 * t;
  const fw = Math.round((iw * Math.max(0, Math.min(100, pct))) / 100);
  if (fw > 0) {
    p.r(x + t, y + t, fw, h - 2 * t, fill);
    p.r(x + t, y + t, fw, Math.max(2, Math.round((h - 2 * t) / 4)), lighten(fill, 0.4));
    p.r(x + t, y + h - t - 2, fw, 2, darken(fill, 0.3));
  }
  for (let i = 1; i < 10; i++) p.r(x + t + Math.round((iw * i) / 10) - 1, y + t, 2, h - 2 * t, T.dark, 0.4);
}
export function fitScale(str, maxW, scales = [6, 5, 4, 3]) {
  for (const s of scales) if (textW(str, s) <= maxW) return s;
  return scales[scales.length - 1];
}
/** Small label box. Returns its width. */
export function chip(p, x, y, label, { bg = T.panel2, fg = T.white, border = null, s = 3, padX = 10, icon = null } = {}) {
  const tw = textW(label, s);
  const iw = icon ? 8 * (s > 3 ? 3 : 2.5) + 8 : 0;
  const w = tw + padX * 2 + iw;
  const h = 7 * s + 14;
  box(p, x, y, w, h, { fill: bg, border: border || bg, t: 3, n: 3 });
  let tx = x + padX;
  if (icon) { drawIcon(p, icon, tx, y + (h - 8 * 2.5) / 2, 2.5); tx += iw; }
  p.text(label, tx, y + 7, s, fg);
  return w;
}
/** Card header: icon, title, optional right text. */
export function header(p, w, title, icon, right = null, rightColor = T.dim) {
  if (icon) drawIcon(p, icon, 28, 24, 4);
  p.text(title, icon ? 72 : 28, 26, 4, T.gold, { shadow: T.dark });
  if (right) p.text(right, w - 28, 29, 3, rightColor, { align: 'r' });
}
export const pctColor = (v) => (v >= 90 ? T.green : v >= 70 ? '#ffcd75' : v >= 50 ? T.orange : T.red);
/** Red ribbon used when the data is only a preview. */
export function demoRibbon(p, w) {
  p.r(w - 196, 8, 188, 34, '#b13e53').r(w - 196, 8, 188, 4, '#ef7d57').r(w - 196, 38, 188, 4, '#5d275d');
  p.text('DEMO DATA', w - 102, 17, 3, T.white, { align: 'c' });
}
export { Pix, textW, drawIcon, ICON };
