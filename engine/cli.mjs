#!/usr/bin/env node
// Commands:  update | render | visitors | cleanup | demo | lint | init | labels | status
// GitHub Actions calls this file. You can also run it on your own computer.
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './config.mjs';
import { loadStore, saveStore, writeIfChanged, toJson, EMPTY } from './store.mjs';
import { collect, makeIO } from './github.mjs';
import { mockSnapshot, demoScenarios, seedDemoStore } from './mock.mjs';
import { buildState } from './state.mjs';
import { timeInfo } from './rules.mjs';
import { lintSvg } from './safety.mjs';
import { buildBlock, injectBlock, linkList } from './readme.mjs';
import { processIssue, replyFor } from './visitors.mjs';
import { compactHistory } from './history.mjs';
import { canonical, sha, daysSince } from './util.mjs';
import { fallbackSvg } from './render/fallback.mjs';
import { finalizeV2 } from './v2.mjs';
import { renderKingdom } from './render/kingdom.mjs';
import { renderHero } from './render/hero.mjs';
import { renderEvents, renderQuest } from './render/hud.mjs';
import { renderDistricts } from './render/districts.mjs';
import { renderTrophies } from './render/trophies.mjs';
import { renderHarvest } from './render/harvest.mjs';
import { renderHistory } from './render/chronicle.mjs';
import { renderCamp } from './render/camp.mjs';
import { renderStatus } from './render/status.mjs';
import { renderPost, POST_KEYS } from './render/signposts.mjs';
import { renderGuildBanner } from './render/guild.mjs';

/**
 * Every picture is its own job. If one fails, the others still work. Status is last.
 * A render function may return null: "nothing to show" (no events, no featured repositories). The file is then removed.
 */
export const ASSETS = [
  { key: 'world', file: 'world.svg', render: renderKingdom },
  { key: 'hero', file: 'hero.svg', render: renderHero },
  { key: 'events', file: 'events.svg', render: renderEvents },
  { key: 'quest', file: 'quest.svg', render: renderQuest },
  { key: 'districts', file: 'districts.svg', render: renderDistricts },
  { key: 'trophies', file: 'trophies.svg', render: renderTrophies },
  { key: 'harvest', file: 'harvest.svg', render: renderHarvest },
  { key: 'history', file: 'history.svg', render: renderHistory },
  { key: 'camp', file: 'visitors.svg', render: renderCamp },
  { key: 'status', file: 'status.svg', render: renderStatus },
];
/** V1 pictures that no longer exist. They are deleted so old files do not linger. */
export const LEGACY_FILES = ['stats.svg', 'repos.svg', 'achievements.svg', 'ui/action-flag.svg', 'ui/action-raid.svg', 'ui/nav-achievements.svg', 'ui/nav-character.svg', 'ui/nav-harvest.svg', 'ui/nav-kingdom.svg', 'ui/nav-repositories.svg', 'ui/nav-visit.svg'];

/** Small pictures that are not part of the main list: the two action posts and the guild banners. */
export function extraAssets(state, cfg) {
  const out = POST_KEYS.map((k) => [`ui/post-${k}.svg`, renderPost(k, state)]);
  for (const l of linkList(cfg)) out.push([`ui/guild-${l.id.toLowerCase()}.svg`, renderGuildBanner(l)]);
  return out.map(([f, svg]) => { const bad = lintSvg(svg); if (bad.length) throw new Error(`unsafe picture ${f}: ${bad.join(', ')}`); return [f, svg]; });
}
function removeFiles(root, rels) {
  const gone = [];
  for (const rel of rels) { const f = path.join(root, 'renderer', rel); if (fs.existsSync(f)) { fs.rmSync(f); gone.push(`renderer/${rel}`); } }
  return gone;
}

function parseFlags(argv) {
  const f = {};
  for (const a of argv) {
    const m = /^--([\w-]+)(?:=(.*))?$/.exec(a);
    if (m) f[m[1]] = m[2] === undefined ? true : m[2];
  }
  return f;
}
const log = (...a) => console.log(...a);

