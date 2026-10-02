// The living map. Everything here is drawn from the world state (the "save file").
import { Pix, svgDoc, textW, makeSprite } from './pixel.mjs';
import { C, SEASONS, TINT, mix, lighten, darken } from './palette.mjs';
import { NPC, GOBLIN, GOBLIN2, TREE_OAK, TREE_PINE, ROCK, CROP, WHEAT, ICON, HERO_STYLE, drawHero, drawSprite } from './sprites.mjs';
import { drawBuilding, local, ARCHETYPES, stateFx, stone, crenel, smoke, fire } from './buildings.mjs';
import * as SC from './scenery.mjs';
import { T, box, chip } from './ui.mjs';
import { rng, hash32, truncate, fmt } from '../util.mjs';

const GW = SC.GW, GH = SC.GH, U = 4;

// where things stand: [x, foot y] in grid units
export const L = {
  mine: [22, 53], dungeon: [138, 55], tower: [36, 86], castle: [80, 77], ctrl: [126, 90],
  vault: [58, 97], shrine: [102, 97], library: [141, 106], workshop: [20, 121], training: [132, 142],
  farm: [6, 151], gate: [80, 192], camp: [132, 199], well: [80, 110], pond: [20, 205],
};
const HOUSE_SLOTS = [[62, 124], [98, 124], [62, 140], [98, 140], [116, 124], [62, 156], [98, 156], [116, 160]];
const RUIN_SLOTS = [[110, 68], [152, 82], [6, 92]];
const ROADS = [
  [80, 204, 80, 78, 6], [22, 107, 138, 107, 5], [36, 107, 36, 88, 4], [126, 107, 126, 94, 4],
  [40, 107, 40, 150, 4], [80, 172, 132, 172, 4], [132, 172, 132, 202, 4], [80, 204, 80, 218, 6],
];

