// Pull requests -> courier network (spec §06.2 row: "Pull requests |
// courier network | messengers, documents, route activity").
// - fetchPullRequests: bounded ingestion, per-repo failure isolation
// - courierIntensity: qualitative tiers (none/trickle/active/surge), unknown -> neutral
// - state: PR section normalizes; failure -> neutral, never fake activity
// - simulation: messenger task intensity + routes follow the tier, quiet when none/unknown
// No fake precise counts anywhere in the world or visuals.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fetchPullRequests, fetchSnapshot } from '../github.mjs';
import { courierIntensity } from '../domain/mapping.mjs';
import { buildNormalizedState } from '../domain/state.mjs';
import { buildWorld } from '../world/world.mjs';
import { simulate } from '../simulation/simulate.mjs';
import { itineraryFor } from '../simulation/actors.mjs';
import { sha } from '../util.mjs';

// ------------------------------------------------------------------
// fixtures
// ------------------------------------------------------------------
const DAY = 86_400_000;
const NOW = Date.parse('2026-10-07T12:00:00+06:00');
const isoAgo = (days) => new Date(NOW - days * DAY).toISOString();

const prSnap = (pullRequests, over = {}) => ({
  seed: 'pr-e2e', kingdomName: 'PR Kingdom', owner: 'pr-owner', powerTier: 'city',
  repos: [
    { name: 'alpha', fullName: 'pr-owner/alpha', description: 'docs', language: 'TypeScript', stars: 10, ageDays: 100, recentCommits: 2, pushedDaysAgo: 1 },
  ],
  issues: { open: 0 }, ci: { status: 'healthy' }, releases: [],
  contributions: { activeDays: 30, streak: 3 }, achievements: [], visitors: [],
  hero: { name: 'PR Hero', class: 'warden', gearTier: 2 },
  time: { phase: 'morning', season: 'autumn', weather: 'clear' },
  war: { phase: 'PEACE' }, events: [],
  pullRequests,
  ...over,
});

const prs = (open, merged, status = 'known') => ({
  list: Array.from({ length: open + merged }, (_, i) => ({
    number: i + 1, title: `PR ${i + 1}`, state: i < open ? 'open' : 'merged', repo: 'r',
  })),
  open, recentlyMerged: merged, status,
});

const pipeline = (pullRequests, over = {}) => {
  const state = buildNormalizedState({ snap: prSnap(pullRequests, over) });
  const world = buildWorld(state);
  const sim = simulate(world, { timeBucket: 'noon-autumn-clear-pr', inputs: {} });
  return { state, world, sim };
};
const messengers = (sim) => sim.actors.filter((a) => a.role === 'messenger').sort((a, b) => (a.id < b.id ? -1 : 1));

// ------------------------------------------------------------------
// mapping: qualitative tiers
// ------------------------------------------------------------------
describe('courierIntensity (PR signal -> qualitative tier)', () => {
  it('maps active-PR counts to none / trickle / active / surge', () => {
    assert.equal(courierIntensity({ open: 0, recentlyMerged: 0, status: 'known' }).intensity, 'none');
    assert.equal(courierIntensity({ open: 1, recentlyMerged: 0, status: 'known' }).intensity, 'trickle');
    assert.equal(courierIntensity({ open: 1, recentlyMerged: 1, status: 'known' }).intensity, 'trickle');
    assert.equal(courierIntensity({ open: 3, recentlyMerged: 0, status: 'known' }).intensity, 'active');
    assert.equal(courierIntensity({ open: 2, recentlyMerged: 5, status: 'known' }).intensity, 'active');
    assert.equal(courierIntensity({ open: 8, recentlyMerged: 0, status: 'known' }).intensity, 'surge');
    assert.equal(courierIntensity({ open: 0, recentlyMerged: 12, status: 'known' }).intensity, 'surge');
  });

  it('unknown input stays neutral — never coerced to success/failure (spec §06.12)', () => {
    for (const p of [null, undefined, {}, { status: 'unknown' }, { open: 5, recentlyMerged: 5 }]) {
      const c = courierIntensity(p);
      assert.equal(c.intensity, 'unknown', JSON.stringify(p));
      assert.equal(c.status, 'unknown');
    }
  });

  it('stale (last-known) still drives, marked as last-known', () => {
    const c = courierIntensity({ open: 5, recentlyMerged: 0, status: 'stale' });
    assert.equal(c.intensity, 'active');
    assert.equal(c.status, 'stale');
    assert.equal(c.provenance, 'last-known');
  });

  it('thresholds are configurable', () => {
    const c = courierIntensity(
      { open: 2, recentlyMerged: 0, status: 'known' },
      { trickle: 1, active: 2, surge: 99 },
    );
    assert.equal(c.intensity, 'active');
  });
});

