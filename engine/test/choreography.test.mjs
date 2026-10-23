// TRUE V2, phase 4: event choreography. Every story has START, PEAK, AFTERMATH, EXPIRED; the hero walks to the place along the roads;
// people react with one of eight behaviour states. Everything is a pure function of the saved state, so it is testable down to the minute.
import test from 'node:test';
import assert from 'node:assert/strict';
import { world, cfg, scenarioNames, atAge, inside } from './support.mjs';
import { PHASES, TIMELINE, STAGE_PHASE, WALK_MINUTES, phaseOf, phaseSignature } from '../world/phases.mjs';
import { NPC_STATES, CROWD } from '../world/population.mjs';
import { buildWorld, spotRoute } from '../world/index.mjs';
import { ANCHORS, NODES, routeLength, pointAlong } from '../world/layout.mjs';
import { renderHero } from '../render/hero.mjs';
import { renderKingdom } from '../render/kingdom.mjs';
import { lintSvg } from '../safety.mjs';

const W = (s) => buildWorld(s, { cfg });
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const states = (w) => w.npcs.filter((n) => n.state);
const count = (w, state, role) => w.npcs.filter((n) => n.state === state && (!role || n.role === role)).length;

test('phases: the four phases and the exact minute each one begins', () => {
  assert.deepEqual([...PHASES], ['start', 'peak', 'aftermath', 'expired']);
  for (const [type, [a, b, c]] of Object.entries(TIMELINE)) {
    assert.equal(phaseOf(type, 0), 'start', type); assert.equal(phaseOf(type, a - 1), 'start', type);
    assert.equal(phaseOf(type, a), 'peak', type); assert.equal(phaseOf(type, b - 1), 'peak', type);
    assert.equal(phaseOf(type, b), 'aftermath', type); assert.equal(phaseOf(type, c - 1), 'aftermath', type);
    assert.equal(phaseOf(type, c), 'expired', type);
  }
  assert.ok(TIMELINE.release[0] < TIMELINE.release[1] && TIMELINE.release[1] < TIMELINE.release[2]);
  assert.equal(TIMELINE.release[1], 12 * 60, 'the release party still lasts 12 hours, as before');
  // the stories that already had stages keep them, each stage belongs to exactly one phase
  for (const m of Object.values(STAGE_PHASE)) for (const ph of Object.values(m)) assert.ok(PHASES.includes(ph));
  assert.equal(STAGE_PHASE.fail.warning, 'start'); assert.equal(STAGE_PHASE.fail.fire, 'peak'); assert.equal(STAGE_PHASE.repair.fade, 'aftermath'); assert.equal(STAGE_PHASE.raid.enter, 'start'); assert.equal(STAGE_PHASE.raid.won, 'aftermath');
});

test('phases: every running story of a demo world has a phase and a real age in minutes', () => {
  const s = world('release'), ph = s.scene.phases;
  const rel = ph.find((p) => p.type === 'release');
  assert.deepEqual([rel.phase, rel.ageMinutes, rel.where], ['peak', 180, { anchor: 'castle' }], 'a release 3 hours old is at its peak');
  assert.equal(world('raid').scene.phases.find((p) => p.type === 'raid').phase, 'peak');
  assert.equal(world('raid').scene.phases.find((p) => p.type === 'raid').ageMinutes, 25);
  assert.equal(world('victory').scene.phases.find((p) => p.type === 'raid').phase, 'aftermath');
  assert.ok(world('storm').scene.phases.filter((p) => p.type === 'emergency').every((p) => p.phase === 'peak' && p.ageMinutes === 144));
  assert.equal(world('recovery').scene.phases.find((p) => p.type === 'recovery').phase, 'start');
  assert.equal(world('build').scene.phases.find((p) => p.type === 'expansion').phase, 'start');
  for (const n of scenarioNames()) for (const p of world(n).scene.phases) { assert.ok(PHASES.includes(p.phase) && p.phase !== 'expired', `${n}: ${p.type}`); assert.ok(Number.isInteger(p.ageMinutes) && p.ageMinutes >= 0); }
  const order = world('release').scene.phases.map((p) => p.type); assert.ok(order.indexOf('release') < order.indexOf('harvest'), 'most important story first');
  assert.equal(phaseSignature([]), '-'); assert.equal(phaseSignature(world('release').scene.phases).startsWith('release:peak'), true);
});

