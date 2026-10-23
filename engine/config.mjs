// Settings. Your own values live in kingdom.config.json. Everything else has a safe default.
import fs from 'node:fs';
import path from 'node:path';

export const DEFAULTS = {
  owner: '',
  repo: '',
  branch: 'main',
  displayName: '',
  timezone: 'UTC',
  hemisphere: 'north', // use "south" for seasons in the southern half of the world
  dayHours: {}, // optional: { dawn, day, evening, night } start hours
  excludeRepos: [],
  excludeWorkflows: [],
  buildings: {}, // repo name -> castle | tower | guild | library | workshop | mine | house
  repoCards: 6, // V1 setting, no longer used (repositories are buildings in the world now)
  featured: [], // V2: repository names to show in the project districts. Empty = the best ones are chosen
  featuredCount: 5,
  links: [], // V2: guild banners at the end of the page: [{ id, label, url }]
  quests: { enabled: true },
  historyYears: 8,
  inactivity: { sleepAfterDays: 3, rainAfterDays: 7 },
  activity: { highPerDay: 8, festivalPerDay: 12 },
  cropSteps: [1, 3, 6, 10, 15],
  xp: {
    commitTiers: [[5, 10], [10, 4], [1e9, 0]], // first 5 per day = 10 XP, next 10 = 4 XP, then 0
    dayCap: 120,
    streakFrom: 3,
    streakCap: 30,
    pr: [[20, 50], [80, 25], [1e9, 10]],
    mergedPr: [[20, 100], [80, 50], [1e9, 20]],
    issueClosed: [[30, 25], [70, 12], [1e9, 5]],
    release: [[10, 250], [1e9, 100]],
    newRepo: [[15, 300], [1e9, 100]],
  },
  visitors: {
    enabled: true,
    minAccountAgeDays: 7,
    maxPerDay: 15,
    maxTotal: 200,
    showOnMap: 12,
    showInList: 6,
    blocked: [],
    bannedWords: [],
  },
  raids: {
    enabled: true,
    cooldownHours: 6,
    perUserPerDay: 1,
    minVisibleMinutes: 45,
    minAccountAgeDays: 7,
  },
};

function merge(base, extra) {
  if (Array.isArray(base) || Array.isArray(extra)) return extra ?? base;
  if (base && typeof base === 'object' && extra && typeof extra === 'object') {
    const out = { ...base };
    for (const k of Object.keys(extra)) out[k] = merge(base[k], extra[k]);
    return out;
  }
  return extra === undefined ? base : extra;
}

export function loadConfig(root = process.cwd(), env = process.env) {
  let user = {};
  const file = path.join(root, 'kingdom.config.json');
  if (fs.existsSync(file)) {
    try { user = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { throw new Error(`kingdom.config.json is not valid JSON: ${e.message}`); }
  }
  const cfg = merge(DEFAULTS, user);
  const [envOwner, envRepo] = String(env.GITHUB_REPOSITORY || '').split('/');
  cfg.owner = cfg.owner || env.GITHUB_REPOSITORY_OWNER || envOwner || '';
  cfg.repo = cfg.repo || envRepo || cfg.owner;
  cfg.root = root;
  return cfg;
}

export const rawUrl = (cfg, file) => `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch}/${file}`;
export const repoUrl = (cfg) => `https://github.com/${cfg.owner}/${cfg.repo}`;
