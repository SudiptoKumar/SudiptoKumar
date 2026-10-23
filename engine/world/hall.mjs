// The Trophy Hall, calculated once. Every achievement is a pedestal (or a door) in a two-storey gallery on the map.
import { FOOT } from './layout.mjs';
import { h32 } from './hash.mjs';

export const HALL = Object.freeze({ cols: 8, floors: 2, innerX: 5, cell: 6.5, floorY: [FOOT.hall[1] + 14, FOOT.hall[1] + 25], rect: FOOT.hall });

export function buildHall(S) {
  const list = S.achievements?.list || [];
  const shown = [...list.filter((a) => !a.secret), ...list.filter((a) => a.secret)].slice(0, HALL.cols * HALL.floors);
  const pedestals = shown.map((a, i) => {
    const col = i % HALL.cols, row = Math.floor(i / HALL.cols);
    const state = a.secret ? (a.unlocked ? 'door-open' : 'door-locked') : a.unlocked ? 'trophy' : 'empty';
    return { id: a.id, icon: a.icon, state, major: !!a.major, isNew: !!a.isNew, row, col, x: Math.round((HALL.innerX + HALL.cell * (col + 0.5)) * 100) / 100, y: HALL.floorY[row] };
  });
  const got = list.filter((a) => a.unlocked).length;
  const sig = h32(pedestals.map((p) => `${p.id}:${p.state}${p.major ? 'M' : ''}${p.isNew ? 'N' : ''}`).join('|'));
  return { rect: HALL.rect, count: got, total: list.length, pedestals, sig };
}
