// buildings.mjs — all 23 archetypes × 11 lifecycle states.
// 3/4 convention: front face + one side face (upper-right offset), foot-point
// at (x + w/2, y + h). Coordinates come from world.buildings only — the
// painter never invents a plot. LOD0 = silhouette only; LOD1+ = full detail.
import { R, C, E, P, PL, LN, T, U, G } from './svg.mjs';
import { subRng, clamp } from '../util.mjs';
import { shade } from './palette.mjs';

// Archetype visual spec: body/roof colors, roof style, height factor, features.
const ARCH = {
  castle:      { body: '#b9bec7', roof: '#2f6fb2', roofStyle: 'castle', hf: 1.5, feat: ['towers', 'gate', 'banners'] },
  tower:       { body: '#a8adb6', roof: '#5a6b7d', roofStyle: 'cone', hf: 1.6, feat: [] },
  guild_hall:  { body: '#c9b78f', roof: '#2f6fb2', roofStyle: 'gable', hf: 1.0, feat: ['emblem', 'steps'] },
  library:     { body: '#c4b49a', roof: '#5a6b7d', roofStyle: 'gable', hf: 1.1, feat: ['tallwin', 'steps'] },
  workshop:    { body: '#a98a5e', roof: '#8a6b45', roofStyle: 'gable', hf: 0.9, feat: ['chimney', 'stacks'] },
  forge:       { body: '#7d7468', roof: '#4a4f58', roofStyle: 'gable', hf: 0.9, feat: ['chimney', 'glow'] },
  laboratory:  { body: '#b9c2cc', roof: '#4f9be0', roofStyle: 'dome', hf: 0.9, feat: ['glassdome'] },
  market_hall: { body: '#c9a06a', roof: '#b5543c', roofStyle: 'wide', hf: 0.8, feat: ['awnings'] },
  house:       { body: '#e0d3ae', roof: '#b5543c', roofStyle: 'gable', hf: 0.85, feat: [] },
  warehouse:   { body: '#9a8a70', roof: '#6b6250', roofStyle: 'wide', hf: 0.9, feat: ['crane'] },
  fortress:    { body: '#8b93a0', roof: '#3d4a5e', roofStyle: 'flat', hf: 1.0, feat: ['beacon', 'walls'] },
  shrine:      { body: '#c9c2b2', roof: '#b5543c', roofStyle: 'pagoda', hf: 0.7, feat: ['altar'] },
  observatory: { body: '#b9bec7', roof: '#4f9be0', roofStyle: 'dome', hf: 1.0, feat: ['slit'] },
  barracks:    { body: '#a89a7c', roof: '#5a6b7d', roofStyle: 'gable', hf: 0.9, feat: ['flag'] },
  watchtower:  { body: '#9aa0a8', roof: '#3d4a5e', roofStyle: 'cone', hf: 1.8, feat: ['platform'] },
  farmhouse:   { body: '#d8c49a', roof: '#c9a24b', roofStyle: 'gable', hf: 0.85, feat: ['silo'] },
  mill:        { body: '#c4b49a', roof: '#8a6b45', roofStyle: 'cone', hf: 1.3, feat: ['blades'] },
  stall:       { body: '#a98a5e', roof: '#c96b4a', roofStyle: 'awning', hf: 0.5, feat: ['counter'] },
  tent:        { body: '#d8cba4', roof: '#b59a6a', roofStyle: 'tent', hf: 0.7, feat: [] },
  dock:        { body: '#8a5a33', roof: null, roofStyle: 'flat', hf: 0.25, feat: ['pilings'] },
  monument:    { body: '#c3c9d1', roof: null, roofStyle: 'flat', hf: 1.2, feat: ['statue'] },
  wall:        { body: '#9aa0a8', roof: null, roofStyle: 'flat', hf: 0.45, feat: ['crenel'] },
  gate:        { body: '#8b93a0', roof: '#3d4a5e', roofStyle: 'flat', hf: 1.0, feat: ['arch', 'crenel'] },
};

const SIDE = 12; // 3/4 side-face offset

function shadow(x, y, w, pal) {
  return E(x + w / 2, y, w * 0.62, Math.max(4, w * 0.1), pal.shadow, { opacity: 0.35 });
}

/** Front face + side face (upper-right) for the 3/4 look. */
function body3d(x, y, w, bh, fill, pal, dark = true) {
  const d = Math.min(SIDE, w * 0.18);
  let s = '';
  // side face (darker, offset up-right)
  s += P([[x + w, y - bh], [x + w + d, y - bh - d * 0.7], [x + w + d, y - d * 0.7], [x + w, y]], dark ? shade(fill, 0.72) : fill);
  // front face
  s += R(x, y - bh, w, bh, fill);
  // base trim
  s += R(x, y - 6, w, 6, dark ? shade(fill, 0.8) : fill);
  return { svg: s, depth: d };
}

