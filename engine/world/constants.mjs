// TRUE V2 / shared constants. Every camera of the kingdom reads these, nothing else defines a scale.
//
// One grid for the whole world: 176 x 240 units, one unit = U svg units.
// Everything that has a position (buildings, people, crops, tents, trophies) uses these units.

export const GW = 176, GH = 240, U = 4;
export const GROUND_Y = 212;            // the surface ends here, the underground starts
export const SKY_H = 62;                // sky + far mountains are drawn above this line

/** Drawing scale of a thing, in grid units per art pixel. One table, so a hero is the same size in every view. */
export const SCALE = Object.freeze({
  hero: 1,                              // 12 x 16 art pixels  -> 12 x 16 units
  npc: 0.75,                            // 6 x 9               -> 4.5 x 6.75 units
  goblin: 0.75,
  crop: 0.25,                           // 10 x 10 crop sprite -> 2.5 x 2.5 units (one plot)
  trophy: 0.5,                          // 8 x 8 icon          -> 4 x 4 units (one pedestal)
  tent: 1,                              // 8 x 6 tent          -> 8 x 6 units
  tree: 1,
  building: Object.freeze({ 1: 0.75, 2: 0.75, 3: 0.75, 4: 0.75, 5: 1 }),   // by evolution level
});

export const ROAD_W = Object.freeze({ main: 6, cross: 5, path: 3 });

/** Shared look: one shadow, one light direction, one outline colour, for every object in every view. */
export const STYLE = Object.freeze({
  shadow: Object.freeze({ color: '#000000', opacity: 0.15, dx: 1, dy: 0 }),   // dx: the light comes from the upper left
  lightDir: Object.freeze([-1, -1]),
  outline: '#1a1c2c',
  minTextScale: 3,                      // smallest pixel-font scale allowed on a 720 px picture (mobile rule)
});

/** The farm: one calendar, drawn once. 26 weeks (columns) x 7 weekdays (rows). */
export const PLOT = Object.freeze({ cols: 26, rows: 7, w: 3, h: 2.5, x: 4, y: 170 });

/** Output width of every picture. READMEs scale it down; text rules are checked against this. */
export const OUT_W = 720;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
