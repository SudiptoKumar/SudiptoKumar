# World reference

For contributors: what the districts are, what lives in them, and how
GitHub signals become world facts. The normative contract is the spec
(`spec/06-GITHUB-DATA-TO-WORLD-MAPPING.md`); this is the field guide.

## Districts (19)

| District | Purpose | GitHub home |
|---|---|---|
| capital | Royal castle, plaza, treasury, Hall of Heroes | identity, releases, achievements |
| projects | Repository buildings on plots | repositories |
| workshops | Forge, laboratory, warehouse, smith work | — (craft flavor) |
| residential | Citizen homes on streets | — |
| market | Market square, merchants, courier station | stars (prosperity) |
| knowledge | Library / knowledge hall, scholars | docs-flavored repos |
| guild | Hero Guild hall + training ground; hero home | profile identity |
| farms / orchard | Contribution fields, mill | contributions |
| military / warfront | Barracks, armory, frontier watch | war states |
| harbor | Docks, ships, visitor entry | visitors |
| visitors | Visitor camp plots, tents, inn | visitors |
| automation | Automation Fortress | CI / workflow health |
| dungeon / ruins | Issue pressure; goblin cohort; adventure area | issues |
| highforest / mountains | Scouting, shrine, northern boundary | — |

Roads connect every district in one graph; the hero and NPCs travel on
real road nodes.

## Building lifecycle (11 states)

`empty → foundation → construction → active → upgrading → flourishing`,
plus `damaged → repairing → recovered`, and `sleepy / abandoned` for
inactive repositories. An archived repository with fresh pushes is
`repairing` (scaffolding + repair crews). States are visual: sleepy
buildings dim, damaged ones crack and smoke, repairing ones wear
scaffolding.

## Cameras (10)

`grand` (whole world), `capital`, `projects`, `farm`, `warfront`,
`dungeon`, `guild`, `harbor`, `hero` (tracking), `event` (only when
something is happening — null when quiet). Plus `grand-mobile`, the
responsive variant. Cameras frame; they never move the world.

## Entities

Hero (the profile owner, real coordinates, travels to event anchors),
companion, and deterministic NPCs with roles, homes, workplaces, and
schedules: builders, farmers, guards, scouts, smiths, merchants,
scholars, engineers, messengers, visitors.

## GitHub → world cause → effect

One signal → one primary physical home. Verified end to end by
`engine/test/mapping-e2e.test.mjs`.

| GitHub signal | World home | Manifestation |
|---|---|---|
| Repository | project quarter plot | archetype (keyword → language → deterministic fallback), level from stars, lifecycle from activity, language flavor |
| Repository age | building maturity | `foundation` (<30d) → `active` → `sleepy` (>90d idle) → `abandoned` (>365d idle) |
| Recent pushes | builders/workforce | `construction` lifecycle, worker count, brighter activity |
| Featured repo | project quarter | `flourishing`, prominent placement |
| Archived + fresh pushes | affected building | `repairing`: scaffolding, repair crews |
| Stars | treasury / reputation | building level, monument quality |
| Issues (open) | dungeon | pressure tiers: dormant 0, watchful 1–3, active 4–10, crowded 11–20, crisis 21+; glow color + goblin count scale |
| CI health | Automation Fortress | beacon: steady-green / amber-pulse / red-alarm + smoke + engineers / amber-steady + scaffolding / neutral-dim when unknown (never faked) |
| Release | Castle / Royal Plaza | announcement event; at peak: banners, confetti, fireworks, story banner, hero travels to the plaza |
| Contributions | farm district | crop maturity (fallow → sprouting → growing → mature → harvest), season-aware rendering; streak ≥ 7 → glowing maintained-field marker |
| Achievements | Hall of Heroes | statue / banner / plaque / trophy / monument per unlocked achievement; locked ones stay abstract |
| Visitors | harbor / visitor camp | entries anchored at `harbor_docks`/`visitor_camp`, tents on camp plots, README listing; hostile text sanitized, presence kept |
| Pull requests | courier network | qualitative messenger intensity (formula below) — documents runs between the project quarter and the castle; quiet when none/unknown |
| Inactivity | relevant buildings | sleepy shading, dimmed windows, fewer workers |
| Partial API failure | affected system | last-known value (marked `stale`) or visibly neutral (`unknown`) — never coerced to success/failure |

### Pull requests → courier intensity (formula)

No-fake-data rule: the world never shows a precise PR count — the
courier network has one qualitative vocabulary:

```text
active PRs = open PRs + PRs merged within 30 days
0       → none      — messengers keep their quiet routine
1–2     → trickle   — occasional courier runs
3–7     → active    — document runs: project quarter → castle
8+      → surge     — courier surge between projects and castle
unknown → neutral   — fetch failed: no fake couriers, quiet routine
```

Mechanically, `none`/`trickle` leave the base schedule alone;
`active`/`surge` set messengers to `traveling` on document runs
(priority 50, below harvest, above construction) and reroute their
wander legs onto the `project_quarter → castle_gate` corridor.
Ingestion is bounded (≤ 5 repos, ≤ 10 PRs each, ≤ 20 total) and a
failing repo never breaks the others.

## Time

Day bands (predawn → deepnight), four seasons, weather (clear / rain /
storm / snow / aurora — aurora never in daylight). War phases run
PEACE → SCOUTING → … → BATTLE → AFTERMATH → RECOVERY → RESOLVED.
Events choreograph ANNOUNCED → APPROACH → PEAK → AFTERMATH → RECOVERY →
RESOLVED, with fx intensity scaled by phase.
