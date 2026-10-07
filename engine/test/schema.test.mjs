// Schema: the built world validates; malformed worlds are rejected.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildWorld } from '../world/world.mjs';
import { validateWorldSchema, validateSimulationSchema } from '../validation/schema.mjs';
import { checkWorldInvariants } from '../validation/world-invariants.mjs';
import { sampleState } from './fixture.mjs';

describe('schema', () => {
  it('the built world passes the schema validator', () => {
    const world = buildWorld(sampleState());
    assert.deepEqual(validateWorldSchema(world), []);
  });

  it('missing required top-level fields are reported', () => {
    const world = buildWorld(sampleState());
    for (const f of ['version', 'seed', 'map', 'districts', 'roads', 'buildings', 'actors', 'hero', 'events', 'time', 'signature']) {
      const broken = { ...world };
      delete broken[f];
      const errs = validateWorldSchema(broken);
      assert.ok(errs.some((e) => e.includes(`'${f}'`)), `field ${f} should be required`);
    }
  });

  it('malformed nested entries are reported', () => {
    const world = buildWorld(sampleState());
    const broken = {
      ...world,
      buildings: [{ id: 42, archetype: null }],
      actors: [{ id: 'a' }],
      hero: { x: 'far', y: 1, state: 'idle' },
      events: [{ id: 'e' }],
      time: { phase: 7 },
    };
    const errs = validateWorldSchema(broken);
    assert.ok(errs.length >= 6, errs.join('\n'));
  });

  it('hero may be null per the graceful-absence rule', () => {
    const world = buildWorld(sampleState({ hero: null }));
    assert.deepEqual(validateWorldSchema(world), []);
    assert.deepEqual(checkWorldInvariants(world), []);
  });

  it('a simulation snapshot validates against the simulation schema subset', () => {
    const snap = {
      version: '3',
      timeBucket: '2026-10-07T06:00',
      actors: [{ id: 'hero', role: 'hero', state: 'traveling', x: 100, y: 200 }],
      tasks: [{ id: 't1', type: 'build', state: 'assigned' }],
      war: { state: 'PEACE' },
      effects: [{ type: 'banners' }],
    };
    assert.deepEqual(validateSimulationSchema(snap), []);
    const bad = validateSimulationSchema({ version: '3' });
    assert.ok(bad.length > 0);
  });
});
