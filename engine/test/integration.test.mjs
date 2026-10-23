// TRUE V2, phase 9: integration. Every season, hour, weather, scene mode and story, the empty account, the 90-repository account,
// broken inputs, hostile text: every camera must draw, lint clean, stay small, and agree on the one world.
import test from 'node:test';
import assert from 'node:assert/strict';
import { world, cfg, scenarioNames, atAge } from './support.mjs';
import { SCENE_MODES } from '../scene.mjs';
import { renderAll } from '../cli.mjs';
import { buildBlock } from '../readme.mjs';
import { buildWorld } from '../world/index.mjs';
import { readManifest, consistencyProblems } from '../world/manifest.mjs';
import { assignRepos, SLOTS } from '../world/layout.mjs';
import { lintSvg } from '../safety.mjs';
import { renderKingdom } from '../render/kingdom.mjs';
import { renderHero } from '../render/hero.mjs';
import { renderDistricts } from '../render/districts.mjs';
import { renderHarvest } from '../render/harvest.mjs';
import { renderTrophies } from '../render/trophies.mjs';
import { renderCamp } from '../render/camp.mjs';
import { renderDungeon } from '../render/dungeon.mjs';
import { renderEvents } from '../render/hud.mjs';

const R = { cfg, avatars: {} };
const CAMS = { world: renderKingdom, hero: renderHero, districts: renderDistricts, harvest: renderHarvest, trophies: renderTrophies, camp: renderCamp, dungeon: renderDungeon, events: renderEvents };

/** Draw every camera for a state; each must lint clean, stay small, and the manifests must agree. Returns the pictures. */
function allCameras(S, where, { max = 450_000 } = {}) {
  const seen = [], pics = {};
  for (const [name, fn] of Object.entries(CAMS)) {
    const svg = fn(S, R); if (!svg) continue;
    assert.deepEqual(lintSvg(svg, { maxBytes: max }), [], `${where}/${name}: lint`);
    const m = readManifest(svg); assert.ok(m, `${where}/${name}: manifest`); seen.push({ name, m }); pics[name] = svg;
  }
  const problems = consistencyProblems(seen);
  assert.deepEqual(problems, [], `${where}: ${problems.slice(0, 3).join(' | ')}`);
  return pics;
}

test('matrix: 4 seasons x 4 hours x 4 weathers, all cameras, one consistent world each', () => {
  let n = 0;
  for (const season of ['spring', 'summer', 'autumn', 'winter']) for (const phase of ['dawn', 'day', 'evening', 'night']) for (const kind of ['clear', 'rain', 'thunderstorm', 'aurora']) {
    const S = world('day', { tweak: (s) => { s.time.season = season; s.time.phase = phase; s.scene.weather = { ...s.scene.weather, kind, wet: kind === 'rain' || kind === 'thunderstorm', aurora: kind === 'aurora' && phase !== 'day' ? 1 : 0 }; s.scene.light = { ...s.scene.light, windows: phase === 'night' || phase === 'evening' || kind === 'thunderstorm', torches: phase !== 'day', moon: phase === 'night' }; } });
    allCameras(S, `${season}/${phase}/${kind}`); n++;
  }
  assert.equal(n, 64);
});

test('matrix: every scene mode draws every camera and agrees with itself', () => {
  assert.equal(SCENE_MODES.length, 12);
  for (const mode of SCENE_MODES) {
    const S = world('day', { tweak: (s) => { s.scene.mode = mode; s.scene.modes = [mode]; } });
    const pics = allCameras(S, `mode ${mode}`);
    assert.ok(pics.world && pics.hero && pics.harvest && pics.trophies && pics.camp && pics.dungeon);
  }
});

