// The hero HUD (V2): a character screen. Portrait (pose + place from the scene), name, class, level, XP,
// title, status, current quest, and what the hero carries.
import { Pix, svgDoc, textW } from './pixel.mjs';
import { T, card, box, bar, fitScale, chip, demoRibbon, slot } from './ui.mjs';
import { drawHeroPose } from './actors.mjs';
import { ITEMS, OFFHAND, HERO_STYLE, ICON, GOBLIN, TREE_OAK, CROP, drawSprite } from './sprites.mjs';
import { drawRepo } from './growth.mjs';
import { C } from './palette.mjs';
import { fmt } from '../util.mjs';

const SKY = { dawn: ['#8a5cc0', '#ef7d57'], day: ['#6cbcf7', '#a8e2fb'], evening: ['#8c3a6a', '#ef7d57'], night: ['#10163c', '#1d2a66'] };
const ROLE_ICON = { builder: 'hammer', farmer: 'wheat', guardian: 'shield', merchant: 'coin', scholar: 'book', slayer: 'skull', host: 'flag' };

/** The portrait: sky for the hour, the place the hero is at, weather, and the hero in the right pose. */
function portrait(p, x, y, w, h, S) {
  const sc = S.scene, ph = S.time.phase, hero = sc.hero, arch = S.hero.class.archetype;
  box(p, x, y, w, h, { fill: T.dark, border: T.gold });
  const ix = x + 4, iy = y + 4, iw = w - 8, ih = h - 8, ground = iy + 150;
  const [a, b] = SKY[ph] || SKY.day;
  p.r(ix, iy, iw, 84, a).r(ix, iy + 84, iw, 66, b);
  if (ph === 'night' || ph === 'dawn') for (let i = 0; i < 14; i++) p.r(ix + 10 + ((i * 47) % 150), iy + 8 + ((i * 31) % 90), 3, 3, '#f4f4f4', 0.8);
  if (ph === 'night') { p.ellipse(ix + 138, iy + 28, 11, 11, '#f4f4f4').ellipse(ix + 143, iy + 24, 8, 8, a); }
  else p.ellipse(ix + 138, iy + 28, 11, 11, '#ffcd75').ellipse(ix + 138, iy + 28, 8, 8, '#fff0a0');
  if (sc.weather.kind === 'rain' || sc.weather.kind === 'storm' || sc.weather.kind === 'thunderstorm') p.r(ix, iy, iw, 150, '#20304a', 0.35);
  p.r(ix, ground, iw, ih - 150, '#2e7d4f').r(ix, ground, iw, 4, '#4fd070');
  for (let i = 0; i < 9; i++) p.r(ix + 10 + ((i * 53) % 140), ground + 14 + ((i * 29) % 56), 6, 2, '#3a9a5f');
  const spot = hero.spot;
  // the place
  if (spot === 'castle' || spot === 'plaza') {
    p.r(ix + 100, ground - 70, 60, 70, '#8a94a6').r(ix + 100, ground - 70, 60, 4, '#b8c2d0');
    for (let i = 0; i < 4; i++) p.r(ix + 104 + i * 14, ground - 80, 8, 10, '#8a94a6');
    p.r(ix + 120, ground - 40, 20, 40, '#4e2f1c').r(ix + 122, ground - 38, 16, 38, '#7a4a2b');
  } else if (spot === 'farm') {
    for (let i = 0; i < 5; i++) drawSprite(p, CROP[3 + (i % 3)], ix + 6 + i * 34, ground - 8, { s: 3 });
  } else if (spot === 'ci') {
    drawRepo(p, 'tower', ix + 134, ground + 4, { level: 4, state: 'active', scale: 3, ctx: {}, name: 'ci' });
  } else if (spot === 'gate') {
    p.r(ix + 100, ground - 60, 64, 60, '#5e687c').r(ix + 100, ground - 60, 64, 4, '#8a94a6').r(ix + 118, ground - 38, 28, 38, '#0e0510');
    p.raw('<g class="pu">').r(ix + 124, ground - 28, 4, 4, C.red).r(ix + 136, ground - 28, 4, 4, C.red).raw('</g>');
  } else if (spot === 'home') {
    p.r(ix + 90, ground - 76, 70, 76, '#e8d5a8').r(ix + 90, ground - 80, 70, 6, '#b13e53').r(ix + 104, ground - 58, 32, 28, '#3b5dc9').r(ix + 104, ground - 58, 32, 4, '#73eff7');
  } else if (spot === 'road') {
    p.r(ix, ground + 38, iw, 22, '#b98a54').r(ix, ground + 38, iw, 3, '#d3a66e');
    p.raw('<g class="dr" style="animation-duration:6s">'); for (let i = 0; i < 3; i++) drawSprite(p, TREE_OAK, ix + i * 80 - 40, ground - 28, { s: 3 }); p.raw('</g>');
  }
  // the hero
  const hx = ix + (hero.state === 'sleeping' ? 28 : 38), hy = iy + (hero.state === 'sleeping' ? 98 : 76);
  const s = hero.state === 'sleeping' ? 7 : 8;
  p.ellipse(hx + 48, ground + 40, 40, 5, '#000000', 0.3);
  drawHeroPose(p, hx, hy, arch, hero.state, { s });
  if (hero.state === 'fighting') drawSprite(p, GOBLIN, ix + iw - 62, ground + 8, { s: 6 });
  if (hero.state === 'celebrating') for (let i = 0; i < 10; i++) p.raw(`<g class="tw" style="animation-delay:${-i * 0.3}s">`).r(ix + 10 + ((i * 37) % 150), iy + 8 + ((i * 53) % 110), 4, 4, [C.red, C.yellow, C.cyan, C.lime, '#ff9ecb'][i % 5]).raw('</g>');
  if (hero.umbrella) { const c = '#3b5dc9', ux = hx - 6, uy = hy - 22; p.r(ux, uy + 24, 116, 8, c).r(ux + 8, uy + 16, 100, 8, c).r(ux + 24, uy + 8, 68, 8, c).r(ux + 40, uy, 36, 8, c).r(ux + 56, uy + 32, 6, 40, '#4e2f1c').r(ux, uy + 24, 14, 8, '#b13e53').r(ux + 102, uy + 24, 14, 8, '#b13e53'); }
  if (hero.state === 'sleeping') p.r(ix, iy, iw, ih, '#0a0f2a', 0.28);
  // frame a second time so the weather never covers the border
  p.frame(x, y, w, h, 4, T.gold);
}

