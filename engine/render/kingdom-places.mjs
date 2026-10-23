// Places of the kingdom (TRUE V2): castle, vault, trophy hall, plaza, CI fortress, mine, repository districts, ruins, farm, gate, camp, forest.
// All positions come from the shared map (world/layout.mjs) and all state from the world model (K.W). Persistent things go through K.obj,
// so every camera that shows them draws them identically and records them in its manifest.
import { C, mix, lighten, darken } from './palette.mjs';
import { NPC, ICON, HERO_STYLE, TREE_OAK, TREE_PINE } from './sprites.mjs';
import { local, ARCHETYPES, stateFx, stone, crenel } from './buildings.mjs';
import { drawRepo, failFx, repairFx } from './growth.mjs';
import { ANCHORS, FOOT } from '../world/layout.mjs';
import { drawHall } from './kingdom-hall.mjs';
import { drawFarm } from './kingdom-farm.mjs';
import { drawCamp } from './kingdom-camp.mjs';

const worst = (m) => Object.values(m || {}).sort((a, b) => ['warning', 'alarm', 'smoke', 'fire'].indexOf(b) - ['warning', 'alarm', 'smoke', 'fire'].indexOf(a))[0] || null;
import { STALL_SPOTS as STALL_XY } from '../world/population.mjs';
const STALL_COLORS = [C.red, C.blue, C.green, C.orange];
export const STALL_SPOTS = STALL_XY.map(([x, y], i) => [x, y, STALL_COLORS[i]]);
const LAMP_SPOTS = [[84, 99], [92, 99], [84, 121], [92, 121], [84, 135], [92, 135], [84, 151], [92, 151]];
const FLOWER_SPOTS = [[83, 104], [93, 104], [83, 126], [93, 126], [83, 140], [93, 140], [83, 156], [93, 156], [77, 112], [99, 112], [60, 106], [116, 106]];
const keep = (K, name, m = 2) => { const [x, y, w, h] = FOOT[name]; K.solid(x - m, y - m, w + 2 * m, h + 2 * m); };

