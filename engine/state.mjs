// Turns raw GitHub data into the world state (the "save file").
import {
  levelProgress, computeXp, dayXp, streakInfo, goldenDays, languageWeights, pickClass, timeInfo, chooseWeather,
  archetypeFor, workflowStatus, repoState, importance, population as calcPopulation, goblinTier, treasureTier, castleTier,
  codePower, heroActivity,
} from './rules.mjs';
import { ACHIEVEMENTS, evaluateAchievements, timeOfDayFlags } from './achievements.mjs';
import { newMilestones, mergeEvents, derivedEvents, byRank, resolveRaids, raidView, kingdomDefense } from './events.mjs';
import { backfill, upsertPoint } from './history.mjs';
import { sum, daysSince, diffDays, ymd, normName, truncate, addDays } from './util.mjs';

export function buildState({ snap, cfg, now, store, demo = false }) {
  const prev = store.prev;
  const firstRun = !prev;
  const time = timeInfo(now, cfg);
  const own = snap.repos.filter((r) => !r.isFork && !cfg.excludeRepos.includes(r.name));
  const streak = streakInfo(snap.calendar);
  const xpInfo = computeXp({ ...snap, repos: own }, cfg);
  const lp = levelProgress(xpInfo.total);
  const langs = languageWeights(own, now);
  const cls = pickClass(langs);

  // ----- repositories -----
  const explicit = new Set(Object.keys(cfg.buildings || {}).map(normName));
  const items = own.map((r) => {
    const wf = workflowStatus(r.runs, now, cfg.excludeWorkflows);
    const language = r.language || Object.keys(r.languages || {})[0] || null;
    return {
      name: r.name, url: r.url, description: truncate(r.description || '', 90), stars: r.stars, forks: r.forks, issues: r.openIssues, prs: r.openPRs,
      language, color: (r.langColors && r.langColors[language]) || null,
      archetype: archetypeFor(r, cfg), state: repoState(r, wf, now), workflow: wf.status, recovered: wf.recoveredRecently, lastFailAt: wf.lastFailAt,
      pushedAt: r.pushedAt, pushedDays: Math.floor(daysSince(r.pushedAt, now)), createdAt: r.createdAt,
      importance: Math.round(importance(r, now) * 10) / 10, explicit: explicit.has(normName(r.name)),
    };
  }).sort((a, b) => b.importance - a.importance);
  let hasCastle = false;
  for (const it of items) if (it.archetype === 'castle') { if (hasCastle) it.archetype = 'guild'; else hasCastle = true; }
  if (!hasCastle) { const c = items.find((i) => !i.explicit && i.state !== 'abandoned'); if (c) c.archetype = 'castle'; }
  items.forEach((i) => delete i.explicit);

  // ----- totals -----
  const stars = sum(own, (r) => r.stars), forks = sum(own, (r) => r.forks);
  const issuesOpen = sum(own, (r) => r.openIssues), issuesClosed = sum(own, (r) => r.closedIssues);
  const releases = sum(own, (r) => r.releaseCount);
  const wfAll = own.map((r) => workflowStatus(r.runs, now, cfg.excludeWorkflows));
  const wfTotal = sum(wfAll, (w) => w.total);
  const workflowHealth = wfTotal ? Math.round((100 * sum(wfAll, (w) => w.success)) / wfTotal) : null;
  const failingRepos = items.filter((i) => i.workflow === 'failing').map((i) => i.name);
  const yearContrib = sum(snap.calendar.slice(-365), (d) => d.count);
  const activeRepos = own.filter((r) => !r.archived && daysSince(r.pushedAt, now) <= 90).length;
  const commits = snap.totals.commits;
  const xp30 = sum(snap.calendar.slice(-30), (d) => dayXp(d.count, cfg.xp));
  const reliability = workflowHealth ?? (issuesOpen + issuesClosed ? Math.round((100 * issuesClosed) / (issuesOpen + issuesClosed)) : 100);
  const visitorsTotal = store.visitors.flags.length;

  // ----- achievements -----
  const tod = timeOfDayFlags(snap.pushTimes, cfg.timezone);
  const prevFailing = new Set((prev?.repos || []).filter((r) => r.workflow === 'failing').map((r) => r.name));
  const fireFighter = items.some((i) => i.workflow === 'recovered' || (prevFailing.has(i.name) && ['passing', 'recovered'].includes(i.workflow)));
  const ach = evaluateAchievements({
    now, firstRun, stored: store.achievements,
    ctx: {
      repoCount: own.length, commits, longest: streak.longest, releases, stars, languages: langs.length, activeRepos,
      issueTalk: snap.totals.issues > 0 || issuesOpen + issuesClosed > 0, hardIssue: !!snap.hardIssueClosed, fireFighter, ...tod,
    },
  });
  store.achievements.unlocked = ach.unlocked;

  // ----- events -----
  const names = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a.name]));
  store.events.events = mergeEvents(store.events.events, newMilestones({ prev, level: lp.level, stars, fresh: ach.fresh, names, now }), now);
  const defense = kingdomDefense({ level: lp.level, reliability, streak: streak.current });
  store.events.raids = resolveRaids(store.events.raids, defense, cfg, now);
  const raid = raidView(store.events.raids, defense, now);
  const persistedActive = store.events.events.filter((e) => new Date(e.until) > now);
  const derived = derivedEvents({ items, own, streak, cfg, issuesOpen, time, raid, now, active: persistedActive });
  const all = [...persistedActive, ...derived].sort(byRank);
  const recent = [...store.events.events, ...derived].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 6);

  // ----- weather, hero, world numbers -----
  const days = snap.calendar;
  const startIdx = days.length - 1 - (streak.today > 0 ? 0 : 1) - streak.current;
  let gap = 0;
  for (let i = startIdx; i >= 0 && days[i].count === 0; i--) gap++;
  const afterGap = streak.current > 0 && streak.current <= 3 && gap >= cfg.inactivity.rainAfterDays;
  const celebrating = all.some((e) => ['release', 'milestone'].includes(e.type));
  const w = chooseWeather({ failingRepos: failingRepos.length, workflowHealth, idleDays: streak.idleDays, rainAfter: cfg.inactivity.rainAfterDays, celebrating, afterGap });
  const activity = heroActivity(streak.today, streak.yesterday, cfg);
  const slept = streak.idleDays >= cfg.inactivity.sleepAfterDays;
  let position = activity === 'low' ? 'home' : activity === 'high' ? 'castle' : 'farm';
  if (all.some((e) => e.type === 'release')) position = 'plaza';
  const pop = calcPopulation({ repos: own.length, stars, forks, followers: snap.user.followers, yearContrib, level: lp.level, visitors: visitorsTotal });
  const goldSet = goldenDays(days);
  const cal = days.slice(-189).map((d) => (goldSet.has(d.date) ? { date: d.date, count: d.count, gold: 1 } : { date: d.date, count: d.count }));

  // ----- history -----
  if (!store.history.points.length) store.history.points = backfill(xpInfo.series, xpInfo.total);
  upsertPoint(store.history, { d: time.date, l: lp.level, x: xpInfo.total, s: stars, c: commits, p: pop });

  const flags = [...store.visitors.flags].sort((a, b) => b.n - a.n);
  const created = ymd(new Date(snap.user.createdAt), cfg.timezone);
  return {
    version: 1,
    generatedAt: now.toISOString(),
    // the simple summary (same names as the plan)
    level: lp.level, xp: xpInfo.total, stars, commits, issues: issuesOpen, pullRequests: snap.totals.prs,
    workflowHealth, streak: streak.current, activeRepositories: activeRepos, topLanguage: cls.language,
    weather: w.kind, weatherReason: w.reason, timeOfDay: time.phase, season: time.season,
    // the details
    meta: { demo, source: snap.source, dataStatus: 'fresh', errors: snap.errors || [], apiCalls: snap.apiCalls || 0 },
    profile: { login: snap.user.login, name: cfg.displayName || snap.user.name || snap.user.login, createdAt: snap.user.createdAt, followers: snap.user.followers, following: snap.user.following, kingdomDay: Math.max(1, diffDays(created, time.date)) },
    time,
    hero: {
      class: cls, xpInto: lp.into, xpNeed: lp.need, xpPct: lp.pct, xpNext: lp.next, activity, position, sleeping: slept,
      stats: { codePower: codePower(xp30), reliability, streak: streak.current, reputation: stars },
      streak: { current: streak.current, longest: streak.longest, idleDays: streak.idleDays, today: streak.today, yesterday: streak.yesterday },
    },
    totals: {
      stars, forks, commits, prs: snap.totals.prs, mergedPrs: snap.totals.mergedPrs, reviews: snap.totals.reviews,
      issuesOpen, issuesClosed, releases, repos: own.length, activeRepos, archivedRepos: own.filter((r) => r.archived).length, followers: snap.user.followers,
      yearContrib, workflowHealth, failingRepos, openPRs: sum(own, (r) => r.openPRs), codeKb: sum(own, (r) => r.size),
    },
    xpBreakdown: { base: Math.round(xpInfo.base), streakBonus: xpInfo.streakBonus, bonus: xpInfo.bonus },
    population: { total: pop, npcs: Math.max(4, Math.min(18, Math.round(pop / 110))), houses: Math.max(3, Math.min(12, own.length)) },
    goblins: { count: issuesOpen, tier: goblinTier(issuesOpen) },
    treasure: { stars, tier: treasureTier(stars), coins: Math.max(0, Math.min(64, Math.round(stars / 3))) },
    castle: { tier: castleTier(lp.level) },
    languages: langs.slice(0, 12),
    repos: items,
    calendar: cal,
    achievements: { list: ach.list, count: ach.count, total: ach.total, visibleUnlocked: ach.visibleUnlocked, visibleTotal: ach.visibleTotal, secretUnlocked: ach.secretUnlocked, secretTotal: ach.secretTotal, fresh: ach.fresh },
    events: { active: all, recent },
    raid,
    visitors: { total: visitorsTotal, flags },
    history: { points: store.history.points.slice(-400) },
    status: { assets: {}, checkedAt: now.toISOString() },
  };
}
