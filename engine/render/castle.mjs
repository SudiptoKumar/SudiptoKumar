// The castle camera (TRUE V2): a window into the one world, centered on the castle.
// The castle is the highest-level repository; this camera watches the heart of the kingdom.
import { T } from './ui.mjs';
import { drawIcon } from './sprites.mjs';
import { renderWorldCamera, centerRect, overlayCanvas } from './camera.mjs';
import { fitScale } from './ui.mjs';

export function renderCastle(S, rctx = {}) {
  const W = S.world;
  const [cx, cy] = W.anchors.castle;
  const rect = centerRect(cx, cy, 56, 68);
  const { p, vx, vy, vw, vh } = overlayCanvas(rect);

  const repo = (W.repositories || []).find((r) => r.name === (W.castle && W.castle.name));
  const name = W.castle ? W.castle.name.toUpperCase() : 'THE CASTLE';
  const sub = repo ? `LEVEL ${repo.level} · ${repo.lifecycle.key.toUpperCase()}` : '';

  // caption strip along the bottom
  p.r(vx, vy + vh - 44, vw, 44, '#14162b', 0.92).r(vx, vy + vh - 44, vw, 3, T.gold);
  drawIcon(p, 'crown', vx + 12, vy + vh - 36, 3);
  p.text(name, vx + 48, vy + vh - 34, fitScale(name, vw - 60, [2.5, 2, 1.5]), T.gold);
  if (sub) p.text(sub, vx + 48, vy + vh - 18, fitScale(sub, vw - 60, [2, 1.5]), T.dim);
  if (S.meta.demo) p.text('DEMO', vx + vw - 12, vy + 14, 2, '#ff9a9a', { align: 'r' });

  return renderWorldCamera(S, rctx, {
    rect, w: 448, h: 544,
    title: 'The castle',
    desc: `${name}. ${sub}. The highest-level repository, seat of the kingdom.`,
    overlay: p.toString(),
  });
}
