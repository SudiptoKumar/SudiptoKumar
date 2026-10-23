# TRUE V2 status and visual-gate record

This file records, phase by phase, what was built, which tests passed, and what the **visual regression gate (Rule A)** found.
A phase is closed only when its tests are green and its pictures were reviewed.

## Phase 1: foundation (closed)

Built: `engine/world/` (constants, layout, lifecycle + power tiers, lighting policy, farm, hall, camp, cameras, one-visual-home table, `buildWorld`),
`engine/dev/blueprint.mjs`. The old renderers are untouched, so no picture changes in this phase.

| Gate | Result |
|---|---|
| Tests | 84 / 84 (68 original + 16 new foundation tests) |
| Byte-identity | all 179 pictures and 19 README blocks of the 19 demo worlds are identical to the baseline |
| Cameras | not built yet: all seven are defined and resolve inside the world (`world/cameras.mjs`); they are drawn in phases 2 and 3 |
| World states | 19 demo worlds build a world with no section errors |
| Desktop / mobile preview | not applicable (no picture changed); the blueprint (`gallery/phase-1/blueprint.png`) was reviewed instead |

Review notes (blueprint):
- Found and fixed 5 geometry problems before any art depended on them: the 26 x 7 farm cannot be taller than the strip between the river and the gate (plots are 3 x 2.5 units),
  the visitor camp overlapped the gate tower (camp moved east), a tent place fell outside the camp view, back-row towers would have overlapped the vault (vault and ruins moved), ruins overlapped the vault footprint.
- The hall (58 x 26 units, two storeys, 16 pedestals) fits the west-centre band; the vault takes the old shrine place; archived projects stand as ruins in the north-east hills.

## Phase 2: unification (closed)

Built: `render/camera.mjs` (the one drawing pipeline: the whole kingdom is drawn once per picture in world coordinates, clipped to a camera window, with a per-picture manifest),
primitives (`Pix` clip + culling, object fingerprints, text log; `svgDoc` manifest comment), and the places rewritten as shared world objects: `kingdom-hall.mjs` (Trophy Hall, 16 pedestals / doors),
`kingdom-farm.mjs` (26 x 7 plots, fence, barn, windmill), `kingdom-camp.mjs` (4 growth states, one tent per visitor), `kingdom-places.mjs` (castle with tier pennants and crown,
vault, plaza well / fountain / statue, lamps, flowers, stalls, CI fortress, mine, repository districts, ruins, gate, forest), `kingdom-world.mjs` (district floors, power-tier roads),
`kingdom-life.mjs` (hero and raid through the world model). `render/kingdom-layout.mjs` is now a façade over `world/layout.mjs`.
Fixed D4 (no aurora in daylight): `scene.mjs` and `world/lighting.mjs`.

| Gate | Result |
|---|---|
| Tests | 84 / 84 (all 68 original tests pass against the new overworld) |
| Lint | clean (found and fixed a duplicate glow id) |
| Cameras | OVERWORLD built and reviewed; CASTLE, PROJECT_DISTRICT, FARM, DUNGEON, TROPHY_HALL, VISITOR_CAMP are scheduled for phase 3 |
| World states reviewed | 12: day, night, storm, winter, release, raid, recovery, build, autumn, newbie, sleepy, victory |
| Desktop / mobile | 720 px and 358 px previews reviewed (`gallery/phase-2/`) |

Review notes: found and fixed (1) tall library buildings hid the hall's lower row of trophies, so the hall moved north (y 66-93) with a forecourt;
(2) the ISSUES plaque sat on the hero, so it moved onto the dungeon crust where issues live; (3) the top crop cut the sky, so fireworks, sun and moon would have been clipped; the overworld window now starts at y 12;
(4) the mine footprint was far larger than its art and blocked the hall. Open item carried to phase 5: lifecycle extras (foundation / flourishing) are modelled but not yet drawn.

## Phase 3: cameras (closed)

Built: the other six cameras as thin overlays over the shared pipeline (`hero.mjs` portrait = live CASTLE camera; `districts.mjs`, `harvest.mjs`, `trophies.mjs`, `camp.mjs`, new `dungeon.mjs`),
`render/overlays.mjs` (compact pills, text fitting, minimum text size 3), `world/manifest.mjs` + `test/consistency.test.mjs` (Rule D), the `gallery` command (Rule A) in `cli.mjs`,
`RENDER_VERSION` in the content hash (D10), `--only` made inert in the CLI (D9) with the two-line workflow edit.

