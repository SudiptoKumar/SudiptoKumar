// lighting.mjs — lighting derived ONCE per render, then passed to all passes
// (spec §09.11). Inputs: time band, weather, season, event severity, war phase.
// Night is a real lighting redesign (emissive windows, lamp pools, dark sky),
// never a black overlay (spec §04.11, lock §9).
import { BANDS, STATE } from './palette.mjs';

const NIGHT_BANDS = new Set(['evening', 'night', 'deepnight']);
const AURORA_BANDS = new Set(['sunset', 'evening', 'night', 'deepnight']);
const WAR_BATTLE = new Set(['BATTLE', 'TURNING_POINT', 'APPROACH', 'MOBILIZATION', 'ALERT']);

/**
 * @returns lighting policy:
 * { sky[3], sun, shadow, shadowLen, windowMode, windowColor, lampGlow,
 *   haze{color,alpha}|null, waterTop, waterDeep, accent, aurora, snow,
 *   torchGlow, clouds }
 */
export function deriveLighting({ band = 'morning', weather = 'clear', season = 'summer', eventSeverity = null, warPhase = 'PEACE', aurora = false }) {
  const b = BANDS[band] ?? BANDS.morning;
  const night = NIGHT_BANDS.has(band);
  // Aurora is dusk/night only, never in day (lock §9, audit lighting policy).
  const auroraOn = !!aurora && weather === 'aurora' && AURORA_BANDS.has(band);

  // Window emissives: night redesign — warm lit windows, dim at edges of day.
  const windowColor = b.windows === 'lit' ? '#ffca6a'
    : b.windows === 'warm' ? '#e8a84e'
    : b.windows === 'dim' ? '#8a7a5a' : null;

  // Event/war accents tint the atmosphere, never repaint it.
  let accent = null;
  if (eventSeverity === 'celebration') accent = STATE.celebration;
  else if (eventSeverity === 'warning') accent = STATE.warning;
  else if (eventSeverity === 'danger') accent = STATE.danger;
  if (WAR_BATTLE.has(warPhase)) accent = STATE.danger;

  const stormy = weather === 'storm';
  const shadowLen = band === 'noon' ? 0.35 : band === 'sunset' || band === 'dawn' ? 1.6 : 0.9;

  return {
    band, weather, season, night,
    sky: [...b.sky],
    sun: stormy ? '#9aa4b8' : b.sun,
    shadow: b.shadow, shadowLen,
    windowMode: b.windows, windowColor,
    lampsOn: b.lamps, lampGlow: b.lamps,
    torchColor: '#ff9e3c',
    haze: stormy ? { color: '#5a6a80', alpha: 0.35 }
      : weather === 'rain' ? { color: '#8fa3b8', alpha: 0.22 }
      : weather === 'snow' ? { color: '#dfe8ee', alpha: 0.18 }
      : null,
    waterTop: night ? '#1d3a5e' : '#4a90c8',
    waterDeep: night ? '#0e1f36' : '#2b5e93',
    aurora: auroraOn,
    snow: season === 'winter' || weather === 'snow',
    accent,
    warGlow: WAR_BATTLE.has(warPhase),
    clouds: weather === 'rain' || weather === 'storm' || weather === 'snow',
  };
}

/** Paint the sky + far atmosphere for a camera rect. Returns SVG string. */
export function paintSky(rect, light) {
  const { x, y, w, h } = rect;
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${Math.ceil(h * 0.42)}" fill="url(#k-sky)"/>`;
  if (light.clouds) {
    // Deterministic cloud puffs from band seed — positions fixed per band.
    const puffs = cloudPuffs(rect, light.band);
    s += puffs;
  }
  if (light.aurora) s += paintAurora(rect);
  if (light.night) s += paintStars(rect, light.band);
  return s;
}

function cloudPuffs(rect, band) {
  // 5 deterministic clouds; grey by weather (storm darker handled by caller tint).
  const seeds = [3, 11, 23, 37, 51];
  let s = '';
  for (const k of seeds) {
    const cx = rect.x + ((k * 397) % Math.max(1, rect.w - 200)) + 60;
    const cy = rect.y + 20 + ((k * 211) % 90);
    const c = band === 'night' || band === 'deepnight' ? '#2a3350' : '#e8eef4';
    const op = band === 'night' || band === 'deepnight' ? 0.9 : 0.85;
    s += `<g fill="${c}" opacity="${op}">`
      + `<ellipse cx="${cx}" cy="${cy}" rx="70" ry="18"/>`
      + `<ellipse cx="${cx - 45}" cy="${cy + 6}" rx="40" ry="13"/>`
      + `<ellipse cx="${cx + 48}" cy="${cy + 5}" rx="44" ry="14"/></g>`;
  }
  return s;
}

function paintStars(rect, band) {
  // Sparse deterministic stars, denser in deepnight.
  const n = band === 'deepnight' ? 40 : 22;
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = rect.x + ((i * 173 + 41) % Math.max(1, rect.w));
    const y = rect.y + ((i * 97 + 13) % Math.max(1, Math.floor(rect.h * 0.35)));
    const r = (i % 5 === 0) ? 2 : 1;
    s += `<circle cx="${x}" cy="${y}" r="${r}" fill="#dfe8fa" opacity="${0.5 + (i % 3) * 0.2}"/>`;
  }
  return s;
}

function paintAurora(rect) {
  // Restrained band across the upper sky (lock §9: never in day).
  const { x, y, w } = rect;
  const top = y + Math.floor(rect.h * 0.06);
  const hgt = Math.floor(rect.h * 0.22);
  let d = `M ${x} ${top + hgt}`;
  for (let i = 0; i <= 12; i++) {
    const px = x + (w * i) / 12;
    const py = top + hgt / 2 + Math.sin(i * 1.3) * hgt * 0.28;
    d += ` L ${Math.round(px)} ${Math.round(py)}`;
  }
  d += ` L ${x + w} ${top + hgt} L ${x + w} ${top} L ${x} ${top} Z`;
  return `<path d="${d}" fill="url(#k-aurora)" opacity="0.8"/>`;
}
