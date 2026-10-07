// The visitor camp camera (TRUE V2): a window into the one world, centered on the visitor district.
// The tents, fire and forest are the same ones drawn on the overworld — one camp, one drawing.
// The overlay adds the social layer: the count, the newest message, and the newest faces.
// What the scene shows comes from approved visitor data only. All text is short, plain and drawn by the pixel font
// (or escaped), avatars are the same safe kinds as in V1: github picture (checked), pixel hero, generated face.
import { textW } from './pixel.mjs';
import { T, box, drawIcon } from './ui.mjs';
import { drawHeroPose } from './actors.mjs';
import { renderWorldCamera, overlayCanvas } from './camera.mjs';
import { truncate, hash32, pad3 } from '../util.mjs';

export const FLAG_COLORS = { red: '#ef5a5a', blue: '#41a6f6', green: '#a7f070', gold: '#ffcd75', purple: '#b48cf0', orange: '#ef7d57' };
const AVATAR_ARCH = { knight: 'paladin', mage: 'mage', ranger: 'ranger', rogue: 'rogue' };
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** A little pixel face made from the name. Same name = same face. */
export function identicon(p, login, x, y, s) {
  const h = hash32(login.toLowerCase());
  const pal = ['#ef7d57', '#41a6f6', '#a7f070', '#b48cf0', '#ffcd75', '#73eff7', '#ff9ecb'];
  const c = pal[h % pal.length];
  p.r(x, y, 5 * s, 5 * s, '#14162b');
  for (let r = 0; r < 5; r++) for (let col = 0; col < 3; col++) {
    if ((h >> (r * 3 + col + 3)) & 1) { p.r(x + col * s, y + r * s, s, s, c); p.r(x + (4 - col) * s, y + r * s, s, s, c); }
  }
}
/** A framed portrait, size x size. The github picture is only used when it passes the same checks as in V1. */
export function avatar(p, f, x, y, items, size = 64) {
  p.r(x, y, size, size, '#0e1024').frame(x, y, size, size, 3, '#3a3f66');
  const style = f.avatar || 'identicon';
  if (style === 'github' && items?.[f.login]) {
    const it = items[f.login];
    if (/^image\/(png|jpeg)$/.test(it.mime) && B64.test(it.b64) && it.b64.length < 40000) {
      p.raw(`<image x="${x + 3}" y="${y + 3}" width="${size - 6}" height="${size - 6}" preserveAspectRatio="xMidYMid slice" style="image-rendering:pixelated" href="data:${it.mime};base64,${it.b64}" xlink:href="data:${it.mime};base64,${it.b64}"/>`);
      return;
    }
  }
  if (AVATAR_ARCH[style]) { p.r(x + 3, y + 3, size - 6, size - 6, '#2b3d86'); drawHeroPose(p, x + size * 0.2, y + size * 0.1, AVATAR_ARCH[style], 'idle', { s: size / 27, still: true }); return; }
  identicon(p, f.login, x + size * 0.11, y + size * 0.11, size * 0.156);
}

// the camera window: the visitor district and its forest edge, in world grid units
export const CAMP_RECT = [104, 168, 172, 208];

export function renderCamp(S, rctx = {}) {
  const V = S.visitors;
  const { p, vx, vy, vw, vh } = overlayCanvas(CAMP_RECT);

  // ---- header: a flag and the count
  drawIcon(p, 'flag', vx + 10, vy + 10, 3);
  p.text(String(V.total), vx + 40, vy + 12, 3.5, T.gold, { shadow: '#000000' });
  p.text('VISITORS', vx + 40, vy + 34, 1.75, T.dim);
  if (S.meta.demo) p.text('DEMO', vx + vw - 12, vy + 14, 2, '#ff9a9a', { align: 'r' });

  // ---- the newest visitors have a face on the camp board (three at most)
  const shown = V.flags.slice(0, 3);
  shown.forEach((f, i) => {
    const ax = vx + vw - 14 - 44 * (i + 1), ay = vy + 10;
    avatar(p, f, ax, ay, rctx.avatars, 38);
    box(p, ax, ay + 42, 38, 16, { fill: '#14162b', border: FLAG_COLORS[f.color] || '#ef5a5a' });
    p.text(`#${pad3(f.n)}`, ax + 19, ay + 46, 1.5, T.gold, { align: 'c' });
  });

  // ---- the very newest visitor gets a speech bubble (kept inside the camera window)
  const newest = V.flags[0];
  if (newest?.message) {
    const maxW = vx + vw - (vx + 10) - 24;   // text must fit the window
    const maxChars = Math.max(8, Math.floor((maxW / 2 + 1) / 6));
    const msg = truncate(newest.message, maxChars), who = `@${truncate(newest.login, 16)}`;
    const s = 2, w = Math.max(textW(msg, s), textW(who, s)) + 24;
    const bx = vx + 10, by = vy + vh - 66;
    p.r(bx, by, w, 56, '#f4f4f4').r(bx + 3, by + 3, w - 6, 50, '#14162b');
    p.text(who, bx + 12, by + 12, s, FLAG_COLORS[newest.color] || T.gold);
    p.text(msg, bx + 12, by + 34, s, T.white);
  }
  if (!V.total) p.text('NO VISITORS YET — PLANT YOUR FLAG', vx + vw / 2, vy + vh - 22, 2, T.dim, { align: 'c' });

  const who = V.flags.slice(0, 3).map((f) => '@' + f.login).join(', ');
  return renderWorldCamera(S, rctx, {
    rect: CAMP_RECT, w: 640, h: 376,
    title: 'The visitor camp',
    desc: V.total ? `${V.total} visitors planted their flags at the camp. Latest: ${who}.` : 'No visitor flags yet. The camp is empty.',
    overlay: p.toString(),
  });
}
