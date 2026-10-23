// The camera pipeline (TRUE V2). The kingdom is drawn ONCE per picture, in world coordinates, by the same code for every camera.
// A camera is only a window: the drawing is clipped to it (so the file holds just what the camera sees) and scaled to the picture size.
// Because every view runs the same drawing code on the same world model, a tree, a goblin or a lit window is the same object everywhere.
//
//   renderCamera(S, rctx, 'FARM', { overlay })   ->  svg string
//   overlay(K, h)   draws screen-space things (numbers, plates, frames) on h, a Pix in output pixels; K maps world -> screen: K.sx(x), K.sy(y)
import { Pix, svgDoc } from './pixel.mjs';
import { SEASONS } from './palette.mjs';
import * as SC from './scenery.mjs';
import { rng } from '../util.mjs';
import { GW, GH, U, GROUND_Y, STYLE, clamp } from '../world/constants.mjs';
import { buildWorld } from '../world/index.mjs';
import { resolveCamera } from '../world/cameras.mjs';
import { h32 } from '../world/hash.mjs';
import { phaseSignature } from '../world/phases.mjs';
import { glowDef, lightLayer } from './light.mjs';
import { drawSky, drawMountains, drawGround, drawSeasonDecor, drawUnderground } from './kingdom-world.mjs';
import { drawPlaces } from './kingdom-places.mjs';
import { drawPeople, drawHero, drawRaid, drawWeather, drawQuests } from './kingdom-life.mjs';

const fx = (n) => String(Math.round(n * 10000) / 10000);

/** Draw the whole world into K.p, clipped to a camera. Returns the drawing context (K). */
export function drawWorld(S, rctx, W, cam) {
  const p = new Pix(U);
  const [rx, ry, rw, rh] = cam.rect;
  p.setClip([rx, ry, rx + rw, ry + rh]);
  const scene = S.scene, ph = S.time.phase, seasonKey = S.time.season, wx = scene.weather;
  const login = S.profile.login;
  const K = {
    p, S, W, cam, lod: cam.lod, scene, ph, seasonKey, SE: SEASONS[seasonKey], tier: W.kingdom.tier, light: W.lighting,
    night: ph === 'night', stormy: wx.kind === 'storm' || wx.kind === 'thunderstorm', winter: seasonKey === 'winter', wet: wx.wet,
    lit: W.lighting.windows, cfg: rctx.cfg || {}, rnd: rng('world:' + login), fx: rng('fx:' + login),
    lights: [], danger: [], spots: [], objs: [], blocked: [], man: {}, glows: new Set(),
  };
  K.rctx = rctx;
  K.bctx = { lights: K.lights, danger: K.danger };
  K.place = (z, fn) => K.objs.push({ z, fn });
  K.solid = (x, y, w, h) => K.blocked.push([x, y, w, h]);
  K.free = (x, y, m = 0) => !K.blocked.some(([bx, by, bw, bh]) => x >= bx - m && x <= bx + bw + m && y >= by - m && y <= by + bh + m);
  K.sym = (id, spr, s, pal) => { p.symbol(id, (q) => q.sprite(spr, 0, 0, { s, pal })); return id; };
  K.glow = (color) => { const id = 'glow:' + color; if (!p.defIds.has(id)) { p.defIds.add(id); p.defs.push(glowDef(color)); } };
  /**
   * One persistent thing of the world (hero, a repository building, the farm, the hall ...).
   * It is drawn whole or not at all (so it is the same markup in every camera that shows it), and it is fingerprinted into the manifest:
   *   id, world position, a state key from the world model, the level of detail it was drawn at, and a hash of the markup.
   */
  K.obj = (id, { x, y, st = '', box = null, lod = 'any', foot = false }, fn) => {
    if (box && !p.sees(box[0], box[1], box[2], box[3])) return false;
    // a standing building is drawn only by a camera that has its FOOT in the window: otherwise a tall roof or pennant of something standing
    // far outside the picture would poke into it (a stray flag over the trophies)
    if (foot && !(x >= rx - 2 && x <= rx + rw + 2 && y >= ry - 2 && y <= ry + rh + 6)) return false;
    const clip = p.clip; p.clip = null;
    const m = p.mark();
    fn();
    const markup = p.since(m);
    p.clip = clip;
    K.man[id] = [x, y, st, lod, h32(markup)];
    return true;
  };
  /** The one shadow of the kingdom: the light comes from the upper left, so every shadow falls a little to the right. w = width in units. */
  K.shadows = [];
  K.shadow = (x, y, w, h = 1.5) => { K.shadows.push([x, y, w]); return p.ellipse(x + STYLE.shadow.dx, y, w / 2, h / 2, STYLE.shadow.color, STYLE.shadow.opacity); };
  /** A thing that is part of the terrain (the dungeon): recorded in the manifest by place and state, not by markup. */
  K.note = (id, { x, y, st = '', box }) => { if (!box || p.sees(box[0], box[1], box[2], box[3])) K.man[id] = [x, y, st, 'any', 'terrain']; };
  K.sx = (gx) => Math.round((gx - rx) * cam.zoom * U * 100) / 100;
  K.sy = (gy) => Math.round((gy - ry) * cam.zoom * U * 100) / 100;

  drawSky(K);
  drawMountains(K);
  drawGround(K);
  drawUnderground(K);
  K.note('dungeon', { x: 90, y: 228, st: `${S.goblins.count}:${S.goblins.boss ? 'boss' : 'none'}`, box: [24, 212, 152, 28] });
  drawPlaces(K);
  drawSeasonDecor(K);
  drawPeople(K);
  drawHero(K);
  K.drawn = [];
  K.objs.sort((a, b) => a.z - b.z).forEach((o) => { K.drawn.push(o.z); o.fn(); });       // depth: whatever stands further south is drawn later, so it hides what is behind it
  drawRaid(K);
  drawQuests(K);
  drawWeather(K);
  applyLighting(K);
  return K;
}

