# TRUE V2: audit of current V2 and implementation plan

Inputs: the V2 repository (technical source of truth, 68 passing tests at baseline) and the TRUE V2 Master Guideline.
Method: every engine module, every renderer, all tests, all workflows and the saved data were read before any change.

## 0. Verdict

The engine is sound. The state, rules, events, quests, visitors, safety and GitHub automation are good and stay.
The problem is exactly the one the guideline names: **only the overworld has a map**. The other seven pictures are
separate drawings that read the same numbers but draw their own terrain, sky, light and people.

Defects that prove it (all verified in the baseline pictures):

| # | Defect | Where |
|---|--------|-------|
| D1 | The hero stands at the gate (hero HUD says "DEFENDING THE GATE") **and** on the farm road in the harvest picture | `harvest.mjs` places the hero at a fixed point, ignoring `scene.hero.spot` |
| D2 | The farm is two different farms: 21 days with a scarecrow on the map, 26 weeks with a barn and windmill in the harvest picture | `kingdom-places.mjs` vs `harvest.mjs` |
| D3 | Weather and light are decided in three places. Storm darkening and the aurora palette exist only in `kingdom.mjs`; harvest, camp, districts use `TINT[phase]` alone | `kingdom.mjs` vs the rest |
| D4 | Aurora is drawn in daylight ("It is day, the weather is aurora") | `scene.mjs` (0.25 by day) and `kingdom-world.mjs` |
| D5 | Sky colours are copied into `hero.mjs`, `harvest.mjs`, `camp.mjs` instead of using `SKY` | those three files |
| D6 | The same event is shown three times: hero status text, map corner chips, and the event picture | `scene.hud` used by `kingdom.mjs` and `hud.mjs` |
| D7 | Quest picture repeats stars, streak, CI health and active repos that the vault, farm, CI fortress and builders already show | `hud.mjs` (four tiles) |
| D8 | Hero state `walking` exists but is never produced; hero "spot" is a string, not a place with coordinates or a path | `scene.mjs` `pickHero` |
| D9 | `--only=` in three workflows redraws a subset, so after a release the map shows fireworks and the camp does not | `stats-update.yml`, `achievement-update.yml` |
| D10 | `contentHash` ignores the renderer, so pushing new art can print "Nothing changed" and leave old pictures | `cli.mjs` `hashOf` |
| D11 | `data/world-state.json` on disk is still a V1 save (no scene, power, quests) | `data/` |
| D12 | Trophy hall, camp and harvest have no season, no weather and no raid awareness at all | `trophies.mjs`, `camp.mjs`, `harvest.mjs` |

## 1. Current architecture summary

```
GitHub -> github.mjs -> state.mjs (buildState) -> v2.mjs (finalizeV2: evolution, power, quests, scene)
                              |                                   |
                  rules / events / quests / achievements    scene.mjs  (modes, hero state, npc COUNTS, light, fx, stages)
                              v
                  data/world-state.json (+ data/*.json stores)
                              v
 cli.mjs ASSETS[10]  each:  render(state, ctx) -> SVG string -> lintSvg -> renderer/*.svg -> readme.mjs
```

* 306 KB of engine code, 68 tests, Node 22, no dependencies, every renderer is a pure `state -> SVG` function.
* **Shared today:** `Pix` canvas, palette, sprites, `ui.mjs` chrome, `light.mjs` primitive, `scenery.mjs` primitives, `growth.mjs` buildings, `actors.mjs`.
* **Spatial model exists once:** `render/kingdom-layout.mjs` (176 x 240 grid, anchors `L`, `ROADS`, `SLOTS`, `HERO_SPOT`, `assignRepos`).
  It is imported by exactly four files, all of them parts of the overworld. Seven renderers never touch it.
* **Scene** (`scene.mjs`) is already deterministic and good: modes, hero state, light flags, effects, story stages by age.
  NPCs are only **counts**; the overworld invents their positions inline.
* Decor (trees, grass specks) comes from one seeded stream consumed in drawing order. Deterministic, but only because one function draws everything once.

