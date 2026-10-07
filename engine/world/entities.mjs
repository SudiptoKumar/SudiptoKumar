// Actor registry: hero (first-class), companion, and the lock's 10 citizen
// roles + a deterministic ambient cohort. Semantic "work" descriptors from the
// lock are resolved to real road nodes here, so every actor stands on the
// road graph. Hero may be null — cameras must degrade gracefully (lock §6).
import { ACTOR_ROLES, HERO_DESTINATION_PRIORITY, HERO_STATES, ACTOR_STATES } from './constants.mjs';
import { nodeById, routeBetween } from './roads.mjs';
import { subRng } from '../util.mjs';

// lock "work" descriptors -> concrete work nodes on the road graph
const WORK_NODES = {
  'event-destination': null, // hero: resolved per event below
  'follows hero': null, // companion: follows hero
  builder_yard: ['builder_yard'],
  farms: ['farm_entrance', 'mill', 'orchard_gate'],
  'gates/towers/war_front': ['east_gate', 'west_gate', 'watch_north', 'war_front'],
  automation_fortress: ['automation_fortress'],
  'road network': ['project_quarter', 'courier_station', 'market_square', 'castle_gate'],
  'market/harbor_docks': ['market_square', 'harbor_docks'],
  knowledge_hall: ['knowledge_hall'],
  'highforest/watch_north': ['scout_lodge', 'hidden_shrine', 'watch_north'],
  workshops: ['workshop_row', 'warehouse'],
  'visitor_camp/market_square': ['visitor_camp', 'market_square'],
};

const AMBIENT_ROLES = ['citizen', 'citizen', 'child', 'elder', 'traveler', 'guard', 'merchant', 'farmer'];

/** Hero destination priority (lock §6): war > CI failure > release > achievement > visitor > routine. */
export function heroDestination(state) {
  const war = state?.war?.phase ?? 'PEACE';
  if (war !== 'PEACE' && war !== 'RESOLVED') return { kind: 'war', node: 'war_front', reason: `war:${war}` };
  if (state?.ci?.status === 'failing') return { kind: 'ci-failure', node: 'automation_fortress', reason: 'ci failing' };
  const ev = state?.events?.list ?? [];
  if (ev.some((e) => e.type === 'release' && e.phase !== 'RESOLVED')) return { kind: 'release', node: 'royal_plaza', reason: 'release' };
  if (ev.some((e) => e.type === 'achievement' && e.phase !== 'RESOLVED')) return { kind: 'achievement', node: 'hall_of_heroes', reason: 'achievement' };
  if (ev.some((e) => e.type === 'visitor' && e.phase !== 'RESOLVED')) return { kind: 'visitor', node: 'visitor_camp', reason: 'visitor' };
  return { kind: 'routine', node: 'market_square', reason: 'quiet routine' };
}

