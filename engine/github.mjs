// GitHub snapshot collector (live side of `update`). Zero dependencies:
// uses the global fetch (Node >= 20). Every API section is isolated —
// one failing section is recorded in snap.failedSections and never
// poisons the others (spec §06.12). No token => callers use the offline
// fixture instead; this module is only called when GH_TOKEN is present.
const API = 'https://api.github.com';
const TIMEOUT_MS = 20_000;

const headers = (token) => ({
  'User-Agent': 'kingdom-v3',
  Accept: 'application/vnd.github+json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

async function getJson(url, token, key, failedSections) {
  try {
    const res = await fetch(url, { headers: headers(token), signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    failedSections.push(key);
    return null;
  }
}

const daysAgo = (iso, now) => {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now - t) / 86_400_000));
};

function normalizeRepo(r, now) {
  return {
    id: String(r.id ?? r.name ?? ''),
    name: String(r.name ?? ''),
    fullName: String(r.full_name ?? r.name ?? ''),
    description: r.description ?? null,
    language: r.language ?? null,
    stars: Number(r.stargazers_count) || 0,
    forks: Number(r.forks_count) || 0,
    ageDays: daysAgo(r.created_at, now),
    recentCommits: null, // unknown via REST without per-repo calls; pushedDaysAgo is the honest signal
    pushedDaysAgo: daysAgo(r.pushed_at, now),
    archived: !!r.archived,
    featured: false,
    url: r.html_url ?? null,
  };
}

/** Derive CI status from the latest workflow runs of the profile repo. */
function ciStatusFromRuns(runs) {
  if (!runs || !Array.isArray(runs.workflow_runs) || !runs.workflow_runs.length) return 'unknown';
  const list = runs.workflow_runs.slice(0, 5);
  const latest = list[0];
  if (['in_progress', 'queued', 'waiting', 'requested'].includes(latest.status)) return 'warning';
  const conclusions = list.map((r) => r.conclusion).filter(Boolean);
  if (latest.conclusion === 'success') {
    // a success after recent failures reads as recovering (lock: repair state)
    return conclusions.slice(1).includes('failure') ? 'recovering' : 'healthy';
  }
  if (latest.conclusion === 'failure') return 'failing';
  return 'unknown';
}

/** Contributions approximated from the last ~90 days of public events. */
function contributionsFromEvents(events, now) {
  if (!events || !Array.isArray(events)) return null;
  const days = new Set();
  for (const e of events) {
    if (e.type !== 'PushEvent') continue;
    const d = daysAgo(e.created_at, now);
    if (d !== null && d <= 365) days.add(d);
  }
  const sorted = [...days].sort((a, b) => a - b);
  let streak = 0;
  for (const d of sorted) { if (d === streak) streak++; else if (d > streak) break; }
  return { activeDays: sorted.length, streak, windowDays: 90, approximate: true };
}

const CLASS_FROM_LANGUAGE = {
  typescript: 'warden', javascript: 'warden', python: 'druid', go: 'scout',
  rust: 'smith', java: 'knight', ruby: 'bard', php: 'merchant', swift: 'ranger',
  kotlin: 'ranger', 'c++': 'siege-engineer', c: 'siege-engineer', shell: 'pathfinder',
};

// ------------------------------------------------------------------
// Pull requests -> courier network (spec §06.2: "Pull requests | courier
// network"). Bounded and honest: at most PR_REPOS_LIMIT repos (most
// recently pushed first), PRS_PER_REPO pulls each, PR_TOTAL_LIMIT pulls
// total. Recent = open, or closed-but-merged within PR_MERGED_WINDOW_DAYS.
// Per-repo failure isolation: a single repo failing never breaks the
// others (the failing repo is recorded as pullRequests:<repo> while the
// section itself stays healthy); only total failure marks the section
// 'pullRequests' failed (=> unknown => neutral couriers downstream).
// Returns null on total failure; {list, open, recentlyMerged, ...} else.
// ------------------------------------------------------------------
const PR_REPOS_LIMIT = 5;
const PRS_PER_REPO = 10;
const PR_TOTAL_LIMIT = 20;
const PR_MERGED_WINDOW_DAYS = 30;

export async function fetchPullRequests({ token, owner, repos = [], now = Date.now(), failedSections = [] } = {}) {
  const top = [...repos]
    .sort((a, b) => (a.pushedDaysAgo ?? 9999) - (b.pushedDaysAgo ?? 9999))
    .slice(0, PR_REPOS_LIMIT);
  if (!top.length) {
    // an account with no repos honestly has no PRs — not a failure
    return { list: [], open: 0, recentlyMerged: 0, status: 'known', reposChecked: 0 };
  }
  const out = [];
  let ok = 0;
  for (const r of top) {
    const name = String(r.fullName ?? r.name ?? '').split('/')[1] ?? r.name;
    if (!name) continue;
    const data = await getJson(
      `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/pulls?state=all&per_page=${PRS_PER_REPO}&sort=updated&direction=desc`,
      token, `pullRequests:${name}`, failedSections,
    );
    if (!Array.isArray(data)) continue; // per-repo isolation: keep going
    ok++;
    for (const pr of data) {
      if (out.length >= PR_TOTAL_LIMIT) break;
      const mergedDays = daysAgo(pr.merged_at, now);
      const recentlyMerged = pr.merged_at != null && mergedDays !== null && mergedDays <= PR_MERGED_WINDOW_DAYS;
      if (pr.state === 'open' || recentlyMerged) {
        out.push({
          number: Number(pr.number) || 0,
          title: String(pr.title ?? ''),
          state: pr.state === 'open' ? 'open' : 'merged',
          repo: name,
        });
      }
    }
    if (out.length >= PR_TOTAL_LIMIT) break;
  }
  if (!ok) {
    failedSections.push('pullRequests');
    return null;
  }
  return {
    list: out,
    open: out.filter((p) => p.state === 'open').length,
    recentlyMerged: out.filter((p) => p.state === 'merged').length,
    status: 'known',
    reposChecked: ok,
  };
}

function heroFrom(user, repos) {
  const langs = {};
  for (const r of repos) {
    const l = String(r.language ?? '').toLowerCase();
    if (l) langs[l] = (langs[l] ?? 0) + (r.stars ?? 0) + 1;
  }
  const top = Object.entries(langs).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  return {
    name: String(user?.name ?? user?.login ?? 'Hero').slice(0, 40),
    class: CLASS_FROM_LANGUAGE[top] ?? 'wanderer',
    gearTier: Math.max(1, Math.min(7, 1 + Math.floor(Math.log10(1 + repos.reduce((a, r) => a + (r.stars ?? 0), 0))))),
    present: true,
  };
}

/**
 * Collect a raw GitHub snapshot for `owner`. Never throws for a single
 * section: failures land in snap.failedSections.
 * @returns {Promise<object>} snap ready for buildNormalizedState
 */
export async function fetchSnapshot({ token, owner, config = {} }) {
  const now = Date.now();
  const failedSections = [];
  const snap = {
    seed: `github-${owner}`,
    kingdomName: String(config.displayName ?? 'Kingdom'),
    owner,
    powerTier: String(config.powerTier ?? 'town'),
    failedSections,
    fetchedAt: new Date(now).toISOString(),
    provenance: 'github-api',
  };

  const user = await getJson(`${API}/users/${encodeURIComponent(owner)}`, token, 'user', failedSections);
  const reposRaw = await getJson(`${API}/users/${encodeURIComponent(owner)}/repos?per_page=100&type=owner&sort=pushed`, token, 'repos', failedSections);
  const repos = Array.isArray(reposRaw) ? reposRaw.map((r) => normalizeRepo(r, now)) : [];

  // open issue count across the account (search API returns total_count)
  const issueSearch = await getJson(
    `${API}/search/issues?q=${encodeURIComponent(`user:${owner} type:issue state:open`)}&per_page=1`,
    token, 'issues', failedSections);

  // CI: workflow runs on the profile repo (owner/owner) when it exists
  const runs = await getJson(`${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(owner)}/actions/runs?per_page=5`, token, 'ci', failedSections);

  // latest release across the 5 most-starred repos
  const topRepos = [...repos].sort((a, b) => b.stars - a.stars).slice(0, 5);
  const releases = [];
  for (const r of topRepos) {
    const name = r.fullName.split('/')[1] ?? r.name;
    const rel = await getJson(`${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/releases?per_page=1`, token, 'releases', failedSections);
    if (Array.isArray(rel) && rel[0]) {
      releases.push({ tag: String(rel[0].tag_name ?? ''), name: String(rel[0].name ?? rel[0].tag_name ?? '') });
    }
  }
  releases.sort();

  const events = await getJson(`${API}/users/${encodeURIComponent(owner)}/events/public?per_page=100`, token, 'contributions', failedSections);

  // PR activity -> courier network intensity (spec §06.2). Bounded, with
  // per-repo failure isolation; a failed section degrades to neutral.
  const pullRequests = await fetchPullRequests({ token, owner, repos, now, failedSections });

  snap.repos = repos;
  snap.issues = { open: issueSearch?.total_count ?? null, closed: null };
  snap.ci = { status: ciStatusFromRuns(runs) };
  snap.releases = releases.slice(0, 5);
  if (pullRequests) snap.pullRequests = pullRequests;
  snap.contributions = contributionsFromEvents(events, now) ?? { activeDays: null, streak: null };
  snap.achievements = []; // derived by the caller via deriveAchievements
  snap.visitors = [];     // merged from data/visitors.json by the caller
  snap.hero = heroFrom(user, repos);
  snap.time = timeNow(config);
  snap.war = { phase: 'PEACE' };
  return snap;
}

/** Current day band / season from the wall clock (stamping only, never RNG). */
export function timeNow(config = {}) {
  const d = new Date();
  const hour = d.getHours();
  const phase = hour < 5 ? 'night' : hour < 7 ? 'dawn' : hour < 11 ? 'morning'
    : hour < 15 ? 'noon' : hour < 18 ? 'afternoon' : hour < 20 ? 'sunset'
    : hour < 22 ? 'evening' : 'night';
  const month = d.getMonth();
  const northern = (config.hemisphere ?? 'northern') === 'northern';
  const season = month < 2 || month === 11 ? (northern ? 'winter' : 'summer')
    : month < 5 ? (northern ? 'spring' : 'autumn')
    : month < 8 ? (northern ? 'summer' : 'winter')
    : (northern ? 'autumn' : 'spring');
  return { phase, season, weather: 'clear' };
}
