// Kingdom statistics: big numbers, short labels.
import { Pix, svgDoc, textW } from './pixel.mjs';
import { T, card, box, fitScale, header, pctColor, demoRibbon } from './ui.mjs';
import { drawIcon } from './sprites.mjs';
import { fmt } from '../util.mjs';

export function renderStats(state) {
  const W = 640;
  const t = state.totals;
  const tiles = [
    ['users', 'POPULATION', fmt(state.population.total), T.cyan],
    ['star', 'STARS', fmt(t.stars), T.gold],
    ['hammer', 'COMMITS', fmt(t.commits), T.orange],
    ['skull', 'OPEN ISSUES', fmt(t.issuesOpen), t.issuesOpen > 10 ? T.red : t.issuesOpen > 0 ? T.orange : T.green],
    ['sword', 'PULL REQUESTS', fmt(t.prs), T.blue],
    ['gear', 'WORKFLOWS', t.workflowHealth === null ? 'N/A' : `${t.workflowHealth}%`, t.workflowHealth === null ? T.dim : pctColor(t.workflowHealth)],
    ['wheat', 'DAY STREAK', String(state.streak), T.gold],
    ['house', 'ACTIVE REPOS', `${t.activeRepos}/${t.repos}`, T.green],
  ];
  const rows = Math.ceil(tiles.length / 2);
  const H = 92 + rows * 128 + 12;
  const p = new Pix(1);
  card(p, W, H);
  header(p, W, 'KINGDOM STATS', 'castle', state.meta.demo ? null : `SEASON ${state.season.toUpperCase()}`);
  tiles.forEach(([icon, label, value, color], i) => {
    const x = 24 + (i % 2) * 304, y = 84 + Math.floor(i / 2) * 128;
    box(p, x, y, 288, 116, { fill: T.panel, border: '#3a3f66' });
    p.r(x + 4, y + 4, 6, 108, color);
    drawIcon(p, icon, x + 26, y + 18, 4);
    const s = fitScale(value, 222, [6, 5, 4, 3]);
    p.text(value, x + 276, y + 16, s, color, { align: 'r', shadow: T.dark });
    p.text(label, x + 26, y + 76, 3, T.white);
  });
  if (state.meta.demo) demoRibbon(p, W);
  return svgDoc({
    w: W, h: H, title: 'Kingdom statistics',
    desc: `Population ${state.population.total}. ${t.stars} stars. ${t.commits} commits. ${t.issuesOpen} open issues. ${t.prs} pull requests. Workflow health ${t.workflowHealth ?? 'unknown'}. Streak ${state.streak} days.`,
    body: p.toString(), defs: p.defs.join(''),
  });
}
