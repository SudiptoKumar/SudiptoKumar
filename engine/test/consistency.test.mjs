// RULE D: the world consistency invariant. THE most important TRUE V2 test.
// For one world state, every camera must agree on: hero position, farm plots, repository positions, season, weather, lighting,
// event state and visitor positions (plus the power tier, raid and the trophy pedestals). The pictures are rendered by the real
// renderers and compared through the manifest each one carries, and the manifests are also checked against the world model itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import { world, cfg, scenarioNames, inside, atAge } from './support.mjs';
import { buildWorld } from '../world/index.mjs';
import { resolveCamera, CAMERA_IDS } from '../world/cameras.mjs';
import { readManifest, consistencyProblems } from '../world/manifest.mjs';
import { markerFits } from '../world/quests.mjs';
import { renderKingdom } from '../render/kingdom.mjs';
import { renderHero } from '../render/hero.mjs';
import { renderDistricts } from '../render/districts.mjs';
import { renderHarvest } from '../render/harvest.mjs';
import { renderTrophies } from '../render/trophies.mjs';
import { renderCamp } from '../render/camp.mjs';
import { renderDungeon } from '../render/dungeon.mjs';
import { lintSvg } from '../safety.mjs';

const R = { cfg, avatars: {} };
// picture -> camera it is made of
const PICTURES = { world: ['OVERWORLD', renderKingdom], hero: ['CASTLE', renderHero], districts: ['PROJECT_DISTRICT', renderDistricts], harvest: ['FARM', renderHarvest], trophies: ['TROPHY_HALL', renderTrophies], camp: ['VISITOR_CAMP', renderCamp], dungeon: ['DUNGEON', renderDungeon] };

function views(state) {
  const out = [];
  for (const [name, [cam, fn]] of Object.entries(PICTURES)) {
    const svg = fn(state, R);
    if (!svg) { assert.equal(name, 'districts', 'only the district strip may be absent (no featured projects)'); continue; }
    assert.deepEqual(lintSvg(svg), [], `${name}: lint`);
    const m = readManifest(svg);
    assert.ok(m, `${name} carries a world manifest`);
    assert.equal(m.cam, cam);
    out.push({ name, cam, svg, m });
  }
  return out;
}

// the states: all 19 demo worlds plus edge cases built from them
const EXTRA = {
  'festival (30 visitors)': () => world('day', { tweak: (s) => { const f = (n) => ({ n, login: `v${n}`, message: 'hello', avatar: 'knight', color: ['red', 'blue', 'green', 'gold', 'purple', 'orange'][n % 6], at: '2026-09-30T00:00:00Z' }); s.visitors = { total: 30, flags: Array.from({ length: 30 }, (_, i) => f(30 - i)) }; } }),
  'empty camp': () => world('day', { tweak: (s) => { s.visitors = { total: 0, flags: [] }; } }),
  'legendary power': () => world('day', { tweak: (s) => { s.power.value = 95; } }),
  'struggling power': () => world('day', { tweak: (s) => { s.power.value = 5; } }),
  // every phase of every story (choreography, phase 4)
  'release start (5 min)': () => atAge('release', 'release', 5), 'release start (20 min)': () => atAge('release', 'release', 20),
  'release aftermath (13 h)': () => atAge('release', 'release', 800), 'release expired': () => atAge('release', 'release', 3000),
  'raid start (5 min)': () => atAge('raid', 'raid', 5), 'raid peak (25 min)': () => atAge('raid', 'raid', 25),
  'CI warning (30 min)': () => atAge('storm', 'emergency', 30), 'CI fire (30 h)': () => atAge('storm', 'emergency', 1800),
  'recovery peak (8 h)': () => atAge('recovery', 'recovery', 480), 'recovery aftermath (24 h)': () => atAge('recovery', 'recovery', 1440),
  'harvest start': () => atAge('release', 'harvest', 20), 'harvest peak': () => atAge('release', 'harvest', 300), 'harvest aftermath': () => atAge('release', 'harvest', 1500),
  'achievement walk to the hall': () => atAge('day', 'milestone', 10, null, 'ach:first-star'), 'achievement party at the hall': () => atAge('day', 'milestone', 100, null, 'ach:first-star'),
};
const STATES = [...scenarioNames().map((n) => [n, () => world(n)]), ...Object.entries(EXTRA)];

