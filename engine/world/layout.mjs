// The map of the kingdom (TRUE V2 world layer). Grid: 176 x 240, one unit = 4 SVG units.
//
//   y   0-50   sky
//   y  44-76   NORTH   mountains, the mine (west), the ruins of archived projects (east)
//   y  76-100  CENTER  the castle, the vault, the trophy shrine
//   y 106-158  WEST    library / research / workshops / shops    EAST   automation district: repository towers
//   y  60-100  EAST    the CI fortress in the north-east hills
//                      VILLAGE along the main road
//   y 160-166  the river (one bridge on the main road)
//   y 168-208  SOUTH   farm (west), visitor camp (east), the gate (centre)
//   y 212-240  UNDERGROUND   the issue dungeon (centre), the goblin outpost (east), gems (west)
//
// This file used to live at engine/render/kingdom-layout.mjs; that file is now a
// compatibility façade re-exporting everything from here.
import { normName } from '../util.mjs';

export const GW = 176, GH = 240, U = 4;
export const GROUND_Y = 212;           // surface ends here, the underground starts

export const L = {
  castle: [88, 86], vault: [54, 96], shrine: [119, 96], plaza: [88, 110], well: [88, 112],
  ci: [152, 88], mine: [22, 62], farm: [8, 170], camp: [138, 188], gate: [88, 208], pond: [22, 208],
  river: [160, 166],
};

// where the hero stands for each scene.hero.spot (top-left of the 12 x 16 sprite)
export const HERO_SPOT = {
  castle: [96, 84], plaza: [80, 100], farm: [44, 176], home: [62, 118], ci: [138, 84], gate: [80, 190], road: [84, 134], camp: [128, 176],
};

export const ROADS = [
  [88, 88, 88, 210, 6],           // main road: castle to gate
  [14, 110, 166, 110, 5],         // cross road: west district to east district
  [60, 178, 88, 178, 3],          // path to the farm
  [88, 192, 128, 192, 3],         // path to the camp
];

// building slots (x, foot y), best places first
export const SLOTS = {
  tower: [[127, 126], [141, 126], [155, 126], [169, 126], [127, 141], [141, 141], [155, 141], [169, 141], [127, 156], [141, 156], [155, 156], [169, 156]],
  library: [[20, 124], [46, 124]],
  lab: [[20, 140]],
  workshop: [[46, 140]],
  guild: [[20, 156], [46, 156]],
  mine: [[22, 62]],
  village: [[70, 124], [106, 124], [70, 140], [106, 140], [70, 156], [106, 156]],
  ruins: [[12, 92], [30, 98]],
};
// which list a kind of repository prefers, and where it spills over to
const PREFER = { tower: 'tower', library: 'library', lab: 'lab', workshop: 'workshop', guild: 'guild', mine: 'mine', house: 'village', castle: 'village' };
const SPILL = ['village', 'guild', 'library', 'lab', 'workshop', 'tower'];

/**
 * Put every repository on the map. Pure and stable: the same repositories always land on the same slots.
 *   - the first castle-type repository is THE castle (the big building in the middle),
 *   - archived projects become ruins in the north-east,
 *   - the rest go to the district of their kind, strongest buildings first (landmarks in the back rows),
 *   - when a district is full the repository moves to the village, then to any free slot.
 * Returns { castle, placed: [{ repo, x, y, list }], ruins: [...], overflow: [...] }
 */
