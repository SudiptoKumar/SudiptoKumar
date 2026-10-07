// World consistency: the lock's geography holds together.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildWorld } from '../world/world.mjs';
import { checkWorldInvariants } from '../validation/world-invariants.mjs';
import { districts } from '../world/districts.mjs';
import { nodes, edges, reachableFrom, routeBetween } from '../world/roads.mjs';
import { rectsOverlap } from '../world/constants.mjs';
import { sampleState } from './fixture.mjs';

describe('world consistency', () => {
  it('lock counts: 19 districts, 34 nodes, 37 edges', () => {
    assert.equal(districts().length, 19);
    assert.equal(nodes().length, 34);
    assert.equal(edges().length, 37);
  });

  it('all districts inside the 2048x1536 bounds', () => {
    for (const d of districts()) {
      const r = d.rect;
      assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= 2048 && r.y + r.h <= 1536, d.id);
    }
  });

  it('no two districts overlap', () => {
    const ds = districts();
    for (let i = 0; i < ds.length; i++) {
      for (let j = i + 1; j < ds.length; j++) {
        assert.ok(!rectsOverlap(ds[i].rect, ds[j].rect), `${ds[i].id} ~ ${ds[j].id}`);
      }
    }
  });

  it('every road node reachable from castle_gate', () => {
    const reach = reachableFrom('castle_gate');
    assert.equal(reach.length, 34);
    for (const n of nodes()) assert.ok(reach.includes(n.id), n.id);
  });

  it('every edge references known nodes; routes exist between all node pairs', () => {
    const ids = new Set(nodes().map((n) => n.id));
    for (const e of edges()) {
      assert.ok(ids.has(e.from), `${e.id} from`);
      assert.ok(ids.has(e.to), `${e.id} to`);
    }
    // spot-check: hero-relevant destinations are routable
    for (const [a, b] of [['hero_guild', 'war_front'], ['residential_cross', 'builder_yard'], ['harbor_docks', 'market_square'], ['scout_lodge', 'royal_plaza']]) {
      const r = routeBetween(a, b);
      assert.ok(r && r.length > 0, `${a} -> ${b}`);
    }
  });

  it('hero destinations are connected road nodes', () => {
    const world = buildWorld(sampleState());
    const ids = new Set(nodes().map((n) => n.id));
    assert.ok(world.hero, 'hero present');
    assert.ok(ids.has(world.hero.destination), world.hero.destination);
    assert.ok(ids.has(world.hero.home), world.hero.home);
  });

  it('exactly one castle in the built world', () => {
    const world = buildWorld(sampleState());
    assert.equal(world.buildings.filter((b) => b.archetype === 'castle').length, 1);
  });

  it('no duplicate ids anywhere (single authority per entity)', () => {
    const world = buildWorld(sampleState());
    for (const [name, items] of [
      ['districts', world.districts], ['nodes', world.roads.nodes], ['edges', world.roads.edges],
      ['plots', world.plots], ['buildings', world.buildings], ['actors', world.actors],
    ]) {
      const ids = items.map((i) => i.id);
      assert.equal(new Set(ids).size, ids.length, `duplicate ${name} ids`);
    }
  });

  it('full invariant sweep passes on representative states', () => {
    for (const overrides of [
      {},
      { seed: 'other-seed', powerTier: 'village' },
      { seed: 'night-owl', time: { phase: 'deepnight', season: 'winter', weather: 'snow' } },
      { seed: 'no-hero', hero: null },
      { seed: 'war-time', war: { phase: 'BATTLE' } },
      { seed: 'quiet', releases: [], issues: { open: 0 }, ci: { status: 'unknown' } },
    ]) {
      const world = buildWorld(sampleState(overrides));
      const problems = checkWorldInvariants(world);
      assert.deepEqual(problems, [], `seed ${overrides.seed ?? 'test-seed-1'}: ${problems.slice(0, 3).join('; ')}`);
    }
  });

  it('hero may be null without breaking the world', () => {
    const world = buildWorld(sampleState({ hero: null }));
    assert.equal(world.hero, null);
    assert.equal(world.companion, null);
    assert.ok(world.actors.length > 0);
    assert.deepEqual(checkWorldInvariants(world), []);
  });
});
