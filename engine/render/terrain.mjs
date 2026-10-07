// terrain.mjs — L1/L2 painters: mountains, terrain base, water, forest,
// fields, expansion reserves. All decorative positions come from per-object
// subRng streams keyed on world identity — camera changes never move them.
// Nothing here invents geography: bounds/river/bridges/reserves from the lock.
import { R, E, P, U, PL } from './svg.mjs';
import { subRng } from '../util.mjs';
import { WORLD_W, WORLD_H } from '../world/constants.mjs';
import { RIVER_SEGMENTS, HARBOR_BAY, BRIDGES, isWater, isMountain, expansionReserves } from '../world/map.mjs';
import { edgePath } from '../world/roads.mjs';
import { SPRITE_H } from './sprites.mjs';

const D = (id, layer, footY, x, bounds, svg) => ({ id, layer, footY, x, bounds, svg });

function inBuilding(blds, x, y, pad) {
  for (const b of blds) {
    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return true;
  }
  return false;
}
function nearRoad(paths, x, y, pad) {
  for (const pts of paths) {
    for (let i = 0; i + 1 < pts.length; i++) {
      if (distToSeg(x, y, pts[i], pts[i + 1]) < pad) return true;
    }
  }
  return false;
}
function distToSeg(px, py, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / l2));
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

/** Mountains: layered silhouette anchors across the north band (lock §2). */
export function mountainsDrawables(ctx) {
  const { pal } = ctx;
  const base = pal.night ? '#232c44' : '#6b7a90';
  const snow = pal.snowGround ?? '#eef4f7';
  // Back range (lighter) + front range (darker), deterministic ridge line.
  const ridge = (y0, amp, col) => {
    let d = `M 0 ${WORLD_H} L 0 ${y0}`;
    const r = subRng(ctx.seed, 'terrain', 'ridge', String(y0));
    for (let x = 0; x <= WORLD_W; x += 128) {
      d += ` L ${x + 64} ${Math.round(y0 - r.int(20, 70) * amp)} L ${x + 128} ${y0}`;
    }
    return `<path d="${d} L ${WORLD_W} ${WORLD_H} Z" fill="${col}"/>`;
  };
  let caps = '';
  const r = subRng(ctx.seed, 'terrain', 'caps');
  for (let x = 64; x < WORLD_W; x += 128) {
    const px = x + r.int(-30, 30), py = 34 + r.int(-12, 12);
    caps += `<polygon points="${px - 22},${py + 18} ${px},${py} ${px + 22},${py + 18} ${px + 8},${py + 18} ${px},${py + 8} ${px - 8},${py + 18}" fill="${snow}" opacity="0.9"/>`;
  }
  const svg = ridge(96, 1, ctx.pal.night ? '#2c3650' : '#8b98ac')
    + ridge(130, 0.8, base) + caps;
  return [D('mountains', 1, 160, 1024, { x: 0, y: 0, w: WORLD_W, h: 170 }, svg)];
}

/** Terrain base: grass pattern + deterministic tone patches + winter snow cover. */
export function baseDrawables(ctx) {
  const { pal } = ctx;
  let svg = R(0, 0, WORLD_W, WORLD_H, 'url(#k-grass)');
  // Large soft tone patches: 2-3 grass tones break the flat lawn (spec §04.6).
  const r = subRng(ctx.seed, 'terrain', 'patches');
  const tones = [pal.grassLight, pal.grassDark, pal.grassLight];
  for (let i = 0; i < 52; i++) {
    const cx = r.int(0, WORLD_W), cy = r.int(170, WORLD_H);
    if (isWater(cx, cy)) continue;
    const rx = r.int(70, 190), ry = r.int(40, 110);
    svg += E(cx, cy, rx, ry, tones[i % tones.length], { opacity: 0.28 });
  }
  if (pal.snowGround) svg += R(0, 150, WORLD_W, WORLD_H - 150, pal.snowGround, { opacity: 0.85 });
  return [D('terrain-base', 2, 0, 1024, { x: 0, y: 0, w: WORLD_W, h: WORLD_H }, svg)];
}

/** Paved plazas: the market square (and royal plaza) are cobbled stone,
 * never grass (spec §04.6). Drawn under roads/buildings. */
export function plazaDrawables(ctx) {
  const { pal } = ctx;
  const out = [];
  const plazas = [
    { id: 'market', anchor: 'market_square', rx: 150, ry: 100 },
    { id: 'royal', anchor: 'royal_plaza', rx: 95, ry: 62 },
  ];
  for (const p of plazas) {
    const a = ctx.anchorById(p.anchor);
    if (!a) continue;
    let s = E(a.x, a.y, p.rx + 10, p.ry + 10, pal.stoneDark, { opacity: 0.9 });
    s += E(a.x, a.y, p.rx, p.ry, 'url(#k-cobble)');
    // worn center
    s += E(a.x, a.y, p.rx * 0.55, p.ry * 0.55, '#c9bfa8', { opacity: 0.35 });
    out.push(D(`plaza-${p.id}`, 2, a.y + p.ry, a.x,
      { x: a.x - p.rx - 12, y: a.y - p.ry - 12, w: (p.rx + 12) * 2, h: (p.ry + 12) * 2 }, s));
  }
  return out;
}