/** Draw all pictures. Returns [[file, svg]]. */
export function renderAll(state, ctx, only = null) {
  const out = [];
  for (const a of ASSETS) {
    if (only && !only.includes(a.key) && a.key !== 'status') continue;
    let svg;
    try {
      svg = a.render(state, ctx);
      if (svg == null) { state.status.assets[a.key] = 'empty'; out.push([a.file, null]); continue; }
      const bad = lintSvg(svg);
      if (bad.length) throw new Error(`unsafe picture: ${bad.join(', ')}`);
      state.status.assets[a.key] = 'ok';
    } catch (e) {
      console.error(`[${a.key}] failed: ${e.message}`);
      state.status.assets[a.key] = 'failed';
      svg = fallbackSvg(a.key, String(e.message).replace(/[^\w .,:-]/g, '').slice(0, 70));
    }
    out.push([a.file, svg]);
  }
  return out;
}
export const hashOf = (s) => sha(canonical({ ...s, generatedAt: null, contentHash: null, time: { ...s.time, iso: null, hour: null }, meta: { ...s.meta, apiCalls: null }, status: { assets: s.status.assets } }), 16);

function staleState(prev, now, cfg) {
  const s = JSON.parse(JSON.stringify(prev));
  s.time = timeInfo(now, cfg);
  s.timeOfDay = s.time.phase; s.season = s.time.season; s.generatedAt = now.toISOString();
  s.meta.dataStatus = 'stale'; s.status = { assets: {}, checkedAt: now.toISOString() };
  return s;
}

async function cmdUpdate(flags) {
  const root = process.cwd();
  const cfg = loadConfig(root);
  if (!cfg.owner) throw new Error('Missing "owner". Set it in kingdom.config.json.');
  const now = flags.now ? new Date(flags.now) : new Date();
  const store = loadStore(root);
  const only = flags.only ? String(flags.only).split(',') : null;
  let snap = null, stale = false;
  if (flags.mock) {
    const sc = flags.scenario ? demoScenarios()[flags.scenario] : null;
    snap = mockSnapshot({ now, tz: cfg.timezone, login: cfg.owner, name: cfg.displayName || 'Sudipto Kumar', scenario: sc?.scenario || {} });
  } else {
    const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
    if (!token) throw new Error('No GH_TOKEN or GITHUB_TOKEN found.');
    try { snap = await collect({ io: makeIO(token), login: cfg.owner, cfg, now }); }
    catch (e) { console.error('Could not read GitHub:', e.message); if (!store.prev) throw e; stale = true; }
  }
  const state = stale ? staleState(store.prev, now, cfg) : buildState({ snap, cfg, now, store, demo: !!flags.demo });
  if (flags.phase) { state.time.phase = flags.phase; state.timeOfDay = flags.phase; }
  if (flags.weather) { state.weather = flags.weather; }
  if (flags.season) { state.time.season = flags.season; state.season = flags.season; }
  finalizeV2(state, { cfg, store, now });                       // V2 layer: levels, power, quests (old saves), scene. Runs after any override.

  const files = renderAll(state, { cfg, avatars: store.avatars.items }, only);
  state.contentHash = only ? `partial:${hashOf(state)}` : hashOf(state);
  if (!flags.force && store.prev?.contentHash === state.contentHash && !flags.mock) { log('Nothing changed. No files written.'); return state; }

  const changed = [];
  const put = (rel, text) => { if (writeIfChanged(path.join(root, rel), text)) changed.push(rel); };
  for (const [file, svg] of files) { if (svg == null) changed.push(...removeFiles(root, [file])); else put(`renderer/${file}`, svg); }
  for (const [file, svg] of extraAssets(state, cfg)) put(`renderer/${file}`, svg);
  changed.push(...removeFiles(root, LEGACY_FILES));
  if (!flags['no-data']) {
    changed.push(...saveStore(root, store));
    put('data/world-state.json', toJson(state));
  }
  const readmePath = path.join(root, 'README.md');
  if (fs.existsSync(readmePath) && !flags['no-readme']) {
    const next = injectBlock(fs.readFileSync(readmePath, 'utf8'), buildBlock(state, cfg, now));
    if (next === null) console.error('README.md has no KINGDOM markers, so it was not changed.');
    else put('README.md', next);
  }
  summary(state, changed, stale);
  return state;
}

