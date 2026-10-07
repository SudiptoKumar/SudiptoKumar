// Actors: ~30 named citizens + a deterministic ambient cohort.
// Every actor resolves to the spec §07 §6 shape:
//   { id, role, homeAnchor, workAnchor, routeId, state, x, y, facing,
//     task, progress, priority, seed }
// Positions come from chained itineraries (movement.mjs) so they are
// continuous across buckets; state/task/priority come from the scheduler.
import { subRng } from '../util.mjs';
import { nodeById } from '../world/roads.mjs';
import { cachedRoute, positionOnItinerary, maxHourlyStep } from './movement.mjs';
import { scheduleFor } from './scheduler.mjs';

// id, role, home, work, kind, post options for patrol kinds
const NAMED = [
  ['builder-borin', 'builder', 'residential_cross', 'builder_yard', 'worker'],
  ['builder-tilda', 'builder', 'residential_cross', 'warehouse', 'worker'],
  ['builder-okafor', 'builder', 'builder_yard', 'project_quarter', 'worker'],
  ['farmer-elsa', 'farmer', 'farm_entrance', 'farm_entrance', 'worker'],
  ['farmer-bram', 'farmer', 'farm_entrance', 'mill', 'worker'],
  ['farmer-yuki', 'farmer', 'farm_entrance', 'orchard_gate', 'worker'],
  ['guard-aldric', 'guard', 'barracks', 'east_gate', 'patrol', ['east_gate', 'watch_north']],
  ['guard-briga', 'guard', 'barracks', 'west_gate', 'patrol', ['west_gate', 'castle_gate']],
  ['guard-cato', 'guard', 'barracks', 'watch_north', 'patrol', ['watch_north', 'war_front']],
  ['guard-dagna', 'guard', 'barracks', 'war_front', 'patrol', ['war_front', 'frontier_pass']],
  ['engineer-fenn', 'engineer', 'project_quarter', 'automation_fortress', 'worker'],
  ['engineer-gale', 'engineer', 'project_quarter', 'automation_fortress', 'worker'],
  ['messenger-hollis', 'messenger', 'courier_station', 'courier_station', 'wander', ['market_square', 'royal_plaza']],
  ['messenger-ivy', 'messenger', 'courier_station', 'courier_station', 'wander', ['project_quarter', 'castle_gate']],
  ['merchant-joren', 'merchant', 'market_square', 'market_square', 'wander', ['market_square', 'harbor_docks']],
  ['merchant-kessa', 'merchant', 'market_square', 'harbor_docks', 'wander', ['market_square', 'courier_station']],
  ['merchant-ludo', 'merchant', 'market_square', 'market_square', 'wander', ['market_square', 'builder_yard']],
  ['scholar-mira', 'scholar', 'knowledge_hall', 'knowledge_hall', 'worker'],
  ['scholar-nils', 'scholar', 'residential_cross', 'knowledge_hall', 'worker'],
  ['scout-odda', 'scout', 'scout_lodge', 'watch_north', 'patrol', ['scout_lodge', 'hidden_shrine']],
  ['scout-pell', 'scout', 'scout_lodge', 'watch_north', 'patrol', ['watch_north', 'frontier_pass']],
  ['smith-quinn', 'smith', 'workshop_row', 'workshop_row', 'worker'],
  ['smith-runa', 'smith', 'workshop_row', 'warehouse', 'worker'],
  ['visitor-sable', 'visitor', 'harbor_docks', 'visitor_camp', 'wander', ['visitor_camp', 'market_square']],
  ['visitor-tobin', 'visitor', 'harbor_docks', 'visitor_camp', 'wander', ['harbor_docks', 'visitor_camp']],
];

const AMBIENT_ROLES = ['citizen', 'citizen', 'child', 'elder', 'traveler', 'guard', 'merchant', 'farmer'];
const AMBIENT_HOMES = ['residential_cross', 'market_square', 'farm_entrance', 'hero_guild', 'visitor_camp'];
const AMBIENT_HUBS = ['market_square', 'royal_plaza', 'main_bridge', 'farm_entrance'];
const AMBIENT_COUNT = 22;

/** Chained daily itinerary; every leg's `from` equals the previous leg's `to`.
 * prIntensity (spec §06.2): 'active'/'surge' reroutes messengers onto the
 * project quarter -> castle document-run corridor; anything else keeps
 * their routine wander posts. Pure + deterministic. */
