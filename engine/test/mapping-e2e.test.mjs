// Cause -> effect, end to end (spec §06 mapping table).
// Crafted GitHub-like inputs -> normalized state -> world -> simulation ->
// rendered SVG. Each row of the mapping table is verified at its PRIMARY
// physical home. No network; fully deterministic.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildNormalizedState } from '../domain/state.mjs';
import { buildWorld } from '../world/world.mjs';
import { simulate } from '../simulation/simulate.mjs';
import { renderCamera } from '../render/index.mjs';
import { composeReadme } from '../render/readme.mjs';
import { sha } from '../util.mjs';

const LANGS = ['TypeScript', 'Go', 'Rust', 'Python', 'Java'];
const STARS = [12, 240, 8, 1500, 60];
const repo = (name, over = {}) => ({
  id: name, name, fullName: `e2e/${name}`, description: `${name} project`,
  language: 'TypeScript', stars: 10, ageDays: 100, recentCommits: 2, pushedDaysAgo: 2,
  archived: false, featured: false, ...over,
});

function e2eSnap(over = {}) {
  return {
    seed: 'e2e-cause-effect', kingdomName: 'E2E Kingdom', owner: 'e2e-owner', powerTier: 'city',
    repos: LANGS.map((language, i) => repo(`proj-${i}`, {
      language,
      stars: STARS[i],
      ageDays: [400, 30, 900, 120, 120][i],
      recentCommits: [12, 25, 0, 3, 0][i],
      pushedDaysAgo: [1, 0, 400, 200, 200][i],
    })),
    issues: { open: 5, closed: 3 },
    ci: { status: 'healthy' },
    releases: [],
    contributions: { activeDays: 120, streak: 9 },
    achievements: [],
    visitors: [],
    hero: { name: 'E2E Hero', class: 'warden', gearTier: 3 },
    time: { phase: 'morning', season: 'autumn', weather: 'clear' },
    war: { phase: 'PEACE' },
    events: [],
    ...over,
  };
}

const pipeline = (snap, inputs = {}) => {
  const state = buildNormalizedState({ snap });
  const world = buildWorld(state);
  const sim = simulate(world, { timeBucket: 'morning-autumn-clear-e2e', inputs });
  return { state, world, sim };
};
const svgOf = (world, sim, camera, opts = {}) =>
  renderCamera(world, sim, camera, { inputSignature: 'e2e', ...opts }).svg;
const hashOf = (s) => sha(s, 12);

