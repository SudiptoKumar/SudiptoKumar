// TRUE V2 shared lighting policy (TRUE V2 §10/§11). One policy for every camera.
//
// Today this centralises what scene.mjs already computes; in Phase 4 the renderers
// adopt it and the per-renderer copies disappear. The rules:
//
//   - the world is drawn in daylight colours, then one dark veil is laid over it
//   - day: no veil. dawn: rose veil. evening: mauve veil. night: deep blue veil
//   - storm/thunderstorm darken any phase; rain adds a light cool wash
//   - aurora is a night/dusk phenomenon only: it never appears in daylight
//     (the weather itself is gated in rules.mjs; this policy treats a daytime
//     aurora value as 0 so no renderer can draw one by accident)
import { TINT, SKY } from '../render/palette.mjs';

/** The single sky table. Renderers must use this instead of their own copies. */
export const skyFor = (phase) => SKY[phase] || SKY.day;

const stormyKind = (weather) => weather === 'storm' || weather === 'thunderstorm';

/**
 * lightingFor({ phase, weather, season, aurora }) -> the world lighting policy.
 * Pure and deterministic, plain data only (the world must stay structuredClone-
 * and JSON-safe). Mirrors the scene light flags so the world and the scene can
 * never disagree.
 *
 * `aurora` is the scene's aurora intensity (0..1); the policy gates it to 0 in
 * daylight, so no camera can ever draw a daytime aurora.
 */
export function lightingFor({ phase = 'day', weather = 'clear', season = 'summer', aurora = 0 } = {}) {
  const stormy = stormyKind(weather);
  const dark = phase === 'night' || phase === 'evening' || stormy;
  let [color, alpha] = TINT[phase] || [null, 0];
  // aurora palette (Phase 4): deep teal at night, violet at dusk/dawn instead of
  // the plain phase veil. Never in daylight — the aurora is gated below.
  const auroraOn = phase !== 'day' && aurora > 0;
  if (auroraOn && color) { color = phase === 'night' ? '#0a2a44' : '#2a2a5a'; alpha = Math.max(0.2, alpha - 0.06); }
  // weather adds to the veil: rain a cool wash, storms a heavier one
  const wash = weather === 'rain' ? 0.16 : weather === 'storm' ? 0.28 : weather === 'thunderstorm' ? 0.4 : 0;
  return {
    phase, weather, season, stormy, dark,
    tint: { color, alpha },
    wash: { color: wash > 0 ? '#14223c' : null, alpha: wash * (phase === 'night' ? 0.45 : 1) },
    windows: dark || phase === 'dawn',
    torches: phase !== 'day' || stormy,
    moon: phase === 'night',
    aurora: phase === 'day' ? 0 : aurora,
    snow: season === 'winter',
  };
}
