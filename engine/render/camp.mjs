// Visitor camp: the latest flags that visitors planted.
import { Pix, svgDoc, textW, makeSprite } from './pixel.mjs';
import { T, card, box, header, bar } from './ui.mjs';
import { drawIcon, drawHero, ICON } from './sprites.mjs';
import { C } from './palette.mjs';
import { truncate, hash32, esc, pad3 } from '../util.mjs';

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
function avatar(p, f, x, y, items) {
  const size = 64;
  p.r(x, y, size, size, '#0e1024').frame(x, y, size, size, 3, '#3a3f66');
  const style = f.avatar || 'identicon';
  if (style === 'github' && items?.[f.login]) {
    const it = items[f.login];
    if (/^image\/(png|jpeg)$/.test(it.mime) && B64.test(it.b64) && it.b64.length < 40000) {
      p.raw(`<image x="${x + 3}" y="${y + 3}" width="${size - 6}" height="${size - 6}" preserveAspectRatio="xMidYMid slice" style="image-rendering:pixelated" href="data:${it.mime};base64,${it.b64}" xlink:href="data:${it.mime};base64,${it.b64}"/>`);
      return;
    }
  }
  if (AVATAR_ARCH[style]) { p.r(x + 3, y + 3, size - 6, size - 6, '#2b3d86'); drawHero(p, x + 14, y + 8, AVATAR_ARCH[style], { s: 2.4, items: false }); return; }
  identicon(p, f.login, x + 7, y + 7, 10);
}

export function renderCamp(state, rctx = {}) {
  const W = 640;
  const V = state.visitors;
  const shown = V.flags.slice(0, rctx.cfg?.visitors?.showInList ?? 6);
  const raid = state.raid;
  const rows = Math.max(shown.length, 1);
  const H = 92 + rows * 96 + (raid.active || raid.done ? 92 : 8) + (shown.length ? 8 : 60);
  const p = new Pix(1);
  card(p, W, H);
  header(p, W, 'VISITOR CAMP', 'flag', `${V.total} ${V.total === 1 ? 'FLAG' : 'FLAGS'}`, T.gold);
  if (!shown.length) {
    box(p, 24, 84, 592, 150, { fill: T.panel, border: '#3a3f66' });
    p.sprite(ICON.tent, 70, 130, { s: 8 });
    p.raw('<g class="f1">').sprite(ICON.flame, 190, 150, { s: 5 }).raw('</g><g class="f2">').sprite(ICON.flame, 190, 150, { s: 5, flip: true }).raw('</g>');
    p.text('NO FLAGS YET', 270, 118, 4, T.white);
    p.text('BE THE FIRST VISITOR!', 270, 160, 3, T.gold);
  }
  shown.forEach((f, i) => {
    const y = 84 + i * 96;
    box(p, 24, y, 592, 88, { fill: T.panel, border: '#3a3f66' });
    p.r(28, y + 4, 8, 80, FLAG_COLORS[f.color] || C.red);
    avatar(p, f, 48, y + 12, rctx.avatars);
    p.text(`@${truncate(f.login, 20)}`, 128, y + 14, 3, T.white);
    p.text(`#${pad3(f.n)}`, 600, y + 14, 3, T.gold, { align: 'r' });
    p.text(truncate(f.message, 24), 128, y + 50, 3, T.dim);
  });
  if (raid.active || raid.done) {
    const y = 92 + rows * 96 - 4;
    const win = raid.active ? raid.defense >= raid.attack : raid.won;
    box(p, 24, y, 592, 84, { fill: raid.active ? '#3a1a24' : '#1f3a2c', border: raid.active ? T.red : '#2f6b45' });
    drawIcon(p, 'skull', 44, y + 14, 4);
    p.text(raid.active ? `GOBLIN RAID BY @${truncate(raid.by, 14)}` : 'LAST RAID REPELLED', 90, y + 12, 3, raid.active ? '#ff9a9a' : T.green);
    p.text('KINGDOM DEFENSE', 44, y + 54, 2.5, T.dim);
    bar(p, 250, y + 46, 330, 22, raid.defense, { fill: win ? '#a7f070' : '#ef7d57', t: 3 });
    p.text(`${raid.defense}%`, 590, y + 12, 3, T.green, { align: 'r' });
  }
  return svgDoc({
    w: W, h: H, title: 'Visitor camp',
    desc: shown.length ? `${V.total} visitors planted flags. Latest: ${shown.map((f) => '@' + f.login).join(', ')}.` : 'No visitor flags yet.',
    body: p.toString(), defs: p.defs.join(''),
  });
}
