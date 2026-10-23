// The farm, calculated once. 26 weeks x 7 weekdays of the contribution calendar become plots on the map.
// Columns are weeks (oldest on the left), rows are Sunday..Saturday. The newest day is "today". Days after it are not yet ploughed.
import { addDays, diffDays } from '../util.mjs';
import { FARM } from './layout.mjs';
import { h32 } from './hash.mjs';

export const stageFor = (count, steps) => { let s = 0; for (const t of steps) if (count >= t) s++; return s; };

export function buildFarm(S, cfg = {}) {
  const { cols, rows, w, h, x: x0, y: y0 } = FARM.plots;
  const steps = cfg.cropSteps || [1, 3, 6, 10, 15];
  const cal = S.calendar || [];
  const anchor = cal.length ? cal[cal.length - 1].date : S.time.date;
  const wd = new Date(anchor + 'T00:00:00Z').getUTCDay();
  const first = addDays(anchor, -((cols - 1) * 7 + wd));
  const byDate = new Map(cal.map((d) => [d.date, d]));
  const streak = new Set();
  const inGrid = new Set();
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) inGrid.add(addDays(first, c * 7 + r));
  for (let k = 0; k < (S.streak || 0); k++) { const d = addDays(anchor, -k); if (inGrid.has(d)) streak.add(d); }

  const plots = [];
  let total = 0, todayIdx = -1;
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    const date = addDays(first, c * 7 + r);
    const future = diffDays(date, anchor) < 0;
    const d = byDate.get(date) || { count: 0 };
    const count = future ? 0 : d.count || 0;
    if (!future) total += count;
    const stage = future ? 0 : stageFor(count, steps);
    const gold = !future && !!d.gold && count > 0;
    if (date === anchor) todayIdx = plots.length;
    plots.push({ c, r, date, count, stage, gold, future, today: date === anchor, streak: streak.has(date), x: x0 + c * w, y: y0 + r * h });
  }
  const sig = h32(plots.map((p) => `${p.stage}${p.gold ? 'g' : ''}${p.future ? 'f' : ''}${p.streak ? 's' : ''}`).join(''));
  return { cols, rows, w, h, x: x0, y: y0, fence: FARM.fence, plots, total, streak: S.streak || 0, streakDays: streak.size, todayIdx, anchor, sig };
}
