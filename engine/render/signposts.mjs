// The two action posts (V2). Small wooden signposts next to the camp. They replace the two big dashboard buttons.
import { Pix, svgDoc, textW } from './pixel.mjs';
import { ICON, drawSprite } from './sprites.mjs';
import { T } from './ui.mjs';
import { C } from './palette.mjs';

const POSTS = {
  flag: { file: 'post-flag.svg', text: 'PLANT A FLAG', icon: 'flag', color: '#a7f070', desc: 'Plant your flag in the visitor camp' },
  raid: { file: 'post-raid.svg', text: 'SEND A RAID', icon: 'horn', color: '#ef7d57', desc: 'Send a harmless goblin raid' },
};
export const POST_KEYS = Object.keys(POSTS);

export function renderPost(key, S) {
  const b = POSTS[key], W = 300, H = 92, p = new Pix(1);
  const state = key === 'raid' ? (S?.raid?.active ? 'active' : S?.raid?.available === false ? 'resting' : 'ready') : 'ready';
  const col = state === 'resting' ? '#94b0c2' : b.color;
  p.r(0, 0, W, H, '#14162b').r(0, 0, W, 4, col).r(0, H - 4, W, 4, '#0e1024');
  p.r(20, 4, 8, H - 4, '#7a4a2b').r(20, 4, 3, H - 4, '#a86b3c');                  // the post
  p.r(34, 14, W - 48, 60, '#a86b3c').r(34, 14, W - 48, 4, '#d3a66e').r(34, 70, W - 48, 4, '#7a4a2b'); // the board
  p.r(38, 18, 4, 4, '#4e2f1c').r(W - 24, 18, 4, 4, '#4e2f1c').r(38, 66, 4, 4, '#4e2f1c').r(W - 24, 66, 4, 4, '#4e2f1c');   // nails
  p.raw(state === 'ready' ? '<g class="bob">' : '<g>');
  drawSprite(p, ICON[b.icon], 50, 26, { s: 5, ...(state === 'resting' ? { op: 0.55 } : {}) });
  p.raw('</g>');
  const s = 2.5, ty = state === 'ready' || key === 'flag' ? 36 : 28;
  p.text(b.text, 101, ty + 1, s, '#2a1608');
  p.text(b.text, 100, ty, s, '#fff0d0');
  if (key === 'raid' && state !== 'ready') p.text(state === 'active' ? 'IN BATTLE' : 'GOBLINS REST', 100, 52, 2, '#2a1608');
  return svgDoc({ w: W, h: H, title: b.desc, desc: `${b.desc}${state === 'resting' ? ' (the goblins are resting)' : ''}.`, body: p.toString(), defs: p.defs.join('') });
}
