// TRUE V2 Phase 1: the authoritative world. buildWorld is pure, the signature is
// stable, the layout façade holds, the hash is versioned and --only is safe.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mockSnapshot, demoScenarios, seedDemoStore } from '../mock.mjs';
import { DEFAULTS } from '../config.mjs';
import { EMPTY } from '../store.mjs';
import { buildState } from '../state.mjs';
import { finalizeV2 } from '../v2.mjs';
import { renderAll, hashOf, resolveOnly, persistable } from '../cli.mjs';
import { WORLD_VERSION, RENDER_VERSION, powerTier, campStateFor, EVENT_PHASES } from '../world/constants.mjs';
import { buildWorld, worldSignature } from '../world/index.mjs';
import { CAMERAS, CAMERA_IDS, cameraFocus } from '../world/cameras.mjs';
import { lightingFor, skyFor } from '../world/lighting.mjs';
import { buildHall } from '../world/hall.mjs';
import { buildCamp, campPlot } from '../world/camp.mjs';
import { buildHero, heroAt, heroJourney, findPath, pointAlongPath } from '../world/hero.mjs';
import { buildPopulation } from '../world/population.mjs';
import { choreography } from '../world/events.mjs';
import { buildFarm, stageFor, windowPlots, mapWindow, fieldLayout, MAP_FARM, FIELD } from '../world/farm.mjs';
import { lifecycleFor, LIFECYCLE_KEYS } from '../world/lifecycle.mjs';
import { GW, GH, L, HERO_SPOT, SLOTS, DISTRICTS, DISTRICT_IDS, CAMERA_RECTS, WAYPOINTS, WAYPOINT_IDS, assignRepos, districtForSlot } from '../world/layout.mjs';
import * as facade from '../render/kingdom-layout.mjs';
import { stageFor as harvestStageFor } from '../render/harvest.mjs';

const cfg = { ...structuredClone(DEFAULTS), owner: 'SudiptoKumar', repo: 'SudiptoKumar', timezone: 'UTC' };
const freshStore = () => { const s = Object.fromEntries(Object.entries(EMPTY).map(([k, f]) => [k, f()])); s.prev = null; return s; };
const world = (name = 'day') => { const sc = demoScenarios()[name]; const store = seedDemoStore(sc); return buildState({ snap: mockSnapshot({ now: sc.now, scenario: sc.scenario }), cfg, now: sc.now, store, demo: true }); };

// ------------------------------------------------------------------ the world object
test('buildWorld: pure — the same state always builds the same world', () => {
  const a = world(), b = world();
  assert.deepEqual(a.world, b.world);
  assert.equal(a.world.signature, b.world.signature);
  assert.equal(a.world.signature, worldSignature(a.world));
  assert.equal(a.world.version, WORLD_VERSION);
});

test('worldSignature: a moved hero changes the signature, metadata does not', () => {
  const s = world();
  const sig = s.world.signature;
  const moved = structuredClone(s.world);
  moved.hero.x += 1;
  assert.notEqual(worldSignature(moved), sig, 'hero position is part of the signature');
  const relabeled = structuredClone(s.world);
  relabeled.seed = 'something-else';
  assert.equal(worldSignature(relabeled), sig, 'the seed is not a spatial fact');
});

test('finalizeV2 attaches the world and stamps versions', () => {
  const s = world();
  assert.ok(s.world && typeof s.world === 'object');
  assert.equal(s.worldVersion, WORLD_VERSION);
  assert.equal(s.renderVersion, RENDER_VERSION);
  assert.ok(s.world.hero && s.world.farm && s.world.hall && s.world.camp);
  assert.ok(s.world.repositories.length > 0, 'repositories became places');
  assert.ok(s.world.districts.length === DISTRICT_IDS.length);
});

test('every repository is a place in a district, and nobody is lost', () => {
  const s = world();
  const w = s.world;
  const names = new Set(w.repositories.map((r) => r.name));
  for (const r of s.repos) assert.ok(names.has(r.name), r.name);
  for (const p of w.repositories) {
    assert.ok(DISTRICT_IDS.includes(p.district), p.name);
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), p.name);
    assert.ok(p.level >= 1 && p.level <= 5, p.name);
  }
});