function pointOnRoute(route, progress) {
  if (!route || route.length === 0) return { x: 0, y: 0 };
  if (route.length === 1 || progress <= 0) return { ...route[0] };
  if (progress >= 1) return { ...route[route.length - 1] };
  const seg = progress * (route.length - 1);
  const i = Math.floor(seg); const t = seg - i;
  const a = route[i]; const b = route[i + 1];
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Canonical resting/working state for a role in a day band (world layer; simulation animates). */
export function stateForBand(role, band) {
  if (band === 'deepnight') return role === 'guard' ? 'patrolling' : 'sleeping';
  if (band === 'night') {
    if (role === 'guard') return 'patrolling';
    if (role === 'merchant') return 'trading';
    return 'sleeping';
  }
  if (band === 'predawn' || band === 'dawn') return role === 'farmer' ? 'working' : 'idle';
  if (role === 'hero') return 'traveling';
  if (role === 'companion') return 'following';
  if (role === 'builder') return 'working';
  if (role === 'farmer') return 'working';
  if (role === 'guard') return 'patrolling';
  if (role === 'engineer') return 'repairing';
  if (role === 'messenger') return 'walking';
  if (role === 'merchant') return 'trading';
  if (role === 'scholar') return 'studying';
  if (role === 'scout') return 'scouting';
  if (role === 'smith') return 'working';
  if (role === 'visitor') return 'walking';
  return 'idle';
}

/**
 * Build hero + companion + actors. Pure + deterministic.
 * @param {object} state normalized domain state
 * @param {string} seed world seed
 */
export function buildEntities(state, seed) {
  const band = state?.time?.phase ?? 'morning';
  const heroPresent = state?.hero?.present !== false;
  const r = subRng(seed, 'entities');

  // ---- hero ----
  let hero = null; let companion = null;
  if (heroPresent) {
    const dest = heroDestination(state);
    const route = routeBetween('hero_guild', dest.node) ?? [nodeById('hero_guild')];
    const progress = 0.3 + r() * 0.5; // mid-journey at rest pose
    const p = pointOnRoute(route, progress);
    hero = {
      id: 'hero',
      role: 'hero',
      name: state?.hero?.name ?? 'Hero',
      class: state?.hero?.class ?? 'wanderer',
      gearTier: state?.hero?.gearTier ?? 1,
      home: 'hero_guild',
      destination: dest.node,
      destinationKind: dest.kind,
      destinationReason: dest.reason,
      route: route.map((q) => ({ x: Math.round(q.x), y: Math.round(q.y) })),
      progress: Math.round(progress * 1000) / 1000,
      state: stateForBand('hero', band),
      task: dest.kind === 'routine' ? 'daily rounds' : `responding: ${dest.kind}`,
      x: Math.round(p.x), y: Math.round(p.y),
      facing: dest.node === 'hero_guild' ? 's' : 'e',
      seed: `hero:${seed}`,
    };
    const cp = pointOnRoute(route, Math.max(0, progress - 0.04));
    companion = {
      id: 'companion',
      role: 'companion',
      home: 'hero_guild',
      state: stateForBand('companion', band),
      task: 'following hero',
      x: Math.round(cp.x + 12), y: Math.round(cp.y + 10),
      facing: hero.facing,
      progress: hero.progress,
      seed: `companion:${seed}`,
    };
  }

  // ---- citizen roles ----
  const actors = [];
  for (const { role, home, work } of ACTOR_ROLES) {
    if (role === 'hero' || role === 'companion') continue;
    const workNodes = WORK_NODES[work] ?? [home];
    const target = workNodes[Math.floor(r() * workNodes.length)] ?? home;
    const route = routeBetween(home, target) ?? [{ x: nodeById(home).x, y: nodeById(home).y }];
    const atWork = ['morning', 'noon', 'afternoon'].includes(band) && r.bool(0.7);
    const p = pointOnRoute(route, atWork ? 0.85 + r() * 0.15 : r() * 0.2);
    const st = stateForBand(role, band);
    actors.push({
      id: `${role}-1`,
      role,
      home,
      workplace: target,
      routeId: `${home}>${target}`,
      state: st,
      task: `${role} ${st}`,
      x: Math.round(p.x + r.int(-10, 10)),
      y: Math.round(p.y + r.int(-10, 10)),
      facing: r.pick(['n', 's', 'e', 'w']),
      progress: 0,
      seed: `${role}:${seed}`,
    });
  }

  // ---- ambient cohort: deterministic crowd sprites (~24), named + stable ----
  const cohortSize = 20 + Math.floor(r() * 8);
  for (let i = 0; i < cohortSize; i++) {
    const role = r.pick(AMBIENT_ROLES);
    const home = r.pick(['residential_cross', 'market_square', 'farm_entrance', 'hero_guild', 'visitor_camp']);
    const target = r.pick(['market_square', 'royal_plaza', 'farm_entrance', 'main_bridge']);
    const route = routeBetween(home, target) ?? [{ x: 0, y: 0 }];
    const p = pointOnRoute(route, r());
    actors.push({
      id: `ambient-${String(i).padStart(2, '0')}`,
      role,
      home,
      workplace: target,
      routeId: `${home}>${target}`,
      state: stateForBand(role, band),
      task: `${role} ${stateForBand(role, band)}`,
      x: Math.round(p.x), y: Math.round(p.y),
      facing: r.pick(['n', 's', 'e', 'w']),
      progress: 0,
      seed: `ambient-${i}:${seed}`,
    });
  }

  return { hero, companion, actors };
}

/** All entity states used are legal enums (test helper). */
export const legalEntityStates = () => [...new Set([...HERO_STATES, ...ACTOR_STATES])];
export { HERO_DESTINATION_PRIORITY };
