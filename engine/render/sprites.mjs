// All pixel art lives here as text pictures. "." means empty.
import { makeSprite, drawSprite, withRows } from './pixel.mjs';
import { C } from './palette.mjs';

const S = (rows, pal) => makeSprite(rows, pal);

// ---------------------------------------------------------------- hero
// Body (rows 6-15) is shared. The head (rows 0-5) changes for each class.
const BODY = [
  '...obbbbo...',
  '..obbaabbo..',
  '.ombbbbbbmo.',
  '.ombbbbbbmo.',
  '..obBBBBbo..',
  '..olloollo..',
  '..olloollo..',
  '..oLLooLLo..',
  '.oLLLooLLLo.',
  '.oooo..oooo.',
];
const FACE = ['..osossoso..', '...osssso...'];
const HEADS = {
  adventurer: ['....oooo....', '...ohhhho...', '..ohhhhhho..', '..ohssssho..', ...FACE],
  paladin: ['....oRRo....', '...oAAAAo...', '..oAAAAAAo..', '..oAssssAo..', ...FACE],
  rogue: ['....oooo....', '...ohhhho...', '..ohhhhhho..', '..ohHssHho..', ...FACE],
  mage: ['.....oo.....', '....ohho....', '...ohYYho...', '.ohhhhhhhho.', ...FACE],
  ranger: ['....oooo..w.', '...ohhhho.w.', '..ohhhhhhow.', '..ohssssho..', ...FACE],
  berserker: ['.w..oooo..w.', '.ww.oAAo.ww.', '..oAAAAAAo..', '..oAssssAo..', '..osossoso..', '...oHHHHo...'],
  alchemist: ['....oooo....', '...ohhhho...', '..oGccGccGo.', '..ohssssho..', ...FACE],
  smith: ['....oooo....', '...ohhhho...', '..ohhhhhho..', '..ohssssho..', '..osossoso..', '...oHssHo...'],
  merchant: ['....oooo....', '...ohhhho...', '.ohhhhhhhho.', '..ohssssho..', ...FACE],
};
const BASEPAL = {
  o: C.ink, s: C.skin, S: C.skinD, h: '#7a4a2b', H: '#4e2f1c', b: '#3b5dc9', B: '#29366f', a: C.yellow,
  m: C.skin, l: '#4e2f1c', L: '#2b1a10', A: C.silver, R: C.red, Y: C.yellow, w: C.white, G: C.slate, c: C.cyan,
};
// colour changes for each class
export const HERO_STYLE = {
  adventurer: { pal: {}, item: 'sword' },
  paladin: { pal: { b: '#94b0c2', B: '#566c86', a: C.yellow, m: '#94b0c2', h: '#4e2f1c', l: '#3b5dc9', L: '#29366f' }, item: 'sword', off: 'shield' },
  rogue: { pal: { h: '#2f3b3f', H: '#566c86', b: '#2b2e4d', B: '#1a1c2c', a: C.red, m: '#2b2e4d', l: '#1a1c2c', L: '#1a1c2c' }, item: 'dagger' },
  mage: { pal: { h: '#5d275d', b: '#3b5dc9', B: '#29366f', a: C.cyan, m: '#3b5dc9', l: '#29366f', L: '#1a1c2c' }, item: 'staff' },
  ranger: { pal: { h: '#257179', b: '#38b764', B: '#257179', a: C.yellow, m: '#38b764', l: '#7a4a2b', L: '#4e2f1c' }, item: 'bow' },
  berserker: { pal: { b: '#b13e53', B: '#5d275d', a: C.yellow, m: C.skin, H: '#ef7d57', l: '#4e2f1c', L: '#2b1a10' }, item: 'axe' },
  alchemist: { pal: { h: '#a7f070', b: '#73eff7', B: '#3b5dc9', a: C.white, m: C.skin, l: '#566c86', L: '#333c57' }, item: 'flask' },
  smith: { pal: { h: '#94b0c2', H: '#333c57', b: '#ef7d57', B: '#b13e53', a: '#7a4a2b', m: C.skin, l: '#333c57', L: '#1a1c2c' }, item: 'hammer' },
  merchant: { pal: { h: '#a86b3c', b: '#ffcd75', B: '#e0a030', a: '#b13e53', m: C.skin, l: '#7a4a2b', L: '#4e2f1c' }, item: 'bag' },
};
export const ITEMS = {
  sword: { spr: S(['.A.', '.A.', '.A.', '.A.', '.A.', '.A.', 'YYY', '.n.', '.n.'], { A: C.stoneL, Y: C.yellow, n: '#7a4a2b' }), dx: 10, dy: 2 },
  dagger: { spr: S(['.A.', '.A.', '.A.', 'YYY', '.n.'], { A: C.stoneL, Y: C.red, n: '#4e2f1c' }), dx: 10, dy: 5 },
  staff: { spr: S(['.c.', 'ccc', '.c.', '.n.', '.n.', '.n.', '.n.', '.n.', '.n.', '.n.', '.n.', '.n.', '.n.', '.n.'], { c: C.cyan, n: '#7a4a2b' }), dx: 10, dy: -3 },
  bow: { spr: S(['nn.', '.nw', '.nw', 'n.w', 'n.w', 'n.w', '.nw', '.nw', 'nn.'], { n: '#7a4a2b', w: C.white }), dx: 10, dy: 2 },
  axe: { spr: S(['..nAA', '..nAA', '..nAA', '..nA.', '..n..', '..n..', '..n..', '..n..'], { n: '#7a4a2b', A: C.stoneL }), dx: 9, dy: 3 },
  flask: { spr: S(['.ww.', '.cc.', 'cGGc', 'cGGc', '.cc.'], { w: C.white, c: C.cyan, G: C.lime }), dx: 10, dy: 6 },
  hammer: { spr: S(['AAAAA', 'AAAAA', 'DDDDD', '..n..', '..n..', '..n..', '..n..'], { A: C.stoneL, D: C.stoneD, n: '#7a4a2b' }), dx: 9, dy: 4 },
  bag: { spr: S(['.nn.', 'nnnn', 'nYYn', 'nnnn', '.nn.'], { n: '#a86b3c', Y: C.yellow }), dx: 10, dy: 7 },
};
export const OFFHAND = {
  shield: { spr: S(['AAAA', 'ARRA', 'ARRA', 'ARRA', '.AA.'], { A: C.stoneL, R: C.red }), dx: -3, dy: 6 },
};
export const HERO_W = 12;
export const HERO_H = 16;
/** Draw the hero. (x, y) = top-left of the 12x16 body. s = grid units per pixel. */
export function drawHero(p, x, y, archetype = 'adventurer', o = {}) {
  const st = HERO_STYLE[archetype] || HERO_STYLE.adventurer;
  const head = HEADS[archetype] || HEADS.adventurer;
  const spr = S(withRows([...head, ...BODY], head), { ...BASEPAL, ...st.pal });
  const s = o.s ?? 1;
  if (o.items !== false) {
    const off = st.off && OFFHAND[st.off];
    if (off) drawSprite(p, off.spr, x + off.dx * s, y + off.dy * s, { s });
  }
  drawSprite(p, spr, x, y, { s });
  if (o.items !== false) {
    const it = ITEMS[st.item];
    if (it) drawSprite(p, it.spr, x + it.dx * s, y + it.dy * s, { s });
  }
}

