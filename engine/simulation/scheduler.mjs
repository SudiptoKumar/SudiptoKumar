// Scheduler: daily schedule templates per role + event overrides.
// Event priority (lock §8 / spec §07 §8):
//   war > severe CI failure > major release > achievement > visitor arrival
//   > harvest > construction > normal work > idle
// Pure + deterministic. Positions are never chosen here — only state/task/
// priority; movement owns geometry.
import { ACTOR_STATES } from '../world/constants.mjs';

export const PRIORITY = {
  war: 100, ciFailure: 90, release: 80, achievement: 70, visitor: 60,
  harvest: 55, courier: 50, construction: 40, normal: 20, idle: 0,
};

const NIGHT = new Set(['night', 'deepnight']);
const DAYWORK = new Set(['morning', 'noon', 'afternoon']);

// Base template: role -> band-class -> [state, task].
function baseTemplate(role, band) {
  if (band === 'deepnight') {
    if (role === 'guard' || role === 'scout') return ['patrolling', 'night watch'];
    return ['sleeping', 'resting at home'];
  }
  if (band === 'night') {
    if (role === 'guard' || role === 'scout') return ['patrolling', 'night watch'];
    if (role === 'merchant') return ['trading', 'late market stall'];
    return ['sleeping', 'resting at home'];
  }
  if (band === 'predawn' || band === 'dawn') {
    if (role === 'farmer') return ['working', 'early field rounds'];
    if (role === 'guard' || role === 'scout') return ['patrolling', 'dawn patrol'];
    if (role === 'messenger') return ['walking', 'first courier run'];
    return ['idle', 'waking up'];
  }
  if (DAYWORK.has(band)) {
    switch (role) {
      case 'builder': return ['working', 'construction shift'];
      case 'farmer': return ['working', 'field work'];
      case 'guard': return ['patrolling', 'gate patrol'];
      case 'engineer': return ['repairing', 'fortress maintenance'];
      case 'messenger': return ['walking', 'courier rounds'];
      case 'merchant': return ['trading', 'market trading'];
      case 'scholar': return ['studying', 'archive research'];
      case 'scout': return ['scouting', 'forest patrol'];
      case 'smith': return ['working', 'forge work'];
      case 'visitor': return ['walking', 'sightseeing'];
      case 'cart': return ['carrying', 'delivery run'];
      default: return ['idle', 'daily routine'];
    }
  }
  // sunset / evening: wind down
  if (band === 'sunset') {
    if (role === 'guard' || role === 'scout') return ['patrolling', 'evening patrol'];
    return ['idle', 'heading home'];
  }
  if (role === 'guard' || role === 'scout') return ['patrolling', 'evening patrol'];
  if (role === 'merchant') return ['trading', 'evening market'];
  return ['idle', 'evening rest'];
}

const COMBAT_ROLES = new Set(['guard', 'scout']);
const INDOOR_ROLES = new Set(['scholar', 'smith', 'engineer']);

/**
 * @param {string} role
 * @param {object} clock from clock.mjs
 * @param {object} ctx { warPhase, ciStatus, eventTypes: Map(type->phase), rules, hasConstruction, prIntensity }
 *   prIntensity: qualitative PR tier (spec §06.2) driving messenger task intensity
 */