## 2. TRUE V2 gap analysis (guideline Parts I to L)

Legend: **DONE** keep, **PART** exists but incomplete, **MISS** not there.

| Guideline item | Status | Evidence / what is missing |
|---|---|---|
| One persistent world, shared coordinates | PART | Layout exists for the overworld only (D1, D2) |
| Shared grid, scales, road width | PART | Constants are literals spread over 4 files; no NPC/hero/tree scale table |
| World object model (Repository, Building, NPC, Hero, Visitor) | MISS | Repos are state rows; NPCs are counts; hero/visitor have no position |
| Districts (geography) | PART | West/east blocks and slots exist; no district ids, no news/knowledge/project identity |
| Camera system (7 views) | MISS | 7 separate renderers; none is a crop of the world |
| Camera consistency (season, weather, light, raid) | MISS | D3, D12 |
| Shared visual constants | PART | `palette.mjs` shared; skies, shadows, scales duplicated (D5) |
| Depth system (bg / mid / fg) | PART | Overworld sorts by foot-y; panels are flat |
| Shared lighting engine | PART | `lightLayer` is shared, the policy is not (D3) |
| Day / night | DONE | Overworld; other views only tint |
| Weather | PART | Overworld only; aurora by day (D4) |
| Seasons | PART | Overworld, districts, camp; hall and farm structure ignore it |
| Repository levels (5) and visual states | PART | Levels 1 to 5 done. Lifecycle names `foundation`, `flourishing`, `recovering` are not first class |
| Repository memory (story on the building) | DONE | `growth.mjs` (stages by age) |
| Kingdom power thresholds as visuals | MISS | Power is a number; castle tier follows hero level, not power |
| NPC roles | DONE | 9 roles with real-data counts |
| NPC behaviour states (8) | MISS | Only flags (`home`, `shelter`, `patrol`); no states, no homes |
| Hero states and destinations | PART | `spot` strings; `walking` never used; no path (D8) |
| Event phases START / PEAK / AFTERMATH / EXPIRED | PART | Stage functions per story exist; no unified phase model, no `ageMinutes` |
| World transitions | MISS | Phases are discrete; no blend or continuity |
| World-linked quests | MISS | Quests carry a `track` but no world object |
| Physical trophy hall | MISS | Overworld shrine with 12 orbs; hall picture is a separate room |
| Physical harvest field | MISS | D2 |
| Physical visitor camp | PART | Tents on the map (max 12); camp picture is another clearing; no growth states |
| Goblin raid as world event | DONE | Gate, goblins, guards, hero, outcome all on the map. Other views do not know |
| Population as density | PART | Counts follow data; no kingdom-power effect |
| One data, one visual home | PART | D6, D7 |
| History as growth | PART | Castle tier + houses per snapshot; not the same place over time |
| README composition / budget | PART | Order is right; panels are tall (about 4,000 px at 720 wide), duplicated numbers, no compact navigation |
| Mobile-first | PART | Same artwork shrunk (text at 54 %) |
| Determinism | DONE | Same state, same bytes (tested) |
| Performance | PART | No per-view culling; symbols are used inside a picture, not across the world |
| Security | DONE | `safety.mjs`, `visitors.mjs`, lint. Must not regress |
| Error isolation | DONE | Per-picture fallback; must survive a shared world model |
| Tests | PART | 68 good tests; none for world, camera, lifecycle, choreography |
| Demo scenarios | PART | 19 worlds. Missing: workflow failure story, harvest, visitor arrival, high / low power, festival |

## 3. Target architecture

```
state (V2, persisted)  ->  buildWorld(state)  ->  World (derived, never persisted, one per render pass)
                                                    |  time, season, weather, lighting
                                                    |  kingdom tier, districts, repositories, buildings
                                                    |  hero (position, path), npcs (state, position), visitors
                                                    |  farm plots, hall pedestals, camp, dungeon, events (phase, ageMinutes), quest targets
                                                    v
                 one world drawing pipeline  +  Camera { rect, zoom, follow }  +  HUD overlay (screen space)
                 OVERWORLD  CASTLE  PROJECT_DISTRICT  FARM  DUNGEON  TROPHY_HALL  VISITOR_CAMP
```