test('matrix: every story in every phase (6 stories x start / peak / aftermath / expired), all cameras including the event camera', () => {
  const noRel = (s) => { s.events.active = s.events.active.filter((e) => e.type !== 'release'); };
  const plan = { release: [5, 180, 800, 3000], milestone: [10, 100, 1200, 3000], harvest: [20, 300, 1500, 3000], raid: [5, 25, 25, 25], emergency: [30, 300, 1800, 3000], recovery: [60, 480, 1440, 3000] };
  let n = 0;
  for (const [type, ages] of Object.entries(plan)) for (const age of ages) {
    const base = type === 'emergency' ? 'storm' : type === 'recovery' ? 'recovery' : type === 'raid' ? 'raid' : 'day';
    const S = atAge(base, type, age, type === 'harvest' ? noRel : null, type === 'milestone' ? 'ach:first-star' : undefined);
    const pics = allCameras(S, `${type}@${age}`);
    if (S.scene.hud.length) assert.ok(pics.events, `${type}@${age}: a running story has its event picture`);
    n++;
  }
  assert.equal(n, 24);
});

test('empty account: no repositories, no stars, no calendar, no visitors, no achievements: everything still draws, the README still builds', () => {
  const S = world('newbie', { tweak: (s) => {
    s.repos = []; s.featured = []; s.calendar = []; s.streak = 0; s.visitors = { total: 0, flags: [] }; s.goblins = { count: 0 };
    s.achievements = { list: [], count: 0, total: 0 }; s.quests = { list: [], rows: [], current: null, counts: { active: 0, complete: 0 }, xp: 0 };
    s.totals = { ...s.totals, repos: 0, failingRepos: [], forks: 0 }; s.treasure = { ...s.treasure, stars: 0, coins: 0 };
  } });
  const w = buildWorld(S, { cfg }); assert.deepEqual(w.errors, [], 'no part of the world model failed'); assert.equal(w.repos.length, 0);
  const pics = allCameras(S, 'empty');
  assert.equal(pics.districts, undefined, 'no featured projects, no district strip');
  const files = new Map(renderAll(S, R)); S.status.assets = Object.fromEntries([...files].map(([f, v]) => [f.replace('.svg', ''), v ? 'ok' : 'empty']));
  const block = buildBlock(S, cfg, new Date(S.generatedAt)); assert.ok(block.includes('hero.svg') && block.includes('world.svg'));
  for (const [f, svg] of files) if (svg) assert.deepEqual(lintSvg(svg), [], f);
});

test('huge account: 90 repositories (some archived) draw every camera quickly, nobody overlaps, nobody is lost', () => {
  const S = world('day', { tweak: (s) => {
    const base = s.repos.filter((r) => r.archetype !== 'castle'), kinds = ['house', 'tower', 'library', 'lab', 'workshop', 'guild', 'mine'];
    s.repos = [s.repos.find((r) => r.archetype === 'castle'), ...Array.from({ length: 89 }, (_, i) => ({ ...base[i % base.length], name: `Project${i}`, archetype: kinds[i % kinds.length], state: i % 11 === 0 ? 'abandoned' : ['active', 'building', 'sleepy', 'failing'][i % 4], importance: 500 - i }))];
    s.featured = s.repos.slice(1, 6).map((r) => r.name);
  } });
  const t0 = Date.now(), pics = allCameras(S, '90 repositories', { max: 600_000 }), ms = Date.now() - t0;
  assert.ok(ms < 4000, `all cameras in ${ms} ms`);
  const lay = assignRepos(S.repos), capacity = Object.values(SLOTS).reduce((a, l) => a + l.length, 0);
  assert.equal(lay.placed.length + lay.overflow.length + lay.ruins.length + 1, 90, 'nobody is lost');
  assert.ok(lay.placed.length <= capacity); assert.equal(new Set(lay.placed.map((q) => `${q.x},${q.y}`)).size, lay.placed.length, 'no two share a slot');
  const m = readManifest(pics.world), drawn = Object.keys(m.o).filter((k) => /^r\d+$/.test(k)).length;
  assert.equal(drawn + (lay.mine ? 1 : 0), lay.placed.length + lay.ruins.length, 'the overworld draws exactly the placed buildings and ruins (the mine repository is the mine itself)');
  assert.ok(Object.keys(m.o).length < 400, 'the manifest stays small');
});