function summary(state, changed, stale) {
  const failed = Object.entries(state.status.assets).filter(([, v]) => v !== 'ok' && v !== 'empty').map(([k]) => k);
  const lines = [
    `Level ${state.level} (${state.xp} XP) | ${state.hero.class.title} | ${state.time.phase}, ${state.weather}, ${state.season}`,
    `Stars ${state.stars} | Open issues ${state.issues} | Streak ${state.streak} | Workflows ${state.workflowHealth ?? 'n/a'}%`,
    `Scene: ${state.scene.mode} | hero ${state.hero.state} (${state.hero.status}) | power ${state.power.value}/100 | quest: ${state.quests.current.title}`,
    `Events: ${state.events.active.map((e) => e.title).join(', ') || 'none'}`,
    `Pictures: ${failed.length ? 'FAILED ' + failed.join(', ') : 'all ok'}${stale ? ' | DATA IS OLD (GitHub could not be read)' : ''}`,
    `Files changed: ${changed.length}`,
  ];
  lines.forEach((l) => log(l));
  if (process.env.GITHUB_STEP_SUMMARY) { try { fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '### Kingdom update\n' + lines.map((l) => `- ${l}`).join('\n') + '\n'); } catch { /* ignore */ } }
}

/** Draw again from data/world-state.json without calling GitHub. */
async function cmdRender(flags) {
  const root = process.cwd();
  const cfg = loadConfig(root);
  const store = loadStore(root);
  if (!store.prev) throw new Error('No data/world-state.json yet. Run "update" first.');
  const now = flags.now ? new Date(flags.now) : new Date();
  const state = staleState(store.prev, now, cfg);
  state.meta.dataStatus = store.prev.meta?.dataStatus || 'fresh';
  if (flags.phase) { state.time.phase = flags.phase; state.timeOfDay = flags.phase; }
  if (flags.weather) state.weather = flags.weather;
  if (flags.season) { state.time.season = flags.season; state.season = flags.season; }
  finalizeV2(state, { cfg, store, now });                       // also upgrades a saved V1 state on the fly
  const files = renderAll(state, { cfg, avatars: store.avatars.items });
  const changed = [];
  for (const [file, svg] of files) { if (svg == null) changed.push(...removeFiles(root, [file])); else if (writeIfChanged(path.join(root, 'renderer', file), svg)) changed.push(file); }
  for (const [file, svg] of extraAssets(state, cfg)) if (writeIfChanged(path.join(root, 'renderer', file), svg)) changed.push(file);
  changed.push(...removeFiles(root, LEGACY_FILES));
  const readmePath = path.join(root, 'README.md');
  if (fs.existsSync(readmePath) && !flags['no-readme']) { const next = injectBlock(fs.readFileSync(readmePath, 'utf8'), buildBlock(state, cfg, now)); if (next !== null && writeIfChanged(readmePath, next)) changed.push('README.md'); }
  log(`Rendered ${files.length} pictures, ${changed.length} files changed.`);
}

