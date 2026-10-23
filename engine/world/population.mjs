// The people of the kingdom as entities (TRUE V2 phase 4): each has a role, a behaviour state, a place and (for walkers) a route.
// The roster (how many of each) is decided by data in scene.mjs; this file decides what they DO, from the time of day, the weather and the running stories.
//
//   IDLE  WORKING  WALKING  RESTING  SLEEPING  FIGHTING  CELEBRATING  FLEEING
import { ANCHORS } from './layout.mjs';
import { CAMP_CENTER } from './camp.mjs';
import { clamp } from './constants.mjs';

export const NPC_STATES = Object.freeze(['IDLE', 'WORKING', 'WALKING', 'RESTING', 'SLEEPING', 'FIGHTING', 'CELEBRATING', 'FLEEING']);
export const STALL_SPOTS = Object.freeze([[68, 118], [108, 118], [78, 121], [98, 121]]);
/** Where a crowd stands: offsets around a centre, nearest to the viewer last (so nobody hides behind anybody). */
export const CROWD = Object.freeze([[-4, -3], [4, -3], [0, -4], [-8, -1], [8, -1], [-12, 1], [12, 1], [-6, 2], [6, 2], [0, 3], [-10, 4], [10, 4]]);
const VILLAGE_PATHS = Object.freeze([[86, 96, 0, 100], [16, 111, 140, 0], [90, 102, 0, 60], [90, 191, 34, 0]]);   // [x, y, dx, dy]

const CROWD_AT = { hall: [ANCHORS.hall.x, ANCHORS.hall.y + 14], farm: [66, 196], vault: [ANCHORS.vault.x, 109], gate: [88, 186], ci: [ANCHORS.ci.x, 107] };
const crowdCentre = (where) => CROWD_AT[where?.anchor] || [88, 103];

