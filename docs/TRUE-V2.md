# TRUE V2: one persistent kingdom, many cameras

The README is not a set of pictures that happen to share numbers. It is **one world**, drawn by one pipeline, seen through cameras.

```
saved state ──> buildWorld(state) ──> World (derived, never saved)
                                        layout, districts, repositories, lifecycle, hero (position, route), people (state, place),
                                        farm plots, hall pedestals, camp, quests, events (phase, age), lighting, kingdom tier
                                           │
                       drawWorld(state, world, camera)    the whole kingdom is drawn ONCE per picture, in world coordinates
                                           │
                clipped to a camera window + overlay (screen space: numbers, plates, frames) ──> SVG + manifest
```

## Where things are

| Folder | What lives there |
|---|---|
| `engine/world/` | the model: `layout` (one map: anchors, districts, slots, roads, hero routes), `lifecycle` (8 repository states, 5 power tiers), `lighting` (the one light policy), `phases` (start / peak / aftermath / expired), `population` (people and their 8 behaviour states), `farm`, `hall`, `camp`, `quests`, `cameras`, `homes` (one visual home), `manifest`, `index` (`buildWorld`) |
| `engine/render/camera.mjs` | the pipeline: `drawWorld`, `renderCamera`, `cameraParts`, the manifest |
| `engine/render/kingdom-*.mjs` | what stands in the world: terrain, places, hall, farm, camp, people, hero, raid, quest markers |
| `engine/render/{hero,districts,harvest,trophies,camp,dungeon,hud,chronicle}.mjs` | one camera each, plus its small overlay |
| `engine/test/` | 143 tests: the 68 original ones (unchanged) and the TRUE V2 suites |
| `engine/dev/` | review tools: `blueprint` (the shared geometry), `showcase` (repository lifecycle) |

The seven cameras: OVERWORLD, CASTLE (the hero portrait), PROJECT_DISTRICT, FARM, DUNGEON, TROPHY_HALL, VISITOR_CAMP; plus the EVENT camera, aimed at the place of the most important story.

## The four hard rules (each one is a test)

* **A. Visual regression gate.** No phase counts from tests alone: all cameras, 10+ world states, desktop and phone previews, reviewed by eye (`docs/gallery/`). `node engine/cli.mjs gallery` writes every picture of every demo world and checks rule D.
* **B. Mobile** (`mobile.test.mjs`). No text below 8.5 px at 360 / 390 / 430 px; the README is shorter than V1; the world starts within the first 220 px; at most 9 panels, each with its own purpose; under 120 characters of raw text.
* **C. One visual home** (`homes.test.mjs`). Stars -> vault, issues -> dungeon, CI -> fortress, commits -> builders, pull requests -> messengers, releases -> castle, contributions and streak -> farm, achievements -> hall, visitors -> camp, population -> people. Elsewhere a signal may be a compact reference (icon + number) only; every string in every picture is checked against what that picture owns.
* **D. World consistency** (`consistency.test.mjs`). Every picture carries a manifest comment; for one state all cameras must agree on hero position, farm plots, repository positions, season, weather, lighting, event state, visitor tents (plus people, quests, power tier, trophy pedestals), and a camera never draws what it cannot show whole.

## Working with it

* Add a thing that stands in the world: give it a place in `world/layout.mjs`, state in `world/index.mjs`, draw it with `K.obj(id, { x, y, st, box, foot }, () => ...)` in `render/kingdom-*.mjs`. It is then in every camera, in the manifest and under rule D automatically.
* Add a camera: one entry in `world/cameras.mjs`, one small overlay file.
* Change any picture without changing data: bump `RENDER_VERSION` in `engine/cli.mjs` so the next run redraws instead of printing "Nothing changed".
* Commands: `npm test`, `node engine/cli.mjs gallery`, `node engine/cli.mjs demo`, `node engine/cli.mjs render` (offline), `node engine/dev/blueprint.mjs`, `node engine/dev/showcase.mjs`.

## Unchanged by TRUE V2

State, rules, evolution, quests, events, achievements, history, visitors, safety, GitHub access, the store, every workflow trigger and permission, the issue forms. Two lines of two workflow files changed (`--only=` removed; the CLI now always redraws every picture from the one world).
