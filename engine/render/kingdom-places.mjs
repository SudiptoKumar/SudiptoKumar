// Places of the kingdom (V2): castle, vault, shrine, plaza, CI fortress, mine, districts, farm, gate, camp, forest.
import { C, mix, lighten, darken } from './palette.mjs';
import { NPC, CROP, WHEAT, ICON, HERO_STYLE, TREE_OAK, TREE_PINE, GOBLIN, GOBLIN2 } from './sprites.mjs';
import { local, ARCHETYPES, stateFx, stone, crenel } from './buildings.mjs';
import { drawRepo, failFx, repairFx } from './growth.mjs';
import { npcStand } from './actors.mjs';
import { GW, U, L, SLOTS } from './kingdom-layout.mjs';
import { rot90 } from './actors.mjs';

const worst = (m) => Object.values(m || {}).sort((a, b) => ['warning', 'alarm', 'smoke', 'fire'].indexOf(b) - ['warning', 'alarm', 'smoke', 'fire'].indexOf(a))[0] || null;

export function drawPlaces(K, layout) {
  const { p, S, scene, place, bctx, winter, lit, SE, seasonKey, rnd } = K;
  const cfg = K.cfg || {};
  const celebrate = scene.modes.includes('CELEBRATION') || scene.modes.includes('HARVEST');

  // ---------------------------------------------------------------- castle (the main repository, grows with the level)
  const [cx, cy] = L.castle;
  const cr = layout.castle;
  place(cy, () => {
    const d = local(p, cx, cy, 1, bctx);
    const oo = { ctx: bctx, tier: S.castle.tier, flag: HERO_STYLE[S.hero.class.archetype]?.pal.b || C.red, lit: lit || scene.fx.includes('castleLights'), snow: winter };
    const b = ARCHETYPES.castle(d, oo);
    if (scene.fx.includes('banner')) {                                    // release: banners hang from the towers
      for (const [bx, col] of [[-23, C.red], [17, C.yellow]]) { p.raw('<g class="fl">'); d.r(bx, -24, 6, 12, col); d.r(bx, -24, 6, 1, lighten(col, 0.4)); d.r(bx + 2, -20, 2, 2, C.white); d.r(bx, -12, 2, 2, col); d.r(bx + 4, -12, 2, 2, col); p.raw('</g>'); }
    }
    if (cr && ['failing', 'building', 'dusty'].includes(cr.state)) stateFx(d, { state: cr.state, recovered: cr.recovered, ctx: bctx }, b);
    else if (cr?.recovered) stateFx(d, { state: 'active', recovered: true, ctx: bctx }, b);
  });
  K.solid(60, 36, 56, 52);

  // ---------------------------------------------------------------- vault (stars become gold)
  place(L.vault[1], () => {
    const [x, y] = L.vault;
    const d = local(p, x, y, 0.75, bctx);
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
  });
  K.solid(36, 78, 32, 26);

  // ---------------------------------------------------------------- shrine = the trophy hall seen from outside
  place(L.shrine[1], () => {
    const [x, y] = L.shrine;
    const d = local(p, x, y, 1, bctx);
    p.ellipse(x, y - 1, 10, 3, '#8a94a6').ellipse(x, y - 2, 9, 2, '#b8c2d0');
    for (const [px, py] of [[-7, -2], [5, -2], [-5, -5], [3, -5]]) d.r(px, py - 7, 2, 7, '#cfd6e0').r(px, py - 8, 2, 1, '#8a94a6').r(px + 1, py - 7, 1, 7, '#9aa5b5');
    d.r(-2, -5, 4, 4, '#8a94a6').r(-2, -5, 4, 1, '#cfd6e0');
    const orbs = S.world.hall.trophies.filter((a) => !a.secret || a.unlocked).slice(0, 12);
    const cols = [C.yellow, C.cyan, C.lime, C.orange, '#b48cf0'];
    orbs.forEach((a, i) => {
      const t = orbs.length === 1 ? 0.5 : i / (orbs.length - 1), ox = Math.round(-11 + t * 22), oy = -16 - Math.round(Math.sin(t * Math.PI) * 5);
      if (a.unlocked) d.anim(a.isNew ? 'fl' : 'pu', `animation-delay:${-(i % 4) * 0.7}s`, () => d.r(ox, oy, 2, 2, a.isNew ? '#ffffff' : cols[i % cols.length]));
      else d.r(ox, oy, 2, 2, '#566c86', 0.65);
    });
  });
  if (scene.light.gold) K.spots.push({ x: L.shrine[0], y: L.shrine[1] - 12, r: 17, color: '#ffcd75', pulse: true, op: 0.7 });
  K.solid(108, 80, 32, 22);

  // ---------------------------------------------------------------- plaza: well, lamp posts, stalls, bunting
  place(L.well[1], () => {
    const [x, y] = L.well;
    p.ellipse(x, y, 4, 2, '#5e687c').ellipse(x, y - 1, 3, 1, '#8a94a6').ellipse(x, y - 1, 2, 1, SE.water);
    p.r(x - 4, y - 8, 1, 8, '#7a4a2b').r(x + 3, y - 8, 1, 8, '#7a4a2b').r(x - 5, y - 9, 10, 2, '#b13e53').r(x - 4, y - 10, 8, 1, '#b13e53');
  });
  for (const lx of [70, 106]) place(108, () => {
    p.r(lx, 103, 1, 6, '#4e2f1c');
    if (scene.light.torches) { p.raw('<g class="fl">').r(lx - 1, 101, 3, 2, C.orange).r(lx, 100, 1, 1, C.yellow).raw('</g>'); K.lights.push({ x: lx - 1, y: 101, w: 3, h: 2, glow: 1 }); }
    else p.r(lx - 1, 101, 3, 2, '#566c86');
  });
  const stalls = Math.min(2, scene.npcs.merchant);
  for (let i = 0; i < stalls; i++) {
    const sx = i ? 108 : 68, col = i ? C.blue : C.red;
    place(118, () => { p.r(sx - 4, 118, 8, 1, '#7a4a2b').r(sx - 5, 114, 10, 3, col).r(sx - 5, 114, 10, 1, lighten(col, 0.4)); for (let k = 0; k < 5; k++) p.r(sx - 5 + k * 2, 117, 1, 1, '#f4f4f4'); p.r(sx - 3, 118, 6, 1, '#a86b3c'); p.r(sx - 2, 117, 1, 1, C.yellow).r(sx + 1, 117, 1, 1, C.red); });
  }
  if (scene.light.accent === 'celebrate' || scene.light.accent === 'gold' && scene.fx.includes('confetti')) {   // string lights across the plaza
    const cols = [C.red, C.yellow, C.cyan, C.lime, '#ff9ecb'];
    for (let x = 70; x <= 106; x += 3) { const y = 103 + Math.round(2 * Math.sin(((x - 70) / 36) * Math.PI)); p.raw(`<g class="${(x / 3) % 2 ? 'f1' : 'f2'}">`).r(x, y, 2, 2, cols[(x / 3) % 5 | 0]).raw('</g>'); }
  }

  // ---------------------------------------------------------------- the CI fortress (workflow health)
  const failing = S.totals.failingRepos.length > 0;
  const failStage = worst(scene.stages.fail), repairSt = worst(scene.stages.repair);
  place(L.ci[1], () => {
    const [x, y] = L.ci;
    const d = local(p, x, y, 1, bctx);
    // walls on both sides, then the tower in front of them
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
  });
  K.solid(130, 30, 46, 62);

  // ---------------------------------------------------------------- the mine (data) in the north-west mountain
  const mineSlot = layout.mine;
  place(L.mine[1], () => {
    const r = mineSlot?.repo, lvl = r ? r.evolution.level : 4;
    const stage = r ? { fail: scene.stages.fail[r.name], repair: scene.stages.repair[r.name], build: scene.stages.build[r.name] } : {};
    const common = { lit: scene.light.windows, ctx: bctx, snow: winter };
    if (!r || lvl >= 4) drawRepo(p, 'mine', L.mine[0], L.mine[1], { ...common, name: r?.name || 'mine', level: Math.max(4, lvl), state: r ? r.state : 'active', recovered: r?.recovered, stage });
    else {                                                   // the old mine stays; the new project is a building site beside it
      drawRepo(p, 'mine', L.mine[0] - 8, L.mine[1], { ...common, name: 'mine', level: 4, state: 'active' });
      drawRepo(p, 'mine', L.mine[0] + 20, L.mine[1] + 8, { ...common, name: r.name, level: lvl, state: r.state, recovered: r.recovered, stage });
    }
  });
  K.solid(2, 44, 54, 34);

  // ---------------------------------------------------------------- repositories = buildings, in their districts
  for (const q of layout.placed) {
    const r = q.repo;
    place(q.y, () => {
      p.r(q.x - 8, q.y - 1, 16, 2, '#000000', 0.12);
      drawRepo(p, r.archetype === 'castle' ? 'house' : r.archetype, q.x, q.y, {
        name: r.name, level: r.evolution.level, state: r.state, recovered: r.recovered, snow: winter, ctx: bctx,
        lit: scene.light.windows && ['active', 'building', 'sleepy'].includes(r.state) && r.state !== 'sleepy',
        stage: { fail: scene.stages.fail[r.name], repair: scene.stages.repair[r.name], build: scene.stages.build[r.name] },
      });
    });
    K.solid(q.x - 11, q.y - 30, 24, 34);
  }
  for (const q of layout.ruins) place(q.y, () => drawRepo(p, 'house', q.x, q.y, { name: q.repo.name, level: 3, state: 'abandoned', ctx: bctx, snow: winter }));

  // ---------------------------------------------------------------- the farm: the last 21 days of contributions
  place(L.farm[1] + 6, () => {
    const [fx0, fy0] = L.farm;
    p.r(fx0 - 2, fy0 - 2, 74, 34, '#7a4a2b').r(fx0 - 1, fy0 - 1, 72, 32, '#4e2f1c');
    for (let i = 0; i < 38; i++) p.r(fx0 - 4 + i * 2, fy0 - 4, 1, 3, '#a86b3c');
    p.r(fx0 - 3, fy0 - 3, 76, 1, '#a86b3c');
    p.symbol('fsoil', (q) => q.r(0, 0, 10, 10, '#6b4226').r(0, 0, 10, 1, '#8c5a36').r(0, 9, 10, 1, '#4e2f1c').r(0, 5, 10, 1, '#5e3820'));
    p.symbol('fsoilg', (q) => q.r(0, 0, 10, 10, '#8a6a2b').r(0, 0, 10, 1, '#b08a3a').r(0, 9, 10, 1, '#5e4a1c').r(0, 5, 10, 1, '#6e5420'));
    CROP.forEach((spr, i) => { if (spr) p.symbol(`fc${i}`, (q) => q.sprite(spr, 0, 0, { s: 1 })); });
    p.symbol('fwheat', (q) => q.sprite(WHEAT, 0, 0, { s: 1 }));
    // TRUE V2: the plots are the authoritative world farm model; the map shows a 21-plot window of it.
    const plots = S.world.farm.map;
    plots.forEach((plot, i) => {
      p.use(plot.gold ? 'fsoilg' : 'fsoil', plot.x, plot.y);
      if (plot.stage > 0) p.use(plot.gold ? 'fwheat' : `fc${plot.stage}`, plot.x, plot.y);
      if (plot.gold && i % 3 === 0) p.raw(`<g class="tw" style="animation-delay:${-(i % 5) * 0.5}s">`).r(plot.x + 2 + (i % 4), plot.y + 2, 1, 1, '#fff6a0').raw('</g>');
    });
    p.r(fx0 + 71, fy0 + 8, 1, 12, '#7a4a2b').r(fx0 + 68, fy0 + 11, 7, 1, '#7a4a2b').r(fx0 + 70, fy0 + 5, 3, 3, '#d9a066').r(fx0 + 69, fy0 + 4, 5, 1, '#7a4a2b').r(fx0 + 69, fy0 + 12, 5, 4, seasonKey === 'winter' ? '#b13e53' : '#3b5dc9');  // scarecrow
    if (scene.fx.includes('harvestFestival')) {                              // bunting along the fence
      const cols = [C.red, C.yellow, C.cyan, C.lime];
      for (let i = 0; i < 18; i++) p.raw(`<g class="${i % 2 ? 'f1' : 'f2'}">`).r(fx0 + i * 4, fy0 - 7, 3, 3, cols[i % 4]).raw('</g>');
    }
  });
  K.solid(4, 166, 78, 38);

  // ---------------------------------------------------------------- the gate: open issues wait below it
  place(L.gate[1], () => {
    const [x, y] = L.gate, night = K.night;
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
    d.sprite(ICON.skull, -3, -24, { s: 0.75 });
    if (scene.light.gate) K.danger.push({ x: x, y: y - 8, r: 22, strong: true });
  });
  K.solid(56, 188, 64, 24);

  // ---------------------------------------------------------------- the camp: one tent and one flag for each visitor
  place(L.camp[1], () => {
    const [x, y] = L.camp;
    // TRUE V2: one tent per visitor plot from the authoritative world camp model.
    const plots = S.world.camp.plots.slice(0, cfg.visitors?.showOnMap ?? 12), n = plots.length;
    p.r(x - 22, y - 4, 46, 16, mix(SE.grass, '#b98a54', 0.25));
    const fcol = { red: C.red, blue: C.blue, green: C.green, gold: C.yellow, purple: '#b48cf0', orange: C.orange };
    plots.forEach((pl) => {
      p.sprite(ICON.tent, pl.x, pl.y, { s: 1, pal: { R: fcol[pl.color] || C.red } });
      p.r(pl.x + 7, pl.y - 5, 1, 6, '#4e2f1c').r(pl.x + 8, pl.y - 5, 3, 2, fcol[pl.color] || C.red);
    });
    if (n === 0) { p.r(x - 2, y - 14, 1, 14, '#4e2f1c'); p.raw('<g class="fl">').r(x - 1, y - 14, 5, 3, '#f4f4f4').raw('</g>'); }
    const fx = x + (n > 0 ? 25 : 6), fy = y + 8;
    p.r(fx - 2, fy, 5, 1, '#4e2f1c');
    p.raw('<g class="f1">').sprite(ICON.flame, fx - 3, fy - 7, { s: 0.75 }).raw('</g><g class="f2">').sprite(ICON.flame, fx - 3, fy - 7, { s: 0.75, flip: true }).raw('</g>');
    K.lights.push({ x: fx - 2, y: fy - 6, w: 5, h: 5, glow: 1 });
  });
  K.solid(112, 172, 58, 34);

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
    place(y, () => { p.r(x - 3, y - 1, 7, 2, '#000000', 0.15); p.use(ids.get(key), x - Math.floor(spr.w / 2), y - spr.h); });
  };
  const fz = { x0: 96, x1: 170, y0: 170, y1: 206 };
  let li = 0;
  for (let i = 0, put = 0; i < 140 && put < 20; i++) {
    const x = rnd.int(fz.x0, fz.x1), y = rnd.int(fz.y0, fz.y1);
    if (!K.free(x, y, 3) || Math.hypot(x - L.camp[0], y - L.camp[1]) < 20) continue;
    const lang = li < langs.length ? langs[li++] : null;
    tree(x, y, put % 3 === 0 ? 'pine' : 'oak', lang && lang.color); put++;
  }
  while (li < langs.length) { const x = rnd.int(fz.x0, fz.x1), y = rnd.int(fz.y0, fz.y1); if (K.free(x, y, 3)) tree(x, y, 'oak', langs[li++].color); }
  for (const [x, y] of [[4, 66], [12, 90], [3, 104], [168, 60], [172, 96], [5, 166], [4, 200], [170, 160], [2, 130], [60, 70], [118, 66], [100, 176]]) tree(x, y, rnd() < 0.5 ? 'pine' : 'oak', null);
}
