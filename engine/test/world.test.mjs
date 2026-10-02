import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mockSnapshot, demoScenarios } from '../mock.mjs';
import { DEFAULTS } from '../config.mjs';
import { EMPTY } from '../store.mjs';
import { buildState } from '../state.mjs';
import { renderAll, hashOf, ASSETS } from '../cli.mjs';
import { lintSvg } from '../safety.mjs';
import { collect, normalizeRepo, normalizeRuns, joinCalendars } from '../github.mjs';
import { buildBlock, injectBlock, START, END } from '../readme.mjs';
import { allButtons } from '../render/buttons.mjs';
import { makeSprite } from '../render/pixel.mjs';
import * as SPR from '../render/sprites.mjs';
import { processIssue } from '../visitors.mjs';

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'cli.mjs');
const cfg = { ...structuredClone(DEFAULTS), owner: 'SudiptoKumar', repo: 'SudiptoKumar', timezone: 'UTC' };
const freshStore = () => { const s = Object.fromEntries(Object.entries(EMPTY).map(([k, f]) => [k, f()])); s.prev = null; return s; };
const make = (now, scenario = {}, store = freshStore()) => ({ store, state: buildState({ snap: mockSnapshot({ now, scenario }), cfg, now, store, demo: true }) });

test('every sprite is a clean rectangle', () => {
  const all = [];
  for (const v of [...Object.values(SPR.ICON), ...Object.values(SPR.NPC), SPR.GOBLIN, SPR.GOBLIN2, SPR.TREE_OAK, SPR.TREE_PINE, SPR.BUSH, SPR.ROCK, SPR.WHEAT, ...SPR.CROP.filter(Boolean), ...Object.values(SPR.ITEMS).map((i) => i.spr)]) all.push(v);
  assert.ok(all.length > 50);
  for (const s of all) assert.ok(s.w > 0 && s.h > 0);
  assert.throws(() => makeSprite(['ab', 'a']), /Sprite row/);
});

test('all demo worlds draw every picture and pass the safety check', () => {
  for (const [name, sc] of Object.entries(demoScenarios())) {
    const { state, store } = make(sc.now, sc.scenario);
    store.visitors.flags = [{ n: 1, login: 'devsara', message: 'Keep building!', avatar: 'identicon', color: 'green', at: sc.now.toISOString() }];
    state.visitors = { total: 1, flags: store.visitors.flags };
    const files = renderAll(state, { cfg, avatars: {} });
    assert.equal(files.length, ASSETS.length, name);
    for (const [file, svg] of files) assert.deepEqual(lintSvg(svg), [], `${name}/${file}`);
    assert.deepEqual(Object.values(state.status.assets).filter((v) => v !== 'ok'), [], name);
  }
});

test('a broken renderer becomes a WORLD FAILURE card and the others keep working', () => {
  const { state } = make(new Date('2026-09-30T12:00:00Z'));
  state.hero = null; // breaks hero (and anything that needs it)
  const files = renderAll(state, { cfg, avatars: {} });
  assert.equal(state.status.assets.hero, 'failed');
  assert.equal(state.status.assets.stats, 'ok');
  assert.ok(files.find(([f]) => f === 'hero.svg')[1].includes('World failure'));
});

test('hostile text in repository data cannot break out of a picture', () => {
  const now = new Date('2026-09-30T12:00:00Z');
  const store = freshStore();
  const snap = mockSnapshot({ now });
  snap.repos[0].name = 'x"><script>alert(1)</script>';
  snap.repos[0].description = '</svg><script>1</script>';
  snap.user.name = '<img src=x onerror=alert(1)>';
  const state = buildState({ snap, cfg, now, store });
  for (const [file, svg] of renderAll(state, { cfg, avatars: {} })) {
    assert.deepEqual(lintSvg(svg), [], file);
    assert.ok(!svg.includes('<script'), file);
  }
});

test('world rules show up in the state', () => {
  const now = new Date('2026-09-30T12:00:00Z');
  assert.equal(make(now, { issues: 14 }).state.goblins.tier, 'boss');
  assert.equal(make(now, { failing: 2 }).state.weather, 'storm');
  assert.equal(make(now, { failing: 4 }).state.weather, 'thunderstorm');
  assert.equal(make(now, { gap: 10, streak: 2 }).state.weather, 'sunrise');
  assert.equal(make(now, { idle: 9, streak: 0 }).state.weather, 'rain');
  const rel = make(now, { release: true }).state;
  assert.ok(rel.events.active.some((e) => e.type === 'release'));
  assert.equal(rel.hero.position, 'plaza');
  assert.ok(make(now, { bigDay: true }).state.events.active.some((e) => e.type === 'harvest'));
  assert.equal(make(now, { empty: true, streak: 0, issues: 0 }).state.level, 1);
  const s = make(now).state;
  assert.equal(s.hero.class.title, 'TYPESCRIPT PALADIN');
  assert.ok(s.repos.find((r) => r.name === 'StudyMart').archetype === 'castle' || s.repos[0].archetype === 'castle');
  for (const k of ['level', 'xp', 'stars', 'commits', 'issues', 'pullRequests', 'workflowHealth', 'streak', 'activeRepositories', 'topLanguage', 'weather', 'timeOfDay']) assert.ok(k in s, k);
});

