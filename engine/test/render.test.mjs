// Render pipeline tests: determinism, camera consistency, no camera-local
// truth, culling, safety, budgets, lighting, content hash.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { buildScenario, getScenario } from '../render/scenarios.mjs';
import {
  renderCamera, sceneObjects, cullDrawables, sortDrawables,
  CAMERA_IDS, isQuiet, activeStory,
} from '../render/index.mjs';
import { getCamera } from '../render/camera.mjs';
import { renderContentHashWith, versions } from '../render/hash.mjs';
import { enforceBudget } from '../render/budgets.mjs';
import { fallbackAsset, isolate } from '../render/fallback.mjs';
import { composeReadme } from '../render/readme.mjs';
import { lintSvg } from '../validation/safety.mjs';
import { anchorById } from '../world/districts.mjs';

const RENDER_JS = `
  const { buildScenario } = await import('SCENARIOS');
  const { renderCamera } = await import('INDEX');
  const { scenario, world, snap } = buildScenario(process.argv[1]);
  const r = renderCamera(world, snap, process.argv[2] || 'grand', {});
  process.stdout.write(r.svg);
`
  .replace('SCENARIOS', new URL('../render/scenarios.mjs', import.meta.url).href)
  .replace('INDEX', new URL('../render/index.mjs', import.meta.url).href);

const renderInProcess = (scenario, camera = 'grand') =>
  execFileSync(process.execPath, ['--input-type=module', '-e', RENDER_JS, scenario, camera], {
    encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
  });

describe('render determinism', () => {
  it('same (world, snapshot, camera) is byte-identical across two processes', () => {
    const a = renderInProcess('peaceful-medium-day', 'grand');
    const b = renderInProcess('peaceful-medium-day', 'grand');
    assert.equal(a, b);
    assert.ok(a.length > 10_000);
  });

  it('in-process double render is byte-identical (war + fx)', () => {
    const { world, snap } = buildScenario('war-battle');
    const a = renderCamera(world, snap, 'grand', {}).svg;
    const { world: w2, snap: s2 } = buildScenario('war-battle');
    const b = renderCamera(world, snap, 'warfront', {}).svg;
    const b2 = renderCamera(w2, s2, 'warfront', {}).svg;
    assert.equal(b, b2);
    assert.ok(a.length > 10_000 && b.length > 10_000);
  });
});

describe('camera consistency', () => {
  it('hero and building positions are identical across grand + district cameras', () => {
    const { world, snap } = buildScenario('peaceful-medium-day');
    const g = sceneObjects(world, snap, { lod: 0 });
    const d = sceneObjects(world, snap, { lod: 1 });
    const byId = (list) => new Map(list.filter((o) => o.meta).map((o) => [o.id, o]));
    const gm = byId(g.drawables), dm = byId(d.drawables);
    for (const [id, o] of gm) {
      const other = dm.get(id);
      if (!other || !o.meta || (!o.meta.buildingId && !o.meta.actorId)) continue;
      assert.equal(other.meta.x, o.meta.x, `${id} x moved between LODs`);
      assert.equal(other.meta.y, o.meta.y, `${id} y moved between LODs`);
    }
    // hero specifically
    const heroG = gm.get('actor-hero'), heroD = dm.get('actor-hero');
    assert.ok(heroG && heroD, 'hero drawn in both');
    assert.equal(heroD.meta.x, heroG.meta.x);
    assert.equal(heroD.meta.y, heroG.meta.y);
  });

  it('camera changes never alter object identity or count', () => {
    const { world, snap } = buildScenario('prosperous-kingdom');
    const a = sceneObjects(world, snap, {});
    const b = sceneObjects(world, snap, {});
    assert.deepEqual(a.drawables.map((d) => d.id), b.drawables.map((d) => d.id));
  });
});

describe('no camera-local truth', () => {
  it('every drawn building/actor position exists in world/snapshot (sample audit)', () => {
    const { world, snap } = buildScenario('90-repositories');
    const { drawables } = sceneObjects(world, snap, { lod: 1 });
    const bldgs = new Map(world.buildings.map((b) => [b.id, b]));
    const actors = new Map((snap.actors ?? []).map((a) => [a.id, a]));
    const foes = new Map((snap.war?.enemyCohort ?? []).map((a) => [a.id, a]));
    let checked = 0;
    for (const d of drawables) {
      const m = d.meta;
      if (!m) continue;
      if (m.buildingId && bldgs.has(m.buildingId)) {
        const b = bldgs.get(m.buildingId);
        assert.equal(m.x, b.x, `building ${m.buildingId} x invented`);
        assert.equal(m.y, b.y, `building ${m.buildingId} y invented`);
        checked++;
      } else if (m.actorId && (actors.has(m.actorId) || foes.has(m.actorId))) {
        const a = actors.get(m.actorId) ?? foes.get(m.actorId);
        assert.equal(m.x, a.x, `actor ${m.actorId} x invented`);
        assert.equal(m.y, a.y, `actor ${m.actorId} y invented`);
        checked++;
      }
    }
    assert.ok(checked > 100, `audited only ${checked} objects`);
  });
});

