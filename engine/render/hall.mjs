// The achievement hall.
import { Pix, svgDoc, textW } from './pixel.mjs';
import { T, card, box, header, demoRibbon } from './ui.mjs';
import { drawIcon } from './sprites.mjs';

export function renderHall(state) {
  const W = 640;
  const a = state.achievements;
  const shown = a.list.filter((x) => !x.secret || x.unlocked);
  const hidden = a.secretTotal - a.secretUnlocked;
  const rows = Math.ceil(shown.length / 2);
  const H = 92 + rows * 92 + (hidden > 0 ? 70 : 0) + 12;
  const p = new Pix(1);
  card(p, W, H);
  header(p, W, 'ACHIEVEMENT HALL', 'trophy', state.meta.demo ? null : `${a.visibleUnlocked}/${a.visibleTotal} UNLOCKED`, T.gold);
  shown.forEach((x, i) => {
    const tx = 24 + (i % 2) * 304, ty = 84 + Math.floor(i / 2) * 92;
    const on = x.unlocked;
    box(p, tx, ty, 288, 80, { fill: on ? '#2b2e4d' : T.panel, border: on ? (x.isNew ? '#fff0a0' : T.gold) : '#3a3f66' });
    if (x.isNew) p.raw('<g class="fl">') && p.r(tx + 4, ty + 4, 280, 4, '#fff0a0') && p.raw('</g>');
    p.text(x.name, tx + 16, ty + 14, 3, on ? T.white : '#6d7594');
    if (on) {
      drawIcon(p, x.icon, tx + 16, ty + 42, 4);
      drawIcon(p, 'check', tx + 62, ty + 46, 3);
      p.text(x.isNew ? 'NEW!' : 'UNLOCKED', tx + 94, ty + 46, 3, x.isNew ? '#fff0a0' : T.green);
    } else {
      drawIcon(p, 'lock', tx + 16, ty + 42, 4);
      p.text('LOCKED', tx + 62, ty + 46, 3, '#6d7594');
    }
  });
  if (hidden > 0) {
    const y = 84 + rows * 92;
    box(p, 24, y, 592, 58, { fill: T.panel, border: '#3a3f66' });
    drawIcon(p, 'lock', 40, y + 13, 4);
    p.text(`${hidden} SECRET ${hidden === 1 ? 'ACHIEVEMENT' : 'ACHIEVEMENTS'} HIDDEN`, 84, y + 19, 3, T.purple);
  }
  if (state.meta.demo) demoRibbon(p, W);
  return svgDoc({
    w: W, h: H, title: 'Achievement hall',
    desc: `${a.visibleUnlocked} of ${a.visibleTotal} achievements unlocked. Unlocked: ${a.list.filter((x) => x.unlocked).map((x) => x.name).join(', ')}.`,
    body: p.toString(), defs: p.defs.join(''),
  });
}
