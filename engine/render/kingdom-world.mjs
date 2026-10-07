// Terrain of the kingdom (V2): sky, mountains, ground, districts, river, roads, seasons, underground.
import { C, SEASONS, mix, lighten, darken } from './palette.mjs';
import { ICON, GOBLIN, GOBLIN2, TREE_OAK, TREE_PINE, ROCK } from './sprites.mjs';
import * as SC from './scenery.mjs';
import { GW, GH, U, GROUND_Y, L, ROADS } from './kingdom-layout.mjs';
import { stone, crenel } from './buildings.mjs';
import { rot90 } from './actors.mjs';

const DIM = { w: GW, h: GH };

export function drawSky(K) {
  const { p, S, scene, ph, fx } = K;
  const wx = scene.weather, stormy = K.stormy;
  const auroraI = S.world.lighting.aurora;   // TRUE V2 (Phase 4): gated — aurora never appears in daylight
  SC.sky(p, DIM, 62);
  if (K.night) SC.stars(p, fx, stormy ? 8 : 70, DIM, 40);
  if (auroraI > 0) SC.aurora(p, fx, DIM, 0.17 * auroraI + 0.03);
  if (wx.kind !== 'thunderstorm') {
    if (ph === 'day') SC.sun(p, 148, 16); else if (ph === 'dawn') SC.sun(p, 30, 44, true); else if (ph === 'evening') SC.sun(p, 150, 44, true); else SC.moon(p, 146, 16);
  }
  SC.clouds(p, fx, { count: stormy ? 7 : wx.rain ? 6 : wx.sunrise ? 2 : 4, dark: wx.kind === 'thunderstorm' ? 0.75 : stormy ? 0.55 : wx.rain ? 0.35 : 0, night: K.night, phase: ph });
  // TRUE V2 (Phase 5): firework count follows the choreography phase.
  if (scene.fx.includes('fireworks')) {
    const fi = S.world.fxIntensity?.fireworks ?? 1;
    const bursts = [[34, 26, C.red, 0], [146, 30, C.cyan, -1.2], [88, 9, C.yellow, -2.2]];
    const n = Math.max(1, Math.round(bursts.length * fi));
    for (let i = 0; i < n; i++) SC.burst(p, bursts[i][0], bursts[i][1], bursts[i][2], bursts[i][3]);
  }
  if (scene.fx.includes('shootingStars') || scene.modes.includes('NIGHT') && K.S.events.active.some((e) => e.type === 'nightstars')) {
    for (const [x, y, dl] of [[40, 12, 0], [120, 8, -2.4]]) p.raw(`<g class="fa" style="animation-delay:${dl}s;animation-duration:5s">`).r(x, y, 3, 1, C.white).r(x - 1, y - 1, 1, 1, '#c8d4ff', 0.7).raw('</g>');
  }
}

export function drawMountains(K) {
  const { p, winter } = K;
  const snow = winter ? 9 : 4;
  SC.range(p, 0, GW - 1, 52, [[18, 24, 0.9], [62, 18, 1], [112, 22, 1], [156, 28, 0.9]], '#8da6c8', '#b6c9e0', snow + 1);
  SC.range(p, 0, 80, 58, [[26, 27, 0.95], [68, 15, 1]], '#6b86aa', '#8fa8c8', snow);
  SC.range(p, 96, GW - 1, 58, [[150, 31, 0.95], [112, 14, 1]], '#6b86aa', '#8fa8c8', snow);
}

