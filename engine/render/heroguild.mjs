// The hero guild camera (TRUE V3): a window into the one world, centered on the
// hero's guild hall. Equipment, training yard, and the hero's rest area.
import { svgDoc } from './pixel.mjs';
import { renderWorldCamera, centerRect, overlayCanvas } from './camera.mjs';
import { L } from './kingdom-layout.mjs';

/** Hero guild: the hero's home base. A world camera, not a separate drawing. */
export function renderHeroguild(S, rctx = {}) {
  const hero = S.world.hero;
  const rect = centerRect(L.heroguild[0], L.heroguild[1], 48, 40);
  return renderWorldCamera(S, rctx, {
    id: 'heroguild',
    rect,
    title: 'Hero Guild',
    desc: `The hero guild. ${S.hero.class.title}, level ${S.level}. ${hero.state}.`,
    overlay: (p, W, H) => {
      const o = overlayCanvas(W, H);
      o.text('HERO GUILD', W / 2, 8, 3, '#b48cf0', { align: 'c' });
      return o;
    },
  });
}
