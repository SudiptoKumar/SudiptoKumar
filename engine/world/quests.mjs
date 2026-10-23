// World-linked quests (TRUE V2 phase 6). A quest is not a line of text: it points at a place in the kingdom.
//   STREAK -> the farm        STARS -> the vault        ISSUES -> the dungeon       CI -> the fortress
//   RELEASE -> the castle     NEW PROJECT -> an empty building plot in the districts
// Every shown, active quest gets a marker standing over its object in the world (all cameras), and the quest strip uses the same target icon.
import { QUEST_TARGET } from './homes.mjs';
import { ANCHORS, FARM, SLOTS, SLOT_DISTRICT } from './layout.mjs';

/** The icon that stands for each target object (the quest strip and the world marker use the same one). */
export const TARGET_ICON = Object.freeze({ farm: 'wheat', vault: 'coin', dungeon: 'skull', ci: 'flame', castle: 'crown', district: 'hammer' });
export const TRACK_COLOR = Object.freeze({ gate: '#ef5a5a', recover: '#ef7d57', streak: '#ffcd75', stars: '#ffe08a', release: '#73eff7', build: '#a7f070', kingdom: '#f4f4f4' });
const BUILD_ORDER = ['automation', 'news', 'village', 'knowledge', 'personal'];

/** The first free building place in the districts: where the next project will be built. */
export function nextFreeSlot(layout) {
  const used = new Set([...layout.placed, ...layout.ruins].map((q) => `${q.x},${q.y}`));
  for (const list of BUILD_ORDER) for (const [x, y] of SLOTS[list]) if (!used.has(`${x},${y}`)) return { x, y, list, district: SLOT_DISTRICT[list] };
  return null;
}

/** Where the arrow points for each object (world units): just above it. */
function pointOf(object, layout) {
  switch (object) {
    case 'farm': return { x: FARM.fence[0] + FARM.fence[2] / 2, y: FARM.fence[1] - 2 };
    case 'vault': return { x: ANCHORS.vault.x, y: ANCHORS.vault.y - 21 };
    case 'dungeon': return { x: ANCHORS.dungeon.x - 2, y: 213 };
    case 'ci': return { x: ANCHORS.ci.x, y: ANCHORS.ci.y - 50 };
    case 'district': { const s = nextFreeSlot(layout); return s ? { x: s.x, y: s.y - 12, plot: { x: s.x, y: s.y, list: s.list, district: s.district } } : { x: ANCHORS.plaza.x, y: ANCHORS.plaza.y - 12 }; }
    default: return { x: ANCHORS.castle.x, y: ANCHORS.castle.y - 46 };
  }
}

/** A marker is drawn only in a camera that can show all of it (badge, arrow and the staked plot): never half a marker at a picture edge. */
export function markerFits(q, rect) {
  const [rx, ry, rw, rh] = rect;
  return q.x - 7 >= rx && q.x + 7 <= rx + rw && q.y - 16 >= ry && (q.plot ? q.plot.y + 1 : q.y + 2) <= ry + rh;
}

/** The markers of the quests shown on the quest strip (rows) plus the current one: only ACTIVE quests have a place to go. */
export function questTargets(S, layout) {
  const q = S.quests || {}, shown = [...(q.rows || [])];
  if (q.current && !shown.some((r) => r.id === q.current.id)) shown.push(q.current);
  const out = [], seen = new Set();
  for (const r of shown) {
    if (r.state !== 'ACTIVE' || seen.has(r.id)) continue;
    seen.add(r.id);
    const object = QUEST_TARGET[r.track] === 'district' ? 'district' : (QUEST_TARGET[r.track] === 'dungeon' ? 'dungeon' : QUEST_TARGET[r.track] === 'ci' ? 'ci' : QUEST_TARGET[r.track] || 'castle');
    const pt = pointOf(object, layout);
    out.push({ id: r.id, track: r.track, object, icon: TARGET_ICON[object], color: TRACK_COLOR[r.track] || TRACK_COLOR.kingdom, x: pt.x, y: pt.y, plot: pt.plot || null, pct: r.pct ?? 0, primary: r.id === q.current?.id });
  }
  return out;
}