// ------------------------------------------------------------------
// ingestion: fetchPullRequests
// ------------------------------------------------------------------
describe('fetchPullRequests (bounded, per-repo failure isolation)', () => {
  const stubFetch = (routes) => {
    const orig = globalThis.fetch;
    globalThis.fetch = async (url) => {
      const hit = routes.find(([pat]) => String(url).includes(pat));
      if (!hit) return { ok: false, status: 404, json: async () => ({}) };
      const [, body, status = 200] = hit;
      return { ok: status < 400, status, json: async () => body };
    };
    return () => { globalThis.fetch = orig; };
  };

  const repos = (n) => Array.from({ length: n }, (_, i) => ({
    name: `r${i}`, fullName: `o/r${i}`, pushedDaysAgo: i,
  }));

  const prPayload = [
    { number: 1, title: 'Open work', state: 'open', merged_at: null },
    { number: 2, title: 'Fresh merge', state: 'closed', merged_at: isoAgo(2) },
    { number: 3, title: 'Ancient merge', state: 'closed', merged_at: isoAgo(60) },
    { number: 4, title: 'Just closed', state: 'closed', merged_at: isoAgo(1) },
  ];

  it('collects open + recently-merged, ignores stale closed PRs', async () => {
    const restore = stubFetch([['/pulls', prPayload]]);
    try {
      const res = await fetchPullRequests({ token: 't', owner: 'o', repos: repos(2), now: NOW });
      assert.ok(res, 'result returned');
      assert.equal(res.status, 'known');
      // per repo: 1 open + 2 recently-merged (fresh merge + just-closed-with-merge);
      // the 60-day-old merge is outside the 30-day window and excluded
      assert.equal(res.open, 2);
      assert.equal(res.recentlyMerged, 4);
      assert.equal(res.list.length, 6);
      assert.ok(res.list.every((p) => ['open', 'merged'].includes(p.state)));
      assert.equal(res.reposChecked, 2);
    } finally { restore(); }
  });

  it('is bounded: at most 5 repos, 20 PRs total', async () => {
    const few = Array.from({ length: 3 }, (_, i) => ({ number: i + 1, title: `P${i}`, state: 'open', merged_at: null }));
    const calls = [];
    const orig = globalThis.fetch;
    globalThis.fetch = async (url) => {
      calls.push(String(url));
      return { ok: true, status: 200, json: async () => few };
    };
    try {
      const res = await fetchPullRequests({ token: 't', owner: 'o', repos: repos(10), now: NOW });
      assert.equal(res.reposChecked, 5, 'only 5 repos queried');
      assert.equal(new Set(calls).size, 5);
      assert.equal(res.list.length, 15);
    } finally { globalThis.fetch = orig; }
    // and the per-PR cap stops the sweep early once 20 are collected
    const many = Array.from({ length: 30 }, (_, i) => ({ number: i + 1, title: `P${i}`, state: 'open', merged_at: null }));
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => many });
    try {
      const res = await fetchPullRequests({ token: 't', owner: 'o', repos: repos(10), now: NOW });
      assert.ok(res.list.length <= 20, `bounded total: ${res.list.length}`);
      assert.ok(res.reposChecked < 5, 'stops querying once the cap is hit');
    } finally { globalThis.fetch = orig; }
  });

  it('per-repo failure isolation: one repo down does not break the others', async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = async (url) => {
      if (String(url).includes('/r1/pulls')) return { ok: false, status: 500, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => prPayload };
    };
    const failedSections = [];
    try {
      const res = await fetchPullRequests({ token: 't', owner: 'o', repos: repos(3), now: NOW, failedSections });
      assert.ok(res, 'partial result returned');
      assert.equal(res.reposChecked, 2);
      assert.equal(res.open, 2);
      assert.ok(!failedSections.includes('pullRequests'), 'section itself not marked failed');
      assert.ok(failedSections.some((s) => s.startsWith('pullRequests:')), 'failing repo recorded');
    } finally { globalThis.fetch = orig; }
  });

  it('total failure -> null + section marked failed (=> neutral downstream)', async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = async () => { throw new Error('network down'); };
    const failedSections = [];
    try {
      const res = await fetchPullRequests({ token: 't', owner: 'o', repos: repos(3), now: NOW, failedSections });
      assert.equal(res, null);
      assert.ok(failedSections.includes('pullRequests'));
    } finally { globalThis.fetch = orig; }
  });

  it('no repos -> honest zero, not a failure', async () => {
    const res = await fetchPullRequests({ token: 't', owner: 'o', repos: [], now: NOW });
    assert.deepEqual([res.open, res.recentlyMerged, res.list.length], [0, 0, 0]);
    assert.equal(res.status, 'known');
  });

  it('fetchSnapshot wires PRs in when repos exist', async () => {
    const now = NOW;
    const orig = globalThis.fetch;
    globalThis.fetch = async (url) => {
      const u = String(url);
      const ok = (body) => ({ ok: true, status: 200, json: async () => body });
      if (u.includes('/pulls')) return ok([{ number: 7, title: 'Ship it', state: 'open', merged_at: null }]);
      if (u.includes('/search/issues')) return ok({ total_count: 1 });
      if (u.includes('/actions/runs')) return ok({ workflow_runs: [] });
      if (u.includes('/events/public')) return ok([]);
      if (u.includes('/releases')) return ok([]);
      if (u.includes('/repos/o/') && u.includes('/repos?')) return ok([]);
      if (u.endsWith('/repos?per_page=100&type=owner&sort=pushed') || u.includes('/users/o/repos')) {
        return ok([
          { id: 1, name: 'a', full_name: 'o/a', language: 'TypeScript', stargazers_count: 3, pushed_at: isoAgo(1), created_at: isoAgo(100) },
          { id: 2, name: 'b', full_name: 'o/b', language: 'Go', stargazers_count: 0, pushed_at: isoAgo(2), created_at: isoAgo(50) },
        ]);
      }
      if (u.includes('/users/o')) return ok({ login: 'o', name: 'O' });
      return { ok: false, status: 404, json: async () => ({}) };
    };
    try {
      const snap = await fetchSnapshot({ token: 't', owner: 'o', config: {} });
      assert.ok(snap.pullRequests, 'snapshot carries PRs');
      assert.equal(snap.pullRequests.open, 2, 'one open PR per repo');
      assert.ok(!snap.failedSections.includes('pullRequests'));
    } finally { globalThis.fetch = orig; }
  });
});

