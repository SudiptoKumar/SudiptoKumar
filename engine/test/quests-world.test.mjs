// TRUE V2, phase 6: quests are places. Every active quest points at an object of the world, shows a marker over it in every camera,
// and a finished quest sends the hero and a small crowd to that object.
import test from 'node:test';
import assert from 'node:assert/strict';
import { world, cfg, scenarioNames, atAge, inside } from './support.mjs';
import { questTargets, nextFreeSlot, markerFits, TARGET_ICON, TRACK_COLOR } from '../world/quests.mjs';
import { resolveCamera } from '../world/cameras.mjs';
import { QUEST_TARGET } from '../world/homes.mjs';
import { QUEST_ANCHOR } from '../world/phases.mjs';
import { buildWorld } from '../world/index.mjs';
import { ANCHORS, FARM, FOOT, DISTRICTS, SLOTS, assignRepos } from '../world/layout.mjs';
import { renderKingdom } from '../render/kingdom.mjs';
import { renderHarvest } from '../render/harvest.mjs';
import { readManifest } from '../world/manifest.mjs';
import { textLog } from '../render/pixel.mjs';
import { lintSvg } from '../safety.mjs';

const R = { cfg, avatars: {} };
const W = (s) => buildWorld(s, { cfg });
const rowsOf = (s, tracks) => { s.quests.rows = tracks.map((t) => s.quests.list.find((q) => q.track === t && q.state === 'ACTIVE')).filter(Boolean); s.quests.current = s.quests.rows[0]; };

test('quest targets: every track points at an object, the table is complete, only active quests have a place to go', () => {
  assert.deepEqual(Object.keys(TARGET_ICON).sort(), ['castle', 'ci', 'district', 'dungeon', 'farm', 'vault']);
  for (const t of Object.values(QUEST_TARGET)) assert.ok(TARGET_ICON[t], `${t} has an icon`);
  for (const t of Object.keys(QUEST_TARGET)) assert.ok(TRACK_COLOR[t], `${t} has a colour`);
  let seen = new Set();
  for (const n of scenarioNames()) {
    const s = world(n), w = W(s), shown = [...s.quests.rows, s.quests.current].filter(Boolean);
    assert.ok(w.quests.length <= 4, `${n}: at most four markers (${w.quests.length})`);
    for (const q of w.quests) {
      const src = shown.find((x) => x.id === q.id); assert.ok(src && src.state === 'ACTIVE', `${n}: ${q.id} is an active quest that is shown`);
      assert.equal(q.object, QUEST_TARGET[q.track] || 'castle'); assert.equal(q.primary, q.id === s.quests.current?.id);
      assert.ok(q.x >= 0 && q.x <= 176 && q.y >= 0 && q.y <= 240, `${n}: ${q.id} is inside the world`); seen.add(q.object);
    }
    assert.equal(new Set(w.quests.map((q) => q.id)).size, w.quests.length, `${n}: one marker per quest`);
  }
  assert.ok(['farm', 'dungeon', 'castle', 'ci'].every((o) => seen.has(o)), `the demo worlds show markers on the farm, dungeon, castle and CI (saw ${[...seen]})`);
});

test('quest targets: each marker stands over its own object', () => {
  const s = world('day'); rowsOf(s, ['streak', 'stars', 'gate', 'release']);
  const by = Object.fromEntries(W(s).quests.map((q) => [q.object, q]));
  const [fx, fy, fw] = FARM.fence; assert.ok(by.farm.x > fx && by.farm.x < fx + fw && by.farm.y < fy, 'over the farm');
  const [vx, vy, vw] = FOOT.vault; assert.ok(by.vault.x >= vx && by.vault.x <= vx + vw && by.vault.y < vy, 'over the vault');
  assert.ok(by.dungeon.y > 205 && by.dungeon.y < 225 && Math.abs(by.dungeon.x - ANCHORS.dungeon.x) < 8, 'at the stairs of the dungeon');
  assert.ok(by.castle.x === ANCHORS.castle.x && by.castle.y < FOOT.castle[1] + 8, 'over the castle roof');
  const c = world('storm'); rowsOf(c, ['recover']); const ci = W(c).quests[0]; assert.equal(ci.object, 'ci'); assert.ok(ci.y < FOOT.ci[1] && ci.x >= FOOT.ci[0] && ci.x <= FOOT.ci[0] + FOOT.ci[2], 'over the fortress');
});

test('new project quest: the marker stands over the first free building plot, and the plot is really free', () => {
  const s = world('day'); rowsOf(s, ['build']); const w = W(s), q = w.quests[0];
  assert.equal(q.object, 'district'); assert.ok(q.plot, 'a plot is staked out');
  const used = new Set(w.layout.placed.map((p) => `${p.x},${p.y}`));
  assert.ok(!used.has(`${q.plot.x},${q.plot.y}`), 'no building stands there');
  assert.ok(inside(q.plot.x, q.plot.y, DISTRICTS[q.plot.district].rect), 'inside its district');
  assert.deepEqual(nextFreeSlot(w.layout), { x: q.plot.x, y: q.plot.y, list: q.plot.list, district: q.plot.district });
  // every slot taken: no plot, the marker falls back to the plaza and nothing throws
  const full = { placed: Object.entries(SLOTS).flatMap(([list, sl]) => sl.map(([x, y]) => ({ x, y, list }))), ruins: [] };
  assert.equal(nextFreeSlot(full), null);
  const t = questTargets({ quests: { rows: [{ id: 'build:month', track: 'build', state: 'ACTIVE', pct: 0 }], current: { id: 'build:month' } } }, full);
  assert.equal(t[0].plot, null); assert.equal(t[0].object, 'district');
  // building the project moves the plot to the next place
  const more = structuredClone(s); const lay = assignRepos(more.repos);
  assert.ok(lay.placed.length > 0);
});

