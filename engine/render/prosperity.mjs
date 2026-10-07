// Power-tier visual evolution (TRUE V2 §7/§12, Phase 6). The kingdom's power tier
// must change the visible world, not just a number. As power grows, the castle
// grounds visibly prosper: banners rise on the plaza, gardens bloom, statues are
// raised, and a legendary kingdom glows gold.
import { C } from './palette.mjs';
import { L } from './kingdom-layout.mjs';

const TIER_IDX = { village: 0, settlement: 1, kingdom: 2, prosperous: 3, legendary: 4 };

/** Draw power-tier decorations around the castle and plaza. Called from paintWorld. */
export function drawProsperity(K) {
  const { p, S } = K;
  const idx = TIER_IDX[S.world.power.tier] ?? 0;
  if (idx < 1) return;   // a struggling village shows no finery

  const golden = idx >= 3;   // prosperous and legendary use gold

  // ---- banners on poles at the plaza edges (settlement+: 2, prosperous+: 4, legendary: 6)
  const nB = idx >= 4 ? 6 : idx >= 3 ? 4 : 2;
  const bx = [60, 116, 54, 122, 66, 110];
  for (let i = 0; i < nB; i++) {
    const x = bx[i], y = 108;
    p.r(x, y - 16, 1, 16, '#4e2f1c');
    const col = golden ? '#ffcd75' : (i % 2 ? C.blue : C.red);
    p.r(x + 1, y - 16, 5, 9, col);
    p.r(x + 1, y - 16, 5, 1, '#ffffff', 0.35);
    p.r(x + 1, y - 8, 5, 1, col);
  }

  // ---- gardens below the plaza (kingdom+: 2 beds, prosperous+: 4, legendary: 6)
  if (idx >= 2) {
    const nG = idx >= 4 ? 6 : idx >= 3 ? 4 : 2;
    const gx = [76, 100, 68, 108, 84, 92];
    for (let i = 0; i < nG; i++) {
      const x = gx[i], y = 126;
      p.r(x - 5, y - 2, 10, 4, '#5d3a1a');
      for (let f = 0; f < 3; f++) {
        const fx = x - 4 + f * 4;
        p.r(fx, y - 6, 1, 4, '#2d6a2d');
        p.r(fx - 1, y - 8, 3, 2, [C.red, C.yellow, '#ff9ecb'][(i + f) % 3]);
      }
    }
  }

  // ---- statues flanking the castle (prosperous+)
  if (idx >= 3) {
    const stone = golden ? '#ffcd75' : '#b6c9e0';
    for (const sx of [68, 108]) {
      p.r(sx - 3, 92, 6, 4, '#6b7280');      // pedestal
      p.r(sx - 2, 92, 4, 1, '#9ca3af');
      p.r(sx - 1, 84, 2, 8, stone);          // statue body
      p.r(sx - 2, 82, 4, 2, stone);          // head
      if (golden) p.r(sx - 1, 84, 2, 8, '#ffffff', 0.25);  // golden sheen
    }
  }

  // ---- legendary golden glow over the castle
  if (idx >= 4) {
    const [cx, cy] = L.castle;
    K.spots.push({ x: cx, y: cy - 24, r: 46, color: '#ffcd75', op: 0.12 });
  }
}
