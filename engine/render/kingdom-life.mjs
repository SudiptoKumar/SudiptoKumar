// People, hero, raid and weather of the kingdom (V2). Everything here is decided by state.scene.
import { C } from './palette.mjs';
import { NPC, GOBLIN, GOBLIN2, ICON, makeSprite } from './sprites.mjs';
import * as SC from './scenery.mjs';
import { drawHeroPose, npcStand, npcWalk, npcSleep, umbrella, rot90 } from './actors.mjs';
import { GW, GH, U, L, HERO_SPOT, GROUND_Y } from './kingdom-layout.mjs';

export function drawPeople(K, layout) {
  const { p, S, scene, ph, place } = K;
  const n = scene.npcs, beh = scene.behavior, raid = S.raid || {};
  const keep = (i, total) => !beh.shelter || i < Math.ceil(total * 0.35);       // in rain only a few walk
  const brolly = (i) => (beh.shelter && i % 2 === 0 ? (x, y) => umbrella(p, x + 1.5, y, i % 4 ? '#3b5dc9' : '#b13e53') : null);
  const S75 = 0.75;
  const libs = layout.placed.filter((q) => q.repo.archetype === 'library'), labs = layout.placed.filter((q) => q.repo.archetype === 'lab');
  const houses = layout.placed.filter((q) => q.list === 'village');

  if (beh.home) {
    // night or a quiet kingdom: people are indoors, a few sleep beside their doors, guards patrol with torches
    houses.slice(0, 3).forEach((q, i) => npcSleep(p, q.x + 9, q.y + 1, { s: S75 }));
    if (!raid.active) { npcWalk(p, 'guard', 56, 206, { dx: 48, s: S75, t: 22 }); npcWalk(p, 'guard', 66, 112, { dx: 40, s: S75, t: 26, delay: 6 }); }
  } else {
    const paths = [[86, 96, 0, 100, 'dy'], [16, 111, 140, 0, 'dx'], [62, 177, 24, 0, 'dx'], [90, 191, 34, 0, 'dx']];
    const villagers = ph === 'dawn' ? Math.ceil(n.villager / 2) : n.villager;
    for (let i = 0; i < villagers; i++) {
      if (!keep(i, villagers)) continue;
      const [x, y, dx, dy] = paths[i % paths.length], role = ['villager', 'villager2', 'villager3'][i % 3];
      npcWalk(p, role, x + (dx ? i * 3 : (i % 2) * 4), y, { dx, dy, s: S75, t: Math.max(10, Math.round(Math.max(dx, dy) / 3)), delay: (i * 4) % 11, top: brolly(i) });
    }
    for (let i = 0; i < n.merchant; i++) {                                           // stalls first, the rest roam the plaza
      if (i < 2) npcStand(p, 'merchant', i ? 106 : 70, 120, { s: S75, bob: true });
      else npcWalk(p, 'merchant', 72 + i * 4, 114, { dx: 30, s: S75, t: 18, delay: i * 3 });
    }
    libs.slice(0, n.librarian).forEach((q) => npcStand(p, 'librarian', q.x + 12, q.y, { s: S75, bob: true }));
    for (let i = 0; i < n.researcher; i++) { const q = labs[i] || libs[i] || houses[i]; if (q) npcStand(p, 'researcher', q.x + 11, q.y, { s: S75, bob: true }); }
    for (let i = 0; i < n.miner; i++) npcWalk(p, 'miner', 12 + i * 4, 70, { dx: 9, s: S75, t: 9, delay: i * 3 });
    if (!beh.farmersIn) for (let i = 0; i < n.farmer; i++) npcWalk(p, 'farmer', 8 + (i % 3) * 22, i % 2 ? 190 : 203, { dx: 24, s: S75, t: 20 + i * 2, delay: i * 5 });
    for (let i = 0; i < n.messenger; i++) if (keep(i, n.messenger)) npcWalk(p, 'messenger', 20 + i * 8, 111, { dx: 128 - i * 10, s: S75, t: 11, delay: i * 4 });
    for (let i = 0; i < Math.min(3, S.totals.forks); i++) npcWalk(p, 'traveler', 90 + i * 4, 191 + (i % 2) * 2, { dx: 30, s: S75, t: 16, delay: i * 5 });
    // the newest visitor: arriving with a flag, then sitting by the fire
    const v = scene.stages.visitor;
    if (v?.stage === 'arriving') {
      npcWalk(p, 'traveler', 92, 191, { dx: 34, s: S75, t: 9, top: (x, y) => { p.r(x + 4, y - 4, 1, 6, '#4e2f1c'); p.r(x + 5, y - 4, 3, 2, C.red); } });
    } else if (v?.stage === 'camping') npcStand(p, 'visitor', L.camp[0] + 22, L.camp[1] + 8, { s: S75, bob: true });
  }
  // guards: always at the gate; more of them when there are open issues; during a raid they fight
  const gx = L.gate[0];
  const gate = [gx - 14, gx + 14, gx - 22, gx + 22, gx - 8, gx + 8, gx - 30, gx + 30];
  const fighting = raid.active;
  for (let i = 0; i < Math.min(n.guard, 8); i++) {
    if (beh.home && !fighting && i < 2) continue;
    const x = gate[i], y = fighting ? 200 : 207;
    npcStand(p, 'guard', x, y, { s: S75, bob: !beh.home || fighting });
  }
}

