// The game rules. Pure functions: same data in, same answer out.
import { clamp, sum, tiered, daysSince, diffDays, addDays, partsIn, ymd, normName } from './util.mjs';

// ---------------------------------------------------------------- levels
/** Total XP needed to finish level L: 100, 250, 450, 700 ... */
export const levelThreshold = (L) => (L <= 0 ? 0 : 25 * L * (L + 3));
export function levelProgress(xp) {
  let L = 1;
  while (xp >= levelThreshold(L)) L++;
  const base = levelThreshold(L - 1), next = levelThreshold(L);
  return { level: L, base, next, into: xp - base, need: next - base, pct: Math.round(((xp - base) / (next - base)) * 100) };
}

// ---------------------------------------------------------------- XP
export function dayXp(count, x) {
  return Math.min(x.dayCap, tiered(count, x.commitTiers));
}
export function computeXp(snap, cfg) {
  const x = cfg.xp;
  let base = 0, streakBonus = 0, run = 0;
  const series = [];
  for (const d of snap.calendar) {
    run = d.count > 0 ? run + 1 : 0;
    base += dayXp(d.count, x);
    if (run >= x.streakFrom) streakBonus += Math.min(run, x.streakCap);
    series.push([d.date, base + streakBonus]);
  }
  const own = snap.repos.filter((r) => !r.isFork);
  const bonus = {
    pullRequests: tiered(snap.totals.prs || 0, x.pr),
    mergedPullRequests: tiered(snap.totals.mergedPrs || 0, x.mergedPr),
    issuesClosed: tiered(sum(own, (r) => r.closedIssues), x.issueClosed),
    releases: tiered(sum(own, (r) => r.releaseCount), x.release),
    repositories: tiered(own.filter((r) => r.size > 0).length, x.newRepo),
  };
  const total = Math.round(base + streakBonus + sum(Object.values(bonus)));
  return { total, base, streakBonus, bonus, series };
}