export function drawPlaces(K) {
  const { p, S, W, scene, place, bctx, winter, lit, SE, seasonKey, rnd, tier } = K;
  const layout = W.layout, A = ANCHORS, ts = tier.style;
  const rec = new Map(W.repos.map((r) => [r.name, r]));

  // ---------------------------------------------------------------- castle (the main repository, grows with the level; banners grow with the power)
  const cr = layout.castle, [cx, cy] = [A.castle.x, A.castle.y];
  place(cy, () => K.obj('castle', { x: cx, y: cy, foot: true, st: `${S.castle.tier}:${tier.index}:${scene.fx.includes('banner') ? 'b' : ''}`, box: [56, 24, 64, 68] }, () => {
    K.shadow(cx, cy, 54, 2);
    const d = local(p, cx, cy, 1, bctx);
    const oo = { ctx: bctx, tier: S.castle.tier, flag: HERO_STYLE[S.hero?.class?.archetype]?.pal.b || C.red, lit: lit || scene.fx.includes('castleLights'), snow: winter };
    const b = ARCHETYPES.castle(d, oo);
    if (scene.fx.includes('banner')) {                                    // release: banners hang from the towers
      for (const [bx, col] of [[-23, C.red], [17, C.yellow]]) { p.raw('<g class="fl">'); d.r(bx, -24, 6, 12, col); d.r(bx, -24, 6, 1, lighten(col, 0.4)); d.r(bx + 2, -20, 2, 2, C.white); d.r(bx, -12, 2, 2, col); d.r(bx + 4, -12, 2, 2, col); p.raw('</g>'); }
    }
    const pennants = [[-23, -24, C.red], [17, -24, C.blue], [-9, -31, C.yellow], [3, -31, C.yellow], [-30, -20, C.red], [24, -20, C.blue]];
    pennants.slice(0, ts.banners).forEach(([bx, by, col], i) => {        // a richer kingdom flies more pennants
      if (scene.fx.includes('banner') && i < 2) return;
      p.raw(`<g class="fl" style="animation-delay:${-(i % 3) * 0.3}s">`); d.r(bx, by, 0.5, 8, '#4e2f1c'); d.r(bx + 0.5, by, 4, 3, col); d.r(bx + 0.5, by, 4, 0.5, lighten(col, 0.4)); p.raw('</g>');
    });
    if (ts.crown) { p.raw('<g class="pu" style="animation-duration:4s">'); d.sprite(ICON.crown, -4, (b?.top ?? -40) - 9, { s: 1 }); p.raw('</g>'); }
    if (ts.glow && oo.lit) K.spots.push({ x: cx, y: cy - 24, r: 46, color: '#ffcd75', op: 0.2 * ts.glow });      // a rich kingdom's castle glows after dark
    if (cr && ['failing', 'building', 'dusty'].includes(cr.state)) stateFx(d, { state: cr.state, recovered: cr.recovered, ctx: bctx }, b);
    else if (cr?.recovered) stateFx(d, { state: 'active', recovered: true, ctx: bctx }, b);
  }));
  keep(K, 'castle');

  // ---------------------------------------------------------------- vault (stars become gold)
  place(A.vault.y, () => K.obj('vault', { x: A.vault.x, y: A.vault.y, foot: true, st: `${S.treasure.tier}:${S.treasure.coins}`, box: [A.vault.x - 18, A.vault.y - 26, 36, 32] }, () => {
    K.shadow(A.vault.x, A.vault.y, 20);
    const d = local(p, A.vault.x, A.vault.y, 0.75, bctx);
    stone(d, -9, -12, 18, 12, [C.stone, C.stoneD, C.stoneL]);
    d.r(-11, -15, 22, 4, '#e0a030').r(-11, -15, 22, 1, '#ffe08a').r(-7, -18, 14, 3, '#e0a030').r(-7, -18, 14, 1, '#ffe08a');
    if (winter) d.r(-7, -18, 14, 1, '#f4f8fc');
    d.r(-3, -9, 6, 9, '#e0a030').r(-3, -9, 6, 1, '#ffe08a').r(-1, -5, 2, 2, '#7a4a2b');
    const tr = S.treasure, rows = Math.min(7, 1 + Math.floor(Math.sqrt(tr.coins * 1.2)));
    if (tr.coins > 0) {
      const base = Math.min(24, 4 + Math.round(tr.coins / 3));
      for (let r = 0; r < rows; r++) { const w = Math.max(2, base - r * 3); d.r(-w / 2 + 2, 2 - r * 2 + 2, w, 2, r % 2 ? '#ffcd75' : '#e0a030'); d.r(-w / 2 + 2, 2 - r * 2 + 2, w, 1, '#ffe08a'); }
      d.anim('tw', '', () => d.r(-2, -rows * 2 + 3, 1, 1, '#ffffff')); d.anim('tw', 'animation-delay:-1.2s', () => d.r(4, 1, 1, 1, '#ffffff'));
    }
    if (tr.tier === 'mountain') d.sprite(ICON.crown, -4, -rows * 2 - 6, { s: 1 });
    if (['huge', 'mountain', 'large'].includes(tr.tier)) { d.r(-18, -3, 6, 4, '#7a4a2b').r(-18, -3, 6, 1, '#a86b3c').r(-16, -2, 2, 2, '#ffcd75'); }
  }));
  keep(K, 'vault');

  // ---------------------------------------------------------------- the Trophy Hall (achievements)
  drawHall(K);

  // ---------------------------------------------------------------- plaza: well (or fountain), lamp posts, stalls, bunting
  const [wx, wy] = [A.well.x, A.well.y];
  place(wy, () => K.obj('plaza', { x: wx, y: wy, foot: true, st: `${ts.plaza}`, box: [wx - 12, wy - 16, 24, 20] }, () => {
    if (ts.plaza === 'well') {
      p.ellipse(wx, wy, 4, 2, '#5e687c').ellipse(wx, wy - 1, 3, 1, '#8a94a6').ellipse(wx, wy - 1, 2, 1, SE.water);
      p.r(wx - 4, wy - 8, 1, 8, '#7a4a2b').r(wx + 3, wy - 8, 1, 8, '#7a4a2b').r(wx - 5, wy - 9, 10, 2, '#b13e53').r(wx - 4, wy - 10, 8, 1, '#b13e53');
    } else {                                                             // a prosperous kingdom builds a fountain, a legendary one adds a golden statue
      p.ellipse(wx, wy, 8, 3, '#5e687c').ellipse(wx, wy - 1, 7, 2, '#8a94a6').ellipse(wx, wy - 1, 6, 2, SE.water).ellipse(wx, wy - 1, 3, 1, lighten(SE.water, 0.4), 0.7);
      p.r(wx - 1, wy - 7, 2, 6, '#b8c2d0').r(wx - 2, wy - 8, 4, 1, '#cfd6e0');
      for (const [dx, dy] of [[-3, -5], [3, -5], [-2, -7], [2, -7]]) p.raw(`<g class="${dx > 0 ? 'f1' : 'f2'}">`).r(wx + dx, wy + dy, 0.5, 3, '#bfefff').raw('</g>');
      if (ts.plaza === 'statue') { p.r(wx - 1, wy - 14, 2, 6, '#e0a030').r(wx - 1.25, wy - 16, 2.5, 2, '#ffe08a').r(wx - 2.5, wy - 12, 5, 1, '#e0a030').r(wx - 1, wy - 14, 0.5, 6, '#ffe08a'); }
    }
  }));
  for (const lx of [70, 106]) place(108, () => {
    p.r(lx, 103, 1, 6, '#4e2f1c');
    if (scene.light.torches) { p.raw('<g class="fl">').r(lx - 1, 101, 3, 2, C.orange).r(lx, 100, 1, 1, C.yellow).raw('</g>'); K.lights.push({ x: lx - 1, y: 101, w: 3, h: 2, glow: 1 }); }
    else p.r(lx - 1, 101, 3, 2, '#566c86');
  });
  LAMP_SPOTS.slice(0, ts.lamps).forEach(([lx, ly]) => place(ly + 1, () => {                        // lamp posts line the main road as the kingdom grows
    p.r(lx, ly, 0.75, 6, '#4e2f1c').r(lx - 0.75, ly - 2, 2.25, 2, scene.light.torches ? C.orange : '#566c86');
    if (scene.light.torches) { p.r(lx - 0.25, ly - 3, 1.25, 1, C.yellow); K.lights.push({ x: lx - 0.75, y: ly - 2, w: 2.25, h: 2, glow: ts.lamps > 4 ? 0 : 1 }); }
  }));
  FLOWER_SPOTS.slice(0, ts.flowers).forEach(([fx, fy], i) => { const cols = [['#ff9ecb', '#f4f4f4'], ['#ffcd75', '#ef7d57'], ['#b48cf0', '#f4f4f4']][i % 3]; p.r(fx, fy, 1, 1, cols[0]).r(fx + 1.5, fy + 0.5, 1, 1, cols[1]).r(fx + 0.5, fy + 1, 0.5, 1, '#2e9e57'); });
  K.stalls = Math.min(STALL_SPOTS.length, ts.stalls);
  for (let i = 0; i < K.stalls; i++) {
    const [sx, sy, col] = STALL_SPOTS[i];
    place(sy, () => { K.shadow(sx, sy + 1, 11); p.r(sx - 4, sy, 8, 1, '#7a4a2b').r(sx - 5, sy - 4, 10, 3, col).r(sx - 5, sy - 4, 10, 1, lighten(col, 0.4)); for (let k = 0; k < 5; k++) p.r(sx - 5 + k * 2, sy - 1, 1, 1, '#f4f4f4'); p.r(sx - 3, sy, 6, 1, '#a86b3c'); p.r(sx - 2, sy - 1, 1, 1, C.yellow).r(sx + 1, sy - 1, 1, 1, C.red); });
  }
  if (scene.light.accent === 'celebrate' || scene.light.accent === 'gold' && scene.fx.includes('confetti')) {   // string lights across the plaza
    const cols = [C.red, C.yellow, C.cyan, C.lime, '#ff9ecb'];
    for (let x = 70; x <= 106; x += 3) { const y = 103 + Math.round(2 * Math.sin(((x - 70) / 36) * Math.PI)); p.raw(`<g class="${(x / 3) % 2 ? 'f1' : 'f2'}">`).r(x, y, 2, 2, cols[(x / 3) % 5 | 0]).raw('</g>'); }
  }

  if (scene.fx.includes('confettiGround')) {                                                       // the party is over: paper on the ground, the castle keeps its glow
    const cols = [C.red, C.yellow, C.cyan, C.lime, '#ff9ecb'];
    place(113, () => { for (let i = 0; i < 46; i++) { const x = 66 + ((i * 37) % 44), y = 97 + ((i * 53) % 18); p.r(x, y, 1, 0.75, cols[i % 5], 0.8); } });
  }

  // ---------------------------------------------------------------- the CI fortress (workflow health)
  const failing = S.totals.failingRepos.length > 0;
  const failStage = worst(scene.stages.fail), repairSt = worst(scene.stages.repair);
  place(A.ci.y, () => K.obj('ci', { x: A.ci.x, y: A.ci.y, foot: true, st: `${failing ? 'red' : 'green'}:${failStage || repairSt || ''}`, box: [A.ci.x - 26, A.ci.y - 50, 52, 56] }, () => {
    K.shadow(A.ci.x, A.ci.y, 44, 2);
    const d = local(p, A.ci.x, A.ci.y, 1, bctx);
    for (const sx of [-20, 8]) { stone(d, sx, -12, 12, 12); crenel(d, sx, -12, 12); d.r(sx + 5, -8, 2, 4, '#0e1024'); }
    d.torch(-9, -6, scene.light.torches); d.torch(9, -6, scene.light.torches);
    const beacon = failing ? C.red : C.green;
    const b = ARCHETYPES.tower(d, { ctx: bctx, h: 42, dish: true, beacon, lit: true, snow: winter });
    if (failing) failFx(d, { x0: -20, x1: 20, top: b.top }, failStage || 'fire');
    else if (repairSt || S.repos.some((r) => r.recovered)) repairFx(d, { x0: -20, x1: 20, top: b.top }, repairSt || 'fade');
    else {                                                                 // all green: workers on the wall, a pulsing beacon
      d.anim('bob', 'animation-duration:1.2s', () => d.sprite(NPC.builder, -16, -21));
      d.anim('bob', 'animation-duration:1.5s;animation-delay:-.4s', () => d.sprite(NPC.guard, 10, -21));
      d.anim('f1', '', () => { d.r(-10, -23, 1, 1, C.yellow); d.r(-9, -24, 1, 1, C.white); });
    }
  }));
  keep(K, 'ci', 4);

  // ---------------------------------------------------------------- the mine (data) in the north-west mountain
  const mineSlot = layout.mine, [mx, my] = [A.mine.x, A.mine.y];
  place(my, () => {
    const r = mineSlot?.repo, lvl = r ? r.evolution.level : 4;
    const stage = r ? { fail: scene.stages.fail[r.name], repair: scene.stages.repair[r.name], build: scene.stages.build[r.name] } : {};
    const common = { lit: scene.light.windows, ctx: bctx, snow: winter };
    K.obj('mine', { x: mx, y: my, foot: true, st: r ? `${rec.get(r.name)?.lifecycle}:${lvl}` : 'permanent', box: [mx - 26, my - 32, 70, 46] }, () => {
      if (!r || lvl >= 4) drawRepo(p, 'mine', mx, my, { ...common, name: r?.name || 'mine', level: Math.max(4, lvl), state: r ? r.state : 'active', recovered: r?.recovered, stage });
      else {                                                   // the old mine stays; the new project is a building site beside it
        drawRepo(p, 'mine', mx - 8, my, { ...common, name: 'mine', level: 4, state: 'active' });
        drawRepo(p, 'mine', mx + 20, my + 8, { ...common, name: r.name, level: lvl, state: r.state, recovered: r.recovered, stage });
      }
    });
  });
  keep(K, 'mine', 0);

  // ---------------------------------------------------------------- repositories = buildings, in their districts
  for (const q of layout.placed) {
    if (q.list === 'mine') continue;                                   // the mine repository is the mine itself (drawn above), not a second building
    const r = q.repo, w = rec.get(r.name);
    place(q.y, () => K.obj(w.id, { x: q.x, y: q.y, foot: true, st: `${w.lifecycle}:${w.level}:${w.story.fail || ''}${w.story.repair || ''}${w.story.build || ''}`, box: [q.x - 24, q.y - 50, 48, 56] }, () => {
      K.shadow(q.x, q.y, 18, 2);
      drawRepo(p, r.archetype === 'castle' ? 'house' : r.archetype, q.x, q.y, {
        name: r.name, level: r.evolution.level, state: r.state, recovered: r.recovered, snow: winter, ctx: bctx, life: w.lifecycle,
        lit: scene.light.windows && ['active', 'building', 'sleepy'].includes(r.state) && r.state !== 'sleepy',
        stage: { fail: scene.stages.fail[r.name], repair: scene.stages.repair[r.name], build: scene.stages.build[r.name] },
      });
    }));
    K.solid(q.x - 11, q.y - 30, 30, 34);
  }
  for (const q of layout.ruins) { const w = rec.get(q.repo.name); place(q.y, () => K.obj(w.id, { x: q.x, y: q.y, foot: true, st: 'abandoned', box: [q.x - 14, q.y - 24, 28, 28] }, () => drawRepo(p, 'house', q.x, q.y, { name: q.repo.name, level: 3, state: 'abandoned', ctx: bctx, snow: winter }))); }
  keep(K, 'ruins', 0);

  // ---------------------------------------------------------------- the farm (contributions), the gate (issues), the camp (visitors)
  drawFarm(K);

  place(195, () => K.obj('gate', { x: A.gate.x, y: A.gate.y, foot: true, st: `${scene.light.gate ? 'danger' : 'calm'}:${K.night ? 'n' : 'd'}`, box: [30, 176, 116, 36] }, () => {
    const [x, y] = [A.gate.x, A.gate.y], night = K.night;
    K.shadow(x, y, 62, 2);
    const d = local(p, x, y, 1, bctx);
    for (let i = -3; i <= 3; i++) if (i !== 0) p.r(x + i * 8 - 1, y - 6, 1, 7, '#7a4a2b');
    p.r(x - 56, y - 4, 112, 1, '#a86b3c').r(x - 56, y - 1, 112, 1, '#7a4a2b');
    for (let i = -7; i <= 7; i++) if (Math.abs(i * 8) > 28) p.r(x + i * 8 - 1, y - 7, 2, 8, '#a86b3c');
    stone(d, -26, -12, 52, 12);
    for (const sx of [-30, 22]) { stone(d, sx, -20, 8, 20); crenel(d, sx, -20, 8); d.r(sx + 3, -15, 2, 4, '#0e1024'); d.torch(sx + 4, -6, true); }
    crenel(d, -26, -12, 52);
    d.r(-6, -14, 12, 14, '#0e0510').r(-5, -15, 10, 1, '#0e0510');
    if (!night) { for (let gx = -5; gx <= 4; gx += 2) d.r(gx, -15, 1, 3, '#566c86'); d.r(-6, -2, 12, 2, '#7a4a2b'); d.r(-6, -2, 12, 1, '#a86b3c'); }
    else { d.r(-6, -14, 6, 14, '#7a4a2b').r(0, -14, 6, 14, '#6a3f25').r(-1, -14, 2, 14, '#4e2f1c'); d.r(-6, -10, 12, 1, '#5e687c').r(-6, -4, 12, 1, '#5e687c'); }
    d.sprite(ICON.skull, -2, -18.5, { s: 0.5 });                       // a small warning sign over the arch, clear of the farm gate
    if (scene.light.gate) K.danger.push({ x: x, y: y - 8, r: 22, strong: true });
  }));
  keep(K, 'gate', 0);

  drawCamp(K);

  // ---------------------------------------------------------------- forest: one tree for every language you write
  const langs = S.languages.length ? S.languages : [{ name: 'CODE', color: null }];
  const ids = new Map();
  const tree = (x, y, kind, color) => {
    const key = `t-${kind}-${color || 'd'}-${seasonKey}`;
    if (!ids.has(key)) {
      const base = color ? mix(color, SE.leaf, seasonKey === 'summer' ? 0.1 : 0.35) : SE.leaf;
      const pal = winter ? { L: mix(base, '#1b5560', 0.4), l: '#eef6fb', D: '#1b4a55', t: SE.trunk } : { L: base, l: lighten(base, 0.3), D: darken(base, 0.25), t: SE.trunk };
      if (seasonKey === 'spring' && !color) pal.l = '#ffc8e0';
      ids.set(key, K.sym(key, kind === 'pine' ? TREE_PINE : TREE_OAK, 1, pal));
    }
    const spr = kind === 'pine' ? TREE_PINE : TREE_OAK;
    place(y, () => { K.shadow(x + 0.5, y, 8); p.use(ids.get(key), x - Math.floor(spr.w / 2), y - spr.h); });
  };
  const fz = { x0: 96, x1: 172, y0: 168, y1: 206 };
  let li = 0;
  for (let i = 0, put = 0; i < 140 && put < 20; i++) {
    const x = rnd.int(fz.x0, fz.x1), y = rnd.int(fz.y0, fz.y1);
    if (!K.free(x, y, 3) || Math.hypot(x - A.camp.x, y - A.camp.y) < 24) continue;
    const lang = li < langs.length ? langs[li++] : null;
    tree(x, y, put % 3 === 0 ? 'pine' : 'oak', lang && lang.color); put++;
  }
  while (li < langs.length) { const x = rnd.int(fz.x0, fz.x1), y = rnd.int(fz.y0, fz.y1); if (K.free(x, y, 3)) tree(x, y, 'oak', langs[li++].color); }
  for (const [x, y] of [[168, 60], [172, 100], [2, 134], [100, 176], [108, 166], [3, 196], [62, 58]]) tree(x, y, rnd() < 0.5 ? 'pine' : 'oak', null);
}