/** The one place where light is applied to the world: the policy comes from world/lighting.mjs. */
function applyLighting(K) {
  const { p, light: L } = K;
  const soft = clamp(1.25 - L.intensity, 0.35, 1);                  // a golden haze belongs to the dark: by day it is only a hint
  const spots = [...K.spots, ...L.spots].map((s) => (s.pulse ? { ...s, op: (s.op ?? 0.5) * soft } : s));
  K.danger.push(...L.danger);
  lightLayer(p, { W: GW, H: GH, tint: L.tint, lights: K.lights, danger: K.danger, spots, moon: L.moon, under: { y0: GROUND_Y, color: '#0a0610', alpha: 0.38 } });
  if (L.veil) p.raw(`<rect width="${GW * U}" height="${GROUND_Y * U}" fill="#14223c" opacity="${L.veil}"/>`);
}

/** What every camera must agree on, as plain values (the consistency test compares exactly these). */
export function globalState(S, W) {
  const sc = S.scene;
  return {
    season: W.time.season, phase: W.time.phase, weather: W.weather.kind, light: W.lighting.sig, tier: W.kingdom.tier.id,
    event: `${sc.mode}|${phaseSignature(W.events)}|${sc.stages.release || '-'}|${sc.stages.raid || '-'}|${(sc.fx || []).join(',')}`,
    hero: `${W.hero.state}@${W.hero.x},${W.hero.y}`,
  };
}

/**
 * Draw one camera and return its parts, so a picture can embed it (the hero HUD embeds the CASTLE camera) or be it (renderCamera).
 *   body: svg for a window of cam.outW x cam.outH at (0, 0) of the caller's coordinate system
 *   defs: everything the body references (clip, sky gradient, symbols, glows, masks)
 *   manifest: what this camera drew, for the world-consistency test
 */
export function cameraParts(S, rctx, camId, { overlay = null, world = null, clipId = 'cv' } = {}) {
  const W = world || buildWorld(S, { cfg: rctx.cfg || {} });
  const cam = typeof camId === 'string' ? resolveCamera(W, camId) : camId;
  const K = drawWorld(S, rctx, W, cam);
  const h = new Pix(1);
  if (overlay) overlay(K, h);
  const [rx, ry] = cam.rect;
  const manifest = { v: 1, cam: cam.id, lod: cam.lod, rect: cam.rect, sig: W.sig, g: globalState(S, W), o: K.man };
  const body = `<g clip-path="url(#${clipId})"><g transform="scale(${fx(cam.zoom)}) translate(${fx(-rx * U)} ${fx(-ry * U)})">${K.p.toString()}</g></g>${h.toString()}`;
  const defs = `<clipPath id="${clipId}"><rect width="${cam.outW}" height="${cam.outH}"/></clipPath>` + SC.skyDefs(K.ph) + K.p.defsString();
  return { W, cam, K, body, defs, manifest };
}

export const manifestComment = (m) => 'kingdom-world ' + JSON.stringify(m);

/** Render one camera of the kingdom as a complete picture. The overlay draws screen-space things on top. */
export function renderCamera(S, rctx, camId, { overlay = null, title = 'The kingdom', desc = '', world = null } = {}) {
  const { cam, body, defs, manifest } = cameraParts(S, rctx, camId, { overlay, world });
  return svgDoc({ w: cam.outW, h: cam.outH, title, desc, body, defs, meta: manifestComment(manifest) });
}
