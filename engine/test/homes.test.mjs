// RULE C: one visual home. Every important GitHub signal has exactly one primary visualisation: its home object in the world.
// Anywhere else it may only be a compact reference (icon + number). The test reads every string every picture writes and
// accepts only what that picture owns, so a stat tile, a second bar or a repeated number cannot come back unnoticed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { world, cfg, scenarioNames } from './support.mjs';
import { textLog } from '../render/pixel.mjs';
import { renderHero } from '../render/hero.mjs';
import { renderKingdom } from '../render/kingdom.mjs';
import { renderEvents, renderQuest } from '../render/hud.mjs';
import { renderDistricts } from '../render/districts.mjs';
import { renderTrophies } from '../render/trophies.mjs';
import { renderHarvest } from '../render/harvest.mjs';
import { renderHistory } from '../render/chronicle.mjs';
import { renderCamp } from '../render/camp.mjs';
import { renderDungeon } from '../render/dungeon.mjs';
import { VISUAL_HOME, COMPACT_REFS, QUEST_TARGET, isCompact } from '../world/homes.mjs';
import { buildWorld } from '../world/index.mjs';
import { kingdomTier } from '../world/lifecycle.mjs';
import { readManifest } from '../world/manifest.mjs';
import { nameWords } from '../render/ui.mjs';
import { fmt } from '../util.mjs';

const R = { cfg, avatars: {} };
const PICTURES = { hero: renderHero, world: renderKingdom, events: renderEvents, quest: renderQuest, districts: renderDistricts, trophies: renderTrophies, harvest: renderHarvest, history: renderHistory, camp: renderCamp, dungeon: renderDungeon };
const U = (x) => String(x).toUpperCase();

/** What each picture may write: strings, or regular expressions for the numbers it owns. */
const OWNS = {
  hero: (S) => [S.profile.name || S.profile.login, S.hero.class.title, 'LV', String(S.level), 'LEVEL UP!', S.hero.title, S.hero.status, 'DEMO DATA'],
  world: () => ['DEMO DATA', 'CI ALERT', /^ISSUES \d+$/, /^DEFENSE \d+%$/],
  dungeon: () => ['CI ALERT', /^ISSUES \d+$/, /^DEFENSE \d+%$/],
  events: (S) => [...S.scene.hud.flatMap((c) => [c.text, c.kind]), 'STARTING', 'NOW', 'AFTERMATH', 'DEMO DATA'],
  quest: (S) => [kingdomTier(S.power.value).name, String(S.power.value), 'DEMO DATA', ...S.quests.rows.map((q) => q.title), /^[\d,]+\/[\d,]+$/, /^\+\d+$/, 'OK'],
  districts: (S) => [...S.featured.map((n) => S.repos.find((r) => r.name === n)).filter(Boolean).flatMap((r) => nameWords(r.name))],
  trophies: (S) => [`${S.achievements.count}/${S.achievements.total}`],
  harvest: (S) => [fmt(S.streak), fmt(S.calendar.reduce((a, d) => a + d.count, 0)), /^[\d,]+$/],
  history: () => [/^LV ?\d+$/, 'TODAY', 'DAY ONE', /^[A-Z]{3} \d{2}~?$/, 'DEMO DATA'],
  camp: (S) => [String(S.visitors.total), ...(S.visitors.flags[0] ? [`@${S.visitors.flags[0].login}`, S.visitors.flags[0].message] : [])],
};

function allowed(pic, str, S) {
  const s = U(str).replace(/~$/, '');
  return OWNS[pic](S).some((a) => (a instanceof RegExp ? a.test(s) : U(a).startsWith(s) || (pic === 'camp' && U(a).includes(s)) || (pic === 'districts' && s.split(' ').every((w) => OWNS.districts(S).some((x) => U(x).startsWith(w))))));
}

const STATES = ['day', 'night', 'release', 'raid', 'storm', 'newbie', 'legendary', 'festival', 'winter', 'victory', 'build', 'recovery', 'sleepy', 'spring'];

test('one visual home: every string in every picture is something that picture owns (no stat tiles, no repeated numbers)', () => {
  let checked = 0;
  for (const name of STATES) {
    const S = world(name);
    for (const [pic, draw] of Object.entries(PICTURES)) {
      textLog.on = true; textLog.items.length = 0; const svg = draw(S, R); textLog.on = false;
      if (!svg) continue;
      for (const it of textLog.items) { assert.ok(allowed(pic, it.str, S), `${name}/${pic} writes "${it.str}", which that picture does not own`); checked++; }
    }
  }
  assert.ok(checked > 500, `${checked} strings checked`);
});

test('one visual home: the quest strip and the hero card carry no GitHub statistic at all', () => {
  const S = world('day');
  const stats = { stars: S.treasure.stars, issues: S.goblins.count, forks: S.totals.forks, repos: S.totals.repos, followers: S.totals.followers };
  for (const [pic, draw] of [['quest', renderQuest], ['hero', renderHero]]) {
    textLog.on = true; textLog.items.length = 0; draw(S, R); textLog.on = false;
    const strings = textLog.items.map((i) => String(i.str));
    for (const [k, v] of Object.entries(stats)) if (v > 20) assert.ok(!strings.includes(String(v)) && !strings.includes(fmt(v)), `${pic} must not print the number of ${k} (${v})`);
    assert.ok(!strings.some((x) => /^(STARS|FORKS|COMMITS|ISSUES|FOLLOWERS|STREAK|REPOS|CI|PRS)$/i.test(x)), `${pic} prints no statistic tile labels (quest titles may name their own subject)`);
  }
});

