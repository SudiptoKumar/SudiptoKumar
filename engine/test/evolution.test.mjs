// TRUE V2, phase 5: visual evolution. Repository lifecycle, kingdom-power tiers, camp growth and the seasons must each be visible,
// distinct and tied to the world model.
import test from 'node:test';
import assert from 'node:assert/strict';
import { world, cfg, scenarioNames } from './support.mjs';
import { Pix } from '../render/pixel.mjs';
import { SEASONS } from '../render/palette.mjs';
import { LIFE_LOOKS, drawLife } from '../dev/showcase.mjs';
import { buildWorld } from '../world/index.mjs';
import { TIER_STYLE, LIFECYCLE, repoLifecycle } from '../world/lifecycle.mjs';
import { campState } from '../world/camp.mjs';
import { renderKingdom } from '../render/kingdom.mjs';
import { renderHarvest } from '../render/harvest.mjs';
import { renderCamp } from '../render/camp.mjs';
import { readManifest } from '../world/manifest.mjs';
import { lintSvg } from '../safety.mjs';

const R = { cfg, avatars: {} };
const draw = (kind, opts) => { const p = new Pix(4); drawLife(p, kind, 20, 40, opts); return p.toString(); };
const withPower = (v, name = 'day') => world(name, { tweak: (s) => { s.power.value = v; } });
const count = (s, needle) => s.split(needle).length - 1;

test('lifecycle: ten looks (eight lifecycle states, two flourishing sizes, two kinds of neglect) are all different pictures', () => {
  for (const kind of ['house', 'tower', 'library']) {
    const looks = LIFE_LOOKS.map(([name, o]) => [name, draw(kind, o)]);
    assert.equal(new Set(looks.map(([, m]) => m)).size, looks.length, `${kind}: every lifecycle state looks different`);
  }
  const by = Object.fromEntries(LIFE_LOOKS.map(([n, o]) => [n, draw('house', o)]));
  assert.ok(by['flourishing 4'].length > by.active.length * 1.2, 'a flourishing project has visibly more on it than an active one (wing, garden, lamps, pennant)');
  assert.ok(by.foundation.includes('class="fl"') && by.foundation !== draw('house', { ...LIFE_LOOKS[0][1], life: 'building' }), 'a foundation site has its survey flag');
  assert.notEqual(draw('house', { level: 4, state: 'sleepy', life: 'sleepy' }), draw('house', { level: 4, state: 'dusty', life: 'sleepy' }), 'forgotten is not the same as quiet');
});

test('lifecycle: the world gives every repository its state and the picture shows it', () => {
  const seen = new Set();
  for (const n of scenarioNames()) { const W = buildWorld(world(n), { cfg }); W.repos.forEach((r) => { assert.ok(LIFECYCLE.includes(r.lifecycle)); seen.add(r.lifecycle); }); }
  assert.ok(seen.size >= 6, `six or more lifecycle states appear across the demo worlds (saw ${[...seen]})`);
  assert.ok(seen.has('flourishing') && seen.has('failing') && seen.has('sleepy') && seen.has('abandoned') && seen.has('building'));
  // a flourishing repository is drawn flourishing: change its lifecycle input and the picture changes
  const base = world('legendary');
  const flour = buildWorld(base, { cfg }).repos.find((r) => r.lifecycle === 'flourishing');
  assert.ok(flour, 'the legendary demo world has a flourishing project');
  const calm = structuredClone(base); const rp = calm.repos.find((r) => r.name === flour.name); rp.commits90 = 2;
  assert.notEqual(repoLifecycle(rp), 'flourishing');
  assert.notEqual(renderKingdom(base, R), renderKingdom(calm, R), 'the same repository with less work is drawn without the wing and garden');
  // a young repository is a foundation
  const young = world('build'); const k = young.repos.find((r) => r.ageDays <= 21); assert.ok(k && buildWorld(young, { cfg }).repos.find((r) => r.name === k.name).lifecycle === 'foundation');
});

