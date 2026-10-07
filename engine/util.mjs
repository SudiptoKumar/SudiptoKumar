// Shared helpers for the whole engine. Zero dependencies.
// Determinism rule (spec §13.6): no Math.random() anywhere in world code —
// every stream below is keyed on an explicit string seed.
import { createHash } from 'node:crypto';

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
export const sum = (arr, fn = (x) => x) => arr.reduce((a, x) => a + (Number(fn(x)) || 0), 0);
export const uniq = (arr) => [...new Set(arr)];

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
// Control characters are never legitimate in rendered text (and NUL is
// invalid XML). Strip them before escaping so hostile input can never
// smuggle raw control bytes into an SVG or README. Tab/newline/CR are kept.
const CTRL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
/** Escape text for XML/SVG. Every outside string must pass through this. */
export const esc = (s) => String(s ?? '').replace(CTRL, '').replace(/[&<>"']/g, (c) => ESC[c]);

/** Deep sort keys so JSON is byte-identical every run. */
export function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object' && v !== null) {
    const o = {};
    for (const k of Object.keys(v).sort()) o[k] = sortKeys(v[k]);
    return o;
  }
  return v;
}
export const canonical = (v) => JSON.stringify(sortKeys(v));
export const sha = (str, n = 10) =>
  createHash('sha1').update(String(str)).digest('hex').slice(0, n);

/** FNV-1a 32-bit hash: string -> uint32, used to key mulberry32 streams. */
export function hash32(str) {
  let h = 2166136261 >>> 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * Deterministic PRNG (mulberry32), keyed on a string seed.
 * Same seed string => same sequence, on every platform.
 * Usage: const r = rng(`world:${seed}:buildings`); r.int(0, 9); r.pick(list);
 */
export function rng(seed) {
  let a = (typeof seed === 'string' ? hash32(seed) : seed) >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  next.bool = (p = 0.5) => next() < p;
  return next;
}

/** Sub-stream: derive an independent RNG for a subsystem so ordering elsewhere never shifts it. */
export const subRng = (seed, ...parts) => rng([seed, ...parts].join(':'));

export const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');
export function short(n) {
  n = Number(n) || 0;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1e4) return `${Math.round(n / 1e3)}K`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return String(Math.round(n));
}
export const normName = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
export function truncate(s, n) {
  s = String(s ?? '');
  return s.length > n ? `${s.slice(0, n - 1)}~` : s;
}