function roofFor(x, y, w, bh, style, col, pal, depth) {
  const top = y - bh, d = depth;
  switch (style) {
    case 'gable':
      return P([[x - 4, top], [x + w / 2, top - w * 0.42], [x + w + 4, top],
        [x + w + 4 + d, top - d * 0.7], [x + w / 2 + d, top - w * 0.42 - d * 0.7], [x - 4 + d, top - d * 0.7]], col)
        + P([[x + w + 4, top], [x + w / 2, top - w * 0.42], [x + w / 2 + d, top - w * 0.42 - d * 0.7], [x + w + 4 + d, top - d * 0.7]], shade(col, 0.75));
    case 'wide':
      return P([[x - 6, top], [x + w / 2, top - w * 0.3], [x + w + 6, top],
        [x + w + 6 + d, top - d * 0.7], [x + w / 2 + d, top - w * 0.3 - d * 0.7], [x - 6 + d, top - d * 0.7]], col);
    case 'cone':
      return P([[x - 3, top], [x + w / 2, top - w * 0.8], [x + w + 3, top],
        [x + w + 3 + d, top - d * 0.7], [x + w / 2 + d, top - w * 0.8 - d * 0.7], [x - 3 + d, top - d * 0.7]], col);
    case 'dome':
      return `<path d="M ${x - 2} ${top} A ${w / 2} ${w * 0.45} 0 0 1 ${x + w + 2} ${top} Z" fill="${col}"/>`
        + `<rect x="${x + w / 2 - 2}" y="${top - w * 0.45 - 6}" width="4" height="8" fill="${shade(col, 0.7)}"/>`;
    case 'pagoda':
      return P([[x - 8, top], [x + w / 2, top - w * 0.3], [x + w + 8, top], [x + w / 2, top - w * 0.12]], col)
        + P([[x - 4, top - w * 0.3], [x + w / 2, top - w * 0.55], [x + w + 4, top - w * 0.3], [x + w / 2, top - w * 0.42]], shade(col, 1.1));
    case 'awning': {
      let s = '';
      for (let i = 0; i < Math.max(2, Math.floor(w / 16)); i++) {
        s += R(x + i * 16, top - 10, 16, 10, i % 2 ? '#e8dcc0' : col);
      }
      return s + R(x, top - 12, w, 3, shade(col, 0.8));
    }
    case 'tent':
      return P([[x, top + 6], [x + w / 2, top - w * 0.5], [x + w, top + 6]], col)
        + P([[x + w / 2, top - w * 0.5], [x + w, top + 6], [x + w / 2 + 8, top + 6]], shade(col, 0.8));
    default: // flat
      return R(x - 2, top - 6, w + 4, 8, shade(col ?? '#8b93a0', 1)) + R(x - 2, top - 6, w + 4, 3, shade(col ?? '#8b93a0', 1.15));
  }
}

function windowsRow(x, y, w, bh, n, lit, pal, tall = false) {
  if (n <= 0) return '';
  const ww = tall ? 10 : 9, wh = tall ? 22 : 12;
  const gap = (w - n * ww) / (n + 1);
  const fill = lit ? (pal.windowColor ?? '#ffca6a') : (pal.night ? '#2a3350' : '#3d4a5e');
  let s = '';
  for (let i = 0; i < n; i++) {
    const wx = x + gap * (i + 1) + ww * i;
    s += R(wx, y - bh + 14, ww, wh, fill, { stroke: '#3a3f4a', 'stroke-width': 1.5 });
    if (lit && pal.lampGlow) s += C(wx + ww / 2, y - bh + 14 + wh / 2, ww * 1.7, 'url(#k-lampg)');
  }
  return s;
}

function doorAt(x, y, w, pal, arch = false) {
  const dw = Math.min(18, w * 0.22), dx = x + w / 2 - dw / 2;
  if (arch) {
    return `<path d="M ${Math.round(dx)} ${Math.round(y)} L ${Math.round(dx)} ${Math.round(y - 22)}`
      + ` A ${Math.round(dw / 2)} ${Math.round(dw / 2)} 0 0 1 ${Math.round(dx + dw)} ${Math.round(y - 22)}`
      + ` L ${Math.round(dx + dw)} ${Math.round(y)} Z" fill="#4a3220"/>`;
  }
  return R(dx, y - 26, dw, 26, '#4a3220', { stroke: '#2e2013', 'stroke-width': 1.5 });
}

function scaffold(x, y, w, bh, pal) {
  const wd = pal.wood;
  let s = '';
  for (let px = x - 10; px <= x + w + 6; px += 22) {
    s += R(px, y - bh - 14, 4, bh + 14, wd);
  }
  for (let py = y - bh - 10; py < y; py += 20) {
    s += R(x - 12, py, w + 28, 3, wd);
    s += LN(x - 12, py + 3, x + 10, py + 23, wd, 2) + LN(x + 10, py + 3, x - 12, py + 23, wd, 2);
  }
  return s;
}

