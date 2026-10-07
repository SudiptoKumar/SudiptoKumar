// Simulation clock: deterministic time-bucket parsing.
// A timeBucket is either an ISO timestamp ("2026-10-07T06:00:06+06:00") or a
// named bucket ("demo-night"). Either way we resolve a canonical
// { band, season, weather, aurora } plus keys used to seed RNG streams.
// Pure + deterministic. No wall-clock reads anywhere.
import { DAY_BANDS, SEASONS, WEATHER } from '../world/constants.mjs';

// Hour ranges -> day band (local hours; spec §07 §4, lock §9).
const BAND_RANGES = [
  ['predawn', 3, 5], ['dawn', 5, 7], ['morning', 7, 11], ['noon', 11, 14],
  ['afternoon', 14, 17], ['sunset', 17, 19], ['evening', 19, 22],
  ['night', 22, 25], ['night', 0, 1], ['deepnight', 1, 3],
];
export function bandForHour(h) {
  for (const [band, lo, hi] of BAND_RANGES) if (h >= lo && h < hi) return band;
  return 'morning';
}

// Month -> season (northern hemisphere; lock §9).
export function seasonForMonth(m) {
  if (m === 12 || m <= 2) return 'winter';
  if (m <= 5) return 'spring';
  if (m <= 8) return 'summer';
  return 'autumn';
}

// Aurora is a night phenomenon: allowed only at sunset/night/deepnight
// (lock §9 lighting policy). Elsewhere it downgrades to clear.
export const AURORA_BANDS = new Set(['sunset', 'night', 'deepnight']);
export function gateAurora(weather, band) {
  if (weather === 'aurora' && !AURORA_BANDS.has(band)) return 'clear';
  return weather;
}

// Canonicalize an ISO-ish timestamp to an hour bucket: keep date + hour,
// zero the sub-hour fields so a workflow run cannot re-render mid-bucket.
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/;
export function parseBucket(timeBucket) {
  const s = String(timeBucket ?? '');
  const m = ISO_RE.exec(s);
  if (m) {
    const [, Y, Mo, D, H, Mi] = m;
    const hour = Number(H); const minute = Number(Mi);
    return {
      kind: 'iso', dateKey: `${Y}-${Mo}-${D}`,
      hour, minute,
      band: bandForHour(hour + minute / 60),
      season: seasonForMonth(Number(Mo)),
      bucketKey: `${Y}-${Mo}-${D}T${H}:00`,
      dayNumber: Math.floor(Date.UTC(Number(Y), Number(Mo) - 1, Number(D)) / 86400000),
    };
  }
  // Named bucket: recover a band from the name when present ("demo-night"),
  // otherwise fall back to the world's own time; season/weather always fall
  // back to the world (never invented).
  const lower = s.toLowerCase();
  const band = DAY_BANDS.find((b) => lower.includes(b)) ?? null;
  return {
    kind: 'named', dateKey: s, hour: 12, minute: 0,
    band, season: null, bucketKey: s, dayNumber: null,
  };
}

/**
 * Resolve the full clock for a tick.
 * @param {string} timeBucket opaque bucket id
 * @param {object} world read-only world (fallback band/season/weather)
 */
export function resolveClock(timeBucket, world) {
  const p = parseBucket(timeBucket);
  const worldTime = world?.time ?? {};
  const band = p.band ?? (DAY_BANDS.includes(worldTime.phase) ? worldTime.phase : 'morning');
  const season = p.season ?? (SEASONS.includes(worldTime.season) ? worldTime.season : 'spring');
  const rawWeather = WEATHER.includes(worldTime.weather) ? worldTime.weather : 'clear';
  const weather = gateAurora(rawWeather, band);
  return {
    bucket: String(timeBucket ?? ''),
    bucketKey: p.bucketKey,
    dateKey: p.dateKey,
    dayNumber: p.dayNumber,
    kind: p.kind,
    hour: p.hour,
    minute: p.minute,
    timeOfDay: p.hour + p.minute / 60,
    band, season, weather,
    aurora: weather === 'aurora',
    nightBand: band === 'night' || band === 'deepnight',
  };
}

/** Short deterministic day index for progress math (ISO or hashed). */
export function dayIndex(clock, salt) {
  if (clock.dayNumber !== null) return clock.dayNumber;
  let h = 2166136261 >>> 0;
  const s = `${clock.dateKey}:${salt}`;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return (h >>> 0) % 4000;
}
