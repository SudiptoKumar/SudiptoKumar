// The one map of the kingdom (TRUE V2). Grid: 176 x 240, one unit = 4 svg units. All cameras read this file.
//
//   y   0-50   sky
//   y  44-78   NORTH   mountains, the mine (west), the ruins of archived projects (east hills)
//   y  36-106  CENTER  the castle; WEST of it the Trophy Hall (y 66-93, with a forecourt down to the cross road); EAST of it the vault; the CI fortress in the north-east hills
//   y 106-162  WEST    KNOWLEDGE (library, lab) and PERSONAL projects     CENTER the VILLAGE     EAST AUTOMATION (towers, workshops) and NEWS
//   y 159-169  the river (one bridge on the main road)
//   y 169-206  SOUTH   the FARM (west), the visitor CAMP (east), the gate (centre)
//   y 212-240  UNDERGROUND   the issue dungeon (centre), the goblin outpost (east), gems (west)
import { normName } from '../util.mjs';
import { GW, GH, U, GROUND_Y, PLOT } from './constants.mjs';

export { GW, GH, U, GROUND_Y };

/** Named places. (x, y) is the foot centre of the building; stand = where the hero stands to work there. */
export const ANCHORS = Object.freeze({
  castle:   { x: 88,  y: 86,  stand: [98, 97] },
  plaza:    { x: 88,  y: 110, stand: [80, 114] },
  vault:    { x: 122, y: 94,  stand: [122, 102] },
  hall:     { x: 31,  y: 93,  stand: [31, 108] },
  ci:       { x: 154, y: 88,  stand: [154, 99] },
  mine:     { x: 22,  y: 62,  stand: [30, 72] },
  farm:     { x: 43,  y: 179, stand: [90, 190] },
  gate:     { x: 88,  y: 208, stand: [88, 195] },
  dungeon:  { x: 90,  y: 228, stand: [90, 226] },
  camp:     { x: 145, y: 190, stand: [130, 197] },
  home:     { x: 52,  y: 121, stand: [52, 121] },
  road:     { x: 88,  y: 146, stand: [88, 146] },
  well:     { x: 88,  y: 112, stand: [88, 112] },
  pond:     { x: 22,  y: 208, stand: [22, 200] },
  river:    { x: 88,  y: 164, stand: [88, 164] },
});

/** Tight art footprints [x, y, w, h]. Used for the overlap test and (expanded) to keep trees away. */
export const FOOT = Object.freeze({
  castle: [64, 36, 48, 52],
  vault: [113, 79, 18, 16],
  hall: [2, 66, 58, 27],
  ci: [134, 44, 40, 46],
  mine: [2, 40, 54, 24],
  ruins: [112, 45, 22, 34],
  farm: [2, 169, 82, 20],
  gate: [58, 189, 60, 19],
  camp: [120, 172, 50, 34],
});

/** Where the farm barn and windmill stand (south strip of the farm, north of the palisade). */
export const FARM = Object.freeze({
  fence: [2, 169, 82, 20],
  plots: { x: PLOT.x, y: PLOT.y, cols: PLOT.cols, rows: PLOT.rows, w: PLOT.w, h: PLOT.h },
  barn: [14, 201], windmill: [48, 201], gate: [86, 186],
});

/** Districts: where a repository building physically stands. rect = [x, y, w, h] of the foot area. */
export const DISTRICTS = Object.freeze({
  castle:     { name: 'CASTLE',     rect: [64, 36, 48, 76],  kind: 'center' },
  village:    { name: 'VILLAGE',    rect: [62, 112, 52, 50], kind: 'homes' },
  knowledge:  { name: 'KNOWLEDGE',  rect: [4, 106, 58, 42],  kind: 'library, research lab' },
  personal:   { name: 'PERSONAL',   rect: [4, 148, 58, 14],  kind: 'portfolio, flagship sites' },
  automation: { name: 'AUTOMATION', rect: [114, 112, 62, 36], kind: 'bot towers, workshops (the CI fortress guards it from the hills)' },
  news:       { name: 'NEWS',       rect: [114, 148, 62, 14], kind: 'news and alert bots' },
  mine:       { name: 'MINE',       rect: [2, 40, 54, 24],   kind: 'data and machine learning' },
  ruins:      { name: 'RUINS',      rect: [112, 45, 24, 37], kind: 'archived projects' },
});

