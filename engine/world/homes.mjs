// RULE C: one visual home. Every important GitHub signal has exactly ONE primary visualisation, its home object in the world.
// Anywhere else the same number may appear only as a compact reference (icon + number, one line, never a bar, tile grid, chart or scene).
export const VISUAL_HOME = Object.freeze({
  stars:         { home: 'vault',      object: 'vault' },
  issues:        { home: 'dungeon',    object: 'dungeon' },
  ci:            { home: 'fortress',   object: 'ci' },
  commits:       { home: 'builders',   object: 'builders' },
  prs:           { home: 'messengers', object: 'messengers' },
  releases:      { home: 'castle',     object: 'castle' },
  contributions: { home: 'farm',       object: 'farm' },
  streak:        { home: 'farm',       object: 'farm' },
  achievements:  { home: 'hall',       object: 'hall' },
  visitors:      { home: 'camp',       object: 'camp' },
  population:    { home: 'npcs',       object: 'npcs' },
});

/** Where each quest track points in the world (the quest strip shows this marker, and the world shows it too). */
export const QUEST_TARGET = Object.freeze({
  streak: 'farm', stars: 'vault', gate: 'dungeon', recover: 'ci', release: 'castle', build: 'district', kingdom: 'castle',
});

/**
 * Compact references a picture is allowed to print: signal -> one icon + one number. Anything else a picture writes must be its own subject
 * (a name, a title, a quest). The hero HUD no longer repeats the streak: the farm is its home. The quest strip repeats nothing.
 */
export const COMPACT_REFS = Object.freeze({
  hero: [], quest: [], events: [], districts: [], history: [],
  world: ['issues'],                 // the plaque on the dungeon crust: the dungeon is part of the overworld
  dungeon: ['issues'],
  harvest: ['streak', 'contributions'],
  trophies: ['achievements'],
  camp: ['visitors'],
});

export const isCompact = (signal) => Object.values(COMPACT_REFS).some((l) => l.includes(signal));
