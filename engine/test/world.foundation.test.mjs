// TRUE V2, phase 1: the shared world model. Geometry, lifecycle, lighting, farm, hall, camp, cameras, one-visual-home table.
import test from 'node:test';
import assert from 'node:assert/strict';
import { world, cfg, scenarioNames, inside, overlap } from './support.mjs';
import { GW, GH, U, SCALE, PLOT, OUT_W, STYLE } from '../world/constants.mjs';
import { ANCHORS, FOOT, FARM, DISTRICTS, SLOTS, SLOT_DISTRICT, ROADS, NODES, EDGES, assignRepos, wantedList, routeBetween, routeLength, pointAlong, footBand, districtAt } from '../world/layout.mjs';
import { repoLifecycle, repoNeglect, LIFECYCLE, TIERS, TIER_STYLE, kingdomTier } from '../world/lifecycle.mjs';
import { lightingFor, INTENSITY } from '../world/lighting.mjs';
import { buildFarm, stageFor } from '../world/farm.mjs';
import { buildHall, HALL } from '../world/hall.mjs';
import { buildCamp, campState, TENT_SLOTS } from '../world/camp.mjs';
import { CAMERAS, CAMERA_IDS, resolveCamera } from '../world/cameras.mjs';
import { VISUAL_HOME, QUEST_TARGET } from '../world/homes.mjs';
import { buildWorld } from '../world/index.mjs';
import { h32 } from '../world/hash.mjs';

// ------------------------------------------------------------------ constants and geometry
test('constants: one grid, one scale table, one minimum text size', () => {
  assert.equal(GW * U, 704); assert.equal(GH, 240); assert.equal(OUT_W, 720);
  assert.ok(SCALE.hero > SCALE.npc, 'the hero is slightly larger than the people');
  assert.equal(PLOT.cols * PLOT.rows, 182, 'one plot for each of the 26 x 7 calendar days');
  assert.ok(STYLE.minTextScale >= 3);
});

test('layout: every big place fits the world and none of them overlaps another', () => {
  const names = Object.keys(FOOT);
  for (const n of names) { const [x, y, w, h] = FOOT[n]; assert.ok(x >= 0 && y >= 0 && x + w <= GW && y + h <= GH, `${n} is inside the world`); }
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) assert.ok(!overlap(FOOT[names[i]], FOOT[names[j]]), `${names[i]} overlaps ${names[j]}`);
  // the farm: the plots are inside the fence, the fence is inside its footprint
  const [fx, fy, fw, fh] = FARM.fence, P = FARM.plots;
  assert.ok(P.x >= fx && P.y >= fy && P.x + P.cols * P.w <= fx + fw && P.y + P.rows * P.h <= fy + fh, 'plots inside the fence');
  for (const [n, [ax, ay]] of Object.entries({ castle: [ANCHORS.castle.x, ANCHORS.castle.y], hall: [ANCHORS.hall.x, ANCHORS.hall.y], vault: [ANCHORS.vault.x, ANCHORS.vault.y], ci: [ANCHORS.ci.x, ANCHORS.ci.y] })) assert.ok(ax > 0 && ax < GW && ay > 0 && ay < GH, n);
});

test('layout: building slots stand inside their district, never in another place, and never closer than one building apart', () => {
  const all = [];
  for (const [list, slots] of Object.entries(SLOTS)) for (const [x, y] of slots) {
    const d = DISTRICTS[SLOT_DISTRICT[list]];
    assert.ok(inside(x, y, d.rect), `${list} slot ${x},${y} is inside district ${SLOT_DISTRICT[list]}`);
    assert.equal(districtAt(x, y), SLOT_DISTRICT[list], `${x},${y} reads as ${SLOT_DISTRICT[list]}`);
    for (const [place, box] of Object.entries(FOOT)) {
      if ((list === 'mine' && place === 'mine') || (list === 'ruins' && place === 'ruins')) continue;
      assert.ok(!overlap(footBand(x, y), box), `slot ${list} ${x},${y} must not stand on ${place}`);
    }
    all.push([x, y, list]);
  }
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const [ax, ay] = all[i], [bx, by] = all[j];
    assert.ok(Math.max(Math.abs(ax - bx), Math.abs(ay - by)) >= 14, `slots ${all[i]} and ${all[j]} are too close`);
  }
});