/** Ground, district floors, river, roads. Fills K.blocked so trees and decoration keep out of the way. */
export function drawGround(K) {
  const { p, SE, rnd, winter, wet } = K;
  p.r(0, 48, GW, GROUND_Y - 48, SE.grass);
  for (let i = 0; i < 560; i++) p.r(rnd.int(0, GW - 2), rnd.int(49, GROUND_Y - 1), rnd() < 0.3 ? 2 : 1, 1, SE.grass2);
  for (let i = 0; i < 150; i++) p.r(rnd.int(0, GW - 2), rnd.int(49, GROUND_Y - 1), 1, 1, lighten(SE.grass, 0.18));
  p.ellipse(88, 92, 50, 11, lighten(SE.grass, 0.1)).ellipse(88, 94, 44, 8, lighten(SE.grass, 0.06));

  // district floors: paving for the automation district, warm cobbles for the library district
  const slab = winter ? '#d6e6f2' : mix(SE.grass, '#8a94a6', 0.5);
  p.r(114, 112, 62, 48, slab).r(114, 112, 62, 1, lighten(slab, 0.25)).r(114, 159, 62, 1, darken(slab, 0.2));
  for (let x = 114; x < 176; x += 14) p.r(x, 112, 1, 48, darken(slab, 0.12), 0.7);
  for (let y = 112; y < 160; y += 15) p.r(114, y, 62, 1, darken(slab, 0.12), 0.7);
  const cob = winter ? '#e8e2d2' : mix(SE.grass, '#c9a46a', 0.45);
  p.r(4, 106, 60, 54, cob).r(4, 106, 60, 1, lighten(cob, 0.25)).r(4, 159, 60, 1, darken(cob, 0.2));
  for (let i = 0; i < 90; i++) p.r(rnd.int(5, 62), rnd.int(108, 157), 1, 1, darken(cob, 0.18));

  // river with one bridge
  const water = SE.water, off = (x) => Math.round(1.4 * Math.sin(x / 8.5));
  let x0 = 0, cur = off(0);
  const seg = [];
  for (let x = 1; x <= GW; x++) { const o = x < GW ? off(x) : null; if (o !== cur) { seg.push([x0, x - x0, cur]); x0 = x; cur = o; } }
  for (const [sx, len, o] of seg) {
    const y = L.river[0] + o - 0; // river top
    p.r(sx, y - 1, len, 8, darken(water, 0.28)).r(sx, y, len, 6, K.winter ? '#cfeeff' : water).r(sx, y, len, 1, lighten(water, 0.45), 0.8).r(sx, y + 5, len, 1, darken(water, 0.15));
  }
  if (winter) for (let i = 0; i < 12; i++) p.r(8 + i * 14, 162 + (i % 3), 5, 1, '#ffffff', 0.7);
  else for (let i = 0; i < 9; i++) p.raw(`<g class="tw" style="animation-delay:${-i * 0.6}s">`).r(6 + i * 20, 162 + (i % 2) * 2, 3, 1, '#ffffff', 0.7).raw('</g>');
  K.solid(0, 158, GW, 10);

  // pond (south-west) and its reeds
  const [pcx, pcy] = L.pond;
  p.ellipse(pcx, pcy, 12, 6, darken(water, 0.25)).ellipse(pcx, pcy, 11, 5, winter ? '#dff4ff' : water);
  if (winter) { p.line(pcx - 7, pcy - 1, pcx - 2, pcy + 1, '#9fd2ee'); p.line(pcx + 1, pcy - 2, pcx + 6, pcy + 1, '#9fd2ee'); }
  else p.r(pcx - 6, pcy - 2, 4, 1, lighten(water, 0.4), 0.8).r(pcx + 2, pcy + 1, 3, 1, lighten(water, 0.4), 0.8);
  for (const [rx, ry] of [[-11, -2], [11, 1], [-8, 5], [9, -4]]) p.r(pcx + rx, pcy + ry - 3, 1, 3, '#2f9e5b').r(pcx + rx + 1, pcy + ry - 2, 1, 2, '#4fd070');
  K.solid(pcx - 14, pcy - 8, 28, 16);

  // roads (dirt, with a lighter top edge); the bridge sits where the main road meets the river
  const dirt = winter ? mix(C.dirt, '#ffffff', 0.5) : C.dirt, dirtD = winter ? mix(C.dirtD, '#ffffff', 0.4) : C.dirtD, dirtL = winter ? mix(C.dirtL, '#ffffff', 0.5) : C.dirtL;
  for (const [x1, y1, x2, y2, w] of ROADS) {
    const x = Math.min(x1, x2) - (x1 === x2 ? w / 2 : 0), y = Math.min(y1, y2) - (y1 === y2 ? w / 2 : 0);
    const rw = x1 === x2 ? w : Math.abs(x2 - x1), rh = y1 === y2 ? w : Math.abs(y2 - y1);
    p.r(x - 1, y - 1, rw + 2, rh + 2, dirtD).r(x, y, rw, rh, dirt);
    for (let i = 0; i < (rw * rh) / 18; i++) p.r(x + rnd.int(0, rw - 1), y + rnd.int(0, rh - 1), 1, 1, rnd() < 0.5 ? dirtL : dirtD);
    K.solid(x - 2, y - 2, rw + 4, rh + 4);
  }
  if (wet) for (const [x, y, w] of [[84, 128, 4], [90, 150, 3], [60, 111, 5], [120, 111, 4], [88, 186, 3]]) p.ellipse(x, y, w, 1, '#9fd2f0', 0.55);
  // bridge
  const bx = 88, by = 159;
  p.r(bx - 5, by - 1, 10, 10, '#4e2f1c').r(bx - 4, by, 8, 8, '#a86b3c');
  for (let i = 0; i < 8; i += 2) p.r(bx - 4, by + i, 8, 1, '#7a4a2b');
  p.r(bx - 5, by - 1, 1, 10, '#7a4a2b').r(bx + 4, by - 1, 1, 10, '#7a4a2b').r(bx - 5, by - 2, 10, 1, '#d3a66e');
}

