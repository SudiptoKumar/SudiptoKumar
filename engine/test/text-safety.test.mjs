// Text-path safety: every untrusted string that can reach a picture or a
// README goes through sanitization + escaping. Hostile input must render
// as inert text (or be rejected) — never as markup. (spec §17)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildNormalizedState } from '../domain/state.mjs';
import { buildWorld } from '../world/world.mjs';
import { simulate } from '../simulation/simulate.mjs';
import { renderCamera } from '../render/index.mjs';
import { composeReadme } from '../render/readme.mjs';
import { lintSvg } from '../validation/safety.mjs';
import { sanitizeTitle } from '../domain/mapping.mjs';
import { run } from '../cli.mjs';

const HOSTILE = '<script>alert(1)</script>';
const HOSTILE_IMG = '"><img src=x onerror=alert(2)>';

function hostileSnap(over = {}) {
  return {
    seed: 'hostile-text-paths', kingdomName: 'K', owner: 'o', powerTier: 'city',
    repos: [
      {
        id: 'evil', name: `alpha${HOSTILE_IMG}`, fullName: `o/alpha${HOSTILE_IMG}`,
        description: '<b>bold</b> & "quoted"', language: 'TypeScript',
        stars: 5, ageDays: 100, recentCommits: 2,
      },
    ],
    issues: { open: 3 },
    ci: { status: 'healthy' },
    releases: [{ tag: 'v1', name: `Big${HOSTILE}release` }],
    contributions: { activeDays: 60, streak: 5 },
    achievements: [{ id: 'a1', title: `Trophy${HOSTILE_IMG}`, unlocked: true }],
    visitors: [{ login: 'nice-try', kind: 'flag', message: HOSTILE }],
    hero: { name: `Ash${HOSTILE_IMG}`, class: 'warden', gearTier: 3 },
    time: { phase: 'morning', season: 'summer', weather: 'clear' },
    war: { phase: 'PEACE' },
    events: [],
    ...over,
  };
}

const pipeline = (snap, inputs = {}) => {
  const state = buildNormalizedState({ snap });
  const world = buildWorld(state);
  const sim = simulate(world, { timeBucket: 't-hostile', inputs });
  return { state, world, sim };
};
const allCameras = (world, sim) =>
  ['grand', 'capital', 'projects', 'farm', 'dungeon', 'harbor'].map(
    (c) => renderCamera(world, sim, c, { inputSignature: 'hostile' }).svg,
  );

