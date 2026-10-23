// The dungeon (TRUE V2): the DUNGEON camera, the gate and the cave below it. One goblin for each open issue; the raid is fought at the gate.
import { renderCamera } from './camera.mjs';
import { drawMapLabels } from './kingdom.mjs';

export function renderDungeon(S, rctx = {}) {
  return renderCamera(S, rctx, 'DUNGEON', {
    title: 'The dungeon',
    desc: `${S.goblins.count} open issues wait as goblins in the dungeon below the gate.${S.raid?.active ? ' A raid is being fought at the gate.' : ''}`,
    overlay: (K, h) => drawMapLabels(K, h),
  });
}
