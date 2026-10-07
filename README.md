# Kingdom V3

A living pixel-art RPG kingdom generated from real GitHub activity.
GitHub Actions is the game server: every few hours the kingdom re-reads
your profile and redraws itself — repositories become buildings, issues
stir the dungeon, CI health moves the fortress beacon, releases raise
celebration banners over the castle, contributions grow the farms,
achievements raise statues in the Hall of Heroes, and visitors pitch
tents at the harbor.

Node ≥ 20 · ESM · **zero dependencies** · deterministic (same input →
byte-identical world).

## How it works

```
GitHub API ──fetch──▶ snapshot ──normalize──▶ state ──build──▶ world
                                                              │
world ──simulate──▶ tick snapshot ──render──▶ SVG assets ──compose──▶ README.md
```

One meaningful GitHub signal has **one primary physical home**
([mapping contract](docs/WORLD.md#github--world-cause--effect)). Unknown
signals stay visibly neutral — the kingdom never fakes certainty.

## Quickstart

```sh
npm test          # full suite — must be 100% green
npm run lint      # syntax + determinism + SVG safety gate

# Build your kingdom (needs kingdom.config.json with your GitHub "owner";
# without GH_TOKEN it renders a clearly-marked offline demo fixture):
node engine/cli.mjs update

# Re-render pictures + profile README from the saved world:
node engine/cli.mjs render

# Render the 20 deterministic demo scenarios (never touches data/):
node engine/cli.mjs demo --out ../demos

# Process one visitor issue-form event / prune old visitor data / lint:
node engine/cli.mjs visitors --event event.json
node engine/cli.mjs cleanup
node engine/cli.mjs lint
```

`update` = fetch → normalize → persist → build → simulate → render →
README. Generated assets land in `renderer/` (pictures + `README.md`,
the profile README); raw inputs in `data/`.

### Config

Create `kingdom.config.json` and set your GitHub username:

```json
{
  "owner": "your-github-login",
  "displayName": "Your Kingdom",
  "worldSeed": "your-github-login",
  "timezone": "Asia/Dhaka",
  "hemisphere": "northern",
  "links": { "website": "https://example.com", "x": "https://x.com/you" }
}
```

In production the workflows run `update` on a schedule, on every release,
daily for achievements, on visitor issues, and weekly for cleanup
(see `.github/workflows/`).

## Architecture map

| Layer | Dir | Owns |
|---|---|---|
| Ingest | `engine/github.mjs` | GitHub REST collection, per-section failure isolation |
| Domain | `engine/domain/` | snapshot normalization, cause→effect mapping, achievements, offline fixture |
| World | `engine/world/` | **one** canonical world: map, districts, roads, plots, buildings, entities |
| Simulation | `engine/simulation/` | deterministic tick: clock, actors, construction, war, economy, events |
| Render | `engine/render/` | 10 cameras into the same world, SVG painters, README composer |
| Validation | `engine/validation/` | SVG safety lint, sanitization, invariants, schema, budgets |
| CLI | `engine/cli.mjs` | `update`/`render`/`demo`/`visitors`/`cleanup`/`lint` contracts |

Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/WORLD.md](docs/WORLD.md).

## Budgets

SVG design target ≤ 450 KiB per asset, hard ceiling 600 KiB; README
total ≤ 6 MiB; mobile grand ≤ 200 KiB. Every asset is safety-linted
before it is written — no `<script>`, no event handlers, no external
URLs, all user text escaped.

## Gallery

[docs/gallery/](docs/gallery/) — 8 curated scenarios (day, night,
release peak, war battle/aftermath, winter, rain…) with desktop + mobile
grand views. The full 20-scenario set is built by `demo` outside the repo.

## Release notes

[docs/RELEASE-NOTES-V3.md](docs/RELEASE-NOTES-V3.md) · [docs/V3-STATUS.md](docs/V3-STATUS.md)
(V3 release checklist, honest per-item status).
