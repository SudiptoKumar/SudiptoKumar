// The two compact HUD strips (V2).
//   - renderEvents: the Primary Event camera — a window into the one world, aimed at where the story is.
//     When nothing is happening the slot is empty and the section hides itself.
//   - renderQuest: kingdom power and the quests, each quest tagged with the world anchor it points to.
import { Pix, svgDoc, textW } from './pixel.mjs';
import { T, TONE, card, box, bar, fitScale, wrapFit, demoRibbon, pctColor } from './ui.mjs';
import { drawIcon } from './sprites.mjs';
import { renderWorldCamera, centerRect, overlayCanvas, ANCHOR_NAMES } from './camera.mjs';
import { fmt } from '../util.mjs';

const EVENT_TONE = { raid: 'danger', emergency: 'danger', recovery: 'good', release: 'gold', milestone: 'gold', expansion: 'info', harvest: 'gold', nightstars: 'info' };

/** Where the camera points for an event: the place the story is happening. */
function eventAnchor(W, ev) {
  const A = W.anchors;
  const repoAt = (name) => { const b = (W.repositories || []).find((r) => r.name === name); return b ? [b.x, b.y] : null; };
  switch (ev.type) {
    case 'release': return A.castle;
    case 'emergency':
    case 'recovery': return repoAt(ev.detail) || A.ci;
    case 'raid': return A.gate;
    case 'milestone': return A.shrine;
    case 'harvest': return [A.farm[0] + 37, A.farm[1] + 17];
    case 'expansion': return repoAt(ev.detail) || A.plaza;
    default: return A.plaza;
  }
}

// ---------------------------------------------------------------- primary event camera
export function renderEvents(S) {
  const W = S.world;
  const ev = (W.events || [])[0];
  if (!ev) return null;
  const anchor = eventAnchor(W, ev);
  const rect = centerRect(anchor[0], anchor[1], 80, 30);
  const { p, vx, vy, vw, vh } = overlayCanvas(rect);
  const tone = EVENT_TONE[ev.type] || 'gold', col = TONE[tone] || T.gold;
  // caption strip along the bottom of the camera
  p.r(vx, vy + vh - 46, vw, 46, '#14162b', 0.92).r(vx, vy + vh - 46, vw, 3, col);
  p.raw(tone === 'danger' ? '<g class="fl">' : '<g>');
  drawIcon(p, ev.icon, vx + 12, vy + vh - 38, 3);
  p.raw('</g>');
  p.text(ev.title, vx + 50, vy + vh - 36, fitScale(ev.title, vw - 62, [2.5, 2, 1.5]), T.dim);
  const caption = ev.detail && ev.detail !== ev.title ? `${ev.detail}` : '';
  if (caption) { const t = wrapFit(caption, vw - 150, [3, 2.5, 2], 1); t.lines.forEach((ln, k) => p.text(ln, vx + 50, vy + vh - 20 + k * 20, t.s, T.white)); }
  if (S.meta.demo) p.text('DEMO', vx + vw - 12, vy + 14, 2, '#ff9a9a', { align: 'r' });
  return renderWorldCamera(S, {}, {
    rect, w: 640, h: 240,
    title: `World event: ${ev.title}`,
    desc: `${ev.title}${ev.detail ? ` — ${ev.detail}` : ''}`,
    overlay: p.toString(),
  });
}

// ---------------------------------------------------------------- quests and the kingdom's power
const STATE_ICON = { ACTIVE: 'flag', COMPLETE: 'check', LOCKED: 'lock' };
export function renderQuest(S) {
  const W = 640, p = new Pix(1);
  const rows = S.quests.rows;
  const anchorById = new Map(((S.world && S.world.quests) || []).map((q) => [q.id, q.anchor]));
  const H = 108 + rows.length * 48 + 16;
  card(p, W, H);
  // ---- kingdom power
  drawIcon(p, 'crown', 28, 24, 4);
  p.text('KINGDOM POWER', 72, 26, 3, T.gold, { shadow: T.dark });
  p.text(String(S.power.value), W - 28, 18, 6, T.white, { align: 'r', shadow: T.dark });
  bar(p, 28, 62, W - 56, 26, S.power.value, { fill: pctColor(S.power.value) });
  // ---- quests, each tagged with the world anchor it points to
  rows.forEach((q, i) => {
    const y = 108 + i * 48, done = q.state === 'COMPLETE', locked = q.state === 'LOCKED';
    box(p, 28, y, W - 56, 40, { fill: done ? '#1c3a2c' : T.panel, border: done ? '#2e6b4a' : locked ? '#2b2e4d' : T.goldD, t: 3, n: 3 });
    p.raw(q.state === 'ACTIVE' ? '<g class="bob">' : '<g>');
    drawIcon(p, STATE_ICON[q.state], 42, y + 12, 2.5, locked ? { A: '#566c86' } : undefined);
    p.raw('</g>');
    const col = locked ? '#566c86' : done ? T.green : T.white;
    const bw = 110, tx = 74, barX = 388;
    p.text(q.title, tx, y + 11, fitScale(q.title, (q.state === 'ACTIVE' && q.target > 1 ? barX : W - 130) - tx - 10, [3, 2.5, 2]), col);
    if (q.state === 'ACTIVE' && q.target > 1) {
      bar(p, barX, y + 10, bw, 20, q.pct, { fill: T.cyan });
      p.text(`${fmt(q.progress)}/${fmt(q.target)}`, W - 28 - 14, y + 14, 2.5, T.dim, { align: 'r' });
    } else if (q.state === 'ACTIVE') p.text('IN PROGRESS', W - 42, y + 14, 2.5, T.dim, { align: 'r' });
    if (locked) drawIcon(p, 'lock', W - 62, y + 10, 2.5);
    if (done) p.text(q.xp ? `+${q.xp} XP` : 'DONE', W - 42, y + 12, 3, T.green, { align: 'r' });
    const anchor = anchorById.get(q.id);
    if (anchor && ANCHOR_NAMES[anchor]) p.text(`AT ${ANCHOR_NAMES[anchor]}`, W - 42, y + 29, 1.5, T.dim, { align: 'r' });
  });
  if (S.meta.demo) demoRibbon(p, W);
  const t = S.totals;
  const questDesc = rows.map((q) => {
    const a = anchorById.get(q.id);
    return `${q.state.toLowerCase()} ${q.title.toLowerCase()}${a && ANCHOR_NAMES[a] ? ` at ${ANCHOR_NAMES[a].toLowerCase()}` : ''}`;
  }).join('; ');
  return svgDoc({
    w: W, h: H, title: 'Kingdom power and quests',
    desc: `Kingdom power ${S.power.value} of 100. ${t.stars} stars, ${S.streak} day streak, ${t.activeRepos} active repositories. Quests: ${questDesc}.`,
    body: p.toString(), defs: p.defs.join(''),
  });
}