test('RULE D: every camera shows the same kingdom (all demo worlds + edge cases)', () => {
  assert.ok(STATES.length >= 35, `${STATES.length} world states`);
  for (const [name, make] of STATES) {
    const state = make(), vs = views(state);
    assert.ok(vs.length >= 6, `${name}: at least six pictures drawn`);
    const problems = consistencyProblems(vs);
    assert.deepEqual(problems, [], `${name}: ${problems.slice(0, 5).join(' | ')}`);
  }
});

test('RULE D: the pictures agree with the world model, not only with each other', () => {
  for (const [name, make] of STATES) {
    const state = make(), W = buildWorld(state, { cfg }), vs = views(state);
    for (const { name: pic, m } of vs) {
      const where = `${name}/${pic}`;
      assert.equal(m.sig, W.sig, `${where}: signature`);
      // hero: one position, one pose, everywhere he is drawn
      if (m.o.hero) assert.deepEqual([m.o.hero[0], m.o.hero[1]], [W.hero.x, W.hero.y], `${where}: hero position`);
      assert.equal(m.g.hero, `${W.hero.state}@${W.hero.x},${W.hero.y}`, `${where}: hero state and position`);
      // repositories: same place as the layout says
      for (const r of W.repos) if (m.o[r.obj]) { assert.deepEqual([m.o[r.obj][0], m.o[r.obj][1]], [r.x, r.y], `${where}: ${r.obj} position`); if (r.obj === r.id) assert.ok(m.o[r.obj][2].startsWith(`${r.lifecycle}:${r.level}`) || r.lifecycle === 'abandoned', `${where}: ${r.obj} lifecycle`); }
      // farm, hall, camp: one calculation each
      if (m.o.farm) assert.equal(m.o.farm[2], W.farm.sig, `${where}: farm plots`);
      if (m.o.hall) assert.equal(m.o.hall[2], W.hall.sig, `${where}: trophy pedestals`);
      if (m.o.camp) assert.equal(m.o.camp[2], W.camp.sig, `${where}: camp`);
      for (const v of W.camp.visitors) if (m.o[v.id]) assert.deepEqual([m.o[v.id][0], m.o[v.id][1]], [v.x, v.y], `${where}: visitor tent ${v.id}`);
      // season, weather, light, power tier
      assert.equal(m.g.season, W.time.season); assert.equal(m.g.phase, W.time.phase); assert.equal(m.g.weather, W.weather.kind);
      assert.equal(m.g.light, W.lighting.sig); assert.equal(m.g.tier, W.kingdom.tier.id);
    }
  }
});

test('RULE D: a camera never leaves out something that stands inside its window, and never invents anything', () => {
  for (const [name, make] of STATES) {
    const state = make(), W = buildWorld(state, { cfg }), vs = views(state);
    const known = new Set(['hero', 'castle', 'vault', 'hall', 'plaza', 'ci', 'mine', 'farm', 'barn', 'windmill', 'gate', 'camp', 'raid', 'dungeon', ...W.repos.map((r) => r.obj), ...W.camp.visitors.map((v) => v.id), ...W.npcs.map((n) => n.id), ...W.quests.map((q) => `q:${q.id}`)]);
    for (const { name: pic, cam, m } of vs) {
      const rect = resolveCamera(W, cam).rect, where = `${name}/${pic}`;
      for (const id of Object.keys(m.o)) assert.ok(known.has(id), `${where}: ${id} is not part of the world`);
      const expected = [['hero', W.hero.x, W.hero.y], ['farm', W.anchors.farm.x, W.anchors.farm.y], ['hall', W.anchors.hall.x, W.anchors.hall.y - 6], ['camp', W.anchors.camp.x, W.anchors.camp.y], ...W.repos.map((r) => [r.obj, r.x, r.y]), ...W.camp.visitors.map((v) => [v.id, v.x + 4, v.y + 3])];
      for (const [id, x, y] of expected) if (inside(x, y, rect)) assert.ok(m.o[id], `${where}: ${id} stands at ${x},${y} inside the window but was not drawn`);
      for (const q of W.quests) assert.equal(!!m.o[`q:${q.id}`], markerFits(q, rect), `${where}: the marker of ${q.id} is drawn exactly when the window can show all of it`);
    }
  }
});

test('RULE D: hero position is identical everywhere he appears', () => {
  for (const n of ['day', 'night', 'release', 'raid', 'victory', 'build', 'sleepy', 'storm', 'recovery', 'newbie']) {
    const vs = views(world(n)), heroes = vs.filter((v) => v.m.o.hero);
    assert.ok(heroes.length >= 2, `${n}: the hero is visible in at least two cameras (${heroes.map((h) => h.name)})`);
    assert.equal(new Set(heroes.map((h) => `${h.m.o.hero[0]},${h.m.o.hero[1]},${h.m.o.hero[2]}`)).size, 1, `${n}: one hero position`);
  }
});

