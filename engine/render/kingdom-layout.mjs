// Compatibility façade. The map of the kingdom lives in engine/world/layout.mjs (TRUE V2): one grid, one set of districts, one set of slots.
// Older imports (`L`, `HERO_SPOT`, `assignRepos`, ...) keep working through this file.
import { ANCHORS } from '../world/layout.mjs';
export { GW, GH, U, GROUND_Y, ROADS, SLOTS, assignRepos } from '../world/layout.mjs';

const at = (n) => [ANCHORS[n].x, ANCHORS[n].y];
export const L = {
  castle: at('castle'), vault: at('vault'), hall: at('hall'), plaza: at('plaza'), well: at('well'), ci: at('ci'), mine: at('mine'),
  farm: [2, 169], camp: at('camp'), gate: at('gate'), pond: at('pond'), river: [160, 166],
};
/** top-left of the 12 x 16 hero sprite for each place (the hero's feet are at the anchor's stand point) */
export const HERO_SPOT = Object.fromEntries(Object.entries(ANCHORS).map(([k, a]) => [k, [a.stand[0] - 6, a.stand[1] - 16]]));
