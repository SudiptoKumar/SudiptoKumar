// The builder's yard camera (TRUE V3): a window into the one world, centered on
// the construction district. Scaffolds, materials, and builders at work.
import { svgDoc } from './pixel.mjs';
import { renderWorldCamera, centerRect, overlayCanvas } from './camera.mjs';
import { L } from './kingdom-layout.mjs';

/** Builder's yard: where the kingdom grows. A world camera, not a separate drawing. */
export function renderBuilderyard(S, rctx = {}) {
  const sim = S.simulation;
  const working = sim?.actors.filter((a) => a.role === 'builder' && a.state === 'working').length || 0;
  const rect = centerRect(L.builderyard[0], L.builderyard[1], 60, 42);
  return renderWorldCamera(S, rctx, {
    id: 'builderyard',
    rect,
    title: "Builder's Yard",
    desc: `The builder's yard. ${working} builders at work. Materials and scaffolds ready.`,
    overlay: (p, W, H) => {
      const o = overlayCanvas(W, H);
      o.text("BUILDER'S YARD", W / 2, 8, 3, '#ffcd75', { align: 'c' });
      return o;
    },
  });
}