// ---------------------------------------------------------------- small people
const NPC_ROWS = ['..hh..', '.hhhh.', '.hssh.', '..ss..', '.bbbb.', 'sbbbbs', '.bbbb.', '.l..l.', '.k..k.'];
export const NPC = {
  villager: S(NPC_ROWS, { h: '#7a4a2b', s: C.skin, b: '#ef7d57', l: '#4e2f1c', k: '#2b1a10' }),
  villager2: S(NPC_ROWS, { h: '#1a1c2c', s: C.skinD, b: '#3b5dc9', l: '#333c57', k: '#1a1c2c' }),
  villager3: S(NPC_ROWS, { h: '#ffcd75', s: C.skin, b: '#a7f070', l: '#566c86', k: '#333c57' }),
  builder: S(['.yyyy.', 'yyyyyy', '.hssh.', '..ss..', '.bbbb.', 'sbbbbs', '.bbbb.', '.l..l.', '.k..k.'], { y: C.yellow, h: '#7a4a2b', s: C.skin, b: '#ef7d57', l: '#4e2f1c', k: '#2b1a10' }),
  farmer: S(['.tttt.', 'tttttt', '.hssh.', '..ss..', '.bbbb.', 'sbbbbs', '.bbbb.', '.l..l.', '.k..k.'], { t: C.thatch, h: '#7a4a2b', s: C.skin, b: '#38b764', l: '#3b5dc9', k: '#2b1a10' }),
  guard: S(['.AAAA.', 'AAAAAA', '.hssh.', '..ss..', '.bbbb.', 'sbbbbs', '.bbbb.', '.l..l.', '.k..k.'], { A: C.stoneL, h: '#4e2f1c', s: C.skin, b: '#b13e53', l: '#333c57', k: '#1a1c2c' }),
  traveler: S(['..hh..', '.hhhh.', '.hssh.', '..ss..', 'nbbbb.', 'nbbbbs', 'nbbbb.', '.l..l.', '.k..k.'], { h: '#5d275d', s: C.skin, b: '#41a6f6', n: '#a86b3c', l: '#4e2f1c', k: '#2b1a10' }),
  courier: S(['..hh..', '.hhhh.', '.hssh.', '..ss..', '.bbbb.', 'sbbbbw', '.bbbbw', '.l..l.', '.k..k.'], { h: '#2f3b3f', s: C.skin, b: '#73eff7', w: C.white, l: '#333c57', k: '#1a1c2c' }),
  visitor: S(['..hh..', '.hhhh.', '.hssh.', '..ss..', '.bbbb.', 'sbbbbs', '.bbbb.', '.l..l.', '.k..k.'], { h: '#a86b3c', s: C.skin, b: '#ffcd75', l: '#4e2f1c', k: '#2b1a10' }),
  sleeper: S(['......', '......', '......', '......', 'hhsbbb', 'hssbbb', 'hhsbbb', '......', '......'], { h: '#7a4a2b', s: C.skin, b: '#ef7d57' }),
};
export const GOBLIN = S(['g.gggg.g', 'gggggggg', '.grggrg.', '.gggggg.', '.gwggwg.', '..nnnn..', '.gnnnng.', '.gg..gg.'], { g: '#4cae3a', r: C.red, w: C.white, n: '#7a4a2b' });
export const GOBLIN2 = S(['g.gggg.g', 'gggggggg', '.grggrg.', '.gggggg.', '.gwggwg.', '..nnnn..', '.gnnnng.', '.gg..gg.'], { g: '#7bc34a', r: C.red, w: C.white, n: '#566c86' });

