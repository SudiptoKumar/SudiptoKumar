// The harvest (TRUE V2): the FARM camera. The field is the same farm that stands on the overworld, seen up close.
// The overlay adds only the two numbers the farm owns: the streak and the total harvest.
import { renderCamera } from './camera.mjs';
import { pill } from './overlays.mjs';
import { T } from './ui.mjs';
import { fmt } from '../util.mjs';
export { stageFor } from '../world/farm.mjs';

export function renderHarvest(S, rctx = {}) {
  return renderCamera(S, rctx, 'FARM', {
    title: 'The harvest',
    desc: `The contribution farm: ${fmt(S.streak)} day streak. ${S.calendar.length ? 'Every plot is one day of the last 26 weeks; taller crops mean more contributions, golden fields mark the streak.' : 'No contributions yet.'}`,
    overlay: (K, h) => {
      const F = K.W.farm;
      pill(h, 12, 12, 'wheat', fmt(F.streak), { color: T.gold });
      pill(h, K.cam.outW - 12, 12, 'coin', fmt(F.total), { color: T.white, align: 'r' });
    },
  });
}