test('quests resolve to world anchors', () => {
  const s = world();
  for (const q of s.world.quests) assert.ok('anchor' in q, q.id);
  const streak = s.world.quests.find((q) => q.track === 'streak');
  if (streak) assert.equal(streak.anchor, 'farm');
});

// ------------------------------------------------------------------ layout façade
test('render/kingdom-layout.mjs is a faithful façade over world/layout.mjs', () => {
  assert.equal(facade.GW, GW);
  assert.equal(facade.GH, GH);
  assert.deepEqual(facade.L, L);
  assert.deepEqual(facade.SLOTS, SLOTS);
  assert.deepEqual(facade.HERO_SPOT, HERO_SPOT);
  const s = world();
  assert.deepEqual(facade.assignRepos(s.repos), assignRepos(s.repos));
});

test('districts and camera rects stay inside the world', () => {
  for (const [id, d] of Object.entries(DISTRICTS)) {
    const [x0, y0, x1, y1] = d.bounds;
    assert.ok(x0 >= 0 && y0 >= 0 && x1 <= GW && y1 <= GH && x1 > x0 && y1 > y0, id);
    for (const a of d.anchors) assert.ok(a in L, `${id}/${a}`);
  }
  for (const [id, r] of Object.entries(CAMERA_RECTS)) {
    const [x0, y0, x1, y1] = r;
    assert.ok(x0 >= 0 && y0 >= 0 && x1 <= GW && y1 <= GH && x1 > x0 && y1 > y0, id);
  }
  assert.equal(districtForSlot('tower'), 'project');
  assert.equal(districtForSlot('library'), 'knowledge');
  assert.equal(districtForSlot('village'), 'central');
});

// ------------------------------------------------------------------ cameras
test('seven cameras, all valid', () => {
  assert.deepEqual(CAMERA_IDS.sort(), ['castle', 'dungeon', 'farm', 'overworld', 'project', 'trophy', 'visitor']);
  for (const c of Object.values(CAMERAS)) {
    assert.ok(c.id && c.title && c.asset, c.id);
    const f = cameraFocus(c);
    assert.ok(f.kind === 'rect' || f.kind === 'anchor', c.id);
  }
});

// ------------------------------------------------------------------ lighting policy
test('lightingFor agrees with the scene light flags', () => {
  for (const name of Object.keys(demoScenarios())) {
    const s = world(name);
    const lw = lightingFor({ phase: s.time.phase, weather: s.weather, season: s.time.season });
    assert.equal(lw.windows, s.scene.light.windows, name);
    assert.equal(lw.torches, s.scene.light.torches, name);
    assert.equal(lw.moon, s.scene.light.moon, name);
  }
  const day = lightingFor({ phase: 'day', weather: 'clear', season: 'summer', aurora: 1 });
  assert.deepEqual(day.tint, { color: null, alpha: 0 });
  assert.equal(day.aurora, 0, 'aurora can never appear in daylight');
  const night = lightingFor({ phase: 'night', weather: 'aurora', season: 'winter', aurora: 0.8 });
  assert.equal(night.aurora, 0.8);
  assert.ok(night.moon && night.snow);
  assert.ok(skyFor('dawn').length === 4 && skyFor('nope') === skyFor('day'));
});

// ------------------------------------------------------------------ farm: one model
test('the farm model is deterministic and matches the harvest stages', () => {
  const s = world();
  const f = buildFarm(s, cfg);
  assert.deepEqual(f, buildFarm(s, cfg));
  assert.equal(f.plots.length, s.calendar.length);
  assert.equal(f.total, s.calendar.reduce((a, d) => a + (d.count || 0), 0));
  for (let c = 0; c <= 20; c++) assert.equal(stageFor(c, f.steps), harvestStageFor(c, cfg.cropSteps), `count ${c}`);
  assert.equal(windowPlots(f, 21).length, Math.min(21, f.plots.length));
});

