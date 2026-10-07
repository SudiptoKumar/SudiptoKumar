// roads.mjs — road hierarchy from the world road graph (lock §4).
// Major roads (3 tiles / 48u) serve the castle/market/bridge/harbor spine;
// minor roads (1.75 tiles / 28u) serve districts. Warm cobble with dark
// edging so the network reads at grand scale; wet-sheen overlay when raining.
// At night, lamp posts with warm pools line the major roads.
// Nodes are the single source of truth — the painter never invents a route
// (spec §09.2).
import { PL, C, E, U } from './svg.mjs';
import { edgePath, isMajorEdge } from '../world/roads.mjs';
import { subRng } from '../util.mjs';

/** Edge class from its endpoints: major if either end is a spine node. */
export function roadClass(edge) {
  return isMajorEdge(edge) ? 'major' : 'minor';
}

/** Lamp posts with warm light pools along a major road (night only). */
function lampsAlong(pts, w, seed) {
  // Lamp posts every ~230u along the edge, alternating sides.
  const r = subRng(seed, 'lamps');
  let total = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    total += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
  }
  const count = Math.floor(total / 230);
  if (count < 1) return '';
  let s = '';
  let side = 1;
  for (let i = 0; i < count; i++) {
    const target = 115 + (i * (total - 230)) / Math.max(1, count - 1 || 1);
    // walk the polyline to `target`
    let d = 0, px = pts[0].x, py = pts[0].y, nx = 0, ny = 0;
    for (let k = 0; k + 1 < pts.length; k++) {
      const seg = Math.hypot(pts[k + 1].x - pts[k].x, pts[k + 1].y - pts[k].y);
      if (d + seg >= target) {
        const t = (target - d) / (seg || 1);
        px = pts[k].x + (pts[k + 1].x - pts[k].x) * t;
        py = pts[k].y + (pts[k + 1].y - pts[k].y) * t;
        nx = -(pts[k + 1].y - pts[k].y) / (seg || 1); ny = (pts[k + 1].x - pts[k].x) / (seg || 1);
        break;
      }
      d += seg;
    }
    const lx = px + nx * side * (w / 2 + 14), ly = py + ny * side * (w / 2 + 14);
    side = -side;
    const jx = r.int(-8, 8), jy = r.int(-8, 8);
    s += E(lx + jx, ly + jy + 26, 44, 20, 'url(#k-lampg)'); // warm pool on the ground
    s += U('k-lamp', lx + jx - 5, ly + jy - 2);
    s += C(lx + jx, ly + jy + 4, 16, 'url(#k-lampg)');
  }
  return s;
}

export function roadDrawables(world, ctx) {
  const { pal } = ctx;
  const out = [];
  const edges = [...world.roads.edges].sort((a, b) => (a.id < b.id ? -1 : 1));
  const wet = pal.weather === 'rain' || pal.weather === 'storm';
  const lamps = pal.lampsOn;

  for (const e of edges) {
    const cls = roadClass(e);
    const w = cls === 'major' ? 48 : 28;
    const pts = edgePath(e);
    // Dark edging, warm dirt bed, cobble ribbon, center wear line.
    let svg = PL(pts, '#3f362a', w + 12, { 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
    svg += PL(pts, '#7a6a52', w + 4, { 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
    svg += PL(pts, 'url(#k-cobble)', w, { 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
    if (cls === 'major') {
      svg += PL(pts, '#c9bfa8', 5, { 'stroke-linejoin': 'round', opacity: 0.65 });
      svg += PL(pts, '#5a4f3e', 2, { 'stroke-linejoin': 'round', opacity: 0.5, 'stroke-dasharray': '2 26' });
    } else {
      svg += PL(pts, '#a89a80', 3, { 'stroke-linejoin': 'round', opacity: 0.5 });
    }
    if (wet) svg += PL(pts, '#cfe0ee', w, { 'stroke-linejoin': 'round', opacity: 0.28 });
    if (lamps && cls === 'major') svg += lampsAlong(pts, w, `${ctx.seed}:${e.id}`);
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    out.push({
      id: `road-${e.id}`, layer: 3, footY: Math.max(...ys), x: xs[0],
      bounds: { x: Math.min(...xs) - w, y: Math.min(...ys) - w, w: Math.max(...xs) - Math.min(...xs) + 2 * w, h: Math.max(...ys) - Math.min(...ys) + 2 * w },
      svg,
    });
  }
  // Junction dots at named nodes (wayfinding anchors).
  const nodes = [...world.roads.nodes].sort((a, b) => (a.id < b.id ? -1 : 1));
  let dots = '';
  for (const n of nodes) dots += C(n.x, n.y, 6, '#6e5f4a', { stroke: '#3f362a', 'stroke-width': 2 });
  out.push({
    id: 'road-nodes', layer: 3, footY: 2000, x: 0,
    bounds: { x: 0, y: 0, w: 2048, h: 1536 }, svg: dots,
  });
  return out;
}
