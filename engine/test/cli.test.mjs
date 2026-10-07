// CLI smoke: commands parse, isolate errors, and never take down the run.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs, registerAsset, assetKeys, renderAll, fallbackSvg, run } from '../cli.mjs';
import { buildWorld } from '../world/world.mjs';
import { sampleState } from './fixture.mjs';

describe('cli', () => {
  it('parseArgs splits command and flags', () => {
    const { command, flags } = parseArgs(['node', 'cli.mjs', 'update', '--state=x.json', '--force']);
    assert.equal(command, 'update');
    assert.equal(flags.state, 'x.json');
    assert.equal(flags.force, true);
  });

  it('parseArgs accepts space-separated flag values', () => {
    const { flags } = parseArgs(['node', 'cli.mjs', 'demo', '--out', '/tmp/x', '--only', 'a,b']);
    assert.equal(flags.out, '/tmp/x');
    assert.equal(flags.only, 'a,b');
  });

  it('parseArgs handles missing command', () => {
    const { command } = parseArgs(['node', 'cli.mjs', '--help']);
    assert.equal(command, null);
  });

  it('unknown command fails closed with ok:false', () => {
    const res = run(['node', 'cli.mjs', 'frobnicate']);
    assert.equal(res.ok, false);
    assert.match(res.error, /unknown command/);
  });

  it('renderAll isolates a failing renderer and continues', () => {
    registerAsset('t-good', 'good.svg', () => '<svg ><rect width="2" height="2"/></svg>');
    registerAsset('t-bad', 'bad.svg', () => { throw new Error('boom'); });
    registerAsset('t-null', 'null.svg', () => null);
    const world = buildWorld(sampleState());
    const errs = [];
    const orig = console.error;
    console.error = (...a) => errs.push(a.join(' '));
    try {
      const { files, status } = renderAll(world);
      assert.equal(status['t-good'], 'ok');
      assert.equal(status['t-bad'], 'failed');
      assert.equal(status['t-null'], 'empty');
      const badFile = files.find(([f]) => f === 'bad.svg');
      assert.ok(badFile[1].includes('KINGDOM t-bad'), 'fallback card rendered');
      assert.ok(errs.some((e) => e.includes('[t-bad] failed: boom')));
      assert.ok(assetKeys().includes('t-good'));
    } finally {
      console.error = orig;
    }
  });

  it('an unsafe renderer output becomes a fallback, not a publish', () => {
    registerAsset('t-evil', 'evil.svg', () => '<svg ><script>alert(1)</script></svg>');
    const world = buildWorld(sampleState());
    const orig = console.error;
    console.error = () => {};
    try {
      const { status, files } = renderAll(world, {}, ['t-evil']);
      assert.equal(status['t-evil'], 'failed');
      assert.ok(!files.find(([f]) => f === 'evil.svg')[1].includes('<script>'));
    } finally {
      console.error = orig;
    }
  });

  it('fallbackSvg is itself lint-clean', () => {
    const svg = fallbackSvg('x', 'boom <script>');
    assert.ok(!svg.includes('<script>'));
    assert.ok(svg.startsWith('<svg '));
  });

  it('--only limits which assets render', () => {
    const world = buildWorld(sampleState());
    const { status } = renderAll(world, {}, ['t-good']);
    assert.equal(status['t-good'], 'ok');
    assert.equal(status['t-bad'], 'skipped');
  });
});

describe('cli contracts (spec §25)', () => {
  it('update --offline works with no token and marks the snapshot as a demo fixture', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kingdom-update-'));
    try {
      const res = await run(['node', 'cli.mjs', 'update', '--offline'], root);
      assert.equal(res.ok, true, res.error);
      assert.match(res.note, /OFFLINE/);
      const snap = JSON.parse(fs.readFileSync(path.join(root, 'data', 'snapshot.json'), 'utf8'));
      assert.equal(snap.offline, true);
      assert.equal(snap.provenance, 'demo-fixture');
      assert.ok(fs.existsSync(path.join(root, 'data', 'world.json')));
      assert.ok(fs.existsSync(path.join(root, 'renderer', 'README.md')));
      const md = fs.readFileSync(path.join(root, 'renderer', 'README.md'), 'utf8');
      assert.ok(md.includes('Offline demo snapshot'));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('demo never mutates data/ or renderer/', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kingdom-demo-'));
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'kingdom-demo-out-'));
    try {
      fs.mkdirSync(path.join(root, 'data'), { recursive: true });
      fs.writeFileSync(path.join(root, 'data', 'world.json'), '{"sentinel":true}');
      const res = await run(['node', 'cli.mjs', 'demo', '--only', 'quiet-night', '--out', out], root);
      assert.equal(res.ok, true);
      assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'data', 'world.json'), 'utf8')).sentinel, true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
      fs.rmSync(out, { recursive: true, force: true });
    }
  });
});
