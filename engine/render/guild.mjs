// Guild banners (V2): your social links as small pixel banners. Icon only, no words to read.
import { Pix, svgDoc } from './pixel.mjs';
import { ICON, drawSprite } from './sprites.mjs';
import { T } from './ui.mjs';
import { C } from './palette.mjs';

const KINDS = {
  linkedin: { color: '#3b7dd8', letters: 'IN', label: 'LinkedIn' },
  x: { color: '#2b2e4d', letters: 'X', label: 'X' },
  twitter: { color: '#2b2e4d', letters: 'X', label: 'X' },
  instagram: { color: '#c0457a', icon: 'camera', label: 'Instagram' },
  telegram: { color: '#2f9ad8', icon: 'plane', label: 'Telegram' },
  email: { color: '#b13e53', icon: 'envelope', label: 'Email' },
  github: { color: '#3a3f66', letters: 'GH', label: 'GitHub' },
};
export const guildKind = (id) => KINDS[String(id || '').toLowerCase()] || { color: '#566c86', letters: String(id || '?').slice(0, 2).toUpperCase(), label: String(id || 'Link') };

export function renderGuildBanner(link) {
  const k = guildKind(link.id), W = 72, H = 92, p = new Pix(1);
  p.r(30, 0, 12, 4, '#a86b3c').r(4, 2, 64, 4, '#7a4a2b').r(4, 2, 64, 1, '#a86b3c');          // the rod
  p.r(8, 6, 56, 66, k.color).r(8, 6, 56, 4, '#ffffff', 0.22).r(8, 66, 56, 6, '#000000', 0.18);
  p.r(8, 72, 14, 12, k.color).r(22, 72, 14, 7, k.color).r(36, 72, 14, 7, k.color).r(50, 72, 14, 12, k.color);   // swallow tail
  p.r(8, 6, 3, 66, '#ffffff', 0.12).r(61, 6, 3, 66, '#000000', 0.2);
  if (k.icon) drawSprite(p, ICON[k.icon], 36 - 16, 20, { s: 4 });
  else p.text(k.letters, 36, k.letters.length > 1 ? 30 : 22, k.letters.length > 1 ? 3.5 : 8, '#ffffff', { align: 'c', shadow: '#00000066' });
  return svgDoc({ w: W, h: H, title: k.label, desc: `${k.label} link banner`, body: p.toString(), defs: p.defs.join('') });
}
