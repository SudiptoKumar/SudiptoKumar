// The Trophy Hall (V2). Achievements are things in a room, not rows in a list:
//   unlocked   a trophy on its pedestal (major ones are bigger and lit by a spotlight)
//   locked     an empty pedestal
//   secret     a locked door; when it is unlocked the door stands open with the trophy inside
import { Pix, svgDoc } from './pixel.mjs';
import { T, card, demoRibbon } from './ui.mjs';
import { ICON, drawIcon, drawSprite } from './sprites.mjs';
import { glowDef } from './light.mjs';
import { C } from './palette.mjs';

const COLS = 8, CELL_H = 140;
const BRICK = '#2a2d4a', BRICK2 = '#34385c', FLOOR1 = '#3a3f66', FLOOR2 = '#2e3252';

export function renderTrophies(S) {
  const list = S.achievements.list;
  const shown = [...list.filter((a) => !a.secret), ...list.filter((a) => a.secret)];
  const rows = Math.max(1, Math.ceil(shown.length / COLS));
  const W = 640, H = 64 + rows * CELL_H + 12;
  const p = new Pix(1);
  card(p, W, H);
  p.defs.push(glowDef('#ffcd75'), glowDef('#b48cf0'));
  // header: the only text is the count
  drawIcon(p, 'trophy', 28, 22, 4);
  const got = list.filter((a) => a.unlocked).length;
  p.text(`${got} / ${list.length}`, 72, 26, 4, T.gold, { shadow: T.dark });
  if (S.meta.demo) demoRibbon(p, W);

  const cw = (W - 48) / COLS;
  for (let r = 0; r < rows; r++) {
    const y0 = 64 + r * CELL_H;
    // the wall and the floor of this row of the hall
    p.r(24, y0, W - 48, CELL_H - 8, BRICK);
    for (let by = 0; by < 100; by += 10) for (let bx = (by / 10) % 2 ? 0 : 20; bx + 39 <= W - 48; bx += 40) p.r(24 + bx, y0 + by, 38, 1, BRICK2).r(24 + bx + 38, y0 + by, 1, 10, BRICK2);
    p.r(24, y0 + 98, W - 48, CELL_H - 106, FLOOR1);
    for (let fx = 0; fx < W - 48; fx += 24) for (let fy = 0; fy < CELL_H - 106; fy += 12) if (((fx / 24) + (fy / 12)) % 2 === 0) p.r(24 + fx, y0 + 98 + fy, 24, 12, FLOOR2);
    p.r(24, y0 + 96, W - 48, 3, '#1c1e36');
    // torches between groups of four, banners over the doors
    for (const tx of [40, 24 + cw * 4, W - 40]) {
      p.r(tx - 2, y0 + 40, 4, 30, '#7a4a2b').r(tx - 4, y0 + 36, 8, 4, '#566c86');
      p.raw('<g class="fl">').r(tx - 4, y0 + 24, 8, 12, C.orange).r(tx - 2, y0 + 18, 4, 8, C.yellow).raw('</g>');
      p.raw(`<circle cx="${tx}" cy="${y0 + 32}" r="38" fill="url(#g-ffcd75)" opacity=".28"/>`);
    }
    p.r(24, y0, W - 48, 4, '#1c1e36').r(24, y0 + CELL_H - 12, W - 48, 4, '#1c1e36');
  }

  shown.forEach((a, i) => {
    const r = Math.floor(i / COLS), c = i % COLS;
    const cx = 24 + cw * (c + 0.5), y0 = 64 + r * CELL_H;
    if (a.secret) return secretDoor(p, cx, y0, a, S);
    pedestal(p, cx, y0, a);
  });
  const names = list.filter((a) => a.unlocked && !a.secret).map((a) => a.name.toLowerCase());
  return svgDoc({
    w: W, h: H, title: 'Trophy hall',
    desc: `${got} of ${list.length} trophies. ${names.length ? `On display: ${names.join(', ')}.` : 'No trophies yet.'} ${list.filter((a) => a.secret && !a.unlocked).length} secret doors are locked.`,
    body: p.toString(), defs: p.defs.join(''),
  });
}

