// Repository buildings that grow (V2). One repository = one building. Its level comes from engine/evolution.mjs.
//   level 1  FOUNDATION   stone footing, stakes and rope, a plank pile
//   level 2  FRAME        timber frame, scaffold, crates
//   level 3  BUILDING     a house or workshop with a small role pennant
//   level 4  SPECIALIZED  the real tower / library / lab / mine / shop / workshop
//   level 5  LANDMARK     the same, bigger, with a golden banner, a stone plaza and its own light
// The story of the moment is drawn on top: builders arriving, a warning turning into fire, a firefighter, a repair.
import { C } from './palette.mjs';
import { ICON, NPC, NPC_ROLE } from './sprites.mjs';
import {
  local, ARCHETYPES, stateFx, smoke, fire, builder, scaffold, crates, sparkle, sleeper, warnFlag,
} from './buildings.mjs';

export const LEVEL_SCALE = { 1: 0.75, 2: 0.75, 3: 0.75, 4: 0.75, 5: 1 };
const PENNANT = { tower: '#73eff7', library: '#38b764', lab: '#a7f070', mine: '#94b0c2', guild: '#ef7d57', workshop: '#ffcd75', house: '#f4f4f4', castle: '#b13e53' };

function foundation(d) {
  d.r(-9, -2, 18, 2, '#8a94a6'); d.r(-9, -3, 18, 1, '#b8c2d0');
  for (let x = -8; x < 9; x += 4) d.r(x, -2, 1, 2, '#5e687c');
  d.r(-10, -6, 1, 6, '#7a4a2b'); d.r(9, -6, 1, 6, '#7a4a2b'); d.r(-10, -6, 20, 1, '#d3a66e');       // stakes and rope
  d.r(-15, -3, 4, 1, '#d3a66e'); d.r(-15, -2, 4, 1, '#a86b3c'); d.r(-14, -5, 4, 1, '#d3a66e'); d.r(-14, -4, 4, 1, '#a86b3c');  // planks
  d.r(11, -4, 4, 4, '#d9a066'); d.r(11, -4, 4, 1, '#f2c27a');                                      // sack of lime
  return { x0: -15, x1: 15, top: -9 };
}
function frame(d) {
  d.r(-9, -2, 18, 2, '#8a94a6'); d.r(-9, -3, 18, 1, '#b8c2d0');
  for (const x of [-8, -3, 3, 8]) d.r(x, -15, 1, 13, '#a86b3c');
  d.r(-9, -15, 18, 1, '#7a4a2b'); d.r(-9, -9, 18, 1, '#7a4a2b');
  d.r(-8, -8, 5, 6, '#d3a66e'); d.r(-8, -8, 5, 1, '#f2c27a'); d.r(-3, -8, 1, 6, '#a86b3c');          // wall panels
  for (let i = 0; i < 7; i++) { d.r(-9 + i, -16 - i, 1, 1, '#7a4a2b'); d.r(8 - i, -16 - i, 1, 1, '#7a4a2b'); }   // rafters
  d.r(0, -23, 1, 7, '#a86b3c');
  scaffold(d, 9, 15, -18); crates(d, -17, 0);
  return { x0: -17, x1: 16, top: -23 };
}
function level3(d, o, kind) {
  const b = (kind === 'workshop' ? ARCHETYPES.workshop : ARCHETYPES.house)(d, { ...o, smoke: o.smoke ?? true });
  const col = PENNANT[kind] || '#f4f4f4', x = kind === 'workshop' ? -10 : -8;
  d.r(x, b.top - 6, 1, 7, '#4e2f1c'); d.anim('fl', '', () => { d.r(x + 1, b.top - 6, 5, 3, col); d.r(x + 1, b.top - 6, 5, 1, '#ffffff'); });
  return { ...b, top: b.top - 6 };
}
function landmark(d, b, o) {
  d.r(b.x0 - 3, 0, b.x1 - b.x0 + 6, 1, '#d6dde6'); d.r(b.x0 - 2, 1, b.x1 - b.x0 + 4, 1, '#8a94a6');       // stone plaza
  d.r(b.x1 + 4, -22, 1, 22, '#4e2f1c');
  d.anim('fl', '', () => { d.r(b.x1 + 5, -22, 7, 5, C.yellow); d.r(b.x1 + 5, -22, 7, 1, C.goldL); d.r(b.x1 + 8, -20, 2, 2, C.goldD); });
  sparkle(d, b.x0 + 1, b.top + 8, 0); sparkle(d, b.x1 - 1, b.top + 3, -1.1);
  o.ctx.lights?.push({ x: d.ox + (b.x1 + 4) * d.s, y: d.oy - 24 * d.s, w: 5 * d.s, h: 3 * d.s, glow: 1, color: C.yellow });
}

