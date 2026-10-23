// People of the kingdom (V2): the hero in seven poses, and role NPCs that walk, work or sleep.
// Everything is drawn from the same sprites as V1, so the art style stays one style.
import { makeSprite, drawSprite } from './pixel.mjs';
import { C } from './palette.mjs';
import { heroSprite, HERO_STYLE, ITEMS, OFFHAND, NPC, NPC_ROLE, walkB } from './sprites.mjs';

export const POSES = ['idle', 'working', 'walking', 'sleeping', 'celebrating', 'fighting', 'traveling'];

// ---------------------------------------------------------------- small sprite tools
/** Turn a sprite a quarter turn clockwise. */
export function rot90(spr) {
  const rows = [];
  for (let c = 0; c < spr.w; c++) { let r = ''; for (let y = spr.h - 1; y >= 0; y--) r += spr.rows[y][c]; rows.push(r); }
  return makeSprite(rows, spr.pal);
}
const setCh = (row, i, ch) => row.slice(0, i) + ch + row.slice(i + 1);

/** The hero, changed for one pose. Cached by class + pose. */
const cache = new Map();
export function heroPoseSprite(arch, pose) {
  const key = `${arch}:${pose}`;
  if (cache.has(key)) return cache.get(key);
  const base = heroSprite(arch);
  let rows = base.rows.slice();
  if (pose === 'walkB') {
    // legs together (the passing step)
    rows[12] = '...ollllo...'; rows[13] = '...oLLLLo...'; rows[14] = '...oLLLLo...'; rows[15] = '...oooooo...';
  } else if (pose === 'celebrate') {
    // both arms up
    for (const r of [8, 9]) rows[r] = rows[r].replace(/m/g, 'b');
    for (let r = 3; r <= 7; r++) { rows[r] = setCh(rows[r], 0, 'm'); rows[r] = setCh(rows[r], 11, 'm'); }
    rows[2] = setCh(setCh(rows[2], 0, 'm'), 11, 'm');
  }
  const spr = makeSprite(rows, base.pal);
  cache.set(key, spr);
  return spr;
}

// ---------------------------------------------------------------- hero
/**
 * Draw the hero in a pose. (x, y) = top-left of the 12 x 16 body, s = grid units per art pixel.
 * Animated parts use classes from ANIM_CSS. `o.lit` adds nothing here: light is a separate layer.
 */