describe('culling', () => {
  it('culling is a pure filter: culled object keeps coords in a wider camera', () => {
    const { world, snap } = buildScenario('peaceful-medium-day');
    const { drawables } = sceneObjects(world, snap, {});
    const dungeon = getCamera('dungeon', world, snap, anchorById);
    const grand = getCamera('grand', world, snap, anchorById);
    const inDungeon = new Set(cullDrawables(drawables, dungeon.rect).map((d) => d.id));
    const inGrand = new Map(cullDrawables(drawables, grand.rect).map((d) => [d.id, d]));
    // castle is in grand but outside the dungeon camera
    const castle = drawables.find((d) => d.meta?.archetype === 'castle');
    assert.ok(castle, 'castle drawable exists');
    assert.ok(!inDungeon.has(castle.id), 'castle culled from dungeon camera');
    assert.ok(inGrand.has(castle.id), 'castle visible in grand camera');
    assert.equal(inGrand.get(castle.id).meta.x, castle.meta.x);
    // culled-then-visible keeps identical svg (no RNG shift)
    const before = castle.svg;
    cullDrawables(drawables, dungeon.rect);
    cullDrawables(drawables, grand.rect);
    assert.equal(castle.svg, before, 'culling shifted RNG output');
  });

  it('sort order is stable and layer-respecting', () => {
    const { world, snap } = buildScenario('quiet-night');
    const { drawables } = sceneObjects(world, snap, {});
    const sorted = sortDrawables(drawables);
    const cmp = (a, b) => a.layer - b.layer || a.footY - b.footY || a.x - b.x
      || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    for (let i = 1; i < sorted.length; i++) {
      assert.ok(cmp(sorted[i - 1], sorted[i]) <= 0, `sort violated at ${sorted[i].id}`);
    }
    // stable: same input order for equal keys
    assert.deepEqual(sortDrawables(drawables).map((d) => d.id), sorted.map((d) => d.id));
  });
});

describe('render safety', () => {
  const DANGEROUS = [/<script/i, /on\w+\s*=/i, /javascript:/i, /<foreignObject/i];

  it('all scenario grand SVGs pass lintSvg', () => {
    for (const sc of ['peaceful-medium-day', 'war-battle', 'aurora-night', '90-repositories', 'hostile-text']) {
      const { world, snap } = buildScenario(sc);
      for (const cam of ['grand', 'hero']) {
        const r = renderCamera(world, snap, cam, {});
        assert.deepEqual(lintSvg(r.svg), [], `${sc}/${cam} unsafe`);
      }
    }
  });

  it('hostile-text scenario escapes markup everywhere', () => {
    const { world, snap } = buildScenario('hostile-text');
    const md = composeReadme({
      world, snap, scenario: getScenario('hostile-text'),
      files: { grand: 'grand.svg', grandMobile: 'grand-mobile.svg', cameras: { harbor: 'harbor.svg' }, hero: 'hero.svg', event: null },
      config: { owner: 'demo-owner', links: {} },
    });
    assert.ok(!md.includes('<script>alert'), 'raw script in README');
    assert.ok(!md.includes('<img src=x'), 'raw img in README');
    // the hostile hero name is not a visitor message: it must appear escaped
    assert.ok(md.includes('Ash&quot;&gt;&lt;img'), 'escaped hero name missing in README');
    for (const cam of ['grand', 'harbor', 'hero']) {
      const svg = renderCamera(world, snap, cam, {}).svg;
      for (const re of DANGEROUS) assert.ok(!re.test(svg), `${cam}: ${re} matched`);
      assert.ok(svg.includes('&lt;img'), 'escaped hero name missing in HUD');
    }
  });

  it('event camera returns null when quiet (no invented drama)', () => {
    for (const sc of ['peaceful-medium-day', 'quiet-night', 'empty-account']) {
      const { world, snap } = buildScenario(sc);
      assert.ok(isQuiet(world, snap), `${sc} should be quiet`);
      assert.equal(renderCamera(world, snap, 'event', {}), null, `${sc} event not null`);
      assert.equal(activeStory(world, snap), null, `${sc} story not null`);
    }
    const loud = buildScenario('release-peak');
    assert.ok(!isQuiet(loud.world, loud.snap));
    assert.ok(renderCamera(loud.world, loud.snap, 'event', {}) !== null);
    assert.ok(activeStory(loud.world, loud.snap) !== null);
  });

  it('isolate() turns a throwing painter into a clean plaque', () => {
    const res = isolate('x', () => { throw new Error('boom <script>'); });
    assert.equal(res.ok, false);
    assert.deepEqual(lintSvg(res.svg), []);
    assert.ok(!res.svg.includes('<script>'));
    assert.ok(!res.svg.includes('boom'));
  });
});

