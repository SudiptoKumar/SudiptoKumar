# engine/world — API contract

The canonical world model. **One world, one truth:** every renderer, camera,
and the simulation read from the object `buildWorld` returns. Nothing here
depends on a camera, and no camera may invent coordinates.

All geography (bounds 2048×1536, 19 districts, 34 road nodes, 37 edges,
versions, budgets) is loaded from `data/world-lock.json` via
`constants.mjs` — never re-typed.

## Entry points

```js
import { buildWorld, worldSignature, contentHash, serializeWorld,
         routeBetween, reachableFrom } from './world.mjs';
```

### `buildWorld(normalizedState, opts?) -> world`

Pure + deterministic. `normalizedState` comes from
`engine/domain/state.mjs` (`buildNormalizedState`); `opts = { seed?, config? }`
(seed defaults to `state.seed`).

The returned `world`:

| field | contents |
|---|---|
| `version` | `"3"` (WORLD_SCHEMA_VERSION, string per schema) |
| `seed` | world seed string |
| `map` | `{ width, height, tile, projection, terrain[], river, bridges[] }` |
| `districts` | 19 districts: `{ id, rect{x,y,w,h}, purpose, anchors[], density }` |
| `roads` | `{ nodes: [{id,x,y}], edges: [{id,from,to,via}] }` |
| `plots` | plot grid: `{ id, district, cx, cy, w, h, roadAccess, facing, allowedArchetypes, elevation, reserved }` |
| `buildings` | `{ id, source, archetype, district, plot?, x, y, w, h, facing, level, lifecycle, health, activity, workers, variant }` |
| `actors` | `{ id, role, home, workplace, routeId, state, task, x, y, facing, progress, seed }` |
| `hero` | hero object or `null` (graceful absence) |
| `companion` | companion object or `null` |
| `dungeon/fortress/farm/hall/visitors` | cause→effect summaries from `engine/domain/mapping.mjs` |
| `events` | `{ id, type, title, anchor, phase, severity, fxIntensity }` |
| `war` | `{ phase }` — one of the 13 lock war phases |
| `time` | `{ phase, season, weather }` — 9 day bands, 4 seasons |
| `lighting` | `{ band, weather, aurora, lampsOn, snow }` policy flags |
| `kingdom` | `{ name, powerTier, density }` |
| `versions` | all six versions from the lock |
| `signature` | `worldSignature(world)` — filled in by the builder |

Matches the required-field subset of `spec/schemas/world-v3.schema.json`
(checked by `engine/validation/schema.mjs` → `validateWorldSchema`).

### `worldSignature(world) -> string`

16-hex-char canonical hash of the spatial facts cameras must agree on:
districts, road graph, buildings, actors, hero, events, war, time, versions.
Metadata invisible in the world is excluded to avoid churn.

### `contentHash({ inputSignature, world }) -> string`

Spec §09.12: versions + input state signature + world signature. Bump any
version → every asset re-renders.

### `serializeWorld(world) -> string`

Byte-identical JSON (deep-sorted keys) for storage / determinism tests.

### `routeBetween(fromId, toId) -> [{x,y}, ...] | null`

Shortest named-edge path as absolute waypoints (re-export from `roads.mjs`).
NPC movement uses this — never straight lines.

## Module map

| module | exports |
|---|---|
| `constants.mjs` | `LOCK`, `WORLD_W/H`, `TILE`, `VERSIONS`, `BUDGETS`, `ARCHETYPES`, `BUILDING_LIFECYCLE` (11 states), `DAY_BANDS` (9), `SEASONS`, `WEATHER`, `WAR_PHASES` (13), `EVENT_PHASES` (6), `POWER_TIERS`, `densityTier()`, `HERO_STATES`, `ACTOR_STATES`, `HERO_DESTINATION_PRIORITY`, geometry helpers |
| `map.mjs` | `terrainRegions()`, `isWater(x,y)`, `isMountain(x,y)`, `expansionReserves()`, `RIVER_SEGMENTS`, `HARBOR_BAY`, `BRIDGES` |
| `districts.mjs` | `districts()`, `districtById()`, `districtAt(x,y)`, `allAnchors()`, `anchorById()`, `districtsWithDensity(powerTier, eventActive)` |
| `roads.mjs` | `nodes()`, `nodeById()`, `edges()`, `edgePath()`, `reachableFrom()`, `routeBetween()`, `nearestNode()`, `distanceToRoad()` |
| `plots.mjs` | `generatePlots(districtId, seed)`, `allPlots(seed)`, `plotsOverlap()`, `plottableDistricts()` |
| `buildings.mjs` | `footprintOf(archetype)`, `placeBuildings({seed, repos, config, visitorCount})` → `{ buildings, plots, overflow }`, `placeRepoBuildings()`, `placeAmbientBuildings()` |
| `entities.mjs` | `buildEntities(state, seed)` → `{ hero, companion, actors }`, `heroDestination(state)`, `stateForBand(role, band)` |
| `world.mjs` | `buildWorld()`, `worldSignature()`, `contentHash()`, `serializeWorld()` |

## Domain (cause → effect)

`engine/domain/mapping.mjs` — pure mappers, `unknown` never coerced:

- `archetypeOf(repo, config)` → `{ archetype, reason: 'config'|'keyword'|'fallback', flavor }`
- `dungeonPressure(openIssues, thresholds?)` → `{ tier: dormant|watchful|active|crowded|crisis|unknown, count, goblins }`
- `fortressState(ciStatus)` → `{ state: healthy|warning|failing|recovering|unknown, beacon, smoke, alarm, engineers }`
- `releaseEvents(releases)` → royal-announcement descriptors at `royal_plaza`
- `farmState(contributions)` → `{ maturity, activeFields, streakMarker }`
- `hallEntries(achievements)` → statues/banners/plaques/trophies/monuments
- `visitorEntries(visitors)` → sanitized harbor→camp entries
- `buildingLifecycleFor(repo, signals)` → one of the 11 lifecycle states
- `applyPartialFailure(section, { lastKnown })` → last-known or neutral

`engine/domain/state.mjs` — `buildNormalizedState({ snap, config, prev, now })`:
per-section failure isolation for GitHub ingestion.

## Validation

`engine/validation/`:

- `safety.mjs` — `lintSvg(svg, {maxBytes})`, `sanitizeMessage()`, `checkAvatarBytes()`, `esc`
- `world-invariants.mjs` — `checkWorldInvariants(world)` → problems[] (bounds, unique ids, one castle, no overlaps, road reachability, hero destinations connected, district road connections, anchor connectivity, plot rules)
- `schema.mjs` — `validateWorldSchema()`, `validateSimulationSchema()` (hand-rolled, no deps)
- `visual-budget.mjs` — `checkSvgBudget()`, `checkReadmeBudget()`

## Determinism contract

- No `Math.random()` / `Date.now()` in world math (enforced by `npm run lint`).
- Every random stream: `rng("world:" + seed + ":" + subsystem)` via `subRng()`.
- Same input ⇒ byte-identical world ⇒ identical `world.signature`.
