// The living kingdom (V2): one picture that holds the whole world. Everything on it comes from state + state.scene.
// Layers, back to front: sky - mountains - ground - underground - buildings and trees (sorted by depth) - people -
// raid - hero - weather - light - the few words allowed on the map.
//
// TRUE V2: paintWorld is the ONE shared drawing pipeline. Every spatial camera (overworld, hero, event, castle,
// dungeon, visitor camp) paints this same world and shows it through a different viewBox window — see camera.mjs.
import { Pix, svgDoc, textW } from './pixel.mjs';
import { C, SEASONS } from './palette.mjs';
import { ICON } from './sprites.mjs';
import * as SC from './scenery.mjs';
import { T } from './ui.mjs';
import { rng } from '../util.mjs';
import { GW, GH, U, L, GROUND_Y, assignRepos } from './kingdom-layout.mjs';
import { drawSky, drawMountains, drawGround, drawSeasonDecor, drawUnderground } from './kingdom-world.mjs';
import { drawProsperity } from './prosperity.mjs';
import { drawV3Districts } from './v3-districts.mjs';
import { drawPlaces } from './kingdom-places.mjs';
import { drawPeople, drawHero, drawRaid, drawWeather } from './kingdom-life.mjs';
import { lightLayer } from './light.mjs';

/** The only words that may appear on the map, decided by the scene. Everything else is drawn, not written. */
export function mapLabels(S) {
  const lb = S.scene.labels, out = [];
  if (lb.ci) out.push({ id: 'ci', text: 'CI ALERT', color: T.red, at: [L.ci[0], L.ci[1] + 4] });
  if (lb.issues) out.push({ id: 'issues', text: `ISSUES ${lb.issues}`, color: lb.issues > 5 ? T.red : T.orange, at: [L.gate[0], L.gate[1] - 26] });
  if (lb.raid) out.push({ id: 'raid', text: `DEFENSE ${S.raid.defense}%`, color: S.raid.defense >= S.raid.attack ? T.green : T.orange, at: [L.gate[0], 166], bar: S.raid.defense });
  if (lb.event) { const ev = S.events.active.find((e) => e.type === lb.event); if (ev) out.push({ id: 'event', text: ev.title, color: lb.event === 'release' ? T.gold : T.red, at: [GW / 2, 12], icon: ev.icon }); }
  return out;
}

/** Paint the whole world and return its body + defs (no words; those are an overlay). Shared by every camera. */
export function paintWorld(S, rctx = {}) {
  const p = new Pix(U);
  const scene = S.scene;
  const ph = S.time.phase, seasonKey = S.time.season, SE = SEASONS[seasonKey];
  const wx = scene.weather, night = ph === 'night', stormy = wx.kind === 'storm' || wx.kind === 'thunderstorm';
  const K = {
    p, S, scene, ph, seasonKey, SE, night, stormy, winter: seasonKey === 'winter', wet: wx.wet, cfg: rctx.cfg || {},
    lit: scene.light.windows, rnd: rng('world:' + S.profile.login), fx: rng('fx:' + S.profile.login),
    lights: [], danger: [], spots: [], objs: [], blocked: [],
  };
  K.bctx = { lights: K.lights, danger: K.danger };
  K.place = (z, fn) => K.objs.push({ z, fn });
  K.solid = (x, y, w, h) => K.blocked.push([x, y, w, h]);
  K.free = (x, y, m = 0) => !K.blocked.some(([bx, by, bw, bh]) => x >= bx - m && x <= bx + bw + m && y >= by - m && y <= by + bh + m);
  K.sym = (id, spr, s, pal) => { p.symbol(id, (q) => q.sprite(spr, 0, 0, { s, pal })); return id; };

  const layout = assignRepos(S.repos);
  drawSky(K);
  drawMountains(K);
  drawGround(K);
  drawUnderground(K);
  drawPlaces(K, layout);
  drawProsperity(K);   // TRUE V2 (Phase 6): power tier changes the visible world
  drawV3Districts(K);  // TRUE V3: war front, builder's yard, hero guild, harbor
  drawSeasonDecor(K);
  K.objs.sort((a, b) => a.z - b.z).forEach((o) => o.fn());
  drawPeople(K, layout);
  drawRaid(K);
  drawHero(K);
  drawWeather(K);

  // ---------------------------------------------------------------- light and mood
  // TRUE V2 (Phase 4): one shared lighting policy. Every camera reads the same
  // world.lighting — no per-renderer tint/aurora/wash copies.
  const LGT = S.world.lighting;
  if (scene.light.accent === 'repair') for (const n of scene.light.repair) { const q = layout.placed.find((r) => r.repo.name === n); if (q) K.spots.push({ x: q.x, y: q.y - 12, r: 14, color: '#a7f070', op: 0.55 }); }
  if (scene.light.accent === 'celebrate' || scene.fx.includes('castleLights')) K.spots.push({ x: L.castle[0], y: L.castle[1] - 26, r: 34, color: '#ffcd75', pulse: true, op: 0.55 });
  if (LGT.aurora > 0) { K.spots.push({ x: 88, y: 60, r: 70, color: '#5dffb0', op: 0.1 * LGT.aurora }); K.spots.push({ x: 40, y: 150, r: 60, color: '#73eff7', op: 0.07 * LGT.aurora }); K.spots.push({ x: 140, y: 150, r: 60, color: '#b48cf0', op: 0.06 * LGT.aurora }); }
  for (const n of scene.light.danger) { const q = layout.placed.find((r) => r.repo.name === n); if (q) K.danger.push({ x: q.x, y: q.y - 12, r: 16, strong: scene.stages.fail[n] !== 'warning' }); }
  lightLayer(p, { W: GW, H: GH, tint: [LGT.tint.color, LGT.tint.alpha], lights: K.lights, danger: K.danger, spots: K.spots, moon: LGT.moon, under: { y0: GROUND_Y, color: '#0a0610', alpha: 0.38 } });
  if (LGT.wash.alpha > 0) p.raw(`<rect width="${GW * U}" height="${GROUND_Y * U}" fill="${LGT.wash.color}" opacity="${LGT.wash.alpha}"/>`);

  return { w: GW * U, h: GH * U, body: p.toString(), defs: SC.skyDefs(ph) + p.defs.join('') };
}

