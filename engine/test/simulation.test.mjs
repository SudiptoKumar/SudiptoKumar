// Simulation layer tests: determinism, routes, hero, war, construction,
// schedules, no-teleport, companion, event priority.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildWorld } from '../world/world.mjs';
import { nodeById } from '../world/roads.mjs';
import { WAR_PHASES } from '../world/constants.mjs';
import { sampleState } from './fixture.mjs';
import { simulate, serializeSnapshot, assertValidSnapshot } from '../simulation/simulate.mjs';
import { validateSimulationSchema } from '../validation/schema.mjs';
import { cachedRoute, distToRoute, routeLength } from '../simulation/movement.mjs';
import { bandForHour, seasonForMonth, gateAurora, resolveClock } from '../simulation/clock.mjs';
import { behaviorRules } from '../simulation/weather.mjs';
import { taskStateFor, TASK_STATES } from '../simulation/construction.mjs';
import { isLegalWarTransition, WAR_ORDER } from '../simulation/war.mjs';
import { scheduleFor, PRIORITY } from '../simulation/scheduler.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const QUIET_INPUTS = { events: [], warPhase: 'PEACE', ciStatus: 'healthy', releases: [] };
const BUCKET = '2026-10-07T06:00:06+06:00';

const sim = (overrides = {}, bucket = BUCKET, inputs = QUIET_INPUTS) =>
  simulate(buildWorld(sampleState(overrides)), { timeBucket: bucket, inputs });

const heroOf = (snap) => snap.actors.find((a) => a.id === 'hero');
const byId = (snap, id) => snap.actors.find((a) => a.id === id);

describe('simulation schema + quiet default', () => {
  it('snapshot validates against simulation-v3.schema.json', () => {
    const s = sim({ releases: [] });
    assertValidSnapshot(s);
    assert.deepEqual(validateSimulationSchema(s), []);
    assert.equal(s.version, '3');
    assert.equal(s.timeBucket, BUCKET);
  });

  it('quiet state: daily life only, no invented drama', () => {
    const s = sim({ releases: [] });
    assert.equal(s.war.state, 'PEACE');
    assert.deepEqual(s.effects, []);
    assert.deepEqual(s.war.enemyCohort, []);
    assert.ok(s.actors.length >= 40, `expected density, got ${s.actors.length}`);
  });

  it('snapshot is compact: sane sizes, no SVG embedded', () => {
    const s = sim({ releases: [] });
    assert.ok(s.actors.length >= 40 && s.actors.length <= 80, `actors=${s.actors.length}`);
    assert.ok(s.tasks.length <= 15, `tasks=${s.tasks.length}`);
    assert.ok(s.effects.length <= 25, `effects=${s.effects.length}`);
    const json = serializeSnapshot(s);
    assert.ok(!json.includes('<svg'), 'no SVG embedded');
    assert.ok(json.length < 200000, `snapshot too large: ${json.length}`);
  });
});

describe('determinism', () => {
  it('same (world, timeBucket, inputs) -> byte-identical snapshot', () => {
    const a = serializeSnapshot(sim());
    const b = serializeSnapshot(sim());
    assert.equal(a, b);
  });

  it('byte-identical across two processes', () => {
    const helper = join(HERE, 'sim-hash.mjs');
    const run = (bucket) =>
      execFileSync(process.execPath, [helper, bucket], { encoding: 'utf8' }).trim();
    const h1 = run(BUCKET);
    const h2 = run(BUCKET);
    console.log(`    determinism hashes: ${h1} / ${h2}`);
    assert.equal(h1, h2);
    assert.match(h1, /^[0-9a-f]{16}$/);
    assert.notEqual(h1, run('2026-10-07T12:00:00+06:00'), 'different bucket -> different snapshot');
  });

  it('named buckets are deterministic too', () => {
    const a = serializeSnapshot(sim({}, 'demo-night'));
    const b = serializeSnapshot(sim({}, 'demo-night'));
    assert.equal(a, b);
  });
});

