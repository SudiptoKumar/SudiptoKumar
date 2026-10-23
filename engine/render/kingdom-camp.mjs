// The visitor camp (TRUE V2): a clearing at the edge of the forest. One tent and one flag for each visitor, newest in front.
// The camp grows with the number of visitors: EMPTY -> CAMP -> VILLAGE -> FESTIVAL (see world/camp.mjs). The same tents stand at the
// same places in every camera; the VISITOR_CAMP camera adds faces on posts (near level of detail).
import { ICON } from './sprites.mjs';
import { C, mix, lighten } from './palette.mjs';
import { drawHeroPose } from './actors.mjs';
import { identicon } from './identicon.mjs';
import { CAMP_CENTER, HUT_SLOTS, TENT_SLOTS } from '../world/camp.mjs';

export const FLAG_COLORS = { red: C.red, blue: C.blue, green: C.green, gold: C.yellow, purple: '#b48cf0', orange: C.orange };
const AVATAR_ARCH = { knight: 'paladin', mage: 'mage', ranger: 'ranger', rogue: 'rogue' };
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** A framed face. The github picture is only used when it passes the same checks as always (png/jpeg, base64, small). */
export function drawAvatar(p, f, x, y, size, items) {
  p.r(x, y, size, size, '#0e1024').frame(x, y, size, size, size / 20, '#3a3f66');
  const style = f.avatar || 'identicon', u = p.u, pad = size / 20;
  if (style === 'github' && items?.[f.login]) {
    const it = items[f.login];
    if (/^image\/(png|jpeg)$/.test(it.mime) && B64.test(it.b64) && it.b64.length < 40000) {
      p.raw(`<image x="${(x + pad) * u}" y="${(y + pad) * u}" width="${(size - 2 * pad) * u}" height="${(size - 2 * pad) * u}" preserveAspectRatio="xMidYMid slice" style="image-rendering:pixelated" href="data:${it.mime};base64,${it.b64}" xlink:href="data:${it.mime};base64,${it.b64}"/>`);
      return;
    }
  }
  if (AVATAR_ARCH[style]) { p.r(x + pad, y + pad, size - 2 * pad, size - 2 * pad, '#2b3d86'); drawHeroPose(p, x + size * 0.2, y + size * 0.1, AVATAR_ARCH[style], 'idle', { s: size / 27, still: true }); return; }
  identicon(p, f.login, x + size * 0.11, y + size * 0.11, size * 0.156);
}

export function drawCamp(K) {
  const { p, W, scene, SE, winter } = K, Cp = W.camp, [cx, cy] = CAMP_CENTER;
  const lit = Cp.total > 0 || scene.light.torches;
  K.place(cy, () => K.obj('camp', { x: cx, y: cy, st: Cp.sig, box: [112, 160, 64, 52], lod: K.lod }, () => {
    // trampled clearing
    p.ellipse(cx, cy + 2, 28, 16, mix(SE.grass, '#b98a54', 0.28)).ellipse(cx, cy + 3, 22, 11, mix(SE.grass, '#b98a54', 0.5));
    p.r(cx - 32, cy + 1, 12, 3, '#b98a54').r(cx - 32, cy + 1, 12, 0.5, '#d3a66e');                   // the path in from the road
    fire(K, cx, cy + 4, lit, Cp.state === 'FESTIVAL' ? 1.1 : 0.75);
    if (Cp.fires === 2) fire(K, cx - 17, cy + 9, true, 0.5);
    if (Cp.state === 'EMPTY') {                                                                      // a stake, a white flag, three ghost tent places
      p.r(cx - 10.5, cy - 12, 0.75, 14, '#4e2f1c'); p.raw('<g class="fl">').r(cx - 9.75, cy - 12, 6, 3.5, '#f4f4f4').r(cx - 9.75, cy - 12, 6, 0.75, '#ffffff').raw('</g>');
      for (const [tx, ty] of TENT_SLOTS.slice(0, 3)) { for (let k = 0; k < 8; k += 2) p.r(tx + k, ty, 1, 0.5, '#f4f4f4', 0.35).r(tx + k, ty + 5.5, 1, 0.5, '#f4f4f4', 0.35); }
    }
    HUT_SLOTS.slice(0, Cp.huts).forEach(([hx, hy]) => hut(K, hx, hy));
    if (Cp.state === 'VILLAGE' || Cp.state === 'FESTIVAL') for (const [lx, ly] of [[cx - 27, cy - 3], [cx + 28, cy - 3], [cx - 11, cy + 13], [cx + 13, cy + 13]]) lantern(K, lx, ly);
    if (Cp.bunting) bunting(K, cx - 29, cx + 29, cy - 12);
  }));
  Cp.visitors.forEach((v) => K.place(v.y + 6, () => K.obj(v.id, { x: v.x, y: v.y, st: `${v.color}:${v.stage}`, box: [v.x - 2, v.y - 8, 16, 16] }, () => tent(K, v))));
  K.solid(112, 160, 62, 46);
}

