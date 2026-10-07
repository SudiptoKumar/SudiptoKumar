// camera.mjs — the 10 lock cameras (world-lock §11). Cameras FRAME only:
// they crop the same world+snapshot, never invent coordinates, never move
// objects. `event` returns null when the kingdom is quiet.
import { CAMERAS, WORLD_W, WORLD_H } from '../world/constants.mjs';

const clampCam = (x, y, w, h) => ({
  x: Math.max(0, Math.min(WORLD_W - w, Math.round(x)) ),
  y: Math.max(0, Math.min(WORLD_H - h, Math.round(y)) ),
  w, h,
});

const STATIC = Object.fromEntries(
  CAMERAS.filter((c) => c.rect).map((c) => [c.id, {
    rect: { x: c.rect[0], y: c.rect[1], w: c.rect[2], h: c.rect[3] },
    lod: c.lod ?? (c.id === 'grand' ? 0 : 1),
  }]),
);

export const CAMERA_IDS = ['grand', 'capital', 'projects', 'farm', 'warfront', 'dungeon', 'guild', 'harbor', 'hero', 'event'];

/** Quiet = daily life only: no live fx, no active event phases, no war. */
export function isQuiet(world, snap) {
  const liveFx = (snap.effects ?? []).some((e) => e && e.intensity > 0);
  const hotEvent = (world.events ?? []).some((e) => ['APPROACH', 'PEAK', 'AFTERMATH'].includes(e.phase));
  const warHot = snap.war && !['PEACE', 'RESOLVED'].includes(snap.war.state);
  return !liveFx && !hotEvent && !warHot;
}

/** Best event focus: highest-intensity effect anchor, else hottest event. */
export function eventFocus(world, snap, anchorById) {
  const fx = [...(snap.effects ?? [])].filter((e) => e && e.intensity > 0)
    .sort((a, b) => b.intensity - a.intensity)[0];
  const anchorId = fx?.anchor
    ?? (world.events ?? []).find((e) => ['PEAK', 'APPROACH', 'AFTERMATH'].includes(e.phase))?.anchor;
  if (!anchorId) return null;
  const a = anchorById(anchorId);
  if (!a) return null;
  return { x: a.x, y: a.y, label: anchorId };
}

const FX_TITLES = {
  banners: 'Celebration banners raised', confetti: 'Celebration in the streets',
  fireworks: 'Fireworks over the kingdom', lanterns: 'Lanterns on the water',
  smoke: 'Smoke on the wind', fire: 'Fire reported', alarm: 'Fortress alarm sounding',
  'signal-fire': 'Signal fire lit', dust: 'Dust from the roads', debris: 'Debris to clear',
  scaffolding: 'Repair crews at work',
};

/**
 * The one active story worth surfacing (HUD banner + README story section).
 * Prefers live simulation fx, then hot world events, then war. Null when quiet.
 */
export function activeStory(world, snap) {
  const fx = [...(snap.effects ?? [])].filter((e) => e && e.intensity > 0)
    .sort((a, b) => b.intensity - a.intensity)[0];
  if (fx) {
    return {
      title: FX_TITLES[fx.type] ?? 'Something stirs',
      phase: null, anchor: fx.anchor, kind: 'fx',
    };
  }
  const hot = (world.events ?? []).find((e) => ['APPROACH', 'PEAK', 'AFTERMATH'].includes(e.phase));
  if (hot) return { title: hot.title, phase: hot.phase, anchor: hot.anchor, kind: 'event' };
  if (snap.war && !['PEACE', 'RESOLVED'].includes(snap.war.state)) {
    return { title: `War — ${snap.war.state}`, phase: snap.war.state, anchor: 'war_front', kind: 'war' };
  }
  return null;
}

function heroPos(snap, anchorById) {
  const h = (snap.actors ?? []).find((a) => a.id === 'hero');
  if (h) return { x: h.x, y: h.y };
  const g = anchorById('hero_guild');
  return g ? { x: g.x, y: g.y } : { x: 1024, y: 768 };
}

/**
 * @returns { rect:{x,y,w,h}, lod, label } or null (event camera when quiet).
 */
export function getCamera(id, world, snap, anchorById) {
  if (STATIC[id]) return { ...STATIC[id], id, label: id };
  if (id === 'hero') {
    const p = heroPos(snap, anchorById);
    return { id, rect: clampCam(p.x - 240, p.y - 200, 480, 360), lod: 2, label: 'hero' };
  }
  if (id === 'event') {
    if (isQuiet(world, snap)) return null;
    const f = eventFocus(world, snap, anchorById);
    if (!f) return null;
    return { id, rect: clampCam(f.x - 320, f.y - 280, 640, 480), lod: 2, label: `event: ${f.label}` };
  }
  return null;
}

/** All cameras that produce an asset for this world+snapshot. */
export function activeCameras(world, snap, anchorById) {
  const out = [];
  for (const id of CAMERA_IDS) {
    const c = getCamera(id, world, snap, anchorById);
    if (c) out.push(c);
  }
  return out;
}