function materialPile(x, y, pal, seed) {
  const r = subRng(seed, 'pile');
  let s = '';
  for (let i = 0; i < 4; i++) s += R(x + r.int(-6, 26), y - r.int(6, 16), 16, 10, i % 2 ? pal.wood : pal.woodDark);
  s += C(x + 44, y - 8, 10, pal.stone) + C(x + 56, y - 6, 8, pal.stoneDark);
  return s;
}

function cracks(x, y, w, bh) {
  return PL([[x + w * 0.3, y - bh * 0.9], [x + w * 0.4, y - bh * 0.6], [x + w * 0.32, y - bh * 0.4]], '#2e2a26', 2)
    + PL([[x + w * 0.7, y - bh * 0.8], [x + w * 0.62, y - bh * 0.5]], '#2e2a26', 2);
}

function bannerOn(x, y, col, pal) {
  return P([[x, y], [x + 14, y + 4], [x, y + 12]], col) + R(x - 1, y - 8, 2, 10, pal.woodDark);
}

/** The castle: a full castle COMPOSITION — curtain walls, corner towers,
 * gatehouse, central keep, courtyard, banners. One world entity, drawn as
 * the kingdom's dominant silhouette. */
function paintCastle(b, ctx, bh) {
  const { pal } = ctx;
  const nm = (c) => (pal.nightMul < 1 ? shade(c, pal.nightMul) : c);
  const cx = b.x + b.w / 2, gy = b.y;
  const stone = nm('#b9bec7'), stoneD = nm('#8b93a0'), stoneL = nm('#cdd3da');
  const roof = pal.roofKingdom, gold = pal.gold;
  const lit = pal.lampGlow;
  const wc = lit ? (pal.windowColor ?? '#ffca6a') : '#3d4a5e';
  const keepH = Math.min(320, Math.max(210, bh * 0.95));
  const keepT = gy - keepH, keepL = cx - 56, keepW = 112;

  let g = E(cx, gy + 8, 215, 30, pal.shadow, { opacity: 0.35 }); // ground shadow
  g += E(cx, gy + 2, 178, 40, nm('#a2a8b2'), { opacity: 0.6 }); // courtyard stone

  // Curtain wall with crenellations and wall walk.
  const wallT = gy - 96, wallL = cx - 172, wallW = 344;
  g += R(wallL, wallT, wallW, 96, stone);
  g += R(wallL, wallT, wallW, 10, stoneD);
  g += R(wallL, gy - 16, wallW, 16, stoneD, { opacity: 0.45 });
  for (let mx = wallL + 8; mx < wallL + wallW - 12; mx += 24) {
    g += R(mx, wallT - 13, 13, 13, stone);
  }
  // wall windows (arrow slits)
  for (let mx = wallL + 30; mx < wallL + wallW - 20; mx += 44) {
    g += R(mx, wallT + 34, 7, 18, nm('#4a5058'));
  }

  // Central keep: the dominant tower.
  g += R(keepL, keepT, keepW, keepH, stoneL);
  g += R(keepL, keepT, keepW, 9, stoneD);
  g += R(keepL + keepW - 14, keepT, 14, keepH, stoneD, { opacity: 0.5 }); // side shade
  // keep windows: 3 columns x 4 rows, lit at night
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 3; col++) {
      const wx = keepL + 16 + col * 30, wy = keepT + 34 + row * 62;
      g += R(wx, wy, 12, 20, wc, { stroke: nm('#3a3f4a'), 'stroke-width': 2 });
      if (lit) g += C(wx + 6, wy + 10, 15, 'url(#k-lampg)');
    }
  }
  // steep kingdom-blue keep roof with gold ridge
  g += P([[keepL - 8, keepT], [cx, keepT - 78], [keepL + keepW + 8, keepT]], roof);
  g += P([[keepL + keepW + 8, keepT], [cx, keepT - 78], [cx + 14, keepT - 78], [keepL + keepW + 22, keepT]], shade(roof, 0.72));
  g += R(cx - 3, keepT - 96, 6, 20, gold);
  g += P([[cx + 3, keepT - 96], [cx + 24, keepT - 91], [cx + 3, keepT - 86]], gold); // pennant

  // Corner towers: round, conical roofs, banners.
  for (const tx of [cx - 172, cx + 172 - 48]) {
    g += R(tx, gy - 178, 48, 178, stone);
    g += E(tx + 24, gy - 178, 24, 10, stone);
    g += R(tx, gy - 178, 48, 8, stoneD);
    g += P([[tx - 6, gy - 180], [tx + 24, gy - 238], [tx + 54, gy - 180]], roof);
    g += P([[tx + 54, gy - 180], [tx + 24, gy - 238], [tx + 34, gy - 238], [tx + 64, gy - 180]], shade(roof, 0.72));
    g += C(tx + 24, gy - 244, 4, gold);
    g += R(tx + 18, gy - 150, 12, 16, wc, { stroke: nm('#3a3f4a'), 'stroke-width': 2 });
    if (lit) g += C(tx + 24, gy - 142, 14, 'url(#k-lampg)');
    g += bannerOn(tx + 17, gy - 236, roof, pal);
  }

  // Gatehouse: twin gate towers flanking the arched gate, torches at night.
  for (const tx of [cx - 62, cx + 22]) {
    g += R(tx, gy - 152, 40, 152, stoneL);
    g += R(tx, gy - 152, 40, 8, stoneD);
    g += P([[tx - 5, gy - 154], [tx + 20, gy - 198], [tx + 45, gy - 154]], roof);
    g += R(tx + 14, gy - 120, 12, 16, wc, { stroke: nm('#3a3f4a'), 'stroke-width': 2 });
    if (lit) g += C(tx + 20, gy - 112, 14, 'url(#k-lampg)');
  }
  // gate arch + portcullis
  g += `<path d="M ${cx - 22} ${gy} L ${cx - 22} ${gy - 52} A 22 22 0 0 1 ${cx + 22} ${gy - 52} L ${cx + 22} ${gy} Z" fill="#241d16"/>`;
  for (let px = cx - 14; px <= cx + 14; px += 7) g += R(px, gy - 48, 3, 48, nm('#3a3f4a'));
  g += R(cx - 22, gy - 30, 44, 5, nm('#3a3f4a'));
  // kingdom banners over the gate
  g += bannerOn(cx - 52, wallT - 18, roof, pal);
  g += bannerOn(cx + 38, wallT - 18, gold, pal);
  // torches flanking the gate
  for (const tx of [cx - 78, cx + 78]) {
    g += R(tx - 2, gy - 46, 4, 46, nm('#5a3d24'));
    g += C(tx, gy - 50, 7, '#ff9e3c', { stroke: '#7a3a12', 'stroke-width': 2 });
    if (lit) g += C(tx, gy - 50, 22, 'url(#k-fireg)');
  }
  // warm light pool spilling from the gate at night
  if (lit) g += E(cx, gy + 4, 90, 22, 'url(#k-lampg)');
  return {
    svg: g,
    bounds: { x: Math.round(cx - 205), y: Math.round(keepT - 110), w: 410, h: Math.round(gy + 40 - (keepT - 110)) },
  };
}