// ---------------------------------------------------------------- streaks
export function streakInfo(days) {
  if (!days.length) return { current: 0, longest: 0, idleDays: 999, lastActive: null, anchor: null, today: 0, yesterday: 0 };
  const anchor = days[days.length - 1].date;
  const map = new Map(days.map((d) => [d.date, d.count]));
  let run = 0, longest = 0;
  for (const d of days) {
    run = d.count > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  let cur = 0, d = anchor;
  if (!(map.get(d) > 0)) d = addDays(d, -1);
  while (map.get(d) > 0) { cur++; d = addDays(d, -1); }
  let last = null;
  for (let i = days.length - 1; i >= 0; i--) if (days[i].count > 0) { last = days[i].date; break; }
  return {
    current: cur, longest, anchor, lastActive: last,
    idleDays: last ? diffDays(last, anchor) : 999,
    today: map.get(anchor) || 0, yesterday: map.get(addDays(anchor, -1)) || 0,
  };
}
/** Days that belong to a run of 7+ active days (shown as golden crops). */
export function goldenDays(days, min = 7) {
  const gold = new Set();
  let run = [];
  const flush = () => { if (run.length >= min) run.forEach((x) => gold.add(x)); run = []; };
  for (const d of days) { if (d.count > 0) run.push(d.date); else flush(); }
  flush();
  return gold;
}

// ---------------------------------------------------------------- class
export const CLASS_BY_LANGUAGE = {
  TypeScript: ['PALADIN', 'paladin'], Python: ['ALCHEMIST', 'alchemist'], JavaScript: ['ROGUE', 'rogue'],
  Go: ['RANGER', 'ranger'], Rust: ['BERSERKER', 'berserker'], Java: ['MAGE', 'mage'],
  'C++': ['BATTLE SMITH', 'smith'], PHP: ['MERCHANT', 'merchant'],
  'C#': ['TEMPLAR', 'paladin'], Kotlin: ['SORCERER', 'mage'], Scala: ['WARLOCK', 'mage'], Ruby: ['TRICKSTER', 'rogue'],
  Swift: ['FALCON KNIGHT', 'paladin'], Dart: ['SCOUT', 'ranger'], Lua: ['SCOUT', 'ranger'], C: ['BLACKSMITH', 'smith'],
  Shell: ['MONK', 'adventurer'], 'Jupyter Notebook': ['ALCHEMIST', 'alchemist'], R: ['SAGE', 'alchemist'], Julia: ['SAGE', 'alchemist'],
  Vue: ['DRUID', 'ranger'], Svelte: ['DRUID', 'ranger'], Elixir: ['WIZARD', 'mage'], Haskell: ['ARCHMAGE', 'mage'], Zig: ['BERSERKER', 'berserker'],
};
const IGNORED_LANGS = new Set(['HTML', 'CSS', 'SCSS', 'Sass', 'Less', 'Makefile', 'Dockerfile', 'TeX', 'Markdown', 'Batchfile', 'PowerShell', 'Procfile', 'EJS', 'Handlebars']);
const LANG_LABEL = { 'Jupyter Notebook': 'NOTEBOOK' };
/** Language weights: recent repos count more. sqrt() stops one huge repo from taking over. */
export function languageWeights(repos, now) {
  const w = new Map(), color = new Map();
  for (const r of repos) {
    if (r.isFork || r.archived) continue;
    const age = daysSince(r.pushedAt, now);
    const k = age <= 90 ? 1 : age <= 365 ? 0.5 : 0.2;
    for (const [name, bytes] of Object.entries(r.languages || {})) {
      if (IGNORED_LANGS.has(name)) continue;
      w.set(name, (w.get(name) || 0) + Math.sqrt(bytes) * k);
    }
    for (const [name, c] of Object.entries(r.langColors || {})) if (c && !color.has(name)) color.set(name, c);
  }
  const total = sum([...w.values()]) || 1;
  return [...w.entries()].sort((a, b) => b[1] - a[1]).map(([name, v]) => ({ name, pct: Math.round((v / total) * 100), color: color.get(name) || null }));
}
export function pickClass(langs) {
  const top = langs[0]?.name;
  const hit = top && CLASS_BY_LANGUAGE[top];
  const [title, archetype] = hit || ['ADVENTURER', 'adventurer'];
  const label = top ? (LANG_LABEL[top] || top.toUpperCase()) : 'CODE';
  return { language: top || null, title: `${label} ${title}`, archetype, name: title };
}

// ---------------------------------------------------------------- time, season, weather
export function seasonOf(month, hemisphere = 'north') {
  const s = month >= 3 && month <= 5 ? 'spring' : month >= 6 && month <= 8 ? 'summer' : month >= 9 && month <= 11 ? 'autumn' : 'winter';
  if (hemisphere !== 'south') return s;
  return { spring: 'autumn', summer: 'winter', autumn: 'spring', winter: 'summer' }[s];
}
const SEASON_HOURS = {
  spring: { dawn: 5.5, day: 7, evening: 18, night: 20 },
  summer: { dawn: 5, day: 6.5, evening: 18.5, night: 20.5 },
  autumn: { dawn: 5.5, day: 7, evening: 17.5, night: 19.5 },
  winter: { dawn: 6.5, day: 8, evening: 16.5, night: 18.5 },
};
export function timeInfo(now, cfg) {
  const tz = cfg.timezone || 'UTC';
  const p = partsIn(now, tz);
  const hour = p.h + p.min / 60;
  const season = seasonOf(p.m, cfg.hemisphere);
  const t = { ...SEASON_HOURS[season], ...(cfg.dayHours || {}) };
  let phase = 'day';
  if (hour >= t.night || hour < t.dawn) phase = 'night';
  else if (hour < t.day) phase = 'dawn';
  else if (hour >= t.evening) phase = 'evening';
  return { iso: now.toISOString(), tz, hour: Math.round(hour * 100) / 100, phase, season, date: ymd(now, tz) };
}
export function chooseWeather({ failingRepos, workflowHealth, idleDays, rainAfter, celebrating, afterGap, phase = 'day' }) {
  if (failingRepos >= 3 || (workflowHealth !== null && workflowHealth < 50 && failingRepos >= 2)) return { kind: 'thunderstorm', reason: 'Many workflows are failing' };
  if (failingRepos >= 2) return { kind: 'storm', reason: 'More than one workflow is failing' };
  // TRUE V2: aurora is a night/dusk phenomenon only. A daytime celebration gets
  // clear skies; the celebration itself (confetti, castle lights) still shows
  // through the release event's fx.
  if (celebrating) return phase === 'day'
    ? { kind: 'clear', reason: 'A release or milestone is being celebrated' }
    : { kind: 'aurora', reason: 'A release or milestone is being celebrated' };
  if (afterGap) return { kind: 'sunrise', reason: 'New activity after a quiet time' };
  if (idleDays >= rainAfter) return { kind: 'rain', reason: `No activity for ${idleDays} days` };
  return { kind: 'clear', reason: 'Healthy activity' };
}

// ---------------------------------------------------------------- repositories
const NAME_RULES = [
  [/bot|auto|action|cron|scrap|news|crawl|pipeline|alert|notif/i, 'tower'],
  [/doc|note|wiki|fact|learn|study|course|book|quiz|knowledge|cheat|tutorial/i, 'library'],
  [/\blab|lab\b|research|science|experiment|\bml\b|\bai\b|notebook|analy/i, 'lab'], // V2: research building
  [/data|dataset|ml|model|\bai\b|analy|notebook|mining/i, 'mine'],
  [/api|server|backend|tool|cli|lib|sdk|util|engine|framework|plugin/i, 'workshop'],
  [/portfolio|site|web|page|landing|blog|profile|frontend|ui\b|app/i, 'guild'],
];
const ARCHETYPE_ALIAS = { shop: 'guild', research: 'lab', fort: 'castle' };
export function archetypeFor(repo, cfg) {
  const over = {};
  for (const [k, v] of Object.entries(cfg.buildings || {})) over[normName(k)] = v;
  const hit = over[normName(repo.name)];
  if (hit) return ARCHETYPE_ALIAS[hit] || hit;
  const text = `${repo.name} ${(repo.topics || []).join(' ')} ${repo.description || ''}`;
  for (const [re, kind] of NAME_RULES) if (re.test(repo.name) || re.test(text)) return kind;
  return 'house';
}
export function workflowStatus(runs, now, excluded = []) {
  const ok = (r) => !excluded.includes(r.name) && ['success', 'failure', 'timed_out', 'startup_failure'].includes(r.conclusion) && daysSince(r.at, now) <= 30;
  const recent = (runs || []).filter(ok);
  if (!recent.length) return { status: 'none', success: 0, failed: 0, total: 0, recoveredRecently: false, recoveredAt: null, lastFailAt: null };
  const byWf = new Map();
  for (const r of recent) { if (!byWf.has(r.wf)) byWf.set(r.wf, []); byWf.get(r.wf).push(r); }
  let failing = false, recovered = false, recoveredRecently = false, recoveredAt = null, lastFailAt = null;
  for (const list of byWf.values()) {
    const sorted = [...list].sort((a, b) => new Date(b.at) - new Date(a.at));
    if (sorted[0].conclusion !== 'success') { failing = true; lastFailAt = sorted[0].at; }
    else if (sorted.some((r) => r.conclusion !== 'success')) {
      recovered = true;
      if (daysSince(sorted[0].at, now) <= 2) { recoveredRecently = true; if (!recoveredAt || sorted[0].at > recoveredAt) recoveredAt = sorted[0].at; }
    }
  }
  const success = recent.filter((r) => r.conclusion === 'success').length;
  return { status: failing ? 'failing' : recovered ? 'recovered' : 'passing', success, failed: recent.length - success, total: recent.length, recoveredRecently, recoveredAt, lastFailAt };
}
export function repoState(r, wf, now) {
  if (r.archived) return 'abandoned';
  if (wf.status === 'failing') return 'failing';
  const d = daysSince(r.pushedAt, now);
  if (d <= 3) return 'building';
  if (d <= 30) return 'active';
  if (d <= 120) return 'sleepy';
  return 'dusty';
}
export const importance = (r, now) =>
  r.stars * 4 + r.forks * 3 + r.openIssues + (r.recentCommits || 0) * 1.5 + (daysSince(r.pushedAt, now) <= 30 ? 5 : 0) + Math.min(10, (r.size || 0) / 1000);

// ---------------------------------------------------------------- small formulas
export const population = ({ repos, stars, forks, followers, yearContrib, level, visitors }) =>
  60 + repos * 22 + stars * 9 + forks * 14 + followers * 6 + Math.floor(yearContrib / 4) + level * 10 + visitors * 3;
export const goblinTier = (n) => (n <= 0 ? 'none' : n <= 2 ? 'small' : n <= 5 ? 'group' : n <= 10 ? 'raid' : 'boss');
export const treasureTier = (stars) => (stars <= 0 ? 'empty' : stars < 10 ? 'small' : stars < 50 ? 'medium' : stars < 150 ? 'large' : stars < 500 ? 'huge' : 'mountain');
export const castleTier = (level) => (level < 5 ? 1 : level < 10 ? 2 : level < 20 ? 3 : 4);
export const codePower = (xp30) => clamp(Math.round(100 * (1 - Math.exp(-xp30 / 400))), 0, 99);
export function heroActivity(today, yesterday, cfg) {
  const score = today + yesterday * 0.5;
  if (score < 1) return 'low';
  if (today >= cfg.activity.highPerDay) return 'high';
  return 'normal';
}
export const STAR_MILESTONES = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 5000];