test('first run does not shower you with fake celebrations; later runs notice level ups', () => {
  const now = new Date('2026-09-30T12:00:00Z');
  const { state, store } = make(now);
  assert.equal(state.achievements.fresh.length, 0);
  assert.ok(state.achievements.list.filter((a) => a.unlocked).every((a) => !a.isNew));
  assert.ok(!state.events.recent.some((e) => e.type === 'milestone'));
  store.prev = { level: state.level - 1, stars: 90 };
  const later = buildState({ snap: mockSnapshot({ now }), cfg, now: new Date(now.getTime() + 3600e3), store });
  assert.ok(later.events.active.some((e) => e.id === `levelup:${state.level}`));
  assert.ok(later.events.active.some((e) => e.type === 'milestone' && e.id.startsWith('stars:')));
});

test('achievements never go away, secrets stay hidden until unlocked', () => {
  const now = new Date('2026-09-30T12:00:00Z');
  const { state, store } = make(now, { empty: true, streak: 0, issues: 0 });
  assert.ok(state.achievements.list.filter((a) => a.secret).every((a) => a.name === '???'));
  store.achievements.unlocked = { iron_streak: { at: '2026-01-01T00:00:00Z' } };
  store.prev = { level: 1, stars: 0 };
  const s2 = buildState({ snap: mockSnapshot({ now, scenario: { empty: true, streak: 0, issues: 0 } }), cfg, now, store });
  assert.equal(s2.achievements.list.find((a) => a.id === 'iron_streak').unlocked, true);
});

test('same world in the same part of the day gives the same hash (no commit spam)', () => {
  const snap = mockSnapshot({ now: new Date('2026-09-30T09:00:00Z') });
  const store = freshStore();
  const at = (iso) => { const st = buildState({ snap, cfg, now: new Date(iso), store, demo: true }); renderAll(st, { cfg, avatars: {} }); store.prev = st; return st; };
  const a = at('2026-09-30T10:00:00Z'), b = at('2026-09-30T10:40:00Z'), c = at('2026-09-30T23:00:00Z');
  assert.equal(hashOf(a), hashOf(b));
  assert.notEqual(hashOf(a), hashOf(c), 'night looks different');
});

test('raids: visible first, resolved by a later update', () => {
  const now = new Date('2026-09-30T12:00:00Z');
  const store = freshStore();
  store.events.raids = [{ id: 9, by: 'visitor', size: 'medium', status: 'active', at: now.toISOString() }];
  const s1 = buildState({ snap: mockSnapshot({ now }), cfg, now, store });
  assert.equal(s1.raid.active, true); assert.equal(s1.raid.goblins, 6); assert.equal(s1.events.active[0].type, 'raid');
  const later = new Date(now.getTime() + 60 * 60000);
  store.prev = s1;
  const s2 = buildState({ snap: mockSnapshot({ now: later }), cfg, now: later, store });
  assert.equal(s2.raid.active, false); assert.equal(store.events.raids[0].status, 'done');
});