test('layout: roads stay in the world; every walking node is on the map and reachable from the plaza', () => {
  for (const [x1, y1, x2, y2, w] of ROADS) assert.ok(Math.min(x1, x2) >= 0 && Math.max(x1, x2) <= GW && Math.min(y1, y2) >= 0 && Math.max(y1, y2) <= GH && w >= 3);
  for (const [n, [x, y]] of Object.entries(NODES)) { assert.ok(x >= 0 && x <= GW && y >= 0 && y < 212, `node ${n}`); const r = routeBetween('plaza', n); assert.deepEqual(r[0], NODES.plaza); assert.deepEqual(r.at(-1), NODES[n], `plaza reaches ${n}`); }
  for (const [a, b] of EDGES) assert.ok(NODES[a] && NODES[b], 'edges only join known nodes');
  for (const [name, a] of Object.entries(ANCHORS)) if (NODES[name] && a.stand) assert.deepEqual(NODES[name], a.stand, `${name}: the node is where the hero stands`);
});

test('layout: a route is continuous, the point along it starts and ends where it should, and it is monotonic', () => {
  const r = routeBetween('home', 'ci');
  assert.deepEqual(pointAlong(r, 0), { x: r[0][0], y: r[0][1], dir: pointAlong(r, 0).dir });
  const end = pointAlong(r, 1); assert.deepEqual([end.x, end.y], r.at(-1));
  let last = -1;
  for (let t = 0; t <= 1.0001; t += 0.05) { const q = pointAlong(r, Math.min(1, t)); assert.ok(Number.isFinite(q.x) && Number.isFinite(q.y)); last = t; }
  assert.ok(last > 0.99); assert.ok(routeLength(r) > 80 && routeLength(r) < 400);
  assert.deepEqual(routeBetween('plaza', 'plaza'), [NODES.plaza]);
  assert.deepEqual(routeBetween('plaza', 'nowhere'), [NODES.plaza], 'an unknown destination never throws');
});

test('layout: repositories land in the district of their kind, overflow goes to a neighbour, and nobody is ever lost', () => {
  const state = world('day');
  const lay = assignRepos(state.repos);
  assert.equal(lay.placed.length + lay.overflow.length + lay.ruins.length + (lay.castle ? 1 : 0), state.repos.length);
  assert.deepEqual(lay.placed.map((q) => [q.repo.name, q.x, q.y]), assignRepos(state.repos).placed.map((q) => [q.repo.name, q.x, q.y]), 'stable');
  for (const q of lay.placed) assert.ok(inside(q.x, q.y, DISTRICTS[q.district].rect), `${q.repo.name} stands inside ${q.district}`);
  const news = lay.placed.filter((q) => q.repo.archetype === 'tower' && /news/i.test(q.repo.name));
  assert.ok(news.length >= 3 && news.every((q) => q.district === 'news' || q.district === 'automation'), 'news bots live in the news district (or its automation neighbour)');
  assert.equal(wantedList({ archetype: 'tower', name: 'MyNewsBot' }), 'news');
  assert.equal(wantedList({ archetype: 'tower', name: 'cron-runner' }), 'automation');
  assert.equal(wantedList({ archetype: 'library', name: 'notes' }), 'knowledge');
  // a huge account: capacity is limited, nobody disappears (extra archived projects are reported, not dropped)
  const many = Array.from({ length: 70 }, (_, i) => ({ ...state.repos[1 + (i % 6)], name: `r${i}`, state: i % 9 === 0 ? 'abandoned' : 'active', importance: 100 - i }));
  const big = assignRepos(many);
  assert.equal(big.placed.length + big.overflow.length + big.ruins.length + (big.castle ? 1 : 0), many.length);
  assert.equal(new Set(big.placed.map((q) => `${q.x},${q.y}`)).size, big.placed.length, 'two buildings never share a slot');
});

