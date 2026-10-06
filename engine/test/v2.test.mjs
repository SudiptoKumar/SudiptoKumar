// Version 2: repository evolution, kingdom power, quests, the scene, the pictures and the README.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mockSnapshot, demoScenarios, seedDemoStore } from '../mock.mjs';
import { DEFAULTS } from '../config.mjs';
import { EMPTY } from '../store.mjs';
import { buildState } from '../state.mjs';
import { renderAll, ASSETS, extraAssets } from '../cli.mjs';
import { lintSvg } from '../safety.mjs';
import { buildBlock } from '../readme.mjs';
import { repoEvolution, EVOLUTION_LEVELS } from '../evolution.mjs';
import { kingdomPower, heroTitle } from '../power.mjs';
import { evaluateQuests } from '../quests.mjs';
import { buildScene, failStage, repairStage, buildStage, SCENE_MODES, HERO_STATES } from '../scene.mjs';
import { finalizeV2 } from '../v2.mjs';
import { raidView } from '../events.mjs';
import { assignRepos, SLOTS } from '../render/kingdom-layout.mjs';
import { mapLabels, renderKingdom } from '../render/kingdom.mjs';
import { renderDistricts } from '../render/districts.mjs';
import { renderHarvest } from '../render/harvest.mjs';
import { renderWarfront } from '../render/warfront.mjs';
import { renderBuilderyard } from '../render/builderyard.mjs';
import { renderHeroguild } from '../render/heroguild.mjs';
import { renderCamp } from '../render/camp.mjs';
import { pickSnapshots } from '../render/chronicle.mjs';
import { plateLines } from '../render/districts.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const cfg = { ...structuredClone(DEFAULTS), owner: 'SudiptoKumar', repo: 'SudiptoKumar', timezone: 'UTC' };
const freshStore = () => { const s = Object.fromEntries(Object.entries(EMPTY).map(([k, f]) => [k, f()])); s.prev = null; return s; };
const world = (name) => { const sc = demoScenarios()[name]; const store = seedDemoStore(sc); return { sc, store, state: buildState({ snap: mockSnapshot({ now: sc.now, scenario: sc.scenario }), cfg, now: sc.now, store, demo: true }) }; };
const at = (iso) => new Date(iso);

// ------------------------------------------------------------------ evolution
test('repository evolution: same data, same level; levels climb with real work', () => {
  const base = { commits90: 20, commits: 120, pushedDays: 1, ageDays: 60, releases: 1, stars: 3, forks: 0, state: 'building', workflow: 'passing' };
  assert.deepEqual(repoEvolution(base), repoEvolution({ ...base }));
  const lvl = (o) => repoEvolution({ ...base, ...o }).level;
  assert.ok(lvl({}) >= 4);
  assert.ok(lvl({ commits90: 0, commits: 3, pushedDays: 200, releases: 0, stars: 0, ageDays: 400, state: 'sleepy' }) <= 2, 'a quiet project cannot be big');
  assert.equal(lvl({ state: 'abandoned' }), 1, 'ruins stay at the foundation level');
  assert.ok(lvl({ workflow: 'failing' }) <= lvl({}), 'a failing workflow never helps');
  assert.equal(EVOLUTION_LEVELS.length, 5);
});

test('repository evolution: nothing skips construction (age caps)', () => {
  const busy = { commits90: 80, commits: 400, pushedDays: 0, releases: 2, stars: 9, forks: 2, state: 'building', workflow: 'passing' };
  assert.equal(repoEvolution({ ...busy, ageDays: 0.4 }).level, 1, 'younger than a day: foundation');
  assert.ok(repoEvolution({ ...busy, ageDays: 2 }).level <= 2, 'younger than three days: at most a frame');
  assert.ok(repoEvolution({ ...busy, ageDays: 5 }).level <= 3, 'younger than a week: at most a building');
  assert.equal(repoEvolution({ ...busy, ageDays: 5 }).capped, 'age');
  assert.equal(repoEvolution({ ...busy, ageDays: 300 }).level, 5, 'a long, busy, released project is a landmark');
});

test('every repository in the saved state gets a level and a district', () => {
  const { state } = world('day');
  for (const r of state.repos) assert.ok(r.evolution.level >= 1 && r.evolution.level <= 5, r.name);
  const lay = assignRepos(state.repos);
  assert.equal(lay.placed.length + lay.overflow.length + lay.ruins.length + (lay.castle ? 1 : 0), state.repos.length, 'nobody is lost');
  const again = assignRepos(state.repos);
  assert.deepEqual(lay.placed.map((q) => [q.repo.name, q.x, q.y]), again.placed.map((q) => [q.repo.name, q.x, q.y]), 'stable places');
  const used = new Set(lay.placed.map((q) => `${q.x},${q.y}`));
  assert.equal(used.size, lay.placed.length, 'two buildings never share a slot');
});