// ---------------------------------------------------------------- stories drawn on top
const guardRun = (d, x) => d.anim('bob', 'animation-duration:.5s', () => d.sprite(NPC.guard, x, -9));
export function failFx(d, b, stage) {
  const lv = ['warning', 'alarm', 'smoke', 'fire'].indexOf(stage);
  warnFlag(d, b.x1 + 2, 0);
  d.anim('fl', '', () => d.sprite(ICON.exclaim, -4, b.top - 9, { s: 0.75 }));
  if (lv >= 1) {                                                                       // alarm: a bell and a pulsing red lamp
    d.sprite(ICON.bell, b.x0 - 7, -13, { s: 0.5 });
    d.anim('pu', 'animation-duration:1s', () => { d.r(b.x0 + 2, b.top + 4, 3, 3, C.red); d.r(b.x0 + 3, b.top + 3, 1, 1, '#ff8a5a'); });
    guardRun(d, b.x0 - 6);
  }
  if (lv >= 2) { smoke(d, -2, b.top - 6, true); smoke(d, 3, b.top - 3, true); }          // smoke
  if (lv >= 3) { fire(d, 0, b.top + 4); fire(d, b.x1 - 6, b.top + 12); d.r(-5, b.top + 9, 10, 3, C.ink, 0.45); }   // fire
  d.ctx.danger?.push({ x: d.ox, y: d.oy + (b.top / 2) * d.s, r: (lv >= 3 ? 16 : 11) * d.s, strong: lv >= 2 });
}
export function repairFx(d, b, stage) {
  d.r(b.x0 + 3, b.top + 7, 5, 3, C.ink, 0.28); d.r(b.x1 - 8, b.top + 12, 4, 2, C.ink, 0.22);    // soot that is being cleaned
  if (stage === 'firefighter') {
    d.sprite(NPC_ROLE.firefighter, b.x1 + 2, -9);
    d.anim('f1', '', () => { d.r(b.x1 - 1, -6, 2, 1, C.cyan); d.r(b.x1 - 4, -7, 2, 1, C.cyan); d.r(b.x1 - 7, -8, 1, 1, C.cyan); });
    d.anim('f2', '', () => { d.r(b.x1 - 2, -6, 2, 1, C.cyan); d.r(b.x1 - 5, -8, 2, 1, C.cyan); d.r(b.x1 - 8, -8, 1, 1, '#ffffff'); });
    smoke(d, 0, b.top - 3, false);
  } else if (stage === 'repair') {
    scaffold(d, b.x1 - 6, b.x1 + 1, b.top + 6);
    builder(d, b.x1 + 3, 0, true);
    sparkle(d, b.x0 + 3, b.top + 6, 0);
  } else { sparkle(d, b.x0 + 2, b.top + 5, 0); sparkle(d, b.x1 - 2, b.top + 9, -1); sparkle(d, 0, b.top - 1, -2); }
}
function sleepyFx(d, b) { sleeper(d, b.x1 + 2, 0); }