| Gate | Result |
|---|---|
| Tests | 92 / 92 (68 original + 16 foundation + 8 world-consistency) |
| Rule D | all 19 demo worlds + 4 edge cases (30 visitors, empty camp, power 95, power 5): every camera agrees on world signature, season, weather, lighting, power tier, event state, hero, repository positions, farm plots, trophy pedestals, visitor tents. A negative-control test proves it detects a moved hero, a different hour and a differently drawn farm |
| Rule D, completeness | a camera never omits something standing inside its window and never draws something the world does not contain (this caught a real bug: the mine repository was drawn twice) |
| Cameras | all 7 reviewed: OVERWORLD, CASTLE (hero HUD), PROJECT_DISTRICT, FARM, DUNGEON, TROPHY_HALL, VISITOR_CAMP |
| World states reviewed | 12 per camera (day, night, storm, winter, spring, autumn, release, raid, victory, build, recovery, newbie), all 19 generated and consistency-checked |
| Desktop / mobile | 720 px sheets per camera and a 358 px mobile stack of the README (`gallery/phase-3/`) |
| Workflows | exactly two lines changed (`--only=...` removed from `stats-update.yml` and `achievement-update.yml`) |

Review notes: found and fixed (1) hero HUD status text touching the gear row, (2) camp speech bubble covering face numbers (the newest visitor is now a face + message in the overlay and an arrow over its tent in the world),
(3) miners walking over the hall roof, (4) dungeon window cutting the hero in half, (5) the gate's skull sign hanging over the farm entrance, (6) a small camp wasting a third of its picture (now framed tightly),
(7) district pins too faint. Mobile budget after this phase: 4.58 panel-widths for the README without an event panel (V1: 5.36); quest, history and event panels are still old-style and are recomposed in phase 7.
Open items: NPC entities and phase-driven hero paths (phase 4), lifecycle extras (phase 5), world-linked quests (phase 6).

## Phase 4: choreography (closed)

Built: `world/phases.mjs` (START / PEAK / AFTERMATH / EXPIRED for every story, computed from the real age in minutes: release, milestone, harvest, raid, CI failure, recovery, new project, visitor),
phase-driven hero in `scene.mjs` (routine, then the story: START = he walks from his routine place to the event along the roads, PEAK = he does the thing, AFTERMATH = he stands there at ease),
`world/population.mjs` (every person is an entity with a role, one of eight behaviour states and a place), hero route placement in `world/index.mjs`,
drawing in `kingdom-life.mjs` (people by state, footprints behind a walking hero), settled confetti on the plaza in a release aftermath.

| Gate | Result |
|---|---|
| Tests | 104 / 104 (92 earlier + 12 choreography tests) |
| Rule D | 38 world states, now including every phase of every story: release at 5 min / 20 min / 13 h / expired, raid start and peak, CI warning and fire, recovery peak and aftermath, harvest start / peak / aftermath, an achievement walk to the hall and the party at the hall. All cameras agree, NPCs included |
| Phase model | exact boundaries tested for every timeline; `ageMinutes` is real (release 3 h = 180, raid 25 min = 25) |
| Hero path | during START he gets strictly closer to the destination every minute, is always on a road segment, starts at his routine place and arrives exactly when START ends; all routes between all routine places and destinations are valid |
| People | all eight states appear; raid: villagers flee, guards rush then fight, win = guards celebrate, loss = guards run; release: crowd gathers, celebrates (up to 8 in front of the castle), rests; CI: guards and builders run to the fortress with buckets, a crew repairs it; harvest: farmers celebrate; achievement: a small crowd at the hall; night: sleepers; rain: fewer people, umbrellas |
| Cameras / states / sizes | all 7 cameras generated for 19 states and consistency-checked; overworld, hero and camp sheets reviewed at 12 states; timeline sheets for release, raid, CI and hall (`gallery/phase-4/`) |

