// The seven cameras of the kingdom. A camera is a window onto the ONE world: a rectangle in world units, an output width and a level of detail.
// Nothing here draws anything; the renderer crops the single world drawing with these rectangles.
import { GW, GH, U, OUT_W, clamp } from './constants.mjs';

export const CAMERA_IDS = Object.freeze(['OVERWORLD', 'CASTLE', 'PROJECT_DISTRICT', 'FARM', 'DUNGEON', 'TROPHY_HALL', 'VISITOR_CAMP']);

export const CAMERAS = Object.freeze({
  OVERWORLD:        { rect: [0, 20, 176, 220], outW: OUT_W, lod: 'far',  what: 'the whole kingdom, surface and dungeon' },
  CASTLE:           { follow: 'hero', size: [32, 41], outW: 200, lod: 'near', what: 'the hero and the place where he is right now' },
  PROJECT_DISTRICT: { rect: [0, 88, 176, 80], outW: OUT_W, lod: 'far',  what: 'the repository districts, building by building' },
  FARM:             { rect: [2, 167, 94, 34], outW: OUT_W, lod: 'near', what: 'the contribution farm' },
  DUNGEON:          { rect: [24, 177, 152, 63], outW: OUT_W, lod: 'far', what: 'the gate and the issue dungeon' },
  TROPHY_HALL:      { rect: [0, 65, 62, 29], outW: OUT_W, lod: 'near', what: 'the Trophy Hall' },
  VISITOR_CAMP:     { rect: [112, 170, 64, 36], outW: OUT_W, lod: 'near', what: 'the visitor camp' },
});

/** Resolve a camera for a world: follow cameras are centred on their target, every rectangle is kept inside the world. */
export function resolveCamera(world, id) {
  const def = CAMERAS[id];
  if (!def) throw new Error(`unknown camera ${id}`);
  let [x, y, w, h] = def.rect || [0, 0, def.size[0], def.size[1]];
  if (id === 'VISITOR_CAMP' && (world.camp?.total ?? 0) <= 4) [x, y, w, h] = [114, 178, 60, 28];   // a small camp is framed tightly; a village of tents needs the whole clearing
  if (def.follow === 'hero') {
    const hero = world.hero || { x: 88, y: 100 };
    w = def.size[0]; h = def.size[1];
    x = hero.x - w / 2; y = hero.y - h * 0.66;
  }
  return framed(id, def, x, y, w, h);
}

/** A free-form camera (the event camera aims at the place where the event happens). */
export function aimCamera(id, def, cx, cy, w, h) { return framed(id, def, cx - w / 2, cy - h / 2, w, h); }

function framed(id, def, x, y, w, h) {
  x = Math.round(clamp(x, 0, GW - w) * 4) / 4;
  y = Math.round(clamp(y, 0, GH - h) * 4) / 4;
  const outW = def.outW || OUT_W, outH = Math.round((outW * h) / w);
  return { id, rect: [x, y, w, h], outW, outH, zoom: outW / (w * U), lod: def.lod || 'far' };
}
