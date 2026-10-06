// TRUE V2 authoritative farm model (TRUE V2 §13). One farm for the whole kingdom.
//
// Every contribution day becomes one plot: { date, count, gold, stage }.
// The overworld camera draws a window of these plots (the last 21 days);
// the farm camera draws the whole field. Both read THIS list — the farm is
// never recalculated per camera.
import { addDays, diffDays } from '../util.mjs';
export const stageFor = (count, steps) => { let s = 0; for (const t of steps) if (count >= t) s++; return s; };

/** Build the one farm model from the contribution calendar. Pure and deterministic. */
export function buildFarm(S, cfg = {}) {
  const steps = cfg.cropSteps || [1, 3, 6, 10, 15];
  const plots = (S.calendar || []).map((d) => ({
    date: d.date,
    count: d.count || 0,
    gold: !!(d.gold && d.count > 0),
    stage: stageFor(d.count || 0, steps),
  }));
  const total = plots.reduce((a, p) => a + p.count, 0);
  return { steps, plots, total, streak: S.streak || 0, map: mapWindow(plots) };
}

/** The plots a camera window shows: the last `n` days. */
export const windowPlots = (farm, n) => farm.plots.slice(-n);

// ---------------------------------------------------------------- geometry
// The overworld camera shows the last 21 days as a 7x3 plot grid in the farm
// district; the farm camera shows the whole field as a 26x7 week grid. Both
// read the same plots — only the framing differs.

/** Map window: the last 21 plots with world coordinates (farm district). */
export const MAP_FARM = { x: 8, y: 170, cols: 7, rows: 3, cell: 10 };
export function mapWindow(plots) {
  return plots.slice(-MAP_FARM.cols * MAP_FARM.rows).map((p, i) => ({
    ...p,
    x: MAP_FARM.x + (i % MAP_FARM.cols) * MAP_FARM.cell,
    y: MAP_FARM.y + Math.floor(i / MAP_FARM.cols) * MAP_FARM.cell,
  }));
}

/** Field grid for the farm camera: 26 week-columns x 7 day-rows. */
export const FIELD = { cols: 26, rows: 7 };
/**
 * fieldLayout(farm) -> { anchor, first, cellFor(date) }
 * Maps a calendar date to its [col, row] in the field, exactly as the farm
 * camera draws it. Pure and deterministic.
 */
export function fieldLayout(farm) {
  const plots = farm.plots;
  const anchor = plots.length ? plots[plots.length - 1].date : null;
  if (!anchor) return { anchor: null, first: null, cellFor: () => null };
  const wd = new Date(anchor + 'T00:00:00Z').getUTCDay();
  const first = addDays(anchor, -((FIELD.cols - 1) * 7 + wd));
  const cellFor = (date) => {
    const d = diffDays(first, date);
    if (d < 0) return null;
    const c = Math.floor(d / 7), r = d % 7;
    return c < FIELD.cols ? [c, r] : null;
  };
  return { anchor, first, cellFor };
}
