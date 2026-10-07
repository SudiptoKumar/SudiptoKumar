#!/usr/bin/env node
// Kingdom V3 CLI: update | render | demo | visitors | cleanup | lint
// Contracts (spec §25):
//   update   fetch -> normalize -> persist -> build -> simulate -> render -> README
//            works fully OFFLINE with a marked demo fixture when no GH_TOKEN.
//   render   world.json -> simulate -> render assets -> profile README.md
//   demo     deterministic scenarios -> ../demos/ (never touches data/)
//   visitors process an issue-form event into data/visitors.json (strict rules)
//   cleanup  prune stale visitor entries; verify data integrity
//   lint     syntax/determinism guardrails + safety lint of renderer SVGs
// Error isolation: one failing asset never stops the others (spec §13.11).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { loadConfig } from './config.mjs';
import { writeIfChanged, loadJson, toJson } from './store.mjs';
import { buildNormalizedState } from './domain/state.mjs';
import { deriveAchievements } from './domain/achievements.mjs';
import { offlineSnap } from './domain/offline-snap.mjs';
import { fetchSnapshot } from './github.mjs';
import { isLogin, sanitizeMessage } from './validation/safety.mjs';
import { buildWorld, serializeWorld, contentHash } from './world/world.mjs';
import { simulate } from './simulation/simulate.mjs';
import { checkWorldInvariants } from './validation/world-invariants.mjs';
import { validateWorldSchema } from './validation/schema.mjs';
import { lintSvg } from './validation/safety.mjs';
import { checkReadmeBudget } from './validation/visual-budget.mjs';
import { canonical, sha } from './util.mjs';
import { registerRenderAssets, renderProblems } from './render/register.mjs';
import { SCENARIOS, buildScenario } from './render/scenarios.mjs';
import { renderCamera, isQuiet } from './render/index.mjs';
import { composeReadme } from './render/readme.mjs';

/**
 * Asset registry. The RENDER agent registers painters here:
 *   registerAsset('grand', 'grand.svg', (world, ctx) => '<svg ...>...</svg>')
 * A render fn may return null => "nothing to show" (file removed).
 */
const ASSETS = [];
export function registerAsset(key, file, render) {
  if (ASSETS.some((a) => a.key === key)) throw new Error(`asset already registered: ${key}`);
  ASSETS.push({ key, file, render });
  return ASSETS.length;
}
export const assetKeys = () => ASSETS.map((a) => a.key);