export function renderWorld(state, rctx = {}) {
  const p = new Pix(U);
  const S = state;
  const ph = S.time.phase, seasonKey = S.time.season, SE = SEASONS[seasonKey];
  const rnd = rng('world:' + S.profile.login), fx = rng('fx:' + S.profile.login);
  const night = ph === 'night', dim = ph !== 'day';
  const weather = S.weather;
  const stormy = weather === 'storm' || weather === 'thunderstorm';
  const winter = seasonKey === 'winter';
  const lights = [], objs = [], walkers = [];
  const bctx = { lights };
  const place = (z, fn) => objs.push({ z, fn });
  const cfg = rctx.cfg || {};
  const activeEv = S.events.active;
  const hasEv = (t) => activeEv.some((e) => e.type === t);
  const celebrate = hasEv('release') || hasEv('milestone') || hasEv('harvest');
  const repoOf = (kind) => S.repos.find((r) => r.archetype === kind && r.state !== 'abandoned');
  const idle = S.hero.streak.idleDays, sleepy = S.hero.sleeping;
  const lit = dim || stormy;
  const sym = (id, spr, s, pal) => { p.symbol(id, (q) => q.sprite(spr, 0, 0, { s, pal })); return id; };

  // ---------------------------------------------------------------- sky
  SC.sky(p);
  if (night) SC.stars(p, fx, stormy ? 8 : 44);
  if (weather === 'aurora') SC.aurora(p, fx);
  if (weather !== 'thunderstorm') {
    if (ph === 'day') SC.sun(p, 130, 14); else if (ph === 'dawn') SC.sun(p, 28, 38, true); else if (ph === 'evening') SC.sun(p, 134, 38, true); else SC.moon(p, 128, 14);
  }
  SC.clouds(p, fx, { count: stormy ? 7 : weather === 'rain' ? 6 : weather === 'sunrise' ? 2 : 4, dark: weather === 'thunderstorm' ? 0.75 : stormy ? 0.55 : weather === 'rain' ? 0.35 : 0, night, phase: ph });
  if (celebrate) { SC.burst(p, 30, 30, C.red, 0); SC.burst(p, 130, 32, C.cyan, -1.2); SC.burst(p, 80, 7, C.yellow, -2.2); }

  // ---------------------------------------------------------------- mountains + ground
  const snowDepth = winter ? 9 : 4;
  SC.range(p, 0, GW - 1, 52, [[16, 25, 0.9], [58, 19, 1], [102, 23, 1], [142, 29, 0.9]], '#8da6c8', '#b6c9e0', snowDepth + 1);
  SC.range(p, 0, 78, 56, [[26, 27, 0.95], [66, 15, 1]], '#6b86aa', '#8fa8c8', snowDepth);
  SC.range(p, 92, GW - 1, 56, [[138, 31, 0.95], [106, 14, 1]], '#6b86aa', '#8fa8c8', snowDepth);
  p.r(0, 48, GW, GH - 48, SE.grass);
  for (let i = 0; i < 460; i++) p.r(rnd.int(0, GW - 2), rnd.int(49, GH - 1), rnd() < 0.3 ? 2 : 1, 1, SE.grass2);
  for (let i = 0; i < 120; i++) p.r(rnd.int(0, GW - 2), rnd.int(49, GH - 1), 1, 1, lighten(SE.grass, 0.18));
  p.ellipse(80, 80, 46, 10, lighten(SE.grass, 0.1)).ellipse(80, 82, 40, 7, lighten(SE.grass, 0.06));

  // ---------------------------------------------------------------- water, roads
  const water = SE.water, [pcx, pcy] = L.pond;
  p.ellipse(pcx, pcy, 12, 6, darken(water, 0.25)).ellipse(pcx, pcy, 11, 5, water).r(pcx - 6, pcy - 2, 4, 1, lighten(water, 0.4), 0.8).r(pcx + 2, pcy + 1, 3, 1, lighten(water, 0.4), 0.8);
  if (!winter) p.raw('<g class="tw">').r(pcx - 2, pcy, 3, 1, '#ffffff', 0.6).raw('</g>');
  for (const [rx, ry] of [[-11, -2], [11, 1], [-8, 5], [9, -4]]) p.r(pcx + rx, pcy + ry - 3, 1, 3, '#2f9e5b').r(pcx + rx + 1, pcy + ry - 2, 1, 2, '#4fd070');
  const dirt = winter ? mix(C.dirt, '#ffffff', 0.5) : C.dirt, dirtD = winter ? mix(C.dirtD, '#ffffff', 0.4) : C.dirtD, dirtL = winter ? mix(C.dirtL, '#ffffff', 0.5) : C.dirtL;
  const blocked = [];
  for (const [x1, y1, x2, y2, w] of ROADS) {
    const x = Math.min(x1, x2) - (x1 === x2 ? w / 2 : 0), y = Math.min(y1, y2) - (y1 === y2 ? w / 2 : 0);
    const rw = x1 === x2 ? w : Math.abs(x2 - x1), rh = y1 === y2 ? w : Math.abs(y2 - y1);
    p.r(x - 1, y - 1, rw + 2, rh + 2, dirtD).r(x, y, rw, rh, dirt);
    for (let i = 0; i < (rw * rh) / 18; i++) p.r(x + rnd.int(0, rw - 1), y + rnd.int(0, rh - 1), 1, 1, rnd() < 0.5 ? dirtL : dirtD);
    blocked.push([x - 2, y - 2, rw + 4, rh + 4]);
  }
  const solid = (x, y, w, h) => blocked.push([x, y, w, h]);
  [[54, 32, 52, 48], [28, 50, 16, 38], [118, 60, 16, 34], [46, 80, 24, 22], [90, 80, 24, 22], [128, 80, 28, 28], [0, 100, 36, 26], [8, 38, 28, 16], [122, 36, 32, 20], [118, 126, 30, 20], [2, 146, 78, 40], [48, 172, 64, 24], [108, 186, 50, 34], [4, 192, 34, 18]].forEach((r) => solid(...r));
  HOUSE_SLOTS.forEach(([hx, hy]) => solid(hx - 10, hy - 18, 20, 22));
  const free = (x, y, m = 0) => !blocked.some(([bx, by, bw, bh]) => x >= bx - m && x <= bx + bw + m && y >= by - m && y <= by + bh + m);

  // ---------------------------------------------------------------- landmarks
  const mk = (kind, x, y, s, o = {}) => place(y, () => {
    const d = local(p, x, y, s, bctx);
    const b = ARCHETYPES[kind](d, { ctx: bctx, snow: winter, lit, ...o });
    if (o.state) stateFx(d, o, b);
  });
  const plaque = (cx, y, text, color = T.gold) => place(300, () => {
    const s = 0.75, w = textW(text, s) + 4, h = 7 * s + 3;
    const x = Math.round(cx - w / 2);
    p.r(x, y, w, h, '#14162b', 0.88).r(x, y, w, 0.5, color, 0.8).text(text, x + 2, y + 1.5, s, color);
  });
  const repoState = (kind) => { const r = repoOf(kind); return r ? { state: r.state, recovered: r.recovered, name: r.name } : { state: 'active', name: null }; };

  // castle (main repo + level)
  const cs = repoState('castle');
  mk('castle', L.castle[0], L.castle[1], 1, { tier: S.castle.tier, flag: HERO_STYLE[S.hero.class.archetype]?.pal.b || C.red, lit: lit || celebrate, state: cs.state === 'building' || cs.state === 'failing' || cs.state === 'dusty' ? cs.state : undefined, recovered: cs.recovered });
  plaque(L.castle[0], L.castle[1] + 3, 'CASTLE');
  // github tower (followers) follows the automation repo
  const ts = repoState('tower');
  mk('tower', L.tower[0], L.tower[1], 0.75, { h: 44, beacon: C.yellow, state: ['failing', 'building', 'dusty'].includes(ts.state) ? ts.state : undefined, recovered: ts.recovered });
  place(L.tower[1], () => { const n = Math.min(6, Math.max(1, Math.ceil(S.profile.followers / 4))); for (let i = 0; i < n; i++) { p.r(L.tower[0] + 5, L.tower[1] - 30 + i * 4, 1, 3, '#4e2f1c'); p.r(L.tower[0] + 6, L.tower[1] - 30 + i * 4, 3, 2, i % 2 ? C.sky : C.yellow); } });
  plaque(L.tower[0], L.tower[1] + 3, 'TOWER');
  // workflow control tower
  const failing = S.totals.failingRepos.length > 0;
  mk('tower', L.ctrl[0], L.ctrl[1], 0.75, { h: 34, dish: true, beacon: failing ? C.red : C.green, state: failing ? 'failing' : undefined, lit: true });
  plaque(L.ctrl[0], L.ctrl[1] + 3, failing ? 'CI ALERT' : 'CI', failing ? C.red : T.gold);
  // library, workshop, mine
  const ls = repoState('library');
  mk('library', L.library[0], L.library[1], 0.75, { state: ['failing', 'building', 'dusty'].includes(ls.state) ? ls.state : undefined, recovered: ls.recovered });
  plaque(L.library[0], L.library[1] + 3, 'LIBRARY');
  const ws = repoState('workshop');
  const wTier = S.totals.commits >= 1000 ? 3 : S.totals.commits >= 100 ? 2 : 1;
  place(L.workshop[1], () => {
    const [x, y] = L.workshop;
    const d = local(p, x, y, 0.75, bctx);
    if (wTier >= 2) { d.r(-26, -8, 12, 8, '#a86b3c'); d.r(-27, -10, 14, 2, '#7a4a2b'); d.r(-26, -8, 1, 8, '#7a4a2b'); d.r(-21, -6, 4, 6, C.ink); }
    if (wTier >= 3) { d.r(-38, -6, 10, 6, '#a86b3c'); d.r(-39, -8, 12, 2, '#5e3820'); d.r(-37, -4, 3, 4, '#7a4a2b'); }
    ARCHETYPES.workshop(d, { ctx: bctx, snow: winter, smoke: !sleepy });
    if (['failing', 'building', 'dusty'].includes(ws.state)) stateFx(d, { state: ws.state, recovered: ws.recovered, ctx: bctx }, { x0: -14, x1: 14, top: -26 });
    if (!sleepy && ph !== 'night') { d.anim('bob', '', () => d.sprite(NPC.builder, 15, -9)); d.anim('f1', '', () => { d.r(21, -11, 1, 1, C.yellow); d.r(22, -12, 1, 1, C.white); }); }
    else { d.sprite(NPC.sleeper, 15, -9); for (let i = 0; i < 2; i++) d.anim('zz', `animation-delay:${-i * 1.5}s`, () => { d.r(19, -13, 3, 1, C.white).r(20, -12, 1, 1, C.white).r(19, -11, 3, 1, C.white); }); }
  });
  plaque(L.workshop[0] + 4, L.workshop[1] + 3, 'SHOP');
  const ms = repoState('mine');
  mk('mine', L.mine[0], L.mine[1], 0.75, { state: ['failing', 'building', 'dusty'].includes(ms.state) ? ms.state : undefined });
  plaque(L.mine[0], L.mine[1] + 3, 'MINE');

  // dungeon (archived repositories + where goblins come from)
  place(L.dungeon[1], () => {
    const [x, y] = L.dungeon;
    const d = local(p, x, y, 1, bctx);
    for (let i = 0; i < 18; i++) { const hw = 14 - Math.floor(i * 0.3); d.r(-hw, -18 + i, hw * 2, 1, i % 5 === 4 ? '#3b4452' : '#4b5563'); }
    if (winter) d.r(-9, -18, 18, 2, '#f4f8fc');
    p.raw(`<circle cx="${x * U}" cy="${(y - 5) * U}" r="${12 * U}" fill="url(#glowr)" class="pu" opacity="0.8"/>`);
    d.r(-6, -11, 12, 11, '#0e0510').r(-5, -12, 10, 1, '#0e0510');
    for (let bx = -5; bx <= 4; bx += 2) d.r(bx, -11, 1, 11, '#566c86');
    d.r(-6, -4, 12, 1, '#566c86').r(-6, -9, 12, 1, '#566c86');
    d.r(-7, -13, 14, 2, '#5e687c').r(-7, -13, 14, 1, '#8a94a6');
    d.sprite(ICON.skull, -3, -20, { s: 0.75 });
    d.torch(-9, -4, true); d.torch(8, -4, true);
    const n = Math.min(3, S.totals.archivedRepos);
    for (let i = 0; i < n; i++) { d.r(12 + i * 5, -5, 3, 5, '#8a94a6').r(12 + i * 5, -5, 3, 1, '#b8c2d0').r(13 + i * 5, -4, 1, 3, '#5e687c').r(12 + i * 5, -3, 3, 1, '#5e687c'); }
  });
  plaque(L.dungeon[0], L.dungeon[1] + 3, 'DUNGEON');

  // vault (stars become gold)
  place(L.vault[1], () => {
    const [x, y] = L.vault;
    const d = local(p, x, y, 0.75, bctx);
    stone(d, -9, -12, 18, 12, [C.stone, C.stoneD, C.stoneL]);
    d.r(-11, -15, 22, 4, '#e0a030').r(-11, -15, 22, 1, '#ffe08a').r(-7, -18, 14, 3, '#e0a030').r(-7, -18, 14, 1, '#ffe08a');
    if (winter) d.r(-7, -18, 14, 1, '#f4f8fc');
    d.r(-3, -9, 6, 9, '#e0a030').r(-3, -9, 6, 1, '#ffe08a').r(-1, -5, 2, 2, '#7a4a2b');
    const tr = S.treasure;
    if (tr.coins > 0) {
      let rows = Math.min(7, 1 + Math.floor(Math.sqrt(tr.coins * 1.2))), base = Math.min(24, 4 + Math.round(tr.coins / 3));
      for (let r = 0; r < rows; r++) {
        const w = Math.max(2, base - r * 3);
        d.r(-w / 2 + 2, 2 - r * 2 + 2, w, 2, r % 2 ? '#ffcd75' : '#e0a030');
        d.r(-w / 2 + 2, 2 - r * 2 + 2, w, 1, '#ffe08a');
      }
      d.anim('tw', '', () => d.r(-2, -rows * 2 + 3, 1, 1, '#ffffff'));
      d.anim('tw', 'animation-delay:-1.2s', () => d.r(4, 1, 1, 1, '#ffffff'));
    }
    if (tr.tier === 'mountain') d.sprite(ICON.crown, -4, -(rows7(tr.coins) * 2) - 6, { s: 1 });
    if (tr.tier === 'huge' || tr.tier === 'mountain' || tr.tier === 'large') { d.r(-18, -3, 6, 4, '#7a4a2b').r(-18, -3, 6, 1, '#a86b3c').r(-16, -2, 2, 2, '#ffcd75'); }
  });
  plaque(L.vault[0] - 2, L.vault[1] + 9, 'VAULT');
  function rows7(c) { return Math.min(7, 1 + Math.floor(Math.sqrt(c * 1.2))); }

  // achievement shrine
  place(L.shrine[1], () => {
    const [x, y] = L.shrine;
    const d = local(p, x, y, 1, bctx);
    p.ellipse(x, y - 1, 10, 3, '#8a94a6').ellipse(x, y - 2, 9, 2, '#b8c2d0');
    for (const [px, py] of [[-7, -2], [5, -2], [-5, -5], [3, -5]]) { d.r(px, py - 7, 2, 7, '#cfd6e0').r(px, py - 8, 2, 1, '#8a94a6').r(px + 1, py - 7, 1, 7, '#9aa5b5'); }
    d.r(-2, -5, 4, 4, '#8a94a6').r(-2, -5, 4, 1, '#cfd6e0');
    const list = S.achievements.list.filter((a) => !a.secret || a.unlocked);
    const orbs = list.slice(0, 12);
    const cols = [C.yellow, C.cyan, C.lime, C.orange, '#b48cf0'];
    orbs.forEach((a, i) => {
      const t = orbs.length === 1 ? 0.5 : i / (orbs.length - 1);
      const ox = Math.round(-11 + t * 22), oy = -16 - Math.round(Math.sin(t * Math.PI) * 5);
      if (a.unlocked) d.anim(a.isNew ? 'fl' : 'pu', `animation-delay:${-(i % 4) * 0.7}s`, () => d.r(ox, oy, 2, 2, a.isNew ? '#ffffff' : cols[i % cols.length]));
      else d.r(ox, oy, 2, 2, '#566c86', 0.65);
    });
  });
  plaque(L.shrine[0], L.shrine[1] + 3, 'SHRINE');

  // training grounds (open pull requests)
  place(L.training[1], () => {
    const [x, y] = L.training;
    const d = local(p, x, y, 1, bctx);
    p.r(x - 13, y - 12, 26, 14, mix(SE.grass, '#b98a54', 0.5)).frame(x - 13, y - 12, 26, 14, 1, '#7a4a2b');
    for (let i = 0; i < 7; i++) p.r(x - 13 + i * 4, y - 14, 1, 4, '#a86b3c');
    for (const dx of [-7, 0]) { d.r(dx, -10, 1, 9, '#7a4a2b'); d.r(dx - 2, -8, 5, 1, '#7a4a2b'); d.r(dx - 1, -11, 3, 3, '#d9a066'); d.r(dx - 1, -7, 3, 3, '#d9a066'); }
    d.r(7, -10, 5, 5, C.white).r(8, -9, 3, 3, C.red).r(9, -8, 1, 1, C.white).r(9, -5, 1, 5, '#7a4a2b');
    const n = Math.max(1, Math.min(4, S.totals.openPRs + 1));
    for (let i = 0; i < n; i++) p.raw(`<g class="bob" style="animation-delay:${-i * 0.3}s">`).sprite(NPC.guard, x - 9 + i * 5, y - 8, { s: 0.75 }).raw('</g>');
  });
  plaque(L.training[0], L.training[1] + 3, 'TRAINING');

  // forest: one tree for every language
  const langs = S.languages.length ? S.languages : [{ name: 'CODE', color: null }];
  const treeIds = new Map();
  const tree = (x, y, kind, color) => {
    const key = `t-${kind}-${color || 'd'}-${seasonKey}`;
    if (!treeIds.has(key)) {
      const base = color ? mix(color, SE.leaf, seasonKey === 'summer' ? 0.1 : 0.35) : SE.leaf;
      const pal = winter ? { L: mix(base, '#1b5560', 0.4), l: '#eef6fb', D: '#1b4a55', t: SE.trunk } : { L: base, l: lighten(base, 0.3), D: darken(base, 0.25), t: SE.trunk };
      if (seasonKey === 'spring' && !color) pal.l = '#ffc8e0';
      treeIds.set(key, sym(key, kind === 'pine' ? TREE_PINE : TREE_OAK, 1, pal));
    }
    const spr = kind === 'pine' ? TREE_PINE : TREE_OAK;
    place(y, () => { p.r(x - 3, y - 1, 7, 2, '#000000', 0.15); p.use(treeIds.get(key), x - Math.floor(spr.w / 2), y - spr.h); });
  };
  const fz = { x0: 96, x1: 154, y0: 160, y1: 196 };
  let li = 0;
  for (let i = 0, put = 0; i < 90 && put < 20; i++) {
    const x = rnd.int(fz.x0, fz.x1), y = rnd.int(fz.y0, fz.y1);
    if (!free(x, y, 3) || Math.hypot(x - L.camp[0], y - L.camp[1]) < 16) continue;
    const lang = li < langs.length ? langs[li++] : null;
    tree(x, y, put % 3 === 0 ? 'pine' : 'oak', lang && lang.color);
    put++;
  }
  while (li < langs.length) {
    const x = rnd.int(fz.x0, fz.x1), y = rnd.int(fz.y0, fz.y1);
    if (free(x, y, 3)) tree(x, y, 'oak', langs[li++].color);
  }
  for (const [x, y] of [[4, 66], [9, 78], [3, 118], [8, 168], [153, 66], [156, 92], [152, 122], [4, 190], [10, 212], [152, 214], [146, 60], [24, 176]]) tree(x, y, rnd() < 0.5 ? 'pine' : 'oak', null);
  

  // farm (the last 21 days of work)
  place(L.farm[1] + 6, () => {
    const [fx0, fy0] = L.farm;
    p.r(fx0 - 2, fy0 - 2, 74, 34, '#7a4a2b').r(fx0 - 1, fy0 - 1, 72, 32, '#4e2f1c');
    for (let i = 0; i < 38; i++) p.r(fx0 - 4 + i * 2, fy0 - 4, 1, 3, '#a86b3c');
    p.r(fx0 - 3, fy0 - 3, 76, 1, '#a86b3c');
    p.symbol('fsoil', (q) => q.r(0, 0, 10, 10, '#6b4226').r(0, 0, 10, 1, '#8c5a36').r(0, 9, 10, 1, '#4e2f1c').r(0, 5, 10, 1, '#5e3820'));
    p.symbol('fsoilg', (q) => q.r(0, 0, 10, 10, '#8a6a2b').r(0, 0, 10, 1, '#b08a3a').r(0, 9, 10, 1, '#5e4a1c').r(0, 5, 10, 1, '#6e5420'));
    CROP.forEach((spr, i) => { if (spr) p.symbol(`fc${i}`, (q) => q.sprite(spr, 0, 0, { s: 1 })); });
    p.symbol('fwheat', (q) => q.sprite(WHEAT, 0, 0, { s: 1 }));
    const days = S.calendar.slice(-21);
    const steps = cfg.cropSteps || [1, 3, 6, 10, 15];
    days.forEach((dd, i) => {
      const cx = fx0 + (i % 7) * 10, cy = fy0 + Math.floor(i / 7) * 10;
      p.use(dd.gold && dd.count > 0 ? 'fsoilg' : 'fsoil', cx, cy);
      let st = 0; for (const t of steps) if (dd.count >= t) st++;
      if (st > 0) p.use(dd.gold ? 'fwheat' : `fc${st}`, cx, cy);
    });
    // scarecrow
    p.r(fx0 + 71, fy0 + 8, 1, 12, '#7a4a2b').r(fx0 + 68, fy0 + 11, 7, 1, '#7a4a2b').r(fx0 + 70, fy0 + 5, 3, 3, '#d9a066').r(fx0 + 69, fy0 + 4, 5, 1, '#7a4a2b').r(fx0 + 69, fy0 + 12, 5, 4, SE.leaf2 === '#e9f4fb' ? '#b13e53' : '#3b5dc9');
  });
  plaque(L.farm[0] + 20, L.farm[1] - 11, 'FARM');

  // gate (open issues = goblins)
  const gateOpen = !night;
  place(L.gate[1], () => {
    const [x, y] = L.gate;
    const d = local(p, x, y, 1, bctx);
    for (let i = -3; i <= 3; i++) if (i !== 0) { p.r(x + i * 8 - 1, y - 6, 1, 7, '#7a4a2b'); }
    p.r(x - 56, y - 4, 112, 1, '#a86b3c').r(x - 56, y - 1, 112, 1, '#7a4a2b');
    for (let i = -7; i <= 7; i++) if (Math.abs(i * 8) > 28) p.r(x + i * 8 - 1, y - 7, 2, 8, '#a86b3c');
    stone(d, -26, -12, 52, 12);
    for (const sx of [-30, 22]) { stone(d, sx, -20, 8, 20); crenel(d, sx, -20, 8); d.r(sx + 3, -15, 2, 4, '#0e1024'); d.torch(sx + 4, -6, true); }
    crenel(d, -26, -12, 52);
    d.r(-6, -14, 12, 14, '#0e0510').r(-5, -15, 10, 1, '#0e0510');
    if (gateOpen) { for (let gx = -5; gx <= 4; gx += 2) d.r(gx, -15, 1, 3, '#566c86'); d.r(-6, -2, 12, 2, '#7a4a2b'); d.r(-6, -2, 12, 1, '#a86b3c'); }
    else { d.r(-6, -14, 6, 14, '#7a4a2b').r(0, -14, 6, 14, '#6a3f25').r(-1, -14, 2, 14, '#4e2f1c'); d.r(-6, -10, 12, 1, '#5e687c').r(-6, -4, 12, 1, '#5e687c'); }
    // guards
    const g = night ? 0 : 2;
    for (let i = 0; i < g; i++) p.raw(`<g class="bob" style="animation-delay:${-i * 0.4}s">`).sprite(NPC.guard, x - 14 + i * 28, y - 7, { s: 0.75 }).raw('</g>');
  });
  plaque(L.gate[0], L.gate[1] - 21, `ISSUES ${S.goblins.count}`, S.goblins.count > 5 ? T.red : S.goblins.count ? T.orange : T.green);

  // goblins
  const gob = S.goblins.tier;
  const nG = gob === 'none' ? 0 : Math.min(S.goblins.count, 10);
  const slots = [[80, 206], [70, 207], [90, 207], [62, 211], [98, 211], [75, 213], [85, 213], [54, 207], [106, 207], [80, 218]];
  const gid = [sym('g1', GOBLIN, 0.75), sym('g2', GOBLIN2, 0.75)];
  for (let i = 0; i < nG; i++) {
    const [gx, gy] = slots[i];
    place(gy, () => {
      p.raw(`<g class="bob" style="animation-delay:${-(i % 5) * 0.25}s">`).use(gid[i % 2], gx - 3, gy - 6).raw('</g>');
      if (gob === 'raid' || gob === 'boss') if (i % 3 === 0 && dim) { p.r(gx + 4, gy - 8, 1, 4, '#7a4a2b'); p.raw('<g class="fl">').r(gx + 3, gy - 11, 3, 3, C.orange).r(gx + 4, gy - 12, 1, 1, C.yellow).raw('</g>'); lights.push({ x: gx + 3, y: gy - 11, w: 3, h: 3, glow: 1 }); }
    });
  }
  if (gob === 'boss') place(212, () => {
    const bx = 80, by = 216;
    p.raw('<g class="bob2">').sprite(GOBLIN, bx - 8, by - 16, { s: 2 }).r(bx - 6, by - 20, 12, 2, C.yellow).r(bx - 6, by - 23, 2, 3, C.yellow).r(bx - 1, by - 23, 2, 3, C.yellow).r(bx + 4, by - 23, 2, 3, C.yellow).r(bx + 10, by - 12, 3, 12, '#7a4a2b').r(bx + 9, by - 16, 5, 5, '#5e3820').raw('</g>');
  });
  if (S.raid.active) {
    for (let i = 0; i < S.raid.goblins; i++) {
      const gx = 52 + i * 7 + (i % 2) * 2, gy = 197 + (i % 3) * 3;
      place(gy, () => { p.raw(`<g class="bob" style="animation-delay:${-i * 0.2}s">`).use(gid[i % 2], gx - 3, gy - 6).raw('</g>'); });
    }
  }
  

  // visitor camp
  place(L.camp[1], () => {
    const [x, y] = L.camp;
    const fl = S.visitors.flags.slice(0, cfg.visitors?.showOnMap ?? 12);
    p.r(x - 22, y - 4, 44, 16, mix(SE.grass, '#b98a54', 0.25));
    const fcol = { red: C.red, blue: C.blue, green: C.green, gold: C.yellow, purple: '#b48cf0', orange: C.orange };
    const tentSpr = ICON.tent;
    const n = fl.length;
    fl.forEach((f, i) => {
      const tx = x - 20 + (i % 4) * 11, ty = y - 4 + Math.floor(i / 4) * 7 + (i % 2);
      p.sprite(tentSpr, tx, ty, { s: 1, pal: { R: fcol[f.color] || C.red } });
      p.r(tx + 7, ty - 5, 1, 6, '#4e2f1c').r(tx + 8, ty - 5, 3, 2, fcol[f.color] || C.red);
    });
    if (n === 0) { p.r(x - 2, y - 14, 1, 14, '#4e2f1c'); p.raw('<g class="fl">').r(x - 1, y - 14, 5, 3, '#f4f4f4').raw('</g>'); }
    const cxf = x + (n > 0 ? 24 : 6), cyf = y + 8;
    p.r(cxf - 2, cyf, 5, 1, '#4e2f1c');
    p.raw('<g class="f1">').sprite(ICON.flame, cxf - 3, cyf - 7, { s: 0.75 }).raw('</g>').raw('<g class="f2">').sprite(ICON.flame, cxf - 3, cyf - 7, { s: 0.75, flip: true }).raw('</g>');
    lights.push({ x: cxf - 2, y: cyf - 6, w: 5, h: 5, glow: 1 });
  });
  plaque(L.camp[0], 189, 'CAMP');

  // village houses (repositories that are not landmarks)
  const used = new Set(['castle', 'tower', 'library', 'workshop', 'mine'].map((k) => repoOf(k)?.name).filter(Boolean));
  const houses = S.repos.filter((r) => !used.has(r.name) && r.state !== 'abandoned').slice(0, HOUSE_SLOTS.length);
  houses.forEach((r, i) => {
    const [hx, hy] = HOUSE_SLOTS[i];
    place(hy, () => {
      p.r(hx - 8, hy - 1, 16, 2, '#000000', 0.12);
      drawBuilding(p, 'house', hx, hy, 0.75, { state: r.state, recovered: r.recovered, name: r.name, lit: lit && ['active', 'building'].includes(r.state), ctx: bctx, snow: winter });
    });
  });
  S.repos.filter((r) => r.state === 'abandoned').slice(0, RUIN_SLOTS.length).forEach((r, i) => {
    const [hx, hy] = RUIN_SLOTS[i];
    place(hy, () => drawBuilding(p, 'house', hx, hy, 0.75, { state: 'abandoned', name: r.name, ctx: bctx, snow: winter }));
  });
  // plaza
  place(L.well[1], () => {
    const [x, y] = L.well;
    p.ellipse(x, y, 4, 2, '#5e687c').ellipse(x, y - 1, 3, 1, '#8a94a6').ellipse(x, y - 1, 2, 1, SE.water);
    p.r(x - 4, y - 8, 1, 8, '#7a4a2b').r(x + 3, y - 8, 1, 8, '#7a4a2b').r(x - 5, y - 9, 10, 2, '#b13e53').r(x - 4, y - 10, 8, 1, '#b13e53');
  });
  for (const lx of [66, 94]) place(104, () => { p.r(lx, 99, 1, 6, '#4e2f1c'); if (dim) { p.raw('<g class="fl">').r(lx - 1, 97, 3, 2, C.orange).r(lx, 96, 1, 1, C.yellow).raw('</g>'); lights.push({ x: lx - 1, y: 97, w: 3, h: 2, glow: 1 }); } else p.r(lx - 1, 97, 3, 2, '#566c86'); });
  if (ph === 'evening' || ph === 'day') for (const [sx, col] of [[68, C.red], [92, C.blue]]) place(112, () => { p.r(sx - 4, 112, 8, 1, '#7a4a2b').r(sx - 5, 108, 10, 3, col).r(sx - 5, 108, 10, 1, lighten(col, 0.4)); for (let k = 0; k < 5; k++) p.r(sx - 5 + k * 2, 111, 1, 1, '#f4f4f4'); });

  // draw all placed objects from back to front
  objs.sort((a, b) => a.z - b.z).forEach((o) => o.fn());

  // ---------------------------------------------------------------- people on the move
  const npcId = (k) => sym(`n-${k}`, NPC[k], 0.75);
  const paths = [[26, 104, 110, 0], [78, 82, 0, 112], [30, 110, 0, 22], [84, 168, 46, 0], [30, 146, 40, 0]];
  const walk = (kind, [x, y, dx, dy], i, speed = 4) => {
    const len = Math.max(dx, dy), t = Math.max(8, Math.round((2 * len) / speed));
    const cls = dx ? 'wk' : 'wy';
    const vars = dx ? `--dx:${dx * U}px` : `--dy:${dy * U}px`;
    p.raw(`<g class="${cls}" style="${vars};--t:${t}s;animation-delay:${-Math.round(((i * 7) % 10) * t / 10)}s"><g class="fc" style="--t:${t}s;animation-delay:${-Math.round(((i * 7) % 10) * t / 10)}s"><g class="bob">`).use(npcId(kind), x, y - 6).raw('</g></g></g>');
  };
  if (!night) {
    const count = ph === 'dawn' ? Math.ceil(S.population.npcs / 4) : ph === 'evening' ? Math.ceil(S.population.npcs / 2) : Math.min(S.population.npcs, 10);
    const kinds = ['villager', 'villager2', 'villager3'];
    for (let i = 0; i < count; i++) walk(kinds[i % 3], paths[i % paths.length], i, 3);
    if (ph === 'evening') for (let i = 0; i < 3; i++) walk('villager3', [62 + i * 14, 113, 8, 0], i + 3, 2);
  } else {
    // guards patrol at night, a few people sleep
    walk('guard', [56, 189, 48, 0], 0, 3); walk('guard', [64, 104, 30, 0], 2, 3);
    houses.slice(0, 3).forEach((r, i) => { const [hx, hy] = HOUSE_SLOTS[i]; p.sprite(NPC.sleeper, hx + 8, hy - 3, { s: 0.75 }); p.raw(`<g class="zz" style="animation-delay:${-i}s">`).text('Z', hx + 9, hy - 8, 0.6, C.white).raw('</g>'); });
  }
  for (let i = 0; i < Math.min(6, S.totals.forks); i++) walk('traveler', i % 2 ? [84, 168, 46, 0] : [78, 120, 0, 70], i + 1, 2.5);
  for (let i = 0; i < Math.min(5, S.totals.openPRs); i++) walk('courier', [28 + i * 6, 104, 96 - i * 8, 0], i, 6);
  if (!night && !sleepy) for (let i = 0; i < 2; i++) walk('farmer', [8 + i * 24, 145, 28, 0], i, 1.5);

  // ---------------------------------------------------------------- the hero
  const arch = S.hero.class.archetype;
  const pos = { home: [46, 126], farm: [46, 140], castle: [76, 83], plaza: [74, 103] }[S.hero.position];
  const [hx, hy] = pos;
  p.ellipse(hx + 4, hy + 11, 5, 1, '#000000', 0.25);
  p.raw('<g class="bob2">').raw(night || sleepy ? '<g opacity="0.95">' : '<g>');
  drawHero(p, hx, hy, arch, { s: 0.75 });
  p.raw('</g></g>');
  if (night || sleepy) for (let i = 0; i < 3; i++) p.raw(`<g class="zz" style="animation-delay:${-i}s">`).text('Z', hx + 10 + i, hy - 2, 0.75, C.white).raw('</g>');
  p.raw('<g class="bob">').sprite(makeSprite(['YYYYYYY', '.YYYYY.', '..YYY..', '...Y...'], { Y: '#fff0a0' }), hx + 1, hy - 9, { s: 0.75 }).raw('</g>');

  if (celebrate) SC.confetti(p, fx);

  // ---------------------------------------------------------------- weather, light, mood
  if (weather === 'thunderstorm') { SC.rain(p, fx, true); SC.lightning(p, 96, 6); }
  else if (weather === 'storm') SC.rain(p, fx, true);
  else if (weather === 'rain') SC.rain(p, fx, false);
  else SC.fallers(p, fx, seasonKey);
  if (weather === 'sunrise') p.raw(`<rect y="${40 * U}" width="${GW * U}" height="${40 * U}" fill="#ffb86b" opacity="0.14"/>`);
  const [tintC, tintA] = TINT[ph];
  const wx = ({ rain: 0.16, storm: 0.28, thunderstorm: 0.4 }[weather] || 0) * (night ? 0.45 : 1);
  if (tintC) p.raw(`<rect width="${GW * U}" height="${GH * U}" fill="${tintC}" opacity="${tintA}"/>`);
  if (wx) p.raw(`<rect width="${GW * U}" height="${GH * U}" fill="#14223c" opacity="${wx}"/>`);
  for (const l of lights) {
    const g = l.glow || 0;
    if (!g && !lit) continue;
    if (g === 1 && !lit) continue;
    const cx = (l.x + l.w / 2) * U, cy = (l.y + l.h / 2) * U;
    if (g) p.raw(`<circle cx="${cx}" cy="${cy}" r="${(g === 2 ? 9 : 6) * U}" fill="url(#${l.color === C.red ? 'glowr' : l.color === C.cyan ? 'glowb' : 'glow'})" opacity="${g === 2 ? 0.85 : 0.6}"/>`);
    if (!g) p.r(l.x, l.y, l.w, l.h, '#ffe9a0');
  }

  // ---------------------------------------------------------------- HUD (own canvas, 1 unit = 1 SVG unit)
  const h = new Pix(1), WW = GW * U;
  const label = `${S.time.phase} ${S.weather} ${seasonKey}`.toUpperCase();
  const hudW = textW(label, 3) + 24;
  h.r(8, 8, hudW, 38, '#14162b', 0.85).r(8, 8, hudW, 3, T.gold);
  h.text(label, 20, 21, 3, T.white);
  if (S.meta.demo) { h.r(WW - 196, 8, 188, 34, '#b13e53').text('DEMO DATA', WW - 102, 17, 3, T.white, { align: 'c' }); }
  const ev = activeEv[0];
  const evColor = ev && (ev.type === 'emergency' || ev.type === 'raid') ? T.red : T.gold;
  if (ev) {
    const w = textW(ev.title, 4) + 104, x = Math.round((WW - w) / 2), y = 60;
    h.r(x, y, w, 52, '#14162b', 0.92).r(x, y, w, 4, evColor).r(x, y + 48, w, 4, evColor);
    h.raw('<g class="fl">').sprite(ICON[ev.icon] || ICON.star, x + 14, y + 12, { s: 3.5 }).raw('</g>');
    h.text(ev.title, x + 62, y + 13, 4, evColor === T.red ? '#ff9a9a' : T.gold, { shadow: '#000' });
  }
  if (S.raid.active) {
    const w = 360, x = Math.round((WW - w) / 2), y = ev ? 124 : 60;
    h.r(x, y, w, 66, '#14162b', 0.92).r(x, y, w, 4, T.red);
    h.text('KINGDOM DEFENSE', x + 14, y + 12, 3, T.white).text(`${S.raid.defense}%`, x + w - 14, y + 12, 3, T.green, { align: 'r' });
    h.r(x + 14, y + 42, w - 28, 16, '#0e1024').r(x + 16, y + 44, Math.round(((w - 32) * S.raid.defense) / 100), 12, S.raid.defense >= S.raid.attack ? '#a7f070' : '#ef7d57');
  }
  activeEv.slice(1, 4).forEach((e, i) => {
    const y = (S.meta.demo ? 54 : 12) + i * 42;
    h.r(WW - 48, y, 40, 38, '#14162b', 0.88).sprite(ICON[e.icon] || ICON.star, WW - 44, y + 3, { s: 4 });
  });
  p.raw(h.toString());

  return svgDoc({
    w: GW * U, h: GH * U, title: 'The living kingdom map',
    desc: `${S.time.phase}, ${S.weather}, ${seasonKey}. Level ${S.level} castle. ${S.totals.repos} repositories. ${S.goblins.count} open issues as goblins. ${S.treasure.stars} stars in the vault. ${S.visitors.total} visitor flags. ${S.events.active.map((e) => e.title).join(', ')}`.trim(),
    body: p.toString(), defs: SC.skyDefs(ph) + p.defs.join(''),
  });
}