function tent(K, v) {
  const { p } = K, col = FLAG_COLORS[v.color] || C.red, x = v.x, y = v.y;
  K.shadow(x + 4, y + 6, 11);
  if (v.newest && v.stage === 'arriving') {                                                          // the tent is not up yet: poles and a bundle of canvas
    p.r(x + 1, y, 0.75, 6, '#7a4a2b').r(x + 6, y, 0.75, 6, '#7a4a2b').r(x + 1, y, 6, 0.5, '#a86b3c').r(x + 2.5, y + 4, 3.5, 2, '#e8d5a8');
  } else {
    p.sprite(ICON.tent, x, y, { s: 1, pal: { R: col } });
    p.r(x + 3, y + 3, 2, 3, '#1a1428'); K.lights.push({ x: x + 3, y: y + 3, w: 2, h: 3 });
  }
  p.r(x + 8, y - 5, 0.75, 11, '#4e2f1c');
  p.raw('<g class="fl">').r(x + 8.75, y - 5, 4, 2.5, col).r(x + 8.75, y - 5, 4, 0.5, lighten(col, 0.4)).r(x + 8.75, y - 2.5, 1.75, 1, col).raw('</g>');
  if (v.newest) p.raw('<g class="bob">').sprite(ICON.arrow, x + 6.5, y - 10, { s: 0.75 }).raw('</g>');            // the newest visitor: the overlay's speech bubble belongs to this tent
}

function fire(K, x, y, lit, s) {
  const { p } = K;
  p.r(x - 3, y + 1, 6, 1, '#4e2f1c').r(x - 2.5, y, 5, 1, '#7a4a2b');
  for (let k = 0; k < 5; k++) p.r(x - 3.5 + k * 1.5, y + 1.5 + (k % 2) * 0.25, 1.25, 1, '#5e687c');
  if (!lit) { p.r(x - 2, y - 0.5, 4, 1, '#2a2230').r(x - 0.5, y - 1.25, 1, 0.75, '#ef5a5a', 0.7); return; }   // cold embers
  const fw = 8 * s, fh = 8 * s;
  p.raw('<g class="f1">').sprite(ICON.flame, x - fw / 2, y - fh + 1, { s }).raw('</g><g class="f2">').sprite(ICON.flame, x - fw / 2, y - fh + 1, { s, flip: true }).raw('</g>');
  K.lights.push({ x: x - 2.5, y: y - fh, w: 5, h: 5, glow: 1 });
  for (let k = 0; k < 2; k++) p.raw(`<g class="sm" style="animation-delay:${-k * 1.6}s">`).r(x - 0.5 + k * 1.5, y - fh - 1, 1.5, 1.5, '#d6dde6').raw('</g>');
}

function hut(K, x, y) {
  const { p, winter } = K;
  K.shadow(x + 5, y + 9, 13);
  p.r(x, y + 3, 10, 6, '#7a4a2b').r(x, y + 3, 10, 0.5, '#a86b3c');
  for (let k = 1; k < 5; k++) p.r(x + k * 2, y + 3.5, 0.25, 5.5, '#4e2f1c');
  p.r(x - 1, y + 2, 12, 1, '#d9a066').r(x, y + 1, 10, 1, '#d9a066').r(x + 1, y, 8, 1, '#d9a066').r(x + 2, y - 1, 6, 1, '#d9a066').r(x - 1, y + 2.75, 12, 0.25, '#b5793a');
  p.r(x + 4, y + 5, 2.5, 4, '#4e2f1c').r(x + 7.5, y + 4.5, 1.5, 1.5, '#f4e0b0'); K.lights.push({ x: x + 7.5, y: y + 4.5, w: 1.5, h: 1.5 });
  if (winter) p.r(x - 1, y + 2, 12, 0.75, '#f4f8fc').r(x + 1, y, 8, 0.75, '#f4f8fc').r(x + 2, y - 1, 6, 0.75, '#f4f8fc');
}

function lantern(K, x, y) {
  const { p } = K;
  p.r(x, y - 5, 0.5, 5, '#4e2f1c').r(x - 0.5, y - 6.5, 1.5, 1.5, C.orange).r(x - 0.5, y - 6.5, 1.5, 0.5, C.yellow);
  K.lights.push({ x: x - 0.75, y: y - 6.75, w: 2, h: 2, glow: 0 });
}

function bunting(K, x0, x1, y) {
  const { p } = K, cols = [C.red, C.yellow, C.cyan, C.lime, '#ff9ecb'];
  p.r(x0, y - 2, 0.75, 14, '#4e2f1c').r(x1, y - 2, 0.75, 14, '#4e2f1c');
  for (let x = x0 + 1, i = 0; x < x1; x += 3, i++) {
    const t = (x - x0) / (x1 - x0), yy = y - 1 + Math.round(2.5 * Math.sin(t * Math.PI) * 2) / 2;
    p.r(x, yy, 3, 0.25, '#4e2f1c');
    p.raw(`<g class="${i % 2 ? 'f1' : 'f2'}">`).r(x + 0.5, yy + 0.25, 1.75, 1.75, cols[i % 5]).raw('</g>');
  }
}