Review notes, found and fixed: (1) the scene still treated a 50-hour-old release as active, contradicting the phase model: the scene now drops expired stories; (2) the CI ALERT plaque sat on the hero's head (moved onto the tower);
(3) the hero standing at the hall hid the lower row of trophies (his hall place and the crowd moved onto the cross road); (4) a night world had nobody asleep because that account has no village houses (sleepers now rest beside any building);
(5) my own timeline tool split the event id `ach:first-star` and showed the wrong scene: a tooling bug, not an engine bug, found because the picture contradicted the passing unit test.
Honest limits: walkers are ambient loops that start at their place (the manifest records the start place); the hero is not mirrored when he walks left; the event camera that aims at the primary story is built in phase 7.

## Phase 5: visual evolution (closed)

Built: two new lifecycle looks in `render/growth.mjs` (FOUNDATION: survey flag, stone heap, dust; FLOURISHING: new wing with chimney at level 4, garden, lamps at the door, golden pennant),
lifecycle passed from the world model to every building, a golden glow over the castle after dark for prosperous and legendary kingdoms, roaming merchants spread out when there are no stalls,
two new demo worlds (`legendary`: power 95 with flourishing projects; `festival`: 30 visitors), `engine/dev/showcase.mjs` (the lifecycle, side by side), `test/evolution.test.mjs`.
The power-tier visuals (roads, lamps, pennants, flowers, plaza, stalls, villager density, crown) and the four camp states were already in the shared pipeline from phase 2 and are reviewed here.

| Gate | Result |
|---|---|
| Tests | 110 / 110 (104 earlier + 6 evolution tests) |
| Rule D | all 21 demo worlds (two new) and 38 edge and timeline states: every camera agrees |
| Lifecycle | ten looks (eight lifecycle states, level 4 and 5 flourishing, quiet vs forgotten) are ten different pictures for a house, a tower and a library; the world model gives each repository its state and changing the input changes the picture |
| Power tiers | five different kingdoms: dirt roads and nothing else, lamps and a stall, gravel and flower beds, cobblestones and a fountain, paved gold-trimmed roads with a golden statue, four stalls, a crown; people density never decreases with power; a legendary castle glows at night |
| Camp | EMPTY (stake, white flag, ghost tent places), CAMP, VILLAGE (huts, lanterns, second fire), FESTIVAL (bunting, big fire); exactly one tent per visitor, never more than twelve |
| Seasons | winter puts snow on barn, windmill, huts and roofs and frost on bare plots; the winter ground and the summer ground are different colours in every camera |
| Reviewed by eye | lifecycle sheet, tier sheet (five tiers), camp sheet (four states), overworld of six lifecycle-heavy worlds, mobile 358 px preview (`gallery/phase-5/`); all 21 states x all cameras generated and consistency-checked |

Review notes: found and fixed (1) at the lowest tier the roaming merchants bunched into a queue, (2) two test assertions that counted merged paths instead of testing presence (a test bug, not a picture bug).
Honest limit: the demo data cannot produce a power below 27 (followers and the no-workflow credit), so the "struggling village" tier is shown by overriding the power value in the review tool and in the tests; a brand-new real account would get it naturally.

## Phase 6: world-linked quests (closed)