export function buildNpcs(S, W) {
  const sc = S.scene, n = sc.npcs, beh = sc.behavior, raid = S.raid || {}, ts = W.kingdom.tier.style, layout = W.layout, ph = sc.phases || [];
  const out = []; let seq = 0;
  const add = (role, state, x, y, o = {}) => { out.push({ id: `n${seq++}`, role, state, x, y, ...o }); return out.at(-1); };
  const P = (type) => ph.find((p) => p.type === type);
  const libs = layout.placed.filter((q) => q.repo.archetype === 'library'), labs = layout.placed.filter((q) => q.repo.archetype === 'lab');
  const houses = [...layout.placed.filter((q) => q.list === 'village'), ...layout.placed.filter((q) => q.list !== 'village' && q.list !== 'mine')];   // homes: the village first, then wherever people live
  const keep = (i, total) => !beh.shelter || i < Math.ceil(total * 0.35);          // in rain only a few are out
  const brolly = (i) => (beh.shelter && i % 2 === 0 ? { top: 'umbrella', tone: i % 4 } : {});
  const stalls = Math.min(STALL_SPOTS.length, ts.stalls);
  const rel = P('release'), ms = P('milestone'), hv = P('harvest');
  const party = [rel, ms].find((p) => p && (p.phase === 'peak' || p.phase === 'aftermath'));
  const gathering = rel?.phase === 'start' || ms?.phase === 'start';
  const raidStart = raid.active && raid.phase === 'enter', raidBattle = raid.active && raid.phase !== 'enter';
  const emergency = ph.filter((p) => p.type === 'emergency'), recovery = ph.filter((p) => p.type === 'recovery' && p.phase !== 'aftermath');

  if (beh.home) {
    // night or a quiet kingdom: people are indoors, a few sleep beside their doors, guards patrol
    houses.slice(0, 3).forEach((q) => add('sleeper', 'SLEEPING', q.x + 9, q.y + 1));
    if (!raid.active) { add('guard', 'WALKING', 56, 206, { dx: 48, t: 22 }); add('guard', 'WALKING', 66, 112, { dx: 40, t: 26, delay: 6 }); }
  } else {
    const V = clamp(Math.round(n.villager * ts.villagers), 1, 14), count = sc.phase === 'dawn' ? Math.ceil(V / 2) : V;
    let crowd = 0;
    const crowdMax = party ? (party.type === 'milestone' ? 4 : 8) : 0, [ccx, ccy] = crowdCentre(party?.where);
    for (let i = 0; i < count; i++) {
      if (!keep(i, count)) continue;
      const role = ['villager', 'villager2', 'villager3'][i % 3];
      if (party && crowd < crowdMax) { const [ox, oy] = CROWD[crowd++]; add(role, party.phase === 'peak' ? 'CELEBRATING' : 'RESTING', ccx + ox, ccy + oy); continue; }
      if (raidStart || raidBattle) { if (i < 5) add(role, 'FLEEING', 90 + (i % 3) * 3, 150 + i * 4, { dy: -48, t: 7, delay: i, top: 'alert' }); continue; }
      if (gathering && i < 6) { add(role, 'WALKING', 90 + (i % 3) * 3, 132 + i * 2, { dy: -30, t: 10, delay: i * 2 }); continue; }
      const [x, y, dx, dy] = VILLAGE_PATHS[i % 4];
      add(role, 'WALKING', x + (dx ? i * 3 : (i % 2) * 4), y, { dx, dy, t: Math.max(10, Math.round(Math.max(dx, dy) / 3)), delay: (i * 4) % 11, ...brolly(i) });
    }
    for (let i = 0; i < n.merchant; i++) {
      if (party && crowd < crowdMax && i === 0) { const [ox, oy] = CROWD[crowd++]; add('merchant', party.phase === 'peak' ? 'CELEBRATING' : 'RESTING', ccx + ox, ccy + oy); }
      else if (i < stalls) add('merchant', raid.active ? 'RESTING' : 'WORKING', STALL_SPOTS[i][0] + 2, STALL_SPOTS[i][1] + 2);
      else if (!raid.active) add('merchant', 'WALKING', 66 + (i - stalls) * 14, 114, { dx: 22, t: 18, delay: i * 3 });
    }
    libs.slice(0, n.librarian).forEach((q) => add('librarian', 'WORKING', q.x + 12, q.y));
    for (let i = 0; i < n.researcher; i++) { const q = labs[i] || libs[i] || houses[i]; if (q) add('researcher', 'WORKING', q.x + 11, q.y); }
    for (let i = 0; i < n.miner; i++) add('miner', 'WALKING', 12 + i * 4, 63.5, { dx: 9, t: 9, delay: i * 3 });
    if (!beh.farmersIn && !raid.active) for (let i = 0; i < n.farmer; i++) {
      if (hv && hv.phase !== 'start') add('farmer', hv.phase === 'peak' ? 'CELEBRATING' : 'RESTING', 24 + i * 12 + (i > 1 ? 14 : 0), 197);
      else add('farmer', 'WALKING', i % 2 ? 56 : 24, 197, { dx: i % 2 ? 24 : 18, t: 20 + i * 2, delay: i * 5 });
    }
    for (let i = 0; i < n.messenger; i++) if (keep(i, n.messenger) && !raid.active) add('messenger', 'WALKING', 20 + i * 8, 111, { dx: 128 - i * 10, t: 11, delay: i * 4 });
    for (let i = 0; i < Math.min(3, S.totals.forks); i++) add('traveler', 'WALKING', 90 + i * 4, 191 + (i % 2) * 2, { dx: 30, t: 16, delay: i * 5 });
    const v = sc.stages.visitor;
    if (v?.stage === 'arriving') add('traveler', 'WALKING', 92, 191, { dx: 34, t: 9, top: 'flag' });
    else if (v?.stage === 'camping') add('visitor', 'RESTING', CAMP_CENTER[0] - 9, CAMP_CENTER[1] + 9);
    // the workflow is red: guards and builders run to the fortress with buckets; once it is green again a crew repairs it
    if (emergency.length) { const alarm = emergency.some((e) => e.phase === 'peak'); for (let i = 0; i < (alarm ? 2 : 1); i++) add('guard', 'WALKING', 100 + i * 4, 111, { dx: 48, t: 9, delay: i * 3, top: 'bucket' }); if (alarm) for (let i = 0; i < 2; i++) add('builder', 'WALKING', 104 + i * 5, 112, { dx: 46, t: 9, delay: 1 + i * 3, top: 'bucket' }); }
    else if (recovery.length) for (let i = 0; i < 2; i++) add('builder', 'WORKING', 146 + i * 14, 101);
  }

  // guards: always at the gate (more of them with open issues); they fight in a raid, celebrate a won one, and run from a lost one
  const gx = ANCHORS.gate.x, gate = [gx - 14, gx + 14, gx - 22, gx + 22, gx - 8, gx + 8, gx - 30, gx + 30];
  const won = sc.stages.raid === 'won', lost = sc.stages.raid === 'lost';
  const away = emergency.length ? (emergency.some((e) => e.phase === 'peak') ? 2 : 1) : 0;        // those guards are running to the CI
  for (let i = 0; i < Math.min(n.guard, 8) - (beh.home && !raid.active ? 0 : away); i++) {
    if (beh.home && !raid.active && i < 2) continue;
    const x = gate[i], y = raidBattle ? 200 : 207;
    const state = raidBattle ? 'FIGHTING' : raidStart ? 'WALKING' : won ? 'CELEBRATING' : lost ? 'FLEEING' : (S.totals.issuesOpen || 0) > 0 ? 'WORKING' : 'IDLE';
    add('guard', state, x, y, state === 'WALKING' ? { dx: 6, t: 3, delay: i } : state === 'FLEEING' ? { dy: -40, t: 7, delay: i, top: 'alert' } : {});
  }
  return out;
}