describe('clock', () => {
  it('band bucketing from ISO timestamps', () => {
    assert.equal(bandForHour(4), 'predawn');
    assert.equal(bandForHour(6), 'dawn');
    assert.equal(bandForHour(9), 'morning');
    assert.equal(bandForHour(12), 'noon');
    assert.equal(bandForHour(15), 'afternoon');
    assert.equal(bandForHour(18), 'sunset');
    assert.equal(bandForHour(20), 'evening');
    assert.equal(bandForHour(23), 'night');
    assert.equal(bandForHour(2), 'deepnight');
  });

  it('season from month', () => {
    assert.equal(seasonForMonth(1), 'winter');
    assert.equal(seasonForMonth(4), 'spring');
    assert.equal(seasonForMonth(7), 'summer');
    assert.equal(seasonForMonth(10), 'autumn');
  });

  it('aurora gated to night bands only', () => {
    assert.equal(gateAurora('aurora', 'night'), 'aurora');
    assert.equal(gateAurora('aurora', 'deepnight'), 'aurora');
    assert.equal(gateAurora('aurora', 'sunset'), 'aurora');
    assert.equal(gateAurora('aurora', 'morning'), 'clear');
    assert.equal(gateAurora('aurora', 'noon'), 'clear');
  });

  it('named buckets recover band from name, weather from world', () => {
    const w = buildWorld(sampleState());
    const c = resolveClock('demo-night', w);
    assert.equal(c.band, 'night');
    assert.equal(c.season, w.time.season);
  });
});

describe('routes: actors move on the road graph', () => {
  it('every actor with a routeId has real road-node endpoints and sits on the route', () => {
    const s = sim({ releases: [] }, '2026-10-07T12:00:00+06:00');
    for (const a of s.actors) {
      if (!a.routeId) continue;
      const [from, to] = a.routeId.split('>');
      assert.ok(nodeById(from), `${a.id}: unknown from-node ${from}`);
      assert.ok(nodeById(to), `${a.id}: unknown to-node ${to}`);
      const route = cachedRoute(from, to);
      assert.ok(route, `${a.id}: no route ${a.routeId}`);
      const d = distToRoute(a.x, a.y, route);
      assert.ok(d <= 2, `${a.id} off route ${a.routeId} by ${d.toFixed(1)}u`);
    }
  });
});

describe('hero', () => {
  it('null hero in world -> no crash, no hero actors', () => {
    const s = sim({ hero: null, releases: [] });
    assert.ok(!s.actors.some((a) => a.id === 'hero' || a.id === 'companion'));
  });

  it('war -> war gate (war_front)', () => {
    const s = sim({ war: { phase: 'BATTLE' }, releases: [] }, '2026-10-07T12:00:00+06:00', { ...QUIET_INPUTS, warPhase: 'BATTLE' });
    const h = heroOf(s);
    assert.equal(h.destinationKind, 'war');
    assert.equal(h.workAnchor, 'war_front');
    assert.equal(h.state, 'fighting');
  });

  it('CI failure -> automation fortress', () => {
    const s = sim({ ci: { status: 'failing' }, releases: [] }, '2026-10-07T12:00:00+06:00', { ...QUIET_INPUTS, ciStatus: 'failing' });
    const h = heroOf(s);
    assert.equal(h.destinationKind, 'ci-failure');
    assert.equal(h.workAnchor, 'automation_fortress');
    assert.equal(h.state, 'repairing');
  });

  it('release -> castle plaza (royal_plaza)', () => {
    const s = sim({}, '2026-10-07T12:00:00+06:00');
    const h = heroOf(s);
    assert.equal(h.destinationKind, 'release');
    assert.equal(h.workAnchor, 'royal_plaza');
  });

  it('achievement -> hall of heroes', () => {
    const s = sim({ releases: [], events: [{ id: 'ach1', type: 'achievement', phase: 'APPROACH' }] }, '2026-10-07T12:00:00+06:00');
    const h = heroOf(s);
    assert.equal(h.destinationKind, 'achievement');
    assert.equal(h.workAnchor, 'hall_of_heroes');
  });

  it('visitor -> visitor camp', () => {
    const s = sim({ releases: [], events: [{ id: 'v1', type: 'visitor', phase: 'APPROACH' }] }, '2026-10-07T12:00:00+06:00');
    const h = heroOf(s);
    assert.equal(h.destinationKind, 'visitor');
    assert.equal(h.workAnchor, 'visitor_camp');
  });

  it('quiet -> routine (market square)', () => {
    const s = sim({ releases: [] }, '2026-10-07T12:00:00+06:00');
    const h = heroOf(s);
    assert.equal(h.destinationKind, 'routine');
    assert.equal(h.workAnchor, 'market_square');
  });

  it('hero carries gear tier from the world', () => {
    const s = sim({ releases: [] });
    assert.equal(heroOf(s).gearTier, 3);
  });
});