describe('text-path safety', () => {
  it('hostile hero name renders escaped in every camera, lint-clean', () => {
    const { world, sim } = pipeline(hostileSnap());
    for (const svg of allCameras(world, sim)) {
      assert.deepEqual(lintSvg(svg), [], 'svg safety lint passes');
      assert.ok(!svg.includes(HOSTILE_IMG), 'no raw hostile markup in svg');
      assert.ok(!svg.includes('<script>alert'), 'no script payload in svg');
    }
    const grand = allCameras(world, sim)[0];
    assert.ok(grand.includes('&lt;img'), 'hero name visible only as escaped text');
  });

  it('building labels never carry repo names (fixed archetype vocabulary only)', () => {
    const { world, sim } = pipeline(hostileSnap());
    const grand = renderCamera(world, sim, 'grand', { inputSignature: 'hostile' }).svg;
    assert.ok(!grand.includes('alpha'), 'repo name text never becomes a label');
    assert.ok(!grand.includes(HOSTILE_IMG));
  });

  it('hostile release title is sanitized at the mapping layer, escaped in the HUD', () => {
    assert.equal(sanitizeTitle(`Big${HOSTILE}release`), 'untitled');
    const { world, sim } = pipeline(
      hostileSnap(),
      { events: [{ id: 'rel-1', type: 'release', phase: 'PEAK', anchor: 'royal_plaza' }] },
    );
    const rel = world.events.find((e) => e.type === 'release');
    assert.ok(!String(rel.title).includes('<script>'), 'world event title sanitized');
    const grand = renderCamera(world, sim, 'grand', { inputSignature: 'hostile' }).svg;
    assert.deepEqual(lintSvg(grand), []);
    assert.ok(!grand.includes('<script>alert'));
  });

  it('hostile achievement text never reaches the world raw; statues stay abstract', () => {
    const { world, sim } = pipeline(hostileSnap());
    assert.equal(world.hall.entries.length, 1);
    assert.ok(!world.hall.entries[0].title.includes('<'), 'achievement title sanitized');
    const capital = renderCamera(world, sim, 'capital', { inputSignature: 'hostile' }).svg;
    assert.deepEqual(lintSvg(capital), []);
    assert.ok(!capital.includes('onerror'));
  });

  it('hostile visitor message is rejected with a reason; the README stays inert', () => {
    const { state, world, sim } = pipeline(hostileSnap());
    const v = world.visitors.entries[0];
    assert.equal(v.message, null);
    assert.ok(v.messageRejected);
    const md = composeReadme({
      world, snap: sim, scenario: { name: 'hostile' },
      files: { grand: 'grand.svg', grandMobile: 'grand-mobile.svg', cameras: {}, hero: null, event: null },
      config: {}, state,
    });
    assert.ok(!md.includes(HOSTILE), 'README carries no raw hostile text');
    assert.deepEqual(lintSvg(renderCamera(world, sim, 'harbor', { inputSignature: 'hostile' }).svg), []);
  });

  it('visitors command: hostile issue text is validated, never stored raw, never shelled', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kingdom-visitors-'));
    const eventFile = path.join(root, 'event.json');
    fs.writeFileSync(eventFile, JSON.stringify({
      issue: {
        number: 7,
        labels: [{ name: 'flag-request' }],
        user: { login: 'octocat' },
        body: `### GitHub username\n\nnot-a-real-user"><svg\n\n### Message\n\n${HOSTILE}\n`,
      },
    }));
    // invalid username is rejected before anything is stored
    const bad = run(['node', 'cli.mjs', 'visitors', '--event', eventFile], root);
    assert.equal(bad.ok, false);
    assert.ok(!fs.existsSync(path.join(root, 'data', 'visitors.json')), 'nothing persisted on rejection');
    // a valid login with a hostile message: presence recorded, message rejected
    fs.writeFileSync(eventFile, JSON.stringify({
      issue: {
        number: 8,
        labels: [{ name: 'flag-request' }],
        user: { login: 'octocat' },
        body: '### GitHub username\n\noctocat\n\n### Message\n\n<script>alert(1)</script>\n',
      },
    }));
    const good = run(['node', 'cli.mjs', 'visitors', '--event', eventFile], root);
    assert.equal(good.ok, true);
    const stored = JSON.parse(fs.readFileSync(path.join(root, 'data', 'visitors.json'), 'utf8'));
    assert.equal(stored.visitors.length, 1);
    assert.equal(stored.visitors[0].login, 'octocat');
    assert.equal(stored.visitors[0].message, null);
    assert.ok(stored.visitors[0].messageRejected);
    // 24h rate limit: the same login cannot plant again immediately
    const again = run(['node', 'cli.mjs', 'visitors', '--event', eventFile], root);
    assert.equal(again.ok, false);
    fs.rmSync(root, { recursive: true, force: true });
  });
});

// ------------------------------------------------------------------
// Hostile input battery (red team): script tags, event handlers,
// javascript:/vbscript: schemes, 500-char strings, emoji, RTL override
// characters, and null bytes — in repo, hero, visitor, and achievement
// names. Everything must render as inert text (or be rejected); the
// layout must stay intact and every SVG lint-clean.
// ------------------------------------------------------------------
const NUL = String.fromCharCode(0);
const RTL = String.fromCharCode(0x202e);
const EMOJI = String.fromCodePoint(0x1f30d);

function batterySnap() {
  return hostileSnap({
    repos: [
      {
        id: 'evil', name: 'x" onload=alert(1)', fullName: 'o/x" onload=alert(1)',
        description: 'repo with an event handler in its name', language: 'TypeScript',
        stars: 5, ageDays: 100, recentCommits: 2,
      },
    ],
    // null byte + 500 chars: esc() must strip the NUL; length is harmless
    hero: { name: `Ash${NUL}Ketchum${'c'.repeat(500)}`, class: 'warden', gearTier: 3 },
    visitors: [
      { login: 'js-scheme', kind: 'flag', message: 'javascript:alert(document.cookie)' },
      { login: 'vb-scheme', kind: 'flag', message: 'vbscript:msgbox(1)' },
      { login: 'long', kind: 'flag', message: 'z'.repeat(500) },
      { login: 'emoji', kind: 'flag', message: `hello ${EMOJI} kingdom` },
      { login: 'rtl', kind: 'flag', message: `abc${RTL}def` },
      { login: 'nul', kind: 'flag', message: `ok${NUL}fine` },
      { login: 'plain', kind: 'flag', message: 'just a normal hello' },
    ],
    achievements: [{ id: 'a9', title: 'x"><svg onload=alert(1)>', unlocked: true }],
  });
}