test('release: START (hero walks to the castle) -> PEAK (party) -> AFTERMATH (afterglow) -> EXPIRED (routine)', () => {
  const at = (m) => atAge('release', 'release', m), fx = (s) => new Set(s.scene.fx);
  const start = at(5), peak = at(180), after = at(800), gone = at(3000);
  assert.equal(start.scene.phases[0].phase, 'start'); assert.equal(start.scene.hero.state, 'walking'); assert.equal(start.scene.hero.spot, 'castle');
  assert.ok(!fx(start).has('fireworks') && !fx(start).has('confetti') && fx(start).has('crowdGathering'), 'nothing is thrown yet, the crowd is gathering');
  assert.equal(peak.scene.hero.state, 'celebrating'); assert.ok(fx(peak).has('fireworks') && fx(peak).has('castleLights') && fx(peak).has('banner'));
  assert.equal(after.scene.phases[0].phase, 'aftermath'); assert.equal(after.scene.hero.state, 'idle'); assert.equal(after.scene.hero.spot, 'castle');
  assert.ok(!fx(after).has('fireworks') && !fx(after).has('confetti') && fx(after).has('castleLights') && fx(after).has('confettiGround'), 'the paper has settled, the castle keeps its glow');
  assert.ok(!gone.scene.phases.some((p) => p.type === 'release'), 'expired: the story is gone'); assert.ok(!fx(gone).has('confettiGround'));
  assert.equal(start.scene.stages.release, 'start'); assert.equal(peak.scene.stages.release, 'peak'); assert.equal(after.scene.stages.release, 'afterglow');
});

test('hero path: during START he really walks along the roads, from his routine place to the event, and arrives exactly when START ends', () => {
  const route = (m) => W(atAge('release', 'release', m)).hero;
  const h0 = route(0), h10 = route(10), h20 = route(20), h29 = route(29), h30 = route(30);
  const dest = ANCHORS.castle.stand;
  assert.equal(h0.state, 'walking'); assert.equal(h0.spot, 'castle'); assert.ok(h0.route.length >= 2, 'a route exists');
  assert.deepEqual([h0.route[0], h0.route.at(-1)].map((q) => q.join()), [spotRoute(h0.from, 'castle', W(world('release')).layout)[0].join(), dest.join()]);
  const dd = [h0, h10, h20, h29].map((h) => dist([h.x, h.y], dest));
  for (let i = 1; i < dd.length; i++) assert.ok(dd[i] < dd[i - 1], `the hero gets closer every minute: ${dd.map((d) => d.toFixed(1))}`);
  assert.ok(dd[0] > 20, 'he starts away from the castle'); assert.ok(dd[3] < 4, 'and is almost there at minute 29');
  assert.equal(h30.state, 'celebrating'); assert.deepEqual([h30.x, h30.y], dest);
  // always ON the road: the point is on one of the segments of the route
  const onRoute = (h) => h.route.some((a, i) => i && Math.abs(dist(h.route[i - 1], [h.x, h.y]) + dist([h.x, h.y], a) - dist(h.route[i - 1], a)) < 0.05);
  for (const h of [h0, h10, h20, h29]) assert.ok(onRoute(h), `${h.x},${h.y} is on the road`);
  assert.deepEqual(route(10), route(10), 'deterministic');
  assert.ok([1, -1].includes(h10.face));
  assert.equal(W(world('day')).hero.route, null, 'a hero who is not walking has no route');
});

test('hero path: a raid sends him running to the gate; routes only use known roads; every destination is reachable from every routine place', () => {
  const enter = W(atAge('raid', 'raid', 5)).hero, battle = W(atAge('raid', 'raid', 25)).hero;
  assert.equal(enter.state, 'walking'); assert.equal(enter.spot, 'gate'); assert.equal(atAge('raid', 'raid', 5).scene.hero.label, 'RUNNING TO THE GATE');
  assert.equal(battle.state, 'fighting'); assert.deepEqual([battle.x, battle.y], ANCHORS.gate.stand);
  assert.ok(dist([enter.x, enter.y], ANCHORS.gate.stand) > 0.01 || WALK_MINUTES.raid === 0);
  const lay = W(world('day')).layout;
  for (const from of ['castle', 'plaza', 'farm', 'home', 'road', 'district']) for (const to of ['castle', 'hall', 'farm', 'gate', 'ci', 'plaza', 'district']) {
    const r = spotRoute(from, to, lay); assert.ok(r.length >= 1 && r.every(([x, y]) => x >= 0 && x <= 176 && y >= 0 && y < 212), `${from}->${to}`);
    const len = routeLength(r); const end = pointAlong(r, 1); assert.deepEqual([end.x, end.y], r.at(-1)); assert.ok(len < 400);
  }
  const busy = W(world('day', { tweak: (s) => { s.scene.hero = { ...s.scene.hero, spot: 'district' }; } })).hero;
  assert.equal(busy.spot, 'district'); assert.ok(busy.y < 160 && busy.y > 100, 'a busy hero works in front of a building of the districts');
});

