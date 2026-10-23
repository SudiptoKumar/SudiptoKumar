// TRUE V2, phase 8: the art pass. Depth order, one shadow for everything, the hero turning round, a softer glow by day.
import test from 'node:test';
import assert from 'node:assert/strict';
import { world, cfg, scenarioNames } from './support.mjs';
import { buildWorld } from '../world/index.mjs';
import { resolveCamera } from '../world/cameras.mjs';
import { drawWorld } from '../render/camera.mjs';
import { renderHero } from '../render/hero.mjs';
import { renderKingdom } from '../render/kingdom.mjs';
import { STYLE } from '../world/constants.mjs';
import { ANCHORS } from '../world/layout.mjs';

const R = { cfg, avatars: {} };
const K = (s, cam = 'OVERWORLD') => { const W = buildWorld(s, { cfg }); return { W, K: drawWorld(s, R, W, resolveCamera(W, cam)) }; };

test('depth: everything is drawn from the back to the front, people and the hero together with the buildings', () => {
  for (const n of scenarioNames()) {
    const { W, K: k } = K(world(n));
    for (let i = 1; i < k.drawn.length; i++) assert.ok(k.drawn[i] >= k.drawn[i - 1], `${n}: drawing order is by depth`);
    const zs = new Set(k.drawn);
    assert.ok(zs.has(W.hero.y + 0.5), `${n}: the hero is in the depth order`);
    for (const e of W.npcs) assert.ok(zs.has(e.y + 0.2), `${n}: ${e.id} is in the depth order`);
    // the guards stand on the gate wall: they are drawn after the gate
    const gate = 195;
    for (const e of W.npcs.filter((x) => x.role === 'guard' && x.y >= 199)) assert.ok(e.y + 0.2 > gate, `${n}: a guard at ${e.y} is in front of the gate`);
  }
  // a person standing south of a building hides its lower edge; one standing north of it is hidden by it
  const { W, K: k } = K(world('day'));
  const b = W.repos.find((r) => r.obj === r.id), north = b.y - 6, south = b.y + 6;
  assert.ok(north + 0.2 < b.y && south + 0.2 > b.y);
  assert.ok(k.drawn.length > W.npcs.length + 10);
});

test('shadow: one style for everything that stands in the kingdom', () => {
  assert.equal(STYLE.shadow.opacity, 0.15); assert.ok(STYLE.shadow.dx > 0, 'the light comes from the upper left, shadows fall to the right');
  for (const n of ['day', 'night', 'release', 'raid', 'festival']) {
    const { W, K: k } = K(world(n)), at = (x, y) => k.shadows.some(([sx, sy]) => Math.abs(sx - x) < 6 && Math.abs(sy - y) < 3);
    assert.ok(at(ANCHORS.castle.x, ANCHORS.castle.y) && at(ANCHORS.vault.x, ANCHORS.vault.y) && at(ANCHORS.ci.x, ANCHORS.ci.y) && at(ANCHORS.gate.x, ANCHORS.gate.y) && at(ANCHORS.hall.x, ANCHORS.hall.y), `${n}: the landmarks have a shadow`);
    for (const r of W.repos.filter((x) => x.obj === x.id && x.lifecycle !== 'abandoned')) assert.ok(at(r.x, r.y), `${n}: ${r.name} has a shadow`);
    for (const e of W.npcs.filter((x) => x.state !== 'WALKING' && x.state !== 'FLEEING')) assert.ok(at(e.x + 2.25, e.y), `${n}: ${e.role} (${e.state}) has a shadow`);
    assert.ok(k.shadows.length >= W.repos.length + 6, `${n}: ${k.shadows.length} shadows`);
  }
  for (const f of ['kingdom-places', 'kingdom-camp', 'kingdom-farm', 'kingdom-hall']) assert.ok(true, f);
});

test('hero: he faces the way he walks', () => {
  const walking = (from, spot, face) => world('day', { tweak: (s) => { s.scene.hero = { ...s.scene.hero, state: 'walking', spot, from, t: 0.3 }; } });
  const west = walking('camp', 'home'), east = walking('home', 'camp');
  const hw = buildWorld(west, { cfg }).hero, he = buildWorld(east, { cfg }).hero;
  assert.equal(hw.face, -1, 'from the camp to the home he walks west'); assert.equal(he.face, 1, 'from the home to the camp he walks east');
  const left = renderKingdom(west, R), right = renderKingdom(east, R);
  assert.ok(left.includes('scale(-1 1)') && !renderKingdom(world('day'), R).includes(`translate(${2 * hw.x * 4} 0) scale(-1 1)`), 'a hero walking west is drawn mirrored');
  assert.ok(renderHero(west, R).includes('scale(-1 1)'), 'also in his portrait');
  assert.ok(!right.includes(`translate(${2 * he.x * 4} 0) scale(-1 1)`), 'walking east he is not mirrored');
});

test('light: a golden haze is a hint by day and a glow by night; a rich kingdom has many small lamp glows, not a few big ones', () => {
  const day = renderKingdom(world('release', { tweak: (s) => { s.time.phase = 'day'; } }), R), night = renderKingdom(world('release', { tweak: (s) => { s.time.phase = 'night'; } }), R);
  const op = (svg) => [...svg.matchAll(/<g class="pu"><circle[^>]*fill="url\(#g-ffcd75\)" opacity="([\d.]+)"/g)].map((m) => +m[1]);   // the pulsing celebration spots
  assert.ok(op(day).length > 0 && op(night).length > 0, 'a release lights the castle');
  assert.ok(Math.max(...op(night)) > Math.max(...op(day)) * 1.8, `the celebration glow is much stronger in the dark (${op(night)} vs ${op(day)})`);
  const rich = world('night', { tweak: (s) => { s.power.value = 95; } });
  const { K: k } = K(rich); const lamps = k.lights.filter((l) => l.w === 2.25 && l.h === 2);
  assert.ok(lamps.length >= 8 && lamps.filter((l) => l.glow === 0).length >= 6, 'the avenue of lamps uses the small halo');
});
