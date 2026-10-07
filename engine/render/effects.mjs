// effects.mjs — transient fx from the simulation snapshot (L7) + weather
// overlays (L9, camera-space). Every decorative mark is deterministic:
// subRng(world seed, 'fx', type, anchor, index). Intensity scales counts;
// zero-intensity effects draw nothing.
import { R, C, P, LN, G } from './svg.mjs';
import { subRng } from '../util.mjs';
import { STATE } from './palette.mjs';

function anchorPos(ctx, anchor) {
  const a = ctx.anchorById(anchor);
  if (a) return { x: a.x, y: a.y };
  const d = ctx.districtById(anchor);
  if (d) return { x: d.rect.x + d.rect.w / 2, y: d.rect.y + d.rect.h / 2 };
  return null;
}

function scatterRects(r, cx, cy, w, h, n, colors, size) {
  let s = '';
  for (let i = 0; i < n; i++) {
    s += R(cx - w / 2 + r.int(0, w), cy - h + r.int(0, h), size, size * 0.7,
      colors[r.int(0, colors.length - 1)], { opacity: 0.9 });
  }
  return s;
}

function paintEffect(type, ax, ay, intensity, ctx, key) {
  const r = subRng(ctx.seed, 'fx', type, key);
  const n = Math.max(1, Math.round(intensity * 10));
  switch (type) {
    case 'banners': {
      let s = '';
      const cols = ['#f2c14e', '#f28bb4', '#4fc3e8', '#e8b93c'];
      for (let row = 0; row < 3; row++) {
        const y0 = ay - 120 - row * 26;
        s += LN(ax - 110, y0, ax + 110, y0 - 14, '#6b4f2c', 2);
        for (let i = 0; i < 12; i++) {
          const px = ax - 110 + i * 19;
          const py = y0 - (14 * i) / 12;
          s += P([[px, py], [px + 12, py - 1], [px + 6, py + 12]], cols[(i + row) % cols.length]);
        }
      }
      return s;
    }
    case 'confetti':
      return scatterRects(r, ax, ay - 40, 220, 140, n * 9,
        ['#f2c14e', '#f28bb4', '#4fc3e8', '#8fe08a', '#ffffff'], 5);
    case 'fireworks': {
      let s = '';
      for (let bIdx = 0; bIdx < Math.max(1, n); bIdx++) {
        const bx = ax - 90 + r.int(0, 180), by = ay - 220 - r.int(0, 120);
        const col = ['#f2c14e', '#f28bb4', '#4fc3e8'][bIdx % 3];
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2 + r.int(0, 20) / 40;
          const len = 22 + r.int(0, 18);
          s += LN(bx, by, bx + Math.cos(a) * len, by + Math.sin(a) * len, col, 2.5);
          s += C(bx + Math.cos(a) * len, by + Math.sin(a) * len, 2.5, col);
        }
        s += C(bx, by, 26, 'url(#k-lampg)');
      }
      return s;
    }
    case 'lanterns': {
      let s = '';
      for (let i = 0; i < n * 4; i++) {
        const lx = ax - 120 + r.int(0, 240), ly = ay - 60 - r.int(0, 160);
        s += C(lx, ly, 5, '#ffca6a', { opacity: 0.9 }) + C(lx, ly, 11, 'url(#k-lampg)');
      }
      return s;
    }
    case 'smoke': {
      let s = '';
      for (let i = 0; i < n * 4; i++) {
        const sx = ax - 20 + r.int(-30, 30), sy = ay - 40 - i * 14 - r.int(0, 10);
        s += C(sx, sy, 10 + i * 1.6, 'url(#k-smokeg)');
      }
      return s;
    }
    case 'fire': {
      let s = C(ax, ay - 14, 26, 'url(#k-fireg)');
      for (let i = 0; i < n * 2; i++) {
        const fx = ax - 16 + r.int(0, 32), fh = 18 + r.int(0, 22);
        s += P([[fx - 7, ay], [fx, ay - fh], [fx + 7, ay]], i % 2 ? '#ff9e3c' : '#e0523c');
        s += P([[fx - 3, ay], [fx, ay - fh * 0.55], [fx + 3, ay]], '#ffe9a0');
      }
      return s;
    }
    case 'alarm': {
      let s = '';
      for (let i = 1; i <= 3; i++) s += C(ax, ay - 60, i * 22, 'none', { stroke: '#e0523c', 'stroke-width': 4, opacity: 1 - i * 0.25 });
      s += C(ax, ay - 60, 10, '#e0523c', { stroke: '#7a1e12', 'stroke-width': 2 });
      return s;
    }
    case 'signal-fire':
      return paintEffect('fire', ax, ay, intensity, ctx, `${key}-f`)
        + paintEffect('smoke', ax, ay - 60, intensity, ctx, `${key}-s`);
    case 'dust': {
      let s = '';
      for (let i = 0; i < n * 5; i++) {
        s += C(ax - 60 + r.int(0, 120), ay - 20 - r.int(0, 60), 4 + r.int(0, 5), '#c9b78f', { opacity: 0.5 });
      }
      return s;
    }
    case 'debris': {
      let s = '';
      for (let i = 0; i < n * 6; i++) {
        s += R(ax - 50 + r.int(0, 100), ay - 10 - r.int(0, 24), 6, 4, i % 2 ? '#5a5f6a' : '#4a3a24',
          { transform: `rotate(${r.int(0, 40)} ${ax} ${ay})` });
      }
      return s;
    }
    case 'scaffolding': {
      const w = 70, h = 60, wd = '#8a5a33';
      let s = '';
      for (let px = ax - w / 2; px <= ax + w / 2; px += 18) s += R(px, ay - h, 4, h, wd);
      for (let py = ay - h; py < ay; py += 18) s += R(ax - w / 2, py, w, 3, wd);
      return s;
    }
    default: return '';
  }
}

