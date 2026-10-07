// actors.mjs — role-differentiated pixel characters (spec §04.8).
// Readable at a glance: head + body color + role prop + facing + walk pose.
// Positions come from the simulation snapshot only; the painter never moves
// anyone. LOD0 = simplified 2-rect sprites; LOD1+ = full detail.
import { R, C, E, P, LN } from './svg.mjs';
import { subRng } from '../util.mjs';

const SKIN = ['#e8b88a', '#d8a06e', '#c08858', '#a06a42'];

// role -> { tunic, pants, prop, hat }
const ROLES = {
  builder:   { tunic: '#8a5a33', pants: '#5a3d24', prop: 'hammer', hat: 'cap' },
  farmer:    { tunic: '#5f8f3c', pants: '#6b4f2c', prop: 'basket', hat: 'straw' },
  guard:     { tunic: '#3d5a7a', pants: '#2e343f', prop: 'shield', hat: 'helm' },
  engineer:  { tunic: '#4a4f5a', pants: '#33363d', prop: 'gear', hat: 'goggles' },
  messenger: { tunic: '#b53c3c', pants: '#4a3226', prop: 'scroll', hat: 'cap' },
  merchant:  { tunic: '#7a4a8a', pants: '#3d2e44', prop: 'bag', hat: 'turban' },
  scholar:   { tunic: '#4a5a8a', pants: '#3a4468', prop: 'book', hat: 'hood' },
  scout:     { tunic: '#4c6b3c', pants: '#33452a', prop: 'cloak', hat: 'hood' },
  smith:     { tunic: '#5a5f6a', pants: '#3a3d44', prop: 'tongs', hat: 'band' },
  visitor:   { tunic: '#c98a4a', pants: '#5a4a3a', prop: 'pack', hat: null },
  citizen:   { tunic: '#8a7a5e', pants: '#4a4438', prop: null, hat: null },
  child:     { tunic: '#c9a24b', pants: '#5a4a3a', prop: null, hat: null, small: true },
  elder:     { tunic: '#6a6f7a', pants: '#4a4d55', prop: 'staff', hat: null },
  traveler:  { tunic: '#7a6a4a', pants: '#4a4232', prop: 'pack', hat: 'hood' },
  cart:      { tunic: null, pants: null, prop: 'cart', hat: null },
  enemy:     { tunic: '#5e2020', pants: '#331414', prop: 'spear', hat: 'hood' },
};

function hatFor(hat, cx, hy, skin, pal) {
  switch (hat) {
    case 'cap': return R(cx - 5, hy - 3, 10, 4, '#6b4222');
    case 'straw': return E(cx, hy + 1, 8, 3, '#c9a24b') + R(cx - 4, hy - 4, 8, 5, '#b58f3c');
    case 'helm': return R(cx - 5, hy - 4, 10, 6, '#8b93a0') + R(cx - 5, hy - 4, 10, 2, '#6b7482');
    case 'goggles': return R(cx - 5, hy - 1, 10, 3, '#3a3f4a');
    case 'turban': return C(cx, hy - 1, 6, '#e8dcc0') + C(cx + 3, hy - 4, 2, '#c94f4f');
    case 'hood': return P([[cx - 7, hy + 4], [cx - 6, hy - 6], [cx + 6, hy - 6], [cx + 7, hy + 4]], '#3a3f4a');
    case 'band': return R(cx - 5, hy - 1, 10, 3, '#8a2f2f');
    default: return '';
  }
}

function propFor(prop, px, py, dir, pal) {
  const d = dir === 'w' ? -1 : 1;
  switch (prop) {
    case 'hammer': return LN(px, py, px + 8 * d, py - 8, '#6b4222', 3) + R(px + 5 * d, py - 13, 7, 5, '#8b93a0');
    case 'basket': return R(px - 2, py - 4, 10, 8, '#a9743f') + R(px - 2, py - 4, 10, 2, '#8a5a33');
    case 'shield': return R(px - 1, py - 12, 7, 14, '#3d5a7a', { stroke: '#c9c2b2', 'stroke-width': 1.5 });
    case 'gear': return C(px + 4 * d, py - 8, 5, '#8b93a0') + C(px + 4 * d, py - 8, 2, '#4a4f5a');
    case 'scroll': return R(px, py - 12, 4, 10, '#e8dcc0', { stroke: '#8a7a5e', 'stroke-width': 1 }) + R(px - 3, py - 2, 10, 6, '#b53c3c');
    case 'bag': return C(px + 4 * d, py - 4, 6, '#8a5a33') + LN(px, py - 6, px + 4 * d, py - 8, '#5a3d24', 2);
    case 'book': return R(px, py - 10, 8, 6, '#7a3c3c') + R(px + 1, py - 9, 6, 4, '#e8dcc0');
    case 'cloak': return P([[px - 6, py - 16], [px + 2, py - 16], [px - 2, py + 2]], '#2e4a2e');
    case 'tongs': return LN(px, py - 4, px + 9 * d, py - 12, '#4a4f5a', 2) + LN(px, py - 4, px + 7 * d, py - 6, '#4a4f5a', 2);
    case 'staff': return LN(px + 4 * d, py + 2, px + 4 * d, py - 20, '#6b4222', 2) + C(px + 4 * d, py - 22, 3, '#8b93a0');
    case 'pack': return R(px - 8, py - 14, 8, 12, '#6b4f2c');
    case 'spear': return LN(px + 4 * d, py + 2, px + 4 * d, py - 22, '#4a3a24', 2) + P([[px + 4 * d - 3, py - 22], [px + 4 * d + 3, py - 22], [px + 4 * d, py - 28]], '#8b93a0');
    default: return '';
  }
}