// ------------------------------------------------------------------ power and title
test('kingdom power: bounded, rises with progress, falls with open issues', () => {
  const base = { level: 10, streak: 5, workflowHealth: 100, stars: 5, forks: 0, followers: 0, activeRepos: 5, repos: 10, issues: 0 };
  const p0 = kingdomPower(base).value;
  assert.ok(p0 > 0 && p0 < 100);
  assert.ok(kingdomPower({ ...base, level: 20 }).value > p0);
  assert.ok(kingdomPower({ ...base, streak: 30 }).value > p0);
  assert.ok(kingdomPower({ ...base, issues: 6 }).value < p0);
  assert.equal(kingdomPower({ ...base, level: 500, streak: 999, stars: 9999, followers: 9999, activeRepos: 10 }).value <= 100, true);
  assert.equal(kingdomPower({ level: 1, streak: 0, workflowHealth: 0, stars: 0, forks: 0, followers: 0, activeRepos: 0, repos: 1, issues: 50 }).value, 0);
  assert.equal(heroTitle({ level: 17 }), 'KINGDOM BUILDER');
  assert.equal(heroTitle({ level: 17, unlocked: new Set(['centurion']) }), 'CENTURION');
});

// ------------------------------------------------------------------ quests
const qctx = (o = {}) => ({ streak: 0, stars: 0, issuesOpen: 0, issuesClosed: 0, failing: 0, workflowHealth: 100, lastReleaseAgeH: 5, newestRepoAgeH: 5, date: '2026-09-30', ...o });
test('quests: first run saves met goals as baseline (no XP, no celebration)', () => {
  const r = evaluateQuests({ ctx: qctx({ streak: 16, stars: 19 }), stored: { init: false, done: {}, active: [] }, now: at('2026-09-30T12:00:00Z') });
  assert.equal(r.xp, 0); assert.equal(r.fresh.length, 0);
  assert.equal(r.current.title, 'HOLD A 30 DAY STREAK');
  assert.ok(r.list.some((q) => q.state === 'LOCKED') && r.list.some((q) => q.state === 'ACTIVE'));
  assert.ok(r.store.done['streak:14'].baseline && !r.store.done['streak:30']);
});
test('quests: a ladder rung gives its XP once; ACTIVE -> COMPLETE; the next rung unlocks', () => {
  let stored = evaluateQuests({ ctx: qctx({ streak: 13 }), stored: { init: false, done: {}, active: [] }, now: at('2026-09-30T12:00:00Z') }).store;
  const win = evaluateQuests({ ctx: qctx({ streak: 14 }), stored, now: at('2026-10-01T12:00:00Z') });
  assert.equal(win.fresh.length, 1); assert.equal(win.fresh[0].id, 'streak:14'); assert.ok(win.xp > 0);
  assert.ok(win.list.some((q) => q.id === 'streak:14' && q.state === 'COMPLETE'));
  assert.equal(win.current.title, 'HOLD A 30 DAY STREAK');
  const again = evaluateQuests({ ctx: qctx({ streak: 15 }), stored: win.store, now: at('2026-10-02T12:00:00Z') });
  assert.equal(again.fresh.length, 0, 'never twice'); assert.equal(again.xp, win.xp);
  const broken = evaluateQuests({ ctx: qctx({ streak: 0 }), stored: win.store, now: at('2026-10-03T12:00:00Z') });
  assert.equal(broken.xp, win.xp, 'a broken streak does not take XP back'); assert.equal(broken.current.title, 'HOLD A 30 DAY STREAK');
});
test('quests: repeatable goals cannot be farmed for XP', () => {
  let stored = { init: true, done: {}, active: [] }, xp = 0;
  for (let i = 0; i < 6; i++) {
    const open = evaluateQuests({ ctx: qctx({ issuesOpen: 3, failing: 1 }), stored, now: at(`2026-09-${10 + i}T10:00:00Z`) });
    assert.ok(open.list.some((q) => q.track === 'gate' && q.state === 'ACTIVE') && open.list.some((q) => q.track === 'recover' && q.state === 'ACTIVE'));
    const closed = evaluateQuests({ ctx: qctx({ date: `2026-09-${10 + i}` }), stored: open.store, now: at(`2026-09-${10 + i}T14:00:00Z`) });
    assert.ok(closed.fresh.length >= 1 && closed.fresh.every((q) => q.xp === 0));
    stored = closed.store; xp = closed.xp;
  }
  assert.equal(xp, 0);
});

