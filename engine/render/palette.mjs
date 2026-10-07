// palette.mjs — locked color strategy (spec §04.10).
// Base palette + state accents + season / time-of-day / weather variants.
// Pure data + pure functions; no RNG here (variants chosen by callers).
export const BASE = {
  grass: '#5fae4e', grassDark: '#4c9240', grassLight: '#7cc465', dirt: '#8a6b45',
  dirtDark: '#6e5433', stone: '#9aa0a8', stoneDark: '#747b84', stoneLight: '#c3c9d1',
  wood: '#8a5a33', woodDark: '#66401f', woodLight: '#ab7a45',
  water: '#3f7fbf', waterDeep: '#2b5e93', waterFoam: '#d5ecf7',
  roofClay: '#b5543c', roofSlate: '#5a6b7d', roofThatch: '#c9a24b', roofKingdom: '#2f6fb2',
  gold: '#e8b93c', goldLight: '#f7d774', plaster: '#e8dcc0', plasterDark: '#cbbd97',
  navy: '#1d2433', charcoal: '#141a26', ink: '#0c1017',
  snow: '#eef4f7', snowDark: '#d3dde4',
};

export const STATE = {
  healthy: '#58c472', active: '#4fc3e8', celebration: '#f2c14e', celebrationPink: '#f28bb4',
  warning: '#f0a53c', danger: '#e0523c', recovery: '#6fe0b8', night: '#2a3a5e',
};

// Day-band lighting tints. `sky` = gradient stops [top, mid, horizon].
// `overlay` is a world-tint wash (never a flat black); night bands lean on
// emissives + dark sky instead of an overlay.
export const BANDS = {
  predawn:  { sky: ['#3a4a6b', '#6b7fa6', '#a8b4c8'], sun: '#c8d4e8', shadow: '#2c3852', wash: null, lamps: false, windows: 'dim' },
  dawn:     { sky: ['#5a6b9e', '#c98a6b', '#f2c189'], sun: '#ffd9a0', shadow: '#4a4468', wash: null, lamps: true,  windows: 'dim' },
  morning:  { sky: ['#4f9be0', '#8fc3ee', '#d8ecfa'], sun: '#fff3d6', shadow: '#3d5a80', wash: null, lamps: false, windows: 'off' },
  noon:     { sky: ['#3f8fd8', '#7fbde9', '#cfe8fa'], sun: '#ffffff', shadow: '#33507a', wash: null, lamps: false, windows: 'off' },
  afternoon:{ sky: ['#4a8fd4', '#9cc3e2', '#f2dfae'], sun: '#ffe9b0', shadow: '#3d4a72', wash: null, lamps: false, windows: 'off' },
  sunset:   { sky: ['#3c3f74', '#a05a7e', '#f0915e'], sun: '#ff9e5e', shadow: '#33305a', wash: null, lamps: true,  windows: 'warm' },
  evening:  { sky: ['#232c52', '#3a4472', '#5e5a8c'], sun: '#8a7fb8', shadow: '#1c2240', wash: null, lamps: true,  windows: 'warm' },
  night:    { sky: ['#0e1526', '#16223e', '#24365c'], sun: '#5a6b9e', shadow: '#0a0e1a', wash: null, lamps: true,  windows: 'lit' },
  deepnight:{ sky: ['#080d1a', '#0e1628', '#182642'], sun: '#3a4666', shadow: '#060a14', wash: null, lamps: true,  windows: 'lit' },
};

export const SEASONS = {
  spring: { grass: '#66b85a', grassDark: '#4f9a46', leaf: '#5fae4e', leafAlt: '#8fd07a', accent: '#f2a4c0', ground: null },
  summer: { grass: '#5fae4e', grassDark: '#4c9240', leaf: '#4c9240', leafAlt: '#6fbf5c', accent: '#f7d774', ground: null },
  autumn: { grass: '#7aa04c', grassDark: '#5f7f3a', leaf: '#c97b3c', leafAlt: '#d8a24b', accent: '#e07b3c', ground: null },
  winter: { grass: '#b9c6cd', grassDark: '#9fb0b9', leaf: '#8a9aa4', leafAlt: '#a9b8c0', accent: '#eef4f7', ground: '#e6edf2' },
};

export const WEATHER_TINT = {
  clear: null,
  rain:  { road: '#5e5a52', grassMul: 0.88, haze: ['#8fa3b8', 0.25], clouds: true },
  storm: { road: '#4e4a44', grassMul: 0.78, haze: ['#5a6a80', 0.45], clouds: true },
  snow:  { road: '#cfd8dc', grassMul: 1.0, haze: ['#dfe8ee', 0.2], clouds: true },
  aurora:{ road: null, grassMul: 0.95, haze: ['#3c5a6e', 0.15], clouds: false },
};

/** Multiply a hex color by f (0..1.2) for weather/season shading. */
export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  const r = c(n >> 16), g = c((n >> 8) & 255), b = c(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** Palette resolved for one render: base + season + band + weather. */
export function resolvePalette({ season = 'summer', band = 'morning', weather = 'clear' } = {}) {
  const s = SEASONS[season] ?? SEASONS.summer;
  const b = BANDS[band] ?? BANDS.morning;
  const w = WEATHER_TINT[weather] ?? {};
  const mul = w.grassMul ?? 1;
  // Night is a real lighting redesign, not a black overlay: terrain tones are
  // darkened per band while emissives (windows, lamps, torches) carry the
  // scene. Deep night must be unmistakable at a glance.
  const night = band === 'night' || band === 'deepnight';
  const nightMul = band === 'deepnight' ? 0.42 : band === 'night' ? 0.5
    : band === 'evening' ? 0.66 : band === 'sunset' || band === 'dawn' ? 0.8
    : band === 'predawn' ? 0.6 : 1;
  const nm = (hex) => nightMul >= 1 ? hex : shade(hex, nightMul);
  const windowColor = b.windows === 'lit' ? '#ffca6a'
    : b.windows === 'warm' ? '#e8a84e'
    : b.windows === 'dim' ? '#8a7a5a' : null;
  return {
    ...BASE,
    grass: nm(shade(s.grass, mul)), grassDark: nm(shade(s.grassDark, mul)), grassLight: nm(shade(s.leafAlt, mul)),
    leaf: nm(s.leaf), leafAlt: nm(s.leafAlt), seasonAccent: s.accent,
    dirt: nm(BASE.dirt), dirtDark: nm(BASE.dirtDark),
    snowGround: s.ground, // non-null in winter: snow cover color
    sky: b.sky, sun: b.sun, shadow: b.shadow,
    lampsOn: b.lamps, lampGlow: b.lamps, windowMode: b.windows, windowColor,
    roadTint: w.road ?? null, haze: w.haze ?? null, clouds: !!w.clouds,
    band, season, weather, night, nightMul,
  };
}