Built: `world/quests.mjs` (quest targets: every shown, active quest resolves to an object of the world; `nextFreeSlot`; `markerFits`), quest markers drawn in the shared pipeline (`drawQuests` in `kingdom-life.mjs`:
a badge with the object's icon, a bobbing arrow, a glow on the primary quest, and for "start a new project" a staked building plot at the first free slot of the districts),
a finished quest sends the hero and a small crowd to the object it pointed at (`QUEST_ANCHOR` in `world/phases.mjs`, generalised walk labels in `scene.mjs`), `test/quests-world.test.mjs`.
No quest text is written in the world (one visual home): the markers are icons and arrows only. The quest strip that lists progress is recomposed in phase 7 and will use the same target icons.

| Gate | Result |
|---|---|
| Tests | 118 / 118 (110 earlier + 8 quest tests) |
| Rule D | all 21 demo worlds + 38 edge/timeline states: every camera agrees; quest markers are part of the manifest and the completeness check (a marker is drawn exactly when a camera can show all of it) |
| Targets | streak -> farm, stars -> vault, issues -> dungeon, CI -> fortress, release -> castle, new project -> a staked free plot in the districts (falls back to the plaza when every slot is taken); locked and completed quests have no marker; no quest data at all does not crash |
| Completion | a finished quest makes the hero walk to its object and celebrate there with a small crowd (farm, vault, gate, fortress, castle tested) |
| Reviewed by eye | overworld of six worlds with markers, the staked plot and vault marker, finished-quest celebrations at the vault and farm, farm and dungeon cameras (`gallery/phase-6/`); all 21 states x all cameras generated and consistency-checked |

Review notes, found and fixed: (1) the dungeon marker was cut in half at the bottom edge of the farm camera: a marker is now drawn only in a camera that can show all of it, and the test checks this exactly for every camera;
(2) my own test expected the farm camera to show the streak marker, which contradicted that rule (test corrected: the farm is the home of the streak, its own number says it).
Honest limits: the hero does not walk to the object of an active (unfinished) quest, only to that of a finished one; the quest strip still prints the old tiles until phase 7.

## Phase 7: README recomposition (closed)

Built: the compact quest and power strip (`render/hud.mjs`: crown, tier name, power, one bar, up to three quests each with the icon of the object it points at; the four stat tiles are gone),
the EVENT camera (a window aimed at the place of the most important story: castle, gate, failing building, vault, farm; with a phase tag and chips for the other stories; absent when nothing is happening),
a 720 px history panel at the minimum text size, a shorter hero card (no XP numbers: the bar says it), tighter camera frames, the README panel registry (`PANELS`),
the dungeon registered as a world object (`K.note`), the rule that a standing building is drawn only by a camera that holds its foot, and two rule tests: `mobile.test.mjs` (Rule B) and `homes.test.mjs` (Rule C).

| Gate | Result |
|---|---|
| Tests | 130 / 130 (118 earlier + 6 mobile + 6 one-visual-home) |
| Rule B, text | over 1,000 strings in 9 pictures x 9 worlds, at 360, 390 and 430 px: every one at least 8.5 px tall; no text is ever written inside the scaled world; every picture is 720 px wide; the small status badge is never scaled down |
| Rule B, length | normal day 4.14 picture widths vs V1 5.15 (19.6 % shorter); with an event picture 4.64 vs 5.36 (13 % shorter); all 21 demo worlds inside their budget; whole README about 1,540 px tall at 390 px (V1: about 1,840) |
| Rule B, composition | the hero card is 0.44 of its width tall, so the world starts within 174 px at 390 px; no more than 9 full-width panels; every panel has its own purpose; the event picture exists exactly while there is a story; the README block holds under 120 characters of raw text |
| Rule C | every string in every picture, in 14 world states, is something that picture owns; the quest strip and the hero card carry no GitHub statistic; compact references exist only in the picture of their own home; every home object stands in the overworld; the dungeon and the vault change when their signal changes |
| Rule D | all 21 demo worlds + 38 edge states, now also: no standing building is drawn by a camera that does not hold its foot |
| Reviewed by eye | recomposed panels, the real README at 390 px for a normal day and a release day, the event camera across nine stories, the quest strip across 12 states, the hall after the stray-pennant fix (`gallery/phase-7/`) |

Review notes, found and fixed: (1) a 6.4 px label failed the text rule, which turned out to be the fixed-size status badge shown at its natural size (the test now renders each picture on its own and checks the badge separately);
(2) the Trophy Hall picture's description read "undefined of 16 achievements unlocked": the field is `count`, not `unlocked` (found by the one-visual-home test, which now also forbids `undefined`, `NaN` and `[object` in every title and description);
(3) a stray yellow pennant poked into the Trophy Hall picture from a flourishing library standing far to the south: standing buildings are now drawn only by a camera that holds their foot, and a test enforces it for every camera in 59 world states;
(4) the castle quest marker no longer fit under the tighter sky crop and was moved onto the castle roof.
Honest limits: the 25 % first target for README length was not reached (19.6 %, see the plan); the district strip still shows the same buildings as the overworld, with plates: it is the largest remaining repeated view.

## Phase 8: art pass (closed)

Built (all in the shared pipeline, so every camera benefits): **depth order** (people and the hero are sorted together with the buildings by the y of their feet; the gate is deep, so guards on its wall are drawn after it),
**one shadow** (`K.shadow`, from `STYLE.shadow`: light from the upper left, one opacity; it replaced seven ad-hoc shadows and gave a shadow to the castle, vault, hall, fortress, gate, stalls and every standing person),
the **hero turns round** when he walks west, a **softer glow** (the pulsing golden haze scales with how dark it is: a hint by day, a glow by night; the many lamps of a rich kingdom use the small halo; every lamp's light is exactly the size of its lantern),
`test/art.test.mjs`.

| Gate | Result |
|---|---|
| Tests | 135 / 135 (131 earlier + 4 art tests). Whole suite 36 s |
| Depth | drawing order is non-decreasing for all 21 demo worlds; every person and the hero are in the depth order; guards at the gate are in front of it |
| Shadow | every landmark, every non-abandoned building and every standing person has a shadow of the one style, in 5 worlds |
| Hero | walking west he is mirrored (also in his portrait), walking east he is not |
| Light | the celebration glow is at least 1.8 times stronger at night than by day; the legendary avenue of lamps uses small halos |
| Size / speed | largest picture 258 KB (limit 450 KB); all pictures of a world render in about 100 ms together |
| Rule D | all 21 demo worlds + 38 edge states, every camera consistent after the art pass |
| Reviewed by eye | overworld in 6 states, hero portraits in 12 states and in the evening states after the lantern fix, camp in festival / day / night / winter, districts in legendary and storm (`gallery/phase-8/`) |

Review notes, found and fixed: (1) at close zoom the lit lamp posts beside the hero were chunky yellow squares because each lamp's light rectangle (3 x 3) was larger than its lantern (2.25 x 2): now exactly the lantern;
(2) my first glow test measured unrelated halos (the hall's trophy glows) instead of the celebration spot: the test now targets the pulsing spot.
Honest limits: people who walk north-south across a building are depth-sorted by where their walk begins (they are ambient loops); the festival camp is crowded on purpose, and its speech bubble covers part of the bunting.

## Phase 9: integration (closed) and final result

Built: `test/integration.test.mjs`, `docs/TRUE-V2.md` (the architecture, the four rules, how to extend it), the final acceptance checklist in the plan, a refresh of the repository's own `renderer/*.svg` and README block.

| Gate | Result |
|---|---|
| Tests | **143 / 143**: the 68 original tests (no original test file was modified: every test change in the repository is an addition) + 75 TRUE V2 tests |
| Matrix | 4 seasons x 4 hours x 4 weathers (64 worlds), all 12 scene modes, 6 stories x 4 phases (24 worlds): every camera draws, lints clean, stays under 450 KB, and agrees with every other camera |
| Edge accounts | an empty account (no repositories, stars, calendar, visitors, achievements, quests) draws and builds its README; a 90-repository account draws all cameras in under 4 s, nobody is lost, nobody shares a slot |
| Fault isolation | breaking achievements, calendar, visitors, quests, hero, power, featured projects or history one at a time fails only the picture that needs that part; the README block always builds |
| Hostile text | names, descriptions, visitor messages, quest titles and event titles full of markup never produce active content; no repository text ever enters a manifest |
| Outside the test suite | 218 pictures (21 worlds x all cameras): **byte-identical** between two separate processes under different machine timezones (UTC vs Pacific/Auckland), **all well-formed XML**, largest 258 KB; full suite about 45 s |

Found and fixed in this phase: the README builder crashed when a quest list or achievement list was missing (descriptions are now composed lazily and fall back to a plain sentence; structural conditions are null-safe);
two of my own integration expectations were wrong (the mine repository is drawn under its own id; the final pipeline output, not each raw renderer, is what must be lint-clean for hostile text).

### What was delivered, in one line each
One map and one world model; one drawing pipeline with seven cameras plus an event camera; hall, farm and camp as real places; repository districts and eight lifecycle looks;
five power tiers; hero routes and eight people states reacting to start / peak / aftermath of every story; world-linked quests; a recomposed mobile README (19.6 % shorter) with no duplicated statistics;
one shadow, depth order, shared light; tests for all four rules; the original engine, tests, automation and security unchanged.

### Honest limits
README is 19.6 % shorter, not 25 %; the district strip repeats the buildings of the overworld (with plates); walkers are ambient loops (their start place is what is recorded); the hero walks to the object of a finished quest, not of an active one;
the demo data cannot reach power below 27; not run on real GitHub Actions or against GitHub's SVG sanitiser (no network here).