Key mechanisms (chosen to reuse the existing art code, not rewrite it):

1. **Camera = SVG `viewBox` crop of the one world drawing + primitive-level culling in `Pix`.** Every view runs the same
   drawing code in the same world coordinates, so a tree, a goblin or a lit window is the same object in every view.
   Culling drops rectangles outside the view, so each file contains only what its camera sees. The decor random stream is still
   consumed in the same order, so objects never move between views.
2. **`buildWorld` is derived and not saved.** `world-state.json` keeps its shape; no growth of the save file.
3. **Level of detail, not different art.** The farm has 26 x 7 plots in the world. Far away a plot is a small glyph; the farm camera
   draws the detailed crop sprite of the same plot.
4. **HUD overlays stay in screen space** (numbers, nameplates, avatar frames, the raid bar). They never carry data the world already shows.
5. **Events are phases of one model**, computed from the age of the real event. Hero position along its path is a pure function of phase and age.

## 4. Files

### Modify
`engine/cli.mjs` (world once per pass, new asset, render version in hash, `--only` made safe, demo/status)
`engine/render/pixel.mjs` (clip + culling, `viewBox`, world attribute) | `light.mjs` (single policy entry) | `scenery.mjs` (aurora only after dusk)
`engine/render/kingdom.mjs`, `kingdom-world.mjs`, `kingdom-places.mjs`, `kingdom-life.mjs` (read the World; farm, hall, camp, ci, dungeon become world objects)
`engine/render/hero.mjs`, `districts.mjs`, `harvest.mjs`, `camp.mjs`, `trophies.mjs`, `chronicle.mjs`, `hud.mjs` (become cameras + overlays)
`engine/render/growth.mjs`, `buildings.mjs` (lifecycle extras, power-tier decor) | `engine/scene.mjs` (hero `walking`, destinations; stage functions untouched)
`engine/readme.mjs` (composition table, compact navigation) | `engine/power.mjs` (tier table, additive) | `engine/mock.mjs` (new demo worlds)
`engine/render/kingdom-layout.mjs` (becomes a compatibility façade over `engine/world/layout.mjs`)

### Preserve unchanged
`state.mjs`, `rules.mjs`, `evolution.mjs`, `quests.mjs`, `events.mjs`, `achievements.mjs`, `history.mjs`, `visitors.mjs`, `safety.mjs`, `github.mjs`, `store.mjs`, `util.mjs`,
`font.mjs`, `sprites.mjs`, `palette.mjs` (additive only), `ui.mjs`, `guild.mjs`, `signposts.mjs`, `fallback.mjs`, `status.mjs`,
`legacy/`, `kingdom.config.json`, `data/*.json` shapes, the 68 existing tests.

**GitHub Actions: preserve the workflow architecture and triggers** (schedules, event triggers, `kingdom-write` concurrency, permissions, issue forms,
the visitor pipeline). A workflow file may change only when a concrete V2 consistency bug requires a minimal change. There is exactly one such bug (D9):
`stats-update.yml` and `achievement-update.yml` pass `--only=...`, which redraws some views and leaves the rest stale. The fix is made in the CLI first
(every view is always drawn from the one world state; `--only` is accepted and ignored with a log line), and the workflow edit is limited to removing that flag
from those two `run:` lines so the configuration does not claim something that no longer happens. Nothing else in `.github/` is touched.

