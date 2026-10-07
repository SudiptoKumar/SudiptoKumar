// TRUE V3 War system (V3 §9). Deterministic war storytelling driven by real
// GitHub conditions (workflow failures, issue pressure, raids).
//
// WAR PHASES:
//   NORMAL -> SCOUTING -> WARNING -> INCOMING -> BATTLE -> DEFENSE ->
//   TURNING_POINT -> VICTORY | LOSS -> AFTERMATH -> RECOVERY -> RESOLVED
//
// War affects physical world objects: alarms, guards, walls, hero, damage, repair.
import { rng } from '../util.mjs';

/** War phases in order. */
export const WAR_PHASES = [
  'NORMAL', 'SCOUTING', 'WARNING', 'INCOMING', 'BATTLE', 'DEFENSE',
  'TURNING_POINT', 'VICTORY', 'LOSS', 'AFTERMATH', 'RECOVERY', 'RESOLVED',
];

/**
 * Determine war phase from world state.
 * - raid.active: use raid phase
 * - workflow failures: escalate to WARNING/INCOMING
 * - otherwise: NORMAL (or RECOVERY if recently resolved)
 */
export function warPhaseFor(world, tick = 0) {
  const raid = world.raid;
  const failing = (world.totals?.failingRepos || []).length;
  const issues = world.totals?.issuesOpen || 0;

  // Active raid: map to war phases
  if (raid?.active) {
    const phase = raid.phase || 'enter';
    if (phase === 'enter') return 'INCOMING';
    if (phase === 'battle') return 'BATTLE';
    if (phase === 'won') return 'VICTORY';
    if (phase === 'lost') return 'LOSS';
    return 'BATTLE';
  }

  // Workflow failures: warning states
  if (failing >= 3) return 'WARNING';
  if (failing >= 1) return 'SCOUTING';

  // High issue pressure: scouting
  if (issues >= 20) return 'SCOUTING';

  // Recovery: if tick is early, show recovery (deterministic)
  if (tick < 2 && (failing > 0 || issues > 10)) return 'RECOVERY';

  return 'NORMAL';
}

/**
 * War state: phase, threat level, affected locations, defender positions.
 * Deterministic: same world + tick = same war state.
 */
export function warStateFor(world, tick = 0) {
  const phase = warPhaseFor(world, tick);
  const r = rng(`war:${world.signature}:${tick}:${phase}`);

  const threat = phase === 'NORMAL' ? 0
    : phase === 'SCOUTING' ? 1
    : phase === 'WARNING' ? 2
    : phase === 'INCOMING' ? 3
    : ['BATTLE', 'DEFENSE'].includes(phase) ? 4
    : phase === 'TURNING_POINT' ? 5
    : ['VICTORY', 'LOSS'].includes(phase) ? 3
    : ['AFTERMATH', 'RECOVERY'].includes(phase) ? 1
    : 0;

  // Defender positions (deterministic)
  const defenders = [];
  if (threat >= 2) {
    const n = Math.min(threat, 4);
    for (let i = 0; i < n; i++) {
      defenders.push({
        id: `guard-${i}`,
        x: 80 + i * 8 + Math.floor(r() * 4),
        y: 200 + Math.floor(r() * 6),
        state: threat >= 4 ? 'fighting' : 'alert',
      });
    }
  }

  // Damage: buildings affected in BATTLE/LOSS
  const damage = [];
  if (['BATTLE', 'DEFENSE', 'LOSS'].includes(phase)) {
    const repos = world.repositories || [];
    const n = phase === 'LOSS' ? 2 : 1;
    for (let i = 0; i < Math.min(n, repos.length); i++) {
      const idx = Math.floor(r() * repos.length);
      damage.push({
        name: repos[idx].name,
        x: repos[idx].x, y: repos[idx].y,
        severity: phase === 'LOSS' ? 'heavy' : 'light',
      });
    }
  }

  return {
    phase,
    threat,  // 0-5
    defenders,
    damage,
    // Alarm active?
    alarm: threat >= 2,
    // Repair crews in AFTERMATH/RECOVERY
    repairCrews: ['AFTERMATH', 'RECOVERY'].includes(phase) ? Math.min(3, damage.length + 1) : 0,
  };
}