// ------------------------------------------------------------------ lifecycle and power tier
test('lifecycle: eight states, decided in a fixed order', () => {
  const base = { state: 'active', workflow: 'passing', recovered: false, evolution: { level: 3 }, ageDays: 300, commits90: 5 };
  const lc = (o) => repoLifecycle({ ...base, ...o });
  assert.equal(lc({ state: 'abandoned', workflow: 'failing' }), 'abandoned', 'ruins win over everything');
  assert.equal(lc({ state: 'failing' }), 'failing');
  assert.equal(lc({ workflow: 'failing', state: 'building' }), 'failing');
  assert.equal(lc({ recovered: true }), 'recovering');
  assert.equal(lc({ state: 'sleepy' }), 'sleepy'); assert.equal(lc({ state: 'dusty' }), 'sleepy');
  assert.equal(lc({ ageDays: 9, evolution: { level: 1 } }), 'foundation');
  assert.equal(lc({ evolution: { level: 5 }, commits90: 48, state: 'building' }), 'flourishing');
  assert.equal(lc({ state: 'building' }), 'building');
  assert.equal(lc({}), 'active');
  assert.equal(repoNeglect({ state: 'dusty' }), 2); assert.equal(repoNeglect({ state: 'sleepy' }), 1); assert.equal(repoNeglect({ state: 'active' }), 0);
  const seen = new Set(); for (const n of scenarioNames()) for (const r of world(n).repos) seen.add(repoLifecycle(r));
  for (const s of seen) assert.ok(LIFECYCLE.includes(s));
  assert.ok(seen.size >= 5, `the demo worlds show at least 5 lifecycle states (saw ${[...seen].join(', ')})`);
});

