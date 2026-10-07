# Architecture

Kingdom V3 is a pipeline, not a framework. Data flows one way; every
layer owns its truth and never reaches past its neighbor.

```
┌─────────────┐   ┌──────────────┐   ┌─────────────┐   ┌─────────────┐
│   INGEST    │   │    DOMAIN    │   │    WORLD    │   │ SIMULATION  │
│ github.mjs  │──▶│ state.mjs    │──▶│ world.mjs   │──▶│ simulate()  │
│ (REST fetch │   │ mapping.mjs  │   │ buildWorld  │   │ tick: clock │
│  + isolation│   │ achievements │   │ ONE canon.  │   │ actors, war │
│  per section│   │ offline-snap │   │ world       │   │ economy, fx │
└─────────────┘   └──────────────┘   └─────────────┘   └─────────────┘
                                                        │
┌─────────────┐   ┌──────────────┐   ┌─────────────┐     │
│     CLI     │   │ VALIDATION   │◀──│   RENDER    │◀────┘
│ update etc. │   │ safety.mjs   │   │ 10 cameras  │
│ orchestrates│   │ invariants   │   │ SVG + README│
└─────────────┘   │ schema       │   └─────────────┘
                  │ budgets      │
                  └──────────────┘
```

## Data ownership

- **Ingest** (`engine/github.mjs`) owns the network. It returns a raw
  snapshot shaped like the offline fixture, with `failedSections`
  listing anything the API refused. It never touches the world.
- **Domain** owns meaning. `state.mjs` normalizes a snapshot into the
  canonical state (per-section failure isolation: a failed section keeps
  its last known value or goes visibly neutral — never coerced).
  `mapping.mjs` is the cause→effect table: repos→buildings, issues→
  dungeon pressure, CI→fortress state, releases→royal announcements,
  contributions→farm, achievements→hall, visitors→harbor. All pure and
  deterministic; unknown inputs come out as `{status:'unknown'}`.
- **World** (`engine/world/`) owns space. `buildWorld(state)` is the
  single authority for geography: one coordinate system, one road graph,
  19 districts, plots, buildings, entities. Cameras crop; they never
  invent. `worldSignature` hashes the spatial facts every camera must
  agree on; `contentHash` binds versions + input + world.
- **Simulation** (`engine/simulation/`) owns time. `simulate(world,
  {timeBucket, inputs})` derives actor positions, construction progress,
  war phases, farm crop states, and event fx — all from seeded RNG keyed
  on (seed, timeBucket, subsystem). No `Math.random`, no `Date.now` in
  world code (lint-enforced).
- **Render** (`engine/render/`) owns pictures. Painters read world +
  snapshot and emit SVG. Every asset passes `lintSvg` before it is
  written; one failing renderer becomes a fallback card, never a broken
  run. `readme.mjs` composes the profile README as a journey:
  identity → grand kingdom → current story → hero journey → districts →
  history → guild.
- **Validation** owns the gates: SVG safety, text sanitization, world
  invariants, schema, visual budgets, determinism (byte-identical
  re-renders).
- **CLI** (`engine/cli.mjs`) owns the contracts: `update`
  (fetch→normalize→persist→build→simulate→render→README),
  `render`, `demo` (never touches `data/`), `visitors`, `cleanup`,
  `lint`.

## Persistence

`data/` holds the raw and derived truth:

| File | Written by | Contents |
|---|---|---|
| `snapshot.json` | `update` | raw collected snapshot (+ provenance: live / offline-demo) |
| `world-state.json` | `update` | normalized domain state (last-known values for failure recovery) |
| `world.json` | `update` | built world + contentHash + inputSignature |
| `visitors.json` | `visitors` | issue-form visitor entries (sanitized) |
| `world-lock.json` | design | canonical lock: districts, roads, cameras, lifecycle, versions |

`renderer/` holds generated assets (`grand.svg`, cameras, `README.md`)
— committed by the workflows, never hand-edited.

## Determinism rules

1. Same snapshot + same code → byte-identical world, tick, and SVGs.
2. RNG only via seeded streams (`subRng(seed, ...parts)`).
3. The wall clock enters only at the edges: `update` stamping and the
   fetch layer's `daysAgo` normalization (lint-allowlisted).
4. Versions (`RENDER_VERSION` etc.) are part of the content hash — any
   bump forces a re-render.