describe('mapping end-to-end (spec §06)', () => {
  it('repos in 5 languages -> 5 buildings: archetype, level from stars, lifecycle from activity, language flavor', () => {
    const { world } = pipeline(e2eSnap());
    const rb = world.buildings.filter((b) => b.source === 'repo');
    assert.equal(rb.length, 5);
    // 5 languages -> 5 distinct language flavors recorded on the buildings
    assert.equal(new Set(rb.map((b) => b.variant)).size, 5);
    // stars -> level: 1500 stars => level 4, 8 stars => level 1
    const bySrc = (id) => rb.find((b) => b.sourceId === id);
    assert.equal(bySrc('e2e/proj-3').level, 4);
    assert.equal(bySrc('e2e/proj-2').level, 1);
    // activity -> lifecycle: pushed yesterday => construction; stale 900d => abandoned; stale 500d => sleepy
    assert.equal(bySrc('e2e/proj-0').lifecycle, 'construction');
    assert.equal(bySrc('e2e/proj-2').lifecycle, 'abandoned');
    assert.equal(bySrc('e2e/proj-4').lifecycle, 'sleepy');
    // inactivity is visible: sleepy/abandoned buildings render differently
    const fresh = pipeline(e2eSnap());
    const stale = pipeline(e2eSnap({
      repos: LANGS.map((language, i) => repo(`proj-${i}`, { language, stars: 10, ageDays: 500, recentCommits: 0, pushedDaysAgo: 400 })),
    }));
    assert.notEqual(
      hashOf(svgOf(fresh.world, fresh.sim, 'projects')),
      hashOf(svgOf(stale.world, stale.sim, 'projects')),
      'inactivity changes the project quarter rendering',
    );
  });

  it('featured repos become prominent flourishing buildings', () => {
    const { world } = pipeline(e2eSnap({
      repos: [repo('crown-jewel', { stars: 900, ageDays: 400, recentCommits: 0, pushedDaysAgo: 60, featured: true })],
    }));
    const b = world.buildings.find((x) => x.sourceId === 'e2e/crown-jewel');
    assert.ok(b, 'featured repo placed');
    assert.equal(b.lifecycle, 'flourishing');
    assert.ok(b.level >= 3, `level ${b.level} reflects 900 stars`);
  });

  it('issues 0/5/15/25 -> dungeon glow tiers dormant/active/crowded/crisis', () => {
    const cases = [[0, 'dormant', 0], [5, 'active', 5], [15, 'crowded', 9], [25, 'crisis', 14]];
    const hashes = [];
    for (const [open, tier, goblins] of cases) {
      const { world, sim } = pipeline(e2eSnap({ issues: { open } }));
      assert.equal(world.dungeon.tier, tier, `open=${open}`);
      assert.equal(world.dungeon.goblins, goblins, `open=${open}`);
      const svg = svgOf(world, sim, 'dungeon');
      hashes.push(hashOf(svg));
      const glow = /r="30" fill="(#[0-9a-f]{6})" opacity="0.3"/.exec(svg);
      if (tier === 'dormant') {
        assert.equal(glow, null, 'dormant dungeon: no pressure glow');
      } else {
        const expected = tier === 'crisis' ? '#e0523c' : tier === 'crowded' ? '#f0a53c' : '#6fe0b8';
        assert.ok(glow, `${tier}: glow present`);
        assert.equal(glow[1], expected, `${tier}: glow color`);
      }
    }
    assert.equal(new Set(hashes).size, 4, 'each pressure tier renders differently');
  });

  it('CI healthy/failing/recovering/unknown -> fortress beacon states; unknown stays neutral', () => {
    const cases = [
      ['healthy', 'steady-green', '#58c472', false],
      ['failing', 'red-alarm', '#e0523c', true],
      ['recovering', 'amber-steady', '#6fe0b8', false],
      ['unknown', 'neutral-dim', '#8b93a0', false],
    ];
    for (const [ci, beacon, color, alarm] of cases) {
      const { world, sim } = pipeline(e2eSnap({ ci: { status: ci } }));
      assert.equal(world.fortress.beacon, beacon, `ci=${ci}`);
      assert.equal(world.fortress.alarm, alarm, `ci=${ci}`);
      const svg = svgOf(world, sim, 'grand');
      assert.ok(svg.includes(color), `ci=${ci}: beacon paints ${color}`);
    }
    // unknown CI is visibly neutral: dim gray beacon, no alarm ring glow
    const { world, sim } = pipeline(e2eSnap({ ci: { status: 'unknown' } }));
    assert.equal(world.fortress.status, 'unknown');
    assert.equal(world.fortress.alarm, false);
    assert.equal(world.fortress.engineers, 0);
  });

  it('release -> royal-plaza celebration: banners/confetti/fireworks at peak, story banner in the render', () => {
    const { world } = pipeline(e2eSnap({ releases: [{ tag: 'v9.0.0', name: 'Ninth age' }] }));
    const rel = world.events.find((e) => e.type === 'release');
    assert.ok(rel, 'release becomes a world event');
    assert.equal(rel.anchor, 'royal_plaza');
    assert.equal(rel.severity, 'celebration');
    // choreography: the same release at PEAK raises the celebration fx
    const hot = pipeline(
      e2eSnap({ releases: [{ tag: 'v9.0.0', name: 'Ninth age' }] }),
      { events: [{ id: 'rel-9', type: 'release', phase: 'PEAK', anchor: 'royal_plaza' }] },
    );
    const fx = new Set(hot.sim.effects.map((e) => e.type));
    for (const t of ['banners', 'confetti', 'fireworks']) assert.ok(fx.has(t), `fx includes ${t}`);
    const grand = svgOf(hot.world, hot.sim, 'grand');
    assert.ok(grand.includes('Celebration banners raised'), 'HUD story banner names the celebration');
    assert.ok(grand.includes('royal plaza'), 'story banner names the anchor');
    assert.ok(renderCamera(hot.world, hot.sim, 'event', { inputSignature: 'e2e' }),
      'event camera exists while the celebration is loud');
  });

  it('contributions -> farm maturity; streak >= 7 -> glowing maintained-field marker', () => {
    // data level: maturity tiers from active days
    for (const [activeDays, maturity] of [[5, 'fallow'], [10, 'sprouting'], [60, 'growing'], [120, 'mature'], [300, 'harvest']]) {
      const { world } = pipeline(e2eSnap({ contributions: { activeDays, streak: 9 } }));
      assert.equal(world.farm.maturity, maturity, `activeDays=${activeDays}`);
      assert.equal(world.farm.streakMarker, true, '9-day streak keeps the glowing marker');
    }
    const quiet = pipeline(e2eSnap({ contributions: { activeDays: 120, streak: 3 } }));
    assert.equal(quiet.world.farm.streakMarker, false, 'short streak: no glowing marker');
    // render level: maturity changes the fields in the seasons where it matters.
    // spring: fallow (bare dirt) vs growing (planting green); autumn: growing vs harvest-ready (gold)
    const spring = (activeDays) => pipeline(e2eSnap({
      contributions: { activeDays, streak: 9 }, time: { phase: 'morning', season: 'spring', weather: 'clear' },
    }));
    const autumn = (activeDays) => pipeline(e2eSnap({
      contributions: { activeDays, streak: 9 }, time: { phase: 'morning', season: 'autumn', weather: 'clear' },
    }));
    const farmHash = ({ world, sim }) => hashOf(svgOf(world, sim, 'farm'));
    assert.notEqual(farmHash(spring(5)), farmHash(spring(60)), 'spring: fallow vs planted fields differ');
    assert.notEqual(farmHash(autumn(60)), farmHash(autumn(300)), 'autumn: growing vs harvest-ready fields differ');
  });

  it('achievements -> hall of heroes monuments', () => {
    const achievements = [
      { id: 'a1', title: 'First commit', unlocked: true },
      { id: 'a2', title: 'Hundred stars', unlocked: true },
      { id: 'a3', title: 'Secret', unlocked: false },
    ];
    const { world, sim } = pipeline(e2eSnap({ achievements }));
    assert.equal(world.hall.entries.length, 2, 'only unlocked achievements enter the hall');
    for (const e of world.hall.entries) {
      assert.equal(e.anchor, 'hall_of_heroes');
      assert.ok(['statue', 'banner', 'plaque', 'trophy', 'monument'].includes(e.kind));
    }
    const bare = pipeline(e2eSnap({ achievements: [] }));
    assert.notEqual(
      hashOf(svgOf(world, sim, 'capital')),
      hashOf(svgOf(bare.world, bare.sim, 'capital')),
      'trophies change the capital rendering',
    );
  });

  it('visitors incl. hostile text -> harbor camp entries; hostile text sanitized, presence kept', () => {
    const { world, sim } = pipeline(e2eSnap({
      visitors: [
        { login: 'traveler-jo', kind: 'flag', message: 'greetings from the north road' },
        { login: 'nice-try"><svg>', kind: 'flag', message: '<script>alert(1)</script>' },
        { login: 'xss2', kind: 'raid', message: '"><img src=x onerror=alert(2)>' },
      ],
    }));
    assert.equal(world.visitors.entries.length, 3);
    const [ok, hostile, raid] = world.visitors.entries;
    assert.equal(ok.login, 'traveler-jo');
    assert.equal(ok.message, 'greetings from the north road');
    assert.equal(ok.anchor, 'harbor_docks');
    assert.equal(ok.campAnchor, 'visitor_camp');
    // hostile login is reduced to a safe shape; hostile messages are rejected, never stored raw
    assert.match(hostile.login, /^[a-z0-9-]+$/);
    assert.ok(!hostile.login.includes('<') && !hostile.login.includes('>'));
    assert.equal(hostile.message, null);
    assert.ok(hostile.messageRejected);
    assert.equal(raid.message, null);
    // tents stand in the visitor camp
    const tents = world.buildings.filter((b) => b.archetype === 'tent' && b.district === 'visitors');
    assert.ok(tents.length >= 1, 'visitor camp has tents');
    // the rendered harbor + README carry no executable hostile text
    const harbor = svgOf(world, sim, 'harbor');
    assert.ok(!harbor.includes('<script') && !harbor.includes('onerror'));
    const md = composeReadme({
      world, snap: sim, scenario: { name: 'e2e' },
      files: { grand: 'grand.svg', grandMobile: 'grand-mobile.svg', cameras: {}, hero: null, event: null },
      config: {}, state: null,
    });
    assert.ok(!md.includes('<script>alert(1)</script>'));
    assert.ok(!md.includes('onerror=alert(2)'));
    assert.ok(md.includes('traveler-jo'), 'friendly visitor still listed');
  });

  it('archived repo with a recent push -> repairing building (recovery story: scaffolding)', () => {
    const mk = (archived) => pipeline(e2eSnap({
      repos: [repo('old-keep', { ageDays: 700, recentCommits: 4, pushedDaysAgo: 1, archived })],
    }));
    const underRepair = mk(true);
    const b = underRepair.world.buildings.find((x) => x.sourceId === 'e2e/old-keep');
    assert.ok(b);
    assert.equal(b.lifecycle, 'repairing');
    // the repair is visible: scaffold wrap replaces the plain building drawing
    const sleeping = pipeline(e2eSnap({
      repos: [repo('old-keep', { ageDays: 700, recentCommits: 0, pushedDaysAgo: 400, archived: true })],
    }));
    assert.equal(sleeping.world.buildings.find((x) => x.sourceId === 'e2e/old-keep').lifecycle, 'sleepy');
    assert.notEqual(
      hashOf(svgOf(underRepair.world, underRepair.sim, 'projects')),
      hashOf(svgOf(sleeping.world, sleeping.sim, 'projects')),
      'repairing state visibly differs from sleepy',
    );
  });

  it('partial GitHub failure: failed sections stay neutral, the rest of the world builds', () => {
    const { world } = pipeline(e2eSnap({ failedSections: ['ci', 'issues'] }));
    assert.equal(world.fortress.status, 'unknown');
    assert.equal(world.fortress.beacon, 'neutral-dim');
    assert.equal(world.dungeon.status, 'unknown');
    assert.equal(world.dungeon.tier, 'unknown');
    assert.ok(world.buildings.length > 0, 'unaffected systems keep building');
    assert.equal(world.farm.status, 'known');
  });
});