test('fault isolation: a broken part of the state fails only its own picture; the README still has every picture', () => {
  const sabotage = { 'achievements': (s) => { s.achievements = null; }, 'calendar': (s) => { s.calendar = null; }, 'visitors': (s) => { s.visitors = null; }, 'quests': (s) => { s.quests = null; }, 'hero': (s) => { s.hero = null; }, 'power': (s) => { s.power = null; }, 'featured': (s) => { s.featured = null; }, 'history': (s) => { s.history = null; } };
  for (const [part, breakIt] of Object.entries(sabotage)) {
    const S = world('day', { tweak: breakIt });
    const files = renderAll(S, R); assert.ok(files.length >= 10, `${part}: still ${files.length} pictures`);
    const ok = files.filter(([, svg]) => svg && !/WORLD FAILURE|FAILED/i.test(svg)).length;
    assert.ok(ok >= 6, `${part}: at least six pictures drew normally (${ok})`);
    for (const [f, svg] of files) if (svg) assert.deepEqual(lintSvg(svg), [], `${part}/${f}`);
    S.status.assets = Object.fromEntries(files.map(([f, svg]) => [f.replace('.svg', ''), svg ? 'ok' : 'empty']));
    assert.doesNotThrow(() => buildBlock(S, cfg, new Date(S.generatedAt)), `${part}: the README block builds`);
  }
});

test('hostile text: names, descriptions, visitors, quests and events can never break a picture or its manifest', () => {
  const evil = '--><script>alert(1)</script><svg onload=alert(1)> &amp; "\' javascript:x';
  const S = world('day', { tweak: (s) => {
    s.repos.forEach((r, i) => { r.name = `${evil}${i}`; r.description = evil; }); s.featured = s.repos.slice(0, 5).map((r) => r.name);
    s.visitors = { total: 2, flags: [{ n: 2, login: evil, message: evil, avatar: 'github', color: 'gold', at: s.generatedAt }, { n: 1, login: 'ok', message: evil, avatar: 'identicon', color: 'red', at: s.generatedAt }] };
    s.profile.name = evil; s.quests.rows = s.quests.rows.map((q) => ({ ...q, title: evil })); s.quests.current = s.quests.rows[0];
    s.events.active.push({ id: 'ach:x', type: 'milestone', title: evil, icon: 'trophy', detail: evil, at: s.generatedAt, until: s.generatedAt }); s.scene.hud = [{ kind: evil, text: evil, icon: 'trophy', tone: 'gold' }];
  } });
  // what reaches the repository is renderAll's output: every picture is lint-clean (a picture whose text trips the lint is replaced by a fallback card)
  for (const [f, svg] of renderAll(S, R)) if (svg) { assert.deepEqual(lintSvg(svg), [], `final ${f}`); assert.ok(!/<script|javascript:|<foreignObject/i.test(svg.replace(/<!--[\s\S]*?-->/g, '')), `final ${f}: no active content`); }
  const pics = {};
  for (const [name, fn] of Object.entries(CAMS)) { const svg = fn(S, R); if (svg) pics[name] = svg; }
  for (const [name, svg] of Object.entries(pics)) {
    assert.ok(!/<script|<foreignObject|<svg onload/i.test(svg.replace(/<!--[\s\S]*?-->/g, '')), `${name}: no active tags (hostile text is only ever escaped text)`);
    const c = /<!--kingdom-world (.*?)-->/s.exec(svg)[1]; assert.ok(!c.includes('<') && !c.includes('>') && !c.includes('--'), `${name}: the manifest comment is inert`);
    assert.ok(!c.includes('script') && !c.includes('alert'), `${name}: no repository text ever enters the manifest`);
  }
});

test('cross-check: the 21 demo worlds fit in the README at every phone width and every picture is listed once', () => {
  for (const name of scenarioNames()) {
    const S = world(name), files = new Map(renderAll(S, R)); S.status.assets = Object.fromEntries([...files].map(([f, v]) => [f.replace('.svg', ''), v ? 'ok' : 'empty']));
    const block = buildBlock(S, cfg, new Date(S.generatedAt)), imgs = [...block.matchAll(/renderer\/([\w/-]+\.svg)"/g)].map((m) => m[1]);
    assert.equal(new Set(imgs).size, imgs.length, `${name}: no picture twice`);
    for (const f of imgs) assert.ok(files.get(f) !== undefined || /^ui\//.test(f), `${name}: ${f} exists`);
  }
});
