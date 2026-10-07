// TRUE V2 cameras. One persistent world, many views: every camera paints the same
// world through paintWorld() and shows it through a different viewBox window.
// rect is [x0, y0, x1, y1] in world grid units; the overlay is extra SVG drawn in
// viewBox coordinates (SVG units, i.e. grid units × U) on top of the world.
import { Pix, svgDoc } from './pixel.mjs';
import { paintWorld } from './kingdom.mjs';
import { GW, GH, U } from './kingdom-layout.mjs';

/** Center a gw×gh (grid units) window on [x, y], clamped inside the world. */
export function centerRect(x, y, gw, gh) {
  const x0 = Math.min(Math.max(x - gw / 2, 0), GW - gw);
  const y0 = Math.min(Math.max(y - gh / 2, 0), GH - gh);
  return [x0, y0, x0 + gw, y0 + gh];
}

/** Human names for world anchors, shared by camera captions. */
export const ANCHOR_NAMES = {
  castle: 'THE CASTLE', plaza: 'THE PLAZA', ci: 'THE CI FORTRESS', gate: 'THE GATE',
  farm: 'THE FARM FIELDS', shrine: 'THE TROPHY SHRINE', home: 'HOME', well: 'THE OLD WELL',
  camp: 'THE VISITOR CAMP', project: 'THE PROJECT DISTRICT',
};

/** A fresh overlay canvas in viewBox coordinates for the given rect. */
export function overlayCanvas(rect) {
  const [x0, y0] = rect;
  const p = new Pix(1);
  const vx = x0 * U, vy = y0 * U, vw = (rect[2] - x0) * U, vh = (rect[3] - y0) * U;
  return { p, vx, vy, vw, vh };
}

export function renderWorldCamera(S, rctx, { rect, zoom = 2, w, h, title, desc, overlay = '' }) {
  const { body, defs } = paintWorld(S, rctx);
  const [x0, y0, x1, y1] = rect;
  const vx = x0 * U, vy = y0 * U, vw = (x1 - x0) * U, vh = (y1 - y0) * U;
  return svgDoc({
    w: w ?? Math.round(vw * zoom), h: h ?? Math.round(vh * zoom),
    viewBox: `${vx} ${vy} ${vw} ${vh}`,
    title, desc, body: body + overlay, defs,
  });
}
