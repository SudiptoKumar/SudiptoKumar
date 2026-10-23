// Screen-space helpers shared by every camera overlay. Overlays only ever write compact references (an icon and a number, a name plate):
// the world already draws the thing itself, so the overlay never repeats it as a bar, tile or chart (RULE C: one visual home).
import { textW } from './pixel.mjs';
import { drawIcon } from './sprites.mjs';
import { T } from './ui.mjs';
import { STYLE } from '../world/constants.mjs';

export const MIN_S = STYLE.minTextScale;      // no text below this scale on a 720 px picture

/** Shorten a string with ~ so it fits maxW at scale s. */
export function fitText(str, maxW, s = MIN_S) {
  str = String(str);
  if (textW(str, s) <= maxW) return str;
  let t = str;
  while (t.length > 1 && textW(`${t}~`, s) > maxW) t = t.slice(0, -1);
  return `${t}~`;
}

/** A compact reference: icon + number on a dark pill. Returns its width. */
export function pill(h, x, y, icon, text, { color = T.white, border = T.goldD, s = MIN_S, align = 'l' } = {}) {
  const tw = textW(String(text), s), iw = icon ? 8 * 3 + 8 : 0, w = tw + iw + 22, ph = 7 * s + 16;
  const left = align === 'r' ? x - w : x;
  h.r(left, y, w, ph, '#0e1024', 0.82).r(left, y, w, 3, border);
  if (icon) drawIcon(h, icon, left + 10, y + (ph - 24) / 2 + 1, 3);
  h.text(String(text), left + 10 + iw, y + 10, s, color, { shadow: T.dark });
  return w;
}
