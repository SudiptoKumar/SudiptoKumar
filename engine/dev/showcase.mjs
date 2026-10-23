// Developer tool: the repository lifecycle, side by side. Same building, ten lives.
// usage: node engine/dev/showcase.mjs [out.svg]
import fs from 'node:fs';
import { Pix, svgDoc } from '../render/pixel.mjs';
import { drawRepo } from '../render/growth.mjs';
import { SEASONS } from '../render/palette.mjs';
import { U } from '../world/constants.mjs';

/** The options a repository in each lifecycle state is drawn with (what render/kingdom-places.mjs passes from the world model). */
export const LIFE_LOOKS = [
  ['foundation', { level: 2, state: 'building', life: 'foundation', stage: { build: 'foundation' } }],
  ['building', { level: 3, state: 'building', life: 'building', stage: { build: 'builders' } }],
  ['active', { level: 4, state: 'active', life: 'active' }],
  ['flourishing 4', { level: 4, state: 'active', life: 'flourishing' }],
  ['flourishing 5', { level: 5, state: 'active', life: 'flourishing' }],
  ['sleepy', { level: 4, state: 'sleepy', life: 'sleepy' }],
  ['dusty', { level: 4, state: 'dusty', life: 'sleepy' }],
  ['failing', { level: 4, state: 'failing', life: 'failing', stage: { fail: 'fire' } }],
  ['recovering', { level: 4, state: 'active', life: 'recovering', recovered: true, stage: { repair: 'repair' } }],
  ['abandoned', { level: 3, state: 'abandoned', life: 'abandoned' }],
];

export function drawLife(p, kind, x, y, opts, extra = {}) { return drawRepo(p, kind, x, y, { name: 'demo', ctx: { lights: [], danger: [] }, lit: false, ...opts, ...extra }); }

export function showcase() {
  const cell = 34, W = cell * LIFE_LOOKS.length, H = 120;
  const p = new Pix(U), h = new Pix(1);
  p.r(0, 0, W, H, SEASONS.summer.grass);
  ['house', 'tower'].forEach((kind, row) => LIFE_LOOKS.forEach(([name, opts], i) => {
    const x = cell * (i + 0.5), y = 50 + row * 56;
    drawLife(p, kind, x, y, opts);
    if (row === 0) h.text(name.toUpperCase().slice(0, 11), x * U - 4, 4, 2, '#ffffff');
  }));
  p.raw(h.toString());
  return svgDoc({ w: W * U, h: H * U, title: 'Repository lifecycle', desc: 'The same building in ten lifecycle states.', body: p.toString(), defs: p.defs.join('') });
}
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) { const out = process.argv[2] || 'lifecycle.svg'; fs.writeFileSync(out, showcase()); console.log('wrote', out); }