export function assignRepos(repos) {
  const live = repos.filter((r) => r.state !== 'abandoned');
  const castle = live.find((r) => r.archetype === 'castle') || null;
  const rest = live.filter((r) => r !== castle).sort((a, b) => (b.evolution?.level || 1) - (a.evolution?.level || 1) || b.importance - a.importance || (normName(a.name) < normName(b.name) ? -1 : 1));
  const used = Object.fromEntries(Object.keys(SLOTS).map((k) => [k, 0]));
  const placed = [], overflow = [];
  const take = (list) => (used[list] < SLOTS[list].length ? SLOTS[list][used[list]++] : null);
  for (const r of rest) {
    const pref = PREFER[r.archetype] || 'village';
    let slot = take(pref), list = pref;
    if (!slot) for (const alt of SPILL) { slot = take(alt); if (slot) { list = alt; break; } }
    if (slot) placed.push({ repo: r, x: slot[0], y: slot[1], list }); else overflow.push(r);
  }
  const ruins = repos.filter((r) => r.state === 'abandoned').slice(0, SLOTS.ruins.length).map((r, i) => ({ repo: r, x: SLOTS.ruins[i][0], y: SLOTS.ruins[i][1], list: 'ruins' }));
  // a mine repository stands in the mountain, where the permanent mine is
  const mineRepo = placed.find((q) => q.repo.archetype === 'mine');
  return { castle, placed, ruins, overflow, mine: mineRepo || null };
}

// ---------------------------------------------------------------- TRUE V2: districts
// Named areas of the kingdom, [x0, y0, x1, y1] in grid units. Districts are areas of
// interest, not a partition: small overlaps are fine and stay stable forever.
export const DISTRICTS = {
  central:    { name: 'Central Kingdom',     bounds: [52, 72, 126, 164],  anchors: ['castle', 'vault', 'shrine', 'plaza', 'well'] },
  knowledge:  { name: 'Knowledge District',  bounds: [4, 106, 64, 162],   anchors: [] },
  automation: { name: 'Automation District', bounds: [128, 28, 176, 112], anchors: ['ci'] },
  project:    { name: 'Project District',    bounds: [112, 110, 176, 162], anchors: [] },
  farm:       { name: 'Farm District',       bounds: [2, 162, 84, 206],   anchors: ['farm'] },
  dungeon:    { name: 'Dungeon Defenses',    bounds: [36, 196, 140, 240],  anchors: ['gate'] },
  trophy:     { name: 'Trophy District',      bounds: [102, 76, 136, 104], anchors: ['shrine'] },
  visitor:    { name: 'Visitor District',    bounds: [110, 170, 172, 208], anchors: ['camp'] },
};
export const DISTRICT_IDS = Object.keys(DISTRICTS);
/** Which district a placed repository belongs to, from its slot list. */
const LIST_DISTRICT = { tower: 'project', library: 'knowledge', lab: 'knowledge', workshop: 'knowledge', guild: 'knowledge', mine: 'central', village: 'central', ruins: 'central' };
export const districtForSlot = (list) => LIST_DISTRICT[list] || 'central';
export const inBounds = ([x0, y0, x1, y1], x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

// ---------------------------------------------------------------- TRUE V2: camera rectangles
// World-coordinate rectangles each camera looks at. Cameras may crop or zoom;
// they must never move the world itself.
export const CAMERA_RECTS = {
  overworld: [0, 0, GW, GH],
  castle: [52, 48, 128, 128],
  project: [108, 106, 176, 166],
  farm: [0, 160, 88, 210],
  dungeon: [36, 194, 140, 240],
  visitor: [106, 166, 174, 212],
  // trophy_hall is an interior view anchored at the shrine; it has no map rectangle
};

// ---------------------------------------------------------------- TRUE V2: waypoints
// Named points on the road network for hero/NPC paths. Edges are walkable both ways.
export const WAYPOINTS = {
  castle: [88, 96], plaza: [88, 116], home: [62, 122], ci: [140, 100],
  farm: [52, 178], camp: [126, 190], gate: [88, 200],
  crossW: [20, 110], crossE: [150, 110], bridgeN: [88, 156], bridgeS: [88, 172],
};
export const PATHS = {
  castle: ['plaza'],
  plaza: ['castle', 'home', 'crossW', 'crossE', 'bridgeN'],
  home: ['plaza'],
  crossW: ['plaza', 'farm'],
  crossE: ['plaza', 'ci'],
  ci: ['crossE'],
  farm: ['crossW', 'bridgeS'],
  bridgeN: ['plaza', 'bridgeS'],
  bridgeS: ['bridgeN', 'farm', 'gate', 'camp'],
  gate: ['bridgeS'],
  camp: ['bridgeS'],
};
export const WAYPOINT_IDS = Object.keys(WAYPOINTS);
