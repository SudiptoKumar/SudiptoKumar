// The two compact HUD strips (V2): the world event HUD and the quest / status HUD.
import { Pix, svgDoc, textW } from './pixel.mjs';
import { T, TONE, card, box, bar, fitScale, wrapFit, slot, pctColor, demoRibbon } from './ui.mjs';
import { drawIcon, ICON, drawSprite } from './sprites.mjs';
import { fmt } from '../util.mjs';

// ---------------------------------------------------------------- world events: at most three short chips
export function renderEvents(S) {
  const chips = S.scene.hud;
  if (!chips.length) return null;
  const W = 640, H = 136, n = chips.length, gap = 12, pad = 20;
  const cw = Math.floor((W - 2 * pad - gap * (n - 1)) / n);
  const p = new Pix(1);
  card(p, W, H);
  chips.forEach((c, i) => {
    const x = pad + i * (cw + gap), y = 16, col = TONE[c.tone] || T.gold;
    box(p, x, y, cw, H - 32, { fill: T.panel, border: '#3a3f66', t: 3, n: 3 });
    p.r(x + 6, y + 3, cw - 12, 4, col);
    p.raw(c.tone === 'danger' ? '<g class="fl">' : '<g>');
    drawIcon(p, c.icon, x + 12, y + 16, 3.5);
    p.raw('</g>');
    p.text(c.kind, x + 12 + 40, y + 22, 2.5, T.dim);
    const t = wrapFit(c.text, cw - 24, [3, 2.5, 2], 2);
    t.lines.forEach((ln, k) => p.text(ln, x + 12, y + 54 + k * (7 * t.s + 5), t.s, col === T.red ? '#ff9a9a' : T.white));
  });
  const desc = chips.map((c) => `${c.kind}: ${c.text}`).join('. ');
  return svgDoc({ w: W, h: H, title: 'World events', desc, body: p.toString(), defs: p.defs.join('') });
}

// ---------------------------------------------------------------- quests and the kingdom's power
const STATE_ICON = { ACTIVE: 'flag', COMPLETE: 'check', LOCKED: 'lock' };
export function renderQuest(S) {
  const W = 640, p = new Pix(1);
  const rows = S.quests.rows;
  const H = 160 + rows.length * 48 + 16;
  card(p, W, H);
  // ---- kingdom power
  drawIcon(p, 'crown', 28, 24, 4);
  p.text('KINGDOM POWER', 72, 26, 3, T.gold, { shadow: T.dark });
  p.text(String(S.power.value), W - 28, 18, 6, T.white, { align: 'r', shadow: T.dark });
  bar(p, 28, 62, W - 56, 26, S.power.value, { fill: pctColor(S.power.value) });
  // ---- four tiles: icon + exact number, no labels
  const t = S.totals;
  const tiles = [
    ['star', fmt(t.stars), T.gold], ['wheat', fmt(S.streak), T.orange], ['gear', t.workflowHealth == null ? '--' : `${t.workflowHealth}%`, pctColor(t.workflowHealth ?? 100)], ['house', fmt(t.activeRepos), T.cyan],
  ];
  const tw = (W - 56 - 3 * 10) / 4;
  tiles.forEach(([icon, val, col], i) => {
    const x = 28 + i * (tw + 10), y = 100;
    slot(p, x, y, tw, 44);
    drawIcon(p, icon, x + 10, y + 8, 3.5);
    p.text(val, x + tw - 10, y + 12, fitScale(val, tw - 56, [3.5, 3, 2.5]), col, { align: 'r' });
  });
  // ---- quests
  rows.forEach((q, i) => {
    const y = 158 + i * 48, done = q.state === 'COMPLETE', locked = q.state === 'LOCKED';
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
  });
  if (S.meta.demo) demoRibbon(p, W);
  return svgDoc({
    w: W, h: H, title: 'Kingdom power and quests',
    desc: `Kingdom power ${S.power.value} of 100. ${t.stars} stars, ${S.streak} day streak, workflows ${t.workflowHealth}%, ${t.activeRepos} active repositories. Quests: ${rows.map((q) => `${q.state.toLowerCase()} ${q.title.toLowerCase()}`).join('; ')}.`,
    body: p.toString(), defs: p.defs.join(''),
  });
}