/** Automation fortress with CI-state beacon. */
function paintFortress(b, ctx, bh) {
  const { pal, fortress } = ctx;
  const { x, y, w } = b;
  const st = fortress?.state ?? 'unknown';
  const beaconCol = st === 'healthy' ? '#58c472' : st === 'warning' ? '#f0a53c'
    : st === 'failing' ? '#e0523c' : st === 'recovering' ? '#6fe0b8' : '#8b93a0';
  let g = shadow(x, y + 2, w, pal);
  g += R(x, y - bh, w, bh, '#8b93a0');
  g += R(x - 6, y - bh - 10, w + 12, 12, '#6b7482');
  for (let cx = x; cx < x + w; cx += 20) g += R(cx, y - bh - 20, 12, 10, '#8b93a0');
  // beacon tower
  const bx = x + w / 2 - 8;
  g += R(bx, y - bh - 52, 16, 44, '#6b7482');
  g += C(bx + 8, y - bh - 58, 8, beaconCol, { stroke: '#2e343f', 'stroke-width': 2 });
  if (beaconCol !== '#8b93a0') g += C(bx + 8, y - bh - 58, 18, 'url(#k-lampg)');
  // alarm: red ring + smoke handled by effects; failing adds dark vents
  if (st === 'failing') {
    g += R(x + 10, y - 30, w - 20, 10, '#2e343f');
  }
  g += windowsRow(x, y, w, bh, Math.max(1, Math.floor(w / 34)), pal.lampGlow, pal);
  return g;
}

function paintMill(b, ctx, bh) {
  const { pal } = ctx;
  const { x, y, w } = b;
  let g = shadow(x, y + 2, w, pal);
  const bw = w * 0.6, bx = x + w / 2 - bw / 2;
  g += R(bx, y - bh, bw, bh, '#c4b49a');
  g += P([[bx - 3, y - bh], [bx + bw / 2, y - bh - bw * 0.7], [bx + bw + 3, y - bh]], '#8a6b45');
  // blades: static angle from seed
  const r = subRng(ctx.seed, 'mill', b.id);
  const ang = r.int(0, 3) * 45;
  const cxp = bx + bw / 2, cyp = y - bh - 8;
  g += C(cxp, cyp, 4, '#4a3a24');
  for (let k = 0; k < 4; k++) {
    const a = ((ang + k * 90) * Math.PI) / 180;
    const len = bw * 0.85;
    g += LN(cxp, cyp, cxp + Math.cos(a) * len, cyp + Math.sin(a) * len, '#6b4f2c', 5);
  }
  g += doorAt(bx, y, bw, pal);
  return g;
}

