# V3 Status — release checklist (spec §27)

Honest per-item status as of 2026-10-07 (final QA + red-team pass).
✅ = verified by tests or direct inspection ·
🟡 = built, awaiting human/CI confirmation ·
⬜ = open.

## Product

- ✅ The main README reads as one kingdom (composer: identity → grand → story → hero → districts → history → guild).
- ✅ The world is the interface (10 cameras into one canonical world).
- 🟡 The visual identity is substantially different from V2 (pixel-art world vs cards; built, not human-reviewed).
- ✅ The castle/capital anchors the civilization.
- ✅ Districts are connected by believable roads/terrain (road-graph reachability tests).

## World

- ✅ One canonical World model (`buildWorld`).
- ✅ One coordinate system.
- ✅ One road/navigation graph.
- ✅ No camera-local geography (cameras crop only).
- ✅ No duplicate farms/castles/heroes (invariant tests).

## Civilization

- ✅ Houses/residential areas exist. ✅ Market exists. ✅ Farms exist.
- ✅ Workshops exist. ✅ Knowledge area exists. ✅ Military area exists.
- ✅ Harbor/visitor route exists. ✅ Dungeon exists.

## Citizens

- ✅ Multiple meaningful roles. ✅ Schedules. ✅ Homes. ✅ Workplaces.
- ✅ Destinations. ✅ Deterministic movement (seeded simulation).

## Hero

- ✅ Hero has real world coordinates. ✅ Hero can travel.
- ✅ Hero reacts to major events. ✅ Hero remains consistent across cameras.
- ✅ Companion follows consistently.

## Construction

- ✅ Builders exist. ✅ Materials exist visually.
- ✅ Multi-stage construction story. ✅ Repair state exists.

## War

- ✅ Peace. ✅ Scout. ✅ Alert. ✅ Battle. ✅ Outcome. ✅ Aftermath. ✅ Repair. ✅ Recovery.

## GitHub integration

- ✅ Repository → building. ✅ Issues → dungeon. ✅ CI → fortress.
- ✅ Releases → castle event. ✅ Contributions → farm/workforce.
- ✅ Achievements → hall/monument. ✅ Visitors → harbor/camp.
- ✅ Pull requests → courier network (NEW 2026-10-07: `fetchPullRequests`
  bounded ingestion → qualitative `none/trickle/active/surge` intensity →
  messenger task intensity + project-quarter→castle document routes;
  unknown/failed → neutral, never fake couriers).
- (All eight verified end to end: `engine/test/mapping-e2e.test.mjs` +
  `engine/test/pull-requests.test.mjs`.)

## Visual

- ✅ Original art direction (built by the render pipeline).
- 🟡 Castle silhouette works (rendered; not human-reviewed).
- ✅ Terrain feels natural (built; contact sheets generated).
- ✅ Roads are legible (rendered + reachable-graph tests).
- 🟡 NPCs readable (rendered; not human-reviewed).
- ✅ Event effects readable (fx presence asserted in tests).
- 🟡 Night is convincing (rendered; not human-reviewed).
- ✅ Seasons visibly affect world (season-gated rendering tests).

## Mobile

- ✅ grand-mobile variant rendered for scenarios.
- 🟡 360/390/430 px validation (mobile sheet generated in build/demos; not human-reviewed).
- ✅ Main world recognizable / text readable / no horizontal overflow (responsive `<picture>` strategy; awaiting human check).

## Engineering

- ✅ Baseline tests pass — 164/164 green (129 carried + 35 new:
  21 PR→courier, 6 red-team, 6 hostile-battery, 2 traceability).
- ✅ All new tests pass. ✅ Safety tests pass (hostile battery:
  `<script>`, event handlers, `javascript:`/`vbscript:`, 500-char,
  emoji, RTL, null bytes — all inert or rejected).
- ✅ Determinism tests pass (incl. 3× separate-process
  build+simulate+render probe: byte-identical SVGs + README).
- ✅ Size budgets pass (enforced at render; verified: largest asset
  211 KiB / 600 KiB ceiling, 450 KiB target; mobile max 197.4 KiB /
  200 KiB — tightest budget, watch item; READMEs < 4 KiB / 6 MiB).
- ✅ Cache/hash tests pass. 🟡 Workflow contracts pass locally; workflows not yet run in CI.

## Red-team (2026-10-07)

- ✅ Missing fields (no language/pushed_at/stars, null descriptions,
  empty arrays, `hero: null`, unknown weather) → no crash, neutral rendering.
- ✅ Renderer failure injection (torn world: `buildings: 42`) → the
  failing asset falls back to a lint-clean plaque, remaining assets
  complete, README still generated.
- ✅ Repeated identical updates → `writeIfChanged` holds (second run
  writes nothing; zero spurious diffs).
- ✅ Two hardening fixes from the battery: `esc()` now strips ASCII
  control bytes (null bytes can no longer reach SVG output);
  `sanitizeMessage` rejects `javascript:`/`vbscript:` scheme text
  (previously acceptable as text but tripped the SVG safety lint —
  a plantable publish blocker).

## Visual QA

- 🟡 Grand world / event / day-night / war / mobile contact sheets generated under `build/demos/` — awaiting human review.

## Final human test

- ⬜ **Open.** Show the README to someone without the spec and ask
  “What do you think this is?” Target answer: “a living RPG kingdom
  representing your GitHub/work.”
- (Coordinator performed a visual review of the renders on 2026-10-07;
  the independent “what do you think this is?” test is still open —
  not marked passed.)

## Gate summary

- `npm test`: 164/164 ✅ · `npm run lint`: clean ✅ · 89/89 demo SVGs safety-lint clean ✅
- Determinism: 3 separate processes, same input → byte-identical world,
  7 SVGs + README ✅
  (world c1cf5a7ddb8d2d7d · grand 2bad01fc63611ba2 · grand-mobile d9f6b9354a645622 · readme b69a8d3177f09aab)
- Traceability: all 17 spec §06 rows → world homes asserted in
  `mapping-e2e.test.mjs`; all 19 districts have spatial homes ✅
- Gallery: 8 scenarios, desktop + mobile + README each, ≤ 8 MB (see below)
- Blockers before calling V3 done: human visual review of contact sheets + the final human test.