/** River + harbor bay + shores + bridges. */
export function waterDrawables(ctx) {
  const out = [];
  const wg = 'url(#k-waterg)';
  // Main river: polygon band along segments (width 64).
  const poly = [];
  for (const s of RIVER_SEGMENTS) {
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * 32, ny = (dx / len) * 32;
    poly.push([[s.x1 + nx, s.y1 + ny], [s.x2 + nx, s.y2 + ny], [s.x2 - nx, s.y2 - ny], [s.x1 - nx, s.y1 - ny]]);
  }
  let svg = '';
  for (const q of poly) svg += P(q, wg);
  // Harbor bay
  svg += R(HARBOR_BAY.x, HARBOR_BAY.y, HARBOR_BAY.w, HARBOR_BAY.h, wg);
  // Shore edges (sand strips along river)
  const shore = ctx.pal.dirt;
  for (const s of RIVER_SEGMENTS) {
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * 40, ny = (dx / len) * 40;
    svg += PL([[s.x1 + nx, s.y1 + ny], [s.x2 + nx, s.y2 + ny]], shore, 10, { opacity: 0.8 });
    svg += PL([[s.x1 - nx, s.y1 - ny], [s.x2 - nx, s.y2 - ny]], shore, 10, { opacity: 0.8 });
  }
  // Harbor bay shoreline: foam dashes along the bay's top and left edges.
  const bay = HARBOR_BAY;
  const rb = subRng(ctx.seed, 'terrain', 'bayfoam');
  let foam = '';
  for (let fx = bay.x + 8; fx < bay.x + bay.w - 8; fx += 26) {
    foam += R(fx + rb.int(-4, 4), bay.y + rb.int(-2, 4), 14, 3, '#d5ecf7', { opacity: 0.7 });
  }
  for (let fy = bay.y + 12; fy < bay.y + bay.h - 8; fy += 26) {
    foam += R(bay.x + rb.int(-2, 4), fy + rb.int(-4, 4), 3, 14, '#d5ecf7', { opacity: 0.7 });
  }
  svg += foam;
  out.push(D('river', 2, 1264, 1024, { x: 0, y: 1180, w: WORLD_W, h: 380 }, svg));

  // Bridges: wooden decks spanning the river at the three anchors.
  for (const br of BRIDGES) {
    const w = 44, h = 96;
    const x = br.x - w / 2, y = br.y - h / 2;
    let b = R(x, y, w, h, ctx.pal.woodDark);
    for (let i = 0; i < 8; i++) b += R(x + 2, y + 4 + i * 11, w - 4, 7, ctx.pal.wood);
    b += R(x - 4, y, 4, h, ctx.pal.woodDark) + R(x + w, y, 4, h, ctx.pal.woodDark);
    b += E(br.x, br.y + h / 2, w / 2 + 4, 6, ctx.pal.shadow, { opacity: 0.35 });
    out.push(D(`bridge-${br.id}`, 3, br.y + h / 2, br.x, { x: x - 6, y, w: w + 12, h }, b));
  }
  return out;
}

/** Forest clusters + scattered trees + grass tufts. */
export function forestDrawables(world, ctx, density = 1) {
  const out = [];
  const { pal } = ctx;
  const edges = world.roads.edges.map((e) => edgePath(e));
  const blds = world.buildings;
  const winter = pal.season === 'winter';

  const scatter = (key, rect, count, kinds) => {
    const r = subRng(ctx.seed, 'terrain', key);
    let placed = 0, guard = 0;
    while (placed < count && guard++ < count * 30) {
      const x = rect.x + r.int(0, rect.w), y = rect.y + r.int(0, rect.h);
      if (isWater(x, y) || isMountain(x, y)) continue;
      if (inBuilding(blds, x, y, 30) || nearRoad(edges, x, y, 26)) continue;
      const kind = winter ? 'k-bare' : kinds[r.int(0, kinds.length - 1)];
      const h = SPRITE_H[kind];
      out.push(D(`tree-${key}-${placed}`, 2, y, x,
        { x: x - 18, y: y - h, w: 36, h },
        U(kind, x - 12, y - h)));
      placed++;
    }
  };

  // High forest: dense cluster with two clearings.
  const hf = { x: 64, y: 160, w: 640, h: 224 };
  scatter('highforest', hf, Math.round(85 * density), ['k-pine', 'k-pine', 'k-oak']);
  // Scattered copses elsewhere.
  scatter('wild-1', { x: 700, y: 200, w: 500, h: 200 }, Math.round(22 * density), ['k-pine', 'k-oak']);
  scatter('wild-2', { x: 100, y: 950, w: 300, h: 200 }, Math.round(14 * density), ['k-oak', 'k-pine']);
  scatter('wild-3', { x: 1750, y: 900, w: 220, h: 180 }, Math.round(16 * density), ['k-pine', 'k-oak']);
  scatter('wild-4', { x: 1150, y: 1300, w: 300, h: 180 }, Math.round(10 * density), ['k-oak']);

  // Grass tufts: cheap ambient texture.
  const rt = subRng(ctx.seed, 'terrain', 'tufts');
  const nTuft = Math.round(320 * density);
  let placed = 0, guard = 0;
  while (placed < nTuft && guard++ < nTuft * 12) {
    const x = rt.int(0, WORLD_W), y = rt.int(170, WORLD_H);
    if (isWater(x, y) || inBuilding(blds, x, y, 12)) continue;
    out.push(D(`tuft-${placed}`, 2, y, x, { x: x - 4, y: y - 7, w: 8, h: 7 }, U('k-tuft', x - 4, y - 7)));
    placed++;
  }
  return out;
}

