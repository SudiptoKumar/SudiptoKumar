// Fake GitHub data for demos and tests. It has the same shape as the real collector output.
import { rng, addDays, ymd, hash32 } from './util.mjs';

const COLORS = { TypeScript: '#3178c6', Python: '#3572A5', JavaScript: '#f1e05a', HTML: '#e34c26', CSS: '#563d7c', Shell: '#89e051', Go: '#00ADD8' };

export function mockSnapshot({ now = new Date(), tz = 'UTC', login = 'SudiptoKumar', name = 'Sudipto Kumar', scenario = {} } = {}) {
  const sc = { streak: 13, gap: 0, idle: 0, failing: 0, issues: 7, release: false, bigDay: false, newRepo: false, empty: false, ...scenario };
  const rnd = rng('kingdom-' + login);
  const ago = (d) => new Date(now.getTime() - d * 86400000).toISOString();
  const hoursAgo = (h) => new Date(now.getTime() - h * 3600000).toISOString();
  const runs = (pattern, step = 1) => [...pattern].map((c, i) => ({ wf: 1, name: 'CI', conclusion: c === 'p' ? 'success' : 'failure', at: ago(0.1 + i * step) }));
  const R = (o) => ({
    url: `https://github.com/${login}/${o.name}`, description: '', stars: 0, forks: 0, archived: false, isFork: false,
    createdAt: ago(o.created ?? 300), pushedAt: ago(o.pushed ?? 3), size: 800, language: 'TypeScript', languages: {}, langColors: COLORS,
    openIssues: 0, closedIssues: 0, openPRs: 0, mergedPRs: 0, recentCommits: 0, topics: [], releases: [], releaseCount: 0,
    defaultBranch: 'main', runs: [], ...o,
  });

  let repos = [
    R({ name: 'StudyMart', description: 'Student marketplace for notes and books', stars: 86, forks: 14, languages: { TypeScript: 182000, CSS: 30000, JavaScript: 12000, HTML: 9000 }, openIssues: 3, closedIssues: 19, openPRs: 1, mergedPRs: 16, recentCommits: 48, topics: ['marketplace', 'students'], pushed: 0.4, created: 600, size: 6200, releaseCount: 4, releases: sc.release ? [{ tag: 'v2.3.0', at: hoursAgo(20), prerelease: false }] : [{ tag: 'v2.2.0', at: ago(40), prerelease: false }], runs: runs('pppppppppp') }),
    R({ name: 'NewsBots', description: 'Telegram bots that post job and exam news', stars: 39, forks: 7, language: 'Python', languages: { Python: 96000, Shell: 2000 }, openIssues: 2, closedIssues: 11, mergedPRs: 9, recentCommits: 61, topics: ['bot', 'automation'], pushed: 0.2, created: 420, size: 2100, releaseCount: 2, runs: runs('pppppppppp') }),
    R({ name: 'Portfolio', description: 'My personal site', stars: 17, forks: 3, languages: { TypeScript: 64000, CSS: 12000 }, closedIssues: 4, recentCommits: 12, pushed: 5, created: 800, size: 1500, runs: runs('pppp') }),
    R({ name: 'DailyFacts', description: 'A fresh fact every day', stars: 21, forks: 2, language: 'Python', languages: { Python: 31000 }, openIssues: 1, closedIssues: 6, recentCommits: 30, pushed: 1, created: 300, size: 900, runs: runs('pppppp') }),
    R({ name: 'QuizArena', description: 'Realtime quiz battles', stars: 9, forks: 1, language: 'JavaScript', languages: { JavaScript: 48000, HTML: 8000 }, openIssues: 1, closedIssues: 2, recentCommits: 7, pushed: 22, created: 200, size: 700 }),
    R({ name: 'CareerNewsroom', description: 'Career news aggregator', stars: 6, forks: 1, language: 'Python', languages: { Python: 22000 }, recentCommits: 9, pushed: 9, created: 150, size: 500, runs: runs('ppfppp') }),
    R({ name: login, description: 'Profile README', stars: 4, language: 'JavaScript', languages: { JavaScript: 40000 }, recentCommits: 20, pushed: 0.1, created: 700, size: 300, runs: runs('pppp') }),
    R({ name: 'NotesHub', description: 'Class notes', stars: 2, languages: { TypeScript: 9000 }, pushed: 140, created: 500, size: 400 }),
    R({ name: 'OldExperiments', description: 'Old tests', archived: true, language: 'Python', languages: { Python: 4000 }, pushed: 500, created: 900, size: 100 }),
  ];
  if (sc.newRepo) repos.push(R({ name: 'KingdomLab', description: 'New idea', stars: 0, languages: { TypeScript: 3000 }, pushed: 0.05, created: 2, size: 120, recentCommits: 4 }));
  // scenario: open issues
  const want = sc.issues;
  repos.forEach((r) => { r.openIssues = 0; });
  const order = [0, 1, 3, 4, 5, 2];
  for (let i = 0; i < want; i++) repos[order[i % order.length]].openIssues++;
  // scenario: failing workflows
  const failOrder = [1, 0, 3, 2, 6];
  for (let i = 0; i < sc.failing; i++) { const r = repos[failOrder[i]]; r.runs = runs('f' + (r.runs.map((x) => (x.conclusion === 'success' ? 'p' : 'f')).join('').slice(1) || 'ppp')); }

  // calendar: about 3 years of deterministic activity
  const anchor = ymd(now, tz);
  const start = addDays(anchor, -1100);
  const calendar = [];
  for (let i = 0; i <= 1100; i++) {
    const date = addDays(start, i);
    const wd = new Date(date + 'T00:00:00Z').getUTCDay();
    const wave = 0.55 + 0.25 * Math.sin(i / 37);
    const p = (wd === 0 || wd === 6 ? wave * 0.6 : wave) * (i < 200 ? 0.5 : 1);
    const r = rnd();
    calendar.push({ date, count: r < p ? 1 + Math.floor(Math.pow(rnd(), 2) * 9) : 0 });
  }
  const n = calendar.length;
  if (sc.streak > 0) for (let i = 0; i < sc.streak; i++) calendar[n - 1 - i].count = Math.max(calendar[n - 1 - i].count, 1 + ((i * 7) % 6));
  if (sc.streak > 0 && sc.streak < 60) calendar[n - 1 - sc.streak].count = 0;
  if (sc.gap > 0) for (let i = 0; i < sc.gap; i++) calendar[n - 1 - sc.streak - i].count = 0;
  if (sc.idle > 0) for (let i = 0; i < sc.idle; i++) calendar[n - 1 - i].count = 0;
  if (sc.bigDay) calendar[n - 1].count = 15;
  if (sc.empty) calendar.forEach((d) => { d.count = 0; });
  const commits = Math.round(calendar.reduce((a, d) => a + d.count, 0) * 0.78);

  // push times (UTC) so "night coder" can be checked
  const pushTimes = [];
  for (let i = 0; i < 40; i++) pushTimes.push(new Date(now.getTime() - (i * 1.3 * 86400000) - ((hash32('p' + i) % 24) * 3600000)).toISOString());

  return {
    source: 'mock', fetchedAt: now.toISOString(), apiCalls: 0,
    user: { login, name, avatarUrl: '', createdAt: ago(1100), followers: 23, following: 11 },
    repos: sc.empty ? [] : repos,
    calendar,
    totals: sc.empty ? { commits: 0, prs: 0, mergedPrs: 0, issues: 0, reviews: 0 } : { commits, prs: 57, mergedPrs: 41, issues: 23, reviews: 12 },
    hardIssueClosed: !sc.empty,
    pushTimes: sc.empty ? [] : pushTimes,
    errors: [],
  };
}

