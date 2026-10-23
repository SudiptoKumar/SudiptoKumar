// RULE B: mobile acceptance (first-class). The reported problem is mainly mobile UX, so it has its own test.
// A phone shows the README at the viewport minus 32 px of padding (360 -> 328 px, 390 -> 358 px, 430 -> 398 px). Every picture is 720 px wide,
// so a picture is shown at (content width / 720) of its size.
import test from 'node:test';
import assert from 'node:assert/strict';
import { world, cfg, scenarioNames } from './support.mjs';
import { renderAll } from '../cli.mjs';
import { buildBlock, PANELS } from '../readme.mjs';
import { textLog } from '../render/pixel.mjs';
import { renderHero } from '../render/hero.mjs';
import { renderKingdom } from '../render/kingdom.mjs';
import { renderEvents, renderQuest } from '../render/hud.mjs';
import { renderDistricts } from '../render/districts.mjs';
import { renderTrophies } from '../render/trophies.mjs';
import { renderHarvest } from '../render/harvest.mjs';
import { renderHistory } from '../render/chronicle.mjs';
import { renderCamp } from '../render/camp.mjs';
import { renderStatus } from '../render/status.mjs';
import { STYLE, OUT_W } from '../world/constants.mjs';

const R = { cfg, avatars: {} };
const DRAW = { hero: renderHero, world: renderKingdom, events: renderEvents, quest: renderQuest, districts: renderDistricts, trophies: renderTrophies, harvest: renderHarvest, history: renderHistory, camp: renderCamp };
const VIEWPORTS = [360, 390, 430];
const MIN_CAP_PX = 8.5;                    // smallest readable height of a pixel-font capital on a phone, at the narrowest viewport
const V1_ASPECT_SUM = 5.15;                // the V1 README (hero, world, quests, districts, trophies, harvest, history, camp), in picture widths: measured from the baseline
const V1_ASPECT_SUM_WITH_EVENT = 5.36;     // the same with V1's event strip

const widthOf = (svg) => +/viewBox="0 0 (\d+) (\d+)"/.exec(svg)[1];
const aspectOf = (svg) => { const m = /viewBox="0 0 (\d+) (\d+)"/.exec(svg); return m[2] / m[1]; };