/** An archived project: broken walls, charred beams, rubble, moss. Nobody lives here. */
function ruin(d, o) {
  const st = '#7c8696', hi = '#a4adbb', lo = '#5a6272', moss = '#4f8a4a';
  d.r(-10, -2, 20, 2, '#3a3440');                                                  // old floor
  d.r(-10, -11, 6, 11, st); d.r(-10, -11, 6, 1, hi); d.r(-5, -11, 1, 11, lo);      // tall wall
  d.r(-10, -13, 2, 2, st); d.r(-7, -12, 2, 1, st); d.r(-9, -7, 1, 1, lo); d.r(-8, -4, 2, 1, lo);
  d.r(5, -6, 5, 6, st); d.r(5, -6, 5, 1, hi); d.r(9, -6, 1, 6, lo); d.r(6, -8, 2, 2, st);  // low wall
  d.r(-4, -4, 9, 4, '#241f2a'); d.r(-3, -5, 7, 1, '#241f2a');                       // the doorway, dark inside
  for (let i = 0; i < 6; i++) d.r(-9 + i * 2, -13 + i, 2, 1, '#3a2418');           // fallen roof beam
  d.r(1, -9, 1, 4, '#3a2418'); d.r(2, -10, 1, 3, '#3a2418');
  d.r(-4, -1, 3, 1, st); d.r(1, -2, 4, 2, lo); d.r(-1, -3, 2, 2, st); d.r(6, -1, 3, 1, hi);   // rubble
  d.r(-10, -5, 2, 2, moss); d.r(7, -4, 2, 1, moss); d.r(-3, -1, 2, 1, moss); d.r(8, -7, 1, 2, moss);
  d.r(12, -9, 1, 9, '#4e2f1c'); d.anim('fl', 'animation-duration:5s', () => d.r(13, -9, 4, 3, '#8c2f43'));   // a torn flag
  if (o.snow) { d.r(-10, -12, 6, 1, '#f4f8fc'); d.r(5, -7, 5, 1, '#f4f8fc'); }
  return { x0: -11, x1: 17, top: -13 };
}

/**
 * Draw one repository. (ox, oy) = ground centre in p's grid. Returns { b, s } (b = bounds in art pixels).
 *   o: { name, level, state, recovered, lit, snow, ctx, stage: { fail, repair, build } }
 */
export function drawRepo(p, kind, ox, oy, o = {}) {
  const level = Math.max(1, Math.min(5, o.level || 4));
  const s = o.scale || LEVEL_SCALE[level];            // o.scale lets a card draw the same building bigger
  const ctx = o.ctx || {};
  const d = local(p, ox, oy, s, ctx);
  const st = o.state || 'active', stage = o.stage || {};
  const oo = { ...o, ctx, lit: o.lit ?? false, state: st, smoke: o.smoke ?? (st === 'active' || st === 'building') };
  let b;
  if (st === 'abandoned') { b = ruin(d, oo); return { b, s }; }
  if (level === 1) b = foundation(d, oo);
  else if (level === 2) b = frame(d, oo);
  else if (level === 3) b = level3(d, oo, kind);
  else if (level === 4) b = (ARCHETYPES[kind] || ARCHETYPES.house)(d, { ...oo, h: 28, dish: false });
  else { b = (ARCHETYPES[kind] || ARCHETYPES.house)(d, { ...oo, h: 30, dish: true, tier: 4 }); landmark(d, b, oo); }

  if (st === 'failing') failFx(d, b, stage.fail || 'fire');
  else {
    if (st === 'dusty') stateFx(d, oo, b);
    else if (st === 'sleepy') sleepyFx(d, b);
    else if (st === 'building') {
      // active work = a worker with tools. Scaffolds belong to young builds (the construction story), not to every busy repo.
      if (level >= 3) { if (stage.build) scaffold(d, b.x1 - 6, b.x1 + 1, b.top + 4); crates(d, b.x0 - 8, 0); }
      builder(d, b.x1 + 3, 0, true);
      if (stage.build === 'builders' || level <= 2) builder(d, b.x0 - 3, 0, true);
    } else builder(d, b.x1 + 3, 0, false);
    if (o.recovered || stage.repair) repairFx(d, b, stage.repair || 'fade');
  }
  return { b, s };
}