/** Named demo worlds used by `demo` and the tests. */
export function demoScenarios() {
  const at = (iso) => new Date(iso);
  return {
    day: { now: at('2026-09-30T10:30:00Z'), scenario: {} },
    dawn: { now: at('2026-09-30T06:15:00Z'), scenario: { gap: 10, streak: 2 } },
    evening: { now: at('2026-09-30T18:20:00Z'), scenario: { bigDay: true } },
    night: { now: at('2026-09-30T22:40:00Z'), scenario: {} },
    rain: { now: at('2026-09-30T11:00:00Z'), scenario: { idle: 9, streak: 0 } },
    storm: { now: at('2026-09-30T14:00:00Z'), scenario: { failing: 2 } },
    thunder: { now: at('2026-09-30T21:00:00Z'), scenario: { failing: 4 } },
    release: { now: at('2026-09-30T12:00:00Z'), scenario: { release: true, bigDay: true } },
    boss: { now: at('2026-09-30T09:00:00Z'), scenario: { issues: 14 } },
    winter: { now: at('2027-01-20T12:00:00Z'), scenario: {} },
    spring: { now: at('2027-04-12T12:00:00Z'), scenario: { newRepo: true } },
    summer: { now: at('2027-07-10T12:00:00Z'), scenario: {} },
    autumn: { now: at('2026-10-20T12:00:00Z'), scenario: {} },
    newbie: { now: at('2026-09-30T12:00:00Z'), scenario: { empty: true, streak: 0, issues: 0 } },
  };
}