test('GitHub reader: turns API answers into a snapshot', async () => {
  const day = (date, c) => ({ date, contributionCount: c });
  const node = (name, o = {}) => ({ name, url: `https://github.com/u/${name}`, description: null, stargazerCount: 5, forkCount: 1, isArchived: false, isFork: false, isEmpty: false, createdAt: '2025-01-01T00:00:00Z', pushedAt: '2026-09-29T00:00:00Z', diskUsage: 300,
    primaryLanguage: { name: 'Python', color: '#3572A5' }, languages: { edges: [{ size: 900, node: { name: 'Python', color: '#3572A5' } }] }, openIssues: { totalCount: 2 }, closedIssues: { totalCount: 3 }, openPRs: { totalCount: 0 }, mergedPRs: { totalCount: 1 },
    repositoryTopics: { nodes: [{ topic: { name: 'bot' } }] }, releases: { totalCount: 2, nodes: [{ tagName: 'v1', publishedAt: '2026-09-01T00:00:00Z', isPrerelease: false, isDraft: false }, { tagName: 'd', publishedAt: null, isPrerelease: false, isDraft: true }] },
    defaultBranchRef: { name: 'main', target: { history: { totalCount: 12 } } }, ...o });
  const io = {
    calls: 3,
    async gql(q) {
      if (q.includes('repositories(first')) return { data: { user: { login: 'u', name: null, avatarUrl: 'x', createdAt: '2020-01-01T00:00:00Z', followers: { totalCount: 4 }, following: { totalCount: 1 }, pullRequests: { totalCount: 9 }, repositories: { pageInfo: { hasNextPage: false }, nodes: [node('a'), node('skipme')] } } } };
      if (q.includes('contributionsCollection(from')) {
        const y = (d) => ({ totalCommitContributions: 10, totalPullRequestContributions: 2, totalIssueContributions: 1, totalPullRequestReviewContributions: 0, contributionCalendar: { weeks: [{ contributionDays: d }] } });
        return { data: { user: { y2025: y([day('2025-12-30', 1), day('2025-12-31', 2)]), y2026: y([day('2025-12-31', 2), day('2026-01-03', 4)]) } } };
      }
      if (q.includes('contributionYears')) return { data: { user: { contributionsCollection: { contributionYears: [2026, 2025] } } } };
      return { data: { a: { issueCount: 1 }, b: { issueCount: 0 } } };
    },
    async rest(p) {
      if (p.includes('/actions/runs')) return { ok: true, status: 200, json: { workflow_runs: [{ workflow_id: 1, name: 'CI', conclusion: 'failure', head_branch: 'main', updated_at: '2026-09-29T00:00:00Z' }, { workflow_id: 1, name: 'CI', conclusion: 'success', head_branch: 'feature', updated_at: '2026-09-28T00:00:00Z' }] } };
      if (p.includes('/events/public')) return { ok: true, status: 200, json: p.endsWith('&page=1') ? [{ type: 'PushEvent', created_at: '2026-09-29T01:00:00Z' }, { type: 'WatchEvent', created_at: '2026-09-29T02:00:00Z' }] : [] };
      return { ok: false, status: 404, json: null };
    },
  };
  const snap = await collect({ io, login: 'u', cfg: { ...cfg, excludeRepos: ['skipme'] }, now: new Date('2026-09-30T00:00:00Z') });
  assert.equal(snap.user.name, 'u'); assert.equal(snap.user.followers, 4);
  assert.equal(snap.repos.length, 1);
  const r = snap.repos[0];
  assert.equal(r.stars, 5); assert.equal(r.releaseCount, 2); assert.equal(r.releases.length, 1, 'drafts are dropped'); assert.equal(r.recentCommits, 12); assert.deepEqual(r.topics, ['bot']);
  assert.equal(r.runs.length, 1, 'only the default branch counts'); assert.equal(r.runs[0].conclusion, 'failure');
  assert.deepEqual(snap.calendar.map((d) => d.date), ['2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02', '2026-01-03']);
  assert.deepEqual(snap.calendar.map((d) => d.count), [1, 2, 0, 0, 4]);
  assert.equal(snap.totals.commits, 20); assert.equal(snap.totals.mergedPrs, 9); assert.equal(snap.hardIssueClosed, true);
  assert.deepEqual(snap.pushTimes, ['2026-09-29T01:00:00Z']);
  assert.deepEqual(joinCalendars([]), []);
  assert.equal(normalizeRuns(null).length, 0);
});

test('GitHub reader: a failing part is reported but does not stop the update', async () => {
  const io = { calls: 1, async gql(q) { if (q.includes('repositories(first')) return { data: { user: { login: 'u', name: 'U', avatarUrl: '', createdAt: '2020-01-01T00:00:00Z', followers: { totalCount: 0 }, following: { totalCount: 0 }, pullRequests: { totalCount: 0 }, repositories: { pageInfo: { hasNextPage: false }, nodes: [] } } } }; throw new Error('boom'); }, async rest() { throw new Error('net'); } };
  const snap = await collect({ io, login: 'u', cfg, now: new Date() });
  assert.ok(snap.errors.length >= 2); assert.deepEqual(snap.calendar, []);
  const { state } = (() => { const store = freshStore(); return { state: buildState({ snap, cfg, now: new Date(), store }) }; })();
  assert.equal(state.level, 1);
  await assert.rejects(() => collect({ io: { calls: 0, gql: async () => ({ data: { user: null } }), rest: async () => ({}) }, login: 'nobody', cfg, now: new Date() }), /not found/);
});