test('hero: harvest sends him to the farm, an achievement to the hall, a level-up to the castle; every aftermath is calm', () => {
  const noRelease = (s) => { s.events.active = s.events.active.filter((e) => e.type !== 'release'); };
  const walk = atAge('release', 'harvest', 20, noRelease), feast = atAge('release', 'harvest', 300, noRelease), after = atAge('release', 'harvest', 1500, noRelease);
  assert.deepEqual([walk.scene.hero.state, walk.scene.hero.spot], ['walking', 'farm']);
  assert.deepEqual([feast.scene.hero.state, feast.scene.hero.spot, feast.scene.hero.why], ['celebrating', 'farm', 'harvest']);
  assert.deepEqual([after.scene.hero.state, after.scene.hero.label], ['idle', 'ENJOYING THE AFTERGLOW']);
  assert.equal(atAge('release', 'harvest', 3000, noRelease).scene.hero.why !== 'harvest', true, 'after the festival the routine is back');
  const hall = atAge('day', 'milestone', 100, null, 'ach:first-star'), castle = atAge('day', 'milestone', 100, null, 'levelup:33'), arriving = atAge('day', 'milestone', 10, null, 'ach:first-star');
  assert.deepEqual([hall.scene.hero.state, hall.scene.hero.spot], ['celebrating', 'hall']);
  assert.deepEqual([castle.scene.hero.state, castle.scene.hero.spot], ['celebrating', 'castle']);
  assert.deepEqual([arriving.scene.hero.state, arriving.scene.hero.spot, arriving.scene.hero.label], ['walking', 'hall', 'HEADING TO THE HALL']);
  const hw = W(arriving).hero; assert.deepEqual(hw.route.at(-1), ANCHORS.hall.stand, 'his route ends at the hall'); assert.ok(hw.route.some(([x, y]) => x === 88 && y === 110), 'and goes through the plaza crossing'); assert.ok(dist([hw.x, hw.y], ANCHORS.hall.stand) > 10, 'he has not arrived yet');
  const crowd = W(hall).npcs.filter((e) => e.state === 'CELEBRATING'); assert.ok(crowd.length >= 2 && crowd.every((e) => Math.abs(e.x - ANCHORS.hall.x) < 20), 'a small crowd gathers in front of the hall');
});

test('people: eight behaviour states, all of them used, none outside the world', () => {
  const seen = new Set(), all = [];
  for (const n of scenarioNames()) { const w = W(world(n)); w.npcs.forEach((e) => { seen.add(e.state); all.push([n, e]); }); }
  for (const w of [W(atAge('raid', 'raid', 5)), W(atAge('release', 'release', 5)), W(atAge('release', 'release', 800)), W(atAge('storm', 'emergency', 30))]) w.npcs.forEach((e) => seen.add(e.state));
  assert.deepEqual([...seen].sort(), [...NPC_STATES].sort(), `all eight states appear (saw ${[...seen]})`);
  for (const [n, e] of all) { assert.ok(NPC_STATES.includes(e.state)); assert.ok(e.x >= 0 && e.x <= 176 && e.y > 40 && e.y < 212, `${n}: ${e.role} ${e.x},${e.y} is on the surface`); }
  for (const n of scenarioNames()) { const w = W(world(n)); assert.equal(new Set(w.npcs.map((e) => e.id)).size, w.npcs.length, `${n}: unique ids`); assert.ok(w.npcs.length <= 60, `${n}: ${w.npcs.length} people`); }
});

test('people: night, rain and daily life', () => {
  const night = W(world('night')); assert.ok(count(night, 'SLEEPING') >= 1, 'somebody sleeps at night'); assert.equal(count(night, 'CELEBRATING'), 0);
  assert.ok(night.npcs.filter((e) => e.role === 'villager').length === 0, 'villagers are indoors at night');
  const day = W(world('day')); assert.ok(count(day, 'WALKING') >= 4 && count(day, 'WORKING') >= 2, 'a normal day: people walk and work'); assert.equal(count(day, 'FIGHTING') + count(day, 'FLEEING'), 0);
  const rain = W(world('newbie')); const dry = W(world('newbie', { tweak: (s) => { s.scene.behavior.shelter = false; } }));
  assert.ok(rain.npcs.length <= dry.npcs.length, 'in the rain fewer people are out');
  const sh = W(world('day', { tweak: (s) => { s.scene.behavior.shelter = true; } })); assert.ok(sh.npcs.some((e) => e.top === 'umbrella'), 'people carry umbrellas');
});

