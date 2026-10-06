// The hero HUD (V2): a character screen. The portrait is a live camera window into the one world,
// tracking the hero wherever he is; the card keeps name, class, level, XP, title, status, quest and gear.
import { Pix, svgDoc, textW } from './pixel.mjs';
import { T, card, box, bar, fitScale, chip, demoRibbon, slot } from './ui.mjs';
import { ITEMS, OFFHAND, HERO_STYLE, ICON, drawSprite } from './sprites.mjs';
import { paintWorld } from './kingdom.mjs';
import { centerRect, ANCHOR_NAMES } from './camera.mjs';
import { L, U, HERO_SPOT } from './kingdom-layout.mjs';
import { fmt } from '../util.mjs';

const ROLE_ICON = { builder: 'hammer', farmer: 'wheat', guardian: 'shield', merchant: 'coin', scholar: 'book', slayer: 'skull', host: 'flag' };

// where a named place actually is for the hero: his standing spots first, then the layout anchors
const placePos = (k) => HERO_SPOT[k] || L[k];

/** Nearest named place to a world position — the caption under the hero camera. */
function nearestPlace(x, y) {
  let best = 'THE KINGDOM', bd = Infinity;
  for (const [k, name] of Object.entries(ANCHOR_NAMES)) {
    const a = placePos(k); if (!a) continue;
    const d = Math.hypot(x - a[0], y - a[1]);
    if (d < bd) { bd = d; best = name; }
  }
  return best;
}

/** The anchor the hero is standing at, if any (used to decide the caption). */
function anchorAt(x, y) {
  for (const k of Object.keys(ANCHOR_NAMES)) {
    const a = placePos(k);
    if (a && Math.hypot(x - a[0], y - a[1]) < 8) return k;
  }
  return null;
}

/** The portrait: a live camera window into the one world, tracking the hero wherever he is. */
function portrait(p, x, y, w, h, S) {
  const W = S.world, hero = W.hero;
  box(p, x, y, w, h, { fill: T.dark, border: T.gold });
  const ix = x + 4, iy = y + 4, iw = w - 8, vh = w - 8;
  const [rx0, ry0, rx1, ry1] = centerRect(hero.x, hero.y, 22, 22);
  const { body, defs } = paintWorld(S, {});
  p.raw(`<svg x="${ix}" y="${iy}" width="${iw}" height="${vh}" viewBox="${rx0 * U} ${ry0 * U} ${(rx1 - rx0) * U} ${(ry1 - ry0) * U}" shape-rendering="crispEdges"><defs>${defs}</defs>${body}</svg>`);
  const arrived = !hero.destination || anchorAt(hero.x, hero.y) === hero.destination;
  const where = !arrived
    ? `ON THE WAY TO ${ANCHOR_NAMES[hero.destination] || 'THE KINGDOM'}`
    : nearestPlace(hero.x, hero.y);
  p.text(where, ix + iw / 2, iy + vh + 16, 2.5, T.gold, { align: 'c' });
  p.text(hero.state.toUpperCase().replace(/_/g, ' '), ix + iw / 2, iy + vh + 34, 2, T.dim, { align: 'c' });
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