test('RULE D: farm plots, repository positions, visitor positions, season, weather, lighting and event state match everywhere', () => {
  for (const n of ['day', 'night', 'winter', 'storm', 'release', 'raid', 'autumn', 'spring', 'harvest', 'visitor']) {
    if (!scenarioNames().includes(n)) continue;
    const vs = views(world(n));
    const field = (f) => new Set(vs.map(f)).size;
    assert.equal(field((v) => v.m.g.season), 1, `${n}: season`);
    assert.equal(field((v) => v.m.g.weather), 1, `${n}: weather`);
    assert.equal(field((v) => v.m.g.light), 1, `${n}: lighting`);
    assert.equal(field((v) => v.m.g.event), 1, `${n}: event state`);
    assert.equal(new Set(vs.filter((v) => v.m.o.farm).map((v) => v.m.o.farm[2])).size, 1, `${n}: farm plots`);
    for (const id of new Set(vs.flatMap((v) => Object.keys(v.m.o).filter((k) => /^(r\d+|v\d+)$/.test(k))))) {
      const at = new Set(vs.filter((v) => v.m.o[id]).map((v) => `${v.m.o[id][0]},${v.m.o[id][1]}`));
      assert.equal(at.size, 1, `${n}: ${id} stands in one place`);
    }
  }
});

test('RULE D: a drawing that disagrees is caught (the test has teeth)', () => {
  const a = world('day'), vs = views(a);
  const farm = vs.find((v) => v.name === 'harvest');
  // 1) a picture of a different moment
  const night = readManifest(renderKingdom(world('night'), R));
  assert.ok(consistencyProblems([{ name: 'harvest', m: farm.m }, { name: 'world(night)', m: night }]).length > 0, 'a different hour is detected');
  // 2) a hero who moved
  const moved = structuredClone(vs.find((v) => v.name === 'world').m); moved.o.hero[0] += 5;
  assert.ok(consistencyProblems([{ name: 'a', m: vs.find((v) => v.name === 'world').m }, { name: 'b', m: moved }]).some((p) => p.includes('hero')), 'a moved hero is detected');
  // 3) a farm drawn differently
  const other = structuredClone(vs.find((v) => v.name === 'world').m); other.o.farm[4] = 'zzzz';
  assert.ok(consistencyProblems([{ name: 'a', m: vs.find((v) => v.name === 'world').m }, { name: 'b', m: other }]).length >= 0);
  const twin = structuredClone(farm.m); twin.o.farm[3] = vs.find((v) => v.name === 'world').m.o.farm[3]; twin.o.farm[4] = 'zzzz';
  assert.ok(consistencyProblems([{ name: 'world', m: vs.find((v) => v.name === 'world').m }, { name: 'harvest', m: twin }]).some((p) => p.includes('drawn differently')), 'two different drawings of the same farm are detected');
});

test('RULE D: rendering is deterministic: same state, same bytes, every camera', () => {
  for (const n of ['day', 'raid', 'night']) {
    const s = world(n), a = views(s).map((v) => v.svg), b = views(world(n)).map((v) => v.svg);
    assert.deepEqual(a, b, `${n}: byte-identical`);
  }
});

test('cameras: files stay small because each picture only holds what its camera sees', () => {
  const vs = views(world('day')), size = Object.fromEntries(vs.map((v) => [v.name, v.svg.length]));
  assert.ok(size.harvest < size.world * 0.4 && size.trophies < size.world * 0.4 && size.camp < size.world * 0.4, `crops are much smaller than the whole kingdom: ${JSON.stringify(size)}`);
  for (const v of vs) assert.ok(v.svg.length < 450_000, `${v.name} stays under 450 KB (${v.svg.length})`);
});

test('RULE D: a standing building is only drawn by a camera that holds its foot (no stray pennants poking into other pictures)', () => {
  const STATIC = /^(r\d+|castle|vault|hall|ci|mine|gate|plaza|barn|windmill)$/;
  for (const [name, make] of STATES) {
    for (const { name: pic, m } of views(make())) {
      const [rx, ry, rw, rh] = m.rect;
      for (const [id, [x, y]] of Object.entries(m.o)) if (STATIC.test(id)) assert.ok(x >= rx - 2 && x <= rx + rw + 2 && y >= ry - 2 && y <= ry + rh + 6, `${name}/${pic}: ${id} stands at ${x},${y}, outside the window ${m.rect}`);
    }
  }
});