/** Building slots (x, foot y), best place first. Each list belongs to one district. */
export const SLOTS = Object.freeze({
  automation: [[127, 126], [141, 126], [155, 126], [169, 126], [127, 141], [141, 141], [155, 141], [169, 141]],
  news:       [[127, 156], [141, 156], [155, 156], [169, 156]],
  knowledge:  [[20, 124], [46, 124], [20, 140], [46, 140]],
  personal:   [[20, 156], [46, 156]],
  village:    [[70, 124], [106, 124], [70, 140], [106, 140], [70, 156], [106, 156]],
  mine:       [[22, 62]],
  ruins:      [[120, 62], [125, 78]],
});
export const SLOT_DISTRICT = Object.freeze({ automation: 'automation', news: 'news', knowledge: 'knowledge', personal: 'personal', village: 'village', mine: 'mine', ruins: 'ruins' });

// which list a kind of repository prefers, and where it spills over to
const PREFER = { tower: 'automation', workshop: 'automation', library: 'knowledge', lab: 'knowledge', guild: 'personal', mine: 'mine', house: 'village', castle: 'village' };
// a full district sends its overflow to the closest kind of neighbour first
const SPILL = {
  news: ['automation', 'village', 'personal', 'knowledge'], automation: ['news', 'village', 'personal', 'knowledge'],
  knowledge: ['personal', 'village', 'automation', 'news'], personal: ['knowledge', 'village', 'automation', 'news'],
  village: ['personal', 'knowledge', 'automation', 'news'], mine: ['village', 'knowledge', 'personal', 'automation', 'news'],
};
const NEWS_RE = /news|signal|headline|alert|notif|telegram|rss|press|media|feed|broadcast/i;

/** The list a repository wants. News and alert bots (towers, or houses that read like news) go to the news district. */
export function wantedList(repo) {
  const text = `${repo.name || ''} ${repo.description || ''}`;
  if ((repo.archetype === 'tower' || repo.archetype === 'house') && NEWS_RE.test(text)) return 'news';
  return PREFER[repo.archetype] || 'village';
}

/** Which district a point is in (null when the point is in open country). */
export function districtAt(x, y) {
  for (const [id, d] of Object.entries(DISTRICTS)) {
    const [rx, ry, rw, rh] = d.rect;
    if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh && id !== 'castle') return id;
  }
  return null;
}

/**
 * Put every repository on the map. Pure and stable: the same repositories always land on the same slots.
 *  - the first castle-type repository is THE castle,
 *  - archived projects become ruins in the north-east hills (extra ones are reported as overflow, never lost),
 *  - the rest go to the district of their kind, strongest buildings first (landmarks in the back rows),
 *  - when a district is full the repository moves to the next district with a free slot.
 * Returns { castle, placed: [{ repo, x, y, list, district }], ruins, overflow, mine }
 */
export function assignRepos(repos) {
  const live = repos.filter((r) => r.state !== 'abandoned');
  const castle = live.find((r) => r.archetype === 'castle') || null;
  const rest = live.filter((r) => r !== castle).sort((a, b) => (b.evolution?.level || 1) - (a.evolution?.level || 1) || b.importance - a.importance || (normName(a.name) < normName(b.name) ? -1 : 1));
  const used = Object.fromEntries(Object.keys(SLOTS).map((k) => [k, 0]));
  const placed = [], overflow = [];
  const take = (list) => (used[list] < SLOTS[list].length ? SLOTS[list][used[list]++] : null);
  for (const r of rest) {
    const pref = wantedList(r);
    let slot = take(pref), list = pref;
    if (!slot) for (const alt of SPILL[pref] || SPILL.village) { slot = take(alt); if (slot) { list = alt; break; } }
    if (slot) placed.push({ repo: r, x: slot[0], y: slot[1], list, district: SLOT_DISTRICT[list] }); else overflow.push(r);
  }
  const archived = repos.filter((r) => r.state === 'abandoned');
  const ruins = archived.slice(0, SLOTS.ruins.length).map((r, i) => ({ repo: r, x: SLOTS.ruins[i][0], y: SLOTS.ruins[i][1], list: 'ruins', district: 'ruins' }));
  for (const r of archived.slice(SLOTS.ruins.length)) overflow.push(r);
  const mine = placed.find((q) => q.list === 'mine') || null;
  return { castle, placed, ruins, overflow, mine };
}

