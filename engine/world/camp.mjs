// The visitor camp, calculated once. One tent for each visitor (newest in front), and the camp grows with the number of visitors:
//   EMPTY (0)  -> a stake and a white flag     CAMP (1-4) -> tents round a fire
//   VILLAGE (5-11) -> huts, lanterns, two fires     FESTIVAL (12+) -> bunting, a big fire, music
import { h32 } from './hash.mjs';

export const CAMP_CENTER = Object.freeze([145, 189]);
// tent top-left corners, best (front, closest to the viewer) first
export const TENT_SLOTS = Object.freeze([
  [132, 196], [154, 196], [122, 192], [161, 192], [128, 176], [153, 176], [121, 184], [161, 184], [139, 172], [147, 172], [140, 199], [148, 199],
]);
export const HUT_SLOTS = Object.freeze([[121, 172], [162, 172]]);
export const CAMP_STATES = Object.freeze(['EMPTY', 'CAMP', 'VILLAGE', 'FESTIVAL']);
export const campState = (total) => (total <= 0 ? 'EMPTY' : total < 5 ? 'CAMP' : total < 12 ? 'VILLAGE' : 'FESTIVAL');

export function buildCamp(S, cfg = {}) {
  const max = Math.min(cfg.visitors?.showOnMap ?? 12, TENT_SLOTS.length);
  const flags = (S.visitors?.flags || []).slice(0, max);
  const total = S.visitors?.total ?? flags.length;
  const state = campState(total);
  const stage = S.scene?.stages?.visitor?.stage || null;
  const visitors = flags.map((f, i) => ({ id: `v${f.n}`, n: f.n, color: f.color, avatar: f.avatar, x: TENT_SLOTS[i][0], y: TENT_SLOTS[i][1], newest: i === 0, stage: i === 0 ? stage : 'settled' }));
  const huts = state === 'VILLAGE' || state === 'FESTIVAL' ? 2 : 0;
  const sig = h32(`${state}|${visitors.map((v) => `${v.n}@${v.x},${v.y}${v.color}`).join(';')}|${stage}`);
  return { center: CAMP_CENTER, state, total, visitors, huts, fires: state === 'VILLAGE' || state === 'FESTIVAL' ? 2 : 1, bunting: state === 'FESTIVAL', stage, sig };
}
