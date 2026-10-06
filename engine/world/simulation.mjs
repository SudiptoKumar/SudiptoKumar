// TRUE V3 Simulation core (V3 §2/§3). The Simulation is the authoritative temporal
// behavior layer: given the same World + tick, it produces the same Simulation.
// World is geography; Simulation is what happens in it over time.
import { rng, sha, canonical } from '../util.mjs';
import { SIM_VERSION } from './constants.mjs';

/** Time-of-day bands for actor schedules (V3 §7/§12). */
export const TIME_BANDS = ['predawn', 'dawn', 'morning', 'noon', 'afternoon', 'sunset', 'evening', 'night', 'deepnight'];

/** Map a world phase + hour to a simulation time band. */
export function timeBandFor(phase, hour = 12) {
  if (phase === 'night') return hour < 3 ? 'deepnight' : 'night';
  if (phase === 'dawn') return hour < 6 ? 'predawn' : 'dawn';
  if (phase === 'evening') return hour < 19 ? 'sunset' : 'evening';
  // day: split into morning/noon/afternoon
  if (hour < 10) return 'morning';
  if (hour < 14) return 'noon';
  return 'afternoon';
}

/**
 * scheduleFor(npc, band): what an NPC is doing in this time band.
 * Deterministic: same NPC + band = same schedule state.
 */
export function scheduleFor(npc, band) {
  const role = npc.role || 'citizen';
  // Night: most sleep, guards patrol
  if (band === 'night' || band === 'deepnight') {
    if (role === 'guard') return 'patrolling';
    if (role === 'scout') return 'watching';
    return 'sleeping';
  }
  // Predawn/dawn: workers leave homes
  if (band === 'predawn' || band === 'dawn') {
    if (['builder', 'farmer', 'miner'].includes(role)) return 'walking';
    if (role === 'guard') return 'patrolling';
    return 'waking';
  }
  // Day bands: work
  if (['morning', 'noon', 'afternoon'].includes(band)) {
    if (role === 'builder') return 'working';
    if (role === 'farmer') return 'working';
    if (role === 'merchant') return band === 'noon' ? 'trading' : 'working';
    if (role === 'messenger') return 'walking';
    if (role === 'guard') return 'patrolling';
    if (role === 'scholar') return 'studying';
    return 'working';
  }
  // Sunset/evening: return home, lights on
  if (band === 'sunset' || band === 'evening') {
    if (role === 'guard') return 'patrolling';
    if (role === 'merchant') return 'trading';
    return 'returning';
  }
  return 'idle';
}

/**
 * buildSimulation(world, ctx): derive the temporal simulation from the world.
 * ctx.tick: integer time bucket (hour of day 0-23, or workflow run sequence).
 * ctx.now: Date for time-band computation.
 *
 * Deterministic: same world.signature + tick = same simulation.
 */
export function buildSimulation(world, ctx = {}) {
  const tick = ctx.tick ?? 12;
  const now = ctx.now || new Date();
  const hour = now.getHours ? now.getHours() : 12;
  const band = timeBandFor(world.time.phase, hour);
  const seed = `sim:${world.signature}:${tick}`;
  const r = rng(seed);

  // Actor schedules: every NPC gets a deterministic state for this tick
  const npcs = world.population?.npcs || [];
  const actors = npcs.map((npc, i) => {
    const state = scheduleFor(npc, band);
    // Deterministic position offset for walking actors (not teleporting)
    const walking = state === 'walking' || state === 'patrolling' || state === 'returning';
    return {
      id: npc.id || `npc-${i}`,
      role: npc.role || 'citizen',
      x: npc.x, y: npc.y,
      home: npc.home || null,
      work: npc.work || null,
      state,
      walking,
      // deterministic facing: based on seed, not random
      facing: r() < 0.5 ? 'left' : 'right',
      band,
    };
  });

  // Building states: lifecycle + construction progress
  const buildings = (world.repositories || []).map((repo) => ({
    name: repo.name,
    x: repo.x, y: repo.y,
    level: repo.level,
    lifecycle: repo.lifecycle?.key || 'active',
    // construction progress for buildings being built/upgraded
    construction: constructionFor(repo, band, r),
  }));

  const sim = {
    version: SIM_VERSION,
    tick,
    band,
    seed,
    actors,
    buildings,
  };
  sim.signature = simSignature(sim);
  return sim;
}

/** Deterministic construction progress for a building. */
function constructionFor(repo, band, r) {
  const lc = repo.lifecycle?.key;
  if (lc === 'building' || lc === 'construction') {
    // Progress 0..1, deterministic per repo + band
    return Math.round(r() * 100) / 100;
  }
  return null;
}

/** Simulation signature: hash of tick, band, actor states, building states. */
export function simSignature(sim) {
  const facts = {
    v: sim.version,
    tick: sim.tick,
    band: sim.band,
    actors: sim.actors.map((a) => [a.id, a.state, a.facing]),
    buildings: sim.buildings.map((b) => [b.name, b.lifecycle, b.construction]),
  };
  return sha(canonical(facts), 16);
}
