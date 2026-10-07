// TRUE V3 Animation plan (V3 §13). Formal deterministic animation layer.
//
// Pipeline: WORLD -> SIMULATION -> ANIMATION PLAN -> RENDER
//
// The plan lists which elements animate, with what CSS class, and for which cameras.
// Static SVG remains the fallback; animation is progressive enhancement.

import { ANIM_VERSION } from './constants.mjs';

/** Animation classes by category. */
export const ANIM_CLASSES = {
  idle: ['fl', 'bob', 'sway'],           // flag sway, fire flicker, bobbing
  work: ['hm', 'cr'],                    // hammer, carry
  walk: ['wy'],                          // walking
  combat: ['atk', 'imp'],                // attack, impact
  event: ['cf', 'fw', 'sm'],             // confetti, fireworks, smoke
  env: ['cl', 'rain', 'snow'],           // clouds, rain, snow
};

/**
 * buildAnimationPlan(world, simulation): which elements animate.
 * Returns { version, elements: [{ id, class, cameras }] }.
 * Deterministic: same world + sim = same plan.
 */
export function buildAnimationPlan(world, simulation) {
  const elements = [];
  const sim = simulation || {};

  // Idle: flags, fires, water (always)
  elements.push({ id: 'flags', class: 'fl', cameras: ['overworld', 'castle'] });
  elements.push({ id: 'torches', class: 'fl', cameras: ['overworld', 'dungeon'] });

  // Work: builders hammering (if construction active)
  if ((sim.construction || []).some((c) => c.task === 'WORKING')) {
    elements.push({ id: 'hammers', class: 'hm', cameras: ['overworld', 'builderyard'] });
  }

  // Walk: NPCs moving
  if ((sim.actors || []).some((a) => a.walking)) {
    elements.push({ id: 'walkers', class: 'wy', cameras: ['overworld'] });
  }

  // Event: confetti, fireworks (if active)
  const fx = world.scene?.fx || [];
  if (fx.includes('confetti')) elements.push({ id: 'confetti', class: 'cf', cameras: ['overworld'] });
  if (fx.includes('fireworks')) elements.push({ id: 'fireworks', class: 'fw', cameras: ['overworld', 'castle'] });

  // Environment: weather
  const weather = world.time.weather;
  if (weather === 'rain' || weather === 'storm') elements.push({ id: 'rain', class: 'rain', cameras: ['overworld'] });
  if (world.time.season === 'winter') elements.push({ id: 'snow', class: 'snow', cameras: ['overworld', 'farm'] });

  // Combat: if war active
  const warPhase = sim.war?.phase;
  if (['BATTLE', 'DEFENSE'].includes(warPhase)) {
    elements.push({ id: 'combat', class: 'atk', cameras: ['overworld', 'warfront'] });
    elements.push({ id: 'impacts', class: 'imp', cameras: ['warfront'] });
  }

  return {
    version: ANIM_VERSION,
    elements,
    count: elements.length,
  };
}
