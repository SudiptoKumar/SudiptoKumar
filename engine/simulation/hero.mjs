// Hero: event-driven destination state machine + companion.
// Destination priority (lock §6): war > CI failure > release > achievement >
// visitor > routine. The hero travels the real road graph (routeBetween);
// the companion follows on the same route with a deterministic lag.
// world.hero === null must not throw (interface rule 4).
import { cachedRoute, pointAt, facingFrom } from './movement.mjs';

const HOME = 'hero_guild';

/** Chained hero itinerary legs (exported for the no-teleport test). */
export function heroLegs(dest) {
  return [
    { from: HOME, to: HOME, startH: 0, endH: 6 },
    { from: HOME, to: dest, startH: 6, endH: 10 },
    { from: dest, to: dest, startH: 10, endH: 16 },
    { from: dest, to: HOME, startH: 16, endH: 20 },
    { from: HOME, to: HOME, startH: 20, endH: 24 },
  ];
}

/**
 * @param {object} world read-only world
 * @param {object} clock from clock.mjs
 * @param {object} ctx { warPhase, ciStatus, eventTypes: Map, rules }
 * @returns {{ hero: object|null, companion: object|null, directive: object|null }}
 */
export function simulateHero(world, clock, ctx) {
  if (!world?.hero) return { hero: null, companion: null, directive: null };
  const seed = world.seed;
  const { warPhase = 'PEACE', ciStatus = 'unknown', eventTypes = new Map() } = ctx ?? {};

  // --- destination priority ---
  let kind = 'routine'; let node = 'market_square'; let reason = 'quiet routine';
  if (warPhase !== 'PEACE' && warPhase !== 'RESOLVED') { kind = 'war'; node = 'war_front'; reason = `war:${warPhase}`; }
  else if (ciStatus === 'failing') { kind = 'ci-failure'; node = 'automation_fortress'; reason = 'CI failing'; }
  else if (eventTypes.has('release')) { kind = 'release'; node = 'royal_plaza'; reason = 'release celebration'; }
  else if (eventTypes.has('achievement')) { kind = 'achievement'; node = 'hall_of_heroes'; reason = 'achievement honor'; }
  else if (eventTypes.has('visitor')) { kind = 'visitor'; node = 'visitor_camp'; reason = 'visitor welcome'; }
  const directive = { kind, node, reason };

  // --- hero state by situation ---
  const battle = ['APPROACH', 'BATTLE', 'TURNING_POINT'].includes(warPhase);
  const releasePeak = eventTypes.get('release') === 'PEAK';
  let heroState = 'traveling'; let heroTask = 'daily rounds';
  if (kind === 'war') { heroState = battle ? 'fighting' : 'traveling'; heroTask = battle ? 'defending the front' : `responding: war ${warPhase.toLowerCase()}`; }
  else if (kind === 'ci-failure') { heroState = 'repairing'; heroTask = 'aiding fortress recovery'; }
  else if (kind === 'release') { heroState = releasePeak ? 'celebrating' : 'traveling'; heroTask = releasePeak ? 'leading the celebration' : 'heading to the royal plaza'; }
  else if (kind === 'achievement') { heroState = 'inspecting'; heroTask = 'honoring the achievement'; }
  else if (kind === 'visitor') { heroState = 'traveling'; heroTask = 'welcoming visitors'; }
  if (clock.band === 'deepnight' && kind === 'routine') { heroState = 'sleeping'; heroTask = 'resting at the guild'; }
  else if (clock.nightBand && kind === 'routine') { heroState = 'idle'; heroTask = 'evening at the guild'; }

  // --- chained itinerary: guild -> destination -> guild ---
  const dest = node;
  const legs = heroLegs(dest);
  const t = clock.timeOfDay;
  let leg = legs[legs.length - 1];
  for (const l of legs) if (t >= l.startH && t < l.endH) { leg = l; break; }
  const route = cachedRoute(leg.from, leg.to);
  const span = Math.max(leg.endH - leg.startH, 1e-6);
  const progress = Math.min(1, Math.max(0, (t - leg.startH) / span));
  const p = pointAt(route ?? [{ x: 0, y: 0 }], progress);
  const p2 = pointAt(route ?? [{ x: 0, y: 0 }], Math.min(1, progress + 0.01));
  const moving = Math.hypot(p2.x - p.x, p2.y - p.y) > 0.01 && progress < 1;
  const atDest = leg.from === dest && leg.to === dest;
  const atHome = leg.from === HOME && leg.to === HOME;
  const state = atDest ? heroState
    : atHome && kind === 'routine' && clock.band === 'deepnight' ? 'sleeping'
    : atHome && kind === 'routine' && clock.nightBand ? 'idle'
    : moving ? 'traveling' : heroState;

  const hero = {
    id: 'hero',
    role: 'hero',
    name: world.hero.name ?? 'Hero',
    homeAnchor: HOME,
    workAnchor: dest,
    routeId: `${leg.from}>${leg.to}`,
    destinationKind: kind,
    destinationReason: reason,
    state, x: Math.round(p.x), y: Math.round(p.y),
    facing: facingFrom(p2.x - p.x, p2.y - p.y) ?? 'e',
    task: heroTask,
    progress: Math.round(progress * 1000) / 1000,
    priority: kind === 'routine' ? 20 : 95,
    gearTier: world.hero.gearTier ?? 1,
    seed: `hero:${seed}`,
  };

  // --- companion: same route, lagged progress; a true trail, never a teleport ---
  const lag = 0.035;
  const cp = pointAt(route ?? [{ x: 0, y: 0 }], Math.max(0, progress - lag));
  const cp2 = pointAt(route ?? [{ x: 0, y: 0 }], Math.max(0, progress - lag + 0.01));
  let cState = 'following'; let cTask = 'following hero';
  if (heroState === 'celebrating') { cState = 'celebrating'; cTask = 'celebrating with hero'; }
  else if (heroState === 'fighting' || heroState === 'defending') { cState = 'alert'; cTask = 'watching the battle'; }
  else if (state === 'sleeping' || state === 'idle') { cState = 'waiting'; cTask = 'waiting at the guild'; }
  const companion = {
    id: 'companion',
    role: 'companion',
    homeAnchor: HOME,
    workAnchor: dest,
    routeId: `${leg.from}>${leg.to}`,
    state: cState, x: Math.round(cp.x), y: Math.round(cp.y),
    facing: facingFrom(cp2.x - cp.x, cp2.y - cp.y) ?? 'e',
    task: cTask,
    progress: Math.round(Math.max(0, progress - lag) * 1000) / 1000,
    priority: 15,
    seed: `companion:${seed}`,
  };
  return { hero, companion, directive };
}
