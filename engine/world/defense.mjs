// TRUE V3 Defense system (V3 §10). Watchtowers, gates, and guards react to threats.
//
// DEFENSE STATUSES:
//   CALM -> ALERT -> TARGETING -> FIRING -> DAMAGED -> REPAIRING -> RESTORED
import { L } from './layout.mjs';

/** Defense structure definitions (world coordinates). */
export const DEFENSES = [
  { id: 'tower-west', kind: 'watchtower', x: 64, y: 198, },
  { id: 'tower-east', kind: 'watchtower', x: 112, y: 198, },
  { id: 'gatehouse',  kind: 'gatehouse',  x: 88, y: 208, },
  { id: 'signal',     kind: 'signal',     x: 88, y: 190, },
];

/**
 * Defense state for a structure given threat level (0-5) and tick.
 * Threat 0: CALM. 1-2: ALERT. 3: TARGETING. 4: FIRING. Damage -> DAMAGED -> REPAIRING -> RESTORED.
 */
export function defenseStateFor(defense, threat = 0, damaged = false, tick = 0) {
  if (damaged) {
    // Repair cycle: DAMAGED -> REPAIRING -> RESTORED (deterministic by tick)
    const cycle = tick % 24;
    if (cycle < 8) return 'DAMAGED';
    if (cycle < 20) return 'REPAIRING';
    return 'RESTORED';
  }
  if (threat >= 4) return 'FIRING';
  if (threat >= 3) return 'TARGETING';
  if (threat >= 1) return 'ALERT';
  return 'CALM';
}

/**
 * All defenses with their current states.
 * world: world object. threat: 0-5 from war system. tick: integer.
 */
export function defensesFor(world, threat = 0, tick = 0) {
  // Damage from war state (if any)
  const warDamage = world.simulation?.war?.damage || [];
  return DEFENSES.map((d) => {
    const isDamaged = warDamage.some((w) => Math.abs(w.x - d.x) < 20 && Math.abs(w.y - d.y) < 20);
    return {
      ...d,
      state: defenseStateFor(d, threat, isDamaged, tick),
      threat,
    };
  });
}