async function cmdVisitors() {
  const root = process.cwd();
  const cfg = loadConfig(root);
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) throw new Error('No token found.');
  const io = makeIO(token);
  const now = new Date();
  const store = loadStore(root);
  let issues = [];
  const evFile = process.env.GITHUB_EVENT_PATH;
  if (process.env.GITHUB_EVENT_NAME === 'issues' && evFile) {
    const ev = JSON.parse(fs.readFileSync(evFile, 'utf8'));
    if (ev.action === 'opened' || ev.action === 'reopened') issues = [ev.issue];
  } else {
    for (const label of ['flag-request', 'raid-request']) {
      const r = await io.rest(`/repos/${cfg.owner}/${cfg.repo}/issues?state=open&labels=${label}&per_page=30`);
      if (r.ok) issues.push(...r.json.filter((i) => !i.pull_request));
    }
    issues.sort((a, b) => a.number - b.number);
  }
  const base = `/repos/${cfg.owner}/${cfg.repo}/issues`;
  const json = { 'Content-Type': 'application/json' };
  let handled = 0;
  for (const issue of issues) {
    const res = await processIssue({ issue, io, store, cfg, now });
    if (res.skipped) continue;
    handled++;
    log(`Issue #${issue.number}: ${res.kind} ${res.ok ? 'accepted' : 'rejected (' + res.reason + ')'}`);
    await io.rest(`${base}/${issue.number}/comments`, { method: 'POST', headers: json, body: JSON.stringify({ body: replyFor(res.kind, res) }) });
    await io.rest(`${base}/${issue.number}`, { method: 'PATCH', headers: json, body: JSON.stringify({ state: 'closed', state_reason: res.ok ? 'completed' : 'not_planned' }) });
  }
  saveStore(root, store);
  log(`Handled ${handled} request(s).`);
}

async function cmdCleanup() {
  const root = process.cwd();
  const cfg = loadConfig(root);
  const now = new Date();
  const store = loadStore(root);
  compactHistory(store.history, now.toISOString().slice(0, 10));
  store.events.events = store.events.events.filter((e) => daysSince(e.at, now) < 30);
  store.events.raids = store.events.raids.slice(-20);
  const keep = new Set(store.visitors.flags.map((f) => f.login));
  for (const k of Object.keys(store.avatars.items)) if (!keep.has(k)) delete store.avatars.items[k];
  const changed = saveStore(root, store);
  log(`Data compacted. Changed: ${changed.join(', ') || 'nothing'}`);
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!token || process.env.SKIP_RUN_CLEANUP) return;
  const io = makeIO(token);
  let deleted = 0;
  const runs = [];
  for (let page = 1; page <= 5; page++) {
    const r = await io.rest(`/repos/${cfg.owner}/${cfg.repo}/actions/runs?per_page=100&status=completed&page=${page}`);
    if (!r.ok || !r.json.workflow_runs?.length) break;
    runs.push(...r.json.workflow_runs);
  }
  runs.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  for (const run of runs.slice(30)) {
    if (daysSince(run.created_at, now) < 14) continue;
    const d = await io.rest(`/repos/${cfg.owner}/${cfg.repo}/actions/runs/${run.id}`, { method: 'DELETE' });
    if (d.status === 204) deleted++;
  }
  log(`Deleted ${deleted} old workflow run(s).`);
}

function cmdLint() {
  const dir = path.join(process.cwd(), 'renderer');
  let bad = 0;
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    const f = path.join(d, e.name);
    if (e.isDirectory()) return walk(f);
    if (!f.endsWith('.svg')) return;
    const p = lintSvg(fs.readFileSync(f, 'utf8'));
    if (p.length) { bad++; console.error(`${f}: ${p.join(', ')}`); }
  });
  walk(dir);
  if (bad) process.exit(1);
  log('All pictures passed the safety check.');
}

async function cmdLabels() {
  const cfg = loadConfig(process.cwd());
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) throw new Error('No token found.');
  const io = makeIO(token);
  for (const [name, color, description] of [['flag-request', '1f6f4a', 'Visitor flag request'], ['raid-request', 'b13e53', 'Goblin raid request']]) {
    const r = await io.rest(`/repos/${cfg.owner}/${cfg.repo}/labels`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, color, description }) });
    log(`Label ${name}: ${r.status === 201 ? 'created' : r.status === 422 ? 'already there' : 'status ' + r.status}`);
  }
}