function pedestal(p, cx, y0, a) {
  const base = y0 + 98, pw = 46, ph = 30;
  // the stone block
  p.r(cx - pw / 2, base - ph, pw, ph, '#8a94a6').r(cx - pw / 2, base - ph, pw, 4, '#cfd6e0').r(cx - pw / 2 + pw - 5, base - ph + 4, 5, ph - 4, '#5e687c');
  p.r(cx - pw / 2 - 3, base - 4, pw + 6, 4, '#5e687c').r(cx - pw / 2 - 3, base - 4, pw + 6, 1, '#8a94a6');
  if (!a.unlocked) {                                                   // an empty pedestal: only a small lock on the block
    drawIcon(p, 'lock', cx - 8, base - ph + 10, 2, { A: '#566c86', d: '#2b2e4d' });
    return;
  }
  const spr = ICON[a.icon] || ICON.trophy, s = a.major ? 6.5 : 5, tw = spr.w * s, th = spr.h * s;
  if (a.major) {                                                       // spotlight
    p.raw(`<circle cx="${cx}" cy="${base - ph - th / 2}" r="${a.major ? 52 : 40}" fill="url(#g-ffcd75)" opacity=".5"/>`);
    p.r(cx - 22, y0 + 8, 44, 4, '#566c86').r(cx - 3, y0 + 12, 6, 6, C.yellow, 0.9);
  }
  p.raw(`<g class="${a.isNew ? 'fl' : a.major ? 'pu' : ''}"${a.major && !a.isNew ? ' style="animation-duration:4s"' : ''}>`);
  drawSprite(p, spr, cx - tw / 2, base - ph - th - 4, { s });
  p.raw('</g>');
  p.r(cx - 12, base - ph + 8, 24, 8, '#e0a030').r(cx - 12, base - ph + 8, 24, 2, '#ffe08a').r(cx - 8, base - ph + 12, 16, 2, '#b07a1c');      // plaque
  if (a.isNew) for (let k = 0; k < 3; k++) p.raw(`<g class="tw" style="animation-delay:${-k * 0.8}s">`).r(cx - 20 + k * 20, base - ph - th - 8 + (k % 2) * 6, 3, 3, '#ffffff').raw('</g>');
}

function secretDoor(p, cx, y0, a, S) {
  const base = y0 + 98, dw = 50, dh = 80, x = cx - dw / 2, top = base - dh;
  // stone arch
  p.r(x - 5, top - 4, dw + 10, dh + 4, '#5e687c').r(x - 5, top - 4, dw + 10, 3, '#8a94a6');
  p.r(x + 4, top - 8, dw - 8, 4, '#5e687c');
  if (!a.unlocked) {
    p.r(x, top, dw, dh, '#4e2f1c').r(x, top, dw, 3, '#7a4a2b');
    for (let k = 0; k < 4; k++) p.r(x + 6 + k * 11, top + 3, 1, dh - 3, '#3a2214');                      // planks
    p.r(x, top + 18, dw, 5, '#566c86').r(x, top + 50, dw, 5, '#566c86');                                  // iron bands
    p.raw(`<circle cx="${cx}" cy="${top + 38}" r="30" fill="url(#g-b48cf0)" opacity=".35" class="pu"/>`);
    drawIcon(p, 'lock', cx - 12, top + 26, 3, { A: '#b48cf0', d: '#3b2a5c' });
    return;
  }
  // open: warm light, a trophy inside
  p.r(x, top, dw, dh, '#17101c');
  p.raw(`<circle cx="${cx}" cy="${top + 44}" r="42" fill="url(#g-ffcd75)" opacity=".7" class="pu" style="animation-duration:5s"/>`);
  p.r(x - 2, top, 7, dh, '#7a4a2b').r(x + dw - 5, top, 7, dh, '#6a3f25');                                  // door leaves swung open
  const spr = ICON[a.icon] || ICON.trophy, s = 4.5;
  p.r(cx - 14, base - 22, 28, 22, '#8a94a6').r(cx - 14, base - 22, 28, 3, '#cfd6e0');
  p.raw(`<g${a.isNew ? ' class="fl"' : ''}>`); drawSprite(p, spr, cx - (spr.w * s) / 2, base - 22 - spr.h * s - 2, { s }); p.raw('</g>');
}
