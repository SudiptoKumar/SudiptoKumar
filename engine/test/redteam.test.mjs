// Red-team: hostile shapes, not just hostile strings (spec prompt 04-RED-TEAM).
// - missing/empty/null fields everywhere -> no crash, neutral rendering
// - torn persisted world -> one asset renderer throws -> safe fallback
//   plaque, remaining assets complete, README still generated
// - repeated identical updates -> writeIfChanged holds (no spurious diffs)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildNormalizedState } from '../domain/state.mjs';
import { buildWorld } from '../world/world.mjs';
import { simulate } from '../simulation/simulate.mjs';
import { renderCamera, renderAllCameras } from '../render/index.mjs';
import { composeReadme } from '../render/readme.mjs';
import { lintSvg } from '../validation/safety.mjs';
import { fallbackAsset, clearErrorLog } from '../render/fallback.mjs';
import { sampleState } from './fixture.mjs';
import { run } from '../cli.mjs';

const sparseSnap = (over = {}) => ({
  seed: 'sparse', kingdomName: 'Sparse', owner: 'sparse-owner', powerTier: 'town',
  repos: [
    // every optional field missing or null
    { name: 'bare' },
    { name: 'nulls', fullName: null, description: null, language: null, stars: null, ageDays: null, recentCommits: null, pushedDaysAgo: null, archived: null },
  ],
  issues: {}, ci: {}, releases: [{}],
  contributions: {}, achievements: [{}],
  visitors: [{}, { login: null, kind: 'weird', message: null }],
  pullRequests: { list: [{}], open: null, recentlyMerged: null },
  hero: null,
  time: { phase: 'nope', season: 'nope', weather: 'hurricane' },
  war: {},
  events: [],
  ...over,
});

describe('missing / empty / null fields', () => {
  it('sparse snapshot normalizes without crashing; unknowns stay neutral', () => {
    const state = buildNormalizedState({ snap: sparseSnap() });
    assert.equal(state.time.weather, 'clear', 'unknown weather falls back to clear');
    assert.equal(state.time.phase, 'morning');
    assert.equal(state.hero.present, false);
    assert.equal(state.pullRequests.status, 'unknown');
    const world = buildWorld(state);
    assert.equal(world.couriers.intensity, 'unknown', 'PR unknowns stay neutral');
    assert.equal(world.dungeon.tier, 'unknown');
    assert.equal(world.fortress.state, 'unknown');
    const sim = simulate(world, { timeBucket: 'sparse-t', inputs: {} });
    assert.ok(sim.actors.length > 0, 'citizens still exist');
    assert.ok(!sim.actors.some((a) => a.role === 'hero'), 'no hero actor when hero is null');
  });

  it('empty arrays everywhere -> quiet world, still renders', () => {
    const state = buildNormalizedState({
      snap: sparseSnap({
        repos: [], releases: [], achievements: [], visitors: [],
        pullRequests: { list: [], open: 0, recentlyMerged: 0, status: 'known' },
        hero: { name: 'H', class: 'warden', gearTier: 1 },
      }),
    });
    const world = buildWorld(state);
    const sim = simulate(world, { timeBucket: 'empty-t', inputs: {} });
    assert.equal(world.couriers.intensity, 'none');
    for (const cam of ['grand', 'capital', 'projects', 'farm', 'dungeon', 'harbor']) {
      const r = renderCamera(world, sim, cam, { inputSignature: 'sparse' });
      assert.deepEqual(lintSvg(r.svg), [], `${cam} lint-clean on empty input`);
    }
  });

  it('repos missing language/pushed_at/stars get deterministic fallbacks', () => {
    const state = buildNormalizedState({ snap: sparseSnap() });
    const world = buildWorld(state);
    const bare = world.buildings.find((b) => b.sourceId === 'bare');
    assert.ok(bare, 'fieldless repo still placed');
    assert.ok(bare.archetype, 'archetype falls back deterministically');
    // same input twice -> same fallback (no hidden randomness)
    const again = buildWorld(buildNormalizedState({ snap: sparseSnap() }));
    assert.equal(
      JSON.stringify(world.buildings.map((b) => [b.id, b.archetype, b.lifecycle])),
      JSON.stringify(again.buildings.map((b) => [b.id, b.archetype, b.lifecycle])),
    );
  });
});

