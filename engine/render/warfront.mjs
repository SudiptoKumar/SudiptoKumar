// The war front camera (TRUE V3): a window into the one world, centered on the
// frontier south of the gate. Watchtowers, barricades, and the enemy approach.
import { svgDoc } from './pixel.mjs';
import { renderWorldCamera, centerRect, overlayCanvas } from './camera.mjs';
import { L } from './kingdom-layout.mjs';

/** War front: the defensive perimeter. A world camera, not a separate drawing. */
export function renderWarfront(S, rctx = {}) {
  const rect = centerRect(L.warfront[0], L.warfront[1], 80, 40);
  return renderWorldCamera(S, rctx, {
    id: 'warfront',
    rect,
    title: 'War Front',
    desc: `The war front south of the gate. ${S.raid?.active ? 'Raid in progress!' : 'All quiet on the frontier.'} Guards patrol the walls.`,
    overlay: (p, W, H) => {
      const o = overlayCanvas(W, H);
      // War banner
      o.text('WAR FRONT', W / 2, 8, 3, '#ff6b6b', { align: 'c' });
      return o;
    },
  });
}