describe('companion', () => {
  it('follows the hero with a lag on the same route', () => {
    const s = sim({ releases: [] }, '2026-10-07T08:00:00+06:00');
    const h = heroOf(s); const c = byId(s, 'companion');
    assert.equal(h.state, 'traveling');
    assert.equal(c.routeId, h.routeId);
    assert.equal(c.state, 'following');
    assert.ok(c.progress < h.progress, 'companion trails behind');
    const d = Math.hypot(c.x - h.x, c.y - h.y);
    assert.ok(d < 250 && d > 0, `companion ${d.toFixed(0)}u from hero`);
  });

  it('celebrates when the hero celebrates, alerts in battle', () => {
    const rel = sim({ events: [{ id: 'r1', type: 'release', phase: 'PEAK' }] }, '2026-10-07T12:00:00+06:00');
    assert.equal(heroOf(rel).state, 'celebrating');
    assert.equal(byId(rel, 'companion').state, 'celebrating');
    const war = sim({ war: { phase: 'BATTLE' }, releases: [] }, '2026-10-07T12:00:00+06:00', { ...QUIET_INPUTS, warPhase: 'BATTLE' });
    assert.equal(byId(war, 'companion').state, 'alert');
  });
});

describe('war machine', () => {
  it('the 14-phase order walks legally peace -> ... -> resolved -> peace', () => {
    assert.deepEqual(WAR_ORDER, WAR_PHASES);
    // Canonical walk (victory branch); the lock lists VICTORY|DEFEAT as a
    // split, so the defeat branch is checked separately.
    const victoryWalk = ['PEACE', 'SCOUTING', 'THREAT_DETECTED', 'ALERT', 'MOBILIZATION', 'APPROACH', 'BATTLE', 'TURNING_POINT', 'VICTORY', 'AFTERMATH', 'REPAIR', 'RECOVERY', 'RESOLVED', 'PEACE'];
    for (let i = 0; i < victoryWalk.length - 1; i++) {
      assert.ok(isLegalWarTransition(victoryWalk[i], victoryWalk[i + 1]),
        `illegal step ${victoryWalk[i]} -> ${victoryWalk[i + 1]}`);
    }
    assert.ok(isLegalWarTransition('TURNING_POINT', 'DEFEAT'), 'defeat branch legal');
    assert.ok(isLegalWarTransition('DEFEAT', 'AFTERMATH'), 'defeat -> aftermath legal');
    assert.ok(!isLegalWarTransition('PEACE', 'BATTLE'), 'no skipping to battle');
    assert.ok(!isLegalWarTransition('BATTLE', 'PEACE'), 'battle must resolve through aftermath');
  });

  it('every phase simulates with the declared state', () => {
    for (const phase of WAR_ORDER) {
      const s = sim({ war: { phase }, releases: [] }, '2026-10-07T12:00:00+06:00', { ...QUIET_INPUTS, warPhase: phase });
      assert.equal(s.war.state, phase);
      assert.equal(s.war.phaseIndex, WAR_ORDER.indexOf(phase));
    }
  });

  it('battle changes guard/hero behavior; civilians shelter', () => {
    const s = sim({ war: { phase: 'BATTLE' }, releases: [] }, '2026-10-07T12:00:00+06:00', { ...QUIET_INPUTS, warPhase: 'BATTLE' });
    const guards = s.actors.filter((a) => a.role === 'guard' && !a.id.startsWith('ambient'));
    assert.ok(guards.every((g) => g.state === 'fighting'), 'named guards fight in battle');
    assert.ok(guards.every((g) => g.priority === PRIORITY.war));
    assert.ok(s.actors.some((a) => a.state === 'sheltering'), 'civilians shelter');
    assert.ok(s.war.enemyCohort.length === 8, 'enemy cohort deployed');
    assert.ok(s.war.effects.length > 0, 'battle fx present');
    assert.deepEqual(s.war.gates, { main_gate: 'closed', east_gate: 'closed', west_gate: 'closed' });
    const quiet = sim({ releases: [] }, '2026-10-07T12:00:00+06:00');
    assert.ok(!quiet.actors.some((a) => a.state === 'fighting' || a.state === 'sheltering'));
  });

  it('aftermath shows damage + repair tasks; recovery clears damage', () => {
    const after = sim({ war: { phase: 'AFTERMATH' }, releases: [] }, '2026-10-07T12:00:00+06:00', { ...QUIET_INPUTS, warPhase: 'AFTERMATH' });
    assert.ok(after.war.damage.length > 0, 'aftermath damage visible');
    assert.ok(after.tasks.some((t) => t.type === 'repair'), 'repair tasks dispatched');
    const rec = sim({ war: { phase: 'RECOVERY' }, releases: [] }, '2026-10-07T12:00:00+06:00', { ...QUIET_INPUTS, warPhase: 'RECOVERY' });
    assert.deepEqual(rec.war.damage, [], 'damage bounded: cleared by recovery');
    assert.deepEqual(rec.war.enemyCohort, [], 'cohort gone after battle');
  });
});