// ------------------------------------------------------------------ scene
test('scene: every demo world has a mode, a hero state and deterministic output', () => {
  for (const name of Object.keys(demoScenarios())) {
    const { state } = world(name);
    const a = state.scene, b = buildScene(state, new Date(state.generatedAt));
    assert.deepEqual(a, b, `${name}: same state, same scene`);
    assert.ok(SCENE_MODES.includes(a.mode) && a.modes[0] === a.mode, name);
    assert.ok(HERO_STATES.includes(a.hero.state), name);
    assert.ok(a.frame >= 0 && a.frame < 8);
    assert.equal(state.hero.state, a.hero.state);
  }
});
test('scene: priorities (raid beats danger beats storm; celebration beats night)', () => {
  const t = (name) => world(name).state.scene;
  assert.equal(t('raid').mode, 'RAID'); assert.equal(t('raid').hero.state, 'fighting');
  const win = world('victory').state; for (const r of win.repos) { r.recoveredAt = null; r.recovered = false; } finalizeV2(win, { cfg, store: freshStore(), now: new Date(win.generatedAt) });
  assert.equal(win.scene.hero.state, 'celebrating', 'a won raid is a victory'); assert.equal(win.scene.hero.why, 'victory');
  assert.equal(t('boss').mode, 'DANGER');
  assert.equal(t('recovery').mode, 'RECOVERY');
  assert.equal(t('sleepy').hero.state, 'sleeping');
  const party = world('release').state; party.time.phase = 'night'; finalizeV2(party, { cfg, store: freshStore(), now: new Date(party.generatedAt) });
  assert.equal(party.scene.hero.state, 'celebrating', 'a release at night is still a party');
  assert.ok(party.scene.light.windows && party.scene.light.moon, 'and the windows are lit');
  const storm = world('storm').state;
  assert.ok(storm.scene.modes.includes('STORM'));
  assert.equal(t('release').hero.state, 'celebrating'); assert.ok(t('release').fx.includes('fireworks'));
  assert.ok(['traveling'].includes(t('evening').hero.state) || t('evening').hero.why !== 'idle');
});
test('scene: the hero sleeps at night when nothing special is going on', () => {
  const sc = demoScenarios().night;
  const store = freshStore();
  const state = buildState({ snap: mockSnapshot({ now: sc.now, scenario: { issues: 0, streak: 5 } }), cfg, now: sc.now, store, demo: true });
  state.events.active = []; state.raid = { active: false, done: false, phase: 'idle' };
  for (const r of state.repos) { r.recoveredAt = null; r.recovered = false; r.workflow = 'passing'; if (r.state === 'failing') r.state = 'active'; }
  finalizeV2(state, { cfg, store, now: sc.now });
  assert.equal(state.scene.hero.state, 'sleeping'); assert.ok(state.scene.light.windows && state.scene.light.moon);
});
test('scene: stories are told by the age of what started them', () => {
  assert.deepEqual(['0.5', '4', '12', '30'].map((h) => failStage(+h)), ['warning', 'alarm', 'smoke', 'fire']);
  assert.deepEqual([1, 10, 20, 40].map(repairStage), ['firefighter', 'repair', 'fade', null]);
  assert.deepEqual([2, 30, 100, 200].map(buildStage), ['foundation', 'builders', 'construction', null]);
});
test('scene: people follow real numbers', () => {
  const lo = world('newbie').state.scene.npcs, hi = world('day').state.scene.npcs;
  assert.ok(hi.merchant > lo.merchant, 'more stars, more merchants');
  assert.ok(hi.guard >= lo.guard + 2, 'more issues, more guards');
  assert.ok(hi.builder > lo.builder, 'more active repositories, more builders');
  assert.ok(hi.farmer >= lo.farmer);
  assert.ok(world('sleepy').state.scene.npcs.farmer === 0, 'farmers sleep with the hero');
});
test('events change the scene, and the scene goes back to normal when they end', () => {
  const { state, store } = world('release');
  assert.ok(state.scene.fx.includes('confetti') && state.scene.light.accent);
  const later = new Date(at('2026-09-30T12:00:00Z').getTime() + 4 * 86400e3);
  const s2 = buildState({ snap: mockSnapshot({ now: later, scenario: { issues: 0 } }), cfg, now: later, store, demo: true });
  assert.ok(!s2.scene.fx.includes('fireworks') && !s2.events.active.some((e) => e.type === 'release'));
});
test('raids: phases, and a goblin outpost that rests or waits', () => {
  const now = at('2026-09-30T12:00:00Z');
  const mk = (min, extra = {}) => raidView([{ id: 1, by: 'v', size: 'small', at: new Date(now - min * 60000).toISOString(), status: 'active', ...extra }], 50, now, cfg);
  assert.equal(mk(5).phase, 'enter'); assert.equal(mk(30).phase, 'battle');
  const done = raidView([{ id: 1, by: 'v', size: 'small', at: new Date(now - 90 * 60000).toISOString(), status: 'done', resolvedAt: new Date(now - 30 * 60000).toISOString(), won: true, defense: 80, attack: 40 }], 50, now, cfg);
  assert.equal(done.phase, 'won'); assert.equal(done.available, false, 'the goblins rest after a raid');
  assert.equal(raidView([], 50, now, cfg).available, true);
});

