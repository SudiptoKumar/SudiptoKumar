// Kingdom history: how the level grew over time.
import { Pix, svgDoc, textW } from './pixel.mjs';
import { T, card, box, header, chip } from './ui.mjs';
import { drawIcon } from './sprites.mjs';
import { diffDays, MONTHS } from '../util.mjs';

const label = (d) => `${MONTHS[+d.slice(5, 7) - 1]} ${d.slice(2, 4)}`;

export function renderChronicle(state) {
  const W = 640, H = 470;
  const pts = state.history.points;
  const p = new Pix(1);
  card(p, W, H);
  header(p, W, 'KINGDOM HISTORY', 'book', state.meta.demo ? null : `${pts.length} DAYS LOGGED`, T.dim);
  const X0 = 70, X1 = 604, Y0 = 130, Y1 = 330;
  box(p, 24, 84, 592, 364, { fill: T.panel, border: '#3a3f66' });
  if (pts.length < 2) {
    p.text('THE STORY STARTS TODAY', W / 2, 200, 4, T.gold, { align: 'c' });
    p.text(`LEVEL ${state.level}`, W / 2, 252, 5, T.white, { align: 'c' });
    return svgDoc({ w: W, h: H, title: 'Kingdom history', desc: 'History starts today.', body: p.toString(), defs: p.defs.join('') });
  }
  const t0 = pts[0].d, t1 = pts[pts.length - 1].d;
  const span = Math.max(1, diffDays(t0, t1));
  const lmin = Math.max(1, Math.min(...pts.map((q) => q.l)) - 1), lmax = Math.max(...pts.map((q) => q.l)) + 1;
  const px = (d) => X0 + ((X1 - X0) * diffDays(t0, d)) / span;
  const py = (l) => Y1 - ((Y1 - Y0) * (l - lmin)) / Math.max(1, lmax - lmin);
  // grid
  for (let i = 0; i <= 4; i++) p.r(X0, Y0 + ((Y1 - Y0) * i) / 4, X1 - X0, 2, '#2b2e4d');
  p.text(`LV${lmax}`, 34, Y0 - 10, 3, T.dim);
  p.text(`LV${lmin}`, 34, Y1 - 10, 3, T.dim);
  // step chart
  const levelAt = (d) => { let v = pts[0]; for (const q of pts) { if (q.d <= d) v = q; else break; } return v; };
  const dayOf = (k) => { const dt = new Date(t0 + 'T00:00:00Z'); dt.setUTCDate(dt.getUTCDate() + Math.round((span * k) / 134)); return dt.toISOString().slice(0, 10); };
  for (let k = 0; k <= 134; k++) {
    const d = dayOf(k), q = levelAt(d), y = Math.round(py(q.l));
    const x = Math.round(X0 + ((X1 - X0) * k) / 134);
    p.r(x, y, 4, Y1 - y, q.e ? '#4a7a5a' : '#2f9e5b', 0.45).r(x, y - 2, 4, 5, q.e ? '#9fd8a8' : '#a7f070');
  }
  // four checkpoints
  const marks = [0, Math.floor((pts.length - 1) / 3), Math.floor(((pts.length - 1) * 2) / 3), pts.length - 1].filter((v, i, a) => a.indexOf(v) === i);
  marks.forEach((idx) => {
    const q = pts[idx], x = px(q.d), y = py(q.l);
    p.r(x - 5, y - 5, 10, 10, '#14162b').r(x - 3, y - 3, 6, 6, '#ffcd75');
  });
  const chipsY = 350;
  const cw = 592 / marks.length;
  marks.forEach((idx, i) => {
    const q = pts[idx];
    const cx = 24 + i * cw + cw / 2;
    p.text(`LV${q.l}`, cx, chipsY, 4, i === marks.length - 1 ? T.gold : T.white, { align: 'c' });
    p.text(i === marks.length - 1 ? 'TODAY' : label(q.d), cx, chipsY + 36, 3, T.dim, { align: 'c' });
    if (i < marks.length - 1) p.r(cx + 56, chipsY + 12, cw - 112, 4, '#3a3f66');
  });
  if (pts.some((q) => q.e)) p.text('PALE = ESTIMATED PAST', 40, 416, 3, '#6d8a76');
  return svgDoc({
    w: W, h: H, title: 'Kingdom history',
    desc: `Level history from ${label(t0)} to today. ${marks.map((i) => 'Level ' + pts[i].l + ' on ' + label(pts[i].d)).join(', ')}.`,
    body: p.toString(), defs: p.defs.join(''),
  });
}