describe('construction lifecycle', () => {
  it('taskStateFor maps progress to the spec §07 §13 lifecycle', () => {
    assert.equal(taskStateFor(0), 'assigned');
    assert.equal(taskStateFor(0.1), 'collect-materials');
    assert.equal(taskStateFor(0.25), 'travel');
    assert.equal(taskStateFor(0.5), 'build');
    assert.equal(taskStateFor(0.5, { interrupted: true }), 'pause');
    assert.equal(taskStateFor(0.5, { resuming: true }), 'resume');
    assert.equal(taskStateFor(1, { daysSinceComplete: 0 }), 'return');
    assert.equal(taskStateFor(1, { daysSinceComplete: 5 }), 'complete');
    for (const s of ['assigned', 'collect-materials', 'travel', 'build', 'pause', 'resume', 'complete', 'return']) {
      assert.ok(TASK_STATES.includes(s), `task state ${s} in lifecycle`);
    }
  });

  it('buildings under construction get worker assignments + progress', () => {
    const s = sim({}, '2026-10-07T12:00:00+06:00');
    const buildTasks = s.tasks.filter((t) => t.type === 'build');
    assert.ok(buildTasks.length > 0, 'construction tasks exist');
    const world = buildWorld(sampleState());
    for (const t of buildTasks) {
      const b = world.buildings.find((x) => x.id === t.building);
      assert.ok(b, `task ${t.id} references a real building`);
      assert.ok(['foundation', 'construction', 'upgrading', 'repairing'].includes(b.lifecycle));
      assert.ok(typeof t.progress === 'number' && t.progress >= 0 && t.progress <= 1);
      assert.ok(t.assignee, 'worker assigned');
    }
  });

  it('lifecycle visibly advances across buckets (>=3 distinct states)', () => {
    const seen = new Set();
    for (let d = 1; d <= 30; d++) {
      const bucket = `2026-10-${String(d).padStart(2, '0')}T12:00:00+06:00`;
      for (const t of sim({}, bucket).tasks) seen.add(t.state);
    }
    assert.ok(seen.size >= 3, `only saw states: ${[...seen].join(',')}`);
    assert.ok(seen.has('build') && seen.has('complete'), `states: ${[...seen].join(',')}`);
  });

  it('storm halts construction (pause), winter/snow noted', () => {
    const s = sim({ time: { phase: 'morning', season: 'autumn', weather: 'storm' }, releases: [] }, '2026-10-07T09:00:00+06:00');
    assert.ok(!s.tasks.some((t) => t.state === 'build'), 'no active building during storm');
    assert.ok(s.actors.some((a) => a.state === 'sheltering'), 'citizens shelter in storm');
  });
});

describe('schedules: night / weather / season behavior', () => {
  const count = (s, pred) => s.actors.filter(pred).length;

  it('night reduces market/farm activity and increases guard patrol', () => {
    const noon = sim({ releases: [] }, '2026-10-07T12:00:00+06:00');
    const night = sim({ releases: [] }, '2026-10-07T23:00:00+06:00');
    const sleeping = (s) => count(s, (a) => a.state === 'sleeping');
    assert.ok(sleeping(night) > sleeping(noon), `night sleepers ${sleeping(night)} vs noon ${sleeping(noon)}`);
    const patrol = (s) => count(s, (a) => a.role === 'guard' && a.state === 'patrolling');
    assert.ok(patrol(night) >= patrol(noon), 'guards keep/doubled patrol at night');
    const trading = (s) => count(s, (a) => a.role === 'merchant' && a.state === 'trading');
    assert.ok(trading(night) < trading(noon), 'market quiets at night');
  });

  it('winter changes farm behavior and crops', () => {
    const world = buildWorld(sampleState({ time: { phase: 'morning', season: 'winter', weather: 'snow' } }));
    const winter = simulate(world, { timeBucket: '2026-01-15T09:00:00+06:00', inputs: QUIET_INPUTS });
    assert.equal(winter.farm.cropState, 'fallow');
    assert.equal(winter.clock.weather, 'snow');
    assert.equal(winter.clock.season, 'winter');
    const rules = behaviorRules(resolveClock('2026-01-15T09:00:00+06:00', world));
    assert.ok(rules.farmActivity < 0.5, `winter farmActivity=${rules.farmActivity}`);
  });

  it('rain marks outdoor work covered', () => {
    const s = sim({ time: { phase: 'morning', season: 'autumn', weather: 'rain' }, releases: [] }, '2026-10-07T09:00:00+06:00');
    assert.ok(s.actors.some((a) => a.task.includes('(covered)')), 'covered work in rain');
  });
});

