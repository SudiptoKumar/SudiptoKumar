// Developer tool: draws the shared geometry of the kingdom (districts, footprints, slots, roads, routes, cameras) as one SVG.
// usage: node engine/dev/blueprint.mjs [out.svg]      Review aid for the visual regression gate; not part of the README.
import fs from 'node:fs';
import { Pix, svgDoc } from '../render/pixel.mjs';
import { GW, GH, U, GROUND_Y } from '../world/constants.mjs';
import { ANCHORS, FOOT, FARM, DISTRICTS, SLOTS, ROADS, NODES, EDGES } from '../world/layout.mjs';
import { CAMERA_IDS, CAMERAS } from '../world/cameras.mjs';
import { TENT_SLOTS } from '../world/camp.mjs';
import { HALL } from '../world/hall.mjs';

export function blueprint() {
  const p = new Pix(U), h = new Pix(1);
  p.r(0, 0, GW, GROUND_Y, '#2a3b2c').r(0, GROUND_Y, GW, GH - GROUND_Y, '#15101c').r(0, 0, GW, 44, '#1d2a4d').r(0, 159, GW, 9, '#2c5d8f');
  const col = { castle: '#ffcd75', village: '#ef7d57', knowledge: '#73eff7', personal: '#a7f070', automation: '#b48cf0', news: '#ff9ecb', mine: '#94b0c2', ruins: '#b13e53' };
  for (const [id, d] of Object.entries(DISTRICTS)) p.r(...d.rect, col[id], 0.18);
  for (const [x1, y1, x2, y2, w] of ROADS) p.r(Math.min(x1, x2) - (x1 === x2 ? w / 2 : 0), Math.min(y1, y2) - (y1 === y2 ? w / 2 : 0), Math.abs(x2 - x1) + (x1 === x2 ? w : 0), Math.abs(y2 - y1) + (y1 === y2 ? w : 0), '#b98a54', 0.8);
  for (const [n, b] of Object.entries(FOOT)) p.r(...b, '#ffffff', 0.12).r(b[0], b[1], b[2], 0.5, '#ffffff').r(b[0], b[1] + b[3] - 0.5, b[2], 0.5, '#ffffff').r(b[0], b[1], 0.5, b[3], '#ffffff').r(b[0] + b[2] - 0.5, b[1], 0.5, b[3], '#ffffff');
  // farm plots
  for (let c = 0; c < FARM.plots.cols; c++) for (let r = 0; r < FARM.plots.rows; r++) p.r(FARM.plots.x + c * FARM.plots.w + 0.25, FARM.plots.y + r * FARM.plots.h + 0.25, FARM.plots.w - 0.5, FARM.plots.h - 0.5, '#6b4226');
  // hall pedestals
  for (const fy of HALL.floorY) for (let c = 0; c < HALL.cols; c++) p.r(HALL.innerX + HALL.cell * (c + 0.5) - 2, fy - 3, 4, 3, '#cfd6e0');
  for (const [x, y] of TENT_SLOTS) p.r(x, y, 8, 6, '#ef7d57');
  for (const [list, slots] of Object.entries(SLOTS)) for (const [x, y] of slots) p.r(x - 6, y - 12, 12, 12, '#ffffff', 0.25).r(x - 1, y - 1, 2, 2, '#ffffff');
  for (const [a, b] of EDGES) { const [x1, y1] = NODES[a], [x2, y2] = NODES[b]; p.r(Math.min(x1, x2), Math.min(y1, y2), Math.max(0.6, Math.abs(x2 - x1)), Math.max(0.6, Math.abs(y2 - y1)), '#ff4d6d', 0.9); }
  for (const [n, [x, y]] of Object.entries(NODES)) p.r(x - 1, y - 1, 2, 2, '#fff0a0');
  for (const [n, a] of Object.entries(ANCHORS)) p.r(a.x - 1, a.y - 1, 2, 2, '#00e5ff');
  // cameras (outlines)
  const cc = ['#ff4d6d', '#ffd166', '#06d6a0', '#118ab2', '#c77dff', '#ffffff', '#f4a261'];
  CAMERA_IDS.forEach((id, i) => { const r = CAMERAS[id].rect; if (!r) return; p.r(r[0], r[1], r[2], 0.6, cc[i]).r(r[0], r[1] + r[3] - 0.6, r[2], 0.6, cc[i]).r(r[0], r[1], 0.6, r[3], cc[i]).r(r[0] + r[2] - 0.6, r[1], 0.6, r[3], cc[i]); });
  // labels in screen space
  for (const [id, d] of Object.entries(DISTRICTS)) h.text(d.name, d.rect[0] * U + 6, d.rect[1] * U + 6, 2, '#ffffff');
  for (const n of ['castle', 'hall', 'vault', 'ci', 'farm', 'camp', 'gate', 'home']) h.text(n.toUpperCase(), ANCHORS[n].x * U - 20, ANCHORS[n].y * U + 8, 2, '#00e5ff');
  CAMERA_IDS.forEach((id, i) => { const r = CAMERAS[id].rect; if (r) h.text(id, r[0] * U + 6, (r[1] + r[3]) * U - 20 + (i % 2) * 0, 2, cc[i]); });
  p.raw(h.toString());
  return svgDoc({ w: GW * U, h: GH * U, title: 'Kingdom blueprint', desc: 'Districts, footprints, slots, roads, routes and cameras of the shared world.', body: p.toString(), defs: p.defs.join('') });
}
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) { const out = process.argv[2] || 'blueprint.svg'; fs.writeFileSync(out, blueprint()); console.log('wrote', out); }
