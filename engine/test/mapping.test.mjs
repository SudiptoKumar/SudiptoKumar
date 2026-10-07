// Cause -> effect mapping: stability, thresholds, CI states, unknown neutrality.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  archetypeOf, dungeonPressure, fortressState, releaseEvents,
  farmState, hallEntries, visitorEntries, buildingLifecycleFor,
  applyPartialFailure,
} from '../domain/mapping.mjs';
import { ARCHETYPES, BUILDING_LIFECYCLE } from '../world/constants.mjs';

describe('mapping', () => {
  it('repo -> archetype is stable for the same repo + config', () => {
    const repo = { name: 'my-docs', fullName: 'u/my-docs', description: 'a docs site', language: 'TypeScript' };
    const a = archetypeOf(repo, {});
    const b = archetypeOf(repo, {});
    assert.deepEqual(a, b);
    assert.ok(ARCHETYPES.includes(a.archetype));
    assert.equal(a.reason, 'keyword');
    assert.equal(a.archetype, 'library');
  });

  it('config override wins over keywords', () => {
    const repo = { name: 'my-docs', fullName: 'u/my-docs' };
    const r = archetypeOf(repo, { archetypeOverrides: { 'u/my-docs': 'forge' } });
    assert.equal(r.archetype, 'forge');
    assert.equal(r.reason, 'config');
  });

  it('deterministic fallback for unrecognized repos', () => {
    const repo = { name: 'zzz-thing', fullName: 'u/zzz-thing' };
    const a = archetypeOf(repo, {});
    const b = archetypeOf(repo, {});
    assert.equal(a.archetype, b.archetype);
    assert.equal(a.reason, 'fallback');
    assert.ok(!['castle', 'monument', 'gate', 'wall', 'dock'].includes(a.archetype));
  });

  it('issue tier thresholds: 0 dormant / 1-3 watchful / 4-10 active / 11-20 crowded / 20+ crisis', () => {
    const tiers = [[0, 'dormant'], [1, 'watchful'], [3, 'watchful'], [4, 'active'], [10, 'active'], [11, 'crowded'], [20, 'crowded'], [21, 'crisis'], [500, 'crisis']];
    for (const [n, tier] of tiers) assert.equal(dungeonPressure(n).tier, tier, `open=${n}`);
  });

  it('thresholds are configurable', () => {
    assert.equal(dungeonPressure(5, { watchful: 1, active: 10, crowded: 20, crisis: 30 }).tier, 'watchful');
  });

  it('CI states map to fortress physical states; garbage -> unknown', () => {
    assert.equal(fortressState('healthy').beacon, 'steady-green');
    assert.equal(fortressState('warning').beacon, 'amber-pulse');
    assert.ok(fortressState('failing').alarm);
    assert.ok(fortressState('recovering').scaffolding);
    for (const bad of [null, undefined, 'bogus', 42]) {
      const s = fortressState(bad);
      assert.equal(s.state, 'unknown', String(bad));
      assert.equal(s.status, 'unknown');
      assert.equal(s.alarm, false);
    }
  });

  it('unknown issue counts stay unknown (never coerced)', () => {
    for (const bad of [null, undefined, NaN]) {
      const p = dungeonPressure(bad);
      assert.equal(p.tier, 'unknown');
      assert.equal(p.status, 'unknown');
    }
  });

  it('unknown contributions / achievements / visitors stay neutral', () => {
    assert.equal(farmState(null).status, 'unknown');
    assert.equal(hallEntries(null).status, 'unknown');
    assert.equal(visitorEntries(undefined).status, 'unknown');
    assert.deepEqual(releaseEvents(null).events, []);
  });

  it('releases become royal-plaza announcement descriptors', () => {
    const { events } = releaseEvents([{ tag: 'v1.2.0', name: 'Big release' }]);
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'release');
    assert.equal(events[0].anchor, 'royal_plaza');
    assert.equal(events[0].phase, 'ANNOUNCED');
  });

  it('hostile visitor text is sanitized, never dropped silently', () => {
    const { entries } = visitorEntries([
      { login: 'bad', kind: 'flag', message: '<script>alert(1)</script>' },
      { login: 'ok', kind: 'flag', message: 'hello kingdom' },
    ]);
    assert.equal(entries[0].message, null);
    assert.ok(entries[0].messageRejected);
    assert.equal(entries[1].message, 'hello kingdom');
  });

  it('building lifecycle covers all 11 lock states and stays deterministic', () => {
    const cases = [
      [null, 'empty'],
      [{ archived: true, ageDays: 500 }, 'sleepy'],
      [{ ageDays: 5, recentCommits: 2 }, 'foundation'],
      [{ ageDays: 400, recentCommits: 9 }, 'construction'],
      [{ ageDays: 400, stars: 500, featured: true }, 'flourishing'],
      [{ ageDays: 500, recentCommits: 0 }, 'abandoned'],
      [{ ageDays: 120, recentCommits: 0 }, 'sleepy'],
      [{ ageDays: 60, recentCommits: 0 }, 'active'],
    ];
    for (const [repo, expected] of cases) {
      const s = buildingLifecycleFor(repo, {});
      assert.equal(s, expected, JSON.stringify(repo));
      assert.ok(BUILDING_LIFECYCLE.includes(s));
    }
  });

  it('partial API failure: last-known when allowed, neutral otherwise', () => {
    const lastKnown = { list: [1, 2], status: 'known' };
    const kept = applyPartialFailure('repos', { lastKnown });
    assert.equal(kept.status, 'stale');
    assert.equal(kept.provenance, 'last-known');
    const neutral = applyPartialFailure('repos', { lastKnown: null });
    assert.equal(neutral.status, 'unknown');
    assert.equal(neutral.provenance, 'neutral');
    const forced = applyPartialFailure('repos', { lastKnown, allowLastKnown: false });
    assert.equal(forced.status, 'unknown');
  });
});