/** World-space fx drawables (L7). War extras included. */
export function effectDrawables(world, snap, ctx) {
  const out = [];
  const seen = new Set();
  for (const e of snap.effects ?? []) {
    if (!e || e.intensity <= 0) continue;
    const key = `${e.type}@${e.anchor}`;
    if (seen.has(key)) continue; // one painter per (type, anchor)
    seen.add(key);
    const p = anchorPos(ctx, e.anchor);
    if (!p) continue; // never invent a location
    const svg = paintEffect(e.type, p.x, p.y, Math.min(1.5, e.intensity), ctx, key);
    if (!svg) continue;
    out.push({
      id: `fx-${e.type}-${String(e.anchor).replace(/[^a-z0-9]+/gi, '-')}`, layer: 7,
      footY: p.y, x: p.x,
      bounds: { x: p.x - 160, y: p.y - 380, w: 320, h: 400 }, svg,
    });
  }
  // War: barricades, projectiles, damage.
  const war = snap.war;
  if (war) {
    for (const bc of war.barricades ?? []) {
      const svg = P([[bc.x - 16, bc.y], [bc.x + 16, bc.y - 22], [bc.x + 10, bc.y - 22], [bc.x - 22, bc.y]],
          '#6b4f2c')
        + P([[bc.x + 16, bc.y], [bc.x - 16, bc.y - 22], [bc.x - 10, bc.y - 22], [bc.x + 22, bc.y]], '#8a5a33')
        + R(bc.x - 20, bc.y - 4, 40, 5, '#4a3a24');
      out.push({
        id: `barricade-${bc.id}`, layer: 5, footY: bc.y, x: bc.x,
        bounds: { x: bc.x - 26, y: bc.y - 26, w: 52, h: 30 }, svg,
      });
    }
    if (['BATTLE', 'TURNING_POINT', 'APPROACH'].includes(war.state)) {
      const r = subRng(ctx.seed, 'fx', 'projectiles');
      let s = '';
      for (let i = 0; i < 7; i++) {
        const x0 = 1700 + r.int(-60, 120), y0 = 300 + r.int(0, 120);
        const x1 = x0 - 90 - r.int(0, 60), y1 = y0 + 40 + r.int(0, 40);
        s += LN(x0, y0, x1, y1, '#e8dcc0', 2.5) + C(x1, y1, 4, 'url(#k-fireg)');
      }
      // impact bursts
      for (let i = 0; i < 3; i++) {
        const ix = 1620 + r.int(0, 160), iy = 420 + r.int(0, 80);
        s += C(ix, iy, 18, 'url(#k-fireg)') + C(ix, iy - 26, 14, 'url(#k-smokeg)');
      }
      out.push({
        id: 'fx-war-battle', layer: 7, footY: 480, x: 1720,
        bounds: { x: 1560, y: 260, w: 340, h: 320 }, svg: s,
      });
    }
    for (const dg of war.damage ?? []) {
      const p = anchorPos(ctx, dg.anchor);
      if (!p) continue;
      const r = subRng(ctx.seed, 'fx', 'damage', String(dg.anchor));
      let s = '';
      for (let i = 0; i < 8; i++) s += R(p.x - 40 + r.int(0, 80), p.y - 8 - r.int(0, 20), 7, 5, '#5a5f6a');
      s += C(p.x, p.y - 40, 16, 'url(#k-smokeg)');
      out.push({
        id: `damage-${String(dg.anchor).replace(/[^a-z0-9]+/gi, '-')}`, layer: 5,
        footY: p.y, x: p.x, bounds: { x: p.x - 50, y: p.y - 70, w: 100, h: 74 }, svg: s,
      });
    }
  }
  // Harvest sparkles over the farms district.
  if (snap.farm?.harvestReady) {
    const r = subRng(ctx.seed, 'fx', 'harvest');
    let s = '';
    for (let i = 0; i < 26; i++) {
      const hx = 40 + r.int(0, 480), hy = 1300 + r.int(0, 140);
      s += P([[hx, hy - 6], [hx + 2, hy - 2], [hx, hy + 2], [hx - 2, hy - 2]], '#f7d774');
    }
    out.push({
      id: 'fx-harvest', layer: 7, footY: 1440, x: 280,
      bounds: { x: 30, y: 1290, w: 510, h: 160 }, svg: s,
    });
  }
  return out;
}