describe('hostile input battery', () => {
  it('script-scheme and oversized visitor messages are rejected; presence kept', () => {
    const { world } = pipeline(batterySnap());
    const byLogin = Object.fromEntries(world.visitors.entries.map((e) => [e.login, e]));
    assert.equal(byLogin['js-scheme'].message, null);
    assert.equal(byLogin['js-scheme'].messageRejected, 'LINKS_NOT_ALLOWED');
    assert.equal(byLogin['vb-scheme'].message, null);
    assert.equal(byLogin['long'].messageRejected, 'MESSAGE_TOO_LONG');
    assert.equal(byLogin['emoji'].message, null, 'emoji is not plain text');
    assert.equal(world.visitors.entries.length, 7, 'every visitor presence recorded');
    assert.equal(byLogin['plain'].message, 'just a normal hello');
  });

  it('RTL overrides and null bytes are stripped to spaces, never rendered raw', () => {
    const { world } = pipeline(batterySnap());
    const byLogin = Object.fromEntries(world.visitors.entries.map((e) => [e.login, e]));
    assert.equal(byLogin['rtl'].message, 'abc def');
    assert.equal(byLogin['nul'].message, 'ok fine');
    assert.ok(!byLogin['rtl'].message.includes(RTL));
  });

  it('null byte in the hero name is stripped by esc(); no NUL reaches any SVG', () => {
    const { world, sim } = pipeline(batterySnap());
    for (const svg of allCameras(world, sim)) {
      assert.deepEqual(lintSvg(svg), [], 'lint-clean');
      assert.ok(!svg.includes(NUL), 'no raw null byte in SVG output');
      assert.ok(!svg.includes('onload='), 'no event handler in SVG output');
    }
    const grand = allCameras(world, sim)[0];
    assert.ok(grand.includes('AshKetchum'), 'hero name still visible, NUL removed');
  });

  it('event-handler repo name never becomes a label; achievement title sanitized', () => {
    const { world, sim } = pipeline(batterySnap());
    assert.equal(world.hall.entries[0].title, 'untitled', 'hostile achievement title rejected at mapping');
    const joined = allCameras(world, sim).join('\n');
    assert.ok(!joined.includes('onload='), 'no handler text in any camera');
    assert.ok(!joined.includes('x&quot; onload'), 'no escaped-then-live handler either');
  });

  it('javascript:/vbscript: text can never reach a published SVG (lint tripwire)', () => {
    // defense in depth: even if a scheme string slipped past sanitizeMessage,
    // the safety lint refuses to publish it — verified here at the boundary.
    const { world, sim } = pipeline(batterySnap());
    for (const svg of allCameras(world, sim)) {
      assert.ok(!svg.includes('javascript:'), 'no javascript: scheme in output');
      assert.ok(!svg.includes('vbscript:'), 'no vbscript: scheme in output');
    }
  });

  it('layout stays intact under the full battery: valid documents, in budget', () => {
    const { world, sim } = pipeline(batterySnap());
    for (const svg of allCameras(world, sim)) {
      assert.ok(svg.startsWith('<svg ') && svg.trimEnd().endsWith('</svg>'), 'single valid document');
      assert.ok(Buffer.byteLength(svg) <= 600_000, 'within the 600 KiB ceiling');
    }
    const md = composeReadme({
      world, snap: sim, scenario: { name: 'battery' },
      files: { grand: 'grand.svg', grandMobile: 'grand-mobile.svg', cameras: {}, hero: null, event: null },
      config: {}, state: null,
    });
    assert.ok(!md.includes('<script>alert'), 'README inert');
    assert.ok(!md.includes(NUL), 'README has no null bytes');
    assert.ok(md.includes('just a normal hello'), 'friendly text survives');
  });
});
