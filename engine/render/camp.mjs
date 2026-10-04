// The visitor camp (V2). A clearing by the forest. Every approved flag is a tent, a flag and a face.
//   traveler arrives -> a tent goes up -> the flag is planted -> the visitor sits by the fire.
// What the scene shows comes from approved visitor data only. All text is short, plain and drawn by the pixel font
// (or escaped), avatars are the same safe kinds as in V1: github picture (checked), pixel hero, generated face.
import { Pix, svgDoc, textW } from './pixel.mjs';
import { T, card, box, demoRibbon } from './ui.mjs';
import { drawIcon, drawSprite, ICON, GOBLIN, GOBLIN2, TREE_PINE, TREE_OAK } from './sprites.mjs';
import { drawHeroPose, npcWalk, npcStand, rot90 } from './actors.mjs';
import { lightLayer } from './light.mjs';
import { C, SEASONS, TINT, darken, lighten } from './palette.mjs';
import { truncate, hash32, pad3 } from '../util.mjs';

export const FLAG_COLORS = { red: C.red, blue: C.blue, green: C.green, gold: C.yellow, purple: '#b48cf0', orange: C.orange };
const AVATAR_ARCH = { knight: 'paladin', mage: 'mage', ranger: 'ranger', rogue: 'rogue' };
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** A little pixel face made from the name. Same name = same face. */
export function identicon(p, login, x, y, s) {
  const h = hash32(login.toLowerCase());
  const pal = ['#ef7d57', '#41a6f6', '#a7f070', '#b48cf0', '#ffcd75', '#73eff7', '#ff9ecb'];
  const c = pal[h % pal.length];
  p.r(x, y, 5 * s, 5 * s, '#14162b');
  for (let r = 0; r < 5; r++) for (let col = 0; col < 3; col++) {
    if ((h >> (r * 3 + col + 3)) & 1) { p.r(x + col * s, y + r * s, s, s, c); p.r(x + (4 - col) * s, y + r * s, s, s, c); }
  }
}
/** A framed portrait, size x size. The github picture is only used when it passes the same checks as in V1. */
export function avatar(p, f, x, y, items, size = 64) {
  p.r(x, y, size, size, '#0e1024').frame(x, y, size, size, 3, '#3a3f66');
  const style = f.avatar || 'identicon';
  if (style === 'github' && items?.[f.login]) {
    const it = items[f.login];
    if (/^image\/(png|jpeg)$/.test(it.mime) && B64.test(it.b64) && it.b64.length < 40000) {
      p.raw(`<image x="${x + 3}" y="${y + 3}" width="${size - 6}" height="${size - 6}" preserveAspectRatio="xMidYMid slice" style="image-rendering:pixelated" href="data:${it.mime};base64,${it.b64}" xlink:href="data:${it.mime};base64,${it.b64}"/>`);
      return;
    }
  }
  if (AVATAR_ARCH[style]) { p.r(x + 3, y + 3, size - 6, size - 6, '#2b3d86'); drawHeroPose(p, x + size * 0.2, y + size * 0.1, AVATAR_ARCH[style], 'idle', { s: size / 27, still: true }); return; }
  identicon(p, f.login, x + size * 0.11, y + size * 0.11, size * 0.156);
}

// tents: front row first (they are the biggest and nearest), newest visitor first
const TENT_SPOTS = [[246, 262], [394, 262], [152, 254], [488, 254], [104, 218], [536, 218], [204, 212], [436, 212]];
const FIRE = [320, 214];