export function drawHeroPose(p, x, y, arch, pose = 'idle', o = {}) {
  const s = o.s ?? 1;
  const st = HERO_STYLE[arch] || HERO_STYLE.adventurer;
  const item = ITEMS[st.item];
  const off = st.off && OFFHAND[st.off];
  const still = o.still;
  const wrap = (cls, style, fn) => { if (still || !cls) fn(); else { p.raw(`<g class="${cls}"${style ? ` style="${style}"` : ''}>`); fn(); p.raw('</g>'); } };

  if (pose === 'sleeping') return sleepingHero(p, x, y, arch, s, o);

  if (pose === 'walking' || pose === 'traveling') {
    const a = heroPoseSprite(arch, 'idle'), b = heroPoseSprite(arch, 'walkB');
    wrap('bob', 'animation-duration:.8s', () => {
      p.raw('<g class="f1">'); drawSprite(p, a, x, y, { s }); p.raw('</g><g class="f2">'); drawSprite(p, b, x, y, { s }); p.raw('</g>');
      if (item) drawSprite(p, item.spr, x + item.dx * s, y + item.dy * s, { s });
    });
    if (pose === 'traveling') { drawSprite(p, ITEMS.bag.spr, x - 3 * s, y + 6 * s, { s }); }
    return;
  }
  if (pose === 'celebrating') {
    wrap('bob2', 'animation-duration:.9s', () => {
      drawSprite(p, heroPoseSprite(arch, 'celebrate'), x, y, { s });
      if (item) drawSprite(p, item.spr, x + 10 * s, y - 6 * s, { s });
    });
    for (const [dx, dy, c, dl] of [[-3, 0, C.yellow, 0], [14, -2, C.cyan, -.6], [3, -6, C.lime, -1.2], [11, -8, '#ff9ecb', -1.8]]) {
      wrap('tw', `animation-delay:${dl}s`, () => { p.r(x + dx * s, y + dy * s - s, s, 3 * s, c); p.r(x + dx * s - s, y + dy * s, 3 * s, s, c); });
    }
    return;
  }
  if (pose === 'fighting') {
    if (off) drawSprite(p, off.spr, x - 3 * s, y + 5 * s, { s });
    wrap('bob', 'animation-duration:.6s', () => {
      drawSprite(p, heroSprite(arch), x, y, { s });
      const sw = rot90(ITEMS.sword.spr);                 // sword held out to the side
      drawSprite(p, sw, x + 11 * s, y + 7 * s, { s });
    });
    wrap('f1', '', () => { p.r(x + 17 * s, y + 3 * s, 2 * s, s, C.white); p.r(x + 19 * s, y + 4 * s, s, 2 * s, C.white); p.r(x + 20 * s, y + 6 * s, s, 2 * s, '#fff6a0'); p.r(x + 19 * s, y + 8 * s, s, s, C.white); });
    return;
  }
  if (pose === 'working') {
    drawSprite(p, heroSprite(arch), x, y, { s });
    wrap('sw', 'animation-duration:.9s', () => drawSprite(p, ITEMS.hammer.spr, x + 9 * s, y + 3 * s, { s }));
    wrap('f1', '', () => { p.r(x + 15 * s, y + 8 * s, s, s, C.yellow); p.r(x + 16 * s, y + 7 * s, s, s, C.white); p.r(x + 14 * s, y + 9 * s, s, s, C.orange); });
    return;
  }
  // idle
  wrap('bob2', 'animation-duration:2.4s', () => drawHeroPlain(p, x, y, arch, s, o));
}
function drawHeroPlain(p, x, y, arch, s, o) {
  const st = HERO_STYLE[arch] || HERO_STYLE.adventurer;
  const off = st.off && OFFHAND[st.off];
  if (off) drawSprite(p, off.spr, x + off.dx * s, y + off.dy * s, { s });
  drawSprite(p, heroSprite(arch), x, y, { s });
  const it = ITEMS[st.item];
  if (it) drawSprite(p, it.spr, x + it.dx * s, y + it.dy * s, { s });
}

/**
 * Lying on a bed under a blanket, head on a pillow, with z letters. (x, y) = top-left of a 14 x 9 bed (units of s).
 * The hero sprite is turned a quarter turn and drawn at half size: pixel (col, row) -> (X = row, Y = 11 - col).
 */
function sleepingHero(p, x, y, arch, s, o) {
  const spr = heroSprite(arch), k = s / 2;
  p.r(x, y + 7 * s, 14 * s, 2 * s, '#4e2f1c').r(x, y + 6 * s, 14 * s, s, '#7a4a2b');       // bed frame
  p.r(x, y + 9 * s, 2 * s, s, '#4e2f1c').r(x + 12 * s, y + 9 * s, 2 * s, s, '#4e2f1c');     // legs
  p.r(x + s, y + 5 * s, 12 * s, s, '#e8d5a8');                                              // mattress
  p.r(x + s, y + 2 * s, 5 * s, 3 * s, '#f4f4f4').r(x + s, y + 2 * s, 5 * s, k, '#ffffff');   // pillow
  const x0 = x + 3 * s, y0 = y + 5 * s - spr.w * k;
  for (let c = 0; c < spr.w; c++) for (let r = 0; r < spr.h; r++) {
    const ch = spr.rows[r][c]; const col = ch !== '.' && spr.pal[ch];
    if (col) p.r(x0 + r * k, y0 + (spr.w - 1 - c) * k, k, k, col);
  }
  p.r(x + 6 * s, y + 1.5 * s, 7 * s, 3.5 * s, '#b13e53').r(x + 6 * s, y + 1.5 * s, 7 * s, k, '#d65b70'); // blanket over the body
  p.r(x + 8 * s, y + 3 * s, s, 2 * s, '#8c2f43').r(x + 10 * s, y + 3 * s, s, 2 * s, '#8c2f43');         // folds
  if (!o.still) for (let i = 0; i < 2; i++) {
    p.raw(`<g class="zz" style="animation-delay:${-i * 1.5}s">`);
    p.r(x + 3 * s, y - 2 * s, 3 * s, s, C.white).r(x + 4 * s, y - s, s, s, C.white).r(x + 3 * s, y, 3 * s, s, C.white);
    p.raw('</g>');
  }
}

