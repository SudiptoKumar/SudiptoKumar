# engine/simulation — snapshot contract (for the RENDERER agent)

`simulate(world, { timeBucket, inputs }) -> snapshot` (`simulate.mjs`).
The world is read-only; actor positions live in the snapshot, not the world.

## Snapshot fields

| field | type | notes |
|---|---|---|
| `version` | string | `SIM_VERSION` from the lock (currently `"3"`) |
| `timeBucket` | string | echo of the input bucket |
| `clock` | object | `{ band, season, weather, aurora }` — resolved band (9 day bands), season, gated weather (aurora only at sunset/night/deepnight), aurora flag |
| `actors` | array | ~55 entries: 25 named citizens + 22 ambient + 6 carts + hero + companion; sorted by `id` |
| `tasks` | array | construction / repair / harvest tasks; sorted by `id` |
| `war` | object | `{ state, phaseIndex, enemyCohort, barricades, damage, gates, guardsDeployed, scoutsDeployed, civilianShelter }` |
| `farm` | object | `{ cropState, maturity, harvestReady }` — `cropState`: fallow/planting/growing/harvest-ready |
| `effects` | array | transient fx, each `{ type, anchor, intensity, ttl }` |

## Actor entry (spec §07 §6 shape)

```js
{
  id,            // stable: "guard-aldric", "ambient-03", "cart-01", "hero", "companion"
  role,          // builder|farmer|guard|engineer|messenger|merchant|scholar|
                 // scout|smith|visitor|cart|citizen|child|elder|traveler|hero|companion
  homeAnchor, workAnchor,   // semantic anchors (lock §6)
  routeId,       // "fromNode>toNode" — real road-graph nodes; position lies on
                 // the routeBetween(fromNode, toNode) polyline, never off-road
  state,         // ACTOR_STATES / HERO_STATES (constants.mjs)
  x, y,          // integer world coords, ON the route polyline when moving
  facing,        // n|s|e|w from velocity
  task,          // human-readable current task
  progress,      // 0..1 progress along the current leg
  priority,      // event priority: war 100 > ci 90 > release 80 > achievement 70 >
                 // visitor 60 > harvest 55 > courier 50 > construction 40 > normal 20 > idle 0
                 // (courier: PR-signal messenger intensity, spec §06.2)
  seed,          // deterministic identity seed
  // hero only: name, destinationKind, destinationReason, gearTier
  // cart only: cargo
}
```

Hero destination priority: war → `war_front`, CI failure → `automation_fortress`,
release → `royal_plaza`, achievement → `hall_of_heroes`, visitor → `visitor_camp`,
quiet routine → `market_square`. `world.hero === null` → no hero/companion actors,
no crash.

## Task entry

```js
{ id, type, state, assignee?, plot?, anchor?, progress?, building?, lifecycle?, cause? }
// type: build | repair | harvest
// state: idle | assigned | collect-materials | travel | build | pause |
//        resume | complete | return   (spec §07 §13 builder lifecycle)
```

## War entry

- `state`: one of the 14 lock phases
  `PEACE→SCOUTING→THREAT_DETECTED→ALERT→MOBILIZATION→APPROACH→BATTLE→TURNING_POINT→VICTORY|DEFEAT→AFTERMATH→REPAIR→RECOVERY→RESOLVED→PEACE`
- `enemyCohort`: up to 8 `{ id, role:'enemy', x, y, facing, routeId }` (empty in peace)
- `barricades`: `{ id, node, x, y }` at war_front/watch_north/east_gate when fortified
- `damage`: `{ anchor, severity, detail }` — bucket-bounded visual damage, cleared by RECOVERY; never touches world structure
- `gates`: `{ main_gate, east_gate, west_gate }` — open|tightened|closed
- `effects`: war-specific fx (subset of top-level `effects`), e.g. smoke/fire in battle

## Effects

`{ type, anchor, intensity, ttl }`. Types: `banners`, `confetti`, `fireworks`,
`lanterns`, `smoke`, `fire`, `alarm`, `signal-fire`, `dust`, `debris`, `scaffolding`.
Celebration intensity follows the event phase machine: APPROACH 0.45, PEAK 1.0,
AFTERMATH 0.25. Quiet state (no events, PEACE): `effects: []`.

## Guarantees the renderer can rely on

1. **Deterministic**: same `(world.signature, timeBucket, inputs)` → byte-identical snapshot.
2. **On-road**: every moving actor's `(x, y)` lies on its `routeId` polyline; `routeId` endpoints are real road nodes.
3. **No teleports**: adjacent hourly buckets move actors continuously along chained itineraries (event-driven destination changes, e.g. war mobilization, are the only jumps).
4. **Quiet default**: no events + PEACE → daily life only, `effects: []`.
5. **Unknown inputs stay unknown**: missing `ciStatus` never invents a failure.
6. **Compact**: no SVG embedded; integer coords; arrays sorted by id.