describe('renderer failure injection', () => {
  it('torn world (buildings: 42) -> the failing asset becomes a lint-clean plaque', () => {
    clearErrorLog();
    const world = buildWorld(sampleState());
    const sim = simulate(world, { timeBucket: 'torn-t', inputs: {} });
    const torn = JSON.parse(JSON.stringify(world));
    torn.buildings = 42; // models a torn data/world.json write
    const r = renderCamera(torn, sim, 'farm', { inputSignature: 'torn' });
    assert.equal(r.usedFallback, true, 'failure isolated to the asset');
    assert.deepEqual(r.problems.filter((p) => p.includes('fallback')), ['render failed — fallback used']);
    assert.deepEqual(lintSvg(r.svg), [], 'fallback plaque is lint-clean');
    assert.ok(r.svg.includes('KINGDOM'), 'plaque is visually consistent, no stack trace');
    assert.ok(!r.svg.includes('is not iterable'), 'no raw error text in output');
    // the plaque is the documented fallback shape
    assert.ok(r.svg.includes('the kingdom endures'), 'plaque carries the recovery line');
    assert.equal(r.svg, fallbackAsset('farm', 'this view failed to render'), 'plaque is byte-stable');
  });

  it('remaining assets complete and the README is still generated', () => {
    const world = buildWorld(sampleState());
    const sim = simulate(world, { timeBucket: 'torn-t2', inputs: {} });
    const all = renderAllCameras(world, sim, { inputSignature: 'torn' });
    const ids = Object.keys(all);
    assert.ok(ids.includes('grand') && ids.includes('capital'), 'other cameras rendered');
    for (const id of ids) {
      assert.equal(all[id].usedFallback, false, `${id} complete`);
      assert.deepEqual(lintSvg(all[id].svg), [], `${id} lint-clean`);
    }
    // README generation does not depend on any single asset succeeding:
    // even if every camera fell back, composition still produces the document.
    const md = composeReadme({
      world, snap: sim, scenario: { name: 'torn' },
      files: { grand: 'grand.svg', grandMobile: 'grand-mobile.svg', cameras: { farm: 'farm.svg' }, hero: null, event: null },
      config: {}, state: null,
    });
    assert.ok(md.length > 1000, 'README generated');
    assert.ok(md.includes('#'), 'README has headings');
  });
});

describe('repeated identical updates', () => {
  it('update twice with the same fixture -> second run writes nothing', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kingdom-rerun-'));
    try {
      const argv = ['node', 'cli.mjs', 'update', '--offline', '--now', '2026-10-07T07:00:00+06:00'];
      const r1 = await run(argv, root);
      assert.equal(r1.ok, true, 'first update ok');
      assert.equal(r1.wrote, true, 'first update writes the world');
      const snapFiles = (dir) => {
        const out = [];
        const walk = (d) => {
          for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const f = path.join(d, e.name);
            if (e.isDirectory()) walk(f);
            else out.push([path.relative(root, f), fs.readFileSync(f, 'utf8')]);
          }
        };
        walk(dir);
        return out.sort((a, b) => (a[0] < b[0] ? -1 : 1));
      };
      const before = snapFiles(path.join(root, 'data'));
      const renderBefore = snapFiles(path.join(root, 'renderer'));
      assert.ok(before.length > 0 && renderBefore.length > 0, 'update produced data + renderer outputs');

      const r2 = await run(argv, root);
      assert.equal(r2.ok, true, 'second update ok');
      assert.equal(r2.wrote, false, 'world.json unchanged -> not rewritten');
      assert.deepEqual(snapFiles(path.join(root, 'data')), before, 'no spurious data diffs');
      assert.deepEqual(snapFiles(path.join(root, 'renderer')), renderBefore, 'no spurious renderer diffs');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
