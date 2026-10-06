// The light layer (V2). The whole scene is drawn in daylight colours, then this layer:
//   1. lays a dark tint over everything, with HOLES cut where light sources are (an SVG mask), so lit windows,
//      torches, lamps and fires stay bright while the rest goes dark,
//   2. adds soft glows (warm, cool, red for danger, gold for achievements and celebrations).
// Light sources are collected while the buildings are drawn: ctx.lights = [{ x, y, w, h, glow?, color? }] in grid units.
const hexId = (c) => c.replace('#', '');

export function glowDef(color) {
  return `<radialGradient id="g-${hexId(color)}"><stop offset="0" stop-color="${color}" stop-opacity=".95"/><stop offset=".45" stop-color="${color}" stop-opacity=".38"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;
}
const HOLE = '<radialGradient id="hole"><stop offset="0" stop-color="#000"/><stop offset=".55" stop-color="#000" stop-opacity=".65"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>';
const WARM = '#ffb347';
const RADIUS = { 0: 3.2, 1: 9, 2: 15 };      // grid units: window, torch/lamp, fire/beacon

/**
 * @param p        the Pix canvas (units = p.u)
 * @param W, H     size of the picture in grid units
 * @param tint     [colour, opacity] laid over the scene (null colour = none)
 * @param lights   ctx.lights
 * @param danger   [{ x, y, r, strong }] red warning light around failing buildings
 * @param spots    [{ x, y, r, color, pulse }] extra glows: shrine gold, castle celebration, repair, raid ...
 * @param moon     moonlight: a cool veil over the top of the map at night
 */
export function lightLayer(p, { W, H, tint = [null, 0], lights = [], danger = [], spots = [], moon = false, under = null, region = null }) {
  const R = region || { x: 0, y: 0, w: W, h: H };           // grid units: where the dark veil is allowed
  const u = p.u;
  const [tc, ta] = tint;
  const colors = new Set([WARM]);
  lights.forEach((l) => l.color && colors.add(l.color));
  spots.forEach((s) => colors.add(s.color));
  if (danger.length) colors.add('#ff3b2a');

  // 1. the dark veil with holes
  let holes = '';
  if ((ta > 0 && tc) || under) {
    for (const l of lights) {
      const cx = (l.x + l.w / 2) * u, cy = (l.y + l.h / 2) * u;
      const r = (RADIUS[l.glow ?? 0] ?? 3.2) * u * (1 + Math.max(ta, under ? 0.5 : 0) * 0.4);
      holes += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="url(#hole)"/>`;
    }
    for (const s of spots) holes += `<circle cx="${(s.x * u).toFixed(1)}" cy="${(s.y * u).toFixed(1)}" r="${(s.r * u * 0.8).toFixed(1)}" fill="url(#hole)"/>`;
    p.defs.push(HOLE, `<mask id="dk" maskUnits="userSpaceOnUse" x="0" y="0" width="${W * u}" height="${H * u}"><rect width="${W * u}" height="${H * u}" fill="#fff"/>${holes}</mask>`);
  }
  for (const c of colors) p.defs.push(glowDef(c));

  // the veil
  if (ta > 0 && tc) p.raw(`<rect x="${R.x * u}" y="${R.y * u}" width="${R.w * u}" height="${R.h * u}" fill="${tc}" fill-opacity="${ta}"${holes ? ' mask="url(#dk)"' : ''}/>`);
  if (under) p.raw(`<rect y="${under.y0 * u}" width="${W * u}" height="${(H - under.y0) * u}" fill="${under.color}" fill-opacity="${under.alpha}" mask="url(#dk)"/>`);
  if (moon) p.raw(`<rect width="${W * u}" height="${52 * u}" fill="#9fb8ff" fill-opacity=".07"/>`);

  // 2. glows. They are strong when it is dark and gentle in daylight.
  const k = Math.min(1, 0.3 + ta * 1.4);
  const kUnder = under ? 1 : k;
  for (const l of lights) {
    const lvl = l.glow ?? 0;
    const col = l.color || WARM;
    if (lvl === 0) { p.r(l.x, l.y, l.w, l.h, '#ffe08a'); if (ta > 0.1) p.raw(`<circle cx="${((l.x + l.w / 2) * u).toFixed(1)}" cy="${((l.y + l.h / 2) * u).toFixed(1)}" r="${(RADIUS[0] * 1.6 * u).toFixed(1)}" fill="url(#g-${hexId(WARM)})" opacity="${(0.28 * k).toFixed(2)}"/>`); continue; }
    const r = RADIUS[lvl] * u;
    p.raw(`<circle cx="${((l.x + l.w / 2) * u).toFixed(1)}" cy="${((l.y + l.h / 2) * u).toFixed(1)}" r="${r.toFixed(1)}" fill="url(#g-${hexId(col)})" opacity="${(0.55 * k).toFixed(2)}"/>`);
  }
  for (const s of spots) {
    p.raw(`<g${s.pulse ? ' class="pu"' : ''}><circle cx="${(s.x * u).toFixed(1)}" cy="${(s.y * u).toFixed(1)}" r="${(s.r * u).toFixed(1)}" fill="url(#g-${hexId(s.color)})" opacity="${(s.op ?? 0.7).toFixed(2)}"/></g>`);
  }
  for (const d of danger) {
    p.raw(`<g class="pu" style="animation-duration:${d.strong ? 1.1 : 2.2}s"><circle cx="${(d.x * u).toFixed(1)}" cy="${(d.y * u).toFixed(1)}" r="${(d.r * u).toFixed(1)}" fill="url(#g-ff3b2a)" opacity="${d.strong ? 0.8 : 0.5}"/></g>`);
  }
}
