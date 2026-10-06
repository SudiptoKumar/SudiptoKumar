// The tiny status light (V2): a dot and two words. Everything else lives in `node engine/cli.mjs status`.
import { Pix, svgDoc, textW } from './pixel.mjs';
import { T } from './ui.mjs';

export function renderStatus(S) {
  const a = S.status.assets || {};
  const bad = Object.values(a).filter((v) => v !== 'ok' && v !== 'empty' && v !== 'skipped').length;   // 'empty' = nothing to show, 'skipped' = left out by --only; both are fine
  const stale = S.meta.dataStatus === 'stale', issues = (S.meta.errors || []).length;
  const [text, col] = stale ? ['DATA OLD', '#ffcd75'] : bad || issues ? ['NEEDS CARE', '#ef7d57'] : ['KINGDOM ONLINE', '#a7f070'];
  const s = 2, tw = textW(text, s), W = tw + 44, H = 28, p = new Pix(1);
  p.r(0, 0, W, H, '#14162b').r(0, 0, W, 2, '#2b2e4d').r(0, H - 2, W, 2, '#0e1024');
  p.raw('<g class="pu" style="animation-duration:2.4s">').r(11, 8, 10, 12, col).r(9, 10, 14, 8, col).r(13, 6, 6, 16, col).raw('</g>');
  p.text(text, 32, 8, s, col);
  return svgDoc({ w: W, h: H, title: text.toLowerCase(), desc: `Status: ${text.toLowerCase()}.`, body: p.toString(), defs: p.defs.join('') });
}
