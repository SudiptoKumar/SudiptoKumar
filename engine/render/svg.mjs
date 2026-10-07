// svg.mjs — tiny SVG string helpers. Integer coords keep bytes small.
// All user text must be escaped with esc() by the caller.
const I = (n) => Math.round(Number(n) || 0);
const attrs = (o) => Object.entries(o)
  .filter(([, v]) => v !== undefined && v !== null && v !== false)
  .map(([k, v]) => ` ${k}="${v}"`).join('');

export const R = (x, y, w, h, fill, extra) =>
  `<rect x="${I(x)}" y="${I(y)}" width="${I(w)}" height="${I(h)}" fill="${fill}"${attrs(extra || {})}/>`;
export const C = (cx, cy, r, fill, extra) =>
  `<circle cx="${I(cx)}" cy="${I(cy)}" r="${I(r)}" fill="${fill}"${attrs(extra || {})}/>`;
export const E = (cx, cy, rx, ry, fill, extra) =>
  `<ellipse cx="${I(cx)}" cy="${I(cy)}" rx="${I(rx)}" ry="${I(ry)}" fill="${fill}"${attrs(extra || {})}/>`;
export const P = (pts, fill, extra) =>
  `<polygon points="${pts.map((p) => `${I(p[0])},${I(p[1])}`).join(' ')}" fill="${fill}"${attrs(extra || {})}/>`;
export const PL = (pts, stroke, w, extra) =>
  `<polyline points="${pts.map((p) => `${I(p[0])},${I(p[1])}`).join(' ')}" fill="none" stroke="${stroke}" stroke-width="${I(w)}"${attrs(extra || {})}/>`;
export const LN = (x1, y1, x2, y2, stroke, w, extra) =>
  `<line x1="${I(x1)}" y1="${I(y1)}" x2="${I(x2)}" y2="${I(y2)}" stroke="${stroke}" stroke-width="${I(w)}"${attrs(extra || {})}/>`;
export const T = (x, y, text, size, fill, extra) =>
  `<text x="${I(x)}" y="${I(y)}" font-family="monospace" font-size="${I(size)}" fill="${fill}"${attrs(extra || {})}>${text}</text>`;
export const U = (id, x, y, extra) =>
  `<use href="#${id}" x="${I(x)}" y="${I(y)}"${attrs(extra || {})}/>`;
export const G = (inner, extra) => `<g${attrs(extra || {})}>${inner}</g>`;
export const clipPath = (id, inner) => `<clipPath id="${id}">${inner}</clipPath>`;
export const FONT = 'monospace';