export function itineraryFor(spec, seed, warOverride = false, prIntensity = 'unknown') {
  const r = subRng(seed, 'itinerary', spec.id);
  const { home, work, kind } = spec;
  const legs = [];
  const leg = (from, to, startH, endH) => legs.push({ from, to, startH, endH });

  if (warOverride && (spec.role === 'guard' || spec.role === 'scout')) {
    // Mobilized: barracks <-> war_front loop (event-caused destination change).
    const post = spec.role === 'guard' ? 'war_front' : 'watch_north';
    leg(home, post, 0, 4); leg(post, home, 4, 5);
    leg(home, post, 5, 9); leg(post, home, 9, 10);
    leg(home, post, 10, 14); leg(post, home, 14, 15);
    leg(home, post, 15, 19); leg(post, home, 19, 20);
    leg(home, home, 20, 24);
    return { legs };
  }
  if (kind === 'patrol') {
    const [postA, postB] = spec.posts ?? [work, home];
    leg(home, home, 0, 5);
    leg(home, postA, 5, 8);
    leg(postA, postB, 8, 14);
    leg(postB, postA, 14, 19);
    leg(postA, home, 19, 22);
    leg(home, home, 22, 24);
  } else if (kind === 'wander') {
    // PR -> courier network: at 'active'/'surge', messengers abandon their
    // routine rounds for the project quarter -> castle document-run corridor.
    // Quiet/unknown signal keeps the routine posts (spec §06.12).
    let [hubA, hubB] = spec.posts ?? [work, home];
    if (spec.role === 'messenger' && (prIntensity === 'active' || prIntensity === 'surge')) {
      hubA = 'project_quarter'; hubB = 'castle_gate';
    }
    leg(home, home, 0, 6);
    leg(home, hubA, 6, 9);
    leg(hubA, hubB, 9, 15);
    leg(hubB, home, 15, 18);
    leg(home, home, 18, 24);
  } else {
    // worker: home -> work -> home
    const wobble = r.int(-30, 30) / 60; // deterministic stagger, keeps chaining
    leg(home, home, 0, 6);
    leg(home, work, 6, 9 + wobble);
    leg(work, work, 9 + wobble, 17);
    leg(work, home, 17, 19.5 + wobble);
    leg(home, home, 19.5 + wobble, 24);
  }
  return { legs };
}

function resolveOne(spec, seed, clock, schedCtx, warOverride) {
  const itin = itineraryFor(spec, seed, warOverride, schedCtx?.prIntensity ?? 'unknown');
  const pos = positionOnItinerary(itin, clock.timeOfDay, 's');
  const sched = scheduleFor(spec.role, clock, schedCtx);
  // War mobilization overrides the schedule state for combat roles.
  let { state, task, priority } = sched;
  if (warOverride && (spec.role === 'guard' || spec.role === 'scout')) {
    const battle = ['APPROACH', 'BATTLE', 'TURNING_POINT'].includes(schedCtx.warPhase);
    state = battle ? 'fighting' : 'patrolling';
    task = battle ? 'defending the front' : 'mobilized to the front';
    priority = 100;
  }
  return {
    id: spec.id,
    role: spec.role,
    homeAnchor: spec.home,
    workAnchor: spec.work,
    routeId: pos.routeId,
    state, x: Math.round(pos.x), y: Math.round(pos.y),
    facing: pos.facing, task,
    progress: pos.progress,
    priority,
    seed: `${spec.id}:${seed}`,
  };
}

function ambientSpecs(seed) {
  const r = subRng(seed, 'ambient');
  const specs = [];
  for (let i = 0; i < AMBIENT_COUNT; i++) {
    const role = r.pick(AMBIENT_ROLES);
    const home = r.pick(AMBIENT_HOMES);
    const hubA = r.pick(AMBIENT_HUBS); const hubB = r.pick(AMBIENT_HUBS);
    specs.push({
      id: `ambient-${String(i).padStart(2, '0')}`,
      role, home, work: hubA,
      kind: role === 'guard' ? 'patrol' : 'wander',
      posts: role === 'guard' ? ['east_gate', 'market_square'] : [hubA, hubB],
    });
  }
  return specs;
}

/**
 * Build all citizen actors for a tick.
 * @returns {{ actors: object[], maxStep: Map }} actors + per-actor max hourly
 *   step (exposed for the no-teleport test).
 */
export function buildActors(world, clock, schedCtx) {
  const seed = world.seed;
  const atWar = schedCtx.warPhase !== 'PEACE' && schedCtx.warPhase !== 'RESOLVED';
  const actors = [];
  const maxStep = new Map();
  const specs = [
    ...NAMED.map(([id, role, home, work, kind, posts]) => ({ id, role, home, work, kind, posts })),
    ...ambientSpecs(seed),
  ];
  for (const spec of specs) {
    if (nodeById(spec.home) === null || nodeById(spec.work) === null) continue;
    const warOverride = atWar && (spec.role === 'guard' || spec.role === 'scout');
    const itin = itineraryFor(spec, seed, warOverride, schedCtx.prIntensity ?? 'unknown');
    maxStep.set(spec.id, maxHourlyStep(itin) + 64);
    actors.push(resolveOne(spec, seed, clock, schedCtx, warOverride));
  }
  actors.sort((a, b) => (a.id < b.id ? -1 : 1));
  return { actors, maxStep };
}