// ------------------------------------------------------------------ pictures
test('the same state always draws the same bytes', () => {
  for (const name of ['day', 'night', 'raid', 'winter']) {
    const { state } = world(name);
    const a = renderAll(state, { cfg, avatars: {} }), b = renderAll(state, { cfg, avatars: {} });
    assert.deepEqual(a, b, name);
  }
});
test('every demo world draws every picture within size limits', () => {
  for (const name of Object.keys(demoScenarios())) {
    const { state } = world(name);
    const files = renderAll(state, { cfg, avatars: {} });
    assert.equal(files.length, ASSETS.length);
    for (const [file, svg] of files) { if (!svg) continue; assert.deepEqual(lintSvg(svg), [], `${name}/${file}`); assert.ok(svg.length < 450_000, `${name}/${file} is ${svg.length} bytes`); }
    assert.deepEqual(Object.values(state.status.assets).filter((v) => v !== 'ok' && v !== 'empty'), [], name);
    for (const [file, svg] of extraAssets(state, cfg)) assert.deepEqual(lintSvg(svg), [], file);
  }
});
test('the map speaks only when something needs saying', () => {
  const calm = world('newbie').state;
  assert.deepEqual(mapLabels(calm), [], 'a calm kingdom has no words on the map');
  const day = mapLabels(world('day').state).map((l) => l.id);
  assert.ok(day.includes('issues'));
  const boss = mapLabels(world('boss').state).map((l) => l.id);
  assert.ok(boss.includes('issues'), 'ten issues or more bring a boss');
  const storm = mapLabels(world('storm').state).map((l) => l.id);
  assert.ok(storm.includes('ci'), 'a failing workflow is the one thing the CI fortress is allowed to say');
  const raid = mapLabels(world('raid').state).map((l) => l.id);
  assert.ok(raid.includes('raid'));
  assert.ok(Object.values(world('boss').state.scene.labels).filter(Boolean).length <= 4);
});
test('the world looks different by hour, weather and season', () => {
  const svgs = Object.fromEntries(['day', 'night', 'storm', 'winter', 'spring', 'autumn'].map((n) => [n, renderKingdom(world(n).state, { cfg })]));
  const uniq = new Set(Object.values(svgs));
  assert.equal(uniq.size, 6);
  assert.ok(svgs.night.includes('mask="url(#dk)"'), 'night uses the light mask');
  assert.ok(svgs.winter.length !== svgs.autumn.length);
});
test('visitor camp: hostile text stays text, bad avatars are ignored', () => {
  const { state } = world('day');
  state.visitors = { total: 1, flags: [{ n: 1, login: 'x"><script>', message: '</svg><script>alert(1)</script>', avatar: 'github', color: '"onload=1', at: '2026-09-30T00:00:00Z' }] };
  const svg = renderCamp(state, { cfg, avatars: { 'x"><script>': { mime: 'text/html', b64: 'PHNjcmlwdD4=' } } });
  assert.deepEqual(lintSvg(svg), []); assert.ok(!svg.includes('<script') && !svg.includes('text/html'));
});
test('history: snapshots follow the castle tiers', () => {
  const pts = [{ d: '2026-01-01', l: 1 }, { d: '2026-02-01', l: 3 }, { d: '2026-03-01', l: 6 }, { d: '2026-04-01', l: 9 }, { d: '2026-05-01', l: 12 }, { d: '2026-06-01', l: 22 }, { d: '2026-07-01', l: 23 }];
  const s = pickSnapshots(pts, 4);
  assert.equal(s[0].l, 1); assert.equal(s[s.length - 1].l, 23); assert.ok(s.length <= 4 && s.length >= 3);
  assert.equal(pickSnapshots([{ d: '2026-01-01', l: 1 }]).length, 1);
});
test('name plates are short, in words, and never empty', () => {
  assert.deepEqual(plateLines('CareerNewsroomBot'), ['CAREER', 'NEWSROOM~'].slice(0, 2).map((x, i) => plateLines('CareerNewsroomBot')[i]));
  for (const n of ['A', 'DocFlow', 'History-Newsroom', 'Sudipto-Portfolio', 'TheSportsNewsroom']) { const l = plateLines(n, 8); assert.ok(l.length >= 1 && l.length <= 2 && l.every((x) => x.length > 0 && x.length <= 8), n); }
});

