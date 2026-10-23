// People, hero, raid and weather of the kingdom (TRUE V2). Everything here is decided by state.scene and the world model.
import { C } from './palette.mjs';
import { GOBLIN, GOBLIN2, ICON, makeSprite } from './sprites.mjs';
import * as SC from './scenery.mjs';
import { drawHeroPose, npcStand, npcWalk, npcSleep, umbrella, rot90 } from './actors.mjs';
import { GW, GH, U, SCALE } from '../world/constants.mjs';
import { ANCHORS, routeLength, pointAlong } from '../world/layout.mjs';
import { CAMP_CENTER } from '../world/camp.mjs';
import { markerFits } from '../world/quests.mjs';

const TONES = ['#3b5dc9', '#b13e53', '#2e9e57', '#e0a030'];

/** Draw one person in the behaviour state the world model gave them. Walkers are ambient loops that start at (x, y). */
function drawNpc(K, e) {
  const { p } = K, s = SCALE.npc, { role, x, y } = e;
  if (e.state !== 'WALKING' && e.state !== 'FLEEING') K.shadow(x + 2.25, y, 5, 1);
  const top = e.top === 'umbrella' ? (tx, ty) => umbrella(p, tx + 1.5, ty, TONES[e.tone || 0])
    : e.top === 'flag' ? (tx, ty) => { p.r(tx + 4, ty - 4, 1, 6, '#4e2f1c'); p.r(tx + 5, ty - 4, 3, 2, C.red); }
    : e.top === 'alert' ? (tx, ty) => { p.r(tx + 2, ty - 4, 1, 2.5, C.red).r(tx + 2, ty - 1, 1, 1, C.red); }
    : e.top === 'bucket' ? (tx, ty) => { p.r(tx + 4.5, ty + 3.5, 1.75, 1.75, '#41a6f6').r(tx + 4.5, ty + 3.5, 1.75, 0.25, '#ffffff'); } : null;
  switch (e.state) {
    case 'SLEEPING': npcSleep(p, x, y, { s }); break;
    case 'WALKING': case 'FLEEING': npcWalk(p, role, x, y, { dx: e.dx || 0, dy: e.dy || 0, s, t: e.t || 14, delay: e.delay || 0, top }); break;
    case 'WORKING': npcStand(p, role, x, y, { s, bob: true }); break;
    case 'FIGHTING':
      p.raw('<g class="bob" style="animation-duration:.45s">'); npcStand(p, role, x, y, { s }); p.raw('</g>');
      p.raw('<g class="f1" style="animation-duration:.5s">').r(x + 4.5, y - 6.5, 2, 0.5, C.white).r(x + 6, y - 7.5, 0.5, 2, '#fff6a0').raw('</g>'); break;
    case 'CELEBRATING':
      p.raw('<g class="bob" style="animation-duration:.45s">'); npcStand(p, role, x, y, { s }); p.raw('</g>');
      p.raw(`<g class="tw" style="animation-delay:${-(x % 7) * 0.2}s">`).r(x - 1, y - 9, 0.75, 0.75, C.yellow).r(x + 5, y - 8, 0.75, 0.75, C.white).raw('</g>'); break;
    default: npcStand(p, role, x, y, { s });                                       // IDLE, RESTING: standing still
  }
}

/** Everybody in the kingdom, drawn from the world model (K.W.npcs): the same people in the same places and states in every camera. */
export function drawPeople(K) {
  for (const e of K.W.npcs) {
    const wx = e.dx || 0, wy = e.dy || 0, box = [Math.min(e.x, e.x + wx) - 4, Math.min(e.y, e.y + wy) - 14, Math.abs(wx) + 14, Math.abs(wy) + 20];
    K.place(e.y + 0.2, () => K.obj(e.id, { x: e.x, y: e.y, st: `${e.role}:${e.state}`, box }, () => drawNpc(K, e)));      // depth-sorted with the buildings
  }
}

