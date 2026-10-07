// The dungeon camera (TRUE V2): a window into the one world, centered on the gate
// and the dungeons below it. Open issues wait here as goblins; raids are fought here.
import { T, fitScale } from './ui.mjs';
import { drawIcon } from './sprites.mjs';
import { renderWorldCamera, centerRect, overlayCanvas } from './camera.mjs';

export function renderDungeon(S, rctx = {}) {
  const W = S.world;
  const [gx, gy] = W.anchors.gate;
  const rect = centerRect(gx, gy + 8, 72, 44);
  const { p, vx, vy, vw, vh } = overlayCanvas(rect);

  const issues = W.dungeon ? W.dungeon.issues : 0;
  const raid = S.raid || {};
  const sub = raid.active ? `UNDER ATTACK — DEFENSE ${raid.defense}%` : `${issues} OPEN ISSUES`;

  // caption strip along the bottom
  const col = raid.active ? T.red : T.orange;
  p.r(vx, vy + vh - 44, vw, 44, '#14162b', 0.92).r(vx, vy + vh - 44, vw, 3, col);
  p.raw(raid.active ? '<g class="fl">' : '<g>');
  drawIcon(p, 'skull', vx + 12, vy + vh - 36, 3);
  p.raw('</g>');
  p.text('THE DUNGEON', vx + 48, vy + vh - 34, 2.5, col === T.red ? '#ff9a9a' : T.gold);
  p.text(sub, vx + 48, vy + vh - 18, fitScale(sub, vw - 60, [2, 1.5]), T.dim);
  if (S.meta.demo) p.text('DEMO', vx + vw - 12, vy + 14, 2, '#ff9a9a', { align: 'r' });

  return renderWorldCamera(S, rctx, {
    rect, w: 576, h: 352,
    title: 'The dungeon',
    desc: `The gate and the dungeons below. ${sub}.`,
    overlay: p.toString(),
  });
}