// ------------------------------------------------------------------ README
test('README: one walk through the world, no dashboards and no lists', () => {
  const { state } = world('day'); renderAll(state, { cfg, avatars: {} });
  const block = buildBlock(state, cfg, new Date(state.generatedAt));
  assert.ok(!/Map legend|Today in the kingdom|<details|This is my kingdom|Built by|nav-|stats\.svg|repos\.svg|achievements\.svg/i.test(block));
  assert.ok(!/^- /m.test(block), 'no markdown list of repositories');
  const imgs = block.match(/<img /g).length;
  assert.ok(imgs <= 18, `${imgs} images`);
  const order = ['hero.svg', 'world.svg', 'quest.svg', 'districts.svg', 'castle.svg', 'dungeon.svg', 'warfront.svg', 'builderyard.svg', 'heroguild.svg', 'trophies.svg', 'harvest.svg', 'history.svg', 'visitors.svg', 'post-flag.svg', 'status.svg'].map((f) => block.indexOf(f));
  assert.ok(order.every((v, i) => v > -1 && (i === 0 || v > order[i - 1])), 'sections follow the walk: ' + order.join(','));
  const feat = (block.match(/<a href="https:\/\/github\.com\/[^"]+">/g) || []).length;
  assert.ok(feat <= cfg.featuredCount + 4, 'only featured projects are linked');
});
test('README: quiet worlds leave the event picture out', () => {
  const { state } = world('newbie'); state.events.active = []; finalizeV2(state, { cfg, store: freshStore(), now: new Date(state.generatedAt) });
  const files = renderAll(state, { cfg, avatars: {} });
  assert.equal(files.find(([f]) => f === 'events.svg')[1], null);
  assert.ok(!buildBlock(state, cfg, new Date(state.generatedAt)).includes('events.svg'));
});

// ------------------------------------------------------------------ upgrading a V1 save
test('a V1 world-state.json is upgraded on the fly and still draws', () => {
  const file = path.join(ROOT, 'data', 'world-state.json');
  if (!fs.existsSync(file)) return;
  const old = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!old.repos) return;
  delete old.scene; delete old.quests; delete old.power;
  for (const r of old.repos) { delete r.evolution; delete r.commits90; delete r.commits; }
  const state = finalizeV2(old, { cfg, store: freshStore(), now: new Date(old.generatedAt) });
  assert.equal(state.v, 2); assert.ok(state.scene && state.quests.current && state.power.value >= 0);
  assert.ok(state.repos.every((r) => r.evolution.level >= 1 && r.estimated));
  state.status = { assets: {} };
  for (const [file2, svg] of renderAll(state, { cfg, avatars: {} })) if (svg) assert.deepEqual(lintSvg(svg), [], file2);
});

// ------------------------------------------------------------------ the other commands
test('command line: demo, status and render work in a clean folder', async () => {
  const { spawnSync } = await import('node:child_process');
  const os = await import('node:os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kingdom-v2-'));
  fs.writeFileSync(path.join(dir, 'kingdom.config.json'), JSON.stringify({ owner: 'tester', repo: 'tester', links: [{ id: 'email', url: 'mailto:a@b.co' }] }));
  fs.writeFileSync(path.join(dir, 'README.md'), '# T\n<!-- KINGDOM:START -->\n<!-- KINGDOM:END -->\n');
  const CLI = path.join(ROOT, 'engine', 'cli.mjs');
  const run = (...a) => spawnSync(process.execPath, [CLI, ...a], { cwd: dir, encoding: 'utf8' });
  let r = run('demo'); assert.equal(r.status, 0, r.stderr + r.stdout);
  const n = fs.readdirSync(path.join(dir, 'docs', 'preview')).length;
  assert.equal(n, Object.keys(demoScenarios()).length * 2, 'a world and a hero picture for every scene');
  r = run('update', '--mock', '--demo'); assert.equal(r.status, 0, r.stderr + r.stdout);
  r = run('status'); assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /Buildings/); assert.match(r.stdout, /mode/);
  r = run('render'); assert.equal(r.status, 0, r.stderr);
  assert.ok(fs.existsSync(path.join(dir, 'renderer', 'ui', 'guild-email.svg')));
  fs.rmSync(dir, { recursive: true, force: true });
});

