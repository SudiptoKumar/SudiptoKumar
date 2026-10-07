// War state machine (lock §8, 14 canonical phases).
//   PEACE -> SCOUTING -> THREAT_DETECTED -> ALERT -> MOBILIZATION ->
//   APPROACH -> BATTLE -> TURNING_POINT -> VICTORY|DEFEAT -> AFTERMATH ->
//   REPAIR -> RECOVERY -> RESOLVED -> PEACE
// Readable visual storytelling only: cohort positions, gate states,
// barricades, bounded damage. Damage never mutates the world — it is a
// derived, bucket-bounded visual state (spec §08 §12).
import { WAR_PHASES } from '../world/constants.mjs';
import { subRng } from '../util.mjs';
import { cachedRoute, pointAt } from './movement.mjs';
import { nodeById } from '../world/roads.mjs';

export const WAR_ORDER = [...WAR_PHASES];

const LEGAL = {
  PEACE: ['SCOUTING'],
  SCOUTING: ['THREAT_DETECTED', 'PEACE'],
  THREAT_DETECTED: ['ALERT', 'SCOUTING'],
  ALERT: ['MOBILIZATION', 'SCOUTING'],
  MOBILIZATION: ['APPROACH', 'ALERT'],
  APPROACH: ['BATTLE', 'MOBILIZATION'],
  BATTLE: ['TURNING_POINT'],
  TURNING_POINT: ['VICTORY', 'DEFEAT'],
  VICTORY: ['AFTERMATH'],
  DEFEAT: ['AFTERMATH'],
  AFTERMATH: ['REPAIR'],
  REPAIR: ['RECOVERY'],
  RECOVERY: ['RESOLVED'],
  RESOLVED: ['PEACE'],
};
export const isLegalWarTransition = (from, to) => (LEGAL[from] ?? []).includes(to);

const ENEMY_COUNT = 8;
const BARRICADE_NODES = ['war_front', 'watch_north', 'east_gate'];

function enemyCohort(seed, warPhase) {
  const out = [];
  const place = (route, baseP, spread, idPrefix) => {
    for (let i = 0; i < ENEMY_COUNT; i++) {
      const p = Math.min(1, Math.max(0, baseP + (i - ENEMY_COUNT / 2) * spread));
      const pt = pointAt(route, p);
      const ahead = pointAt(route, Math.min(1, p + 0.01));
      out.push({
        id: `${idPrefix}-${i}`,
        role: 'enemy',
        x: Math.round(pt.x), y: Math.round(pt.y),
        facing: ahead.x >= pt.x ? 'e' : 'w',
        routeId: `${idPrefix}-route`,
      });
    }
  };
  if (['ALERT', 'MOBILIZATION'].includes(warPhase)) {
    place(cachedRoute('frontier_pass', 'frontier_pass'), 0, 0, 'enemy'); // massing at the pass
  } else if (warPhase === 'APPROACH') {
    place(cachedRoute('frontier_pass', 'war_front'), 0.55, 0.03, 'enemy');
  } else if (['BATTLE', 'TURNING_POINT'].includes(warPhase)) {
    place(cachedRoute('war_front', 'war_front'), 0, 0, 'enemy');
    // spread around the front node deterministically
    const n = nodeById('war_front');
    const r = subRng(seed, 'war', 'enemy-spread');
    for (const e of out) { e.x += Math.round(r() * 120 - 60); e.y += Math.round(r() * 80 - 20); }
  } else if (warPhase === 'VICTORY') {
    place(cachedRoute('war_front', 'frontier_pass'), 0.35, 0.03, 'enemy'); // retreating
  } else if (warPhase === 'DEFEAT') {
    place(cachedRoute('war_front', 'watch_north'), 0.3, 0.03, 'enemy'); // advancing
  }
  return out;
}

function barricades(warPhase) {
  if (!['ALERT', 'MOBILIZATION', 'APPROACH', 'BATTLE', 'TURNING_POINT', 'VICTORY', 'DEFEAT'].includes(warPhase)) return [];
  return BARRICADE_NODES.map((node, i) => {
    const n = nodeById(node);
    return { id: `barricade-${node}`, node, x: n.x + (i % 2 ? 24 : -24), y: n.y + 16 };
  });
}

function damageFor(warPhase) {
  // Bounded: severity tied to the phase; cleared by RECOVERY (spec §08 §12).
  if (warPhase === 'AFTERMATH') {
    return [
      { anchor: 'war_front', severity: 'moderate', detail: 'scorched palisade, debris' },
      { anchor: 'watch_north', severity: 'light', detail: 'damaged signal platform' },
    ];
  }
  if (warPhase === 'REPAIR') {
    return [{ anchor: 'war_front', severity: 'light', detail: 'scaffolding up, debris clearing' }];
  }
  return [];
}

function gatesFor(warPhase) {
  if (['BATTLE', 'TURNING_POINT'].includes(warPhase)) return { main_gate: 'closed', east_gate: 'closed', west_gate: 'closed' };
  if (['ALERT', 'MOBILIZATION', 'APPROACH', 'VICTORY', 'DEFEAT'].includes(warPhase)) {
    return { main_gate: 'tightened', east_gate: 'tightened', west_gate: 'tightened' };
  }
  return { main_gate: 'open', east_gate: 'open', west_gate: 'open' };
}

/**
 * @returns {{ state, phaseIndex, enemyCohort, barricades, damage, gates,
 *             guardsDeployed, effects }}
 */
export function simulateWar(world, inputs, clock, events) {
  const raw = inputs?.warPhase ?? world.war?.phase ?? 'PEACE';
  const state = WAR_PHASES.includes(raw) ? raw : 'PEACE';
  const phaseIndex = WAR_PHASES.indexOf(state);
  const atWar = state !== 'PEACE' && state !== 'RESOLVED';
  const battle = ['APPROACH', 'BATTLE', 'TURNING_POINT'].includes(state);

  const effects = [];
  if (state === 'BATTLE') {
    effects.push({ type: 'smoke', anchor: 'war_front', intensity: 1.0, ttl: 1 });
    effects.push({ type: 'fire', anchor: 'war_front', intensity: 0.8, ttl: 1 });
  } else if (state === 'TURNING_POINT') {
    effects.push({ type: 'smoke', anchor: 'war_front', intensity: 1.0, ttl: 1 });
    effects.push({ type: 'signal-fire', anchor: 'watch_north', intensity: 1.0, ttl: 1 });
  } else if (['ALERT', 'MOBILIZATION'].includes(state)) {
    effects.push({ type: 'signal-fire', anchor: 'watch_north', intensity: 0.8, ttl: 1 });
  } else if (state === 'APPROACH') {
    effects.push({ type: 'dust', anchor: 'frontier_pass', intensity: 0.6, ttl: 1 });
  } else if (state === 'AFTERMATH') {
    effects.push({ type: 'debris', anchor: 'war_front', intensity: 0.5, ttl: 2 });
    effects.push({ type: 'smoke', anchor: 'war_front', intensity: 0.25, ttl: 2 });
  } else if (state === 'SCOUTING') {
    effects.push({ type: 'signal-fire', anchor: 'watch_north', intensity: 0.3, ttl: 1 });
  }

  return {
    state,
    phaseIndex,
    enemyCohort: enemyCohort(world.seed, state),
    barricades: barricades(state),
    damage: damageFor(state),
    gates: gatesFor(state),
    guardsDeployed: !atWar ? 4 : battle ? 12 : 8,
    scoutsDeployed: state === 'SCOUTING' || state === 'THREAT_DETECTED' ? 4 : 2,
    civilianShelter: battle,
    effects,
  };
}
