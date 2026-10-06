// TRUE V2 authoritative world (TRUE V2 §4).
//
//   GitHub/API data -> normalized state -> finalizeV2() -> buildWorld(state, ctx)
//     -> ONE authoritative World object -> camera renderers -> SVG/README
//
// buildWorld is pure and deterministic: the same finalized state always builds
// the same world. The world is derived, never persisted (see constants.mjs).
// Cameras are views into this object; they must never invent their own world.
import { WORLD_VERSION, RENDER_VERSION, powerTier } from './constants.mjs';
import { GW, GH, U, GROUND_Y, L, ROADS, DISTRICTS, DISTRICT_IDS, districtForSlot, assignRepos } from './layout.mjs';
import { CAMERAS, CAMERA_IDS } from './cameras.mjs';
import { lightingFor } from './lighting.mjs';
import { buildFarm } from './farm.mjs';
import { buildHall } from './hall.mjs';
import { buildCamp } from './camp.mjs';
import { buildHero } from './hero.mjs';
import { buildPopulation } from './population.mjs';
import { choreography, PHASE_FX } from './events.mjs';
import { EVENT_FX } from '../events.mjs';
import { lifecycleFor } from './lifecycle.mjs';
import { canonical, sha } from '../util.mjs';

/**
 * Build the one authoritative world from finalized state.
 * finalizeV2() calls this after the scene is built; renderers receive the world.
 */
export function buildWorld(S, ctx = {}) {
  const scene = S.scene || {};
  const time = S.time || {};
  const layout = assignRepos(S.repos || []);
  const lighting = lightingFor({ phase: time.phase, weather: S.weather, season: time.season, aurora: scene.weather?.aurora || 0 });

  // repositories as physical places: slot, coordinates, district, evolution
  const repositories = [
    ...(layout.castle ? [{ name: layout.castle.name, x: L.castle[0], y: L.castle[1], list: 'castle', district: 'central', castle: true }] : []),
    ...layout.placed.map((q) => ({ name: q.repo.name, x: q.x, y: q.y, list: q.list, district: districtForSlot(q.list) })),
    ...layout.ruins.map((q) => ({ name: q.repo.name, x: q.x, y: q.y, list: 'ruins', district: 'central', ruin: true })),
  ];
  const byName = new Map((S.repos || []).map((r) => [r.name, r]));
  for (const p of repositories) {
    const r = byName.get(p.name);
    p.archetype = r?.archetype || 'house';
    p.level = r?.evolution?.level || 1;
    p.evolutionName = r?.evolution?.name || '';
    p.state = r?.state || 'active';
    p.recovered = !!r?.recovered;
    p.workflow = r?.workflow || null;
    p.lifecycle = r ? lifecycleFor(r, scene.stages) : { key: 'active', level: 1, detail: null };
  }

  const events = (S.events?.active || []).map((e) => ({ ...e, ...choreography(e, ctx.now || new Date(S.generatedAt || 0)) }));
  // TRUE V2 (Phase 5): fx intensity by choreography phase. Each active fx gets the
  // highest intensity among the events producing it; renderers scale counts by this.
  const fxIntensity = {};
  for (const e of events) {
    const k = PHASE_FX[e.phase] ?? 0;
    for (const x of (EVENT_FX[e.type]?.fx || [])) fxIntensity[x] = Math.max(fxIntensity[x] || 0, k);
  }
  const power = S.power || { value: 0 };
  const camp = buildCamp(S);
  const SEV = { warning: 0, alarm: 1, smoke: 2, fire: 3 };
  const failStages = Object.values(scene.stages?.fail || {});
  const fortressStage = failStages.length ? failStages.sort((a, b) => SEV[b] - SEV[a])[0] : ((S.totals?.failingRepos || []).length ? 'fire' : 'ok');

  const world = {
    version: WORLD_VERSION,
    seed: `world:${S.profile?.login || 'anon'}`,
    time: { phase: time.phase || 'day', season: time.season || 'summer', weather: S.weather || 'clear', date: time.date || null },
    lighting,
    bounds: { w: GW, h: GH, u: U, groundY: GROUND_Y },
    districts: DISTRICT_IDS.map((id) => ({ id, ...DISTRICTS[id] })),
    anchors: { ...L },
    roads: ROADS,
    repositories,
    castle: layout.castle ? { name: layout.castle.name, x: L.castle[0], y: L.castle[1] } : null,
    farm: buildFarm(S, ctx.cfg),
    hall: buildHall(S),
    camp,
    fortress: { anchor: 'ci', failing: (S.totals?.failingRepos || []).slice(), health: S.totals?.workflowHealth ?? null, stage: fortressStage },
    dungeon: { anchor: 'gate', issues: S.totals?.issuesOpen || 0, tier: S.goblins?.tier || null },
    hero: buildHero(S, events),
    population: buildPopulation(S, layout),
    visitors: { total: S.visitors?.total || 0, plots: camp.plots },
    events,
    fxIntensity,
    quests: (S.quests?.list || []).map((q) => ({ ...q, anchor: questAnchor(q) })),
    power: { value: power.value, tier: powerTier(power.value).id, tierName: powerTier(power.value).name },
    raid: S.raid || null,
    scene: { mode: scene.mode || 'IDLE', frame: scene.frame || 0 },
  };
  world.signature = worldSignature(world);
  return world;
}

/** Quest -> world anchor. Phase 7 gives every quest a real world object; Phase 1 maps tracks to districts. */
function questAnchor(q) {
  const track = q.track || q.id?.split(':')[0];
  return { recover: 'ci', gate: 'gate', streak: 'farm', release: 'castle', build: 'project', stars: 'shrine', kingdom: 'plaza' }[track] || null;
}

/**
 * The world signature: a hash of every spatial fact cameras must agree on.
 * If two cameras were built from the same world, their signatures match; a
 * camera that invents its own positions breaks the signature.
 */
export function worldSignature(world) {
  const facts = {
    v: world.version,
    hero: [world.hero.x, world.hero.y, world.hero.state, world.hero.spot],
    repos: world.repositories.map((r) => [r.name, r.x, r.y, r.level, r.state, r.district]),
    farm: world.farm.plots.map((p) => [p.date, p.stage, p.gold ? 1 : 0]),
    hall: world.hall.trophies.map((t) => [t.id, t.unlocked ? 1 : 0]),
    camp: world.camp.plots.map((p) => [p.login, p.x, p.y]),
    districts: world.districts.map((d) => d.id),
    time: [world.time.phase, world.time.season, world.time.weather],
    lighting: [world.lighting.tint.color, world.lighting.tint.alpha, world.lighting.wash.alpha],
    events: world.events.map((e) => [e.type, e.phase]),
    power: [world.power.value, world.power.tier],
  };
  return sha(canonical(facts), 16);
}

export { WORLD_VERSION, RENDER_VERSION, CAMERAS, CAMERA_IDS };
export { powerTier };
