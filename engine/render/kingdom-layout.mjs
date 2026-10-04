// The map of the kingdom (V2). Grid: 176 x 240, one unit = 4 SVG units.
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
 * Returns { castle, placed: [{ repo, x, y, slot }], ruins: [...], overflow: [...] }
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