// ------------------------------------------------------------------ edge cases and hostile input
test('status light: a quiet world with no events is still ONLINE', () => {
  const { state } = world('newbie'); state.events.active = []; finalizeV2(state, { cfg, store: freshStore(), now: new Date(state.generatedAt) });
  const files = renderAll(state, { cfg, avatars: {} });
  assert.equal(state.status.assets.events, 'empty');
  assert.match(files.find(([f]) => f === 'status.svg')[1], /kingdom online/);
});
test('an account with no repositories at all still draws the whole kingdom', () => {
  const sc = demoScenarios().day, store = freshStore();
  const snap = mockSnapshot({ now: sc.now, scenario: sc.scenario }); snap.repos = [];
  const state = buildState({ snap, cfg, now: sc.now, store, demo: true });
  assert.equal(state.featured.length, 0);
  const files = renderAll(state, { cfg, avatars: {} });
  for (const [f, svg] of files) if (svg) assert.deepEqual(lintSvg(svg), [], f);
  assert.equal(files.find(([f]) => f === 'districts.svg')[1], null, 'no skyline without projects');
  assert.ok(!buildBlock(state, cfg, sc.now).includes('districts.svg'));
});
test('a huge account (90 repositories) fits: nobody is lost, nothing overlaps, sizes stay sane', () => {
  const sc = demoScenarios().day, store = freshStore();
  const snap = mockSnapshot({ now: sc.now, scenario: sc.scenario });
  const proto = snap.repos.find((r) => r.name === 'NewsBots');
  const extra = Array.from({ length: 90 }, (_, i) => ({ ...proto, id: `x${i}`, name: `${['News', 'Doc', 'Data', 'Lab', 'Site', 'Tool', 'App'][i % 7]}Project${i}Bot`, stars: i % 5 }));
  snap.repos = [...snap.repos, ...extra];
  const state = buildState({ snap, cfg, now: sc.now, store, demo: true });
  const lay = assignRepos(state.repos);
  assert.equal(lay.placed.length + lay.overflow.length + lay.ruins.length + (lay.castle ? 1 : 0), state.repos.length);
  assert.equal(new Set(lay.placed.map((q) => `${q.x},${q.y}`)).size, lay.placed.length);
  const files = renderAll(state, { cfg, avatars: {} });
  for (const [f, svg] of files) if (svg) { assert.deepEqual(lintSvg(svg), [], f); assert.ok(svg.length < 600_000, `${f} ${svg.length}`); }
  assert.ok(state.featured.length <= cfg.featuredCount);
});
test('hostile text in repository names, profile, events and links cannot break any picture', () => {
  const { state } = world('day');
  const evil = '"><script>alert(1)</script>&<![CDATA[';
  state.profile.name = evil; state.profile.login = 'evil'; state.hero.class.title = evil;
  for (const r of state.repos) { r.name = `${evil}${r.name}`; r.url = 'javascript:alert(1)'; }
  state.featured = state.repos.slice(0, 5).map((r) => r.name);
  state.events.active.push({ id: 'ach:x', type: 'milestone', title: evil, icon: 'trophy', detail: evil, at: state.generatedAt, until: state.generatedAt });
  state.quests.rows[0].title = evil; state.quests.current.title = evil;
  finalizeV2(state, { cfg, store: freshStore(), now: new Date(state.generatedAt) });
  state.quests.current.title = evil;
  const files = renderAll(state, { cfg, avatars: {} });
  for (const [f, svg] of files) { if (!svg) continue; assert.deepEqual(lintSvg(svg), [], f); assert.ok(!svg.includes('<script') && !svg.includes('<![CDATA['), f); }
  const block = buildBlock(state, cfg, new Date(state.generatedAt));
  assert.ok(!block.includes('<script') && !/href="javascript:/i.test(block), 'links in the README are escaped');
});
test('bad config values (strings instead of lists, junk links) are ignored, not fatal', () => {
  const { state } = world('day');
  const bad = { ...cfg, featured: 'DocFlow', links: 'nope', featuredCount: 'many' };
  assert.doesNotThrow(() => finalizeV2(state, { cfg: bad, store: freshStore(), now: new Date(state.generatedAt) }));
  renderAll(state, { cfg: bad, avatars: {} });
  assert.doesNotThrow(() => buildBlock(state, bad, new Date(state.generatedAt)));
  assert.doesNotThrow(() => extraAssets(state, bad));
  const odd = { ...cfg, links: [null, 3, { id: '../../x', url: 'https://a.b' }, { id: 'ok', url: 'https://a.b' }] };
  assert.equal(extraAssets(state, odd).filter(([f]) => f.includes('guild')).length, 1);
});

test('the GitHub question for repositories is well formed and asks for what V2 needs', async () => {
  const src = fs.readFileSync(path.join(ROOT, 'engine', 'github.mjs'), 'utf8');
  const q = src.slice(src.indexOf('const Q_REPOS = `'), src.indexOf('`;', src.indexOf('const Q_REPOS = `')));
  const depth = [...q].reduce((d, c) => d + (c === '{' ? 1 : c === '}' ? -1 : 0), 0);
  const paren = [...q].reduce((d, c) => d + (c === '(' ? 1 : c === ')' ? -1 : 0), 0);
  assert.equal(depth, 0, 'braces balance'); assert.equal(paren, 0, 'parentheses balance');
  assert.match(q, /history\(since:\$since\)\{totalCount\}\s+all:history\{totalCount\}/, 'recent and all-time commits, the second one aliased');
  assert.match(q, /releases\(/); assert.match(q, /pushedAt/); assert.match(q, /createdAt/);
});
test('repositories from an older reply without all-time commits still get a level', () => {
  const { state } = world('day');
  for (const r of state.repos) { delete r.commits; delete r.commits90; delete r.evolution; }
  finalizeV2(state, { cfg, store: freshStore(), now: new Date(state.generatedAt) });
  assert.ok(state.repos.every((r) => r.evolution.level >= 1 && r.evolution.level <= 5));
});

test('events from the same moment always come in the same order (no flicker, no commit spam)', () => {
  const { state } = world('release');
  const same = ['ach:a', 'ach:b', 'ach:c', 'stars:25', 'levelup:9'].map((id) => ({ id, type: 'milestone', title: 'MILESTONE UNLOCKED', icon: 'trophy', detail: id.toUpperCase(), at: '2026-09-30T10:00:00.000Z', until: '2026-10-02T10:00:00.000Z' }));
  const hud = (list) => { const s = structuredClone(state); s.events.active = list; return JSON.stringify(buildScene(s, new Date(s.generatedAt)).hud); };
  const a = hud(same), b = hud([...same].reverse()), c = hud([same[3], same[0], same[4], same[2], same[1]]);
  assert.equal(a, b); assert.equal(a, c);
});

test('the hero can be drawn in every pose of every class', async () => {
  const { drawHeroPose, POSES } = await import('../render/actors.mjs');
  const { Pix } = await import('../render/pixel.mjs');
  assert.equal(POSES.length, HERO_STATES.length); assert.deepEqual([...POSES].sort(), [...HERO_STATES].sort());
  for (const arch of ['paladin', 'mage', 'ranger', 'rogue', 'alchemist', 'adventurer', 'berserker', 'smith']) for (const pose of POSES) {
    const p = new Pix(1); drawHeroPose(p, 10, 10, arch, pose, { s: 2 });
    assert.ok(p.toString().length > 200, `${arch}/${pose}`);
  }
});

// ------------------------------------------------------------------ things the docs promise must be drawn
test('a release is a story: fireworks through PEAK, lights and banners in AFTERMATH', () => {
  const peak = world('release').state;
  // the demo release is 3h old (of 48h): START phase, the party is building
  assert.ok(peak.scene.fx.includes('fireworks') && peak.scene.fx.includes('confetti'));
  const later = structuredClone(peak);
  later.events.active = later.events.active.filter((e) => e.type !== 'milestone');
  const rel = later.events.active.find((e) => e.type === 'release');
  rel.at = new Date(Date.parse(later.generatedAt) - 30 * 3600e3).toISOString();   // 62% -> AFTERMATH
  rel.until = new Date(Date.parse(rel.at) + 48 * 3600e3).toISOString();
  const scene = buildScene(later, new Date(later.generatedAt));
  assert.ok(!scene.fx.includes('fireworks') && !scene.fx.includes('confetti'), 'the party is over');
  assert.ok(scene.fx.includes('castleLights') && scene.fx.includes('banner'), 'the castle keeps its lights');
  const k1 = renderKingdom(peak, { cfg }), k2 = renderKingdom(Object.assign(later, { scene }), { cfg });
  assert.notEqual(k1, k2);
});
test('the hero holds an umbrella in the rain, and not when asleep or fighting', () => {
  const rain = world('rain').state;
  assert.equal(rain.scene.hero.umbrella, rain.scene.hero.state !== 'sleeping' && rain.scene.hero.state !== 'fighting');
  const dry = world('day').state; assert.equal(dry.scene.hero.umbrella, false);
  const wet = structuredClone(dry); wet.scene.weather = { ...wet.scene.weather, rain: 1, kind: 'rain', wet: true };
  const s2 = buildScene(Object.assign(wet, { weather: 'rain' }), new Date(wet.generatedAt));
  assert.equal(s2.hero.umbrella, s2.hero.state !== 'sleeping' && s2.hero.state !== 'fighting');
  const raid = world('raid').state; raid.weather = 'rain'; assert.equal(buildScene(raid, new Date(raid.generatedAt)).hero.umbrella, false, 'fighting keeps both hands free');
});
test('aurora has its own night palette', () => {
  const night = world('night').state; night.weather = 'aurora';
  finalizeV2(night, { cfg, store: freshStore(), now: new Date(night.generatedAt) });
  const plain = world('night').state; plain.weather = 'clear'; finalizeV2(plain, { cfg, store: freshStore(), now: new Date(plain.generatedAt) });
  const a = renderKingdom(night, { cfg }), b = renderKingdom(plain, { cfg });
  assert.ok(a.includes('#0a2a44') && !b.includes('#0a2a44'), 'teal veil only under an aurora');
});

// ------------------------------------------------------------------ Phase 4: one lighting policy
test('Phase 4: every camera shares the same lighting under an aurora', () => {
  const s = world('night').state; s.weather = 'aurora';
  finalizeV2(s, { cfg, store: freshStore(), now: new Date(s.generatedAt) });
  const svgs = { world: renderKingdom(s, { cfg }), districts: renderDistricts(s), harvest: renderHarvest(s) };
  for (const [name, svg] of Object.entries(svgs)) {
    assert.ok(svg && svg.includes('#0a2a44'), `${name} uses the shared aurora tint`);
  }
});

test('Phase 4: a daytime celebration gets clear skies, never an aurora', () => {
  const s = world('release').state;   // noon UTC: phase is day
  assert.equal(s.time.phase, 'day');
  assert.equal(s.weather, 'clear', 'no aurora kind in daylight');
  finalizeV2(s, { cfg, store: freshStore(), now: new Date(s.generatedAt) });
  assert.equal(s.world.lighting.aurora, 0, 'the policy gates aurora to 0 in daylight');
  const svg = renderKingdom(s, { cfg });
  assert.ok(!svg.includes('#0a2a44') && !svg.includes('#2a2a5a'), 'no aurora tint in the daytime release');
  assert.ok(svg.includes('confetti') || s.scene.fx.includes('confetti'), 'the celebration fx still show');
});

test('Phase 4: harvest sky uses the canonical sky table', () => {
  const s = world('day').state;
  finalizeV2(s, { cfg, store: freshStore(), now: new Date(s.generatedAt) });
  const svg = renderHarvest(s);
  // the field sky is SKY.day[1..2]; the old local copy is gone
  assert.ok(svg.includes('#6cbcf7') && svg.includes('#a8e2fb'), 'harvest sky matches the shared table');
});

test('Phase 5: celebration fx scale with the choreography phase', () => {
  const count = (svg, cls) => (svg.match(new RegExp(`class="${cls}"`, 'g')) || []).length;
  const atAge = (h) => {
    const s = world('release').state;
    const rel = s.events.active.find((e) => e.type === 'release');
    rel.at = new Date(Date.parse(s.generatedAt) - h * 3600e3).toISOString();
    rel.until = new Date(Date.parse(rel.at) + 48 * 3600e3).toISOString();
    s.scene = buildScene(s, new Date(s.generatedAt));
    finalizeV2(s, { cfg, store: freshStore(), now: new Date(s.generatedAt) });
    return s;
  };
  const start = atAge(3);    // 6% -> START
  const peak = atAge(15);    // 31% -> PEAK
  assert.equal(start.world.events.find((e) => e.type === 'release').phase, 'START');
  assert.equal(peak.world.events.find((e) => e.type === 'release').phase, 'PEAK');
  assert.ok(start.world.fxIntensity.confetti < peak.world.fxIntensity.confetti, 'START is gentler than PEAK');
  const sSvg = renderKingdom(start, { cfg }), pSvg = renderKingdom(peak, { cfg });
  assert.ok(count(sSvg, 'cf') < count(pSvg, 'cf'), `confetti grows: START=${count(sSvg, 'cf')} PEAK=${count(pSvg, 'cf')}`);
  assert.ok(count(sSvg, 'fw') < count(pSvg, 'fw'), `fireworks grow: START=${count(sSvg, 'fw')} PEAK=${count(pSvg, 'fw')}`);
});

test('Phase 6: power tier changes the visible world', () => {
  const render = (tier) => {
    const s = world('day').state;
    finalizeV2(s, { cfg, store: freshStore(), now: new Date(s.generatedAt) });
    s.world.power.tier = tier;
    return renderKingdom(s, { cfg });
  };
  const village = render('village'), settlement = render('settlement'), kingdom = render('kingdom'),
        prosperous = render('prosperous'), legendary = render('legendary');
  const uniq = new Set([village, settlement, kingdom, prosperous, legendary]);
  assert.equal(uniq.size, 5, 'all five tiers render distinctly');
});

test('V3: simulation is deterministic', () => {
  const mk = () => {
    const s = world('day').state;
    finalizeV2(s, { cfg, store: freshStore(), now: new Date(s.generatedAt) });
    return s;
  };
  const a = mk(), b = mk();
  assert.equal(a.simulation.signature, b.simulation.signature, 'same state+tick = same simulation');
  assert.ok(a.simulation.actors.length > 0, 'actors scheduled');
  assert.ok(a.simulation.band, 'time band assigned');
});

test('V3: new cameras are valid world views', () => {
  const s = world('day').state;
  finalizeV2(s, { cfg, store: freshStore(), now: new Date(s.generatedAt) });
  const wf = renderWarfront(s), by = renderBuilderyard(s), hg = renderHeroguild(s);
  assert.ok(wf && wf.includes('<svg'), 'warfront renders');
  assert.ok(by && by.includes('<svg'), 'builderyard renders');
  assert.ok(hg && hg.includes('<svg'), 'heroguild renders');
  // All share the same world signature (cameras, not separate drawings)
  assert.ok(wf.includes('War Front') && by.includes("Builder") && hg.includes('Hero Guild'));
});
