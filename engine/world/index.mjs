// buildWorld: the one shared model of the kingdom. Pure and deterministic: the same saved state always gives the same world.
// It is derived, never saved. Every camera, every overlay and every test reads it. Each section is guarded, so a failure in one part
// of the model degrades that part to safe defaults instead of taking the whole README down.
import { GW, GH, U } from './constants.mjs';
import { ANCHORS, assignRepos, routeBetween, pointAlong } from './layout.mjs';
import { repoLifecycle, repoNeglect, kingdomTier } from './lifecycle.mjs';
import { lightingFor } from './lighting.mjs';
import { buildFarm } from './farm.mjs';
import { buildHall } from './hall.mjs';
import { buildCamp } from './camp.mjs';
import { h32 } from './hash.mjs';
import { castleTier } from '../rules.mjs';
import { buildNpcs } from './population.mjs';
import { phaseSignature } from './phases.mjs';
import { questTargets } from './quests.mjs';

const FALLBACK_LIGHT = { phase: 'day', weather: 'clear', intensity: 1, tint: [null, 0], veil: 0, aurora: 0, windows: false, torches: false, moon: false, sunrise: false, accent: null, gold: false, gate: false, spots: [], danger: [], sig: 'day:1:clear:0:-:000' };
const EMPTY_LAYOUT = { castle: null, placed: [], ruins: [], overflow: [], mine: null };

export function buildWorld(S, { cfg = {} } = {}) {
  const errors = [];
  const safe = (name, fn, fallback) => { try { return fn(); } catch (e) { errors.push(`${name}: ${e.message}`); return fallback; } };
  const scene = S.scene || {};

  const layout = safe('layout', () => assignRepos(S.repos || []), EMPTY_LAYOUT);
  const tier = safe('tier', () => kingdomTier(S.power?.value), kingdomTier(0));
  const lighting = safe('lighting', () => lightingFor(S, layout), FALLBACK_LIGHT);

  const stages = scene.stages || { fail: {}, repair: {}, build: {} };
  const index = new Map((S.repos || []).map((r, i) => [r, i]));
  const rec = (q) => ({
    id: `r${index.get(q.repo)}`, obj: q.list === 'castle' ? 'castle' : q.list === 'mine' ? 'mine' : `r${index.get(q.repo)}`, name: q.repo.name, kind: q.repo.archetype, district: q.district, list: q.list, x: q.x, y: q.y,
    level: q.repo.evolution?.level || 1, state: q.repo.state, lifecycle: repoLifecycle(q.repo), neglect: repoNeglect(q.repo),
    story: { fail: stages.fail?.[q.repo.name] || null, repair: stages.repair?.[q.repo.name] || null, build: stages.build?.[q.repo.name] || null },
  });
  const repos = safe('repos', () => {
    const out = [...layout.placed, ...layout.ruins].map(rec);
    if (layout.castle) out.unshift(rec({ repo: layout.castle, x: ANCHORS.castle.x, y: ANCHORS.castle.y, list: 'castle', district: 'castle' }));
    return out;
  }, []);

  const farm = safe('farm', () => buildFarm(S, cfg), { plots: [], total: 0, streak: 0, sig: '0', cols: 26, rows: 7 });
  const hall = safe('hall', () => buildHall(S), { pedestals: [], count: 0, total: 0, sig: '0' });
  const camp = safe('camp', () => buildCamp(S, cfg), { state: 'EMPTY', total: 0, visitors: [], huts: 0, fires: 1, bunting: false, stage: null, sig: '0' });

  // the hero: at the place of his routine or of the story. While the story STARTS he is on the road between the two (scene.hero.from / t)
  const hero = safe('hero', () => placeHero(scene, layout), { state: 'idle', spot: 'plaza', x: ANCHORS.plaza.stand[0], y: ANCHORS.plaza.stand[1], face: 1, umbrella: false, route: null, t: null });
  const events = safe('events', () => (scene.phases || []).map((p) => ({ ...p, at: eventPlace(p, layout) })), []);

  const world = {
    v: 1, bounds: { w: GW, h: GH, u: U },
    time: { phase: S.time?.phase || 'day', season: S.time?.season || 'summer', date: S.time?.date || '', hour: S.time?.hour ?? 12 },
    weather: scene.weather || { kind: 'clear' },
    lighting, kingdom: { power: tier.value, tier, castleTier: safe('castleTier', () => castleTier(S.level || 1), 1) },
    layout, repos, anchors: ANCHORS, farm, hall, camp, hero, events, errors,
  };
  world.npcs = safe('npcs', () => buildNpcs(S, world), []);
  world.quests = safe('quests', () => questTargets(S, layout), []);
  world.sig = worldSignature(world);
  return world;
}