function paintMonument(b, ctx, bh) {
  const { pal } = ctx;
  const { x, y, w } = b;
  let g = shadow(x, y + 2, w, pal);
  g += R(x + w * 0.2, y - 14, w * 0.6, 14, pal.stoneDark);
  g += R(x + w * 0.3, y - 26, w * 0.4, 12, pal.stone);
  // abstract hero statue
  const sx = x + w / 2;
  g += R(sx - 5, y - 52, 10, 26, '#c3c9d1');
  g += C(sx, y - 58, 7, '#c3c9d1');
  g += R(sx - 12, y - 50, 8, 20, '#aab0ba') + R(sx + 4, y - 50, 8, 20, '#aab0ba');
  g += LN(sx + 8, y - 48, sx + 20, y - 60, '#8b93a0', 3); // raised arm w/ torch-ish
  if (pal.lampGlow) g += C(sx + 20, y - 62, 6, pal.windowColor ?? '#ffca6a');
  return g;
}

function paintDock(b, ctx) {
  const { pal } = ctx;
  const { x, y, w } = b;
  let g = '';
  for (let px = x + 6; px < x + w; px += 18) g += R(px, y - 6, 5, 26, pal.woodDark);
  g += R(x, y - 14, w, 10, pal.wood) + R(x, y - 14, w, 3, pal.woodLight);
  for (let px = x + 4; px < x + w; px += 12) g += LN(px, y - 14, px, y - 4, pal.woodDark, 1.5);
  // moored boat
  const r = subRng(ctx.seed, 'dock', b.id);
  if (r.bool(0.7)) {
    const bx = x + r.int(0, Math.max(1, w - 40));
    g += P([[bx, y + 22], [bx + 36, y + 22], [bx + 28, y + 34], [bx + 8, y + 34]], pal.woodDark);
    g += R(bx + 16, y + 2, 3, 22, pal.woodDark);
    g += P([[bx + 19, y + 2], [bx + 34, y + 16], [bx + 19, y + 16]], '#e8dcc0');
  }
  return g;
}

function paintGate(b, ctx, bh) {
  const { pal, gates, dungeon } = ctx;
  const { x, y, w } = b;
  const nm = (c) => (pal.nightMul < 1 ? shade(c, pal.nightMul) : c);
  const closed = gates && Object.values(gates).some((v) => v !== 'open');
  let g = shadow(x, y + 2, w, pal);
  g += R(x, y - bh, w * 0.3, bh, nm('#8b93a0')) + R(x + w * 0.7, y - bh, w * 0.3, bh, nm('#8b93a0'));
  g += R(x, y - bh - 8, w, 10, nm('#6b7482'));
  for (let cx = x + 4; cx < x + w - 6; cx += 16) g += R(cx, y - bh - 16, 9, 8, nm('#8b93a0'));
  g += `<path d="M ${x + w * 0.3} ${y} L ${x + w * 0.3} ${y - bh * 0.7} A ${w * 0.2} ${w * 0.2} 0 0 1 ${x + w * 0.7} ${y - bh * 0.7} L ${x + w * 0.7} ${y} Z" fill="#241d16"/>`;
  if (closed) {
    for (let px = x + w * 0.34; px < x + w * 0.68; px += 8) g += R(px, y - bh * 0.62, 4, bh * 0.62, '#3a3f4a');
    g += R(x + w * 0.3, y - bh * 0.3, w * 0.4, 5, '#3a3f4a');
  }
  // torch glows flanking the arch at night
  if (pal.lampGlow) {
    for (const tx of [x + 4, x + w - 4]) {
      g += R(tx - 2, y - bh - 6, 4, 12, '#ff9e3c');
      g += C(tx, y - bh - 8, 18, 'url(#k-fireg)');
    }
  }
  // dungeon entrance: eerie glow scales with issue pressure
  if (b.anchorId === 'dungeon_gate' && dungeon && dungeon.tier !== 'dormant' && dungeon.tier !== 'unknown') {
    const col = dungeon.tier === 'crisis' ? '#e0523c' : dungeon.tier === 'crowded' ? '#f0a53c' : '#6fe0b8';
    g += C(x + w / 2, y - bh * 0.4, 30, col, { opacity: 0.3 });
    g += C(x + w / 2, y - bh * 0.4, 16, col, { opacity: 0.45 });
  }
  return g;
}

