// ONE canonical world. buildWorld(normalizedState, opts) is pure and
// deterministic: same input => byte-identical world. Cameras crop; they never
// invent. World building never depends on a camera.
import {
  WORLD_W, WORLD_H, TILE, VERSIONS, WORLD_SCHEMA_VERSION, SIM_VERSION,
  RENDER_VERSION, ART_VERSION, CAMERA_VERSION, ANIM_VERSION,
  WAR_PHASES, EVENT_PHASES, WEATHER, densityTier, POWER_TIERS,
} from './constants.mjs';
import { terrainRegions, RIVER_SEGMENTS, HARBOR_BAY, BRIDGES } from './map.mjs';
import { districts, districtsWithDensity } from './districts.mjs';
import { nodes, edges, routeBetween, reachableFrom } from './roads.mjs';
import { allPlots } from './plots.mjs';
import { placeBuildings } from './buildings.mjs';
import { buildEntities } from './entities.mjs';
import {
  dungeonPressure, fortressState, releaseEvents, farmState,
  hallEntries, visitorEntries, courierIntensity,
} from '../domain/mapping.mjs';
import { canonical, sha } from '../util.mjs';

/**
 * Build the canonical world from normalized domain state.
 * @param {object} state normalized state (engine/domain/state.mjs)
 * @param {object} opts {seed?, config?}
 * @returns {object} World JSON matching schemas/world-v3.schema.json
 */
export function buildWorld(state, opts = {}) {
  if (!state || typeof state !== 'object') throw new Error('buildWorld requires a normalized state object');
  const seed = String(opts.seed ?? state.seed ?? 'kingdom');
  const config = opts.config ?? {};

  const powerTier = POWER_TIERS.includes(state.kingdom?.powerTier) ? state.kingdom.powerTier : 'town';
  const events = collectEvents(state);
  const eventActive = events.some((e) => ['PEAK', 'APPROACH'].includes(e.phase) && e.severity !== 'routine');

  const districtList = districtsWithDensity(powerTier, eventActive);
  const density = densityTier(powerTier, eventActive);
  const nodeList = nodes();
  const edgeList = edges().map((e) => ({ id: e.id, from: e.from, to: e.to, via: e.via }));
  const plots = allPlots(seed, density);
  const repos = state.repos?.list ?? [];
  const visitorCount = (state.visitors?.list ?? []).length;
  const { buildings, overflow } = placeBuildings({ seed, repos, config, visitorCount, density });
  const { hero, companion, actors } = buildEntities(state, seed);

  const dungeon = dungeonPressure(state.issues?.open);
  const fortress = fortressState(state.ci?.status);
  const farm = farmState(state.contributions);
  const hall = hallEntries(state.achievements?.list);
  const visitors = visitorEntries(state.visitors?.list, { bannedWords: config.bannedWords });
  const couriers = courierIntensity(state.pullRequests); // PR signal -> courier network intensity

  const world = {
    version: WORLD_SCHEMA_VERSION,
    seed,
    map: {
      width: WORLD_W, height: WORLD_H, tile: TILE, projection: 'three-quarter-orthographic',
      terrain: terrainRegions(),
      river: { segments: RIVER_SEGMENTS, bay: HARBOR_BAY },
      bridges: BRIDGES,
    },
    districts: districtList,
    roads: { nodes: nodeList, edges: edgeList },
    plots: plots.map((p) => ({ ...p })),
    buildings,
    buildingOverflow: overflow,
    actors,
    hero,
    companion,
    // --- cause -> effect summaries (world data, not visuals) ---
    dungeon,
    fortress,
    farm,
    hall,
    visitors,
    couriers,
    events,
    war: { phase: WAR_PHASES.includes(state.war?.phase) ? state.war.phase : 'PEACE' },
    time: {
      phase: state.time?.phase ?? 'morning',
      season: state.time?.season ?? 'spring',
      weather: WEATHER.includes(state.time?.weather) ? state.time.weather : 'clear',
    },
    lighting: lightingPolicy(state),
    kingdom: {
      name: state.kingdom?.name ?? 'Kingdom',
      powerTier,
      density: densityTier(powerTier, eventActive),
    },
    versions: { ...VERSIONS },
    signature: '', // filled below
  };
  world.signature = worldSignature(world);
  return world;
}