function cmdInit() {
  const root = process.cwd();
  for (const k of Object.keys(EMPTY)) writeIfChanged(path.join(root, 'data', `${k}.json`), toJson(EMPTY[k]()));
  writeIfChanged(path.join(root, 'data', 'world-state.json'), toJson({ version: 2, note: 'The first update creates the real world state.' }));
  log('Data files created.');
}

/** Pretty pictures for every kind of weather, season and story (used in docs). */
async function cmdDemo() {
  const root = process.cwd();
  const cfg = loadConfig(root);
  const out = path.join(root, 'docs', 'preview');
  fs.mkdirSync(out, { recursive: true });
  const names = [];
  for (const [name, sc] of Object.entries(demoScenarios())) {
    const store = seedDemoStore(sc);
    const snap = mockSnapshot({ now: sc.now, tz: cfg.timezone, login: cfg.owner || 'SudiptoKumar', scenario: sc.scenario });
    const state = buildState({ snap, cfg, now: sc.now, store, demo: true });
    const files = renderAll(state, { cfg, avatars: {} }, ['world', 'hero']);
    for (const [f, svg] of files) if (svg && ['world.svg', 'hero.svg'].includes(f)) fs.writeFileSync(path.join(out, `${f.replace('.svg', '')}-${name}.svg`), svg);
    names.push(name);
  }
  log(`Wrote ${names.length} preview scenes to docs/preview/: ${names.join(', ')}`);
}

/** A detailed look at the kingdom: what used to be the big technical status panel. */
async function cmdStatus() {
  const root = process.cwd();
  const store = loadStore(root);
  const s = store.prev;
  if (!s || !s.scene) { log('No V2 world state yet. Run "update" first.'); return; }
  const a = Object.entries(s.status?.assets || {});
  const lines = [
    `Updated        ${s.generatedAt}  (${s.meta?.dataStatus || 'fresh'}${s.meta?.demo ? ', DEMO DATA' : ''})`,
    `World          ${s.time.phase} / ${s.weather} / ${s.time.season}   mode ${s.scene.mode} [${s.scene.modes.join(', ')}]   frame ${s.scene.frame}`,
    `Hero           ${s.hero.state} at ${s.hero.spot}  -  ${s.hero.status}  -  ${s.hero.title}`,
    `Power          ${s.power.value}/100  ${JSON.stringify(s.power.parts)}`,
    `Quests         ${s.quests.rows.map((q) => `${q.state} ${q.title}`).join(' | ') || 'none'}`,
    `People         ${Object.entries(s.scene.npcs).map(([k, v]) => `${k} ${v}`).join(', ')}`,
    `Buildings      ${s.repos.map((r) => `${r.name}:L${r.evolution.level}`).join(' ')}`,
    `Featured       ${s.featured.join(', ')}`,
    `Pictures       ${a.map(([k, v]) => `${k}=${v}`).join(' ')}`,
    `Visitors       ${s.visitors.total} flags   raid ${s.raid.active ? 'ACTIVE ' + s.raid.phase : s.raid.done ? 'done ' + s.raid.phase : s.raid.available ? 'available' : 'resting'}`,
  ];
  lines.forEach((l) => log(l));
}

const [cmd, ...rest] = process.argv.slice(2);
const flags = parseFlags(rest);
const table = { update: cmdUpdate, render: cmdRender, visitors: cmdVisitors, cleanup: cmdCleanup, lint: cmdLint, init: cmdInit, demo: cmdDemo, labels: cmdLabels, status: cmdStatus };
if (import.meta.url === `file://${process.argv[1]}`) {
  if (!table[cmd]) { console.error(`Unknown command "${cmd || ''}". Use: ${Object.keys(table).join(' | ')}`); process.exit(2); }
  Promise.resolve(table[cmd](flags)).catch((e) => { console.error(`FAILED: ${e.stack || e.message}`); process.exit(1); });
}