/** Generic building from the ARCH spec table. */
const HOUSE_WALLS = ['#e0d3ae', '#d8c49a', '#e8dcc0', '#d3bf96'];
const ROOF_BY_DISTRICT = {
  residential: ['#b5543c', '#5a6b7d', '#c9a24b'],
  farms: ['#c9a24b', '#a98a5e', '#b5543c'],
  workshops: ['#5a6b7d', '#8a6b45', '#6b6250'],
  market: ['#b5543c', '#c96b4a', '#5a6b7d'],
  visitors: ['#b59a6a', '#c9a24b'],
};
function paintGeneric(b, spec, ctx, bh, lif) {
  const { pal } = ctx;
  const { x, y, w } = b;
  const r = subRng(ctx.seed, 'bldg', b.id);
  const nm = (c) => (pal.nightMul < 1 ? shade(c, pal.nightMul) : c);
  const isHouse = b.archetype === 'house';
  const bodyBase = lif === 'abandoned' ? shade(spec.body, 0.75)
    : lif === 'sleepy' ? shade(spec.body, 0.9)
    : isHouse ? HOUSE_WALLS[r.int(0, HOUSE_WALLS.length - 1)] : spec.body;
  const bodyCol = nm(bodyBase);
  let roofCol = spec.roof;
  if (isHouse) roofCol = nm(r.pick(ROOF_BY_DISTRICT[b.district] ?? ROOF_BY_DISTRICT.residential));
  else if (roofCol) roofCol = nm(roofCol);
  let g = '';
  if (isHouse) {
    // dirt yard + front fence (under the building)
    g += E(x + w / 2, y + 4, w * 0.95, 12, pal.dirt, { opacity: 0.55 });
    const fx0 = x - 12, fx1 = x + w + 12, fyy = y + 10;
    for (let px = fx0; px <= fx1; px += 16) g += R(px, fyy - 12, 3, 12, nm('#66401f'));
    g += R(fx0, fyy - 10, fx1 - fx0, 3, nm('#8a5a33')) + R(fx0, fyy - 5, fx1 - fx0, 3, nm('#8a5a33'));
  }
  g += shadow(x, y + 2, w, pal);
  const { svg: bd, depth } = body3d(x, y, w, bh, bodyCol, pal);
  g += bd;
  if (spec.roofStyle && spec.roof) g += roofFor(x, y, w, bh, spec.roofStyle, roofCol, pal, depth);

  // timber-frame beams on houses
  if (isHouse && ctx.lod >= 1) {
    const beam = nm('#6b4a2c');
    g += R(x + 2, y - bh, 5, bh, beam) + R(x + w - 7, y - bh, 5, bh, beam);
    g += R(x, y - bh + 9, w, 5, beam) + R(x, y - Math.round(bh * 0.55), w, 5, beam);
    g += R(x + Math.round(w * 0.3), y - bh, 4, bh, beam) + R(x + Math.round(w * 0.68), y - bh, 4, bh, beam);
  }

  const lit = pal.lampGlow && lif !== 'sleepy' && lif !== 'abandoned';
  const winN = Math.max(1, Math.floor(w / 26));
  if (ctx.lod >= 1 && spec.roofStyle !== 'tent') {
    g += windowsRow(x, y, w, bh, spec.feat.includes('tallwin') ? Math.max(1, Math.floor(winN / 2)) : winN, lit, pal, spec.feat.includes('tallwin'));
    g += doorAt(x, y, w, pal);
  }
  if (lit) g += E(x + w / 2, y + 4, w * 0.62, 10, 'url(#k-lampg)'); // warm pool at the door
  // features
  const fy = y - bh;
  if (isHouse) {
    // chimney with smoke wisp
    const chx = x + (r.bool(0.5) ? w * 0.18 : w * 0.72);
    g += R(chx, fy - 24, 9, 28, nm('#8b8378')) + R(chx - 2, fy - 26, 13, 4, nm('#6e685e'));
    if (lif === 'active' || lif === 'flourishing' || r.bool(0.45)) {
      g += C(chx + 4, fy - 34, 7, 'url(#k-smokeg)') + C(chx + 8, fy - 45, 9, 'url(#k-smokeg)');
    }
  } else if (spec.feat.includes('chimney')) {
    const chx = x + w * 0.72;
    g += R(chx, fy - 26, 10, 30, pal.stoneDark) + R(chx - 2, fy - 28, 14, 4, pal.stone);
    if (b.activity === 'busy' || lif === 'active') g += C(chx + 5, fy - 36, 7, 'url(#k-smokeg)');
  }
  if (spec.feat.includes('stacks')) {
    g += R(x + w + 2, y - 18, 14, 18, pal.wood) + R(x + w + 4, y - 26, 10, 8, pal.woodDark);
    g += C(x + w + 26, y - 8, 8, pal.stoneDark);
  }
  if (spec.feat.includes('glow') && (b.activity === 'busy' || pal.lampGlow)) {
    g += R(x + w * 0.2, y - 30, 14, 18, '#ff9e3c', { opacity: 0.9 }) + C(x + w * 0.2 + 7, y - 21, 14, 'url(#k-fireg)');
  }
  if (spec.feat.includes('awnings')) {
    for (let ax = x + 4; ax < x + w - 12; ax += 26) {
      g += R(ax, fy + 16, 22, 8, (ax / 26) % 2 ? '#e8dcc0' : '#c96b4a') + R(ax, fy + 8, 3, 10, pal.woodDark) + R(ax + 19, fy + 8, 3, 10, pal.woodDark);
    }
  }
  if (spec.feat.includes('counter')) {
    g += R(x + 2, fy + 18, w - 4, 8, pal.woodDark);
    if (b.archetype === 'stall') {
      // goods on display: crates of fruit, bread, cloth
      const goods = ['#c94f4f', '#d8a24b', '#4f9be0', '#8fd07a'];
      for (let gi = 0; gi < 3; gi++) {
        const gx = x + 4 + gi * Math.max(13, (w - 10) / 3);
        g += R(gx, fy + 28, 11, 9, nm('#8a5a33')) + R(gx, fy + 28, 11, 2, nm('#6e4526'));
        g += C(gx + 5, fy + 26, 3.5, goods[(gi + r.int(0, 3)) % goods.length]);
      }
    }
  }
  if (spec.feat.includes('crane')) {
    g += R(x + w - 8, fy - 44, 5, 44, pal.woodDark) + LN(x + w - 8, fy - 44, x + w + 22, fy - 30, pal.woodDark, 4);
    g += LN(x + w + 22, fy - 30, x + w + 22, fy - 12, '#3a3f4a', 2) + R(x + w + 16, fy - 12, 12, 10, pal.wood);
  }
  if (spec.feat.includes('emblem')) g += bannerOn(x + w / 2 - 7, fy - 26, pal.roofKingdom, pal);
  if (spec.feat.includes('flag')) g += LN(x + w - 10, fy - 34, x + w - 10, fy - 8, pal.woodDark, 2) + P([[x + w - 10, fy - 34], [x + w + 6, fy - 30], [x + w - 10, fy - 26]], pal.gold);
  if (spec.feat.includes('steps')) g += R(x + w / 2 - 16, y, 32, 5, pal.stoneDark) + R(x + w / 2 - 12, y + 5, 24, 4, pal.stoneDark);
  if (spec.feat.includes('altar')) g += R(x + w / 2 - 8, fy + 20, 16, 14, pal.stoneLight) + C(x + w / 2, fy + 14, 5, pal.goldLight);
  if (spec.feat.includes('silo')) {
    g += R(x + w + 4, y - 34, 16, 34, '#b59a6a') + `<path d="M ${x + w + 4} ${y - 34} A 8 10 0 0 1 ${x + w + 20} ${y - 34} Z" fill="#8a6b45"/>`;
  }
  if (spec.feat.includes('crenel')) {
    for (let cx = x + 2; cx < x + w - 6; cx += 14) g += R(cx, fy - 8, 8, 8, bodyCol);
  }
  if (b.archetype === 'barracks') {
    // stronger walls: crenellated parapet + corner posts + gate flag
    for (let cx = x + 4; cx < x + w - 8; cx += 18) g += R(cx, fy - 12, 10, 12, bodyCol);
    g += R(x - 3, fy - 18, 8, bh + 18, nm('#7d7468')) + R(x + w - 5, fy - 18, 8, bh + 18, nm('#7d7468'));
  }
  if (spec.feat.includes('glassdome')) g += E(x + w / 2, fy + 6, w * 0.28, 12, '#bfe0f2', { opacity: 0.75 });
  if (spec.feat.includes('slit')) g += R(x + w / 2 - 3, fy - bh * 0.5, 6, bh * 0.4, '#2e343f');
  if (spec.feat.includes('platform')) {
    g += R(x - 6, fy - 4, w + 12, 6, pal.woodDark);
    g += R(x + w / 2 - 8, fy - 22, 16, 18, '#3d4a5e');
  }
  if (spec.feat.includes('pilings')) {
    for (let px = x + 4; px < x + w; px += 16) g += R(px, y, 5, 22, pal.woodDark);
  }
  if (spec.feat.includes('statue') && b.archetype === 'monument') return paintMonument(b, ctx, bh);
  if (lif === 'flourishing') {
    g += bannerOn(x + 6, fy - 4, '#f28bb4', pal);
    for (let qx = x + 6; qx < x + w - 4; qx += 12) g += C(qx, y - 4, 3, '#f28bb4');
  }
  if (lif === 'recovered') g += bannerOn(x + w / 2 - 7, fy - 6, pal.gold, pal);
  return g;
}