/** The hero, in the pose and place the scene says. */
export function drawHero(K) {
  const { p, S, scene } = K;
  const h = scene.hero, arch = S.hero.class.archetype;
  let [hx, hy] = HERO_SPOT[h.spot] || HERO_SPOT.plaza;
  const pose = h.state;
  if (pose === 'sleeping') { hx = 52; hy = 120; p.raw(`<g opacity="${K.night ? 0.95 : 1}">`); drawHeroPose(p, hx, hy, arch, 'sleeping', { s: 0.75 }); p.raw('</g>'); return; }
  p.ellipse(hx + 4.5, hy + 12, 5, 1, '#000000', 0.25);
  if (pose === 'traveling' || pose === 'walking') {
    p.raw(`<g class="wy" style="--t:18s;--dy:${60 * U}px">`);
    drawHeroPose(p, hx, hy, arch, pose, { s: 0.75 });
    p.raw('</g>');
  } else drawHeroPose(p, hx, hy, arch, pose, { s: 0.75 });
  if (h.umbrella) { const c = '#3b5dc9'; p.r(hx - 2, hy - 3, 16, 1, c).r(hx - 1, hy - 4, 14, 1, c).r(hx + 1, hy - 5, 10, 1, c).r(hx + 3, hy - 6, 6, 1, c).r(hx + 5.5, hy - 2, 1, 5, '#4e2f1c'); p.r(hx - 2, hy - 3, 2, 1, '#b13e53').r(hx + 12, hy - 3, 2, 1, '#b13e53'); }
  if (pose !== 'fighting') p.raw('<g class="bob">').sprite(makeSprite(['YYYYYYY', '.YYYYY.', '..YYY..', '...Y...'], { Y: '#fff0a0' }), hx + 2, hy - (h.umbrella ? 12 : 8), { s: 0.75 }).raw('</g>');
}

