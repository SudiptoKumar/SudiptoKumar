// The hero card: a character sheet.
import { Pix, svgDoc, textW } from './pixel.mjs';
import { T, card, box, bar, fitScale, chip, demoRibbon } from './ui.mjs';
import { drawHero, drawIcon } from './sprites.mjs';
import { fmt, truncate } from '../util.mjs';
import { STAR_MILESTONES } from '../rules.mjs';

const BACKDROP = { dawn: ['#8a5cc0', '#ef7d57'], day: ['#6cbcf7', '#a8e2fb'], evening: ['#8c3a6a', '#ef7d57'], night: ['#10163c', '#1d2a66'] };

export function renderHero(state) {
  const W = 640, H = 596;
  const p = new Pix(1);
  const h = state.hero, pr = state.profile;
  card(p, W, H);
  p.text('THE DEVELOPER', 76, 28, 4, T.gold, { shadow: T.dark });
  drawIcon(p, 'sword', 28, 24, 4);
  if (!state.meta.demo) p.text(`DAY ${fmt(pr.kingdomDay)}`, W - 28, 32, 3, T.dim, { align: 'r' });

  // portrait
  const px = 24, py = 84, pw = 176, ph = 212;
  box(p, px, py, pw, ph, { fill: T.dark, border: T.gold });
  const [sky, low] = BACKDROP[state.time.phase] || BACKDROP.day;
  p.r(px + 4, py + 4, pw - 8, 96, sky).r(px + 4, py + 100, pw - 8, 36, low);
  p.r(px + 4, py + 136, pw - 8, ph - 140, '#2e7d4f').r(px + 4, py + 136, pw - 8, 4, '#4fd070');
  for (let i = 0; i < 9; i++) p.r(px + 14 + ((i * 53) % 140), py + 150 + ((i * 29) % 44), 6, 2, '#3a9a5f');
  if (state.time.phase === 'night' || state.time.phase === 'dawn') for (let i = 0; i < 12; i++) p.r(px + 12 + ((i * 47) % 150), py + 10 + ((i * 31) % 70), 3, 3, '#f4f4f4', 0.8);
  else { p.r(px + 130, py + 18, 22, 22, '#ffcd75').r(px + 126, py + 22, 30, 14, '#ffcd75').r(px + 136, py + 12, 10, 34, '#ffcd75'); }
  const hx = px + 40, hy = py + 54;
  p.ellipse(hx + 48, hy + 130, 40, 5, '#000000', 0.3);
  p.g(h.sleeping ? '' : 'class="bob2"', () => drawHero(p, hx, hy, h.class.archetype, { s: 8 }));
  if (h.sleeping) { for (let i = 0; i < 3; i++) p.raw(`<g class="zz" style="animation-delay:${-i}s">`).text('Z', hx + 84 + i * 12, hy - 8 - i * 14, 3 + (i > 1 ? 0 : 0), T.white).raw('</g>'); }

  // name and class
  const rx = 224, rw = 392;
  const name = truncate(pr.name.toUpperCase(), 22);
  const ns = fitScale(name, rw, [5, 4, 3]);
  p.text(name, rx, 96, ns, T.white, { shadow: T.dark });
  p.text(h.class.title, rx, 96 + 7 * ns + 14, 3, T.cyan);
  p.text('LEVEL', rx, 174, 3, T.dim);
  const lv = String(state.level);
  p.text(lv, rx, 198, 9, T.gold, { shadow: '#7a4a1c' });
  const lvW = textW(lv, 9);
  const up = state.events.active.find((e) => e.type === 'milestone' && e.id.startsWith('levelup'));
  if (up) p.raw('<g class="fl">') && chip(p, rx + lvW + 16, 214, 'LEVEL UP!', { bg: '#b13e53', fg: T.white, border: T.gold }) && p.raw('</g>');

  // XP bar
  p.text('XP', rx, 268, 3, T.dim);
  p.text(`${h.xpPct}%`, rx + rw, 266, 4, T.gold, { align: 'r' });
  bar(p, rx, 296, rw, 28, h.xpPct, { fill: '#a7f070' });
  p.text(`${fmt(h.xpInto)} / ${fmt(h.xpNeed)} XP`, rx, 334, 3, T.dim);

  // stats
  box(p, 24, 372, 592, 204, { fill: T.panel, border: '#3a3f66' });
  const st = h.stats;
  const next = STAR_MILESTONES.find((m) => m > st.reputation) || st.reputation || 1;
  const rows = [
    ['bolt', 'CODE POWER', String(st.codePower), st.codePower, '#ef7d57'],
    ['shield', 'RELIABILITY', String(st.reliability), st.reliability, '#a7f070'],
    ['flame', 'STREAK', `${st.streak} ${st.streak === 1 ? 'DAY' : 'DAYS'}`, Math.min(100, (st.streak / 30) * 100), '#ffcd75'],
    ['star', 'REPUTATION', `${fmt(st.reputation)} ${st.reputation === 1 ? 'STAR' : 'STARS'}`, Math.min(100, (st.reputation / next) * 100), '#73eff7'],
  ];
  rows.forEach(([icon, label, value, pct, color], i) => {
    const y = 386 + i * 46;
    drawIcon(p, icon, 40, y + 2, 4);
    p.text(label, 88, y, 3, T.white);
    p.text(value, 600, y - 2, 3, color, { align: 'r' });
    bar(p, 88, y + 26, 512, 12, pct, { fill: color, t: 2 });
  });
  if (state.meta.demo) demoRibbon(p, W);
  return svgDoc({
    w: W, h: H, title: `${pr.name}, level ${state.level} ${h.class.title}`,
    desc: `Character sheet. Level ${state.level}, ${h.xpPct} percent to the next level. Code power ${st.codePower}, reliability ${st.reliability}, streak ${st.streak} days, ${st.reputation} stars.`,
    body: p.toString(), defs: p.defs.join(''),
  });
}