/** Everything that decorates the ground differently in each season. */
export function drawSeasonDecor(K) {
  const { p, SE, seasonKey, rnd, free, place } = K;
  const spots = (n, margin = 2, area = [4, 52, GW - 8, 156]) => { const out = []; for (let i = 0; i < n * 8 && out.length < n; i++) { const x = rnd.int(area[0], area[0] + area[2]), y = rnd.int(area[1], area[1] + area[3]); if (free(x, y, margin)) out.push([x, y]); } return out; };
  if (seasonKey === 'spring') {
    for (const [x, y] of spots(80, 1)) p.r(x, y, 1, 1, rnd() < 0.5 ? '#ff9ecb' : rnd() < 0.5 ? '#f4f4f4' : '#ffcd75').r(x, y + 1, 1, 1, '#2e9e57');
  } else if (seasonKey === 'summer') {
    for (const [x, y] of spots(14, 2)) place(y, () => { p.r(x, y - 5, 1, 5, '#2e9e57').r(x - 1, y - 7, 3, 3, '#ffcd75').r(x, y - 6, 1, 1, '#7a4a2b'); });
    for (let i = 0; i < 3; i++) p.raw(`<g class="wk" style="--t:${14 + i * 3}s;--dx:${(26 + i * 10) * U}px;animation-delay:${-i * 4}s"><g class="bob" style="animation-duration:.5s">`).r(30 + i * 40, 90 + i * 20, 1, 1, '#ff9ecb').r(31 + i * 40, 90 + i * 20, 1, 1, '#ffffff').raw('</g></g>');
  } else if (seasonKey === 'autumn') {
    for (const [x, y] of spots(9, 2, [4, 164, 80, 38])) place(y, () => { p.r(x, y - 3, 4, 3, '#ef7d57').r(x + 1, y - 4, 2, 1, '#ef7d57').r(x + 1, y - 4, 2, 1, '#2e7d32').r(x, y - 3, 1, 3, '#b5593a').r(x + 3, y - 3, 1, 3, '#b5593a'); });
    for (const [x, y] of spots(10, 1)) p.r(x, y, 3, 1, rnd() < 0.5 ? '#ef7d57' : '#b13e53').r(x + 1, y - 1, 1, 1, '#ffcd75');
    for (const [x, y] of spots(4, 3, [96, 164, 60, 40])) place(y, () => { p.r(x - 3, y - 4, 7, 4, '#d9a066').r(x - 3, y - 4, 7, 1, '#f2c27a').r(x - 3, y - 2, 7, 1, '#b5793a'); });
  } else if (seasonKey === 'winter') {
    for (const [x, y] of [[70, 108], [108, 112], [34, 204]]) place(y, () => { p.r(x - 2, y - 3, 5, 3, '#fff').r(x - 1, y - 6, 3, 3, '#fff').r(x, y - 5, 1, 1, '#1a1c2c').r(x + 1, y - 4, 2, 1, '#ef7d57').r(x - 3, y - 4, 1, 3, '#7a4a2b').r(x + 3, y - 4, 1, 3, '#7a4a2b'); });
    for (const [x, y] of spots(40, 1)) p.r(x, y, 2, 1, '#ffffff', 0.8);
  }
}