/** The hero, in the pose and place the world model says. His size is one shared constant (SCALE.hero), so he is the same in every camera. */
export function drawHero(K) {
  const { p, S, W } = K, h = W.hero, arch = S.hero?.class?.archetype || 'adventurer', s = SCALE.hero;
  const xs = (h.route || [[h.x, h.y]]).map((q) => q[0]).concat(h.x), ys = (h.route || [[h.x, h.y]]).map((q) => q[1]).concat(h.y);
  const x0 = Math.min(...xs) - 14, y0 = Math.min(...ys) - 30;
  K.place(h.y + 0.5, () => K.obj('hero', { x: h.x, y: h.y, st: `${h.state}|${h.spot}|${h.umbrella ? 'u' : ''}|${h.t ?? ''}`, box: [x0, y0, Math.max(...xs) + 14 - x0, Math.max(...ys) + 6 - y0] }, () => {
    const pose = h.state;
    if (pose === 'sleeping') { p.raw(`<g opacity="${K.night ? 0.95 : 1}">`); drawHeroPose(p, h.x - 5, h.y - 7, arch, 'sleeping', { s: 0.75 }); p.raw('</g>'); return; }
    if (h.route && h.t != null) {                                                    // footprints along the road he has walked so far
      const total = routeLength(h.route), end = h.t * total;
      for (let d = 0; d < end - 5; d += 3) { const q = pointAlong(h.route, d / total); p.r(q.x - 0.25, q.y - 0.5, 0.75, 0.5, '#fff6a0', 0.55); }
    }
    const hx = h.x - 6 * s, hy = h.y - 16 * s;
    K.shadow(h.x, h.y, 12, 1.6);
    const turned = h.face < 0 && pose === 'walking';                                   // walking left: he faces left
    if (turned) p.raw(`<g transform="translate(${2 * h.x * p.u} 0) scale(-1 1)">`);
    drawHeroPose(p, hx, hy, arch, pose, { s });
    if (h.umbrella) { const c = '#3b5dc9'; p.r(hx - 2, hy - 3, 16, 1, c).r(hx - 1, hy - 4, 14, 1, c).r(hx + 1, hy - 5, 10, 1, c).r(hx + 3, hy - 6, 6, 1, c).r(hx + 5.5, hy - 2, 1, 5, '#4e2f1c'); p.r(hx - 2, hy - 3, 2, 1, '#b13e53').r(hx + 12, hy - 3, 2, 1, '#b13e53'); }
    if (turned) p.raw('</g>');
    if (pose !== 'fighting') p.raw('<g class="bob">').sprite(makeSprite(['YYYYYYY', '.YYYYY.', '..YYY..', '...Y...'], { Y: '#fff0a0' }), hx + 2.5, hy - (h.umbrella ? 12 : 8), { s: 0.75 }).raw('</g>');
  }));
}

/** A quest is a place: a badge with the quest's object floats over it, an arrow points down at it. The next building plot is staked out. */
export function drawQuests(K) {
  const { p } = K;
  K.glow('#ffcd75');
  for (const q of K.W.quests || []) {
    if (!markerFits(q, K.cam.rect)) continue;
    K.obj(`q:${q.id}`, { x: q.x, y: q.y, st: `${q.primary ? 'p' : 's'}:${q.object}`, box: [q.x - 12, q.y - 20, 24, 34] }, () => {
      if (q.plot) {                                                               // a staked plot where the next project will stand
        const { x, y } = q.plot;
        for (const [sx, sy] of [[x - 7, y - 8], [x + 6, y - 8], [x - 7, y - 1], [x + 6, y - 1]]) p.r(sx, sy, 1, 3, '#7a4a2b').r(sx - 0.5, sy - 0.5, 2, 1, q.color);
        for (let k = 0; k < 12; k += 2) p.r(x - 6 + k, y - 8, 1, 0.5, '#e8d5a8', 0.8).r(x - 6 + k, y - 0.5, 1, 0.5, '#e8d5a8', 0.8);
      }
      const bx = q.x - 3.5, by = q.y - 13;
      if (q.primary) p.raw(`<circle cx="${q.x * 4}" cy="${(by + 3.5) * 4}" r="${11 * 4}" fill="url(#g-ffcd75)" opacity=".55" class="pu"/>`);
      p.raw(`<g class="bob" style="animation-duration:${q.primary ? 1.1 : 1.6}s">`);
      p.r(bx - 0.5, by - 0.5, 8, 8, '#0e1024').r(bx, by, 7, 7, '#1b1f45').r(bx, by, 7, 0.75, q.color).r(bx, by + 6.25, 7, 0.75, q.color).r(bx, by, 0.75, 7, q.color).r(bx + 6.25, by, 0.75, 7, q.color);
      const ic = ICON[q.icon] || ICON.flag;
      p.sprite(ic, bx + 3.5 - (ic.w * 0.5) / 2, by + 3.5 - (ic.h * 0.5) / 2, { s: 0.5 });
      p.sprite(ICON.arrow, q.x - 2.6, q.y - 5.5, { s: 0.75, pal: { Y: q.color } });
      p.raw('</g>');
    });
  }
}

/** Raid on the map: goblins enter, guards react, battle, then the result. */
export function drawRaid(K) {
  const { p, S, scene } = K;
  const raid = S.raid || {};
  const ph = scene.stages.raid;
  if (!raid.active && ph !== 'won' && ph !== 'lost') return;
  const gid = [K.sym('g1', GOBLIN, 0.75), K.sym('g2', GOBLIN2, 0.75)];
  const nG = Math.min(raid.goblins || 5, 12) || 5;
  const gx = ANCHORS.gate.x;
  K.obj('raid', { x: gx, y: 200, st: `${ph}:${nG}`, box: [30, 160, 116, 52] }, () => {
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
  });
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