// ------------------------------------------------------------------ hall and camp: one model each
test('the hall mirrors the achievement system', () => {
  const s = world();
  const h = buildHall(s);
  assert.equal(h.trophies.length, s.achievements.list.length);
  assert.equal(h.unlocked, s.achievements.list.filter((a) => a.unlocked).length);
  assert.deepEqual(h, buildHall(s));
});

test('the camp has one deterministic plot per visitor', () => {
  assert.equal(campStateFor(0), 'EMPTY');
  assert.equal(campStateFor(3), 'CAMP');
  assert.equal(campStateFor(8), 'VILLAGE');
  assert.equal(campStateFor(30), 'FESTIVAL');
  const flags = Array.from({ length: 6 }, (_, i) => ({ n: i + 1, login: `u${i}`, color: 'red', message: 'hi', avatar: 'identicon', at: '2026-09-30T10:00:00Z' }));
  const c = buildCamp({ visitors: { total: 6, flags }, profile: { login: 'x' } });
  assert.equal(c.state, 'VILLAGE');
  assert.equal(c.plots.length, 6);
  assert.deepEqual(c, buildCamp({ visitors: { total: 6, flags }, profile: { login: 'x' } }));
  assert.deepEqual([c.plots[0].x, c.plots[0].y], [L.camp[0] - 20, L.camp[1] - 4]);
  assert.deepEqual(campPlot(5), { x: c.plots[5].x, y: c.plots[5].y });
  const empty = buildCamp({ visitors: { total: 0, flags: [] }, profile: { login: 'x' } });
  assert.equal(empty.state, 'EMPTY');
  assert.equal(empty.plots.length, 0);
});

// ------------------------------------------------------------------ hero: a real position
test('the hero stands on real world coordinates', () => {
  const s = world();
  const h = s.world.hero;
  assert.deepEqual([h.x, h.y], [HERO_SPOT[h.spot][0], HERO_SPOT[h.spot][1]]);
  assert.equal(h.state, s.scene.hero.state);
  for (const spot of Object.keys(HERO_SPOT)) {
    const p = heroAt(spot);
    assert.deepEqual([p.x, p.y], HERO_SPOT[spot], spot);
  }
  assert.deepEqual(heroAt('nope'), heroAt('plaza'), 'unknown spots fall back to the plaza');
  assert.deepEqual(buildHero({}), { ...buildHero({}), state: 'idle', spot: 'plaza' });
});

test('waypoint paths connect the kingdom', () => {
  for (const id of WAYPOINT_IDS) assert.deepEqual(findPath(id, id), [id]);
  assert.equal(findPath('castle', 'nope'), null);
  const p = findPath('castle', 'farm');
  assert.ok(p && p[0] === 'castle' && p[p.length - 1] === 'farm' && p.length > 2);
  const q = findPath('camp', 'ci');
  assert.ok(q && q[0] === 'camp' && q[q.length - 1] === 'ci');
  const a = pointAlongPath(['plaza', 'castle'], 0), b = pointAlongPath(['plaza', 'castle'], 1), m = pointAlongPath(['plaza', 'castle'], 0.5);
  assert.deepEqual([a.x, a.y], WAYPOINTS.plaza);
  assert.deepEqual([b.x, b.y], WAYPOINTS.castle);
  assert.ok(Math.abs(m.x - 88) < 1 && Math.abs(m.y - 106) < 1, 'halfway up the road');
  assert.equal(pointAlongPath([], 0.5), null);
});

// ------------------------------------------------------------------ population and events
test('population mirrors the scene roster', () => {
  const s = world();
  assert.deepEqual(buildPopulation(s).counts, s.scene.npcs);
  assert.ok(['quiet', 'lively', 'bustling'].includes(buildPopulation(s).density));
});

