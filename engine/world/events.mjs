// TRUE V2 event choreography (TRUE V2 §15). Every major event moves through
// START -> PEAK -> AFTERMATH -> EXPIRED, derived from its age within [at, until].
// Phase 5 wires visible world consequences to these phases; Phase 1 formalises
// the phase computation so events, hero paths and cameras can share it.
import { EVENT_PHASES } from './constants.mjs';
import { hoursSince } from '../util.mjs';

/**
 * choreography(event, now) -> { phase, t }
 *   phase: one of START | PEAK | AFTERMATH | EXPIRED
 *   t:     0..1 progress through the event's lifespan (clamped)
 *
 * START is the first 15% of the lifespan, PEAK the next 35%, AFTERMATH the rest.
 * An event past `until` (or with no `until`) is EXPIRED.
 */
export function choreography(event, now = new Date()) {
  if (!event) return { phase: 'EXPIRED', t: 1 };
  const at = new Date(event.at || 0).getTime(), until = new Date(event.until || 0).getTime();
  const nowMs = now.getTime();
  if (!until || until <= at || nowMs >= until) return { phase: 'EXPIRED', t: 1 };
  const t = Math.min(1, Math.max(0, (nowMs - at) / (until - at)));
  const phase = t < 0.15 ? 'START' : t < 0.5 ? 'PEAK' : 'AFTERMATH';
  return { phase, t };
}

export { EVENT_PHASES };

/** Convenience: the age of an event in hours. */
export const eventAgeH = (event, now = new Date()) => hoursSince(event?.at || now.toISOString(), now);

/**
 * PHASE_FX: how hard an event shows itself, by choreography phase (TRUE V2 §15, Phase 5).
 * START is the build-up, PEAK the full show, AFTERMATH the wind-down.
 * Renderers scale count-based fx (confetti, fireworks) by this.
 */
export const PHASE_FX = { START: 0.45, PEAK: 1, AFTERMATH: 0.25, EXPIRED: 0 };
