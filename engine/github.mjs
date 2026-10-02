// Talks to GitHub (GraphQL + REST) and returns one tidy "snapshot". No dependencies.
import { addDays, diffDays, ymd } from './util.mjs';

const API = 'https://api.github.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function makeIO(token) {
  let calls = 0;
  const headers = { Authorization: `Bearer ${token}`, 'User-Agent': 'kingdom-engine', Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  async function send(url, init, tries = 3) {
    for (let i = 0; i < tries; i++) {
      calls++;
      let res;
      try { res = await fetch(url, { ...init, headers: { ...headers, ...(init?.headers || {}) } }); } catch (e) { if (i === tries - 1) throw e; await sleep(800 * (i + 1)); continue; }
      if (res.status >= 500 || (res.status === 403 && res.headers.get('retry-after'))) {
        if (i === tries - 1) return res;
        await sleep(Math.min(8000, 1000 * (+res.headers.get('retry-after') || 2 ** i)));
        continue;
      }
      return res;
    }
  }
  return {
    get calls() { return calls; },
    async gql(query, variables = {}) {
      const res = await send(`${API}/graphql`, { method: 'POST', body: JSON.stringify({ query, variables }), headers: { 'Content-Type': 'application/json' } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}: ${json.message || ''}`);
      if (json.errors && !json.data) throw new Error(`GraphQL: ${json.errors.map((e) => e.message).join('; ')}`);
      return json;
    },
    async rest(path, init) {
      const res = await send(path.startsWith('http') ? path : API + path, init);
      let json = null;
      try { json = await res.json(); } catch { /* empty */ }
      return { status: res.status, ok: res.ok, json };
    },
    async bytes(url) {
      const res = await send(url, { headers: { Accept: 'image/*' } });
      if (!res.ok) return null;
      return { buf: Buffer.from(await res.arrayBuffer()), type: res.headers.get('content-type') || '' };
    },
  };
}

const Q_REPOS = `query($login:String!,$cursor:String,$since:GitTimestamp!){user(login:$login){
 login name avatarUrl createdAt followers{totalCount} following{totalCount}
 pullRequests(states:MERGED){totalCount}
 repositories(first:50,after:$cursor,ownerAffiliations:OWNER,privacy:PUBLIC,isFork:false,orderBy:{field:PUSHED_AT,direction:DESC}){
  pageInfo{hasNextPage endCursor}
  nodes{name url description stargazerCount forkCount isArchived isFork isEmpty createdAt pushedAt diskUsage
   primaryLanguage{name color}
   languages(first:8,orderBy:{field:SIZE,direction:DESC}){edges{size node{name color}}}
   openIssues:issues(states:OPEN){totalCount} closedIssues:issues(states:CLOSED){totalCount}
   openPRs:pullRequests(states:OPEN){totalCount} mergedPRs:pullRequests(states:MERGED){totalCount}
   repositoryTopics(first:8){nodes{topic{name}}}
   releases(first:3,orderBy:{field:CREATED_AT,direction:DESC}){totalCount nodes{tagName publishedAt isPrerelease isDraft}}
   defaultBranchRef{name target{... on Commit{history(since:$since){totalCount}}}}
  }}}}`;
const Q_YEARS = 'query($login:String!){user(login:$login){contributionsCollection{contributionYears}}}';
const Q_SEARCH = 'query($a:String!,$b:String!){a:search(query:$a,type:ISSUE,first:1){issueCount} b:search(query:$b,type:ISSUE,first:1){issueCount}}';
const yearBlock = (y, from, to) => `y${y}:contributionsCollection(from:"${from}",to:"${to}"){totalCommitContributions totalPullRequestContributions totalIssueContributions totalPullRequestReviewContributions contributionCalendar{weeks{contributionDays{date contributionCount}}}}`;

export function normalizeRepo(n) {
  const languages = {}, langColors = {};
  for (const e of n.languages?.edges || []) { languages[e.node.name] = e.size; langColors[e.node.name] = e.node.color; }
  const pl = n.primaryLanguage;
  if (pl) langColors[pl.name] = pl.color;
  const rel = (n.releases?.nodes || []).filter((r) => !r.isDraft && r.publishedAt).map((r) => ({ tag: r.tagName, at: r.publishedAt, prerelease: !!r.isPrerelease }));
  return {
    name: n.name, url: n.url, description: n.description || '', stars: n.stargazerCount, forks: n.forkCount, archived: n.isArchived, isFork: n.isFork,
    createdAt: n.createdAt, pushedAt: n.pushedAt || n.createdAt, size: n.isEmpty ? 0 : n.diskUsage || 1, language: pl?.name || Object.keys(languages)[0] || null,
    languages, langColors, openIssues: n.openIssues.totalCount, closedIssues: n.closedIssues.totalCount, openPRs: n.openPRs.totalCount, mergedPRs: n.mergedPRs.totalCount,
    recentCommits: n.defaultBranchRef?.target?.history?.totalCount || 0, topics: (n.repositoryTopics?.nodes || []).map((t) => t.topic.name),
    releases: rel, releaseCount: n.releases?.totalCount || 0, defaultBranch: n.defaultBranchRef?.name || 'main', runs: [],
  };
}
export function normalizeRuns(json, defaultBranch) {
  return (json?.workflow_runs || [])
    .filter((r) => !defaultBranch || r.head_branch === defaultBranch)
    .map((r) => ({ wf: r.workflow_id, name: r.name, conclusion: r.conclusion, at: r.updated_at || r.created_at }));
}
/** Join year calendars into one list with no missing days. */
export function joinCalendars(years) {
  const map = new Map();
  for (const y of years) for (const w of y.contributionCalendar?.weeks || []) for (const d of w.contributionDays) map.set(d.date, Math.max(map.get(d.date) || 0, d.contributionCount));
  const dates = [...map.keys()].sort();
  if (!dates.length) return [];
  const out = [];
  const total = diffDays(dates[0], dates[dates.length - 1]);
  for (let i = 0; i <= total; i++) { const date = addDays(dates[0], i); out.push({ date, count: map.get(date) || 0 }); }
  return out;
}

export async function collect({ io, login, cfg, now = new Date() }) {
  const errors = [];
  const since = new Date(now.getTime() - 90 * 86400000).toISOString();
  // 1. profile + repositories
  let user = null, nodes = [], cursor = null;
  for (let page = 0; page < 4; page++) {
    const { data } = await io.gql(Q_REPOS, { login, cursor, since });
    const u = data?.user;
    if (!u) throw new Error(`GitHub user "${login}" was not found`);
    user = user || u;
    nodes.push(...u.repositories.nodes.filter(Boolean));
    if (!u.repositories.pageInfo.hasNextPage) break;
    cursor = u.repositories.pageInfo.endCursor;
  }
  const repos = nodes.filter((n) => !cfg.excludeRepos.includes(n.name)).map(normalizeRepo);

  // 2. contributions per year
  let years = [], totals = { commits: 0, prs: 0, issues: 0, reviews: 0 };
  try {
    const ys = (await io.gql(Q_YEARS, { login })).data.user.contributionsCollection.contributionYears.sort((a, b) => b - a).slice(0, cfg.historyYears);
    const nowIso = now.toISOString().replace(/\.\d+Z$/, 'Z');
    const blocks = ys.map((y) => yearBlock(y, `${y}-01-01T00:00:00Z`, y === now.getUTCFullYear() ? nowIso : `${y}-12-31T23:59:59Z`)).join(' ');
    const { data } = await io.gql(`query($login:String!){user(login:$login){${blocks}}}`, { login });
    years = ys.map((y) => data.user[`y${y}`]).filter(Boolean);
    for (const y of years) {
      totals.commits += y.totalCommitContributions; totals.prs += y.totalPullRequestContributions;
      totals.issues += y.totalIssueContributions; totals.reviews += y.totalPullRequestReviewContributions;
    }
  } catch (e) { errors.push(`contributions: ${e.message}`); }
  const calendar = joinCalendars(years);

  // 3. a hard issue (5 or more comments) that is closed
  let hard = false;
  try {
    const { data } = await io.gql(Q_SEARCH, { a: `user:${login} is:issue is:closed comments:>=5`, b: `author:${login} is:issue is:closed comments:>=5` });
    hard = (data.a.issueCount || 0) + (data.b.issueCount || 0) > 0;
  } catch (e) { errors.push(`search: ${e.message}`); }

  // 4. workflow runs (public repositories only, most recently pushed first)
  const withRuns = repos.filter((r) => !r.archived && r.size > 0).slice(0, 30);
  let next = 0;
  await Promise.all(Array.from({ length: 5 }, async () => {
    while (next < withRuns.length) {
      const r = withRuns[next++];
      try {
        const res = await io.rest(`/repos/${login}/${encodeURIComponent(r.name)}/actions/runs?per_page=30&status=completed`);
        if (res.ok) r.runs = normalizeRuns(res.json, r.defaultBranch);
      } catch (e) { errors.push(`runs ${r.name}: ${e.message}`); }
    }
  }));

  // 5. when did the owner push? (for night and sunrise achievements)
  const pushTimes = [];
  try {
    for (let page = 1; page <= 3; page++) {
      const res = await io.rest(`/users/${login}/events/public?per_page=100&page=${page}`);
      if (!res.ok || !Array.isArray(res.json) || !res.json.length) break;
      for (const ev of res.json) if (ev.type === 'PushEvent') pushTimes.push(ev.created_at);
    }
  } catch (e) { errors.push(`events: ${e.message}`); }

  return {
    source: 'github', fetchedAt: now.toISOString(), apiCalls: io.calls, errors,
    user: { login: user.login, name: user.name || user.login, avatarUrl: user.avatarUrl, createdAt: user.createdAt, followers: user.followers.totalCount, following: user.following.totalCount },
    repos, calendar, totals: { ...totals, mergedPrs: user.pullRequests.totalCount }, hardIssueClosed: hard, pushTimes,
  };
}
export { ymd };
