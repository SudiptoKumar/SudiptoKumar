// A little pixel face made from a name. Same name = same face. Used for visitors who have no picture.
import { hash32 } from '../util.mjs';

export function identicon(p, login, x, y, s) {
  const h = hash32(login.toLowerCase());
  const pal = ['#ef7d57', '#41a6f6', '#a7f070', '#b48cf0', '#ffcd75', '#73eff7', '#ff9ecb'];
  const c = pal[h % pal.length];
  p.r(x, y, 5 * s, 5 * s, '#14162b');
  for (let r = 0; r < 5; r++) for (let col = 0; col < 3; col++) {
    if ((h >> (r * 3 + col + 3)) & 1) { p.r(x + col * s, y + r * s, s, s, c); p.r(x + (4 - col) * s, y + r * s, s, s, c); }
  }
}
