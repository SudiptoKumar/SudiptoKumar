// fallback.mjs — error isolation (spec §09.13/14, lock invariant 15.7).
// A failed asset becomes a visually consistent plaque: no raw stack in the
// README, ever. Errors go to logs/tests only via reportError().
import { esc } from '../util.mjs';

const LOG = [];

/** Record a render failure for logs/tests. Never embeds the error in output. */
export function reportError(key, err) {
  const entry = { key, message: String(err?.message ?? err).slice(0, 200), at: 'render' };
  LOG.push(entry);
  if (typeof console !== 'undefined' && console.error) console.error(`[render:${key}] ${entry.message}`);
  return entry;
}

export const errorLog = () => [...LOG];
export const clearErrorLog = () => { LOG.length = 0; };

/** Visually consistent fallback plaque for a failed/over-budget asset. */
export function fallbackAsset(key, message) {
  const safe = esc(String(message ?? 'renderer unavailable')).replace(/[<>&"']/g, '').slice(0, 90);
  const label = esc(String(key)).slice(0, 40);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360" role="img" aria-label="Kingdom view unavailable">`
    + `<rect width="640" height="360" fill="#1d2433"/>`
    + `<rect x="8" y="8" width="624" height="344" fill="none" stroke="#e8b93c" stroke-width="3"/>`
    + `<rect x="270" y="60" width="100" height="70" fill="#2f6fb2"/>`
    + `<polygon points="264,60 320,18 376,60" fill="#2f6fb2"/>`
    + `<rect x="300" y="100" width="40" height="30" fill="#141a26"/>`
    + `<text x="320" y="180" font-family="monospace" font-size="22" fill="#e8b93c" text-anchor="middle">KINGDOM · ${label}</text>`
    + `<text x="320" y="212" font-family="monospace" font-size="14" fill="#9aa4b8" text-anchor="middle">${safe}</text>`
    + `<text x="320" y="300" font-family="monospace" font-size="12" fill="#5a6a80" text-anchor="middle">the kingdom endures — this view will return</text>`
    + `</svg>`;
}

/** Wrap a painter so one failed component never takes down the README. */
export function isolate(key, fn) {
  try {
    const out = fn();
    if (out == null) return { ok: true, empty: true, svg: null };
    return { ok: true, empty: false, svg: out };
  } catch (err) {
    reportError(key, err);
    return { ok: false, empty: false, svg: fallbackAsset(key, 'this view failed to render') };
  }
}