/** Lifecycle overlays / replacements. */
function lifecycleWrap(b, lif, ctx, bh, baseSvg) {
  const { pal } = ctx;
  const { x, y, w } = b;
  switch (lif) {
    case 'empty': {
      const s = `<rect x="${x}" y="${y - 8}" width="${w}" height="${Math.max(8, b.h)}" fill="none" stroke="#ffffff" stroke-width="2" stroke-dasharray="8 6" opacity="0.35"/>`;
      return { svg: s, bounds: { x, y: y - 8, w, h: Math.max(8, b.h) + 8 } };
    }
    case 'foundation': {
      const s = shadow(x, y + 2, w, pal) + R(x, y - 12, w, 12, pal.stoneDark) + R(x + 4, y - 10, w - 8, 4, pal.stone);
      return { svg: s, bounds: { x, y: y - 14, w, h: 18 } };
    }
    case 'construction':
    case 'repairing': {
      const frameH = bh * 0.65;
      let s = shadow(x, y + 2, w, pal);
      s += materialPile(x - 4, y, pal, `${ctx.seed}:bldg:${b.id}`);
      for (let px = x + 4; px < x + w - 4; px += 18) s += R(px, y - frameH, 5, frameH, pal.wood);
      for (let py = y - frameH; py < y - 6; py += 16) s += R(x, py, w, 4, pal.woodDark);
      s += P([[x, y - frameH], [x + w / 2, y - frameH - w * 0.25], [x + w, y - frameH]], shade(pal.wood, 0.85));
      s += scaffold(x + w + 4, y, 10, frameH, pal);
      return { svg: s, bounds: { x: x - 30, y: y - frameH - w * 0.3 - 20, w: w + 70, h: frameH + w * 0.3 + 30 } };
    }
    case 'upgrading':
      return { svg: baseSvg + scaffold(x + w + 2, y, 8, bh * 0.8, pal), bounds: null };
    case 'damaged':
      return { svg: baseSvg + cracks(x, y, w, bh) + C(x + w * 0.7, y - bh - 8, 10, 'url(#k-smokeg)'), bounds: null };
    case 'sleepy':
    case 'abandoned':
    case 'active':
    case 'flourishing':
    case 'recovered':
    default:
      return { svg: baseSvg, bounds: null };
  }
}