test('one visual home: compact references are declared, small, and only where the home is', () => {
  assert.deepEqual(Object.keys(COMPACT_REFS).sort(), ['camp', 'districts', 'dungeon', 'events', 'harvest', 'hero', 'history', 'quest', 'trophies', 'world']);
  for (const [pic, signals] of Object.entries(COMPACT_REFS)) for (const sig of signals) assert.ok(VISUAL_HOME[sig], `${pic} refers to a known signal (${sig})`);
  // a compact reference lives in the picture of its own home
  assert.ok(COMPACT_REFS.harvest.every((s) => VISUAL_HOME[s].home === 'farm') && COMPACT_REFS.trophies.every((s) => VISUAL_HOME[s].home === 'hall') && COMPACT_REFS.camp.every((s) => VISUAL_HOME[s].home === 'camp') && COMPACT_REFS.dungeon.every((s) => VISUAL_HOME[s].home === 'dungeon'));
  for (const pic of ['hero', 'quest', 'events', 'districts', 'history']) assert.deepEqual(COMPACT_REFS[pic], [], `${pic} repeats nothing`);
  assert.ok(isCompact('streak') && isCompact('issues') && !isCompact('stars') && !isCompact('commits') && !isCompact('prs') && !isCompact('releases'), 'stars, commits, pull requests and releases have no number anywhere: the world shows them');
  // the number of numbers: each compact picture writes at most the references it declares
  for (const [pic, n] of Object.entries({ trophies: 1, camp: 1 })) { const S = world('day'); textLog.on = true; textLog.items.length = 0; PICTURES[pic](S, R); textLog.on = false; assert.ok(textLog.items.filter((i) => /^\d+(\/\d+)?$/.test(String(i.str))).length <= n, `${pic}: at most ${n} number`); }
});

test('one visual home: every signal named in the specification has its home in the world', () => {
  const want = { stars: 'vault', issues: 'dungeon', ci: 'fortress', commits: 'builders', prs: 'messengers', releases: 'castle', contributions: 'farm', achievements: 'hall', visitors: 'camp', population: 'npcs' };
  for (const [k, v] of Object.entries(want)) assert.equal(VISUAL_HOME[k].home, v, k);
  for (const name of STATES) {
    const S = world(name), W = buildWorld(S, { cfg }), m = readManifest(renderKingdom(S, R));
    for (const obj of ['vault', 'dungeon', 'ci', 'castle', 'farm', 'hall', 'camp']) assert.ok(m.o[obj], `${name}: the ${obj} stands in the overworld`);
    assert.ok(W.npcs.length > 0, `${name}: people live in the kingdom (population has a home)`);
    assert.ok(W.repos.length > 0 || name === 'newbie', `${name}: repositories are buildings`);
  }
  // builders work on buildings that are being built; messengers carry pull requests; the home objects change with their signal
  const d = world('day'), w = buildWorld(d, { cfg });
  assert.ok(w.repos.some((r) => ['building', 'foundation'].includes(r.lifecycle)) === d.repos.some((r) => r.state === 'building' || r.ageDays <= 21), 'builders where the work is');
  assert.ok(w.npcs.some((n) => n.role === 'messenger') === (d.scene.npcs.messenger > 0), 'messengers walk when there are pull requests');
  const more = world('day', { tweak: (s) => { s.goblins = { ...s.goblins, count: s.goblins.count + 3 }; } });
  assert.notEqual(readManifest(renderKingdom(more, R)).o.dungeon[2], readManifest(renderKingdom(d, R)).o.dungeon[2], 'three more open issues change the dungeon');
  const rich = world('day', { tweak: (s) => { s.treasure = { ...s.treasure, coins: s.treasure.coins + 9 }; } });
  assert.notEqual(readManifest(renderKingdom(rich, R)).o.vault[2], readManifest(renderKingdom(d, R)).o.vault[2], 'more stars change the vault');
});

test('one visual home: quests point at homes, they do not repeat them', () => {
  for (const t of Object.values(QUEST_TARGET)) assert.ok(['farm', 'vault', 'dungeon', 'ci', 'castle', 'district'].includes(t));
  assert.equal(QUEST_TARGET.streak, VISUAL_HOME.streak.object); assert.equal(QUEST_TARGET.stars, VISUAL_HOME.stars.object);
  assert.equal(QUEST_TARGET.gate, VISUAL_HOME.issues.object); assert.equal(QUEST_TARGET.recover, VISUAL_HOME.ci.object); assert.equal(QUEST_TARGET.release, VISUAL_HOME.releases.object);
  assert.ok(scenarioNames().length >= 21);
});

test('every picture describes itself in real words (no undefined, NaN or [object] in titles and descriptions)', () => {
  const bad = /undefined|NaN|\[object|null\b/;
  for (const name of scenarioNames()) {
    const S = world(name);
    for (const [pic, draw] of Object.entries(PICTURES)) {
      const svg = draw(S, R); if (!svg) continue;
      const title = /<title id="t">(.*?)<\/title>/s.exec(svg)?.[1] || '', desc = /<desc id="d">(.*?)<\/desc>/s.exec(svg)?.[1] || '';
      assert.ok(title.length > 3 && desc.length > 10, `${name}/${pic}: has a title and a description`);
      assert.ok(!bad.test(title) && !bad.test(desc), `${name}/${pic}: "${(title + ' | ' + desc).slice(0, 160)}" contains a placeholder`);
    }
  }
});