// ---------------------------------------------------------------- nature
export const TREE_OAK = S([
  '...LLLLL...', '..LLlLLLL..', '.LLlLLLLLL.', '.LlLLLLLLD.', 'LLLLLLLLLDD', 'LLLLLLLLDDD', '.LLLLLLDDD.', '..LLLDDDD..', '....ttt....', '....ttt....',
], { L: '#2f9e5b', l: '#4fd070', D: '#257179', t: '#7a4a2b' });
export const TREE_PINE = S([
  '....L....', '...LLL...', '..LLlLL..', '...LLLD..', '..LLLLLD.', '.LLlLLLDD', 'LLLLLLLDD', '....t....', '....t....',
], { L: '#2f9e5b', l: '#4fd070', D: '#257179', t: '#7a4a2b' });
export const BUSH = S(['.LLL.', 'LLlLL', 'LLLLD'], { L: '#2f9e5b', l: '#4fd070', D: '#257179' });
export const ROCK = S(['.AAA.', 'AAwAA', 'ADDDD'], { A: '#8a94a6', w: '#b8c2d0', D: '#5e687c' });

// crops: one picture for each growth step
const SOIL_D = '#4e2f1c';
const CP = { l: '#a7f070', L: '#38b764', D: SOIL_D, O: '#ef7d57', R: '#b13e53', Y: '#ffcd75', y: '#fff0a0', g: '#6aa84f', G: '#e0a030' };
export const CROP = [
  null,
  S(['..........', '..........', '..........', '..........', '..........', '..........', '....l.l...', '.....L....', '.....L....', '..........'], CP),
  S(['..........', '..........', '..........', '..........', '...l...l..', '..lLl.lLl.', '...LlLL...', '.....L....', '.....L....', '..........'], CP),
  S(['..........', '.....l....', '...l.L.l..', '..lLlLlLl.', '...LLLLL..', '..l.LL.l..', '....LL....', '.....L....', '.....L....', '..........'], CP),
  S(['...l.l....', '..lLLLl...', '.lLLOLLl..', '.LLOOOLL..', '..LLOLL...', '..l.LL.l..', '....LL....', '.....L....', '.....L....', '..........'], CP),
  S(['..y.l.y...', '.lLLLLLl..', 'lLOLLLOLl.', 'LLOOLOOLL.', '.LOOLLOOL.', '..LLOLLl..', '...LLLL...', '.....L....', '.....L....', '..........'], CP),
];
export const WHEAT = S(['..y..y..y.', '.yY.yY.yY.', '.yY.yY.yY.', '..Y..Y..Y.', '..g..g..g.', '..g..g..g.', '..g..g..g.', '..g..g..g.', '..g..g..g.', '..........'], CP);

