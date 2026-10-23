// The one lighting policy. Every camera of the kingdom gets its light from here, so the same moment is lit the same way everywhere.
// Day / night / storm / aurora decide the veil, which windows and torches burn, and where glows and alarms sit.
import { TINT } from '../render/palette.mjs';
import { ANCHORS } from './layout.mjs';

/** Brightness of the world, 0..1. Storm and thunder darken any hour (a storm at noon is as dark as the evening). */
export const INTENSITY = Object.freeze({ day: 1, dawn: 0.8, evening: 0.7, night: 0.35 });
export const STORM_INTENSITY = Object.freeze({ storm: 0.25, thunderstorm: 0.2 });
const RAIN_FACTOR = 0.9;

export function lightingFor(S, layout) {
  const scene = S.scene, wx = scene.weather, phase = S.time.phase, night = phase === 'night';
  let intensity = INTENSITY[phase] ?? 1;
  if (wx.kind === 'rain') intensity *= RAIN_FACTOR;
  if (STORM_INTENSITY[wx.kind] != null) intensity = Math.min(intensity, STORM_INTENSITY[wx.kind]);
  intensity = Math.round(intensity * 100) / 100;

  // veil laid over the whole map (aurora gets a deep teal / violet palette instead of plain blue, and only after dark)
  let [tc, ta] = TINT[phase];
  const aurora = phase === 'day' ? 0 : wx.aurora || 0;
  if (aurora > 0 && tc) { tc = night ? '#0a2a44' : '#2a2a5a'; ta = Math.max(0.2, ta - 0.06); }
  const veil = ({ rain: 0.16, storm: 0.28, thunderstorm: 0.4 }[wx.kind] || 0) * (night ? 0.45 : 1);

  const at = (name) => layout.placed.find((r) => r.repo.name === name);
  const spots = [], danger = [];
  if (scene.light.accent === 'repair') for (const n of scene.light.repair) { const q = at(n); if (q) spots.push({ x: q.x, y: q.y - 12, r: 14, color: '#a7f070', op: 0.55 }); }
  if (scene.light.accent === 'celebrate' || scene.fx.includes('castleLights')) spots.push({ x: ANCHORS.castle.x, y: ANCHORS.castle.y - 26, r: 34, color: '#ffcd75', pulse: true, op: 0.55 });
  if (aurora > 0) {
    spots.push({ x: 88, y: 60, r: 70, color: '#5dffb0', op: 0.1 * aurora });
    spots.push({ x: 40, y: 150, r: 60, color: '#73eff7', op: 0.07 * aurora });
    spots.push({ x: 140, y: 150, r: 60, color: '#b48cf0', op: 0.06 * aurora });
  }
  for (const n of scene.light.danger) { const q = at(n); if (q) danger.push({ x: q.x, y: q.y - 12, r: 16, strong: scene.stages.fail[n] !== 'warning' }); }

  const L = {
    phase, weather: wx.kind, intensity, tint: [tc, ta], veil, aurora,
    windows: !!scene.light.windows, torches: !!scene.light.torches, moon: !!scene.light.moon, sunrise: !!wx.sunrise,
    accent: scene.light.accent || null, gold: !!scene.light.gold, gate: !!scene.light.gate,
    spots, danger,
  };
  L.sig = `${phase}:${intensity}:${wx.kind}:${aurora}:${L.accent || '-'}:${+L.windows}${+L.torches}${+L.moon}`;
  return L;
}
