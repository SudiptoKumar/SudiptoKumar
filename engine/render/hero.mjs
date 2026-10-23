// The hero HUD (TRUE V2): a character screen whose portrait is the CASTLE camera, a live window onto the one kingdom, centred on the hero.
// So the portrait shows the place where the hero really is right now, in the real weather, light and season, among the real people.
// Words are kept to what only the hero owns: name, class, level, title, status. The quest lives in the quest strip and in the world.
import { Pix, svgDoc, textW } from './pixel.mjs';
import { T, card, box, bar, fitScale, chip, demoRibbon, slot } from './ui.mjs';
import { ITEMS, OFFHAND, HERO_STYLE, ICON, drawSprite, drawIcon } from './sprites.mjs';
import { fmt } from '../util.mjs';
import { cameraParts, manifestComment } from './camera.mjs';
import { fitText } from './overlays.mjs';

const ROLE_ICON = { builder: 'hammer', farmer: 'wheat', guardian: 'shield', merchant: 'coin', scholar: 'book', slayer: 'skull', host: 'flag' };

export function renderHero(S, rctx = {}) {
  const W = 720, H = 314;
  const h = S.hero, pr = S.profile, lvl = S.level;          // a missing hero fails this picture only (the world has its own safe default)
  const p = new Pix(1);
  card(p, W, H);

  // ---- portrait: the CASTLE camera, framed
  const PX = 24, PY = 24, PW = 208, PH = 266;
  box(p, PX, PY, PW, PH, { fill: T.dark, border: T.gold });
  const parts = cameraParts(S, rctx, 'CASTLE', { clipId: 'cvh' });
  p.raw(`<g transform="translate(${PX + 4} ${PY + 4})">${parts.body}</g>`);
  p.frame(PX, PY, PW, PH, 4, T.gold);                          // frame a second time so the weather never covers the border

  // ---- name, class
  const rx = 256, rw = 440, name = pr.name || pr.login, nameW = S.meta.demo ? 250 : rw;
  p.text(name, rx, 26, fitScale(name, nameW, [5, 4, 3]), T.white, { shadow: T.dark });
  p.text(fitText(h.class.title, rw, 3), rx, 66, fitScale(h.class.title, rw, [4, 3.5, 3]), T.cyan);
  if (S.meta.demo) demoRibbon(p, W);

  // ---- level (with the LEVEL UP tag beside it), then XP
  p.text('LV', rx, 118, 3, T.dim);
  p.text(String(lvl), rx + 54, 96, 7, T.gold, { shadow: '#7a4a1c' });
  const lvW = textW(String(lvl), 7);
  const up = S.events.active.find((e) => e.type === 'milestone' && String(e.id).startsWith('levelup'));
  if (up) { p.raw('<g class="fl">'); chip(p, rx + 54 + lvW + 16, 108, 'LEVEL UP!', { bg: '#b13e53', fg: T.white, border: T.gold, s: 3 }); p.raw('</g>'); }
  bar(p, rx, 154, rw, 18, h.xpPct, { fill: T.cyan });                       // the bar says it; the numbers are in the picture's text for screen readers

  // ---- title and status: an icon says which is which
  drawIcon(p, 'crown', rx, 184, 3);
  p.text(fitText(h.title, rw - 40, 3), rx + 40, 186, 3, T.gold);
  drawIcon(p, 'flag', rx, 212, 3);
  p.text(fitText(h.status, rw - 40, 3), rx + 40, 214, 3, T.white);

  // ---- what the hero carries: class weapon, off hand, role badges
  const st = HERO_STYLE[h.class.archetype] || HERO_STYLE.adventurer, gy = 242, items = [];
  const it = ITEMS[st.item], off = st.off && OFFHAND[st.off];
  if (it) items.push(it.spr); if (off) items.push(off.spr);
  let gx = rx;
  for (const spr of items) { const k = Math.max(2, Math.min(4, Math.floor(36 / Math.max(spr.w, spr.h)))); slot(p, gx, gy, 48, 48); drawSprite(p, spr, gx + 24 - (spr.w * k) / 2, gy + 24 - (spr.h * k) / 2, { s: k }); gx += 54; }
  p.r(gx + 2, gy + 6, 3, 36, '#3a3f66'); gx += 14;
  for (const r of h.roles) { slot(p, gx, gy, 48, 48, { border: T.goldD }); const icon = ICON[ROLE_ICON[r.id]]; if (icon) drawSprite(p, icon, gx + 24 - icon.w * 2.5, gy + 24 - icon.h * 2.5, { s: 5 }); gx += 54; }
  for (let i = h.roles.length; i < 4; i++) { slot(p, gx, gy, 48, 48, { fill: '#171934' }); gx += 54; }

  return svgDoc({
    w: W, h: H, title: `${name}, level ${lvl} ${h.class.title}`,
    desc: `${name}. ${h.class.title}. Level ${lvl}. Title ${h.title}. ${h.status.toLowerCase()}. Experience ${fmt(h.xpInto)} of ${fmt(h.xpNeed)}. Roles: ${h.roles.map((r) => r.id).join(', ') || 'none yet'}. The portrait shows where the hero is in the kingdom right now.`,
    body: p.toString(), defs: p.defs.join('') + parts.defs, meta: manifestComment(parts.manifest),
  });
}