/** Small ground props: bushes, rocks, flowers — deterministic scatter that
 * keeps clear of buildings, roads, and water. */
export function propDrawables(world, ctx, density = 1) {
  const out = [];
  const blds = world.buildings;
  const edges = world.roads.edges.map((e) => edgePath(e));
  const winter = !!ctx.pal.snowGround;
  const kinds = [
    ['k-bush', Math.round(64 * density)],
    ['k-rock', Math.round(44 * density)],
    ...(winter ? [] : [['k-flower', Math.round(96 * density)]]),
  ];
  let pi = 0;
  for (const [kind, count] of kinds) {
    const r = subRng(ctx.seed, 'terrain', 'props', kind);
    const h = SPRITE_H[kind];
    let placed = 0, guard = 0;
    while (placed < count && guard++ < count * 25) {
      const x = r.int(0, WORLD_W), y = r.int(170, WORLD_H);
      if (isWater(x, y) || isMountain(x, y)) continue;
      if (inBuilding(blds, x, y, 26) || nearRoad(edges, x, y, 30)) continue;
      out.push(D(`prop-${pi++}`, 2, y, x,
        { x: x - 12, y: y - h, w: 24, h },
        U(kind, x - 8, y - h)));
      placed++;
    }
  }
  return out;
}

/** Farm fields + orchard rows (crop state from snapshot farm). */
export function fieldDrawables(world, snap, ctx) {
  const out = [];
  const { pal } = ctx;
  const crop = snap.farm?.cropState ?? 'growing';
  const rowCol = { fallow: pal.dirt, planting: '#7cc465', growing: pal.grassDark, 'harvest-ready': '#d8a24b' }[crop] ?? pal.grassDark;

  // Tilled field plots in the farms district.
  const r = subRng(ctx.seed, 'terrain', 'fields');
  let fi = 0;
  for (let fx = 24; fx < 520; fx += 128) {
    for (let fy = 1296; fy < 1460; fy += 84) {
      if (r.bool(0.15)) continue; // fallow plot
      const w = 104, h = 64;
      let s = R(fx, fy, w, h, 'url(#k-till)', { stroke: pal.dirtDark, 'stroke-width': 2 });
      for (let ry = fy + 8; ry < fy + h - 4; ry += 12) {
        s += R(fx + 4, ry, w - 8, 5, rowCol);
        if (crop === 'planting') s += R(fx + 8, ry - 3, w - 16, 3, '#a8dd8a');
      }
      // Streak marker: glowing maintained-field accent (lock §7: farm only).
      if (fi === 2 && world.farm?.streakMarker) {
        s += R(fx, fy, w, 6, '#f7d774', { opacity: 0.85 }) + R(fx, fy + h - 6, w, 6, '#f7d774', { opacity: 0.85 });
      }
      out.push(D(`field-${fi++}`, 3, fy + h, fx + w / 2, { x: fx, y: fy, w, h }, s));
    }
  }
  // Orchard rows.
  const ro = subRng(ctx.seed, 'terrain', 'orchard');
  let oi = 0;
  for (let ox = 600; ox < 860; ox += 52) {
    for (let oy = 1310; oy < 1480; oy += 56) {
      if (ro.bool(0.2)) continue;
      const kind = pal.season === 'winter' ? 'k-bare' : 'k-oak';
      const h = SPRITE_H[kind];
      out.push(D(`orchard-${oi++}`, 3, oy, ox, { x: ox - 14, y: oy - h, w: 28, h }, U(kind, ox - 12, oy - h)));
    }
  }
  // Irrigation canal anchor (288,1272): thin water channel along the farm top.
  out.push(D('irrigation', 2, 1280, 288,
    { x: 160, y: 1266, w: 260, h: 14 },
    R(160, 1266, 260, 10, 'url(#k-waterg)', { opacity: 0.9 })));
  return out;
}

/** Expansion reserves: visually quiet — faint dashed bounds, sparse grass. */
export function reserveDrawables(ctx) {
  const out = [];
  for (const rsv of expansionReserves()) {
    const [x, y, w, h] = rsv.rect;
    out.push(D(`reserve-${rsv.id}`, 2, y + h, x + w / 2, { x, y, w, h },
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#ffffff" stroke-width="2" stroke-dasharray="10 8" opacity="0.25"/>`));
  }
  return out;
}