export function renderCamp(S, rctx = {}) {
  const W = 640, H = 372;
  const V = S.visitors, sc = S.scene, ph = S.time.phase, SE = SEASONS[S.time.season], winter = S.time.season === 'winter';
  const raid = S.raid || {};
  const maxTents = Math.min(TENT_SPOTS.length, rctx.cfg?.visitors?.showInCamp ?? 8);
  const shown = V.flags.slice(0, maxTents);
  const p = new Pix(1), lights = [];
  card(p, W, H);

  // ---- header: a flag and the count; the raid chip only when something is happening
  drawIcon(p, 'flag', 28, 22, 4); p.text(String(V.total), 70, 26, 4, T.gold, { shadow: T.dark });
  if (raid.active || raid.done) {
    const col = raid.active ? T.red : raid.won ? T.green : T.red;
    const rx = S.meta.demo ? 236 : W - 170;                                 // keep clear of the demo ribbon
    p.raw(raid.active ? '<g class="fl">' : '<g>'); drawIcon(p, 'skull', rx, 22, 4); p.raw('</g>');
    p.r(rx + 44, 26, 98, 22, '#0e1024').r(rx + 44, 26, Math.round((98 * (raid.defense ?? 0)) / 100), 22, col, 0.85);
  }
  if (S.meta.demo) demoRibbon(p, W);

  // ---- the clearing
  const sx = 24, sy = 68, sw = 592, sh = 280;
  const [sa, sb] = ({ dawn: ['#8a5cc0', '#ef7d57'], day: ['#6cbcf7', '#a8e2fb'], evening: ['#8c3a6a', '#ef7d57'], night: ['#10163c', '#1d2a66'] })[ph];
  p.r(sx, sy, sw, sh, sa).r(sx, sy + 60, sw, 50, sb);
  if (ph === 'night') for (let i = 0; i < 40; i++) p.r(sx + 8 + ((i * 53) % 576), sy + 6 + ((i * 17) % 90), 2, 2, '#f4f4f4', 0.85);
  const sunX = ph === 'dawn' ? 90 : ph === 'evening' ? 520 : 500;
  if (ph === 'night') p.ellipse(sx + sunX, sy + 34, 12, 12, '#f4f4f4').ellipse(sx + sunX + 5, sy + 30, 10, 10, sa);
  else p.ellipse(sx + sunX, sy + (ph === 'day' ? 34 : 70), 12, 12, '#ffcd75').ellipse(sx + sunX, sy + (ph === 'day' ? 34 : 70), 8, 8, '#fff0a0');
  const gy = sy + 112;
  p.r(sx, gy, sw, sh - 112, SE.grass).r(sx, gy, sw, 3, SE.grass2);
  for (let i = 0; i < 90; i++) p.r(sx + 4 + ((i * 89) % 580), gy + 6 + ((i * 41) % 150), 6, 2, SE.grass2);
  // forest line
  const treePal = winter ? { L: '#2c6b6a', l: '#eef6fb', D: '#1b4a55', t: '#5e3820' } : { L: S.time.season === 'autumn' ? '#ef7d57' : '#2f9e5b', l: S.time.season === 'autumn' ? '#ffcd75' : S.time.season === 'spring' ? '#ffc8e0' : '#4fd070', D: S.time.season === 'autumn' ? '#b13e53' : '#257179', t: '#7a4a2b' };
  for (let i = 0; i < 17; i++) drawSprite(p, i % 3 ? TREE_PINE : TREE_OAK, sx + i * 36 - 6, gy - 40 + ((i * 11) % 14), { s: 4, pal: treePal });
  p.r(sx, gy + 6, sw, 6, darken(SE.grass, 0.25), 0.55);
  // path in from the left, trampled ground around the fire
  p.r(sx, gy + 118, 150, 16, '#b98a54').r(sx, gy + 118, 150, 2, '#d3a66e');
  p.ellipse(sx + 296, gy + 132, 230, 24, '#a87b4a', 0.55);

  // ---- the fire
  const fx = sx + FIRE[0] - 24, fy = sy + FIRE[1] - 20;
  p.r(fx - 14, fy + 44, 36, 5, '#4e2f1c').r(fx - 10, fy + 40, 28, 5, '#7a4a2b');
  for (let k = 0; k < 7; k++) p.r(fx - 16 + k * 6, fy + 48 + (k % 2) * 2, 5, 4, '#5e687c');
  const lit = V.total > 0 || sc.light.torches;
  if (lit) {
    p.raw('<g class="f1">').sprite(ICON.flame, fx - 4, fy + 4, { s: 5 }).raw('</g><g class="f2">').sprite(ICON.flame, fx - 4, fy + 4, { s: 5, flip: true }).raw('</g>');
    lights.push({ x: fx, y: fy + 8, w: 20, h: 28, glow: 2 });
  } else p.r(fx, fy + 36, 16, 4, '#2a2230').r(fx + 3, fy + 33, 4, 3, '#ef5a5a', 0.7);   // cold embers: nobody has come yet
  for (let k = 0; k < 2; k++) p.raw(`<g class="sm" style="animation-delay:${-k * 1.6}s">`).r(fx + 4 + k * 6, fy - 4, 6, 6, '#d6dde6').raw('</g>');

  // ---- tents, flags, faces
  const newest = shown[0], stage = sc.stages.visitor?.stage;
  shown.forEach((f, i) => {
    const [tx, ty] = TENT_SPOTS[i], x = sx + tx - 24, y = sy + ty - 36, col = FLAG_COLORS[f.color] || C.red;
    const building = i === 0 && stage === 'arriving';
    p.r(x - 4, y + 36, 56, 4, '#000000', 0.16);
    if (building) {                                            // arriving: poles and a bundle of canvas, the tent is not up yet
      p.r(x + 8, y + 6, 4, 32, '#7a4a2b').r(x + 36, y + 6, 4, 32, '#7a4a2b').r(x + 8, y + 6, 32, 3, '#a86b3c').r(x + 14, y + 28, 20, 10, '#e8d5a8');
    } else {
      p.sprite(ICON.tent, x, y, { s: 6, pal: { R: col } });
      p.r(x + 20, y + 24, 8, 12, '#1a1428'); lights.push({ x: x + 21, y: y + 26, w: 6, h: 8 });
    }
    p.r(x + 52, y - 14, 3, 50, '#4e2f1c');                     // the flag, planted next to the tent
    p.raw(`<g class="fl" style="animation-delay:${-(i % 4) * 0.25}s">`).r(x + 55, y - 14, 20, 12, col).r(x + 55, y - 14, 20, 3, lighten(col, 0.4)).r(x + 55, y - 4, 8, 4, col).raw('</g>');
  });
  // the newest visitors have a face on a post (three at most) and the very newest has a speech bubble
  shown.slice(0, 3).forEach((f, i) => {
    const [tx, ty] = TENT_SPOTS[i], cx = sx + tx, by = sy + ty - 36 - 64;
    p.r(cx - 1, by + 40, 3, 24, '#4e2f1c');
    avatar(p, f, cx - 20, by, rctx.avatars, 40);
    p.r(cx - 20, by - 14, 40, 14, '#14162b').r(cx - 20, by - 14, 40, 2, FLAG_COLORS[f.color] || C.red);
    p.text(`#${pad3(f.n)}`, cx, by - 11, 1.7, T.gold, { align: 'c' });
  });
  if (newest) {
    const [tx, ty] = TENT_SPOTS[0];
    const msg = truncate(newest.message, 24), who = `@${truncate(newest.login, 14)}`;
    const s = 2, w = Math.max(textW(msg, s), textW(who, s)) + 24, bx = Math.max(sx + 8, Math.min(sx + sw - w - 8, sx + tx - w / 2)), by = sy + 52;
    p.r(bx, by, w, 62, '#f4f4f4').r(bx + 3, by + 3, w - 6, 56, '#14162b');
    p.text(who, bx + 12, by + 12, s, FLAG_COLORS[newest.color] || T.gold);
    p.text(msg, bx + 12, by + 36, s, T.white);
    p.r(sx + tx - 4, by + 62, 10, 6, '#f4f4f4').r(sx + tx - 1, by + 68, 4, 6, '#f4f4f4');
  }
  if (V.total > shown.length) { p.r(sx + sw - 80, sy + sh - 34, 70, 26, '#14162b', 0.88).r(sx + sw - 80, sy + sh - 34, 70, 3, T.gold); p.text(`+${V.total - shown.length}`, sx + sw - 45, sy + sh - 26, 2.5, T.gold, { align: 'c' }); }

  // ---- arriving traveler
  if (stage === 'arriving' && !sc.behavior.home) npcWalk(p, 'traveler', 30, gy + 150, { dx: 150, s: 3, t: 10, top: (x, y) => { p.r(x + 16, y - 6, 2, 22, '#4e2f1c'); p.r(x + 18, y - 6, 10, 6, FLAG_COLORS[newest?.color] || C.red); } });
  else if (!sc.behavior.home && V.total > 0) npcStand(p, 'visitor', sx + FIRE[0] + 40, sy + FIRE[1] + 28, { s: 3, bob: true });

  // ---- empty camp: a stake, a white flag, a ghost tent
  if (!V.total) {
    p.r(sx + 150, gy + 40, 3, 70, '#4e2f1c'); p.raw('<g class="fl">').r(sx + 153, gy + 40, 28, 16, '#f4f4f4').r(sx + 153, gy + 40, 28, 3, '#ffffff').raw('</g>');
    for (const [dx, dy, w, h] of [[400, 58, 4, 4], [412, 58, 4, 4], [424, 58, 4, 4], [406, 70, 4, 4], [418, 70, 4, 4], [412, 82, 4, 4]]) p.raw('<g class="tw">').r(sx + dx, gy + dy, w, h, '#f4f4f4', 0.45).raw('</g>');
  }

  // ---- goblin scouts at the forest edge: awake when a raid could come, asleep while they rest, in battle during a raid
  const gx = sx + sw - 70;
  if (raid.active) {
    for (let i = 0; i < 3; i++) p.raw(`<g class="bob" style="animation-duration:.45s;animation-delay:${-i * 0.15}s">`).sprite(i % 2 ? GOBLIN2 : GOBLIN, gx - i * 22, gy + 70 + (i % 2) * 8, { s: 4 }).raw('</g>');
    p.raw('<g class="f1">').r(gx - 60, gy + 66, 16, 3, C.white).r(gx - 46, gy + 70, 3, 14, '#fff6a0').raw('</g>');
  } else if (raid.available === false) {
    p.sprite(rot90(GOBLIN), gx - 4, gy + 86, { s: 4 });
    p.raw('<g class="zz">').text('Z', gx + 22, gy + 62, 2.5, T.white).raw('</g>');
  } else {
    p.raw('<g class="bob">').sprite(GOBLIN, gx, gy + 62, { s: 4 }).raw('</g>');
    p.raw('<g class="pu">').sprite(ICON.horn, gx - 40, gy + 66, { s: 3 }).raw('</g>');
  }

  const [tc, ta] = TINT[ph];
  lightLayer(p, { W, H, tint: [tc, ta], lights, moon: false, region: { x: 24, y: 68, w: 592, h: 280 } });
  p.frame(24, 68, 592, 280, 4, T.gold);
  const who = shown.map((f) => '@' + f.login).join(', ');
  return svgDoc({
    w: W, h: H, title: 'Visitor camp',
    desc: V.total ? `${V.total} visitors planted flags. Latest: ${who}. Goblin raid: ${raid.active ? 'under attack' : raid.available ? 'available' : 'resting'}.` : 'No visitor flags yet. The camp is empty.',
    body: p.toString(), defs: p.defs.join(''),
  });
}