export function renderHero(S) {
  const W = 640, H = 396;
  const p = new Pix(1);
  const h = S.hero, pr = S.profile, lvl = S.level;
  card(p, W, H);
  portrait(p, 24, 24, 176, 232, S);

  // ---- name, class
  const rx = 224, rw = 392;
  const name = pr.name || pr.login;
  p.text(name, rx, 28, fitScale(name, rw, [5, 4, 3]), T.white, { shadow: T.dark });
  p.text(h.class.title, rx, 74, fitScale(h.class.title, rw, [4, 3.5, 3]), T.cyan);
  if (S.meta.demo) demoRibbon(p, W);

  // ---- level (with the LEVEL UP tag beside it) and a full-width XP bar under it
  p.text('LV', rx, 126, 3, T.dim);
  p.text(String(lvl), rx + 42, 112, 9, T.gold, { shadow: '#7a4a1c' });
  const lvW = textW(String(lvl), 9);
  const up = S.events.active.find((e) => e.type === 'milestone' && String(e.id).startsWith('levelup'));
  if (up) { p.raw('<g class="fl">'); chip(p, rx + 42 + lvW + 14, 126, 'LEVEL UP!', { bg: '#b13e53', fg: T.white, border: T.gold, s: 2.5 }); p.raw('</g>'); }
  p.text('XP', rx, 184, 2.5, T.dim).text(`${fmt(h.xpInto)} / ${fmt(h.xpNeed)}`, rx + rw, 184, 2.5, T.dim, { align: 'r' });
  bar(p, rx, 202, rw, 20, h.xpPct, { fill: T.cyan });

  // ---- title, status, quest
  const rows = [['TITLE', h.title, T.gold], ['STATUS', h.status, T.white], ['QUEST', S.quests.current.title, T.cyan]];
  rows.forEach(([label, value, color], i) => {
    const y = 236 + i * 26;
    p.text(label, rx, y + 2, 2.5, T.dim);
    p.text(value, rx + 108, y, fitScale(value, rw - 108, [3, 2.5, 2]), color);
  });

  // ---- what the hero carries: class weapon, off hand, and role badges
  const st = HERO_STYLE[h.class.archetype] || HERO_STYLE.adventurer;
  const gy = 322, items = [];
  const it = ITEMS[st.item], off = st.off && OFFHAND[st.off];
  if (it) items.push(it.spr); if (off) items.push(off.spr);
  p.text('GEAR', 28, gy - 14, 2, T.dim);
  let gx = 24;
  for (const spr of items) { slot(p, gx, gy, 56, 56); drawSprite(p, spr, gx + 28 - spr.w * 2, gy + 28 - spr.h * 2, { s: 4 }); gx += 64; }
  p.r(gx + 4, gy + 6, 3, 44, '#3a3f66');
  gx += 20;
  p.text('ROLES', gx, gy - 14, 2, T.dim);
  for (const r of h.roles) { slot(p, gx, gy, 56, 56, { border: T.goldD }); const icon = ICON[ROLE_ICON[r.id]]; if (icon) drawSprite(p, icon, gx + 28 - icon.w * 3.5, gy + 28 - icon.h * 3.5, { s: 7 }); gx += 64; }
  for (let i = h.roles.length; i < 4; i++) { slot(p, gx, gy, 56, 56, { fill: '#171934' }); gx += 64; }

  if (!S.meta.demo) p.text(`DAY ${fmt(pr.kingdomDay)}`, W - 28, 354, 2.5, T.dim, { align: 'r' });
  return svgDoc({
    w: W, h: H, title: `${name}, level ${lvl} ${h.class.title}`,
    desc: `${name}. ${h.class.title}. Level ${lvl}. Title ${h.title}. ${h.status.toLowerCase()}. Quest: ${S.quests.current.title.toLowerCase()}. Roles: ${h.roles.map((r) => r.id).join(', ') || 'none yet'}.`,
    body: p.toString(), defs: p.defs.join(''),
  });
}