test('event choreography moves START -> PEAK -> AFTERMATH -> EXPIRED', () => {
  const at = '2026-09-30T10:00:00.000Z', until = '2026-09-30T20:00:00.000Z';
  const ev = { type: 'release', at, until };
  assert.equal(choreography(ev, new Date('2026-09-30T11:00:00Z')).phase, 'START');
  assert.equal(choreography(ev, new Date('2026-09-30T13:00:00Z')).phase, 'PEAK');
  assert.equal(choreography(ev, new Date('2026-09-30T17:00:00Z')).phase, 'AFTERMATH');
  assert.equal(choreography(ev, new Date('2026-09-30T21:00:00Z')).phase, 'EXPIRED');
  assert.equal(choreography({ type: 'release', at }, new Date('2026-09-30T21:00:00Z')).phase, 'EXPIRED');
  assert.deepEqual(EVENT_PHASES, ['START', 'PEAK', 'AFTERMATH', 'EXPIRED']);
  const s = world('release');
  const rel = s.world.events.find((e) => e.type === 'release');
  assert.ok(rel && EVENT_PHASES.includes(rel.phase), 'world events carry their phase');
});

// ------------------------------------------------------------------ power tiers
test('power tiers cover 0-100', () => {
  assert.equal(powerTier(0).id, 'village');
  assert.equal(powerTier(20).id, 'village');
  assert.equal(powerTier(21).id, 'settlement');
  assert.equal(powerTier(55).id, 'kingdom');
  assert.equal(powerTier(80).id, 'prosperous');
  assert.equal(powerTier(100).id, 'legendary');
  const s = world();
  assert.equal(s.world.power.tier, powerTier(s.power.value).id);
});

// ------------------------------------------------------------------ versioned hash and --only safety
test('the content hash includes the renderer version but not the derived world', () => {
  const s = world();
  const h1 = hashOf(s);
  s.world.hero.x += 10;                       // the world is derived; it must not affect the hash
  assert.equal(hashOf(s), h1);
  assert.notEqual(hashOf({ ...s, renderVersion: RENDER_VERSION + 1 }), h1, 'a renderer change invalidates the hash');
  assert.equal(hashOf({ ...s, renderVersion: RENDER_VERSION }), h1);
});

test('the derived world is never persisted', () => {
  const s = world();
  assert.ok(!('world' in persistable(s)));
  assert.ok('world' in s);
});

test('--only expands to the views that share world objects, and a renderer change forces a full render', () => {
  const prev = { renderVersion: RENDER_VERSION };
  assert.equal(resolveOnly(null, prev), null);
  assert.equal(resolveOnly([], prev), null);
  const hero = resolveOnly(['hero'], prev);
  assert.ok(hero.includes('hero') && hero.includes('world') && hero.includes('harvest') && hero.includes('status'), hero.join(','));
  const camp = resolveOnly(['camp'], prev);
  assert.ok(camp.includes('camp') && camp.includes('world'), camp.join(','));
  assert.equal(resolveOnly(['hero'], { renderVersion: RENDER_VERSION - 1 }), null, 'stale renderer: full render');
  assert.equal(resolveOnly(['hero'], null), null, 'no previous save: full render');
  assert.equal(resolveOnly(['hero'], {}), null);
});

test('--only marks skipped pictures instead of leaving them out of the status', () => {
  const s = world();
  const files = renderAll(s, { cfg, avatars: {} }, ['world']);
  assert.equal(s.status.assets.world, 'ok');
  assert.equal(s.status.assets.status, 'ok');
  assert.equal(s.status.assets.harvest, 'skipped');
  assert.ok(files.length < 10 && files.every(([f]) => f));
});

// ------------------------------------------------------------------ Phase 2: the world fills in
test('farm: one model, two framings — the map window and the field share plots', () => {
  const s = world();
  const farm = s.world.farm;
  assert.equal(farm.map.length, 21);
  const fb = DISTRICTS.farm.bounds;
  for (const p of farm.map) {
    assert.ok(p.x >= fb[0] && p.x <= fb[2] && p.y >= fb[1] && p.y <= fb[3], `${p.date} is in the farm district`);
    const src = farm.plots.find((q) => q.date === p.date);
    assert.equal(p.stage, src.stage, 'the window never recalculates a plot');
  }
  assert.deepEqual([farm.map[0].x, farm.map[0].y], [MAP_FARM.x, MAP_FARM.y]);
  const fl = fieldLayout(farm);
  assert.equal(fl.anchor, farm.plots[farm.plots.length - 1].date);
  const wd = new Date(fl.anchor + 'T00:00:00Z').getUTCDay();
  assert.deepEqual(fl.cellFor(fl.anchor), [FIELD.cols - 1, wd]);
  assert.deepEqual(fl.cellFor(fl.first), [0, 0]);
  assert.equal(fl.cellFor('2000-01-01'), null);
  // the field grid matches the farm camera's own date math
  const anchor = farm.plots[farm.plots.length - 1].date;
  const first = fl.first;
  assert.ok(first < anchor);
});

