// TRUE V2 population model. NPCs are deterministic world entities: every NPC has
// a role, a home, a state and a real position. Counts come from the scene roster
// (real numbers); positions are stable functions of the role and index, so the
// same world always places the same people on the same stones.
import { L, assignRepos } from './layout.mjs';

const ROLE_HOME = {
  builder: 'construction sites', farmer: 'farm', miner: 'mine', guard: 'gate',
  merchant: 'plaza', librarian: 'library', researcher: 'lab', messenger: 'road', villager: 'village',
};

/** NPC state for a role, from the world's behavior. Only canonical states. */
function stateFor(role, S) {
  const b = S.scene?.behavior || {};
  const modes = S.scene?.modes || [];
  const celebrating = modes.includes('CELEBRATION') || modes.includes('HARVEST');
  if (role === 'guard') return S.raid?.active ? 'fighting' : 'working';
  if (b.home) return 'resting';                                   // night or a quiet kingdom: indoors
  if (role === 'farmer' && b.farmersIn) return 'resting';
  if (b.shelter) return 'resting';                               // rain: under cover
  if (role === 'villager' || role === 'messenger') return S.raid?.active ? 'fleeing' : 'walking';
  if (celebrating && role !== 'miner') return 'celebrating';
  return 'working';
}

/**
 * Place every NPC of the roster. `layout` is the assignRepos() result.
 * Pure and deterministic.
 */
export function placeNpcs(S, layout) {
  const counts = S.scene?.npcs || {};
  const lay = layout || assignRepos(S.repos || []);
  const libs = lay.placed.filter((q) => q.repo.archetype === 'library');
  const labs = lay.placed.filter((q) => q.repo.archetype === 'lab');
  const houses = lay.placed.filter((q) => q.list === 'village');
  const building = lay.placed.filter((q) => q.repo.state === 'building');
  const gx = L.gate[0];
  const gateX = [gx - 14, gx + 14, gx - 22, gx + 22, gx - 8, gx + 8, gx - 30, gx + 30];
  const out = [];
  const push = (role, i, x, y) => out.push({ id: `${role}:${i}`, role, home: ROLE_HOME[role], x, y, state: stateFor(role, S) });

  for (let i = 0; i < (counts.builder || 0); i++) {
    const q = building[i % Math.max(1, building.length)];
    if (q) push('builder', i, q.x - 8, q.y);
    else if (houses.length) { const h = houses[i % houses.length]; push('builder', i, h.x + 9, h.y); }
    else push('builder', i, 80 + (i % 3) * 4, 116);
  }
  for (let i = 0; i < (counts.farmer || 0); i++) push('farmer', i, 10 + (i % 3) * 22, i % 2 ? 192 : 204);
  for (let i = 0; i < (counts.miner || 0); i++) push('miner', i, 12 + i * 4, 70);
  for (let i = 0; i < Math.min(counts.guard || 0, 8); i++) push('guard', i, gateX[i], S.raid?.active ? 200 : 207);
  for (let i = 0; i < (counts.merchant || 0); i++) {
    if (i === 0) push('merchant', i, 70, 120);
    else if (i === 1) push('merchant', i, 106, 120);
    else push('merchant', i, 72 + i * 4, 114);
  }
  for (let i = 0; i < (counts.librarian || 0); i++) {
    const q = libs[i % Math.max(1, libs.length)] || houses[i % Math.max(1, houses.length)];
    push('librarian', i, q ? q.x + 12 : 60 + i * 4, q ? q.y : 116);
  }
  for (let i = 0; i < (counts.researcher || 0); i++) {
    const q = labs[i] || libs[i] || houses[i] || null;
    push('researcher', i, q ? q.x + 11 : 64 + i * 4, q ? q.y : 116);
  }
  for (let i = 0; i < (counts.messenger || 0); i++) push('messenger', i, 20 + i * 8, 111);
  for (let i = 0; i < (counts.villager || 0); i++) {
    if (houses.length) { const q = houses[i % houses.length]; push('villager', i, q.x + 9 + (i % 2) * 4, q.y + 1); }
    else push('villager', i, 86 + (i % 4) * 3, 96);
  }
  return out;
}

/** Build the population model: counts, density, and every placed NPC. */
export function buildPopulation(S, layout = null) {
  const counts = { ...(S.scene?.npcs || {}) };
  const total = Object.values(counts).reduce((a, n) => a + (n || 0), 0);
  return {
    total, counts,
    density: total < 8 ? 'quiet' : total < 16 ? 'lively' : 'bustling',
    npcs: placeNpcs(S, layout),
  };
}