/** One short string that changes whenever anything that every camera must agree on changes. */
export function worldSignature(w) {
  return h32([
    w.time.season, w.time.phase, w.weather.kind, w.lighting.sig, w.kingdom.tier.id, `${w.hero.state}@${w.hero.x},${w.hero.y}`,
    w.farm.sig, w.hall.sig, w.camp.sig, w.repos.map((r) => `${r.id}${r.x},${r.y}${r.lifecycle}${r.level}`).join(';'),
    phaseSignature(w.events), (w.npcs || []).map((n) => `${n.role}${n.state}${n.x},${n.y}`).join(';'), (w.quests || []).map((q) => `${q.id}@${q.x},${q.y}`).join(';'),
  ].join('|'));
}

// ---------------------------------------------------------------- hero place and route
const NODE_OF = { castle: 'castle', plaza: 'plaza', ci: 'ci', farm: 'farm', gate: 'gate', home: 'home', camp: 'camp', hall: 'hall', vault: 'vault', road: 'roadMid' };

/** The building the hero works at when the project is busy: the freshest, strongest building (stands in front of it). */
export function districtSpot(layout) {
  const q = [...layout.placed].filter((x) => x.list !== 'mine').sort((a, b) => (b.repo.state === 'building') - (a.repo.state === 'building') || b.repo.importance - a.repo.importance)[0];
  return q ? [q.x, Math.min(q.y + 3, 158)] : ANCHORS.plaza.stand;
}
const spotPoint = (spot, layout) => (spot === 'district' ? districtSpot(layout) : (ANCHORS[spot] || ANCHORS.plaza).stand);

/** The walk between two spots along the roads (a list of points). */
export function spotRoute(from, to, layout) {
  const nodeA = from === 'district' ? 'plazaJ' : NODE_OF[from] || 'plaza', nodeB = to === 'district' ? 'plazaJ' : NODE_OF[to] || 'plaza';
  let r = routeBetween(nodeA, nodeB);
  if (from === 'district') r = [districtSpot(layout), ...r];
  if (to === 'district') r = [...r, districtSpot(layout)];
  return r;
}

function placeHero(scene, layout) {
  const h = scene.hero || {}, state = h.state || 'idle';
  const spot = state === 'sleeping' ? 'home' : h.spot === 'district' || ANCHORS[h.spot] ? h.spot : 'plaza';
  const umbrella = !!h.umbrella;
  if (state === 'walking' && h.from) {
    const route = spotRoute(h.from, spot, layout), q = pointAlong(route, h.t ?? 0);
    return { state, spot, x: q.x, y: q.y, face: q.dir, umbrella, route, t: Math.round((h.t ?? 0) * 100) / 100, from: h.from };
  }
  const [x, y] = spotPoint(spot, layout);
  return { state, spot, x, y, face: 1, umbrella, route: null, t: null, from: null };
}

function eventPlace(p, layout) {
  const w = p.where || {};
  if (w.repo) { const q = [...layout.placed, ...layout.ruins].find((x) => x.repo.name === w.repo); if (q) return { x: q.x, y: q.y }; }
  if (w.anchor && ANCHORS[w.anchor]) return { x: ANCHORS[w.anchor].x, y: ANCHORS[w.anchor].y };
  return null;
}