### New modules
```
engine/world/constants.mjs   grid, tile, scales, road width, style constants (shadow, outline, light direction)
engine/world/layout.mjs      districts, anchors, roads, slots, assignRepos (moved), hero waypoints
engine/world/cameras.mjs     7 camera definitions, follow-hero, view box
engine/world/lifecycle.mjs   repository lifecycle (8 states), kingdom power tier (5) and its visual levels
engine/world/lighting.mjs    the one lighting policy (phase, weather, aurora, accent, danger) used by every camera
engine/world/events.mjs      phases, ageMinutes, locations, hero path and destination, NPC reactions
engine/world/population.mjs  NPC entities (role, home, state, position)
engine/world/farm.mjs        26 x 7 plots from the calendar (one calculation)
engine/world/hall.mjs        pedestal layout from achievements (one calculation)
engine/world/camp.mjs        camp state EMPTY / CAMP / VILLAGE / FESTIVAL and tent slots
engine/world/index.mjs       buildWorld(state, ctx) and the world signature
engine/render/camera.mjs     drawWorld pipeline + renderCamera(state, ctx, cameraId, overlay)
engine/render/hall.mjs       hall building (exterior gallery) drawing
engine/render/farm.mjs       farm field drawing (two levels of detail)
engine/world/homes.mjs       one-visual-home table (Rule C) and quest-target table
engine/world/manifest.mjs    per-camera world manifest + the consistency comparison (Rule D)
engine/test/*.test.mjs       world.foundation, cameras, choreography, consistency (Rule D), mobile (Rule B), homes (Rule C)
gallery command             `node engine/cli.mjs gallery` writes the camera x state SVG matrix (Rule A)
```

### Remove (with reason)
Panel-local skies, terrain, barn, windmill, hero "places" (replaced by the world) | 21-day farm | shrine orbs (replaced by the hall) |
map corner event chips and quest-picture tiles (duplicates) | per-renderer tent spots | literal `HERO_SPOT` table (becomes anchors).

## 4b. Hard rules (these gate every phase)

### Rule A: the visual regression gate
No phase is accepted from tests alone. A renderer can pass every unit test and still produce ugly or inconsistent artwork.
Every major phase must produce, and a human-style review must sign off on:

1. **All 7 camera views**: OVERWORLD, CASTLE, PROJECT_DISTRICT, FARM, DUNGEON, TROPHY_HALL, VISITOR_CAMP. In a phase before a camera exists, the gate lists it as
   "not built yet" and the plan must schedule it for a named later phase.
2. **At least 10 important world states** (day, night, storm, autumn, winter, release, raid, workflow failure, recovery, harvest, visitor arrival, low power, high power).
3. **Desktop preview** (README content width 720 px) and **mobile preview** (390 px viewport, 358 px content width).
4. Contact sheets saved per phase (`gallery/phase-N/`), each with written review notes: what was checked, what was ugly, what was fixed.

`node engine/cli.mjs gallery` writes the SVG matrix (camera x state) plus a manifest; rasterised desktop and mobile contact sheets are built from it for review.
A phase closes only when its tests are green **and** its contact sheets have been reviewed and the defects found were fixed or recorded.

### Rule B: mobile acceptance (first-class)
The reported problem is mainly mobile UX, so it has its own automated test (`engine/test/mobile.test.mjs`) and its own acceptance line.
Targets: viewports 360, 390 and 430 px (README content width = viewport minus 32 px).

| Requirement | How it is checked |
|---|---|
| No critical text below readable size | `Pix.text` logs every string with its pixel-font scale; displayed cap height = 7 x scale x (content width / picture width) must be at least 8.5 px at 360. On a 640 px panel that means scale 2.5 or more. Words that fail are removed or enlarged, never shrunk. |
| README meaningfully shorter than V1 | total stacked height, in panel widths: at most 87 % of the V1 equivalent in every demo world (with or without an event picture) and at most 82 % for a normal day. **Measured result: 4.14 widths for a normal day against 5.15 for V1 (19.6 % shorter), 4.64 with an event picture against 5.36 (13 % shorter).** The 25 % first target was not reached: the overworld alone is 1.25 widths because it keeps the dungeon, the home of issues, in the same picture |
| Primary world visible quickly | the overworld's top edge starts within the first 220 px at 360, 390 and 430; the hero HUD is at most 0.5 of its width tall (measured 0.44) |
| No unnecessary full-width repeated panels | panel registry: one purpose per panel, the event picture exists only while there is an event, the quest strip carries no metric that a world object already shows, at most 9 full-width panels |
| Recomposed, not shrunk | each camera has its own mobile-safe aspect and overlay; no panel is the desktop artwork scaled down |