test('people react to a raid: START guards rush and villagers flee, PEAK guards fight, AFTERMATH guards celebrate a win', () => {
  const start = W(atAge('raid', 'raid', 5)), peak = W(atAge('raid', 'raid', 25)), won = W(world('victory'));
  assert.ok(count(start, 'FLEEING', 'villager') + count(start, 'FLEEING', 'villager2') + count(start, 'FLEEING', 'villager3') >= 1, 'villagers flee');
  assert.ok(start.npcs.filter((e) => e.role === 'guard').every((e) => e.state === 'WALKING'), 'guards are running to their posts');
  assert.ok(count(peak, 'FIGHTING', 'guard') >= 2 && peak.npcs.filter((e) => e.state === 'FIGHTING').every((e) => e.y === 200), 'guards fight at the gate line');
  assert.ok(count(peak, 'FLEEING') >= 1);
  assert.ok(count(won, 'CELEBRATING', 'guard') >= 2, 'a won raid is celebrated by the guards'); assert.equal(count(won, 'FIGHTING'), 0);
  const lost = W(world('victory', { tweak: (s) => { s.raid = { ...s.raid, won: false, phase: 'lost' }; s.scene.stages.raid = 'lost'; s.scene = { ...s.scene, stages: { ...s.scene.stages, raid: 'lost' } }; } }));
  assert.ok(count(lost, 'FLEEING', 'guard') >= 2, 'a lost raid sends the guards running');
});

test('people react to a release: a crowd gathers at the castle, celebrates at the peak, rests in the aftermath', () => {
  const gather = W(atAge('release', 'release', 10)), peak = W(atAge('release', 'release', 180)), after = W(atAge('release', 'release', 800));
  assert.equal(count(gather, 'CELEBRATING'), 0, 'nobody celebrates before the party');
  assert.ok(gather.npcs.some((e) => e.state === 'WALKING' && e.dy < 0), 'people walk up the road to the castle');
  const crowd = peak.npcs.filter((e) => e.state === 'CELEBRATING');
  assert.ok(crowd.length >= 4, `a crowd of ${crowd.length}`); assert.ok(crowd.every((e) => dist([e.x, e.y], [88, 103]) < 20), 'the crowd stands in front of the castle');
  assert.equal(new Set(crowd.map((e) => `${e.x},${e.y}`)).size, crowd.length, 'nobody stands on somebody else');
  const rest = after.npcs.filter((e) => e.state === 'RESTING' && dist([e.x, e.y], [88, 103]) < 20); assert.ok(rest.length >= 1 && !after.npcs.some((e) => e.state === 'CELEBRATING' && dist([e.x, e.y], [88, 103]) < 20));
  assert.equal(CROWD.length, 12);
});

test('people react to the workflow: guards and builders run to the fortress with buckets; a crew repairs it', () => {
  const fail = W(world('storm')), fix = W(world('recovery'));
  assert.ok(fail.npcs.some((e) => e.role === 'guard' && e.top === 'bucket') && fail.npcs.some((e) => e.role === 'builder' && e.top === 'bucket'), 'responders carry buckets');
  assert.ok(fail.npcs.filter((e) => e.top === 'bucket').every((e) => e.state === 'WALKING' && e.dx > 0), 'they walk east, toward the CI');
  assert.ok(fix.npcs.filter((e) => e.role === 'builder' && e.state === 'WORKING').length >= 2, 'a repair crew works at the fortress');
  assert.ok(fix.npcs.filter((e) => e.role === 'builder' && e.state === 'WORKING').every((e) => dist([e.x, e.y], [154, 99]) < 20));
  assert.equal(W(world('day')).npcs.filter((e) => e.top === 'bucket').length, 0, 'no alarm, no buckets');
});

test('choreography draws: the hero walks on the road in the picture, and a timeline of pictures differs where the story differs', () => {
  const pics = [5, 180, 800].map((m) => renderKingdom(atAge('release', 'release', m), { cfg }));
  for (const svg of pics) assert.deepEqual(lintSvg(svg), []);
  assert.equal(new Set(pics).size, 3, 'start, peak and aftermath look different');
  assert.ok(pics[1].includes('class="tw"') && pics[1].length > 0);
  const walk = renderHero(atAge('release', 'release', 10), { cfg }), still = renderHero(atAge('release', 'release', 180), { cfg });
  assert.notEqual(walk, still); assert.deepEqual(lintSvg(walk), []);
  assert.equal(renderKingdom(atAge('release', 'release', 5), { cfg }), renderKingdom(atAge('release', 'release', 5), { cfg }), 'deterministic');
  assert.ok(NODES.castle && inside(88, 103, [60, 90, 56, 30]));
});
