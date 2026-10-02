// Sky, mountains, weather and other effects for the world map. Grid: 160 x 220, one grid unit = 4 SVG units.
import { C, SKY, lighten, darken, mix } from './palette.mjs';
import { ICON, drawSprite } from './sprites.mjs';

export const GW = 160, GH = 220;

export function skyDefs(phase) {
  const st = SKY[phase];
  const stops = st.map((c, i) => `<stop offset="${(i / (st.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('');
  return (
    `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient>` +
    '<radialGradient id="glow"><stop offset="0" stop-color="#ffe9a8" stop-opacity="0.95"/><stop offset="0.45" stop-color="#ffb347" stop-opacity="0.4"/><stop offset="1" stop-color="#ff8a3d" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="glowb"><stop offset="0" stop-color="#9fe8ff" stop-opacity="0.9"/><stop offset="0.5" stop-color="#5ab8ff" stop-opacity="0.35"/><stop offset="1" stop-color="#3b7bff" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="glowr"><stop offset="0" stop-color="#ff8a5a" stop-opacity="0.95"/><stop offset="0.5" stop-color="#ff4a2a" stop-opacity="0.4"/><stop offset="1" stop-color="#ff2a1a" stop-opacity="0"/></radialGradient>'
  );
}
export function sky(p) { p.raw(`<rect width="${GW * p.u}" height="${60 * p.u}" fill="url(#sky)"/>`); }

export function stars(p, rnd, n = 44) {
  for (let i = 0; i < n; i++) {
    const x = rnd.int(1, GW - 2), y = rnd.int(1, 38), big = rnd() < 0.18;
    if (rnd() < 0.5) p.raw(`<g class="tw" style="animation-delay:${-(rnd() * 3).toFixed(1)}s">`).r(x, y, 1, 1, C.white).raw('</g>');
    else p.r(x, y, 1, 1, '#c8d4ff', 0.75);
    if (big) p.r(x - 1, y, 3, 1, C.white, 0.5).r(x, y - 1, 1, 3, C.white, 0.5);
  }
}
export function sun(p, x, y, low = false) {
  p.raw(`<circle cx="${x * p.u}" cy="${y * p.u}" r="${(low ? 17 : 15) * p.u}" fill="url(#glow)" opacity="${low ? 0.9 : 0.55}"/>`);
  p.ellipse(x, y, 5, 5, '#ffe08a').ellipse(x, y, 4, 4, '#fff0a0').ellipse(x - 1, y - 1, 2, 2, '#ffffff', 0.7);
}
export function moon(p, x, y) {
  p.raw(`<circle cx="${x * p.u}" cy="${y * p.u}" r="${14 * p.u}" fill="url(#glowb)" opacity="0.45"/>`);
  p.ellipse(x, y, 5, 5, '#f4f4f4').ellipse(x + 2, y - 1, 4, 4, '#dfe6f2', 0.0);
  p.r(x - 2, y - 2, 2, 2, '#c7d0e0').r(x + 1, y + 1, 3, 2, '#c7d0e0').r(x - 3, y + 2, 2, 1, '#c7d0e0');
}
export function cloudShape(p, x, y, w, c1, c2) {
  p.r(x + 2, y + 2, w - 4, 3, c1).r(x, y + 3, w, 3, c1).r(x + 4, y, w / 2, 3, c1).r(x + 2, y + 1, w / 3, 2, c1);
  p.r(x, y + 5, w, 1, c2);
}
export function clouds(p, rnd, { count = 4, dark = 0, night = false, phase = 'day' } = {}) {
  const base = night ? '#4a5380' : phase === 'evening' || phase === 'dawn' ? '#f3c9b8' : '#ffffff';
  const shade = night ? '#363e68' : phase === 'evening' || phase === 'dawn' ? '#d99aa0' : '#cfe0ee';
  const c1 = dark ? mix(base, '#4a5470', dark) : base, c2 = dark ? mix(shade, '#2e3650', dark) : shade;
  for (let i = 0; i < count; i++) {
    const y = 4 + Math.round(rnd() * 24), w = 14 + Math.round(rnd() * 12);
    const dur = 70 + Math.round(rnd() * 60);
    p.raw(`<g class="dr" style="animation-duration:${dur}s;animation-delay:${-Math.round(rnd() * dur)}s">`);
    cloudShape(p, 0, y, w, c1, c2);
    p.raw('</g>');
  }
}
export function aurora(p, rnd) {
  const cols = ['#5dffb0', '#73eff7', '#b48cf0'];
  cols.forEach((c, k) => {
    p.raw(`<g class="pu" style="animation-delay:${-k * 1.1}s">`);
    for (let x = 0; x < GW; x += 2) {
      const y = 8 + k * 5 + Math.round(5 * Math.sin(x / 11 + k * 1.7));
      p.r(x, y, 2, 12 - k * 2, c, 0.17);
    }
    p.raw('</g>');
  });
}

/** Back mountains. peaks = [[x, height, slope]] */
export function range(p, x0, x1, base, peaks, color, rim, snow = 0) {
  let run = null;
  const flush = () => { if (run && run.h > 0) p.r(run.x, base - run.h, run.len, run.h, color); run = null; };
  const hs = [];
  for (let x = x0; x <= x1; x++) {
    let h = 0;
    for (const [px, ph, sl] of peaks) h = Math.max(h, Math.round(ph - Math.abs(x - px) * (sl ?? 0.85)));
    hs.push(Math.max(0, h));
  }
  hs.forEach((h, i) => {
    const x = x0 + i;
    if (run && run.h === h) run.len++; else { flush(); run = { x, h, len: 1 }; }
  });
  flush();
  const top = Math.max(...hs);
  hs.forEach((h, i) => {
    if (h <= 0) return;
    const x = x0 + i;
    p.r(x, base - h, 1, 1, rim);
    if (snow && h >= top - snow) p.r(x, base - h, 1, Math.min(3, h), '#f4f8fc');
  });
}

/** Particles that fall in a loop (rain, snow, leaves). period = [dx, dy] in grid units. */
export function falling(p, rnd, { cls, period, count, draw, margin = 8 }) {
  const [dx, dy] = period;
  const base = Array.from({ length: count }, () => [rnd() * GW, rnd() * Math.abs(dy)]);
  p.raw(`<g class="${cls}">`);
  const rows = Math.ceil(GH / Math.abs(dy)) + 3;
  for (let j = -2; j < rows; j++) {
    for (const [bx, by] of base) {
      const y = by + dy * j;
      const xx = bx + dx * j;
      if (xx < -margin || xx > GW + margin || y < -margin || y > GH + margin) continue;
      draw(Math.round(xx * 4) / 4, Math.round(y * 4) / 4);
    }
  }
  p.raw('</g>');
}
export function rain(p, rnd, heavy) {
  falling(p, rnd, {
    cls: 'rn', period: [-5.5, 22], count: heavy ? 26 : 14,
    draw: (x, y) => { p.r(x, y, 1, 2, '#bfe3ff', 0.85).r(x - 1, y + 2, 1, 2, '#bfe3ff', 0.7); },
  });
}
export function fallers(p, rnd, season) {
  if (season === 'winter') falling(p, rnd, { cls: 'fa', period: [-9, 80], count: 26, draw: (x, y) => { p.r(x, y, 1, 1, '#ffffff', 0.95); if (((x * 7 + y * 3) | 0) % 5 === 0) p.r(x + 1, y, 1, 1, '#ffffff', 0.6); } });
  else if (season === 'autumn') falling(p, rnd, { cls: 'fa', period: [-9, 80], count: 9, draw: (x, y) => { p.r(x, y, 2, 1, ((x + y) | 0) % 2 ? '#ef7d57' : '#ffcd75').r(x + 1, y + 1, 1, 1, '#b13e53'); } });
  else if (season === 'spring') falling(p, rnd, { cls: 'fa', period: [-9, 80], count: 8, draw: (x, y) => { p.r(x, y, 1, 1, '#ffb3d6').r(x + 1, y + 1, 1, 1, '#ff9ecb'); } });
}
export function lightning(p, x, y) {
  p.raw('<g class="lt">');
  p.raw(`<rect width="${GW * p.u}" height="${GH * p.u}" fill="#ffffff" opacity="0.35"/>`);
  let cx = x, cy = y;
  for (let i = 0; i < 7; i++) { const dx = i % 2 ? -2 : 2; p.r(cx, cy, 2, 4, '#fff6a0').r(cx + (dx > 0 ? 1 : -1), cy + 3, 2, 1, '#ffffff'); cx += dx; cy += 4; }
  p.raw('</g>');
}
export function burst(p, cx, cy, color, delay) {
  p.raw(`<g class="fw" style="animation-delay:${delay}s">`);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
  for (const [dx, dy] of dirs) for (let k = 3; k <= 8; k += (k < 6 ? 1 : 2)) p.r(cx + dx * k, cy + dy * k, 1, 1, k > 6 ? lighten(color, 0.4) : color);
  p.r(cx, cy, 2, 2, '#ffffff');
  p.raw('</g>');
}
export function confetti(p, rnd, count = 22) {
  const cols = [C.red, C.yellow, C.cyan, C.lime, '#ff9ecb', C.white];
  for (let i = 0; i < count; i++) p.raw(`<g class="cf" style="animation-delay:${-(rnd() * 5).toFixed(1)}s;animation-duration:${(4 + rnd() * 3).toFixed(1)}s">`).r(rnd.int(2, GW - 3), rnd.int(30, 120), 1, 2, cols[i % cols.length]).raw('</g>');
}
export { lighten, darken, mix };
