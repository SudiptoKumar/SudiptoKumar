// Project districts (TRUE V2): the PROJECT_DISTRICT camera. The featured repositories are not redrawn as a skyline: they are the real
// buildings, standing in their districts on the real map. The overlay is a row of name plates on the river bank, each with a pin to its building.
import { renderCamera } from './camera.mjs';
import { T, nameWords } from './ui.mjs';
import { fitText } from './overlays.mjs';
import { textW } from './pixel.mjs';
import { ANCHORS } from '../world/layout.mjs';

const STATE_COLOR = { failing: T.red, building: T.gold, dusty: '#94b0c2', sleepy: '#94b0c2', active: T.green, abandoned: '#566c86' };

/** Up to two short lines for a repository name, from its words (7-9 characters per line at the smallest allowed text size). */
export function plateLines(name, maxChars = 8) {
  const ws = nameWords(name).map((w) => w.toUpperCase());
  const lines = []; let cur = '';
  for (const w of ws) {
    const t = cur ? `${cur} ${w}` : w;
    if (t.length <= maxChars) cur = t; else { if (cur) lines.push(cur); cur = w.length > maxChars ? `${w.slice(0, maxChars - 1)}~` : w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > 2) { lines.length = 2; if (!lines[1].endsWith('~')) lines[1] = `${lines[1].slice(0, maxChars - 1)}~`; }
  return lines;
}

export function renderDistricts(S, rctx = {}) {
  const list = S.featured.map((n) => S.repos.find((r) => r.name === n)).filter(Boolean);
  if (!list.length) return null;
  const desc = list.map((r) => `${r.name}: ${r.evolution.name.toLowerCase()}, ${r.state}`).join('; ');
  return renderCamera(S, rctx, 'PROJECT_DISTRICT', {
    title: 'Project districts', desc: `Featured projects, standing in their districts. ${desc}.`,
    overlay: (K, h) => {
      const W = K.W, n = list.length, cw = K.cam.outW, ch = K.cam.outH, slotW = (cw - 24) / n;
      const maxC = Math.max(6, Math.floor((slotW - 14) / 18));
      const pos = new Map(W.repos.map((r) => [r.name, r]));
      const plates = list.map((r) => ({ r, w: pos.get(r.name) })).sort((a, b) => (a.w?.x ?? ANCHORS.castle.x) - (b.w?.x ?? ANCHORS.castle.x));
      plates.forEach(({ r, w }, i) => {
        const cx = Math.round(12 + slotW * (i + 0.5)), lines = plateLines(r.name, maxC), pw = Math.round(Math.min(slotW - 6, Math.max(...lines.map((l) => textW(l, 3))) + 18));
        const ph = 12 + lines.length * 28 - 4, py = ch - ph - 6, col = STATE_COLOR[r.state] || T.gold;
        const inView = w && w.y >= K.cam.rect[1] && w.y <= K.cam.rect[1] + K.cam.rect[3] && w.x >= K.cam.rect[0] && w.x <= K.cam.rect[0] + K.cam.rect[2];
        if (inView) { const bx = Math.round(K.sx(w.x)), by = Math.round(K.sy(w.y + 1)), mx = Math.round((bx + cx) / 2); for (const [x, y, ww, hh] of [[bx - 1, by, 2, Math.max(0, (py - by) / 2)], [Math.min(bx, cx) - 1, by + (py - by) / 2, Math.abs(cx - bx) + 2, 2], [cx - 1, by + (py - by) / 2, 2, Math.max(0, (py - by) / 2)]]) h.r(x - 1, y - 1, ww + 2, hh + 2, '#0e1024', 0.7).r(x, y, ww, hh, col); h.r(bx - 5, by - 5, 10, 10, '#0e1024').r(bx - 3, by - 3, 6, 6, col); }
        else { h.r(cx - 7, py - 12, 14, 3, col).r(cx - 4, py - 15, 8, 3, col).r(cx - 1, py - 18, 2, 3, col); }   // the building is above the picture (castle, mine): an arrow points up
        h.r(cx - pw / 2, py, pw, ph, '#14162b', 0.94).r(cx - pw / 2, py, pw, 3, col);
        lines.forEach((l, k) => h.text(l, cx, py + 9 + k * 28, 3, T.white, { align: 'c' }));
      });
    },
  });
}