/** One humanoid. (x, y) = foot point. s = 1 normal, 0.75 child. */
function humanoid(a, role, ctx, s = 1) {
  const { pal } = ctx;
  const r = subRng(ctx.seed, 'actor', a.id);
  const skin = SKIN[r.int(0, SKIN.length - 1)];
  const dir = a.facing === 'w' ? 'w' : 'e';
  const walking = /walking|traveling|patrolling|following/.test(a.state ?? '');
  const step = walking ? (Math.floor((a.progress ?? 0) * 4) % 2 ? 1 : -1) : 0;
  const x = a.x, y = a.y;
  const bw = 9 * s, bh = 11 * s; // body
  const cx = x, hy = y - bh - 8 * s; // head center-top
  let g = E(x, y + 1, 7 * s, 2.5 * s, pal.shadow, { opacity: 0.3 });
  // legs
  const legC = role.pants;
  g += R(cx - 4 * s + step * 2 * s, y - 5 * s, 3.5 * s, 5 * s, legC);
  g += R(cx + 0.5 * s - step * 2 * s, y - 5 * s, 3.5 * s, 5 * s, legC);
  // body
  g += R(cx - bw / 2, y - 5 * s - bh, bw, bh, role.tunic);
  g += R(cx - bw / 2, y - 5 * s - bh, 2.5 * s, bh, '#000000', { opacity: 0.18 });
  // head
  g += R(cx - 4 * s, hy, 8 * s, 8 * s, skin);
  g += hatFor(role.hat, cx, hy, skin, pal);
  // role prop at the facing side
  if (role.prop) g += propFor(role.prop, cx + (dir === 'w' ? -bw / 2 : bw / 2), y - 6 * s, dir, pal);
  return g;
}

function cartSprite(a, ctx) {
  const { pal } = ctx;
  const x = a.x, y = a.y;
  const cargo = a.cargo ?? 'goods';
  let g = E(x, y + 1, 16, 4, pal.shadow, { opacity: 0.3 });
  g += R(x - 14, y - 16, 28, 10, pal.wood) + R(x - 14, y - 16, 28, 3, pal.woodLight);
  g += C(x - 9, y - 4, 5, '#3a3f4a') + C(x + 9, y - 4, 5, '#3a3f4a');
  g += C(x - 9, y - 4, 2, '#8b93a0') + C(x + 9, y - 4, 2, '#8b93a0');
  const cc = cargo === 'stone' ? '#8b93a0' : cargo === 'wood' ? '#8a5a33' : '#c9a24b';
  g += R(x - 10, y - 24, 20, 8, cc);
  // puller (small citizen ahead)
  const d = a.facing === 'w' ? -1 : 1;
  g += R(x + 18 * d - 4, y - 14, 8, 8, '#e8b88a') + R(x + 18 * d - 4.5, y - 25, 9, 11, '#8a7a5e');
  return g;
}

