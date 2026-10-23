# V1 audit (what V2 was built on)

```
GitHub (GraphQL + REST) ──► github.mjs  collect() ─┐
mock.mjs (same snapshot shape, demos/tests) ───────┤
                                                   ▼
store.mjs  data/*.json  ──►  state.mjs  buildState({snap,cfg,now,store})
 (achievements, events,        ├─ rules.mjs         XP, levels, streaks, class, weather, repo state, formulas
  visitors, history,           ├─ achievements.mjs  16 achievements (4 secret), never un-unlock
  avatars)                     ├─ events.mjs        milestones, derived events, raids, defense
                               └─ history.mjs       daily points, backfill, compaction
                                                   ▼
                             data/world-state.json  (the "save file")
                                                   ▼
cli.mjs ASSETS[] ─► render/*.mjs (pure: state → SVG string) ─► safety.lintSvg ─► renderer/*.svg
   primitives: pixel.mjs (Pix, sprites, ANIM_CSS, svgDoc) · font.mjs · palette.mjs · sprites.mjs · ui.mjs
   scenes:     scenery.mjs · buildings.mjs · world.mjs
   cards:      hero · stats · hall · repos · harvest · chronicle · camp · status · buttons · fallback
                                                   ▼
                            readme.mjs buildBlock() → README.md (between KINGDOM markers)
Visitors: issue forms ─► visitors.mjs (validate/sanitize/limits) ─► data/visitors.json, events.json (raids)
Actions:  world-update (6h) · stats-update (release/star/fork) · achievement-update (daily)
          visitor-update (issues) · cleanup (weekly) · import-zip (legacy, untouched)
```

## Reusable as-is (kept)
GitHub collector, mock snapshot, XP/level/streak/class/weather rules, achievements, events, raids and their
limits, visitor validation + sanitizer + avatar checks, history store, SVG lint, fallback cards, pixel font,
`Pix` canvas, sprites, buildings, scenery, store, workflows.

## Presentation debt (replaced in V2)
nav buttons, intro prose, "Today in the kingdom" feed, map legend, permanent map labels, stats card,
repository card grid, raw repository list, full-width history chart, big status card, red/green dashboard buttons.