export function buildingDrawables(world, ctx) {
  const out = [];
  const list = [...world.buildings].sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const b of list) {
    const spec = ARCH[b.archetype] ?? ARCH.house;
    const bh = clamp(b.w * 0.85 * spec.hf * (0.65 + (b.level ?? 1) * 0.14), 18, b.archetype === 'castle' ? 400 : 170);
    let svg, bounds;
    if (b.archetype === 'castle') {
      const g = paintCastle({ ...b, w: Math.max(b.w, 170) }, ctx, bh);
      svg = g.svg; bounds = g.bounds;
    } else if (b.archetype === 'fortress') {
      svg = paintFortress(b, ctx, bh); bounds = null;
    } else if (b.archetype === 'mill') {
      svg = paintMill(b, ctx, bh); bounds = null;
    } else if (b.archetype === 'dock') {
      svg = paintDock(b, ctx); bounds = { x: b.x, y: b.y - 20, w: b.w, h: 60 };
    } else if (b.archetype === 'gate') {
      svg = paintGate(b, ctx, bh); bounds = null;
    } else {
      svg = paintGeneric(b, spec, ctx, bh, b.lifecycle);
    }
    const wrapped = lifecycleWrap(b, b.lifecycle, ctx, bh, svg);
    const bw = bounds ?? wrapped.bounds ?? { x: b.x - 24, y: b.y - bh - 90, w: b.w + 48, h: bh + 100 };
    const lodCull = ctx.lod === 0 && b.lifecycle === 'empty' ? null : true;
    if (!lodCull) continue;
    out.push({
      id: `bldg-${b.id}`, layer: 4, footY: b.y + b.h, x: b.x + b.w / 2,
      bounds: bw, svg: wrapped.svg,
      meta: { buildingId: b.id, archetype: b.archetype, x: b.x, y: b.y },
    });
  }
  // Hall of Heroes: achievement statues near the hall anchor.
  const hall = world.hall?.entries ?? [];
  if (hall.length && ctx.lod >= 1) {
    const anchor = ctx.anchorById('hall_of_heroes');
    if (anchor) {
      const r = subRng(ctx.seed, 'hall');
      hall.slice(0, 6).forEach((e, i) => {
        const sx = anchor.x - 70 + i * 28 + r.int(-4, 4), sy = anchor.y + 34;
        const svg = R(sx - 8, sy - 10, 16, 10, '#8b93a0') + R(sx - 4, sy - 30, 8, 20, '#c3c9d1') + C(sx, sy - 34, 5, '#c3c9d1');
        out.push({
          id: `hall-${e.id}`, layer: 4, footY: sy, x: sx,
          bounds: { x: sx - 10, y: sy - 42, w: 20, h: 44 }, svg,
          meta: { buildingId: e.id, archetype: 'monument', x: sx, y: sy },
        });
      });
    }
  }
  return out;
}
