// Kingdom history: one small point per day. The first run builds an estimated past from your calendar.
import { levelProgress } from './rules.mjs';
import { addDays, diffDays } from './util.mjs';

export function backfill(series, total) {
  if (!series.length) return [];
  const last = series[series.length - 1][1] || 0;
  const k = last > 0 ? total / last : 0;
  const byMonth = new Map();
  for (const [date, xp] of series) byMonth.set(date.slice(0, 7), [date, xp]);
  const pts = [...byMonth.values()].map(([d, xp]) => {
    const x = Math.round(xp * k);
    return { d, l: levelProgress(x).level, x, e: 1 };
  });
  return pts.slice(-36);
}
export function upsertPoint(history, point) {
  const pts = (history.points || []).filter((p) => p.d !== point.d);
  pts.push(point);
  pts.sort((a, b) => (a.d < b.d ? -1 : 1));
  history.points = pts;
  return history;
}
/** Keep every day for 120 days, one per week until a year, then one per month. */
export function compactHistory(history, today) {
  const out = [];
  let lastKey = '';
  for (const p of history.points || []) {
    const age = diffDays(p.d, today);
    const key = age <= 120 ? p.d : age <= 365 ? `w${Math.floor(diffDays('2000-01-01', p.d) / 7)}` : p.d.slice(0, 7);
    if (key !== lastKey || age <= 120) out.push(p);
    else out[out.length - 1] = p; // keep the newest point of each week or month
    lastKey = key;
  }
  history.points = out;
  return history;
}
/** Points where the level went up (used as milestones on the chart). */
export function levelSteps(points) {
  const steps = [];
  let prev = 0;
  for (const p of points) { if (p.l > prev) steps.push({ d: p.d, l: p.l }); prev = Math.max(prev, p.l); }
  return steps;
}
export { addDays };