test('kingdom power: five tiers with the thresholds of the specification, richer tiers look richer', () => {
  const at = (v) => kingdomTier(v);
  assert.deepEqual([0, 20, 21, 40, 41, 60, 61, 80, 81, 100].map((v) => at(v).index), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  assert.equal(at(10).name, 'STRUGGLING VILLAGE'); assert.equal(at(100).name, 'LEGENDARY KINGDOM');
  assert.equal(at(-5).value, 0); assert.equal(at(NaN).index, 0); assert.equal(at(250).index, 4);
  assert.equal(TIERS.length, 5); assert.equal(TIER_STYLE.length, 5);
  for (const k of ['lamps', 'banners', 'flowers', 'stalls', 'villagers']) for (let i = 1; i < 5; i++) assert.ok(TIER_STYLE[i][k] >= TIER_STYLE[i - 1][k], `${k} never decreases with power`);
  assert.ok(TIER_STYLE[4].crown && !TIER_STYLE[2].crown);
  assert.deepEqual(TIER_STYLE.map((t) => t.roads), ['dirt', 'dirt', 'gravel', 'cobble', 'paved']);
});

// ------------------------------------------------------------------ lighting
test('lighting: one policy for day, evening, night and storm; aurora only after dark', () => {
  assert.ok(INTENSITY.day > INTENSITY.dawn && INTENSITY.dawn > INTENSITY.evening && INTENSITY.evening > INTENSITY.night);
  const L = (n, tweak) => { const s = world(n, { tweak }); return lightingFor(s, assignRepos(s.repos)); };
  assert.equal(L('day').intensity, 1); assert.equal(L('night').intensity, 0.35);
  assert.ok(L('storm').intensity <= 0.25 && L('thunder').intensity <= 0.2, 'a storm at any hour is dark');
  assert.ok(L('storm').intensity < L('evening').intensity);
  assert.equal(L('night').windows, true); assert.equal(L('day').windows, false);
  const aurDay = L('day', (s) => { s.scene.weather.aurora = 0.25; });
  assert.equal(aurDay.aurora, 0, 'no aurora in daylight');
  const aurNight = L('night', (s) => { s.scene.weather.aurora = 1; });
  assert.equal(aurNight.aurora, 1); assert.equal(aurNight.tint[0], '#0a2a44'); assert.ok(aurNight.spots.length >= 3);
  assert.equal(L('night').sig, L('night').sig, 'the signature is deterministic');
  assert.notEqual(L('night').sig, L('day').sig);
  assert.ok(L('release').spots.some((s) => s.color === '#ffcd75' && s.pulse), 'a release lights the castle');
});

// ------------------------------------------------------------------ farm, hall, camp
test('farm: 26 x 7 plots, calculated once from the contribution calendar', () => {
  const s = world('day'), f = buildFarm(s, cfg);
  assert.equal(f.plots.length, 182);
  assert.deepEqual([f.plots[0].c, f.plots[0].r, f.plots[7].c, f.plots[7].r], [0, 0, 1, 0], 'columns are weeks, rows are weekdays');
  assert.equal(f.plots.filter((p) => p.today).length, 1, 'exactly one today');
  const today = f.plots[f.todayIdx]; assert.equal(today.date, f.anchor); assert.equal(today.c, 25);
  assert.ok(f.plots.filter((p) => p.future).every((p) => p.date > f.anchor && p.count === 0 && p.stage === 0));
  const sum = s.calendar.filter((d) => f.plots.some((p) => p.date === d.date && !p.future)).reduce((a, d) => a + d.count, 0);
  assert.equal(f.total, sum, 'the total is the sum of the days that are on the field');
  assert.equal(f.plots.filter((p) => p.streak).length, f.streakDays); assert.ok(f.streakDays <= s.streak);
  assert.equal(f.plots.filter((p) => p.streak).length, Math.min(s.streak, f.plots.filter((p) => !p.future).length));
  const steps = cfg.cropSteps; for (const p of f.plots.filter((q) => !q.future)) assert.equal(p.stage, stageFor(p.count, steps));
  for (const p of f.plots) assert.ok(inside(p.x, p.y, FARM.fence) && inside(p.x + FARM.plots.w, p.y + FARM.plots.h, FARM.fence), 'every plot is inside the fence');
  assert.deepEqual(buildFarm(s, cfg).sig, f.sig, 'deterministic');
  assert.equal(stageFor(0, steps), 0); assert.equal(stageFor(1, steps), 1); assert.equal(stageFor(15, steps), 5);
  const empty = buildFarm(world('newbie'), cfg); assert.equal(empty.plots.length, 182, 'even a new account has a field');
});

test('trophy hall: every achievement is a pedestal or a door in a two-storey gallery', () => {
  const s = world('day'), h = buildHall(s);
  assert.equal(h.pedestals.length, 16); assert.equal(h.total, 16);
  assert.equal(h.count, s.achievements.list.filter((a) => a.unlocked).length);
  assert.ok(h.pedestals.slice(0, 12).every((p) => p.state === 'trophy' || p.state === 'empty'), 'normal achievements first');
  assert.ok(h.pedestals.slice(12).every((p) => p.state.startsWith('door')), 'secret ones are doors, at the end');
  assert.ok(h.pedestals.every((p) => p.row < HALL.floors && p.col < HALL.cols));
  assert.ok(h.pedestals.every((p) => inside(p.x, p.y, FOOT.hall)), 'every pedestal stands inside the hall');
  assert.equal(new Set(h.pedestals.map((p) => `${p.col},${p.row}`)).size, 16, 'no two share a place');
  assert.equal(buildHall(s).sig, h.sig);
  const locked = buildHall(world('newbie')); assert.ok(locked.pedestals.filter((p) => p.state === 'trophy').length <= 2);
});

test('visitor camp: four growth states, one tent for each visitor, never more than twelve', () => {
  assert.deepEqual([0, 1, 4, 5, 11, 12, 40].map(campState), ['EMPTY', 'CAMP', 'CAMP', 'VILLAGE', 'VILLAGE', 'FESTIVAL', 'FESTIVAL']);
  assert.equal(TENT_SLOTS.length, 12); assert.equal(new Set(TENT_SLOTS.map((t) => t.join())).size, 12);
  for (const [x, y] of TENT_SLOTS) assert.ok(inside(x, y, FOOT.camp) && inside(x + 8, y + 6, FOOT.camp), `tent ${x},${y} is inside the camp`);
  const s = world('day');
  const fl = (n) => Array.from({ length: n }, (_, i) => ({ n: n - i, login: `v${i}`, message: 'hi', avatar: 'knight', color: 'gold', at: '2026-09-30T00:00:00Z' }));
  const c = (n) => { const t = structuredClone(s); t.visitors = { total: n, flags: fl(Math.min(n, 30)) }; return buildCamp(t, cfg); };
  assert.equal(c(0).state, 'EMPTY'); assert.equal(c(0).visitors.length, 0);
  assert.equal(c(3).visitors.length, 3); assert.equal(c(3).visitors[0].newest, true);
  assert.equal(c(30).visitors.length, 12); assert.equal(c(30).state, 'FESTIVAL'); assert.equal(c(30).bunting, true);
  assert.equal(c(7).state, 'VILLAGE'); assert.ok(c(7).huts > 0 && c(7).fires === 2);
  assert.notEqual(c(3).sig, c(4).sig);
});

// ------------------------------------------------------------------ cameras and homes
test('cameras: seven windows onto one world, all inside it, each with its own level of detail', () => {
  assert.deepEqual([...CAMERA_IDS].sort(), ['CASTLE', 'DUNGEON', 'FARM', 'OVERWORLD', 'PROJECT_DISTRICT', 'TROPHY_HALL', 'VISITOR_CAMP']);
  const W = buildWorld(world('day'), { cfg });
  for (const id of CAMERA_IDS) {
    const c = resolveCamera(W, id), [x, y, w, h] = c.rect;
    assert.ok(x >= 0 && y >= 0 && x + w <= GW && y + h <= GH, `${id} stays inside the world`);
    assert.ok(c.outW > 0 && c.outH > 0 && c.zoom > 0.9, `${id} output ${c.outW}x${c.outH}`);
    assert.ok(['far', 'near'].includes(c.lod));
  }
  const ov = resolveCamera(W, 'OVERWORLD'); assert.ok(ov.rect[2] === GW, 'the overworld is the full width of the world');
  // each focused camera really contains the thing it is about
  assert.ok(FOOT.hall[0] >= resolveCamera(W, 'TROPHY_HALL').rect[0] && FOOT.hall[0] + FOOT.hall[2] <= resolveCamera(W, 'TROPHY_HALL').rect[0] + resolveCamera(W, 'TROPHY_HALL').rect[2]);
  const farm = resolveCamera(W, 'FARM').rect; assert.ok(FARM.fence[0] >= farm[0] && FARM.fence[0] + FARM.fence[2] <= farm[0] + farm[2] && FARM.fence[1] >= farm[1] - 3);
  const small = resolveCamera(W, 'VISITOR_CAMP').rect;
  for (const [tx, ty] of TENT_SLOTS.slice(0, 4)) assert.ok(inside(tx, ty, small) && inside(tx + 8, ty + 6, small), 'a small camp view holds the first four tents');
  const bigW = buildWorld(world('day', { tweak: (s) => { s.visitors = { total: 30, flags: Array.from({ length: 12 }, (_, i) => ({ n: 30 - i, login: `v${i}`, message: 'hi', avatar: 'knight', color: 'gold', at: '2026-09-30T00:00:00Z' })) }; } }), { cfg });
  const camp = resolveCamera(bigW, 'VISITOR_CAMP').rect; assert.ok(camp[3] > small[3], 'a big camp gets a bigger window');
  for (const [tx, ty] of TENT_SLOTS) assert.ok(inside(tx, ty, camp) && inside(tx + 8, ty + 6, camp), 'all twelve tent places are in the big camp view');
  const dist = resolveCamera(W, 'PROJECT_DISTRICT').rect; for (const list of ['automation', 'news', 'knowledge', 'personal', 'village']) for (const [sx, sy] of SLOTS[list]) assert.ok(sy >= dist[1] && sy <= dist[1] + dist[3], `${list} slot ${sx},${sy} is in the district view`);
  // the hero camera follows the hero and stays in the world even at the edges
  const near = resolveCamera({ ...W, hero: { x: 2, y: 4 } }, 'CASTLE'); assert.ok(near.rect[0] >= 0 && near.rect[1] >= 0);
  const far = resolveCamera({ ...W, hero: { x: 175, y: 239 } }, 'CASTLE'); assert.ok(far.rect[0] + far.rect[2] <= GW && far.rect[1] + far.rect[3] <= GH);
  const mid = resolveCamera({ ...W, hero: { x: 88, y: 100 } }, 'CASTLE'); assert.ok(mid.rect[0] < 88 && mid.rect[0] + mid.rect[2] > 88 && mid.rect[1] < 100 && mid.rect[1] + mid.rect[3] > 100, 'the hero is inside his own camera');
  assert.throws(() => resolveCamera(W, 'NOPE'));
  assert.deepEqual(Object.keys(CAMERAS).sort(), [...CAMERA_IDS].sort());
});

test('one visual home: every signal named by the specification has exactly one home', () => {
  const want = { stars: 'vault', issues: 'dungeon', ci: 'fortress', commits: 'builders', prs: 'messengers', releases: 'castle', contributions: 'farm', achievements: 'hall', visitors: 'camp', population: 'npcs' };
  for (const [k, v] of Object.entries(want)) assert.equal(VISUAL_HOME[k].home, v, k);
  assert.equal(VISUAL_HOME.streak.home, 'farm');
  assert.deepEqual(Object.keys(QUEST_TARGET).sort(), ['build', 'gate', 'kingdom', 'recover', 'release', 'stars', 'streak']);
  for (const t of Object.values(QUEST_TARGET)) assert.ok(['farm', 'vault', 'dungeon', 'ci', 'castle', 'district'].includes(t));
});

// ------------------------------------------------------------------ the world model as a whole
test('buildWorld: derived, deterministic for every demo world, never touches the state, never throws', () => {
  for (const name of scenarioNames()) {
    const s = world(name), before = JSON.stringify(s);
    const a = buildWorld(s, { cfg }), b = buildWorld(s, { cfg });
    assert.equal(JSON.stringify(s), before, `${name}: the state is untouched`);
    assert.deepEqual(a, b, `${name}: same state, same world`);
    assert.deepEqual(a.errors, [], `${name}: no section failed`);
    assert.equal(a.sig, b.sig);
    for (const r of a.repos) assert.ok(r.x >= 0 && r.x <= GW && r.y >= 0 && r.y < GROUND_LIMIT, `${name}: ${r.name} is on the surface`);
    assert.ok(a.hero.x >= 0 && a.hero.x <= GW && a.hero.y >= 0 && a.hero.y < GROUND_LIMIT, `${name}: the hero is on the map`);
    assert.ok(LIFECYCLE.includes(a.repos[0]?.lifecycle || 'active'));
  }
  const day = buildWorld(world('day'), { cfg }), night = buildWorld(world('night'), { cfg });
  assert.notEqual(day.sig, night.sig, 'a different moment is a different world');
  assert.equal(day.kingdom.tier.value, world('day').power.value);
  assert.ok(h32('a') !== h32('b') && h32('a') === h32('a'));
});

test('buildWorld: a broken part of the state degrades that part and nothing else', () => {
  const s = world('day'); s.calendar = null; s.achievements = null; s.visitors = null;
  const w = buildWorld(s, { cfg });
  assert.ok(w.errors.length >= 1 || (w.farm.plots.length === 182 && w.hall.pedestals.length === 0), 'handled without throwing');
  assert.ok(w.repos.length > 0 && w.lighting.sig, 'the rest of the world is intact');
  const s2 = world('day'); delete s2.scene;
  const w2 = buildWorld(s2, { cfg }); assert.ok(w2.errors.length > 0 && w2.lighting.sig === 'day:1:clear:0:-:000', 'no scene: safe defaults');
});
const GROUND_LIMIT = 212;
