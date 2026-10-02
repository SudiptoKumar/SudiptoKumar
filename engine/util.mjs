// Small helpers shared by the whole engine. No dependencies.
import { createHash } from 'node:crypto';

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
export const lerp = (a, b, t) => a + (b - a) * t;
export const sum = (arr, fn = (x) => x) => arr.reduce((a, x) => a + (Number(fn(x)) || 0), 0);

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Escape text for XML/SVG. Every outside string must pass through this. */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/** Deep sort keys so JSON is the same every time. */
export function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v).sort()) o[k] = sortKeys(v[k]);
    return o;
  }
  return v;
}
export const canonical = (v) => JSON.stringify(sortKeys(v));
export const sha = (str, n = 10) => createHash('sha1').update(String(str)).digest('hex').slice(0, n);

export function hash32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
/** Small deterministic random generator (same seed = same world). */
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
  return next;
}

export const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');
export function short(n) {
  n = Number(n) || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e4) return Math.round(n / 1e3) + 'K';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(Math.round(n));
}
export const pad2 = (n) => String(n).padStart(2, '0');
export const pad3 = (n) => String(n).padStart(3, '0');

// ---------- dates (all in the owner's time zone) ----------
const dtfCache = new Map();
function dtf(tz) {
  if (!dtfCache.has(tz)) {
    dtfCache.set(
      tz,
      new Intl.DateTimeFormat('en-CA', {
        timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', weekday: 'short',
      }),
    );
  }
  return dtfCache.get(tz);
}
export function partsIn(date, tz = 'UTC') {
  const o = {};
  let fmtr;
  try { fmtr = dtf(tz); } catch { fmtr = dtf('UTC'); }
  for (const p of fmtr.formatToParts(date)) o[p.type] = p.value;
  return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour, min: +o.minute, wd: o.weekday };
}
export const ymd = (date, tz) => { const p = partsIn(date, tz); return `${p.y}-${pad2(p.m)}-${pad2(p.d)}`; };
export const hourFloat = (date, tz) => { const p = partsIn(date, tz); return p.h + p.min / 60; };
const toUTC = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
export function addDays(s, n) {
  const d = new Date(toUTC(s) + n * 86400000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}
export const diffDays = (a, b) => Math.round((toUTC(b) - toUTC(a)) / 86400000);
export const hoursSince = (iso, now) => (now.getTime() - new Date(iso).getTime()) / 3600000;
export const daysSince = (iso, now) => hoursSince(iso, now) / 24;
export const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export const dateLabel = (s) => `${+s.slice(8, 10)} ${MONTHS[+s.slice(5, 7) - 1]}`;

export const uniq = (arr) => [...new Set(arr)];
export function groupBy(arr, fn) {
  const m = new Map();
  for (const x of arr) { const k = fn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }
  return m;
}
/** Tiered (diminishing) totals: tiers = [[cap, perUnit], ...] */
export function tiered(n, tiers) {
  let left = Math.max(0, n), out = 0;
  for (const [cap, per] of tiers) {
    const take = Math.min(left, cap);
    out += take * per;
    left -= take;
    if (left <= 0) break;
  }
  return out;
}
export const normName = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
export function truncate(s, n) { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '~' : s; }
