import test from 'node:test';
import assert from 'node:assert/strict';
import { levelProgress, levelThreshold, dayXp, streakInfo, goldenDays, pickClass, languageWeights, seasonOf, timeInfo, chooseWeather, goblinTier, treasureTier, workflowStatus, archetypeFor } from '../rules.mjs';
import { DEFAULTS } from '../config.mjs';
import { tiered, addDays } from '../util.mjs';

test('level curve matches the plan: 100, 250, 450', () => {
  assert.deepEqual([1, 2, 3].map(levelThreshold), [100, 250, 450]);
  assert.equal(levelProgress(0).level, 1);
  assert.equal(levelProgress(99).level, 1);
  assert.equal(levelProgress(100).level, 2);
  assert.equal(levelProgress(450).level, 4);
  const p = levelProgress(175);
  assert.equal(p.level, 2); assert.equal(p.into, 75); assert.equal(p.pct, 50);
});

test('commit XP has diminishing returns and a daily cap (anti farming)', () => {
  const x = DEFAULTS.xp;
  assert.equal(dayXp(1, x), 10);
  assert.equal(dayXp(5, x), 50);
  assert.equal(dayXp(15, x), 90);
  assert.equal(dayXp(500, x), 90, 'a thousand fake commits give no extra XP');
  assert.equal(tiered(30, [[20, 50], [80, 25]]), 20 * 50 + 10 * 25);
});

const days = (counts, end = '2026-09-30') => counts.map((c, i) => ({ date: addDays(end, i - counts.length + 1), count: c }));
test('streaks: today may be empty without breaking the streak', () => {
  assert.equal(streakInfo(days([0, 1, 1, 1])).current, 3);
  assert.equal(streakInfo(days([1, 1, 1, 0])).current, 3);
  assert.equal(streakInfo(days([1, 1, 0, 0])).current, 0);
  const s = streakInfo(days([1, 1, 1, 0, 0, 1, 1]));
  assert.equal(s.current, 2); assert.equal(s.longest, 3); assert.equal(s.idleDays, 0);
  assert.equal(streakInfo(days([1, 0, 0, 0, 0])).idleDays, 4);
  assert.equal(streakInfo([]).current, 0);
});
test('golden days are runs of 7 or more', () => {
  const d = days([1, 1, 1, 1, 1, 1, 1, 0, 1, 1]);
  assert.equal(goldenDays(d).size, 7);
});

test('class comes from the code, not from a setting', () => {
  const now = new Date('2026-09-30T00:00:00Z');
  const repo = (languages, pushedAt = '2026-09-20T00:00:00Z') => ({ isFork: false, archived: false, pushedAt, languages });
  assert.equal(pickClass(languageWeights([repo({ TypeScript: 90000, CSS: 500000 })], now)).title, 'TYPESCRIPT PALADIN');
  assert.equal(pickClass(languageWeights([repo({ Python: 1000 })], now)).archetype, 'alchemist');
  assert.equal(pickClass(languageWeights([repo({ Rust: 1000 })], now)).archetype, 'berserker');
  assert.equal(pickClass(languageWeights([repo({ HTML: 1000 })], now)).title, 'CODE ADVENTURER');
  assert.equal(pickClass(languageWeights([], now)).archetype, 'adventurer');
});

test('seasons and day parts', () => {
  assert.equal(seasonOf(9, 'north'), 'autumn');
  assert.equal(seasonOf(9, 'south'), 'spring');
  const cfg = { timezone: 'UTC', hemisphere: 'north' };
  assert.equal(timeInfo(new Date('2026-09-30T12:00:00Z'), cfg).phase, 'day');
  assert.equal(timeInfo(new Date('2026-09-30T23:00:00Z'), cfg).phase, 'night');
  assert.equal(timeInfo(new Date('2026-09-30T18:00:00Z'), cfg).phase, 'evening');
  assert.equal(timeInfo(new Date('2026-09-30T06:00:00Z'), cfg).phase, 'dawn');
  assert.equal(timeInfo(new Date('2026-09-30T20:00:00Z'), { ...cfg, timezone: 'Asia/Kolkata' }).phase, 'night');
});

test('weather follows the health of the kingdom', () => {
  const base = { failingRepos: 0, workflowHealth: 100, idleDays: 0, rainAfter: 7, celebrating: false, afterGap: false };
  assert.equal(chooseWeather(base).kind, 'clear');
  assert.equal(chooseWeather({ ...base, idleDays: 9 }).kind, 'rain');
  assert.equal(chooseWeather({ ...base, failingRepos: 2 }).kind, 'storm');
  assert.equal(chooseWeather({ ...base, failingRepos: 3 }).kind, 'thunderstorm');
  assert.equal(chooseWeather({ ...base, celebrating: true }).kind, 'clear', 'daytime celebration gets clear skies, not aurora');
  assert.equal(chooseWeather({ ...base, celebrating: true, phase: 'night' }).kind, 'aurora');
  assert.equal(chooseWeather({ ...base, celebrating: true, phase: 'evening' }).kind, 'aurora');
  assert.equal(chooseWeather({ ...base, afterGap: true }).kind, 'sunrise');
  assert.equal(chooseWeather({ ...base, idleDays: 9, failingRepos: 2 }).kind, 'storm', 'failures beat quiet days');
});

test('goblin and treasure tiers', () => {
  assert.deepEqual([0, 1, 2, 3, 5, 6, 10, 11].map(goblinTier), ['none', 'small', 'small', 'group', 'group', 'raid', 'raid', 'boss']);
  assert.deepEqual([0, 5, 20, 100, 300, 900].map(treasureTier), ['empty', 'small', 'medium', 'large', 'huge', 'mountain']);
});

test('workflow status: failing, recovered, passing', () => {
  const now = new Date('2026-09-30T00:00:00Z');
  const run = (conclusion, d, wf = 1) => ({ wf, name: 'CI', conclusion, at: new Date(now.getTime() - d * 86400000).toISOString() });
  assert.equal(workflowStatus([run('success', 1), run('success', 2)], now).status, 'passing');
  assert.equal(workflowStatus([run('failure', 1), run('success', 2)], now).status, 'failing');
  const rec = workflowStatus([run('success', 1), run('failure', 2)], now);
  assert.equal(rec.status, 'recovered'); assert.equal(rec.recoveredRecently, true);
  assert.equal(workflowStatus([], now).status, 'none');
  assert.equal(workflowStatus([run('failure', 1)], now, ['CI']).status, 'none', 'excluded workflows are ignored');
});

test('repository buildings: your names win, then keywords', () => {
  const cfg = { buildings: { StudyMart: 'castle', 'News Bots': 'tower' } };
  assert.equal(archetypeFor({ name: 'studymart' }, cfg), 'castle');
  assert.equal(archetypeFor({ name: 'NewsBots' }, cfg), 'tower');
  assert.equal(archetypeFor({ name: 'my-api-server' }, cfg), 'workshop');
  assert.equal(archetypeFor({ name: 'zzz' }, cfg), 'house');
});