/** Roads and paths: [x1, y1, x2, y2, width]. */
export const ROADS = Object.freeze([
  [88, 88, 88, 210, 6],            // main road: castle to gate
  [14, 110, 166, 110, 5],          // cross road: west district to east district
  [31, 93, 31, 110, 4],            // hall steps and forecourt path
  [122, 94, 122, 110, 3],          // vault path
  [154, 90, 154, 110, 3],          // CI path
  [52, 110, 52, 121, 3],           // path to the hero's home
  [88, 192, 120, 192, 3],          // path to the camp
]);

// ---------------------------------------------------------------- hero routes
/** Walkable points. Hero routes follow these, so the hero is always somewhere on the map, never "teleported". */
export const NODES = Object.freeze({
  castle: [98, 97], castleRoad: [88, 97], plazaJ: [88, 110], plaza: [80, 114],
  eastJ: [154, 110], ci: [154, 99], vaultJ: [122, 110], vault: [122, 102],
  westJ: [31, 110], hall: [31, 108], homeJ: [52, 110], home: [52, 121],
  roadMid: [88, 146], bridge: [88, 164], farmJ: [88, 186], farm: [90, 190],
  gateJ: [88, 192], gate: [88, 195], campJ: [120, 192], camp: [130, 197],
});
export const EDGES = Object.freeze([
  ['castle', 'castleRoad'], ['castleRoad', 'plazaJ'], ['plazaJ', 'plaza'],
  ['plazaJ', 'eastJ'], ['eastJ', 'ci'], ['plazaJ', 'vaultJ'], ['vaultJ', 'vault'], ['vaultJ', 'eastJ'],
  ['plazaJ', 'westJ'], ['westJ', 'hall'], ['westJ', 'homeJ'], ['plazaJ', 'homeJ'], ['homeJ', 'home'],
  ['plazaJ', 'roadMid'], ['roadMid', 'bridge'], ['bridge', 'farmJ'], ['farmJ', 'farm'], ['farmJ', 'gateJ'],
  ['gateJ', 'gate'], ['gateJ', 'campJ'], ['campJ', 'camp'],
]);

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const ADJ = (() => { const m = {}; for (const [a, b] of EDGES) { (m[a] ||= []).push(b); (m[b] ||= []).push(a); } return m; })();

/** Shortest walk between two named nodes, as a list of [x, y] points. Dijkstra on a graph of 21 nodes. */
export function routeBetween(from, to) {
  if (!NODES[from] || !NODES[to]) return [NODES.plaza];
  const d = { [from]: 0 }, prev = {}, todo = new Set(Object.keys(NODES));
  while (todo.size) {
    let u = null;
    for (const k of todo) if (d[k] !== undefined && (u === null || d[k] < d[u])) u = k;
    if (u === null || u === to) break;
    todo.delete(u);
    for (const v of ADJ[u] || []) { const nd = d[u] + dist(NODES[u], NODES[v]); if (d[v] === undefined || nd < d[v]) { d[v] = nd; prev[v] = u; } }
  }
  const path = [to];
  while (path[0] !== from && prev[path[0]]) path.unshift(prev[path[0]]);
  return path.map((k) => NODES[k]);
}
export function routeLength(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += dist(pts[i - 1], pts[i]); return L; }

/** The point at fraction t (0..1) of a walk. Returns { x, y, dir } where dir is -1 (walking left) or 1. */
export function pointAlong(pts, t) {
  const total = routeLength(pts);
  if (pts.length === 1 || total === 0) return { x: pts[0][0], y: pts[0][1], dir: 1 };
  let want = Math.max(0, Math.min(1, t)) * total, dir = 1;
  for (let i = 1; i < pts.length; i++) {
    const seg = dist(pts[i - 1], pts[i]);
    if (pts[i][0] !== pts[i - 1][0]) dir = pts[i][0] > pts[i - 1][0] ? 1 : -1;
    if (want <= seg || i === pts.length - 1) {
      const f = seg ? Math.min(1, want / seg) : 1;
      return { x: Math.round((pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f) * 100) / 100, y: Math.round((pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f) * 100) / 100, dir };
    }
    want -= seg;
  }
  return { x: pts.at(-1)[0], y: pts.at(-1)[1], dir };
}

/** The district each landmark belongs to (semantic; buildings of repositories use the district of their slot). */
export const LANDMARK_DISTRICT = Object.freeze({ castle: 'castle', vault: 'castle', hall: 'knowledge', ci: 'automation', mine: 'mine', farm: 'village', camp: 'village', gate: 'castle' });

/** Foot band of a building at a slot: the strip it stands on (bodies rise to the north and may overlap what is behind them). */
export const footBand = (x, y) => [x - 6, y - 8, 12, 8];