// ---------------------------------------------------------------- NPC roles
export const ROLE_SPRITE = {
  villager: NPC.villager, villager2: NPC.villager2, villager3: NPC.villager3,
  builder: NPC.builder, farmer: NPC.farmer, guard: NPC.guard, messenger: NPC.courier, traveler: NPC.traveler, visitor: NPC.visitor,
  miner: NPC_ROLE.miner, merchant: NPC_ROLE.merchant, librarian: NPC_ROLE.librarian, researcher: NPC_ROLE.researcher, firefighter: NPC_ROLE.firefighter,
};
/** Register both walking frames of a role as symbols (cheap to place many times). */
export function npcSymbols(p, role, s = 0.5) {
  const spr = ROLE_SPRITE[role] || NPC.villager;
  p.symbol(`n-${role}-a`, (q) => drawSprite(q, spr, 0, 0, { s }));
  p.symbol(`n-${role}-b`, (q) => drawSprite(q, walkB(spr), 0, 0, { s }));
  return { w: spr.w * s, h: spr.h * s };
}
/** Stand (a frame of a role), optionally with a small bob. */
export function npcStand(p, role, x, y, { s = 0.5, bob = false, flip = false, still = false } = {}) {
  const { h } = npcSymbols(p, role, s);
  if (bob && !still) p.raw('<g class="bob" style="animation-duration:1.1s">');
  p.use(`n-${role}-a`, x, y - h, flip ? `transform="translate(${(x * 2 + 6 * s) * p.u} 0) scale(-1 1)"` : '');
  if (bob && !still) p.raw('</g>');
}
/** Walk back and forth over dx grid units (use dy for vertical). Legs alternate; the walker turns around. */
export function npcWalk(p, role, x, y, { dx = 0, dy = 0, s = 0.5, t = 14, delay = 0, still = false, top = null } = {}) {
  const { w, h } = npcSymbols(p, role, s);
  const u = p.u;
  if (still) { p.use(`n-${role}-a`, x, y - h); return; }
  const cls = dx ? 'wk' : 'wy';
  const vars = dx ? `--dx:${dx * u}px` : `--dy:${dy * u}px`;
  p.raw(`<g class="${cls}" style="--t:${t}s;${vars};animation-delay:${-delay}s">`);
  if (dx) p.raw(`<g class="fc" style="--t:${t}s;animation-delay:${-delay}s">`);
  p.raw(`<g class="f1" style="animation-duration:.7s">`); p.use(`n-${role}-a`, x, y - h); p.raw('</g>');
  p.raw(`<g class="f2" style="animation-duration:.7s">`); p.use(`n-${role}-b`, x, y - h); p.raw('</g>');
  if (top) top(x, y - h);                                    // extra that travels with the walker (an umbrella, a flag, a torch)
  if (dx) p.raw('</g>');
  p.raw('</g>');
}
/** A sleeper next to a house (night, or a quiet kingdom). */
export function npcSleep(p, x, y, { s = 0.5 } = {}) {
  drawSprite(p, NPC.sleeper, x, y - NPC.sleeper.h * s, { s });
  for (let i = 0; i < 2; i++) { p.raw(`<g class="zz" style="animation-delay:${-i * 1.5}s">`); p.r(x + 2 * s, y - 6 * s, 2 * s, s, C.white).r(x + 3 * s, y - 5 * s, s, s, C.white).r(x + 2 * s, y - 4 * s, 2 * s, s, C.white); p.raw('</g>'); }
}
/** Small umbrella over a walker (rain). */
export function umbrella(p, x, y, c = '#3b5dc9') {
  p.r(x - 2, y - 2, 6, 1, c).r(x - 1, y - 3, 4, 1, c).r(x, y - 4, 2, 1, c).r(x + 1, y - 1, 1, 3, '#4e2f1c');
}