/** The cutaway under the gate: layers of earth, the issue dungeon, gems and the goblin outpost. */
export function drawUnderground(K) {
  const { p, S, scene, rnd, night } = K;
  const y0 = GROUND_Y, H = GH - y0;
  p.r(0, y0, GW, H, '#3a2a22');
  for (let i = 0; i < 260; i++) p.r(rnd.int(0, GW - 2), rnd.int(y0, GH - 1), rnd() < 0.3 ? 3 : 2, 1, rnd() < 0.5 ? '#4a362b' : '#2e211b');
  p.r(0, y0, GW, 4, '#5a3f2e'); p.r(0, y0 + 4, GW, 1, '#2e211b');                           // topsoil
  for (let x = 4; x < GW; x += 9) p.r(x, y0 + 4, 1, 3 + (x % 5), '#4e3a22');                  // roots
  p.r(0, y0 + 14, GW, H - 14, '#2c2230');                                                      // rock layer
  for (let i = 0; i < 160; i++) p.r(rnd.int(0, GW - 2), rnd.int(y0 + 14, GH - 1), rnd() < 0.4 ? 3 : 2, 1, rnd() < 0.5 ? '#3a2d3f' : '#231a27');
  // gems in the west rock
  for (const [gx, gy, c] of [[14, 232, '#73eff7'], [20, 236, '#a7f070'], [30, 230, '#b48cf0'], [38, 235, '#73eff7']]) { p.r(gx, gy - 3, 2, 3, c).r(gx, gy - 4, 1, 1, '#ffffff').r(gx + 2, gy - 2, 1, 2, darken(c, 0.2)); K.lights.push({ x: gx, y: gy - 3, w: 2, h: 3, glow: 0, color: c }); }
  // the cavern
  const cav = (x, y, w, h) => { p.r(x, y, w, h, '#17101c'); p.r(x, y, w, 1, '#2a1f30'); p.r(x, y + h - 1, w, 1, '#0e0912'); };
  cav(52, y0 + 6, 76, 26);                  // dungeon hall
  cav(84, y0 + 1, 8, 6);                    // stairs down from the gate
  for (let i = 0; i < 6; i++) p.r(84 + (i % 2), y0 + 2 + i, 6, 1, i % 2 ? '#5e687c' : '#8a94a6');
  p.r(52, y0 + 31, 76, 1, '#4e3a2c');       // floor
  for (let x = 56; x < 126; x += 14) { p.r(x, y0 + 9, 1, 16, '#566c86'); p.r(x + 4, y0 + 9, 1, 16, '#566c86'); p.r(x, y0 + 9, 5, 1, '#566c86'); p.r(x, y0 + 24, 5, 1, '#566c86'); } // cells
  for (const tx of [55, 123]) { p.r(tx, y0 + 20, 1, 3, '#7a4a2b'); p.raw('<g class="fl">').r(tx - 1, y0 + 18, 3, 2, C.orange).r(tx, y0 + 17, 1, 1, C.yellow).raw('</g>'); K.lights.push({ x: tx - 1, y: y0 + 18, w: 3, h: 2, glow: 1 }); }
  // goblins: one for each open issue (at most 10), a boss from 10 up
  const nG = Math.min(S.goblins.count, 10), gid = [K.sym('g1', GOBLIN, 0.75), K.sym('g2', GOBLIN2, 0.75)];
  const spots = [[60, 24], [74, 24], [88, 25], [102, 24], [116, 24], [66, 14], [80, 14], [94, 14], [108, 14], [120, 14]];
  for (let i = 0; i < nG; i++) { const [gx, gy] = spots[i]; p.raw(`<g class="bob" style="animation-delay:${-(i % 5) * 0.25}s">`).use(gid[i % 2], gx - 3, y0 + gy - 6).raw('</g>'); }
  if (S.goblins.tier === 'boss') p.raw('<g class="bob2">').sprite(GOBLIN, 96, y0 + 14, { s: 1.6 }).r(97, y0 + 12, 8, 2, C.yellow).r(97, y0 + 10, 2, 2, C.yellow).r(103, y0 + 10, 2, 2, C.yellow).raw('</g>');
  if (nG === 0) { p.r(60, y0 + 26, 6, 5, '#a86b3c').r(60, y0 + 26, 6, 1, '#d3a66e'); p.raw('<g class="tw">').r(100, y0 + 18, 1, 3, '#a7f070').r(99, y0 + 19, 3, 1, '#a7f070').raw('</g>'); }   // an empty gate: open cells, a quiet spark
  // the goblin outpost to the east: awake when a raid could come, asleep while they rest
  const R = S.raid || {};
  p.r(140, y0 + 12, 30, 20, '#17101c');
  p.r(146, y0 + 22, 14, 9, '#4a5b3a').r(150, y0 + 18, 6, 4, '#4a5b3a').r(150, y0 + 18, 6, 1, '#6a7f4f'); // tent
  p.r(163, y0 + 14, 1, 17, '#7a4a2b'); p.raw('<g class="fl">').r(164, y0 + 14, 5, 4, C.red).raw('</g>');
  const outpost = R.available === false && !R.active ? 'rest' : 'ready';
  for (let i = 0; i < 2; i++) {
    const gx = 142 + i * 6, gy = y0 + 30;
    if (outpost === 'rest') { p.sprite(rot90(GOBLIN), gx, gy - 8, { s: 0.75 }); p.raw(`<g class="zz" style="animation-delay:${-i}s">`).r(gx + 2, gy - 12, 2, 1, '#fff').raw('</g>'); }
    else p.raw(`<g class="bob" style="animation-delay:${-i * 0.3}s">`).use(gid[i % 2], gx, gy - 6).raw('</g>');
  }
  if (outpost === 'ready') { p.raw('<g class="pu">').sprite(ICON.horn, 150, y0 + 8, { s: 0.75 }).raw('</g>'); }
  K.lights.push({ x: 162, y: y0 + 13, w: 3, h: 3, glow: 0 });
}