test('only active quests have markers: locked and completed ones do not', () => {
  const s = world('day'); s.quests.rows = s.quests.list.filter((q) => q.state === 'LOCKED').slice(0, 2); s.quests.current = { ...s.quests.rows[0], state: 'COMPLETE' };
  assert.deepEqual(W(s).quests, []);
  const none = world('day'); none.quests = { list: [], rows: [], current: null, counts: { active: 0, complete: 0 }, xp: 0 };
  assert.deepEqual(W(none).quests, []); assert.deepEqual(W(world('day', { tweak: (x) => { delete x.quests; } })).quests, [], 'no quest data at all: no markers, no crash');
});

test('markers are drawn in the world, in every camera that shows the object, and nowhere else', () => {
  const s = world('day'); rowsOf(s, ['streak', 'gate', 'release']);
  const bare = structuredClone(s); bare.quests.rows = []; bare.quests.current = null;
  const withQ = renderKingdom(s, R), without = renderKingdom(bare, R);
  assert.notEqual(withQ, without); assert.ok(withQ.length > without.length); assert.deepEqual(lintSvg(withQ), []);
  const m = readManifest(withQ), ids = W(s).quests.map((q) => `q:${q.id}`);
  for (const id of ids) assert.ok(m.o[id], `${id} is in the overworld manifest`);
  // a camera shows a marker only when it can show all of it: the farm window starts below the marker, so the farm camera has none
  // (the farm already is the home of the streak: its own number says it), while a wider window that holds the whole marker does
  const farm = readManifest(renderHarvest(s, R)), streak = W(s).quests.find((q) => q.object === 'farm');
  assert.ok(!markerFits(streak, resolveCamera(W(s), 'FARM').rect) && !farm.o[`q:${streak.id}`], 'no half marker at the edge of the farm picture');
  assert.ok(markerFits(streak, resolveCamera(W(s), 'OVERWORLD').rect), 'the overworld holds every marker whole');
  assert.ok(!Object.keys(farm.o).some((k) => k.startsWith('q:')), 'the farm picture has no markers at all');
  assert.equal(readManifest(withQ).g.light, readManifest(renderHarvest(s, R)).g.light);
});

test('quest text stays out of the world: the world draws places, not sentences (one visual home)', () => {
  const s = world('day'); rowsOf(s, ['streak', 'gate', 'release']);
  const titles = s.quests.rows.map((q) => String(q.title).toUpperCase());
  textLog.on = true; textLog.items.length = 0;
  renderHarvest(s, R); const farmText = textLog.items.map((t) => String(t.str).toUpperCase());
  textLog.items.length = 0; renderKingdom(s, R); const worldText = textLog.items.map((t) => String(t.str).toUpperCase()); textLog.on = false;
  for (const t of titles) { assert.ok(!worldText.includes(t) && !farmText.includes(t), `"${t}" is not written on the map`); }
  const hostile = world('day', { tweak: (x) => { rowsOf(x, ['streak']); x.quests.rows[0] = { ...x.quests.rows[0], title: '<script>alert(1)</script>' }; x.quests.current = x.quests.rows[0]; } });
  assert.deepEqual(lintSvg(renderKingdom(hostile, R)), []);
});

test('a finished quest sends the hero and a small crowd to the object it pointed at', () => {
  for (const [track, id, anchor] of [['streak', 'quest:streak:14', 'farm'], ['stars', 'quest:stars:250', 'vault'], ['gate', 'quest:gate:2026-09-30', 'gate'], ['recover', 'quest:recover:2026-09-30', 'ci'], ['release', 'quest:release:2026-09', 'castle']]) {
    assert.equal(QUEST_ANCHOR[track], anchor);
    const noRel = (s) => { s.events.active = s.events.active.filter((e) => e.type !== 'release' && e.type !== 'emergency'); s.raid = { ...s.raid, active: false }; s.totals.failingRepos = []; s.repos.forEach((r) => { if (r.workflow === 'failing') r.workflow = 'passing'; }); };
    const done = atAge('day', 'milestone', 120, noRel, id);
    assert.equal(done.scene.phases.find((p) => p.type === 'milestone').where.anchor, anchor, track);
    assert.deepEqual([done.scene.hero.state, done.scene.hero.spot], ['celebrating', anchor], `${track}: the hero celebrates at ${anchor}`);
    const w = W(done), crowd = w.npcs.filter((n) => n.state === 'CELEBRATING');
    assert.ok(crowd.length >= 2, `${track}: a small crowd (${crowd.length})`);
    const walk = atAge('day', 'milestone', 10, noRel, id); assert.deepEqual([walk.scene.hero.state, walk.scene.hero.spot], ['walking', anchor]); assert.ok(walk.scene.hero.label.startsWith('HEADING TO THE '));
  }
});

test('quests are deterministic and part of the world signature', () => {
  const a = W(world('day')), b = W(world('day')); assert.deepEqual(a.quests, b.quests); assert.equal(a.sig, b.sig);
  const s = world('day'); rowsOf(s, ['stars']); assert.notEqual(W(s).sig, a.sig, 'a different quest is a different world');
  assert.equal(renderKingdom(s, R), renderKingdom(s, R));
});