test('README block: buttons, images and markers', () => {
  const now = new Date('2026-09-30T12:00:00Z');
  const { state } = make(now, { release: true });
  const block = buildBlock(state, cfg, now);
  assert.ok(block.startsWith(START) && block.endsWith(END));
  for (const f of ['hero.svg', 'world.svg', 'stats.svg', 'achievements.svg', 'repos.svg', 'harvest.svg', 'history.svg', 'visitors.svg', 'status.svg', 'ui/action-flag.svg', 'ui/nav-kingdom.svg']) assert.ok(block.includes(`/main/renderer/${f}`), f);
  for (const a of ['character', 'kingdom', 'achievements', 'repositories', 'harvest', 'visit']) { assert.ok(block.includes(`href="#${a}"`) && block.includes(`<a id="${a}"></a>`), a); }
  assert.ok(block.includes('template=plant-your-flag.yml') && block.includes('template=send-goblin-raid.yml'));
  assert.ok(block.includes('RELEASE DAY'));
  const readme = `# Hi\nmy text\n${START}\nold\n${END}\nfooter`;
  const out = injectBlock(readme, block);
  assert.ok(out.startsWith('# Hi\nmy text\n') && out.endsWith('\nfooter') && !out.includes('\nold\n'));
  assert.equal(injectBlock('no markers here', block), null);
  assert.equal(allButtons().length, 8);
  for (const [, svg] of allButtons()) assert.deepEqual(lintSvg(svg), []);
});

test('visitor issue flow end to end (fake GitHub)', async () => {
  const now = new Date('2026-09-30T12:00:00Z');
  const store = freshStore();
  const io = { async rest(p) { return p.startsWith('/users/') ? { ok: true, json: { login: 'visitor', type: 'User', created_at: '2024-01-01T00:00:00Z' } } : { ok: false }; }, async bytes() { return { buf: Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4, 5, 6]), type: 'image/png' }; } };
  const issue = { number: 12, user: { login: 'visitor', type: 'User' }, labels: [{ name: 'flag-request' }], body: '### GitHub username\n\nvisitor\n\n### Message\n\nHello!\n\n### Avatar\n\nMy GitHub avatar\n\n### Flag colour\n\nBlue\n' };
  const r = await processIssue({ issue, io, store, cfg, now });
  assert.equal(r.ok, true);
  assert.equal(store.visitors.flags.length, 1); assert.equal(store.visitors.next, 2);
  assert.equal(store.avatars.items.visitor.mime, 'image/png');
  assert.equal(store.visitors.processed[12], 'ok');
  assert.equal((await processIssue({ issue, io, store, cfg, now })).skipped, true, 'the same issue is never counted twice');
  const evil = { ...issue, number: 13, body: issue.body.replace('Hello!', '<script>x</script>') };
  assert.equal((await processIssue({ issue: evil, io, store, cfg, now })).ok, false);
  assert.equal(store.visitors.flags.length, 1);
  assert.equal((await processIssue({ issue: { ...issue, number: 14, labels: [] }, io, store, cfg, now })).skipped, true, 'unlabelled issues are ignored');
});

test('command line: update then lint in a clean folder', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kingdom-'));
  fs.writeFileSync(path.join(dir, 'kingdom.config.json'), JSON.stringify({ owner: 'tester', repo: 'tester' }));
  fs.writeFileSync(path.join(dir, 'README.md'), `# Tester\n${START}\n${END}\nbye\n`);
  const run = (...a) => spawnSync(process.execPath, [CLI, ...a], { cwd: dir, encoding: 'utf8' });
  let r = run('update', '--mock', '--demo');
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const files = fs.readdirSync(path.join(dir, 'renderer')).filter((f) => f.endsWith('.svg'));
  assert.equal(files.length, ASSETS.length);
  assert.ok(fs.existsSync(path.join(dir, 'renderer/ui/nav-visit.svg')));
  const st = JSON.parse(fs.readFileSync(path.join(dir, 'data/world-state.json'), 'utf8'));
  assert.ok(st.level >= 1 && st.contentHash);
  assert.ok(fs.readFileSync(path.join(dir, 'README.md'), 'utf8').includes('renderer/world.svg'));
  r = run('lint'); assert.equal(r.status, 0, r.stderr);
  r = run('render'); assert.equal(r.status, 0, r.stderr);
  r = run('cleanup'); assert.equal(r.status, 0, r.stderr + r.stdout);
  r = run('nonsense'); assert.equal(r.status, 2);
  fs.rmSync(dir, { recursive: true, force: true });
});
