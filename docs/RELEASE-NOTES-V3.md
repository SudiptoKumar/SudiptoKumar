# Kingdom V3 — Release Notes

## What V3 is

V3 rebuilds the kingdom as **one canonical world** instead of a set of
cards. Geography, people, hero, events, construction, war, and GitHub
cause→effect form a single coherent place, rendered by 10 cameras that
frame — never invent.

## New in V3

- **Canonical world model** (`engine/world/`): one coordinate system,
  one road graph, 19 districts, plots, buildings, entities, world
  signature + content hash. Cameras crop the same world.
- **GitHub cause→effect mapping** (`engine/domain/mapping.mjs`):
  repos→buildings (archetype/level/lifecycle/flavor), issues→dungeon
  pressure tiers, CI→fortress beacon states, releases→royal-plaza
  celebrations, contributions→farm maturity, achievements→Hall of
  Heroes, visitors→harbor camp. Unknown signals stay neutral, never
  faked. Locked in by `engine/test/mapping-e2e.test.mjs`.
- **Live GitHub ingest** (`engine/github.mjs`): `update` fetches user,
  repos, issues, workflow runs, releases, and contribution activity with
  per-section failure isolation. Achievements are derived
  deterministically from the snapshot. No token → clearly-marked
  offline demo fixture (fully offline-capable).
- **Deterministic simulation** (`engine/simulation/`): clock, actors
  with homes/workplaces/schedules, construction with material staging,
  war phases (peace→scouting→…→battle→aftermath→recovery), farm
  economy, event choreography with phase-scaled fx.
- **README as a journey** (`engine/render/readme.mjs`): identity →
  grand kingdom → current story → hero journey → districts → history →
  guild. Quiet states show daily life only — no invented drama.
- **CLI contracts**: `update` (fetch→normalize→persist→build→simulate→
  render→README), `render`, `demo` (never touches `data/`),
  `visitors` (strict issue-form processing), `cleanup`, `lint`.
- **Workflows** (`.github/workflows/`): 6-hour game tick, release
  reaction, daily achievements, issue-driven visitors, weekly cleanup —
  each running `update` with error isolation and committing generated
  assets.
- **Security**: `lintSvg` over every asset, sanitization of all
  untrusted text (repo names, hero names, visitor messages, achievement
  and release titles), hostile-text scenario, login allowlisting,
  24h visitor rate limiting.

## Budgets

SVG ≤ 450 KiB design target (600 KiB hard ceiling), README ≤ 6 MiB,
mobile grand ≤ 200 KiB — enforced at render time.

## Upgrade notes

- V3 is a fresh build, not a patch on V2. Config is
  `kingdom.config.json` (see `kingdom.config.example.json`).
- Generated assets live in `renderer/`; raw inputs in `data/`.
- `demo` renders 20 scenarios outside the repo (`../demos/` by
  default); only the curated 8-scenario gallery ships in
  `docs/gallery/`.

## Known limitations

- The 6-hour tick commits even when only the tick timestamp changed
  (`world-state.json` records each run).
- Contribution activity from the REST API is a ~90-day public-events
  approximation (marked `approximate` in the snapshot).
- CI status reads the `owner/owner` profile repo's workflow runs;
  without it, CI shows neutral.
- Visual QA sheets are generated; final human review (spec §27's
  "what do you think this is?" test) is still open.
