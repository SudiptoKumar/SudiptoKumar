// One shared colour set (a 16-colour retro palette + a few earth tones).
export const C = {
  ink: '#1a1c2c', plum: '#5d275d', red: '#b13e53', orange: '#ef7d57', yellow: '#ffcd75',
  lime: '#a7f070', green: '#38b764', teal: '#257179', navy: '#29366f', blue: '#3b5dc9',
  sky: '#41a6f6', cyan: '#73eff7', white: '#f4f4f4', silver: '#94b0c2', slate: '#566c86', dark: '#333c57',
  // extras
  night: '#0e1024', panel: '#20223a', panel2: '#2b2e4d',
  wood: '#7a4a2b', woodD: '#4e2f1c', woodL: '#a86b3c', thatch: '#d9a066',
  stone: '#8a94a6', stoneD: '#5e687c', stoneL: '#b8c2d0',
  skin: '#f2c49b', skinD: '#d59a6b',
  gold: '#ffcd75', goldD: '#e0a030', goldL: '#fff0a0',
  grass: '#38b764', grassD: '#2e9e57', grassL: '#4fd070',
  dirt: '#b98a54', dirtD: '#94683c', dirtL: '#d3a66e',
  water: '#41a6f6', waterD: '#3b5dc9', waterL: '#73eff7',
};

/** Season looks. The map reads these values. */
export const SEASONS = {
  spring: { grass: '#57c96f', grass2: '#46b25f', speck: ['#ff9ecb', '#f4f4f4', '#ffcd75'], leaf: '#6bd67a', leaf2: '#3ea85b', trunk: '#7a4a2b', water: '#41a6f6', snow: false, label: 'SPRING' },
  summer: { grass: '#38b764', grass2: '#2e9e57', speck: ['#ffcd75', '#f4f4f4', '#ef7d57'], leaf: '#2f9e5b', leaf2: '#257179', trunk: '#7a4a2b', water: '#41a6f6', snow: false, label: 'SUMMER' },
  autumn: { grass: '#8fae3c', grass2: '#789a2d', speck: ['#ef7d57', '#ffcd75', '#b13e53'], leaf: '#ef7d57', leaf2: '#b13e53', trunk: '#6a3f25', water: '#3b9ad8', snow: false, label: 'AUTUMN' },
  winter: { grass: '#e3eff8', grass2: '#c9dcec', speck: ['#ffffff', '#b8d4ea', '#94b0c2'], leaf: '#2f7a5b', leaf2: '#e9f4fb', trunk: '#5a3820', water: '#bfefff', snow: true, label: 'WINTER' },
};

/** Sky colours for each time of day: gradient stops from top to horizon. */
export const SKY = {
  dawn: ['#3b5dc9', '#8a5cc0', '#ef7d57', '#ffcd75'],
  day: ['#3c9cf0', '#6cbcf7', '#a8e2fb', '#d6f4fb'],
  evening: ['#3a2a6e', '#8c3a6a', '#ef7d57', '#ffcd75'],
  night: ['#080a22', '#10163c', '#1d2a66', '#2b3d86'],
};
/** Dark tint laid over the whole map. [colour, opacity] */
export const TINT = {
  dawn: ['#b06a8a', 0.14],
  day: [null, 0],
  evening: ['#8a3a5a', 0.22],
  night: ['#070a2a', 0.5],
};
// ---- colour helpers ----
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (a) => '#' + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
/** mix(a, b, 0..1) */
export const mix = (a, b, t) => { const x = hex(a), y = hex(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };
export const lighten = (c, t = 0.3) => mix(c, '#ffffff', t);
export const darken = (c, t = 0.3) => mix(c, '#000000', t);