test('kingdom power: five tiers, each one richer than the last, in the picture and in the people', () => {
  const tiers = [5, 30, 50, 70, 90].map((v) => ({ v, S: withPower(v) }));
  const W = tiers.map((t) => buildWorld(t.S, { cfg })), svgs = tiers.map((t) => renderKingdom(t.S, R));
  assert.deepEqual(W.map((w) => w.kingdom.tier.index), [0, 1, 2, 3, 4]);
  assert.equal(new Set(svgs).size, 5, 'five different kingdoms');
  for (const s of svgs) assert.deepEqual(lintSvg(s), []);
  assert.deepEqual(svgs.map((s) => readManifest(s).o.plaza[2]), ['well', 'well', 'well', 'fountain', 'statue'], 'well, then a fountain, then a golden statue');
  assert.deepEqual(svgs.map((s) => readManifest(s).g.tier), ['village', 'settlement', 'kingdom', 'prosperous', 'legendary']);
  assert.ok(svgs[4].length > svgs[0].length, 'a legendary kingdom has more to draw than a struggling village');
  assert.ok(count(svgs[4], '#e0a030') > count(svgs[0], '#e0a030'), 'gold trim on the roads and the crown');
  const villagers = W.map((w) => w.npcs.filter((n) => n.role.startsWith('villager')).length);
  for (let i = 1; i < 5; i++) assert.ok(villagers[i] >= villagers[i - 1], `more people in a richer kingdom: ${villagers}`);
  assert.ok(villagers[4] > villagers[0], 'the streets are fuller at the top');
  const stalls = W.map((w) => w.npcs.filter((n) => n.role === 'merchant' && n.state === 'WORKING').length);
  assert.deepEqual(stalls.map((s, i) => s <= TIER_STYLE[i].stalls), [true, true, true, true, true]); assert.ok(stalls[4] >= stalls[0]);
  const lamps = svgs.map((s) => count(s, 'class="fl"'));
  assert.ok(lamps[4] >= lamps[0], 'lamps and pennants only increase');
  // after dark a rich kingdom's castle glows
  const night = [10, 90].map((v) => renderKingdom(withPower(v, 'night'), R));
  assert.ok(count(night[1], 'url(#g-ffcd75)') > count(night[0], 'url(#g-ffcd75)'), 'a legendary castle glows at night');
});

test('visitor camp: four growth states, each with its own look, and each tent is a visitor', () => {
  const camp = (n) => world('day', { tweak: (s) => { s.visitors = { total: n, flags: Array.from({ length: Math.min(n, 12) }, (_, i) => ({ n: n - i, login: `v${i}`, message: 'hi', avatar: 'knight', color: ['gold', 'purple', 'green', 'red', 'blue', 'orange'][i % 6], at: s.generatedAt })) }; } });
  const pics = [0, 3, 7, 30].map((n) => renderCamp(camp(n), R)), ms = pics.map(readManifest);
  assert.deepEqual([0, 3, 7, 30].map(campState), ['EMPTY', 'CAMP', 'VILLAGE', 'FESTIVAL']);
  assert.equal(new Set(pics).size, 4);
  const tents = ms.map((m) => Object.keys(m.o).filter((k) => /^v\d+$/.test(k)).length);
  assert.deepEqual(tents, [0, 3, 7, 12], 'one tent for every visitor, never more than twelve');
  assert.ok(pics[0].length < pics[1].length && pics[1].length < pics[2].length && pics[2].length < pics[3].length, 'the camp grows');
  for (const p of pics) assert.deepEqual(lintSvg(p), []);
  assert.notEqual(ms[2].o.camp[2], ms[3].o.camp[2]); assert.ok(ms[1].lod === 'near' && ms[2].cam === 'VISITOR_CAMP');
  const fest = world('festival'); assert.equal(buildWorld(fest, { cfg }).camp.state, 'FESTIVAL'); assert.equal(buildWorld(fest, { cfg }).camp.visitors.length, 12);
});

test('seasons change structures, not only colours: snow on roofs, barns and huts; frost on the fields', () => {
  const sum = world('summer'), win = world('winter');
  const farm = [renderHarvest(sum, R), renderHarvest(win, R)];
  assert.ok(farm[1].includes('fill="#f4f8fc"') && !farm[0].includes('fill="#f4f8fc"'), 'winter puts snow on the barn and windmill (summer does not)');
  assert.ok(farm[1].includes('href="#pfrost"') && !farm[0].includes('href="#pfrost"'), 'and frost on the bare plots');
  const camps = [renderCamp(world('festival'), R), renderCamp(world('festival', { tweak: (s) => { s.time.season = 'winter'; s.scene.weather = { ...s.scene.weather }; } }), R)];
  assert.notEqual(camps[0], camps[1]);
  const seasons = ['spring', 'summer', 'autumn', 'winter'].map((n) => renderKingdom(world(n), R));
  assert.equal(new Set(seasons).size, 4, 'four seasons, four kingdoms');
  assert.ok(seasons[3].includes(`fill="${SEASONS.winter.grass}"`) && !seasons[1].includes(`fill="${SEASONS.winter.grass}"`), 'the winter ground is snow, the summer ground is not');
});

test('the new demo worlds tell their stories: a legendary kingdom and a festival camp', () => {
  const leg = world('legendary'), W = buildWorld(leg, { cfg });
  assert.equal(W.kingdom.tier.id, 'legendary'); assert.ok(leg.power.value >= 81);
  assert.ok(W.repos.some((r) => r.lifecycle === 'flourishing'));
  assert.ok(scenarioNames().includes('legendary') && scenarioNames().includes('festival') && scenarioNames().length >= 21);
  assert.deepEqual(lintSvg(renderKingdom(leg, R)), []);
});