// ---------------------------------------------------------------- icons (8 wide)
export const ICON = {
  star: S(['...YY...', '...YY...', 'YYYYYYYY', '.YYYYYY.', '..YYYY..', '..YYYY..', '.YY..YY.', '.Y....Y.'], { Y: C.yellow }),
  coin: S(['..YYYY..', '.YYGGYY.', 'YYGYYGYY', 'YYGYYGYY', 'YYGYYGYY', 'YYGGGGYY', '.YYYYYY.', '..YYYY..'], { Y: C.yellow, G: C.goldD }),
  flame: S(['...RR...', '..RRR.R.', '.RRORRR.', '.RROORR.', 'RROOYORR', 'RROYYORR', '.ROYYOR.', '..ROOR..'], { R: C.red, O: C.orange, Y: C.yellow }),
  shield: S(['AAAAAAAA', 'ABBBBBBA', 'ABBAABBA', 'ABBAABBA', 'ABBBBBBA', '.ABBBBA.', '..ABBA..', '...AA...'], { A: C.stoneL, B: C.blue }),
  sword: S(['...AA...', '...AA...', '...AA...', '...AA...', '...AA...', '.YYYYYY.', '...nn...', '...nn...'], { A: C.stoneL, Y: C.yellow, n: '#7a4a2b' }),
  crown: S(['Y..YY..Y', 'YY.YY.YY', 'YYYYYYYY', 'YRYYYYRY', 'YYYYYYYY', 'GGGGGGGG'], { Y: C.yellow, R: C.red, G: C.goldD }),
  trophy: S(['YYYYYYYY', 'Y.YYYY.Y', 'Y.YYYY.Y', '.YYYYYY.', '..YYYY..', '...YY...', '...YY...', '..GGGG..'], { Y: C.yellow, G: C.goldD }),
  rocket: S(['...AA...', '..AAAA..', '..AcAA..', '..AAAA..', '.RAAAAR.', '.R.AA.R.', '...OO...', '...RR...'], { A: C.white, c: C.sky, R: C.red, O: C.orange }),
  flag: S(['nRRRR...', 'nRRRRR..', 'nRRRR...', 'n.......', 'n.......', 'n.......', 'n.......', 'nn......'], { n: '#a86b3c', R: C.red }),
  gear: S(['...YY...', '.Y.YY.Y.', '..YYYY..', 'YYY..YYY', 'YYY..YYY', '..YYYY..', '.Y.YY.Y.', '...YY...'], { Y: C.silver }),
  house: S(['...RR...', '..RRRR..', '.RRRRRR.', 'RRRRRRRR', '.WWWWWW.', '.WWBBWW.', '.WWBBWW.', '.WWWWWW.'], { R: C.red, W: C.stoneL, B: '#7a4a2b' }),
  bolt: S(['....YY..', '...YY...', '..YY....', '.YYYYYY.', '...YY...', '..YY....', '.YY.....', 'YY......'], { Y: C.yellow }),
  sun: S(['Y..YY..Y', '.Y.YY.Y.', '..YYYY..', 'YYYYYYYY', 'YYYYYYYY', '..YYYY..', '.Y.YY.Y.', 'Y..YY..Y'], { Y: C.yellow }),
  moon: S(['..WWWW..', '.WWW....', 'WWW.....', 'WWW.....', 'WWW.....', 'WWWW....', '.WWWWWW.', '..WWWW..'], { W: C.white }),
  cloud: S(['........', '..AAA...', '.AAAAAA.', 'AAAAAAAA', 'AAAAAAAA', '.AAAAAA.'], { A: C.stoneL }),
  rain: S(['..AAA...', '.AAAAAA.', 'AAAAAAAA', '.AAAAAA.', '.c..c..c', 'c..c..c.'], { A: C.silver, c: C.sky }),
  lock: S(['..AAAA..', '.A....A.', '.A....A.', 'AAAAAAAA', 'AAAddAAA', 'AAAddAAA', 'AAAAAAAA', 'AAAAAAAA'], { A: C.slate, d: C.dark }),
  check: S(['......GG', '.....GG.', 'GG..GG..', '.GGGG...', '..GG....'], { G: C.lime }),
  castle: S(['A.A..A.A', 'AAAAAAAA', 'AAAAAAAA', 'AAA..AAA', 'AAA..AAA', 'AAA..AAA'], { A: C.stoneL }),
  book: S(['.RRRRRR.', 'RWWWWWWR', 'RWRRRRWR', 'RWWWWWWR', 'RWRRRRWR', 'RWWWWWWR', '.RRRRRR.'], { R: C.red, W: C.white }),
  wheat: S(['..Y..Y..', '.YY.YY.Y', '.YY.YY.Y', '..Y..Y..', '..g..g..', '..g..g..', '..g..g..', '..g..g..'], { Y: C.yellow, g: '#6aa84f' }),
  skull: S(['.WWWWWW.', 'WWWWWWWW', 'WKKWWKKW', 'WKKWWKKW', 'WWWKKWWW', '.WWWWWW.', '.WKWKWK.', '..WWWW..'], { W: C.white, K: C.ink }),
  moneybag: S(['..nnn...', '...n....', '.nnnnn..', 'nnYYYnn.', 'nnYnYnn.', 'nnYYYnn.', '.nnnnn..'], { n: '#a86b3c', Y: C.yellow }),
  users: S(['.AA..AA.', '.AA..AA.', 'AAAAAAAA', 'AAAAAAAA', 'AA.AA.AA', 'AA.AA.AA'], { A: C.cyan }),
  arrow: S(['YYYYYYY', '.YYYYY.', '..YYY..', '...Y...'], { Y: C.yellow }),
  hammer: S(['.AAAA...', '.AAAA...', '..nn....', '..nn....', '..nn....', '..nn....'], { A: C.stoneL, n: '#7a4a2b' }),
  potion: S(['..WW....', '..cc....', '.cGGc...', 'cGGGGc..', 'cGGGGc..', '.cccc...'], { W: C.white, c: C.cyan, G: C.lime }),
  fork: S(['A.A.A...', 'A.A.A...', 'AAAAA...', '..A.....', '..A.....', '..A.....'], { A: C.silver }),
  tent: S(['...RR...', '..RRRR..', '.RRWWRR.', 'RRRWWRRR', 'RRWWWWRR', 'RWWWWWWR'], { R: C.red, W: C.white }),
};

export function drawIcon(p, name, x, y, s = 1, pal) {
  const spr = ICON[name];
  if (!spr) return 0;
  drawSprite(p, spr, x, y, { s, pal });
  return spr.w * s;
}
export { drawSprite, makeSprite };