// ------------------------------------------------------------------
// state normalization + failure behavior
// ------------------------------------------------------------------
describe('pullRequests state normalization', () => {
  it('normalizes PR lists; hostile titles are sanitized at the boundary', () => {
    const state = buildNormalizedState({
      snap: prSnap({
        list: [{ number: 1, title: '<script>alert(1)</script>', state: 'open', repo: 'r' }],
        open: 1, recentlyMerged: 0, status: 'known',
      }),
    });
    assert.equal(state.pullRequests.status, 'known');
    assert.equal(state.pullRequests.open, 1);
    assert.ok(!state.pullRequests.list[0].title.includes('<script>'));
  });

  it('failed section -> neutral (no fake couriers); missing -> unknown; no crash', () => {
    const failed = buildNormalizedState({ snap: prSnap(undefined, { failedSections: ['pullRequests'] }) });
    assert.equal(failed.pullRequests.status, 'unknown');
    const world = buildWorld(failed);
    assert.equal(world.couriers.intensity, 'unknown');
    assert.equal(world.couriers.status, 'unknown');

    const missing = buildNormalizedState({ snap: prSnap(undefined) });
    assert.equal(missing.pullRequests.status, 'unknown');
  });

  it('stale last-known survives a failure (policy: last-known when allowed)', () => {
    const first = buildNormalizedState({ snap: prSnap(prs(6, 0)) });
    const second = buildNormalizedState({
      snap: prSnap(undefined, { failedSections: ['pullRequests'] }),
      prev: first,
    });
    assert.equal(second.pullRequests.status, 'stale');
    assert.equal(second.pullRequests.open, 6);
    assert.equal(buildWorld(second).couriers.intensity, 'active');
  });
});

