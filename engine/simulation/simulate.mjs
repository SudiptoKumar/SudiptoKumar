// simulate(world, { timeBucket, inputs }) -> snapshot
// The simulation layer: reads the frozen world, never mutates it.
// Deterministic: identical (world, timeBucket, inputs) -> byte-identical
// snapshot. Every RNG stream is keyed on (world seed + timeBucket + subsystem)
// via subRng. See interface.md for the full contract.
import { SIM_VERSION } from '../world/constants.mjs';
import { canonical } from '../util.mjs';
import { resolveClock } from './clock.mjs';
import { behaviorRules } from './weather.mjs';
import { resolveEvents } from './events.mjs';
import { simulateWar } from './war.mjs';
import { constructionTasks } from './construction.mjs';
import { economyTick } from './economy.mjs';
import { buildActors } from './actors.mjs';
import { simulateHero } from './hero.mjs';
import { validateSimulationSchema } from '../validation/schema.mjs';

/**
 * @param {object} world buildWorld() output — treated as READ-ONLY
 * @param {object} args.timeBucket opaque tick id (ISO timestamp or named)
 * @param {object} args.inputs live-ish signals { events, warPhase, ciStatus, releases }
 * @returns {object} snapshot validating against simulation-v3.schema.json
 */
export function simulate(world, { timeBucket, inputs } = {}) {
  if (!world || typeof world !== 'object') throw new Error('simulate: world is required');
  const live = inputs ?? {};
  const clock = resolveClock(timeBucket, world);
  const rules = behaviorRules(clock);

  const warPhase = live.warPhase ?? world.war?.phase ?? 'PEACE';
  const ciStatus = live.ciStatus ?? world.fortress?.state ?? 'unknown';

  const events = resolveEvents(world, live, clock);
  const war = simulateWar(world, { ...live, warPhase }, clock, events);
  const construction = constructionTasks(world, clock, { warPhase, ciStatus }, rules);
  const economy = economyTick(world, clock, { warPhase, ciStatus, rules }, rules);

  // Harvest pressure feeds the scheduler + effects (snapshot has no events
  // array of its own, so the harvest story surfaces as tasks + effects).
  const eventTypes = new Map(events.eventTypes);
  if (economy.farm.harvestReady) eventTypes.set('harvest', 'APPROACH');

  const schedCtx = {
    warPhase, ciStatus, eventTypes, rules, hasConstruction: construction.hasConstruction,
    // PR -> courier network (spec §06.2): qualitative intensity, quiet when
    // unknown/none. Old worlds without `couriers` degrade to 'unknown'.
    prIntensity: world.couriers?.intensity ?? 'unknown',
  };

  const { actors: citizens } = buildActors(world, clock, schedCtx);
  const { hero, companion } = simulateHero(world, clock, schedCtx);

  const actors = [...citizens, ...economy.carts];
  if (hero) actors.push(hero);
  if (companion) actors.push(companion);
  actors.sort((a, b) => (a.id < b.id ? -1 : 1));

  const tasks = [...construction.tasks, ...economy.tasks];
  tasks.sort((a, b) => (a.id < b.id ? -1 : 1));

  const effects = [...events.effects, ...war.effects];

  return {
    version: String(SIM_VERSION),
    timeBucket: String(timeBucket ?? ''),
    clock: { band: clock.band, season: clock.season, weather: clock.weather, aurora: clock.aurora },
    actors,
    tasks,
    war: {
      state: war.state,
      phaseIndex: war.phaseIndex,
      enemyCohort: war.enemyCohort,
      barricades: war.barricades,
      damage: war.damage,
      gates: war.gates,
      guardsDeployed: war.guardsDeployed,
      scoutsDeployed: war.scoutsDeployed,
      civilianShelter: war.civilianShelter,
      effects: war.effects,
    },
    farm: { cropState: economy.farm.cropState, maturity: economy.farm.maturity, harvestReady: economy.farm.harvestReady },
    effects,
  };
}

/** Byte-identical serialization of a snapshot (determinism tests). */
export const serializeSnapshot = (snap) => canonical(snap);

/** Assert a snapshot satisfies the schema; throws with details. */
export function assertValidSnapshot(snap) {
  const errors = validateSimulationSchema(snap);
  if (errors.length) throw new Error(`invalid snapshot:\n- ${errors.join('\n- ')}`);
  return true;
}
