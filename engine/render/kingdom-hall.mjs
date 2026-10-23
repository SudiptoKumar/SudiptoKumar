// The Trophy Hall (TRUE V2): a two-storey gallery on the map, open at the front. Every achievement is a pedestal (or a door) inside it.
// The overworld shows it from afar; the TROPHY_HALL camera shows the same building up close. The layout comes from world/hall.mjs.
import { ICON } from './sprites.mjs';
import { C } from './palette.mjs';
import { HALL } from '../world/hall.mjs';

const BRICK = '#2a2d4a', BRICK2 = '#34385c', FLOOR1 = '#3a3f66', FLOOR2 = '#2e3252', STONE = '#8a94a6', STONE_D = '#5e687c', STONE_L = '#cfd6e0', SLATE = '#566c86';

export function drawHall(K) {
  const { p, W, scene, winter } = K, H = W.hall, [hx, hy, hw, hh] = H.rect;
  K.glow('#ffcd75'); K.glow('#b48cf0');
  K.place(hy + hh, () => K.obj('hall', { x: hx + hw / 2, y: hy + hh, foot: true, st: H.sig, box: [hx - 2, hy - 12, hw + 4, hh + 16], lod: K.lod }, () => {
    K.shadow(hx + hw / 2, hy + hh, hw + 2, 2);
    const near = K.lod === 'near', x0 = hx + 2, w0 = hw - 4;
    // back wall, bricks, floors
    p.r(x0, hy + 4, w0, hh - 4, BRICK);
    for (let y = hy + 5; y < hy + hh - 2; y += 2) p.r(x0, y, w0, 0.25, BRICK2);
    if (near) for (let y = hy + 5, row = 0; y < hy + hh - 2; y += 2, row++) for (let x = x0 + (row % 2 ? 0 : 2); x < x0 + w0; x += 4) p.r(x, y, 0.25, 2, BRICK2);
    const [up, low] = HALL.floorY;
    p.r(x0, up, w0, 2, '#1c1e36').r(x0, up, w0, 0.5, '#4a4f7a');                       // the beam between the storeys
    p.r(x0, low, w0, hy + hh - low, FLOOR1);
    for (let fx = x0, k = 0; fx < x0 + w0; fx += 2, k++) if (k % 2 === 0) p.r(fx, low, 2, hy + hh - low, FLOOR2);
    p.r(x0, low - 0.25, w0, 0.25, '#1c1e36');
    // pillars and roof: slate with a gold cornice, a small pediment with the golden cup
    p.r(hx, hy + 3, 2, hh - 3, STONE).r(hx, hy + 3, 0.5, hh - 3, STONE_L).r(hx + 1.5, hy + 3, 0.5, hh - 3, STONE_D);
    p.r(hx + hw - 2, hy + 3, 2, hh - 3, STONE).r(hx + hw - 2, hy + 3, 0.5, hh - 3, STONE_L).r(hx + hw - 0.5, hy + 3, 0.5, hh - 3, STONE_D);
    p.r(hx - 1, hy + 1, hw + 2, 3, SLATE).r(hx - 1, hy + 3.5, hw + 2, 0.5, '#2b3a4f');
    p.r(hx - 1, hy - 0.5, hw + 2, 1.5, '#e0a030').r(hx - 1, hy - 0.5, hw + 2, 0.5, '#ffe08a');
    const cx = hx + hw / 2;
    p.r(cx - 3, hy - 1.5, 6, 1, '#e0a030').r(cx - 3, hy - 1.5, 6, 0.25, '#ffe08a');
    p.sprite(ICON.trophy, cx - 2, hy - 5.5, { s: 0.5 });                              // the golden cup on the roof says what this is
    if (winter) p.r(hx - 1, hy - 0.5, hw + 2, 0.75, '#f4f8fc');
    // steps to the cross road
    p.r(cx - 5, hy + hh, 10, 1, STONE).r(cx - 4, hy + hh + 1, 8, 1, STONE_D);
    // torches between the groups of four, and at both ends
    for (const tx of [x0 + 1.5, HALL.innerX + HALL.cell * 4, x0 + w0 - 1.5]) for (const fy of [up - 4, low - 4]) {
      p.r(tx - 0.25, fy, 0.5, 3, '#7a4a2b').r(tx - 0.75, fy - 0.5, 1.5, 0.5, SLATE);
      p.raw('<g class="fl">').r(tx - 0.75, fy - 2, 1.5, 1.5, C.orange).r(tx - 0.25, fy - 3, 0.75, 1, C.yellow).raw('</g>');
      K.lights.push({ x: tx - 1, y: fy - 3, w: 2, h: 2, glow: 1 });
    }
    // what stands inside
    for (const ped of H.pedestals) ped.state.startsWith('door') ? door(K, ped) : pedestal(K, ped, near);
  }));
  K.solid(hx - 2, hy - 12, hw + 4, hh + 16);
  if (scene.light.gold) K.spots.push({ x: hx + hw / 2, y: hy + 14, r: 30, color: '#ffcd75', pulse: true, op: 0.6 });
}