/** Hero: unique silhouette — cape, crested helm, gear-tier trim. */
function heroSprite(a, ctx) {
  const { pal } = ctx;
  const tier = Math.max(1, Math.min(7, a.gearTier ?? 1));
  const trim = ['#8b93a0', '#8b93a0', '#4fc3e8', '#4fc3e8', '#e8b93c', '#e8b93c', '#f7d774'][tier - 1];
  const dir = a.facing === 'w' ? 'w' : 'e';
  const d = dir === 'w' ? -1 : 1;
  const x = a.x, y = a.y;
  const celebrating = a.state === 'celebrating';
  let g = E(x, y + 1, 9, 3, pal.shadow, { opacity: 0.35 });
  // cape trails behind the facing direction
  g += P([[x - 6, y - 26], [x - 13 * d, y - 2], [x - 1, y - 2]], tier >= 5 ? '#7a2f3c' : '#3d4a5e');
  // legs + body (hero plate)
  g += R(x - 5, y - 7, 4, 7, '#3a3f4a') + R(x + 1, y - 7, 4, 7, '#3a3f4a');
  g += R(x - 6, y - 20, 12, 14, '#5a6b8a');
  g += R(x - 6, y - 20, 12, 3, trim); // tier trim
  if (tier >= 3) g += R(x - 9, y - 19, 3, 8, trim) + R(x + 6, y - 19, 3, 8, trim); // pauldrons
  // head + crested helm
  g += R(x - 5, y - 30, 10, 10, '#e8b88a');
  g += R(x - 6, y - 33, 12, 5, '#8b93a0');
  g += P([[x - 2, y - 33], [x + 2, y - 33], [x, y - 40]], trim); // crest
  if (tier >= 7) g += C(x, y - 42, 8, 'url(#k-lampg)');
  // sword or raised arm
  if (celebrating || a.state === 'fighting') {
    g += LN(x + 6 * d, y - 18, x + 14 * d, y - 34, '#c9c2b2', 3);
  } else {
    g += LN(x + 6 * d, y - 16, x + 10 * d, y - 2, '#6b4222', 3) + R(x + 7 * d, y - 6, 7, 5, '#8b93a0');
  }
  return g;
}

/** Companion: small hooded beast-friend lagging the hero. */
function companionSprite(a, ctx) {
  const { pal } = ctx;
  const x = a.x, y = a.y;
  let g = E(x, y + 1, 7, 2.5, pal.shadow, { opacity: 0.3 });
  g += R(x - 7, y - 10, 14, 8, '#8a5a8a'); // body
  g += P([[x + 7, y - 8], [x + 13, y - 12], [x + 9, y - 4]], '#8a5a8a'); // tail
  g += C(x + 3, y - 14, 6, '#9a6a9a'); // head
  g += P([[x - 1, y - 18], [x + 1, y - 24], [x + 3, y - 18]], '#9a6a9a'); // ear L
  g += P([[x + 4, y - 18], [x + 6, y - 24], [x + 8, y - 18]], '#9a6a9a'); // ear R
  g += C(x + 5, y - 14, 1.6, '#241d16'); // eye
  if (a.state === 'celebrate' || a.state === 'celebrating') g += C(x + 3, y - 20, 9, 'url(#k-lampg)');
  return g;
}

/** LOD0 simplified actor: two rects. */
function simpleSprite(a, role, ctx) {
  const { pal } = ctx;
  const c = a.role === 'hero' ? '#5a6b8a' : a.role === 'enemy' ? '#5e2020' : (role?.tunic ?? '#8a7a5e');
  return E(a.x, a.y + 1, 5, 2, pal.shadow, { opacity: 0.3 })
    + R(a.x - 4, a.y - 12, 8, 10, c) + R(a.x - 3, a.y - 18, 6, 6, '#e8b88a');
}

export function actorDrawables(snap, ctx) {
  const out = [];
  const actors = [...(snap.actors ?? [])].sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const a of actors) {
    let svg;
    if (a.role === 'hero') svg = ctx.lod === 0 ? simpleSprite(a, null, ctx) : heroSprite(a, ctx);
    else if (a.role === 'companion') svg = companionSprite(a, ctx);
    else if (a.role === 'cart') svg = cartSprite(a, ctx);
    else {
      const role = ROLES[a.role] ?? ROLES.citizen;
      svg = ctx.lod === 0 ? simpleSprite(a, role, ctx)
        : humanoid(a, role, ctx, role.small ? 0.72 : 1);
    }
    const h = a.role === 'cart' ? 26 : 34;
    out.push({
      id: `actor-${a.id}`, layer: 6, footY: a.y, x: a.x,
      bounds: { x: a.x - 18, y: a.y - h, w: 36, h: h + 4 }, svg,
      meta: { actorId: a.id, role: a.role, x: a.x, y: a.y },
    });
  }
  // War enemy cohort (snapshot war) — drawn as actors too.
  const foes = [...(snap.war?.enemyCohort ?? [])].sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const e of foes) {
    const svg = ctx.lod === 0 ? simpleSprite(e, ROLES.enemy, ctx)
      : humanoid({ ...e, state: 'fighting' }, ROLES.enemy, ctx);
    out.push({
      id: `foe-${e.id}`, layer: 6, footY: e.y, x: e.x,
      bounds: { x: e.x - 18, y: e.y - 34, w: 36, h: 38 }, svg,
      meta: { actorId: e.id, role: 'enemy', x: e.x, y: e.y },
    });
  }
  return out;
}
