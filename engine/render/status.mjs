// Technical status: is the engine healthy?
import { Pix, svgDoc } from './pixel.mjs';
import { T, card, box, header, pctColor, chip } from './ui.mjs';
import { drawIcon } from './sprites.mjs';
import { dateLabel, partsIn, pad2 } from '../util.mjs';

export const ASSET_LABELS = { world: 'WORLD', hero: 'HERO', stats: 'STATS', hall: 'HALL', harvest: 'FARM', repos: 'REPOS', camp: 'CAMP', history: 'LOG' };

export function renderStatus(state) {
  const W = 640, H = 404;
  const p = new Pix(1);
  const st = state.status;
  const failed = Object.values(st.assets).filter((v) => v !== 'ok').length;
  card(p, W, H);
  header(p, W, 'TECH STATUS', 'gear', failed ? 'NEEDS CARE' : 'ALL SYSTEMS OK', failed ? T.orange : T.green);
  const tp = partsIn(new Date(state.generatedAt), state.time.tz);
  const when = `${dateLabel(state.time.date)} ${pad2(tp.h)}:${pad2(tp.min)}`;
  const dataLabel = state.meta.demo ? 'DEMO' : state.meta.dataStatus === 'fresh' ? 'FRESH' : 'OLD';
  const rows = [
    ['UPDATED', `${when} ${state.time.tz === 'UTC' ? 'UTC' : ''}`.trim(), T.white],
    ['DATA', dataLabel, dataLabel === 'FRESH' ? T.green : T.orange],
    ['WORKFLOWS', state.workflowHealth === null ? 'N/A' : `${state.workflowHealth}%`, state.workflowHealth === null ? T.dim : pctColor(state.workflowHealth)],
    ['WORLD', `${state.timeOfDay} / ${state.weather} / ${state.season}`.toUpperCase(), T.cyan],
  ];
  rows.forEach(([k, v, c], i) => {
    const y = 84 + i * 40;
    p.text(k, 40, y, 3, T.dim);
    p.text(v, 600, y, 3, c, { align: 'r' });
    p.r(40, y + 28, 560, 2, '#2b2e4d');
  });
  const keys = Object.keys(ASSET_LABELS);
  keys.forEach((k, i) => {
    const x = 28 + (i % 4) * 146, y = 262 + Math.floor(i / 4) * 52;
    const ok = st.assets[k] === undefined || st.assets[k] === 'ok';
    box(p, x, y, 138, 44, { fill: T.panel, border: ok ? '#2f6b45' : '#8a2f3f', t: 3, n: 3 });
    p.r(x + 12, y + 14, 16, 16, ok ? T.green : T.red);
    p.text(ASSET_LABELS[k], x + 38, y + 12, 3, ok ? T.white : T.red);
  });
  return svgDoc({
    w: W, h: H, title: 'Technical status',
    desc: `Updated ${when}. Data is ${dataLabel.toLowerCase()}. ${failed ? failed + ' pictures failed to build.' : 'All pictures built.'}`,
    body: p.toString(), defs: p.defs.join(''),
  });
}
