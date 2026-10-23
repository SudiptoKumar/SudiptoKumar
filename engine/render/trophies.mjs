// The trophy hall (TRUE V2): the TROPHY_HALL camera. The gallery is the building that stands on the overworld.
import { renderCamera } from './camera.mjs';
import { pill } from './overlays.mjs';
import { T } from './ui.mjs';

export function renderTrophies(S, rctx = {}) {
  return renderCamera(S, rctx, 'TROPHY_HALL', {
    title: 'Trophy hall',
    desc: `${S.achievements.count} of ${S.achievements.total} achievements unlocked. Each one stands on a pedestal in the hall; secret ones are doors.`,
    overlay: (K, h) => pill(h, 12, 12, 'trophy', `${K.W.hall.count}/${K.W.hall.total}`, { color: T.gold }),
  });
}
