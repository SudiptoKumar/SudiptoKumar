// index.mjs — public render API.
// renderCamera(world, snap, cameraId, opts) -> { svg, hash, bytes, problems,
//   usedFallback, camera } | null (event camera when quiet).
// Every asset is isolated (one failure never kills the run) and budget-gated.
import { getCamera, CAMERA_IDS, isQuiet, eventFocus, activeStory } from './camera.mjs';
import { renderScene } from './scene.mjs';
import { enforceBudget } from './budgets.mjs';
import { isolate } from './fallback.mjs';
import { renderContentHash } from './hash.mjs';
import { anchorById } from '../world/districts.mjs';

export { CAMERA_IDS, isQuiet, eventFocus, activeStory };
export { renderContentHash } from './hash.mjs';
export { sceneObjects, cullDrawables, sortDrawables, buildCtx } from './scene.mjs';

export function renderCamera(world, snap, cameraId, opts = {}) {
  const camera = getCamera(cameraId, world, snap, anchorById);
  if (!camera) return null; // event camera when quiet
  const variant = opts.variant ?? 'desktop';
  const res = isolate(cameraId, () => renderScene(world, snap, camera, {
    variant, alt: opts.alt, title: opts.title,
  }).svg);
  const budget = enforceBudget(cameraId, res.svg, {
    kind: variant === 'mobile' ? 'grand-mobile' : 'svg',
  });
  const hash = renderContentHash({
    world, snap, cameraId, variant, inputSignature: opts.inputSignature ?? '',
  });
  return {
    svg: budget.svg, hash, bytes: budget.bytes,
    problems: [...(res.ok ? [] : ['render failed — fallback used']), ...budget.problems],
    usedFallback: !res.ok || budget.usedFallback,
    camera, empty: res.empty,
  };
}

/** Render every active camera (event included when loud). */
export function renderAllCameras(world, snap, opts = {}) {
  const out = {};
  for (const id of CAMERA_IDS) {
    const r = renderCamera(world, snap, id, opts);
    if (r) out[id] = r;
  }
  // mobile grand variant
  const mob = renderCamera(world, snap, 'grand', { ...opts, variant: 'mobile' });
  if (mob) out['grand-mobile'] = mob;
  return out;
}