/** Camera-space weather overlay (L9). Clipped to the camera rect by the caller. */
export function weatherOverlay(rect, ctx) {
  const w = ctx.pal.weather;
  if (w !== 'rain' && w !== 'storm' && w !== 'snow') return '';
  const r = subRng(ctx.seed, 'weather', w);
  const n = Math.min(w === 'storm' ? 200 : 140, Math.floor((rect.w * rect.h) / 9000));
  let s = '';
  if (w === 'snow') {
    for (let i = 0; i < n; i++) {
      s += C(rect.x + r.int(0, rect.w), rect.y + r.int(0, rect.h), 1 + r.int(0, 2), '#ffffff', { opacity: 0.85 });
    }
  } else {
    const col = w === 'storm' ? '#9fb4cc' : '#b8cce0';
    for (let i = 0; i < n; i++) {
      const x0 = rect.x + r.int(0, rect.w), y0 = rect.y + r.int(0, rect.h);
      s += LN(x0, y0, x0 - 8, y0 + 22, col, 2, { opacity: 0.55 });
    }
    if (w === 'storm' && r.bool(0.6)) {
      // One deterministic lightning bolt.
      const lx = rect.x + r.int(80, Math.max(81, rect.w - 80));
      s += P([[lx, rect.y], [lx - 14, rect.y + 90], [lx - 4, rect.y + 90], [lx - 18, rect.y + 190],
        [lx - 6, rect.y + 190], [lx + 6, rect.y + 90], [lx - 4, rect.y + 90], [lx + 10, rect.y]],
        '#f7f4d8', { opacity: 0.9 });
    }
  }
  return s;
}