describe('no teleporting', () => {
  it('actor positions between adjacent hourly buckets are continuous', () => {
    const world = buildWorld(sampleState({ releases: [] }));
    const snaps = ['2026-10-07T06:00:00+06:00', '2026-10-07T07:00:00+06:00', '2026-10-07T08:00:00+06:00']
      .map((b) => simulate(world, { timeBucket: b, inputs: QUIET_INPUTS }));
    const byIdAll = snaps.map((s) => new Map(s.actors.map((a) => [a.id, a])));
    const MIN_TRAVEL_LEG_H = 2; // shortest travel leg across itineraries
    for (const id of byIdAll[0].keys()) {
      for (let k = 0; k < 2; k++) {
        const a = byIdAll[k].get(id); const b = byIdAll[k + 1].get(id);
        const [from, to] = a.routeId.split('>');
        const bound = routeLength(cachedRoute(from, to)) / MIN_TRAVEL_LEG_H + 64;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        assert.ok(d <= bound, `${id} jumped ${d.toFixed(0)}u (bound ${bound.toFixed(0)}) between buckets ${k}->${k + 1}`);
      }
    }
  });
});

describe('event priority', () => {
  it('war outranks a major release for hero destination and focus', () => {
    const s = sim({ war: { phase: 'MOBILIZATION' }, releases: [] }, '2026-10-07T12:00:00+06:00', {
      ...QUIET_INPUTS, warPhase: 'MOBILIZATION',
      events: [{ id: 'rel-9', type: 'release', phase: 'PEAK' }],
      releases: [{ tag: 'v9.0.0', name: 'Big release' }],
    });
    assert.equal(heroOf(s).destinationKind, 'war');
    assert.equal(heroOf(s).workAnchor, 'war_front');
    assert.ok(s.war.effects.some((e) => ['signal-fire', 'smoke', 'fire'].includes(e.type)), 'war fx dominate');
  });

  it('CI failure outranks release; release outranks quiet routine', () => {
    const ci = sim({ ci: { status: 'failing' } }, '2026-10-07T12:00:00+06:00', {
      ...QUIET_INPUTS, ciStatus: 'failing', releases: [{ tag: 'v9.0.0' }],
    });
    assert.equal(heroOf(ci).destinationKind, 'ci-failure');
    const rel = sim({}, '2026-10-07T12:00:00+06:00');
    assert.equal(heroOf(rel).destinationKind, 'release');
  });

  it('scheduler priorities respect the ordering war > ci > release > construction > normal', () => {
    const ctx = (over) => ({ warPhase: 'PEACE', ciStatus: 'unknown', eventTypes: new Map(), rules: behaviorRules(resolveClock(BUCKET, buildWorld(sampleState()))), hasConstruction: false, ...over });
    const war = scheduleFor('guard', resolveClock(BUCKET, buildWorld(sampleState())), ctx({ warPhase: 'BATTLE' }));
    const ci = scheduleFor('engineer', resolveClock(BUCKET, buildWorld(sampleState())), ctx({ ciStatus: 'failing' }));
    const normal = scheduleFor('builder', resolveClock(BUCKET, buildWorld(sampleState())), ctx({}));
    assert.ok(war.priority > ci.priority && ci.priority > normal.priority);
    assert.equal(war.priority, PRIORITY.war);
  });
});

describe('economy', () => {
  it('cart routes run warehouse/farm/harbor loops with limited count', () => {
    const s = sim({ releases: [] }, '2026-10-07T12:00:00+06:00');
    const carts = s.actors.filter((a) => a.role === 'cart');
    assert.ok(carts.length >= 4 && carts.length <= 8, `carts=${carts.length}`);
    const routeIds = new Set(carts.map((c) => c.routeId));
    assert.ok([...routeIds].some((r) => r.includes('warehouse')));
    assert.ok([...routeIds].some((r) => r.includes('mill') || r.includes('farm')));
    assert.ok([...routeIds].some((r) => r.includes('harbor')));
    for (const c of carts) {
      const [from, to] = c.routeId.split('>');
      assert.ok(nodeById(from) && nodeById(to), `cart ${c.id} on real nodes`);
    }
  });

  it('autumn harvest readiness creates harvest tasks', () => {
    const s = sim({}, '2026-10-07T12:00:00+06:00'); // fixture: autumn, mature contributions
    assert.equal(s.farm.harvestReady, true);
    assert.ok(s.tasks.some((t) => t.type === 'harvest'));
  });
});