/** Release + domain events become world events with lock anchors. */
function collectEvents(state) {
  const out = [];
  const { events } = releaseEvents(state.releases?.list);
  for (const e of events) {
    out.push({
      id: e.id, type: 'release', title: e.title,
      anchor: e.anchor, phase: e.phase, severity: 'celebration',
      fxIntensity: fxFor('ANNOUNCED'),
    });
  }
  for (const e of state.events?.list ?? []) {
    out.push({
      id: e.id, type: e.type, title: null,
      anchor: e.anchor ?? 'royal_plaza', phase: e.phase, severity: severityFor(e.type),
      fxIntensity: fxFor(e.phase),
    });
  }
  if ((state.war?.phase ?? 'PEACE') !== 'PEACE') {
    out.push({
      id: 'war', type: 'war', title: null, anchor: 'war_front',
      phase: 'PEAK', severity: 'war', warPhase: state.war.phase,
      fxIntensity: 1.0,
    });
  }
  return out;
}
const severityFor = (type) =>
  ({ war: 'war', raid: 'war', release: 'celebration', achievement: 'celebration', visitor: 'social', harvest: 'social' }[type] ?? 'routine');
const fxFor = (phase) => ({ ANNOUNCED: 0, APPROACH: 0.45, PEAK: 1.0, AFTERMATH: 0.25, RECOVERY: 0.1, RESOLVED: 0 }[phase] ?? 0);

/** Shared lighting policy flags (renderers consume; world owns the truth). */
function lightingPolicy(state) {
  const phase = state?.time?.phase ?? 'morning';
  const weather = WEATHER.includes(state?.time?.weather) ? state.time.weather : 'clear';
  const night = phase === 'night' || phase === 'deepnight';
  const dusk = phase === 'sunset' || phase === 'evening' || phase === 'dawn' || phase === 'predawn';
  return {
    band: phase,
    weather,
    aurora: weather === 'aurora' && (night || dusk), // never in day (lock §9)
    lampsOn: ['sunset', 'evening', 'night', 'deepnight'].includes(phase),
    snow: weather === 'snow',
  };
}

/**
 * worldSignature: canonical hash of the spatial facts cameras must agree on
 * (spec §14.4). Metadata invisible in the world is excluded to avoid churn.
 */
export function worldSignature(world) {
  const spatial = {
    v: world.version,
    districts: world.districts.map((d) => [d.id, d.rect.x, d.rect.y, d.rect.w, d.rect.h, d.density]),
    nodes: world.roads.nodes.map((n) => [n.id, n.x, n.y]),
    edges: world.roads.edges.map((e) => [e.id, e.from, e.to]),
    buildings: world.buildings.map((b) => [b.id, b.archetype, b.x, b.y, b.w, b.h, b.lifecycle, b.level]),
    actors: world.actors.map((a) => [a.id, a.role, a.x, a.y, a.state]),
    hero: world.hero ? [world.hero.x, world.hero.y, world.hero.state, world.hero.destination] : null,
    events: world.events.map((e) => [e.id, e.type, e.phase, e.anchor]),
    war: world.war?.phase,
    time: [world.time?.phase, world.time?.season, world.time?.weather],
    versions: world.versions,
  };
  return sha(canonical(spatial), 16);
}

/**
 * Content hash (spec §09.12): versions + input state signature + world
 * signature. Bumping any version forces a re-render.
 */
export function contentHash({ inputSignature, world }) {
  return sha(canonical({
    worldSchema: WORLD_SCHEMA_VERSION, sim: SIM_VERSION, render: RENDER_VERSION,
    art: ART_VERSION, camera: CAMERA_VERSION, anim: ANIM_VERSION,
    input: inputSignature ?? null,
    world: world?.signature ?? null,
  }), 16);
}

/** Byte-identical serialization of a world (for determinism tests / storage). */
export const serializeWorld = (world) => canonical(world);

export { routeBetween, reachableFrom };
