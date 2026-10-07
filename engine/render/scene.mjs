// scene.mjs — one render pipeline (spec §09.1):
//   world -> simulation snapshot -> RenderScene -> camera/crop -> asset.
// Paint order (lock §10): L0 sky -> L1 mountains -> L2 terrain+water ->
// L3 roads+fields -> L4 buildings -> L5 props/barricades -> L6 actors ->
// L7 hero+fx -> L9 lighting/weather -> L10 HUD.
// Culling rule (spec §09.5): derive the FULL object list first (camera-free),
// then cull by camera rect + padding, then paint in stable order. Culling
// never consumes RNG: every decorative stream is per-object via subRng.
import { R } from './svg.mjs';
import { esc } from '../util.mjs';
import { resolvePalette } from './palette.mjs';
import { deriveLighting, paintSky } from './lighting.mjs';
import { buildDefs } from './sprites.mjs';
import { mountainsDrawables, baseDrawables, plazaDrawables, waterDrawables, forestDrawables, propDrawables, fieldDrawables, reserveDrawables } from './terrain.mjs';
import { roadDrawables } from './roads.mjs';
import { buildingDrawables } from './buildings.mjs';
import { actorDrawables } from './actors.mjs';
import { effectDrawables, weatherOverlay } from './effects.mjs';
import { paintHud } from './hud.mjs';
import { anchorById as anchorsById, districtById as districtsById } from '../world/districts.mjs';

export const LAYERS = { sky: 0, mountains: 1, terrain: 2, roads: 3, buildings: 4, props: 5, actors: 6, fx: 7, weather: 9, hud: 10 };
const CULL_PAD = 64;

/** Shared render context: derived once, passed to every pass. */
export function buildCtx(world, snap, { lod = 0, variant = 'desktop' } = {}) {
  const clock = snap.clock ?? {};
  const band = clock.band ?? world.time?.phase ?? 'morning';
  const season = clock.season ?? world.time?.season ?? 'summer';
  const weather = clock.weather ?? world.time?.weather ?? 'clear';
  const pal = resolvePalette({ season, band, weather });
  const severities = (world.events ?? []).map((e) => e.severity).filter(Boolean);
  const eventSeverity = severities.includes('danger') ? 'danger'
    : severities.includes('warning') ? 'warning'
    : severities.includes('celebration') ? 'celebration' : null;
  const light = deriveLighting({
    band, weather, season, eventSeverity,
    warPhase: snap.war?.state ?? world.war?.phase ?? 'PEACE',
    aurora: !!clock.aurora,
  });
  return {
    world, snap, seed: world.seed ?? 'kingdom', pal, light, lod, variant,
    band, season, weather,
    anchorById: (id) => anchorsById(id),
    districtById: (id) => districtsById(id),
    fortress: world.fortress ?? null,
    gates: snap.war?.gates ?? null,
    dungeon: world.dungeon ?? null,
  };
}

/**
 * The full, camera-independent drawable list. Plain data + pre-rendered SVG
 * per object; `meta` carries provenance for the no-camera-local-truth tests.
 */
export function sceneObjects(world, snap, opts = {}) {
  const ctx = buildCtx(world, snap, opts);
  const density = opts.variant === 'mobile' ? 0.45 : 1;
  const drawables = [
    ...mountainsDrawables(ctx),
    ...baseDrawables(ctx),
    ...plazaDrawables(ctx),
    ...waterDrawables(ctx),
    ...forestDrawables(world, ctx, density),
    ...propDrawables(world, ctx, density),
    ...reserveDrawables(ctx),
    ...roadDrawables(world, ctx),
    ...fieldDrawables(world, snap, ctx),
    ...buildingDrawables(world, ctx),
    ...actorDrawables(snap, ctx),
    ...effectDrawables(world, snap, ctx),
  ];
  return { ctx, drawables };
}

/** Cull to camera rect + padding. Pure filter — no RNG, no reordering. */
export function cullDrawables(drawables, rect, pad = CULL_PAD) {
  const x0 = rect.x - pad, y0 = rect.y - pad, x1 = rect.x + rect.w + pad, y1 = rect.y + rect.h + pad;
  return drawables.filter((d) => {
    const b = d.bounds;
    return b.x < x1 && b.x + b.w > x0 && b.y < y1 && b.y + b.h > y0;
  });
}

/** Stable depth order: layer, then foot-point (y, then x), then id. */
export function sortDrawables(drawables) {
  return [...drawables].sort((a, b) =>
    a.layer - b.layer || a.footY - b.footY || a.x - b.x
    || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Render one camera to a complete SVG document string.
 * opts: { lod, variant, alt, title }
 */
export function renderScene(world, snap, camera, opts = {}) {
  const { ctx, drawables } = sceneObjects(world, snap, { lod: camera.lod, variant: opts.variant });
  const visible = sortDrawables(cullDrawables(drawables, camera.rect));
  const { pal, light } = ctx;
  const rect = camera.rect;
  const title = opts.title ?? `Kingdom — ${camera.label ?? camera.id}`;
  const alt = opts.alt ?? title;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${rect.w}" height="${rect.h}"`
    + ` viewBox="${rect.x} ${rect.y} ${rect.w} ${rect.h}" role="img" aria-label="${esc(alt)}">`
    + `<title>${esc(title)}</title><desc>${esc(alt)}</desc>`;
  svg += buildDefs(pal, light);
  // L0 sky (camera-space)
  svg += paintSky(rect, light);
  // world layers
  for (const d of visible) svg += d.svg;
  // L9 lighting/weather atmosphere (camera-space, clipped)
  const clipId = `k-clip-${camera.id}`;
  svg += `<clipPath id="${clipId}"><rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}"/></clipPath>`;
  svg += `<g clip-path="url(#${clipId})">`;
  svg += weatherOverlay(rect, ctx);
  if (light.haze) svg += R(rect.x, rect.y, rect.w, rect.h, light.haze.color, { opacity: light.haze.alpha });
  if (light.accent && light.warGlow) {
    svg += R(rect.x, rect.y, rect.w, Math.ceil(rect.h * 0.3), '#e0523c', { opacity: 0.08 });
  }
  svg += `</g>`;
  // L10 HUD
  svg += paintHud(world, snap, ctx, camera);
  svg += `</svg>`;
  return { svg, ctx, visibleCount: visible.length, totalCount: drawables.length };
}
