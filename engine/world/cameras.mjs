// TRUE V2 cameras: the seven views into the same world (TRUE V2 §8).
// A camera is a named view with either a world-coordinate rectangle to look at
// or an anchor to an interior. Cameras crop and frame; they never move the world.
import { CAMERA_RECTS, L } from './layout.mjs';

/**
 * id:      stable camera id
 * title:    human title
 * asset:    renderer asset key (wired in cli.mjs ASSETS; 'castle' and 'dungeon'
 *            are new in Phase 3)
 * rect:     [x0, y0, x1, y1] in world grid units, for map views
 * anchor:   a key of L, for interior views that are entered through a world place
 */
export const CAMERAS = {
  overworld: { id: 'overworld', title: 'Living Overworld', asset: 'world', rect: CAMERA_RECTS.overworld },
  castle:    { id: 'castle',    title: 'Castle',            asset: 'castle', rect: CAMERA_RECTS.castle },
  project:   { id: 'project',   title: 'Project District',  asset: 'districts', rect: CAMERA_RECTS.project },
  farm:      { id: 'farm',      title: 'Farm',              asset: 'harvest', rect: CAMERA_RECTS.farm },
  dungeon:   { id: 'dungeon',   title: 'Dungeon',           asset: 'dungeon', rect: CAMERA_RECTS.dungeon },
  trophy:    { id: 'trophy',    title: 'Trophy Hall',       asset: 'trophies', anchor: 'shrine' },
  visitor:   { id: 'visitor',   title: 'Visitor Camp',      asset: 'camp', rect: CAMERA_RECTS.visitor },
  // V3 cameras
  warfront:  { id: 'warfront',  title: 'War Front',         asset: 'warfront', rect: CAMERA_RECTS.warfront },
  builderyard: { id: 'builderyard', title: "Builder's Yard", asset: 'builderyard', rect: CAMERA_RECTS.builderyard },
  heroguild: { id: 'heroguild', title: 'Hero Guild',        asset: 'heroguild', rect: CAMERA_RECTS.heroguild },
};
export const CAMERA_IDS = Object.keys(CAMERAS);

/** The world anchor a camera looks at (map rects are centred on their rect). */
export function cameraFocus(camera) {
  if (camera.anchor) return { kind: 'anchor', at: L[camera.anchor] || null };
  const [x0, y0, x1, y1] = camera.rect;
  return { kind: 'rect', rect: camera.rect, center: [(x0 + x1) / 2, (y0 + y1) / 2] };
}