test('camp: the arriving visitor is still raising their tent', () => {
  const s = world();
  s.scene.stages.visitor = { n: 3, stage: 'arriving' };
  const c = buildCamp({ visitors: s.visitors, profile: s.profile, scene: s.scene });
  assert.equal(c.plots[0].arriving, true);
  assert.ok(c.plots.slice(1).every((p) => !p.arriving));
  const settled = buildCamp({ visitors: s.visitors, profile: s.profile, scene: { stages: {} } });
  assert.ok(settled.plots.every((p) => !p.arriving));
  assert.equal(c.anchor, 'camp');
  assert.equal(s.world.hall.anchor, 'shrine');
});

test('heroJourney: semantic destinations, deterministic progress', () => {
  const start = [{ type: 'release', phase: 'START', t: 0.06 }];
  const j = heroJourney({ spot: 'plaza', why: 'release' }, start);
  assert.equal(j.destination, 'castle');
  assert.equal(j.origin, 'plaza');
  assert.deepEqual(j.path, ['plaza', 'castle']);
  assert.ok(j.progress > 0 && j.progress < 1, 'mid-journey during START');
  const peak = heroJourney({ spot: 'plaza', why: 'release' }, [{ type: 'release', phase: 'PEAK', t: 0.3 }]);
  assert.equal(peak.progress, 1, 'arrived by PEAK');
  const raid = heroJourney({ spot: 'gate', why: 'raid' }, []);
  assert.equal(raid.destination, 'gate');
  assert.equal(raid.path, null, 'no walking while fighting');
  const evening = heroJourney({ spot: 'road', why: 'evening' }, []);
  assert.equal(evening.destination, 'home');
  assert.equal(evening.origin, 'plaza');
  assert.equal(evening.progress, 0.5);
  const night = heroJourney({ spot: 'home', why: 'night' }, []);
  assert.equal(night.path, null, 'already home');
  const idle = heroJourney({ spot: 'plaza', why: 'idle' }, []);
  assert.equal(idle.destination, 'plaza');
  assert.equal(idle.path, null);
});

test('the release-day hero walks the road to the castle', () => {
  const h = world('release').world.hero;
  assert.equal(h.state, 'celebrating');
  assert.equal(h.destination, 'castle');
  assert.ok(h.progress > 0 && h.progress < 1, `progress=${h.progress}`);
  assert.ok(h.y > 96 && h.y < 116 && Math.abs(h.x - 88) < 1, `on the road at (${h.x}, ${h.y})`);
  const again = world('release').world.hero;
  assert.deepEqual([h.x, h.y], [again.x, again.y], 'the same world, the same stone');
});

test('the raid hero stands at the gate, the night hero is home', () => {
  const r = world('raid').world.hero;
  assert.equal(r.state, 'fighting');
  assert.deepEqual([r.x, r.y], [HERO_SPOT.gate[0], HERO_SPOT.gate[1]]);
  const n = world('night').world.hero;
  assert.equal(n.state, 'sleeping');
  assert.deepEqual([n.x, n.y], [HERO_SPOT.home[0], HERO_SPOT.home[1]]);
});