function readme(name, tweak) {
  const S = world(name, { tweak }), files = new Map(renderAll(S, R));
  S.status.assets = Object.fromEntries([...files].map(([f, svg]) => [f.replace('.svg', ''), svg ? 'ok' : 'empty']));
  const block = buildBlock(S, cfg, new Date(S.generatedAt));
  const imgs = [...block.matchAll(/renderer\/([\w/-]+\.svg)" width="(\d+)"/g)].filter((m) => +m[2] === OUT_W).map((m) => m[1].replace('.svg', ''));
  return { S, files, block, imgs };
}
const sum = ({ files, imgs }) => imgs.reduce((a, k) => a + aspectOf(files.get(`${k}.svg`)), 0);

test('mobile: no text below the readable size, at 360, 390 and 430 px', () => {
  assert.ok(STYLE.minTextScale * 7 * ((360 - 32) / OUT_W) >= MIN_CAP_PX, 'the smallest allowed text scale is readable at the narrowest phone');
  let checked = 0;
  for (const name of ['day', 'night', 'release', 'raid', 'storm', 'newbie', 'legendary', 'festival', 'winter']) {
    const S = world(name);
    for (const [key, draw] of Object.entries(DRAW)) {
      textLog.on = true; textLog.items.length = 0;
      const svg = draw(S, R);
      textLog.on = false;
      if (!svg) continue;
      const w = widthOf(svg); assert.equal(w, OUT_W, `${name}/${key}: every picture is ${OUT_W} px wide (no desktop artwork shrunk onto a phone)`);
      for (const vp of VIEWPORTS) {
        const k = (vp - 32) / w;
        for (const it of textLog.items) {
          assert.equal(it.u, 1, `${name}/${key}: text is only written in screen space, never inside the scaled world`);
          assert.ok(it.cap * k >= MIN_CAP_PX, `${name}/${key} at ${vp}px: "${String(it.str).slice(0, 20)}" is ${(it.cap * k).toFixed(1)} px tall`);
          checked++;
        }
      }
      for (const it of textLog.items) assert.ok(it.s >= STYLE.minTextScale, `${name}/${key}: "${it.str}" is drawn at scale ${it.s}, below the minimum ${STYLE.minTextScale}`);
    }
  }
  assert.ok(checked > 1000, `${checked} strings checked`);
});

test('mobile: the README is meaningfully shorter than V1', () => {
  const limits = {};
  for (const name of scenarioNames()) {
    const r = readme(name), total = sum(r), event = r.imgs.includes('events');
    const v1 = event ? V1_ASPECT_SUM_WITH_EVENT : V1_ASPECT_SUM;
    assert.ok(total <= v1 * 0.87, `${name}: ${total.toFixed(2)} picture widths vs V1 ${v1} (${event ? 'with' : 'without'} an event picture): at least 13% shorter`);
    assert.ok(total <= (event ? 4.75 : 4.3), `${name}: ${total.toFixed(2)} stays inside the budget`);
    limits[name] = total;
  }
  const typical = readme('day'); assert.ok(sum(typical) <= V1_ASPECT_SUM * 0.82, `a normal day is at least 18% shorter than V1: ${sum(typical).toFixed(2)} vs ${V1_ASPECT_SUM}`);
  const heightAt = (vp, r) => Math.round(sum(r) * (vp - 32));
  assert.ok(heightAt(390, typical) < 1600, `at 390 px the whole README is ${heightAt(390, typical)} px tall (V1: ${Math.round(V1_ASPECT_SUM * 358)})`);
});

test('mobile: the primary world is visible quickly, and the hero panel is a short card', () => {
  for (const name of ['day', 'release', 'newbie']) {
    const r = readme(name), order = r.imgs;
    assert.equal(order[0], 'hero'); assert.equal(order[1], 'world', 'the world comes straight after the hero card');
    const hero = aspectOf(r.files.get('hero.svg'));
    assert.ok(hero <= 0.5, `${name}: the hero card is at most half as tall as it is wide (${hero.toFixed(2)})`);
    for (const vp of VIEWPORTS) assert.ok(hero * (vp - 32) + 16 <= 220, `${name}: at ${vp} px the world starts within the first 220 px (${Math.round(hero * (vp - 32) + 16)})`);
    assert.ok(aspectOf(r.files.get('world.svg')) * 358 < 500, 'and the whole kingdom is shorter than a phone screen at 390 px');
  }
});

test('mobile: no unnecessary full-width repeated panels', () => {
  const purposes = Object.values(PANELS); assert.equal(new Set(purposes).size, purposes.length, 'every panel has its own purpose');
  for (const name of scenarioNames()) {
    const r = readme(name);
    assert.ok(r.imgs.length <= 9, `${name}: ${r.imgs.length} full-width panels (at most 9)`);
    assert.equal(new Set(r.imgs).size, r.imgs.length, `${name}: no picture twice`);
    for (const k of r.imgs) assert.ok(PANELS[k], `${name}: ${k} has a declared purpose`);
    const hasEvent = r.imgs.includes('events'), story = r.S.scene.hud.length > 0;
    assert.equal(hasEvent, story, `${name}: the event picture exists exactly while there is a story`);
  }
  assert.ok(!readme('day').imgs.includes('events') && readme('release').imgs.includes('events'));
  // quest strip: nothing a world object already shows (no stat tiles): see homes.test.mjs; here: it is short
  assert.ok(aspectOf(readme('day').files.get('quest.svg')) <= 0.4);
});

test('mobile: raw text is minimal: the README block is pictures, signposts and one line of project links', () => {
  const r = readme('day'), text = r.block.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, '').replace(/&nbsp;|·/g, '').trim();
  assert.ok(text.length < 120, `${text.length} characters of raw text in the block: "${text.slice(0, 120)}"`);
});

test('mobile: the small fixed-size widgets (status badge) are never scaled down and stay readable', () => {
  const S = world('day'); textLog.on = true; textLog.items.length = 0; const svg = renderStatus(S, R); textLog.on = false;
  assert.ok(svg && widthOf(svg) <= 328, `the badge is ${widthOf(svg)} px wide: narrower than the content of the narrowest phone, so it is shown at its own size`);
  for (const it of textLog.items) assert.ok(it.cap >= MIN_CAP_PX, `"${it.str}" is ${it.cap} px tall at its natural size`);
  const block = readme('day').block;
  for (const m of block.matchAll(/renderer\/(?:ui\/)?([\w-]+\.svg)" width="(\d+)"/g)) if (+m[2] !== OUT_W) assert.ok(+m[2] <= 328, `${m[1]} is shown at ${m[2]} px, never wider than a phone's content`);
});
