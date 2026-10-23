// The visitor camp (TRUE V2): the VISITOR_CAMP camera. The tents are the ones on the overworld, in the same places.
// The overlay adds the visitor count, the newest visitor's message and the numbers of the three newest faces.
import { renderCamera } from './camera.mjs';
import { pill, fitText } from './overlays.mjs';
import { T, wrapFit, box } from './ui.mjs';
import { FLAG_COLORS } from './kingdom-camp.mjs';
import { textW, Pix } from './pixel.mjs';
import { drawAvatar } from './kingdom-camp.mjs';
export { identicon } from './identicon.mjs';

export function renderCamp(S, rctx = {}) {
  const V = S.visitors;
  return renderCamera(S, rctx, 'VISITOR_CAMP', {
    title: 'Visitor camp',
    desc: V.total ? `${V.total} visitors have planted a flag. The newest is ${V.flags[0]?.login || 'a traveller'}.` : 'No visitors yet: the camp is empty and waiting for the first flag.',
    overlay: (K, h) => {
      const W = K.W, cw = K.cam.outW;
      pill(h, 12, 12, 'flag', String(V.total), { color: T.white });
      const newest = V.flags[0];
      if (newest) {                                                           // the newest visitor: a face and a message, like a chat line
        const msg = wrapFit(newest.message || '', 330, [3], 2), lines = msg.lines, bh = 20 + 28 * (1 + lines.length);
        const bw = Math.min(480, Math.max(textW(`@${newest.login}`.toUpperCase(), 3), ...lines.map((l) => textW(l, 3))) + 64 + 44), bx = cw - 12 - bw, by = 12;
        box(h, bx, by, bw, Math.max(bh, 88), { fill: '#14162b', border: FLAG_COLORS[newest.color] || T.gold, t: 3, n: 3 });
        drawAvatar(h, newest, bx + 14, by + 12, 64, rctx.avatars);
        h.text(fitText(`@${newest.login}`.toUpperCase(), bw - 108), bx + 92, by + 14, 3, T.cyan);
        lines.forEach((l, i) => h.text(l, bx + 92, by + 14 + 28 + i * 28, 3, T.white));
      }
    },
  });
}