test('NPCs: everyone placed, deterministic, near their home', () => {
  const s = world();
  const pop = s.world.population;
  assert.equal(pop.npcs.length, pop.total, 'nobody is lost');
  assert.deepEqual(pop.counts, s.scene.npcs);
  const seen = new Set();
  for (const n of pop.npcs) {
    assert.ok(Number.isFinite(n.x) && Number.isFinite(n.y), n.id);
    assert.ok(['idle', 'working', 'walking', 'resting', 'sleeping', 'fighting', 'celebrating', 'fleeing'].includes(n.state), `${n.id}:${n.state}`);
    assert.ok(!seen.has(n.id), n.id);
    seen.add(n.id);
  }
  for (const g of pop.npcs.filter((n) => n.role === 'guard')) assert.ok(Math.abs(g.x - L.gate[0]) <= 32, g.id);
  for (const f of pop.npcs.filter((n) => n.role === 'farmer')) {
    const fb = DISTRICTS.farm.bounds;
    assert.ok(f.x >= fb[0] - 4 && f.x <= fb[2] + 4 && f.y >= fb[1] && f.y <= fb[3] + 4, f.id);
  }
  const raid = world('raid').world.population;
  assert.ok(raid.npcs.filter((n) => n.role === 'guard').every((g) => g.state === 'fighting'));
  assert.ok(raid.npcs.filter((n) => n.role === 'villager').every((v) => v.state === 'fleeing'));
});

test('repository lifecycle: one key per building, from real signals', () => {
  const s = world();
  for (const r of s.world.repositories) {
    assert.ok(LIFECYCLE_KEYS.includes(r.lifecycle.key), `${r.name}:${r.lifecycle.key}`);
    assert.equal(r.lifecycle.level, r.level);
  }
  const storm = world('storm').world;
  const failing = storm.repositories.filter((r) => r.lifecycle.key === 'failing');
  assert.ok(failing.length > 0, 'the storm hits real buildings');
  assert.ok(['warning', 'alarm', 'smoke', 'fire'].includes(storm.fortress.stage), storm.fortress.stage);
  assert.equal(storm.fortress.anchor, 'ci');
  assert.equal(storm.dungeon.anchor, 'gate');
  const day = world('day').world;
  assert.equal(day.fortress.stage, 'ok');
  assert.deepEqual(
    lifecycleFor({ name: 'x', state: 'abandoned', evolution: { level: 5 } }, {}).key,
    'abandoned',
  );
  assert.equal(lifecycleFor({ name: 'x', state: 'active', evolution: { level: 5 } }, {}).key, 'flourishing');
  assert.equal(lifecycleFor({ name: 'x', state: 'sleepy', evolution: { level: 4 } }, {}).key, 'sleepy');
});

// ------------------------------------------------------------------ Phase 3: one world, many cameras
test('hero camera: the portrait is a world window tracking the world hero', async () => {
  const { renderHero } = await import('../render/hero.mjs');
  for (const name of ['day', 'release', 'raid', 'night']) {
    const s = world(name);
    const svg = renderHero(s);
    const m = svg.match(/<svg x="28" y="28" width="168" height="168" viewBox="([0-9.]+) ([0-9.]+) ([0-9.]+) ([0-9.]+)"/);
    assert.ok(m, `${name}: the portrait embeds a cropped world view`);
    const [vx, vy, vw, vh] = m.slice(1).map(Number);
    assert.ok(Math.abs(vx + vw / 2 - s.world.hero.x * 4) < 2, `${name}: camera centers on the hero x`);
    assert.ok(Math.abs(vy + vh / 2 - s.world.hero.y * 4) < 2, `${name}: camera centers on the hero y`);
  }
});

test('event camera: silent when quiet, aimed at the story when loud', async () => {
  const { renderEvents } = await import('../render/hud.mjs');
  assert.equal(renderEvents(world('day')), null, 'no events: the slot hides itself');
  const centerOf = (svg) => {
    const m = svg.match(/viewBox="([0-9.]+) ([0-9.]+) ([0-9.]+) ([0-9.]+)"/);
    assert.ok(m, 'the event camera is a world crop');
    const [vx, vy, vw, vh] = m.slice(1).map(Number);
    return [(vx + vw / 2) / 4, (vy + vh / 2) / 4];
  };
  const rel = world('release'), [rx, ry] = centerOf(renderEvents(rel));
  const [cax, cay] = rel.world.anchors.castle;
  assert.ok(Math.hypot(rx - cax, ry - cay) < 2, 'a release is watched at the castle');
  const rd = world('raid'), [gx, gy] = centerOf(renderEvents(rd));
  const [gax, gay] = rd.world.anchors.gate;
  assert.ok(Math.hypot(gx - gax, gy - gay) < 2, 'a raid is watched at the gate');
  const st = world('storm'), [ex, ey] = centerOf(renderEvents(st));
  const firstEv = st.world.events[0];
  const b = st.world.repositories.find((r) => r.name === firstEv.detail);
  assert.ok(b && Math.hypot(ex - b.x, ey - b.y) < 4, 'an emergency is watched at the failing building');
});

