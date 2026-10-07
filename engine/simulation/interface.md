# Simulation Interface Contract (SIMULATION agent)

This is the contract between the **World** layer (`engine/world/`) and the
**Simulation** layer you will implement. The world is built and frozen first;
simulation reads it and never mutates it.

## Function

```js
simulate(world, { timeBucket, inputs }) -> snapshot
```

- `world`: the object returned by `buildWorld(normalizedState)` — see
  `engine/world/README.md`. Treat it as **read-only**. Do not add, move, or
  remove districts, roads, buildings, plots, or anchors.
- `timeBucket`: an opaque string identifying the simulation tick, e.g.
  `"2026-10-07T06:00:06+06:00"` or `"demo-night"`. It is part of every
  deterministic RNG seed: `rng("sim:" + timeBucket + ":" + actorId)`.
- `inputs`: live-ish signals for this tick:
  `{ events: [...], warPhase, ciStatus, releases: [...] }` — the same shapes
  the world builder consumes (see `engine/domain/state.mjs`).

## Returns: snapshot

Must validate against `spec/schemas/simulation-v3.schema.json`
(required subset enforced by `engine/validation/schema.mjs` →
`validateSimulationSchema`):

```js
{
  version: "3",                 // SIM_VERSION, string
  timeBucket,                   // echo of the input bucket
  actors: [                     // one entry per world actor (+ hero), updated
    { id, role?, state, x, y, facing?, task?, progress? }
    // state: one of ACTOR_STATES / HERO_STATES (engine/world/constants.mjs)
    // x, y: world coords — actors move ALONG road edges (routeBetween),
    //       never in straight lines across districts
  ],
  tasks: [                      // construction / repair / delivery work
    { id, type, state, assignee?, plot?, progress? }
    // type: 'build' | 'repair' | 'deliver' | 'patrol' | 'harvest' | ...
    // state: 'idle' | 'assigned' | 'collect-materials' | 'travel'
    //        | 'build' | 'complete' | 'return'  (lock §6 builder lifecycle)
  ],
  war: {                        // 13-phase machine (lock §8)
    state,                      // one of WAR_PHASES (constants.mjs)
    // ... phase-specific detail (cohort positions, damage, barricades)
  },
  effects: [                    // transient visual consequences
    { type, anchor?, intensity?, ttl? }
    // type: 'smoke' | 'fire' | 'confetti' | 'fireworks' | 'banners' | ...
    // intensity follows the event phase machine:
    //   APPROACH 0.45 / PEAK 1.0 / AFTERMATH 0.25 (lock §8)
  ],
}
```

## Rules (non-negotiable)

1. **Determinism.** `simulate(world, {timeBucket, inputs})` called twice with
   identical arguments returns byte-identical snapshots. No `Math.random()`,
   no `Date.now()` inside tick math. Seed every stream from
   `world.seed + timeBucket + subsystem`.
2. **World is read-only.** Actor `x, y` updates live in the snapshot, not in
   the world. The next tick starts from the world + the previous snapshot.
3. **Roads are the only paths.** Movement interpolates along
   `routeBetween(from, to)` waypoint lists from `engine/world/roads.mjs`.
4. **Hero may be null.** `world.hero === null` must not throw; the snapshot
   simply has no hero actor and hero-following effects are omitted.
5. **Unknown inputs stay unknown.** If `inputs.ciStatus` is missing, the
   fortress stays in its last snapshot state or a neutral state — never
   invent a failure or a recovery.
6. **Bounded damage.** War/construction effects never permanently alter
   structural world state (lock §8: damage is bounded in simulation buckets).
7. **Quiet default.** With no events and `warPhase: 'PEACE'`, the snapshot
   shows daily life only: actors on home↔work routes, `effects: []`.

## Suggested module split (adapt freely)

```
engine/simulation/
  clock.mjs        timeBucket parsing, day-band helpers
  scheduler.mjs    actor schedules (home -> work -> destination)
  movement.mjs     waypoint interpolation along road edges
  actors.mjs       per-role state machines
  construction.mjs builder tasks, progress, materials
  war.mjs          13-phase war machine
  events.mjs       event phase machine + fx intensity
  economy.mjs      farm/market signals -> task pressure
  simulate.mjs     simulate() entry point assembling the snapshot
```