// ------------------------------------------------------------------
// simulation: messenger task intensity + routes
// ------------------------------------------------------------------
describe('PR signal drives the messenger cohort (e2e)', () => {
  it('surge -> messengers travel document runs between projects and the castle', () => {
    const { world, sim } = pipeline(prs(10, 2));
    assert.equal(world.couriers.intensity, 'surge');
    const ms = messengers(sim);
    assert.equal(ms.length, 2);
    for (const m of ms) {
      assert.equal(m.state, 'traveling', `${m.id} state`);
      assert.match(m.task, /document runs?|courier surge/, `${m.id} task`);
      assert.equal(m.priority, 50, `${m.id} priority below harvest(55), above construction(40)`);
      // route rerouted onto the document corridor at midday
      assert.equal(m.routeId, 'project_quarter>castle_gate', `${m.id} routeId`);
    }
  });

  it('active -> document runs; trickle -> occasional runs; none -> quiet routine', () => {
    const active = messengers(pipeline(prs(4, 0)).sim);
    for (const m of active) {
      assert.equal(m.state, 'traveling');
      assert.match(m.task, /document runs/);
    }
    const trickle = messengers(pipeline(prs(1, 0)).sim);
    for (const m of trickle) {
      assert.equal(m.state, 'walking');
      assert.equal(m.task, 'occasional courier runs');
    }
    const none = messengers(pipeline(prs(0, 0)).sim);
    for (const m of none) {
      assert.equal(m.state, 'walking', 'base template state preserved');
      assert.equal(m.task, 'courier rounds', 'base template task preserved');
      assert.equal(m.priority, 20, 'normal priority, no inflation');
    }
  });

  it('unknown (fetch failed) -> quiet routine: no fake couriers, no crash', () => {
    const { world, sim } = pipeline(undefined, { failedSections: ['pullRequests'] });
    assert.equal(world.couriers.intensity, 'unknown');
    for (const m of messengers(sim)) {
      assert.equal(m.task, 'courier rounds');
      assert.ok(!/document|surge/.test(m.task), 'no document-run language invented');
    }
  });

  it('war dispatches outrank the PR surge (hierarchy preserved)', () => {
    const { sim } = pipeline(prs(12, 0), { war: { phase: 'BATTLE' } });
    for (const m of messengers(sim)) {
      assert.equal(m.task, 'war dispatches');
      assert.equal(m.priority, 100);
    }
  });

  it('intensity levels render differently; quiet levels are stable', () => {
    const h = (p) => sha(JSON.stringify(messengers(pipeline(p).sim)), 12);
    assert.notEqual(h(prs(0, 0)), h(prs(10, 0)), 'none vs surge differ');
    assert.notEqual(h(prs(1, 0)), h(prs(4, 0)), 'trickle vs active differ');
    assert.equal(h(undefined), h(prs(0, 0)), 'unknown renders like quiet none');
  });

  it('itineraryFor reroutes only messengers at active/surge; others unaffected', () => {
    const spec = { id: 'messenger-x', role: 'messenger', home: 'courier_station', work: 'courier_station', kind: 'wander', posts: ['market_square', 'royal_plaza'] };
    const legs = (i) => itineraryFor(spec, 's', false, i).legs;
    assert.equal(legs('unknown')[1].to, 'market_square');
    assert.equal(legs('none')[1].to, 'market_square');
    assert.equal(legs('trickle')[1].to, 'market_square');
    assert.equal(legs('active')[1].to, 'project_quarter');
    assert.equal(legs('active')[2].from, 'project_quarter');
    assert.equal(legs('active')[2].to, 'castle_gate');
    assert.equal(legs('surge')[1].to, 'project_quarter');
    const builder = { id: 'builder-x', role: 'builder', home: 'a', work: 'b', kind: 'worker' };
    assert.equal(itineraryFor(builder, 's', false, 'surge').legs[1].to, 'b', 'builders never rerouted');
  });

  it('deterministic: same PR input twice -> identical messenger actors', () => {
    const a = JSON.stringify(messengers(pipeline(prs(5, 3)).sim));
    const b = JSON.stringify(messengers(pipeline(prs(5, 3)).sim));
    assert.equal(a, b);
  });

  it('courier intensity reaches no visual as a precise count', () => {
    // the qualitative tier is the only thing downstream code may consume
    const { world } = pipeline(prs(10, 0));
    assert.deepEqual(Object.keys(world.couriers).sort(), ['intensity', 'provenance', 'status']);
  });
});