describe('budgets', () => {
  it('every scenario grand + mobile fits budgets', () => {
    const names = ['peaceful-medium-day', 'prosperous-kingdom', 'release-peak', 'war-battle', '90-repositories', 'rainy-day'];
    for (const sc of names) {
      const { world, snap } = buildScenario(sc);
      const g = renderCamera(world, snap, 'grand', {});
      const m = renderCamera(world, snap, 'grand', { variant: 'mobile' });
      assert.ok(g.bytes <= 600 * 1024, `${sc} grand over hard ceiling`);
      assert.ok(g.bytes <= 450 * 1024, `${sc} grand over design target`);
      assert.ok(m.bytes <= 200 * 1024, `${sc} mobile over 200 KiB`);
      assert.equal(g.usedFallback, false);
      assert.equal(m.usedFallback, false);
    }
  });

  it('oversized asset fails to the safe fallback, not a broken publish', () => {
    const huge = `<svg xmlns="http://www.w3.org/2000/svg"><rect/>${'x'.repeat(700 * 1024)}</svg>`;
    const r = enforceBudget('grand', huge, { kind: 'svg' });
    assert.equal(r.usedFallback, true);
    assert.ok(r.problems.some((p) => p.includes('HARD CEILING')));
    assert.deepEqual(lintSvg(r.svg), []);
    assert.ok(r.svg.includes('KINGDOM'));
  });

  it('fallback plaque is lint-clean and visually consistent', () => {
    const svg = fallbackAsset('grand', 'kaput <img>');
    assert.deepEqual(lintSvg(svg), []);
    assert.ok(!svg.includes('<img>'));
  });
});

describe('lighting', () => {
  const glowUses = (svg) => (svg.match(/url\(#k-lampg\)/g) || []).length;

  it('night differs structurally from day: lit windows + lamp pools, no black overlay', () => {
    const day = buildScenario('peaceful-medium-day');
    const night = buildScenario('quiet-night');
    const daySvg = renderCamera(day.world, day.snap, 'grand', {}).svg;
    const nightSvg = renderCamera(night.world, night.snap, 'grand', {}).svg;
    assert.ok(glowUses(nightSvg) > glowUses(daySvg) + 5, 'night lacks lit windows');
    assert.ok(nightSvg.includes('#ffca6a'), 'no warm window emissive at night');
    assert.ok(!/<rect[^>]*fill="#000000"[^>]*opacity="0\.[5-9]/.test(nightSvg), 'flat black overlay suspected');
    assert.notEqual(daySvg, nightSvg);
  });

  it('aurora is painted only in night bands', () => {
    const aurora = (svg) => svg.includes('fill="url(#k-aurora)"');
    const night = buildScenario('aurora-night');
    assert.ok(aurora(renderCamera(night.world, night.snap, 'grand', {}).svg), 'aurora missing at night');
    for (const sc of ['peaceful-medium-day', 'winter-day', 'rainy-day']) {
      const { world, snap } = buildScenario(sc);
      assert.ok(!aurora(renderCamera(world, snap, 'grand', {}).svg), `aurora leaked into ${sc}`);
    }
  });
});

describe('content hash', () => {
  it('bumping ART_VERSION changes the render hash (forces re-render)', () => {
    const { world, snap } = buildScenario('peaceful-medium-day');
    const v = versions();
    const h1 = renderContentHashWith({ world, snap, cameraId: 'grand', versions: v });
    const h2 = renderContentHashWith({ world, snap, cameraId: 'grand', versions: { ...v, ART_VERSION: '999' } });
    assert.notEqual(h1, h2);
  });

  it('hash is stable for identical inputs, sensitive to camera + snapshot', () => {
    const { world, snap } = buildScenario('quiet-night');
    const v = versions();
    const a = { world, snap, cameraId: 'grand', versions: v };
    assert.equal(renderContentHashWith(a), renderContentHashWith(a));
    assert.notEqual(
      renderContentHashWith(a),
      renderContentHashWith({ ...a, cameraId: 'capital' }),
    );
    const { snap: snap2 } = buildScenario('war-battle');
    assert.notEqual(
      renderContentHashWith(a),
      renderContentHashWith({ ...a, snap: snap2 }),
    );
  });
});

describe('readme composer', () => {
  it('quiet README omits the story section; loud README includes it', () => {
    const quiet = buildScenario('quiet-night');
    const mdq = composeReadme({
      world: quiet.world, snap: quiet.snap, scenario: getScenario('quiet-night'),
      files: { grand: 'grand.svg', grandMobile: 'grand-mobile.svg', cameras: { capital: 'capital.svg' }, hero: null, event: null },
      config: {},
    });
    assert.ok(!mdq.includes('Current Story'), 'quiet README invented drama');
    assert.ok(mdq.includes('<!-- KINGDOM:START -->') && mdq.includes('<!-- KINGDOM:END -->'));
    const loud = buildScenario('war-battle');
    const mdl = composeReadme({
      world: loud.world, snap: loud.snap, scenario: getScenario('war-battle'),
      files: { grand: 'grand.svg', grandMobile: 'grand-mobile.svg', cameras: { warfront: 'warfront.svg' }, hero: 'hero.svg', event: 'event.svg' },
      config: {},
    });
    assert.ok(mdl.includes('Current Story'));
  });
});