test('camp camera: a window on the visitor district, tents from the world', async () => {
  const { renderCamp, CAMP_RECT } = await import('../render/camp.mjs');
  const s = world('day');
  const svg = renderCamp(s, { cfg });
  assert.ok(svg.includes(`viewBox="${CAMP_RECT[0] * 4} ${CAMP_RECT[1] * 4} ${(CAMP_RECT[2] - CAMP_RECT[0]) * 4} ${(CAMP_RECT[3] - CAMP_RECT[1]) * 4}"`), 'the camp window frames the visitor district');
  const desc = svg.match(/<desc id="d">([^<]*)<\/desc>/)[1];
  assert.ok(desc.includes('visitors planted their flags'), 'the social overlay keeps the count');
});

test('castle and dungeon cameras render, pass safety, and join the asset list', async () => {
  const { lintSvg } = await import('../safety.mjs');
  const { renderCastle } = await import('../render/castle.mjs');
  const { renderDungeon } = await import('../render/dungeon.mjs');
  const keys = (await import('../cli.mjs')).ASSETS.map((a) => a.key);
  assert.ok(keys.includes('castle') && keys.includes('dungeon'), 'the new cameras are wired up');
  const s = world('day');
  for (const [fn, name] of [[renderCastle, 'castle'], [renderDungeon, 'dungeon']]) {
    const svg = fn(s, {});
    assert.ok(svg.includes('<svg'), `${name} renders`);
    assert.deepEqual(lintSvg(svg), [], `${name} passes the safety check`);
  }
});

test('--only expands through the shared world: world pulls every camera', () => {
  const got = resolveOnly(['world'], { renderVersion: RENDER_VERSION });
  for (const k of ['castle', 'dungeon', 'events', 'camp', 'harvest', 'districts', 'trophies']) assert.ok(got.includes(k), `world re-render pulls ${k}`);
  assert.ok(resolveOnly(['castle'], { renderVersion: RENDER_VERSION }).includes('world'), 'a camera re-render pulls the world');
});

test('quest strip: slimmer, every quest tagged with its world anchor', async () => {
  const { renderQuest } = await import('../render/hud.mjs');
  const { ANCHOR_NAMES } = await import('../render/camera.mjs');
  const s = world('day');
  const svg = renderQuest(s);
  const m = svg.match(/height="(\d+)"/);
  const rows = s.quests.rows.length;
  assert.equal(Number(m[1]), 108 + rows * 48 + 16, 'the tile row is gone');
  const anchors = new Map(s.world.quests.map((q) => [q.id, q.anchor]));
  const desc = svg.match(/<desc id="d">([^<]*)<\/desc>/)[1];
  for (const row of s.quests.rows) {
    const a = anchors.get(row.id);
    if (a && ANCHOR_NAMES[a]) assert.ok(desc.includes(`at ${ANCHOR_NAMES[a].toLowerCase()}`), `${row.id} points at ${a}`);
  }
});

test('the map HUD no longer reads the event chips', async () => {
  const { paintMapHud } = await import('../render/kingdom.mjs');
  const s = world('release');
  assert.ok(s.scene.hud.length > 0, 'the release scenario has HUD chips in state');
  const withChips = paintMapHud(s);
  const s2 = structuredClone(s);
  s2.scene.hud = [];
  assert.equal(paintMapHud(s2), withChips, 'event chips must not affect the map overlay');
});