### Rule C: one visual home (strict)
Every important GitHub signal has exactly one primary visualisation: its *home object* in the world.

| Signal | Home | | Signal | Home |
|---|---|---|---|---|
| Stars | Vault | | Contributions | Farm |
| Issues | Dungeon | | Streak | Farm (hero HUD may show a compact reference) |
| CI health | CI Fortress | | Achievements | Trophy Hall |
| Commits / activity | Builders | | Visitors | Camp |
| Pull requests | Messengers | | Population | NPC density |
| Releases | Castle | | | |

If a statistic appears anywhere else it is a **secondary compact reference**: an icon plus a number on one line. It is never a second bar, tile grid, chart or scene.
`engine/world/homes.mjs` holds the table; every panel declares the references it prints; a test fails if a panel draws a home-style visualisation of a signal it does
not own or lists a reference without the home existing in the world model. This removes the four stat tiles of the quest picture, the map-corner event chips and the
repeated quest title in the hero HUD.

### Rule D: world consistency invariant (the most important test)
For one world state, every camera must agree on all of the following. This is the single most important TRUE V2 test (`engine/test/consistency.test.mjs`).

- hero position and pose
- farm plots (every plot, every growth stage)
- repository positions (and lifecycle state)
- season, weather, lighting state
- event state (type, phase)
- visitor and tent positions
- plus NPC positions and states, raid state, kingdom-power tier, trophy pedestals

Mechanism: every camera SVG carries a `<metadata>` manifest written by the shared pipeline (object id, world position, state key, level of detail, hash of the drawn markup).
The test renders all seven cameras for 12 or more world states and compares manifests pairwise: positions and state keys must always match, markup hashes must match
whenever two cameras draw the object at the same level of detail. A renderer that draws its own hero, its own farm or its own sky cannot pass.

## 5. Phases and exit criteria

| Phase | Work | Exit criterion |
|---|---|---|
| 1 Foundation | `world/constants`, `layout`, `cameras`, `lighting`, `lifecycle`, `index`; façade for `kingdom-layout` | 68 old tests green; new coordinate / lighting / camera-definition tests green; pictures unchanged |
| 2 Unification | `Pix` culling and `viewBox`; `renderCamera`; farm, hall, camp, ci, dungeon as world objects on the map | overworld shows the real farm / hall / camp; all views read one world |
| 3 Cameras | harvest, camp, hall, districts, hero portrait, dungeon become crops of the world | same season, weather, light, raid in every view (consistency test) |
| 4 Choreography | event phases, hero path, NPC states and reactions | release / raid / CI / harvest sequences visible and tested per phase |
| 5 Visual evolution | lifecycle looks, power tiers, camp growth, seasonal structure | five power tiers and four camp states visibly different |
| 6 Quests | quest targets are world objects; marker in the world and in the quest strip | every quest track resolves to an anchor |
| 7 Recomposition | compact power / quest strip, hero HUD, event camera, navigation, content budget | README height cut by about 25 %; no duplicated number |
| 8 Art pass | shadows, depth order, particles, framing | contact sheets reviewed |
| 9 Integration | all cameras x seasons x weather x modes x events, empty and 90 repo accounts, mobile widths | full suite green; gallery validated by eye |

After every phase: full test suite, SVG lint, **and the visual regression gate (Rule A)**. Phase 1 additionally proves that no picture changed by comparing every demo world byte for byte with the baseline.

## 6. Risks and migration

