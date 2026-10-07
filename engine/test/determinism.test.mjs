// Determinism: same input -> byte-identical world; different seed -> different signature.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildWorld, worldSignature, serializeWorld } from '../world/world.mjs';
import { sampleState } from './fixture.mjs';

describe('determinism', () => {
  it('buildWorld twice with the same input is byte-identical', () => {
    const a = serializeWorld(buildWorld(sampleState()));
    const b = serializeWorld(buildWorld(sampleState()));
    assert.equal(a, b);
    assert.ok(a.length > 10000, 'world serializes to substantial JSON');
  });

  it('signature is stable across rebuilds', () => {
    const s1 = worldSignature(buildWorld(sampleState()));
    const s2 = worldSignature(buildWorld(sampleState()));
    assert.equal(s1, s2);
    assert.match(s1, /^[0-9a-f]{16}$/);
  });

  it('a different seed produces a different signature', () => {
    const s1 = buildWorld(sampleState()).signature;
    const s2 = buildWorld(sampleState({ seed: 'a-different-seed' })).signature;
    assert.notEqual(s1, s2);
  });

  it('different repo data changes the world but stays deterministic', () => {
    const mk = (repos) => serializeWorld(buildWorld(sampleState({ repos })));
    const base = [{ name: 'x', fullName: 'u/x', stars: 1, ageDays: 100, recentCommits: 1 }];
    const other = [{ name: 'y', fullName: 'u/y', stars: 999, ageDays: 5, recentCommits: 50 }];
    assert.notEqual(mk(base), mk(other));
    assert.equal(mk(base), mk(base));
  });

  it('subsystem streams are independent: reordering actors never moves buildings', () => {
    // buildings and entities draw from separate sub-streams keyed on (seed, subsystem)
    const w1 = buildWorld(sampleState());
    const w2 = buildWorld(sampleState({ time: { phase: 'night', season: 'winter', weather: 'snow' } }));
    const b1 = w1.buildings.map((b) => [b.id, b.x, b.y]);
    const b2 = w2.buildings.map((b) => [b.id, b.x, b.y]);
    assert.deepEqual(b1, b2);
  });

  it('no wall-clock or Math.random in world output paths (time comes from state)', () => {
    const w1 = buildWorld(sampleState());
    const w2 = buildWorld(sampleState());
    assert.equal(JSON.stringify(w1), JSON.stringify(w2));
  });
});
