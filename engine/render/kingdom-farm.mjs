// The farm (TRUE V2): the contribution calendar as 26 x 7 plots on the map, with a barn and a windmill beside it.
// The plots come from world/farm.mjs (calculated once). Far away a plot is a small crop; the FARM camera shows the same plots up close.
import { CROP, WHEAT, ICON } from './sprites.mjs';
import { C, SEASONS, lighten, darken } from './palette.mjs';
import { FARM } from '../world/layout.mjs';
import { SCALE } from '../world/constants.mjs';

export function drawFarm(K) {
  const { p, W, scene, seasonKey, winter, SE } = K, F = W.farm, P = FARM.plots, [fx0, fy0, fw, fh] = FARM.fence;
  const near = K.lod === 'near', cs = SCALE.crop;
  K.place(fy0 + 10, () => K.obj('farm', { x: fx0 + fw / 2, y: fy0 + fh / 2, st: F.sig, box: [fx0 - 2, fy0 - 6, fw + 4, fh + 10], lod: K.lod }, () => {
    // the field: dark earth inside a wooden fence
    p.r(fx0, fy0, fw, fh, '#4e2f1c').r(fx0 + 0.5, fy0 + 0.5, fw - 1, fh - 1, darken(SE.grass, 0.18));
    for (let x = fx0; x < fx0 + fw; x += 2) { p.r(x, fy0 - 1.5, 0.5, 2, '#a86b3c'); p.r(x, fy0 + fh - 0.5, 0.5, 2, '#a86b3c'); }
    for (let y = fy0; y < fy0 + fh; y += 2) { p.r(fx0 - 0.5, y, 0.5, 2, '#a86b3c'); if (y < FARM.gate[1] - 2 || y > FARM.gate[1] + 2) p.r(fx0 + fw, y, 0.5, 2, '#a86b3c'); }
    p.r(fx0, fy0 - 0.75, fw, 0.5, '#a86b3c').r(fx0, fy0 + fh + 0.25, fw, 0.5, '#a86b3c');
    // soil: one path per layer, so 182 plots stay small
    const cells = F.plots.filter((q) => !q.future);
    const SOIL = '#6b4226', SOIL_G = '#8a6a2b';
    for (const q of cells) p.r(q.x + 0.25, q.y + 0.125, P.w - 0.5, P.h - 0.25, q.gold ? SOIL_G : SOIL);
    for (const q of cells) p.r(q.x + 0.25, q.y + 0.125, P.w - 0.5, 0.25, q.gold ? '#b08a3a' : '#8c5a36');
    for (const q of cells) p.r(q.x + 0.25, q.y + P.h - 0.375, P.w - 0.5, 0.25, q.gold ? '#5e4a1c' : '#4e2f1c');
    CROP.forEach((spr, i) => { if (spr) p.symbol(`pc${i}`, (s) => s.sprite(spr, 0, 0, { s: cs })); });
    p.symbol('pwheat', (s) => s.sprite(WHEAT, 0, 0, { s: cs }));
    p.symbol('pfrost', (s) => s.r(0, 0, P.w - 0.5, P.h - 0.25, '#ffffff', 0.35));
    for (const q of cells) {
      if (q.stage > 0) p.use(q.gold ? 'pwheat' : `pc${q.stage}`, q.x + 0.25, q.y);
      else if (winter) p.use('pfrost', q.x + 0.25, q.y + 0.125);
      if (near && q.gold && (q.c + q.r) % 3 === 0) p.raw(`<g class="tw" style="animation-delay:${-((q.c * 3 + q.r) % 7) * 0.4}s">`).r(q.x + 0.75 + ((q.c * 5) % 3) * 0.5, q.y + 0.5 + (q.r % 2) * 0.5, 0.5, 0.5, '#fff6a0').raw('</g>');
    }
    // the streak is one golden body: only its outer edge is outlined
    const keys = new Set(F.plots.filter((q) => q.streak).map((q) => `${q.c},${q.r}`));
    p.raw('<g class="pu" style="animation-duration:4s">');
    for (const q of F.plots) if (q.streak) {
      const has = (dc, dr) => keys.has(`${q.c + dc},${q.r + dr}`);
      if (!has(0, -1)) p.r(q.x, q.y, P.w, 0.5, '#fff0a0'); if (!has(0, 1)) p.r(q.x, q.y + P.h - 0.5, P.w, 0.5, '#fff0a0');
      if (!has(-1, 0)) p.r(q.x, q.y, 0.5, P.h, '#fff0a0'); if (!has(1, 0)) p.r(q.x + P.w - 0.5, q.y, 0.5, P.h, '#fff0a0');
    }
    p.raw('</g>');
    const t = F.plots[F.todayIdx];
    if (t) p.raw('<g class="bob">').sprite(ICON.arrow, t.x + P.w / 2 - 2, t.y - 5.5, { s: 0.5 }).raw('</g>');
    if (scene.fx.includes('harvestFestival')) {                                  // bunting along the north fence
      const cols = [C.red, C.yellow, C.cyan, C.lime];
      for (let i = 0; i < 20; i++) p.raw(`<g class="${i % 2 ? 'f1' : 'f2'}">`).r(fx0 + 1 + i * 4, fy0 - 3.5, 1.5, 1.5, cols[i % 4]).raw('</g>');
    }
  }));
  K.solid(fx0 - 2, fy0 - 6, fw + 4, fh + 8);

  // barn and windmill stand in the strip between the field and the palisade
  const [bx, by] = FARM.barn, [wx, wy] = FARM.windmill;
  K.place(by, () => K.obj('barn', { x: bx, y: by, foot: true, st: seasonKey, box: [bx - 10, by - 14, 20, 16] }, () => {
    K.shadow(bx, by, 16);
    p.r(bx - 7, by - 8, 14, 8, '#b13e53').r(bx - 7, by - 8, 14, 1, '#ef7d57').r(bx - 8, by - 11, 16, 3, '#5d275d').r(bx - 8, by - 11, 16, 1, '#8c4a9a').r(bx - 5, by - 13, 10, 2, '#5d275d');
    p.r(bx - 2.5, by - 5, 5, 5, '#7a4a2b').r(bx - 0.25, by - 5, 0.5, 5, '#4e2f1c').r(bx - 2.5, by - 5, 5, 0.5, '#a86b3c');
    p.r(bx - 1.5, by - 9.5, 3, 2, '#f4e0b0'); K.lights.push({ x: bx - 1.5, y: by - 9.5, w: 3, h: 2 });
    if (winter) p.r(bx - 8, by - 11, 16, 1, '#f4f8fc').r(bx - 5, by - 13, 10, 1, '#f4f8fc');
  }));
  K.solid(bx - 10, by - 14, 20, 16);
  K.place(wy, () => K.obj('windmill', { x: wx, y: wy, foot: true, st: seasonKey, box: [wx - 9, wy - 17, 18, 19] }, () => {
    K.shadow(wx, wy, 10);
    p.r(wx - 3, wy - 9, 6, 9, '#e8d5a8').r(wx - 3, wy - 9, 6, 1, '#f4e8c8').r(wx - 4, wy - 11, 8, 3, '#7a4a2b').r(wx - 1, wy - 4, 2, 4, '#7a4a2b');
    const cy = wy - 12.5;
    p.raw(`<g class="sp" style="transform-origin:${wx * 4}px ${cy * 4}px;animation:sp 12s linear infinite">`);
    p.r(wx - 0.5, cy - 5.5, 1, 11, '#a86b3c').r(wx - 5.5, cy - 0.5, 11, 1, '#a86b3c').r(wx - 3.5, cy - 5.5, 3, 1, '#f4f4f4', 0.7);
    p.raw('</g>');
    if (winter) p.r(wx - 4, wy - 11, 8, 0.75, '#f4f8fc');
  }));
  K.solid(wx - 9, wy - 17, 18, 19);
}