| Risk | Mitigation |
|---|---|
| New renderers do not run after deploy because the state hash is unchanged (D10) | add a render version to `hashOf`; first run after the push redraws everything |
| Quick workflows redraw only part of the world (D9) | CLI draws every view from the one state and ignores `--only`; minimal two-line workflow edit (drop the flag), no other workflow change |
| World model failure must not take down the README | each world section is guarded with safe defaults; each picture keeps its own try / catch and fallback card; the existing isolation test stays |
| Existing tests import `assignRepos`, `SLOTS`, `mapLabels`, `renderCamp`, `pickSnapshots`, `plateLines`, `buildScene`, `failStage` ... | those export names and signatures stay; old paths become thin re-exports |
| Visual change is not caught by tests | rasterised review after each phase, plus consistency tests on colours, classes and signature |
| Output size | culling per camera; empty group elision; size assertions stay (450 KB) |
| GitHub sanitising of `<picture>` or anchors is unknown without network access | navigation uses plain `<a name>` anchors and plain `<a><img>`; mobile `<picture>` variants are not used |
| Saved V1 state | `finalizeV2` already upgrades it; `buildWorld` only reads fields that `finalizeV2` guarantees |

## 7. Testing strategy

Keep the 68 tests untouched. New test files: `consistency.test.mjs` (Rule D), `mobile.test.mjs` (Rule B), `homes.test.mjs` (Rule C), `world.foundation.test.mjs`, `cameras.test.mjs`, `choreography.test.mjs`.
Add tests for: world coordinates (slots and anchors inside their district, inside bounds, no overlap), camera
definitions and one-signature-per-state, season / weather / lighting consistency across every camera, event phases and hero path, repository lifecycle,
hero destinations, NPC states, power thresholds, camp growth, farm and trophy single source, deterministic bytes, README composition and budget,
hostile text through every new overlay, error isolation. Demo worlds added: workflow failure, harvest, visitor arrival, festival, high power, low power.

## 8. TRUE V2 acceptance checklist (final result)

Evidence: the test named in brackets passes, and the matching contact sheets are in `docs/gallery/`. Items marked PARTIAL say what is missing.

- [x] Every major visual belongs to the same kingdom [consistency, integration]
- [x] Every camera uses the same world state (one signature) [consistency: 21 demo worlds + 38 edge states]
- [x] Repository buildings physically belong to districts [world.foundation: slots inside districts, overflow to neighbours]
- [x] Farm, trophy hall, visitor camp are places on the shared map [evolution, consistency]
- [x] Dungeon shows real problems; CI fortress shows workflow health [homes: the dungeon and the vault change with their signal]
- [x] Hero moves according to real events; NPC behaviour reacts to world state [choreography: 12 tests, 8 behaviour states]
- [x] Weather, season, lighting agree in every relevant view [consistency, integration: 64-combination matrix]
- [x] Events have start, peak, aftermath, expiry [choreography: exact boundaries; integration: 6 stories x 4 phases]
- [x] Repository buildings evolve; Kingdom Power changes the visible settlement; population changes density [evolution]
- [x] Quest objectives point at world objects [quests-world: 8 tests]
- [x] No GitHub metric is shown by duplicate cards; raw text is minimal [homes, mobile]
- [x] README reads as a game world; mobile layout is composed on purpose [mobile, gallery/phase-7]
- [x] Same state, same imagery; no browser JavaScript [byte-identical across processes and machine timezones; all 218 pictures well-formed XML]
- [x] Security, business logic, GitHub automation unchanged; all tests pass [68 original tests unmodified and green; 2 workflow lines changed, see section 4]
- [x] Rule A: every phase has reviewed contact sheets (all cameras x 10+ states x desktop and mobile) [docs/gallery/phase-1 ... phase-8]
- [x] Rule B: mobile acceptance test passes at 360, 390, 430 px [mobile.test.mjs]
- [x] Rule C: every signal has one home; all other appearances are compact references [homes.test.mjs]
- [x] Rule D: the world consistency invariant holds for 12+ world states [consistency.test.mjs: 59 states]
- [ ] PARTIAL: "README meaningfully shorter" is met (19.6 % shorter on a normal day, 13 % with an event picture) but the first target of 25 % was not reached (section 4b)
- [ ] NOT VERIFIED: a real GitHub Actions run and GitHub's own SVG sanitiser (this environment has no network); pictures use plain `<img>` as before. First step after deploying: run the `world-update` workflow once by hand