/** The few words allowed on the map, drawn on their own canvas (1 unit = 1 SVG unit).
 *  TRUE V2: event chips are gone — events live in the Primary Event camera now, not duplicated on the map. */
export function paintMapHud(S) {
  const scene = S.scene, ph = S.time.phase, seasonKey = S.time.season, wx = scene.weather;
  const h = new Pix(1), WW = GW * U;
  const tod = ph === 'night' ? 'moon' : 'sun';
  const kind = wx.kind === 'thunderstorm' ? 'bolt' : wx.kind === 'storm' || wx.kind === 'rain' ? 'rain' : wx.kind === 'aurora' ? 'wave' : tod;
  const seasonIcon = { spring: 'flower', summer: 'sprout', autumn: 'leaf', winter: 'snow' }[seasonKey];
  h.r(8, 8, 76, 36, '#14162b', 0.78).r(8, 8, 76, 3, T.gold);
  h.sprite(ICON[kind], 14, 15, { s: 3 }).sprite(ICON[seasonIcon], 50, 15, { s: 3 });
  if (S.meta.demo) h.r(WW - 196, 8, 188, 34, '#b13e53').text('DEMO DATA', WW - 102, 17, 3, T.white, { align: 'c' });
  for (const lb of mapLabels(S)) {
    const s = 3, w = textW(lb.text, s) + (lb.icon ? 36 : 14), x = Math.round(lb.at[0] * U - w / 2), y = Math.round(lb.at[1] * U);
    h.r(x, y, w, 7 * s + 12, '#14162b', 0.9).r(x, y, w, 3, lb.color);
    let tx = x + 7;
    if (lb.icon) { h.raw('<g class="fl">').sprite(ICON[lb.icon] || ICON.star, x + 7, y + 7, { s: 2.5 }).raw('</g>'); tx += 28; }
    h.text(lb.text, tx, y + 8, s, lb.color === T.red ? '#ff9a9a' : lb.color);
    if (lb.bar != null) h.r(x + 6, y + 7 * s + 6, w - 12, 5, '#0e1024').r(x + 6, y + 7 * s + 6, Math.round(((w - 12) * lb.bar) / 100), 5, lb.color);
  }
  return h.toString();
}

export function renderKingdom(S, rctx = {}) {
  const scene = S.scene, ph = S.time.phase, seasonKey = S.time.season, wx = scene.weather;
  const { w, h, body, defs } = paintWorld(S, rctx);
  return svgDoc({
    w, h, title: 'The living kingdom',
    desc: `${ph}, ${wx.kind}, ${seasonKey}. Scene: ${scene.mode.toLowerCase()}. The hero is ${scene.hero.state}. Level ${S.level} castle with ${S.totals.repos} repositories as buildings. ${S.goblins.count} open issues as goblins. ${S.treasure.stars} stars in the vault. ${S.visitors.total} visitor flags. ${scene.hud.map((c) => `${c.kind} ${c.text}`).join(', ')}`.trim(),
    body: body + paintMapHud(S), defs,
  });
}
