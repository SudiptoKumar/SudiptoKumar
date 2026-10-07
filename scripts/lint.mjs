// Lint: node --check every module + determinism guardrails. No dependencies.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules') continue;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f);
    else if (f.endsWith('.mjs')) files.push(f);
  }
})(path.join(ROOT, 'engine'));
files.push(path.join(ROOT, 'scripts', 'lint.mjs'));

let failed = 0;
for (const f of files) {
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
  } catch {
    console.error(`syntax error: ${path.relative(ROOT, f)}`);
    failed++;
  }
}

// Determinism guardrails: world/domain/validation code must not use
// Math.random or Date.now. Allowed Date.now users:
//   - engine/cli.mjs: stamping only, never world math
//   - engine/github.mjs: the live-fetch boundary. The wall clock is used
//     only to normalize fetched timestamps (daysAgo) and to stamp
//     fetchedAt; it never feeds RNG or world math.
const DATE_NOW_ALLOWED = new Set([
  path.join('engine', 'cli.mjs'),
  path.join('engine', 'github.mjs'),
]);
const BANNED = [
  [/Math\.random\s*\(/, 'Math.random'],
  [/Date\.now\s*\(/, 'Date.now'],
];
for (const f of files) {
  const rel = path.relative(ROOT, f);
  // strip comments so documentation mentioning the banned calls doesn't trip the guard
  const src = fs.readFileSync(f, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1');
  for (const [re, name] of BANNED) {
    if (name === 'Date.now' && DATE_NOW_ALLOWED.has(rel)) continue;
    if (re.test(src)) { console.error(`banned ${name}: ${rel}`); failed++; }
  }
}

// world-lock.json must be valid JSON and match the design source of truth
try {
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'world-lock.json'), 'utf8'));
  if (lock.roadNodes.length !== 34 || lock.roadEdges.length !== 37 || lock.districts.length !== 19) {
    console.error('world-lock.json counts drifted from the canonical 19/34/37');
    failed++;
  }
} catch (e) {
  console.error(`world-lock.json invalid: ${e.message}`);
  failed++;
}

console.log(failed ? `lint: ${failed} problem(s)` : `lint: ok (${files.length} files checked)`);
process.exit(failed ? 1 : 0);