/** A safe fallback card when a renderer fails (spec §13.11). */
export function fallbackSvg(key, message) {
  const msg = String(message).replace(/[<>&"']/g, '').slice(0, 80);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="120" viewBox="0 0 480 120"><rect width="480" height="120" fill="#1a1a2e"/><text x="24" y="56" fill="#e0e0e0" font-family="monospace" font-size="16">KINGDOM ${key}</text><text x="24" y="84" fill="#888888" font-family="monospace" font-size="12">${msg || 'renderer unavailable'}</text></svg>`;
}

/**
 * Render every registered asset with per-asset error isolation.
 * Returns {files: [[rel, svg|null]], status: {key: 'ok'|'empty'|'failed'|'skipped'}}.
 */
export function renderAll(world, ctx = {}, only = null) {
  const out = []; const status = {};
  for (const a of ASSETS) {
    if (only && !only.includes(a.key)) { status[a.key] = 'skipped'; continue; }
    let svg;
    try {
      svg = a.render(world, ctx);
      if (svg == null) { status[a.key] = 'empty'; out.push([a.file, null]); continue; }
      const bad = lintSvg(svg);
      if (bad.length) throw new Error(`unsafe picture: ${bad.join(', ')}`);
      status[a.key] = 'ok';
    } catch (e) {
      console.error(`[${a.key}] failed: ${e.message}`);
      status[a.key] = 'failed';
      svg = fallbackSvg(a.key, e.message);
    }
    out.push([a.file, svg]);
  }
  return { files: out, status };
}

export function parseArgs(argv) {
  const args = argv.slice(2);
  const command = args[0] && !args[0].startsWith('-') ? args[0] : null;
  const rest = args.slice(command ? 1 : 0);
  const flags = {};
  for (let i = 0; i < rest.length; i++) {
    const m = /^--([\w-]+)(?:=(.*))?$/.exec(rest[i]);
    if (!m) continue;
    if (m[2] !== undefined) flags[m[1]] = m[2];
    else if (rest[i + 1] !== undefined && !rest[i + 1].startsWith('-')) flags[m[1]] = rest[++i];
    else flags[m[1]] = true;
  }
  return { command, flags };
}

/**
 * Resolve the input snapshot for `update`.
 * Priority: --state FILE > GH_TOKEN live fetch > --offline / no-token fixture.
 * The offline fixture is deterministic and clearly marked (snap.offline).
 */
export async function resolveSnapshot(flags, cfg) {
  if (flags.state) {
    const snap = loadJson(path.resolve(process.cwd(), flags.state), null);
    if (!snap) throw new Error(`state file not found: ${flags.state}`);
    return { snap, note: `state file ${flags.state}` };
  }
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
  if (!flags.offline && token) {
    const owner = cfg.owner || '';
    if (!owner) throw new Error('kingdom.config.json "owner" is required for live fetch (or use --offline)');
    const snap = await fetchSnapshot({ token, owner, config: cfg });
    snap.achievements = deriveAchievements(snap);
    return { snap, note: `live GitHub data for ${owner}` };
  }
  const snap = offlineSnap({ owner: cfg.owner || 'sample-owner', kingdomName: cfg.displayName });
  return { snap, note: 'OFFLINE demo fixture (no GH_TOKEN)' };
}

/** Shared: render assets + profile README into outDir. */
function renderToDir({ world, simSnap, root, outDir, inputSignature, only = null, scenarioName = 'live', config, state, provenance = 'live' }) {
  registerRenderAssets(world, simSnap, { inputSignature });
  fs.mkdirSync(outDir, { recursive: true });
  const { files, status } = renderAll(world, { root }, only);
  let written = 0;
  for (const [file, svg] of files) {
    const full = path.join(outDir, file);
    if (svg == null) { if (fs.existsSync(full)) fs.rmSync(full); continue; }
    if (writeIfChanged(full, svg)) written++;
  }
  // README composition (not an SVG asset; written alongside).
  if (!only || only.includes('readme')) {
    const readmeFiles = {
      grand: 'grand.svg', grandMobile: 'grand-mobile.svg',
      cameras: Object.fromEntries(['capital', 'projects', 'farm', 'warfront', 'dungeon', 'guild', 'harbor'].map((id) => [id, `${id}.svg`])),
      hero: 'hero.svg', event: isQuiet(world, simSnap) ? null : 'event.svg',
    };
    const md = composeReadme({
      world, snap: simSnap, scenario: { name: scenarioName }, files: readmeFiles,
      config, state, provenance,
    });
    const probs = checkReadmeBudget(Buffer.byteLength(md));
    if (probs.length) console.error(`readme budget: ${probs.join('; ')}`);
    if (writeIfChanged(path.join(outDir, 'README.md'), md)) written++;
    status.readme = 'ok';
  }
  for (const p of renderProblems()) console.error(`budget: [${p.key}] ${p.problem}`);
  return { status, written };
}

/**
 * update: fetch -> normalize -> persist -> build -> simulate -> render -> README.
 */
async function cmdUpdate(flags, root) {
  const cfg = loadConfig(root);
  const { snap, note } = await resolveSnapshot(flags, cfg);
  // visitors recorded by the issue-driven workflow join the snapshot
  const visitorStore = loadJson(path.join(root, 'data', 'visitors.json'), null);
  if (visitorStore?.visitors?.length) {
    const extra = visitorStore.visitors.map((v) => ({ login: v.login, kind: v.kind, message: v.message }));
    snap.visitors = [...(snap.visitors ?? []), ...extra];
  }
  const prev = loadJson(path.join(root, 'data', 'world-state.json'), null);
  const state = buildNormalizedState({ snap, config: cfg, prev, now: flags.now ?? Date.now() });
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  writeIfChanged(path.join(root, 'data', 'world-state.json'), toJson(state));
  writeIfChanged(path.join(root, 'data', 'snapshot.json'), toJson(snap));
  const world = buildWorld(state, { config: cfg });
  const inv = checkWorldInvariants(world);
  if (inv.length) throw new Error(`world invariants failed:\n - ${inv.slice(0, 10).join('\n - ')}`);
  const schemaErr = validateWorldSchema(world);
  if (schemaErr.length) throw new Error(`world schema failed:\n - ${schemaErr.slice(0, 10).join('\n - ')}`);
  const t = world.time ?? {};
  const simSnap = simulate(world, { timeBucket: `${t.phase}-${t.season}-${t.weather}-update`, inputs: {} });
  const inputSignature = sha(canonical({ ...state, generatedAt: null }), 12);
  const hash = contentHash({ inputSignature, world });
  const wrote = writeIfChanged(path.join(root, 'data/world.json'), toJson({ ...world, contentHash: hash, inputSignature }));
  const outDir = path.resolve(root, flags.out ?? 'renderer');
  const { status, written } = renderToDir({
    world, simSnap, root, outDir, inputSignature,
    scenarioName: 'live', config: cfg, state,
    provenance: snap.offline ? 'offline-demo' : (snap.provenance ?? 'live'),
  });
  console.log(`update: ${note}`);
  console.log(`world built: ${world.buildings.length} buildings, ${world.actors.length} actors`);
  console.log(`signature: ${world.signature}  contentHash: ${hash}${wrote ? '' : ' (unchanged)'}`);
  console.log(`render: ${written} written to ${path.relative(root, outDir) || outDir}, status: ${JSON.stringify(status)}`);
  return { world, wrote, status, note };
}

/** render: persisted world -> simulate -> render assets -> profile README. */
function cmdRender(flags, root) {
  const cfg = loadConfig(root);
  const worldFile = flags.world ?? path.join(root, 'data/world.json');
  const stored = loadJson(path.resolve(root, worldFile), null);
  if (!stored) throw new Error(`no world found at ${worldFile} (run 'update' first)`);
  const snap = loadJson(path.join(root, 'data', 'snapshot.json'), null);
  const state = snap ? buildNormalizedState({ snap, config: cfg }) : null;
  const only = flags.only ? String(flags.only).split(',') : null;
  const t = stored.time ?? {};
  const bucket = flags.bucket ?? `${t.phase ?? 'morning'}-${t.season ?? 'summer'}-${t.weather ?? 'clear'}-render`;
  const simSnap = simulate(stored, { timeBucket: bucket, inputs: {} });
  const inputSignature = sha(canonical({ seed: stored.seed }), 8);
  const outDir = path.resolve(root, flags.out ?? 'renderer');
  const { status, written } = renderToDir({
    world: stored, simSnap, root, outDir, inputSignature, only,
    scenarioName: 'live', config: cfg, state,
    provenance: snap?.offline ? 'offline-demo' : (snap?.provenance ?? 'live'),
  });
  console.log(`render: ${written} written, status: ${JSON.stringify(status)}`);
  return { status, written };
}

/**
 * Demo: render the 20 deterministic scenarios (spec §21). Each scenario gets
 * grand.svg + grand-mobile.svg + relevant close camera(s) + hero/event views
 * + a composed README, written under <root>/../demos/<name>/ (outside the
 * repo). Never touches data/ or renderer/.
 */
function cmdDemo(flags, root) {
  const cfg = loadConfig(root);
  const demoConfig = {
    ...cfg,
    owner: cfg.owner || 'demo-owner',
    links: cfg.links && Object.keys(cfg.links).length ? cfg.links : { website: 'https://github.com/demo-owner' },
  };
  const outBase = path.resolve(root, flags.out ?? path.join('..', 'demos'));
  const only = flags.only ? String(flags.only).split(',') : null;
  const results = [];
  const table = [];
  for (const sc of SCENARIOS) {
    if (only && !only.includes(sc.name)) continue;
    try {
      const { world, snap, state } = buildScenario(sc.name);
      const outDir = path.join(outBase, sc.name);
      fs.mkdirSync(outDir, { recursive: true });
      const sizes = {};
      const put = (file, svg) => {
        const bad = lintSvg(svg);
        if (bad.length) throw new Error(`unsafe svg ${file}: ${bad.join(', ')}`);
        fs.writeFileSync(path.join(outDir, file), svg);
        sizes[file] = Math.round(Buffer.byteLength(svg) / 1024);
      };
      const inputSignature = sha(canonical({ seed: world.seed }), 8);
      put('grand.svg', renderCamera(world, snap, 'grand', { inputSignature }).svg);
      put('grand-mobile.svg', renderCamera(world, snap, 'grand', { variant: 'mobile', inputSignature }).svg);
      const camFiles = {};
      for (const cid of [...sc.closeCameras, 'hero']) {
        const r = renderCamera(world, snap, cid, { inputSignature });
        if (!r) continue;
        put(`${cid}.svg`, r.svg);
        camFiles[cid] = `${cid}.svg`;
      }
      const ev = renderCamera(world, snap, 'event', { inputSignature });
      let eventFile = null;
      if (ev) { put('event.svg', ev.svg); eventFile = 'event.svg'; }
      const md = composeReadme({
        world, snap, scenario: sc,
        files: { grand: 'grand.svg', grandMobile: 'grand-mobile.svg', cameras: camFiles, hero: camFiles.hero ?? null, event: eventFile },
        config: demoConfig, state, provenance: 'demo',
      });
      const rprobs = checkReadmeBudget(Buffer.byteLength(md));
      if (rprobs.length) throw new Error(rprobs[0]);
      fs.writeFileSync(path.join(outDir, 'README.md'), md);
      sizes['README.md'] = Math.round(Buffer.byteLength(md) / 1024);
      console.log(`[demo:${sc.name}] ok signature=${world.signature} sizes=${JSON.stringify(sizes)}`);
      table.push({ name: sc.name, ...sizes });
      results.push({ name: sc.name, ok: true, signature: world.signature, sizes });
    } catch (e) {
      console.error(`[demo:${sc.name}] failed: ${e.message}`);
      results.push({ name: sc.name, ok: false, error: e.message });
    }
  }
  if (table.length) {
    console.log('\nscenario size table (KiB):');
    for (const row of table) {
      console.log(`  ${row.name}: ${Object.entries(row).filter(([k]) => k !== 'name').map(([k, v]) => `${k}=${v}`).join(' ')}`);
    }
  }
  return results;
}

/** Extract an issue-form field value ("### Label\n\nvalue") from the body. */
function formField(body, label) {
  const escLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`### ${escLabel}\\s*\\n+([\\s\\S]*?)(?=\\n### |$)`, 'i').exec(String(body ?? ''));
  return m ? m[1].trim() : '';
}

/**
 * visitors: process one issue-form event (plant-your-flag / send-goblin-raid)
 * into data/visitors.json. Strict rules (spec §17): login allowlist,
 * message sanitization, 24h per-login rate limit. Never runs issue text
 * through a shell; never stores raw hostile text.
 */
function cmdVisitors(flags, root) {
  const eventPath = flags.event ?? process.env.GITHUB_EVENT_PATH;
  if (!eventPath) throw new Error('visitors: no event file (set GITHUB_EVENT_PATH or --event FILE)');
  const event = loadJson(path.resolve(String(eventPath)), null);
  const issue = event?.issue;
  if (!issue) throw new Error('visitors: event has no issue payload');
  const labels = (issue.labels ?? []).map((l) => String(l.name ?? l));
  const kind = labels.includes('raid-request') ? 'raid' : labels.includes('flag-request') ? 'flag' : null;
  if (!kind) { console.log('visitors: issue carries no visitor label; nothing to do'); return { skipped: true }; }
  // flag form carries a username field; raid forms fall back to the issue author
  const fieldLogin = formField(issue.body, 'GitHub username').trim().toLowerCase();
  const login = fieldLogin || String(issue.user?.login ?? '').toLowerCase();
  if (!isLogin(login)) throw new Error(`visitors: rejected username ${JSON.stringify(formField(issue.body, 'GitHub username')).slice(0, 40)}`);
  const clean = sanitizeMessage(formField(issue.body, 'Message'), { max: 48 });
  const file = path.join(root, 'data', 'visitors.json');
  const store = loadJson(file, { visitors: [] });
  const cutoff = Date.now() - 24 * 3600 * 1000;
  if ((store.visitors ?? []).some((v) => v.login === login && Date.parse(v.addedAt ?? 0) > cutoff)) {
    throw new Error(`visitors: ${login} already has an active entry (24h rate limit)`);
  }
  store.visitors = [...(store.visitors ?? []), {
    login, kind,
    message: clean.ok ? clean.text : null,
    messageRejected: clean.ok ? null : clean.reason,
    addedAt: new Date().toISOString(),
    issue: issue.number ?? null,
  }];
  const wrote = writeIfChanged(file, toJson(store));
  console.log(`visitors: recorded ${kind} for ${login}${wrote ? '' : ' (unchanged)'}`);
  return { login, kind, wrote };
}

/**
 * cleanup: prune visitor entries older than 90 days and verify the data
 * files still parse. Weekly job; never touches engine/, renderer/, README.
 */
function cmdCleanup(flags, root) {
  const file = path.join(root, 'data', 'visitors.json');
  const store = loadJson(file, null);
  let pruned = 0;
  if (store?.visitors) {
    const cutoff = Date.now() - 90 * 86400 * 1000;
    const kept = store.visitors.filter((v) => {
      const t = Date.parse(v.addedAt ?? 0);
      return Number.isNaN(t) || t > cutoff; // keep undated legacy entries
    });
    pruned = store.visitors.length - kept.length;
    if (pruned > 0) { store.visitors = kept; writeIfChanged(file, toJson(store)); }
  }
  const problems = [];
  for (const f of ['data/world.json', 'data/world-state.json', 'data/snapshot.json', 'data/world-lock.json']) {
    const p = path.join(root, f);
    if (fs.existsSync(p)) { try { JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { problems.push(`${f}: ${e.message}`); } }
  }
  if (problems.length) throw new Error(`cleanup: data integrity problems:\n - ${problems.join('\n - ')}`);
  console.log(`cleanup: pruned ${pruned} stale visitor entr${pruned === 1 ? 'y' : 'ies'}; data files parse`);
  return { pruned };
}

/**
 * lint: syntax + determinism guardrails (scripts/lint.mjs) and safety lint
 * over every SVG in renderer/. The per-asset lint already runs inside
 * renderAll; this is the standalone gate for CI.
 */
function cmdLint(flags, root) {
  execFileSync(process.execPath, [path.join(root, 'scripts', 'lint.mjs')], { stdio: 'inherit' });
  const dir = path.resolve(root, flags.dir ?? 'renderer');
  const svgs = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.svg')) : [];
  const bad = [];
  for (const f of svgs) {
    const problems = lintSvg(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (problems.length) bad.push(`${f}: ${problems.join(', ')}`);
  }
  if (bad.length) throw new Error(`lint: unsafe SVGs:\n - ${bad.join('\n - ')}`);
  console.log(`lint: ok (${svgs.length} renderer SVGs safety-checked)`);
  return { svgs: svgs.length };
}

export function run(argv, root = process.cwd()) {
  const { command, flags } = parseArgs(argv);
  if (!command || flags.help || flags.h) {
    console.log('usage: kingdom-v3 <update|render|demo|visitors|cleanup|lint> [--state FILE] [--world FILE] [--out DIR] [--only a,b] [--now ISO] [--offline] [--event FILE]');
    return { ok: true };
  }
  try {
    if (command === 'update') return runAsync(cmdUpdate(flags, root));
    if (command === 'render') return { ok: true, ...cmdRender(flags, root) };
    if (command === 'demo') return { ok: true, results: cmdDemo(flags, root) };
    if (command === 'visitors') return { ok: true, ...cmdVisitors(flags, root) };
    if (command === 'cleanup') return { ok: true, ...cmdCleanup(flags, root) };
    if (command === 'lint') return { ok: true, ...cmdLint(flags, root) };
    return { ok: false, error: `unknown command: ${command}` };
  } catch (e) {
    console.error(`command '${command}' failed: ${e.message}`);
    return { ok: false, error: e.message };
  }
}

/** run() stays synchronous for sync commands; async commands return a promise. */
function runAsync(promise) {
  return promise.then(
    (r) => ({ ok: true, ...r }),
    (e) => { console.error(`command failed: ${e.message}`); return { ok: false, error: e.message }; },
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  Promise.resolve(run(process.argv)).then(
    (res) => process.exit(res.ok ? 0 : 1),
    () => process.exit(1),
  );
}
