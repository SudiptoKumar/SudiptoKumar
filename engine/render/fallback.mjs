// If one picture fails, this small card takes its place. The rest of the README keeps working.
import { Pix, svgDoc } from './pixel.mjs';
import { T, card } from './ui.mjs';
import { drawIcon } from './sprites.mjs';

export function fallbackSvg(name, reason = '') {
  const p = new Pix(1);
  card(p, 640, 190, { border: '#8a2f3f' });
  drawIcon(p, 'skull', 40, 42, 6);
  p.text('WORLD FAILURE', 112, 40, 5, T.red, { shadow: T.dark });
  p.text(`THE ${String(name).toUpperCase()} PICTURE FAILED`, 112, 92, 3, T.white);
  p.text('IT TRIES AGAIN AT THE NEXT UPDATE', 112, 126, 3, T.dim);
  return svgDoc({ w: 640, h: 190, title: 'World failure', desc: `The ${name} picture could not be built. ${reason}`.trim(), body: p.toString() });
}
