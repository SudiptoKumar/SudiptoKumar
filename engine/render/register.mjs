// register.mjs — plug the render pipeline into engine/cli.mjs's asset
// registry. One asset per camera ('grand', 'capital', ...), plus
// 'grand-mobile'. The event camera registers too: its painter returns null
// when the kingdom is quiet, and renderAll removes that file.
import { registerAsset, assetKeys } from '../cli.mjs';
import { renderCamera, CAMERA_IDS } from './index.mjs';

const PROBLEMS = [];
export const renderProblems = () => [...PROBLEMS];

/**
 * Register one asset per camera for a (world, snapshot) pair.
 * Safe to call once per process; returns the registered keys.
 */
export function registerRenderAssets(world, snap, { inputSignature = '' } = {}) {
  PROBLEMS.length = 0;
  const keys = [];
  const reg = (key, file, cameraId, opts = {}) => {
    if (assetKeys().includes(key)) { keys.push(key); return; } // idempotent: update then render in one process
    registerAsset(key, file, () => {
      const r = renderCamera(world, snap, cameraId, { ...opts, inputSignature });
      if (!r) return null;
      for (const p of r.problems) PROBLEMS.push({ key, problem: p });
      return r.svg;
    });
    keys.push(key);
  };
  for (const id of CAMERA_IDS) reg(id, `${id}.svg`, id);
  reg('grand-mobile', 'grand-mobile.svg', 'grand', { variant: 'mobile' });
  return keys;
}
