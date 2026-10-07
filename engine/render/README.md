# engine/render — from-scratch V3 pixel-art render pipeline

One world renderer, many compositions (spec §09.1):

```text
world -> simulation snapshot -> RenderScene -> camera/crop -> asset
```

## Entry points

```js
import { renderCamera, renderAllCameras, CAMERA_IDS } from './index.mjs';
import { buildScenario, SCENARIOS } from './scenarios.mjs';
import { composeReadme } from './readme.mjs';

const { world, snap } = buildScenario('release-peak');
const { svg, hash, bytes, problems, usedFallback } =
  renderCamera(world, snap, 'grand', { variant: 'desktop' });
// event camera when quiet: renderCamera(world, snap, 'event') === null
```

## Module map

| module | role |
|---|---|
| `palette.mjs` | locked color strategy: base + state accents + season/band/weather variants; `resolvePalette()` |
| `svg.mjs` | tiny SVG string helpers (integer coords) |
| `sprites.mjs` | reusable `<defs>`: 3 tree types, bush, rock, tuft, fence, lamp, patterns (grass/cobble/water/till), gradients; `buildDefs(pal, light)` |
| `lighting.mjs` | `deriveLighting()` once per render from band/weather/season/event/war; night = emissive redesign, never a black overlay; aurora gated to dusk/night |
| `terrain.mjs` | mountains, grass base, river + harbor bay + 3 bridges, forest, farm fields + orchard, expansion reserves (quiet) |
| `roads.mjs` | major/minor hierarchy from the world road graph, cobble texture, wet sheen |
| `buildings.mjs` | 23 archetypes × 11 lifecycle states; castle centerpiece; CI-state fortress beacon; scaffolding/construction states |
| `actors.mjs` | role-differentiated characters (prop/hat/facing/walk pose), hero (7 gear tiers), companion, carts, enemies |
| `effects.mjs` | snapshot fx (banners/confetti/fireworks/lanterns/smoke/fire/alarm/signal-fire/dust/debris/scaffolding), war extras (barricades/projectiles/damage), harvest sparkles, weather overlays |
| `scene.mjs` | the pipeline: `sceneObjects()` (full camera-free drawable list) → `cullDrawables()` → `sortDrawables()` → SVG; `renderScene()` |
| `camera.mjs` | 10 lock cameras; `getCamera()`; `isQuiet()`; `activeStory()`; `event` is null when quiet |
| `hud.mjs` | status strip, event banner, hero chip, quest marker, landmark labels (LOD1+) |
| `readme.mjs` | `composeReadme()` per spec §10: identity → grand → story (conditional) → hero → districts → history → guild |
| `budgets.mjs` | `enforceBudget()`: 600 KiB hard ceiling → fallback plaque; 450 KiB target / 200 KiB mobile reported |
| `hash.mjs` | `renderContentHash()` covers world/schema + renderer + art + camera + anim + sim versions + snapshot + camera; ART bump forces re-render |
| `fallback.mjs` | `isolate()` / `fallbackAsset()`: one failed asset never kills the run; no stacks in output |
| `scenarios.mjs` | the 20 deterministic demo scenarios + `buildScenario()` full pipeline |
| `register.mjs` | plugs cameras into `engine/cli.mjs`'s asset registry for the `render` command |

## Contracts the renderer relies on (and never violates)

- Cameras frame only: every coordinate comes from `world` (buildings, districts,
  roads, anchors) or the simulation `snapshot` (actors, fx, war, clock).
- Decorative RNG is per-object via `subRng(world.seed, subsystem, objectId)` —
  culling never shifts anything between cameras.
- Determinism: same (world, snapshot, camera) → byte-identical SVG.
- Hero may be null; event camera is null when quiet; partial failures stay neutral.
- Safety: `lintSvg` on every asset; all user text through `esc()`; no
  `<script>`/handlers/`javascript:`/foreignObject anywhere.

## CLI

- `node engine/cli.mjs demo [--out DIR] [--only name,...]` → 20 scenarios under
  `~/workspace/kingdom-v3/build/demos/<name>/` (grand + grand-mobile + close
  camera + hero + event? + README.md), outside the repo.
- `node engine/cli.mjs render [--world FILE] [--bucket NAME] [--out DIR] [--only a,b]`
  → camera SVGs + README.md for a built world.
- `node scripts/contact-sheet.mjs` → 5 review sheets in the demos dir.