/** Raid on the map: goblins enter, guards react, battle, then the result. */
export function drawRaid(K) {
  const { p, S, scene } = K;
  const raid = S.raid || {};
  const ph = scene.stages.raid;
  if (!raid.active && ph !== 'won' && ph !== 'lost') return;
  const gid = [K.sym('g1', GOBLIN, 0.75), K.sym('g2', GOBLIN2, 0.75)];
  const nG = Math.min(raid.goblins || 5, 12) || 5;
  const gx = L.gate[0];
  if (raid.active) {
    for (let i = 0; i < nG; i++) {
      const col = i % 4, row = Math.floor(i / 4);
      const x = gx - 18 + col * 12 + (row % 2) * 4, y = ph === 'enter' ? 205 - row * 5 : 198 - row * 4 + (col % 2);
      if (ph === 'enter') p.raw(`<g class="wy" style="--t:5s;--dy:${-9 * U}px;animation-delay:${-i * 0.4}s"><g class="bob" style="animation-duration:.5s">`).use(gid[i % 2], x - 3, y - 6).raw('</g></g>');
      else p.raw(`<g class="bob" style="animation-duration:.4s;animation-delay:${-i * 0.15}s">`).use(gid[i % 2], x - 3, y - 6).raw('</g>');
      if (i % 3 === 0) { p.r(x + 4, y - 8, 1, 4, '#7a4a2b'); p.raw('<g class="fl">').r(x + 3, y - 11, 3, 3, C.orange).r(x + 4, y - 12, 1, 1, C.yellow).raw('</g>'); K.lights.push({ x: x + 3, y: y - 11, w: 3, h: 3, glow: 1 }); }
    }
    if (ph === 'battle') for (let i = 0; i < 4; i++) { const x = gx - 20 + i * 14; p.raw(`<g class="${i % 2 ? 'f1' : 'f2'}" style="animation-duration:.5s">`).r(x, 193, 4, 1, C.white).r(x + 3, 194, 1, 3, '#fff6a0').r(x + 1, 196, 3, 1, C.white).raw('</g>'); }
    if (ph === 'enter') p.raw('<g class="pu" style="animation-duration:.8s">').sprite(ICON.horn, gx - 4, 180, { s: 1 }).raw('</g>');
    if (ph === 'battle') for (let i = 0; i < 2; i++) p.raw(`<g class="sm" style="animation-delay:${-i * 1.1}s">`).r(gx - 8 + i * 16, 196, 3, 3, '#d6dde6').raw('</g>');
  } else if (ph === 'won') {
    for (let i = 0; i < Math.min(5, nG || 4); i++) p.sprite(rot90(GOBLIN), gx - 22 + i * 11, 198 + (i % 2) * 2, { s: 0.75, op: 0.9 });
    p.sprite(ICON.chest, gx - 4, 196, { s: 1.25 });
    for (let i = 0; i < 3; i++) p.raw(`<g class="tw" style="animation-delay:${-i * 0.7}s">`).r(gx - 6 + i * 6, 192 - i, 1, 1, C.yellow).raw('</g>');
    p.raw('<g class="fl">').r(gx - 28, 186, 1, 12, '#4e2f1c').r(gx - 27, 186, 7, 4, C.yellow).r(gx - 27, 186, 7, 1, '#fff0a0').raw('</g>');
  } else {                                                                            // lost: the gate burns
    for (const x of [gx - 20, gx + 18]) { p.raw('<g class="f1">').sprite(ICON.flame, x, 196, { s: 1 }).raw('</g><g class="f2">').sprite(ICON.flame, x, 196, { s: 1, flip: true }).raw('</g>'); K.lights.push({ x: x, y: 196, w: 8, h: 8, glow: 2 }); }
    for (let i = 0; i < 3; i++) p.raw(`<g class="sm" style="animation-delay:${-i * 1.0}s">`).r(gx - 18 + i * 17, 192, 3, 3, '#566c86').raw('</g>');
  }
}

/** Weather and sky effects that fall in front of everything. */
export function drawWeather(K) {
  const { p, scene, fx } = K;
  const D = { w: GW, h: GH }, wx = scene.weather;
  if (scene.fx.includes('confetti')) SC.confetti(p, fx, 26, D, 30, 150);
  if (wx.kind === 'thunderstorm') { SC.rain(p, fx, true, D); SC.lightning(p, 112, 6, D); }
  else if (wx.kind === 'storm') SC.rain(p, fx, true, D);
  else if (wx.kind === 'rain') SC.rain(p, fx, false, D);
  else SC.fallers(p, fx, K.seasonKey, D);
  if (wx.sunrise) p.raw(`<rect y="${40 * U}" width="${GW * U}" height="${40 * U}" fill="#ffb86b" opacity="0.14"/>`);
}
