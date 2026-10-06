// TRUE V2 visitor camp model (TRUE V2 §15). Visitors exist physically in the world.
//
// One deterministic plot per approved visitor: { login, color, message, x, y }.
// The overworld camera and the camp camera show the SAME plots (each camera
// chooses how many of them to draw). Text stays sanitised upstream; only the
// approved flag records from the store ever reach this model.
import { campStateFor } from './constants.mjs';
import { L } from './layout.mjs';

/** Plot for the i-th visitor, in world grid units. Stable: the n-th visitor always lands here. */
export function campPlot(i) {
  const [cx, cy] = L.camp;
  return { x: cx - 20 + (i % 4) * 11, y: cy - 4 + Math.floor(i / 4) * 7 + (i % 2) };
}

/** Build the one camp model. Pure and deterministic. */
export function buildCamp(S) {
  const flags = S.visitors?.flags || [];
  const total = S.visitors?.total || 0;
  const arriving = S.scene?.stages?.visitor?.stage === 'arriving';
  const plots = flags.map((f, i) => ({
    n: f.n, login: f.login, color: f.color, message: f.message, avatar: f.avatar, at: f.at,
    arriving: arriving && i === 0,   // the newest visitor is still raising their tent
    ...campPlot(i),
  }));
  return { anchor: 'camp', state: campStateFor(total), total, plots };
}
