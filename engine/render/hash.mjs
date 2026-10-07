// hash.mjs — render content hash (spec §09.12, lock §13).
// Covers: world/schema version, renderer version, ART version, camera
// version, animation version, input state signature, world signature,
// simulation snapshot signature, camera id + variant.
// Bumping ART_VERSION changes every asset hash => forces re-render.
import { canonical, sha } from '../util.mjs';
import {
  WORLD_SCHEMA_VERSION, RENDER_VERSION, ART_VERSION,
  CAMERA_VERSION, ANIM_VERSION, SIM_VERSION,
} from '../world/constants.mjs';

export function snapshotSignature(snap) {
  return sha(canonical(snap), 16);
}

/**
 * @param {object} args.world buildWorld() output (has .signature)
 * @param {object} args.snap simulation snapshot
 * @param {string} args.cameraId camera id
 * @param {string} args.variant 'desktop' | 'mobile'
 * @param {string} args.inputSignature input state signature (optional)
 * @param {object} args.versions override for tests (defaults to lock versions)
 */
export function renderContentHashWith({ world, snap, cameraId, variant = 'desktop', inputSignature = '', versions: v }) {
  return sha(canonical({
    worldSchema: String(v.WORLD_SCHEMA_VERSION),
    renderer: String(v.RENDER_VERSION),
    art: String(v.ART_VERSION),
    camera: String(v.CAMERA_VERSION),
    anim: String(v.ANIM_VERSION),
    sim: String(v.SIM_VERSION),
    world: world.signature,
    snap: snapshotSignature(snap),
    cameraId, variant, inputSignature,
  }), 16);
}

export function renderContentHash(args) {
  return renderContentHashWith({ ...args, versions: versions() });
}

export const versions = () => ({
  WORLD_SCHEMA_VERSION: String(WORLD_SCHEMA_VERSION),
  RENDER_VERSION: String(RENDER_VERSION),
  ART_VERSION: String(ART_VERSION),
  CAMERA_VERSION: String(CAMERA_VERSION),
  ANIM_VERSION: String(ANIM_VERSION),
  SIM_VERSION: String(SIM_VERSION),
});