function pedestal(K, ped, near) {
  const { p } = K, cx = ped.x, by = ped.y, pw = 4.5;
  p.r(cx - pw / 2, by - 3, pw, 3, STONE).r(cx - pw / 2, by - 3, pw, 0.5, STONE_L).r(cx + pw / 2 - 0.5, by - 2.5, 0.5, 2.5, STONE_D);
  p.r(cx - pw / 2 - 0.5, by - 0.75, pw + 1, 0.75, STONE_D).r(cx - pw / 2 - 0.5, by - 0.75, pw + 1, 0.25, STONE);
  if (ped.state === 'empty') { p.sprite(ICON.lock, cx - 1, by - 2.5, { s: 0.25, pal: { A: SLATE, d: '#2b2e4d' } }); return; }
  const spr = ICON[ped.icon] || ICON.trophy, s = ped.major ? 0.75 : 0.5, tw = spr.w * s, th = spr.h * s, ty = by - 3 - th - 0.5;
  if (ped.major) {
    p.raw(`<circle cx="${cx * 4}" cy="${(ty + th / 2) * 4}" r="${9 * 4}" fill="url(#g-ffcd75)" opacity=".5"/>`);
    if (near) for (let k = 1; k <= 6; k++) p.r(cx - k * 0.7, ty - 6 + k, k * 1.4, 1, '#fff6a0', 0.05);
  }
  p.raw(`<g class="${ped.isNew ? 'fl' : ped.major ? 'pu' : ''}"${ped.major && !ped.isNew ? ' style="animation-duration:4s"' : ''}>`);
  p.sprite(spr, cx - tw / 2, ty, { s });
  p.raw('</g>');
  p.r(cx - 1.5, by - 2, 3, 1, '#e0a030').r(cx - 1.5, by - 2, 3, 0.25, '#ffe08a');                     // plaque
  K.lights.push({ x: cx - 1, y: ty + th / 2 - 1, w: 2, h: 2, glow: 0, color: '#ffcd75' });
  if (ped.isNew) for (let k = 0; k < 3; k++) p.raw(`<g class="tw" style="animation-delay:${-k * 0.8}s">`).r(cx - 2.5 + k * 2.5, ty - 1 + (k % 2) * 1, 0.75, 0.75, '#ffffff').raw('</g>');
}

function door(K, ped) {
  const { p } = K, cx = ped.x, by = ped.y, dw = 4.5, dh = 8, x = cx - dw / 2, top = by - dh;
  p.r(x - 0.75, top - 0.75, dw + 1.5, dh + 0.75, STONE_D).r(x - 0.75, top - 0.75, dw + 1.5, 0.5, STONE);
  if (ped.state === 'door-locked') {
    p.r(x, top, dw, dh, '#4e2f1c').r(x, top, dw, 0.5, '#7a4a2b');
    for (let k = 0; k < 3; k++) p.r(x + 1 + k * 1.25, top + 0.5, 0.25, dh - 0.5, '#3a2214');
    p.r(x, top + 1.5, dw, 0.75, SLATE).r(x, top + 5, dw, 0.75, SLATE);
    p.raw(`<circle cx="${cx * 4}" cy="${(top + 4) * 4}" r="${6 * 4}" fill="url(#g-b48cf0)" opacity=".35" class="pu"/>`);
    p.sprite(ICON.lock, cx - 1, top + 2.5, { s: 0.25, pal: { A: '#b48cf0', d: '#3b2a5c' } });
    return;
  }
  p.r(x, top, dw, dh, '#17101c');
  p.raw(`<circle cx="${cx * 4}" cy="${(top + 4.5) * 4}" r="${8 * 4}" fill="url(#g-ffcd75)" opacity=".7" class="pu" style="animation-duration:5s"/>`);
  p.r(x - 1, top, 1, dh, '#7a4a2b').r(x + dw, top, 1, dh, '#6a3f25');                                   // door leaves swung open
  const spr = ICON[ped.icon] || ICON.trophy;
  p.r(cx - 1.5, by - 2.5, 3, 2.5, STONE).r(cx - 1.5, by - 2.5, 3, 0.5, STONE_L);
  p.raw(`<g${ped.isNew ? ' class="fl"' : ''}>`); p.sprite(spr, cx - (spr.w * 0.5) / 2, by - 2.5 - spr.h * 0.5 - 0.25, { s: 0.5 }); p.raw('</g>');
  K.lights.push({ x: cx - 1, y: top + 2, w: 2, h: 2, glow: 1, color: '#ffcd75' });
}