describe('traceability: every spec §06 mapping row has a world home', () => {
  // Each row: [spec §06 signal, world location, probe]
  const { world } = pipeline(e2eSnap({
    pullRequests: { list: [{ number: 1, title: 'T', state: 'open', repo: 'r' }], open: 1, recentlyMerged: 0, status: 'known' },
  }));
  it('all 17 mapping rows resolve to a concrete world location', () => {
    const rows = [
      ['Repository', () => world.buildings.some((b) => b.source === 'repo'), 'world.buildings (placeBuildings)'],
      ['Repository age', () => world.buildings.every((b) => b.lifecycle), 'building.lifecycle'],
      ['Commit activity', () => world.buildings.some((b) => b.lifecycle === 'construction'), 'construction lifecycle'],
      ['Language', () => world.buildings.every((b) => b.variant), 'building.variant (language flavor)'],
      ['Stars', () => world.buildings.every((b) => Number.isInteger(b.level)), 'building.level'],
      ['Issues', () => world.dungeon && world.dungeon.tier === 'active', 'world.dungeon (dungeonPressure)'],
      ['Pull requests', () => world.couriers && world.couriers.intensity === 'trickle', 'world.couriers (courierIntensity)'],
      ['CI health', () => world.fortress && world.fortress.beacon === 'steady-green', 'world.fortress (fortressState)'],
      ['Releases', () => world.events, 'world.events (releaseEvents)'],
      ['Contributions', () => world.farm && world.farm.maturity === 'mature', 'world.farm (farmState)'],
      ['Streak', () => world.farm.streakMarker === true, 'world.farm.streakMarker'],
      ['Achievements', () => world.hall && Array.isArray(world.hall.entries), 'world.hall (hallEntries)'],
      ['Visitors', () => world.visitors && Array.isArray(world.visitors.entries), 'world.visitors (visitorEntries)'],
      ['Profile identity', () => world.hero && world.hero.name === 'E2E Hero', 'world.hero'],
      ['Featured repos', () => world.buildings, 'lifecycle flourishing (tested above)'],
      ['Inactivity', () => world.buildings.some((b) => ['sleepy', 'abandoned'].includes(b.lifecycle)), 'sleepy/abandoned lifecycle'],
      ['Recovery', () => true, 'repairing lifecycle (tested above)'],
    ];
    for (const [signal, probe, home] of rows) {
      assert.ok(probe(), `§06 row "${signal}" -> ${home}`);
    }
  });

  it('every required district has a spatial home (id + rect inside world bounds)', () => {
    const required = [
      'capital', 'projects', 'workshops', 'residential', 'market', 'knowledge',
      'guild', 'farms', 'orchard', 'military', 'warfront', 'harbor', 'visitors',
      'automation', 'dungeon', 'ruins', 'highforest', 'mountains', 'builderyard',
    ];
    const byId = Object.fromEntries(world.districts.map((d) => [d.id, d]));
    for (const id of required) {
      const d = byId[id];
      assert.ok(d, `district ${id} exists`);
      assert.ok(d.rect && Number.isFinite(d.rect.x) && Number.isFinite(d.rect.w) && d.rect.w > 0, `${id} has a spatial rect`);
      assert.ok(d.rect.x >= 0 && d.rect.y >= 0, `${id} inside bounds`);
      assert.ok(d.rect.x + d.rect.w <= world.map.width && d.rect.y + d.rect.h <= world.map.height, `${id} inside bounds`);
    }
    assert.equal(world.districts.length, 19, 'exactly the 19 documented districts');
  });
});
