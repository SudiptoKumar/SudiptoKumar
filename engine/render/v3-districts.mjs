// TRUE V3 districts: war front, builder's yard, hero guild, harbor.
// Drawn in the overworld so the V3 cameras (viewBox crops) show real content.
import { C } from './palette.mjs';
import { L } from './kingdom-layout.mjs';
import { stone, crenel } from './buildings.mjs';
import { local } from './buildings.mjs';

/** Draw the war front: barricades, watchtower, scorched earth south of the gate. */
function drawWarfront(K) {
  const { p, S } = K;
  const [x, y] = L.warfront;
  const raid = S.raid?.active;

  // Scorched earth patch
  p.ellipse(x, y + 4, 28, 8, '#3a2a1a', 0.6);

  // Barricades (wooden stakes)
  for (const bx of [x - 20, x - 8, x + 8, x + 20]) {
    p.r(bx - 3, y - 6, 6, 6, '#5d3a1a');
    for (let s = 0; s < 3; s++) p.r(bx - 2 + s * 2, y - 10, 1, 6, '#7a4a2b');
  }

  // Watchtower
  const d = local(p, x - 24, y - 8, 1, K.bctx);
  stone(d, -4, -20, 8, 20); crenel(d, -4, -20, 8);
  d.r(-5, -22, 10, 2, '#7a4a2b');
  d.win(-1, -14, 2, 3, K.night);

  // Warning beacon (lit if raid active)
  p.r(x + 24, y - 12, 2, 12, '#4e2f1c');
  if (raid) {
    p.raw('<g class="fl">').r(x + 22, y - 18, 6, 6, C.orange).r(x + 24, y - 20, 2, 2, C.yellow).raw('</g>');
    K.lights.push({ x: x + 22, y: y - 18, w: 6, h: 6, glow: 1 });
  } else {
    p.r(x + 22, y - 18, 6, 6, '#566c86');
  }
}

/** Draw the builder's yard: scaffolds, material piles, crane. */
function drawBuilderYard(K) {
  const { p, S } = K;
  const [x, y] = L.builderyard;
  const sim = S.simulation;
  const working = sim?.actors.filter((a) => a.role === 'builder').length || 0;

  // Material piles (wood, stone)
  p.r(x - 12, y + 2, 10, 4, '#7a4a2b');  // wood pile
  p.r(x - 11, y, 8, 2, '#a86b3c');
  p.r(x + 4, y + 2, 10, 4, '#8a8a8a');   // stone pile
  p.r(x + 5, y, 8, 2, '#b6c9e0');

  // Scaffold (unfinished structure)
  p.r(x - 6, y - 16, 1, 16, '#7a4a2b'); p.r(x + 6, y - 16, 1, 16, '#7a4a2b');
  p.r(x - 6, y - 16, 13, 1, '#7a4a2b'); p.r(x - 6, y - 8, 13, 1, '#7a4a2b');
  p.r(x - 4, y - 14, 8, 6, '#d4a574', 0.7);  // partial wall

  // Crane/pulley
  p.r(x + 12, y - 20, 1, 20, '#4e2f1c');
  p.r(x + 12, y - 20, 8, 1, '#4e2f1c');
  p.r(x + 19, y - 19, 1, 8, '#2a1a0a');
  p.r(x + 18, y - 11, 3, 3, '#8a8a8a');  // hanging stone

  // Builders at work (if any)
  if (working > 0) {
    // Simple builder figures with hammers
    for (let i = 0; i < Math.min(working, 3); i++) {
      const bx = x - 4 + i * 6, by = y + 6;
      p.r(bx, by - 6, 2, 6, '#3b5dc9');  // body
      p.r(bx, by - 8, 2, 2, '#f4c89a');  // head
      p.raw('<g class="hm" style="animation-duration:1s">').r(bx + 2, by - 8, 3, 1, '#7a4a2b').raw('</g>');  // hammer
    }
  }
}

/** Draw the hero guild: hall with banners, training dummies, weapon rack. */
function drawHeroGuild(K) {
  const { p } = K;
  const [x, y] = L.heroguild;

  // Guild hall (smaller than castle)
  const d = local(p, x, y, 1, K.bctx);
  stone(d, -14, -10, 28, 10); crenel(d, -14, -10, 28);
  stone(d, -8, -20, 16, 10); crenel(d, -8, -20, 16);
  d.r(-1, -26, 2, 6, '#4e2f1c'); d.r(1, -26, 5, 3, '#b48cf0');  // purple banner
  d.win(-4, -14, 2, 3, K.night); d.win(2, -14, 2, 3, K.night);

  // Training dummies
  for (const dx of [-20, 20]) {
    p.r(x + dx, y - 8, 2, 8, '#7a4a2b');
    p.r(x + dx - 2, y - 12, 6, 4, '#d4a574');
  }

  // Weapon rack
  p.r(x - 24, y - 4, 6, 1, '#4e2f1c');
  p.r(x - 23, y - 10, 1, 6, '#8a8a8a');  // sword
  p.r(x - 21, y - 10, 1, 6, '#7a4a2b');  // staff
}

/** Draw the harbor: dock at the river. */
function drawHarbor(K) {
  const { p } = K;
  const [x, y] = L.harbor;

  // Wooden dock
  p.r(x - 10, y, 20, 3, '#7a4a2b');
  for (const px of [-8, 0, 8]) p.r(x + px, y + 3, 2, 6, '#5d3a1a');

  // Moored boat
  p.ellipse(x, y - 4, 8, 3, '#8c5a2b');
  p.r(x - 1, y - 12, 2, 8, '#4e2f1c');
  p.r(x + 1, y - 12, 6, 5, '#f4f4f4', 0.9);  // sail
}

/** Draw all V3 districts. Called from paintWorld after drawPlaces. */
export function drawV3Districts(K) {
  drawWarfront(K);
  drawBuilderYard(K);
  drawHeroGuild(K);
  drawHarbor(K);
}