export function scheduleFor(role, clock, ctx) {
  const { warPhase = 'PEACE', ciStatus = 'unknown', eventTypes = new Map(), rules } = ctx ?? {};
  const atWar = warPhase !== 'PEACE' && warPhase !== 'RESOLVED';
  const battle = ['APPROACH', 'BATTLE', 'TURNING_POINT'].includes(warPhase);
  const [baseState, baseTask] = baseTemplate(role, clock.band);
  let state = baseState; let task = baseTask; let priority = PRIORITY.normal;

  // --- event overrides, highest priority first ---
  if (atWar) {
    if (COMBAT_ROLES.has(role)) {
      state = battle ? 'fighting' : 'patrolling';
      task = battle ? 'defending the front' : `war ${warPhase.toLowerCase()} duty`;
      priority = PRIORITY.war;
    } else if (role === 'messenger') {
      state = 'traveling'; task = 'war dispatches'; priority = PRIORITY.war;
    } else if (battle && !['cart'].includes(role)) {
      state = 'sheltering'; task = 'sheltering from battle'; priority = PRIORITY.war;
    } else if (role === 'builder') {
      state = 'repairing'; task = 'war preparations'; priority = PRIORITY.war;
    }
    return finish(role, state, task, priority);
  }
  if (ciStatus === 'failing' && (role === 'engineer' || role === 'smith')) {
    return finish(role, 'repairing', 'emergency fortress repair', PRIORITY.ciFailure);
  }
  if (eventTypes.get('release') === 'PEAK' || eventTypes.get('release') === 'APPROACH') {
    if (role === 'messenger') return finish(role, 'traveling', 'carrying release news', PRIORITY.release);
    if (['merchant', 'visitor', 'scholar'].includes(role) && eventTypes.get('release') === 'PEAK') {
      return finish(role, 'celebrating', 'release celebration', PRIORITY.release);
    }
  }
  if (eventTypes.has('achievement') && role === 'messenger') {
    return finish(role, 'traveling', 'achievement dispatch', PRIORITY.achievement);
  }
  if (eventTypes.has('visitor') && (role === 'merchant' || role === 'visitor')) {
    return finish(role, 'trading', 'visitor market day', PRIORITY.visitor);
  }
  if (eventTypes.has('harvest') && role === 'farmer') {
    return finish(role, 'working', 'harvest collection', PRIORITY.harvest);
  }
  if (ctx?.hasConstruction && role === 'builder' && DAYWORK.has(clock.band)) {
    priority = PRIORITY.construction;
    task = rules?.shelter ? 'work halted: storm' : 'construction shift';
    state = rules?.shelter ? 'idle' : 'working';
  }

  // PR -> courier network (spec §06.2): the messenger cohort's task intensity
  // follows the qualitative PR tier. Higher-priority event claims (war
  // dispatches, release news) already returned above; none/unknown leaves
  // the quiet base routine untouched.
  if (role === 'messenger') {
    const c = courierPrTask(ctx?.prIntensity);
    if (c) return finish(role, c.state, c.task, Math.max(priority, c.priority));
  }

  // --- weather / season modifiers (affect task + state, never position) ---
  if (rules?.shelter && !COMBAT_ROLES.has(role) && role !== 'cart') {
    state = 'sheltering'; task = 'sheltering from storm'; priority = Math.max(priority, PRIORITY.normal);
  } else if (rules?.coveredWork && DAYWORK.has(clock.band) && !INDOOR_ROLES.has(role) && role !== 'cart') {
    task = `${task} (covered)`;
  }
  if (clock.season === 'winter' && role === 'farmer' && DAYWORK.has(clock.band)) {
    task = 'winter field care'; priority = PRIORITY.normal;
  }
  if (NIGHT.has(clock.band) && role === 'farmer') { state = 'sleeping'; task = 'resting at home'; }
  if (rules && rules.marketActivity < 0.2 && role === 'merchant' && state === 'trading') {
    state = 'idle'; task = 'stall closed for the night';
  }

  return finish(role, state, task, priority);
}

function finish(role, state, task, priority) {
  const legal = ACTOR_STATES.includes(state) ? state : 'idle';
  return { state: legal, task, priority };
}

/**
 * Messenger work from the PR intensity tier (spec §06.2). Qualitative only —
 * never a count. Returns null for 'none'/'unknown' so the quiet base
 * routine (normal courier rounds at priority 20) is preserved.
 */
function courierPrTask(intensity) {
  if (intensity === 'surge') {
    return {
      state: 'traveling',
      task: 'courier surge: document runs between the project quarter and the castle',
      priority: PRIORITY.courier,
    };
  }
  if (intensity === 'active') {
    return {
      state: 'traveling',
      task: 'document runs: project quarter to the castle',
      priority: PRIORITY.courier,
    };
  }
  if (intensity === 'trickle') {
    return { state: 'walking', task: 'occasional courier runs', priority: PRIORITY.normal };
  }
  return null;
}

/** Night-shift check used by tests: guards on duty while others sleep. */
export const isNightBand = (band) => NIGHT.has(band);
