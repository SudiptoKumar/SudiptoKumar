// Button pictures for the README (links sit around them in the markdown).
import { Pix, svgDoc, textW } from './pixel.mjs';
import { T, box } from './ui.mjs';
import { drawIcon } from './sprites.mjs';

export function buttonSvg(label, { icon = null, s = 3, bg = '#2b2e4d', fg = T.white, border = T.gold } = {}) {
  const tw = textW(label, s);
  const iw = icon ? 8 * 3 + 12 : 0;
  const w = tw + iw + 44, h = 7 * s + 38;
  const p = new Pix(1);
  box(p, 0, 0, w, h, { fill: bg, border, t: 4, n: 4 });
  
  let x = 22;
  if (icon) { drawIcon(p, icon, x, (h - 24) / 2, 3); x += iw; }
  p.text(label, x, (h - 7 * s) / 2, s, fg, { shadow: T.dark });
  return svgDoc({ w, h, title: label, desc: label, body: p.toString(), defs: p.defs.join(''), css: '' });
}
export const NAV = [
  ['kingdom', 'ENTER KINGDOM', 'castle'],
  ['character', 'CHARACTER', 'sword'],
  ['achievements', 'ACHIEVEMENTS', 'trophy'],
  ['repositories', 'REPOSITORIES', 'house'],
  ['harvest', 'HARVEST', 'wheat'],
  ['visit', 'VISIT', 'flag'],
];
export const ACTIONS = [
  ['flag', 'PLANT YOUR FLAG', 'flag', { bg: '#1f4a34', border: T.green }],
  ['raid', 'SEND A GOBLIN RAID', 'skull', { bg: '#4a1f2a', border: T.red }],
];

/** All button files: [file name, svg text] */
export function allButtons() {
  const out = [];
  for (const [id, label, icon] of NAV) out.push([`ui/nav-${id}.svg`, uniform(label, icon, 300, 3)]);
  for (const [id, label, icon, o] of ACTIONS) out.push([`ui/action-${id}.svg`, uniform(label, icon, 400, 3, o)]);
  return out;
}
function uniform(label, icon, w, s, o = {}) {
  const h = 70;
  const p = new Pix(1);
  box(p, 0, 0, w, h, { fill: o.bg || '#2b2e4d', border: o.border || T.gold, t: 4, n: 4 });
  const tw = textW(label, s), total = tw + 24 + 12;
  const x0 = Math.round((w - total) / 2);
  drawIcon(p, icon, x0, (h - 24) / 2, 3);
  p.text(label, x0 + 36, (h - 7 * s) / 2, s, o.fg || T.white, { shadow: T.dark });
  return svgDoc({ w, h, title: label, desc: label, body: p.toString(), defs: p.defs.join(''), css: '' });
}
