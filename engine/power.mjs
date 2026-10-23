// Kingdom power, hero title and role badges (V2). All deterministic, all documented here.
import { clamp } from './util.mjs';

// ---------------------------------------------------------------- kingdom power (0-100)
//   progress     30 x (1 - e^(-level / 14))
//   consistency  20 x min(1, streak / 30)
//   reliability  20 x workflow health   (no workflows at all = 75 % credit)
//   reach        15 x (1 - e^(-(stars + 3 x forks + 2 x followers) / 40))
//   vitality     15 x active repositories / repositories
//   gate         minus 1 for every open issue (at most 10)
export function kingdomPower({ level, streak, workflowHealth, stars, forks, followers, activeRepos, repos, issues }) {
  const parts = {
    progress: 30 * (1 - Math.exp(-level / 14)),
    consistency: 20 * Math.min(1, streak / 30),
    reliability: 20 * ((workflowHealth ?? 75) / 100),
    reach: 15 * (1 - Math.exp(-(stars + 3 * forks + 2 * followers) / 40)),
    vitality: 15 * (activeRepos / Math.max(1, repos)),
    gate: -Math.min(10, Math.max(0, issues)),
  };
  const value = clamp(Math.round(Object.values(parts).reduce((a, b) => a + b, 0)), 0, 100);
  const rounded = Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, Math.round(v * 10) / 10]));
  return { value, parts: rounded };
}

// ---------------------------------------------------------------- hero title
// Level ladder. The rare CENTURION achievement (100 day streak) overrides it.
export const TITLE_LADDER = [[1, 'WANDERER'], [3, 'APPRENTICE'], [6, 'BUILDER'], [10, 'MASTER BUILDER'], [15, 'KINGDOM BUILDER'], [25, 'ARCHITECT'], [40, 'LEGEND']];
export function heroTitle({ level, unlocked = new Set() }) {
  if (unlocked.has('centurion')) return 'CENTURION';
  let t = TITLE_LADDER[0][1];
  for (const [from, name] of TITLE_LADDER) if (level >= from) t = name;
  return t;
}

// ---------------------------------------------------------------- role badges (up to 4, fixed priority)
export function heroRoles({ repos, streak, reliability, stars, languages, issuesClosed, visitors, unlocked = new Set(), commits }) {
  const roles = [];
  if (repos.some((r) => r.state === 'building') || commits >= 100) roles.push({ id: 'builder', icon: 'hammer' });
  if (streak >= 7) roles.push({ id: 'farmer', icon: 'wheat' });
  if (reliability >= 90) roles.push({ id: 'guardian', icon: 'shield' });
  if (stars >= 10) roles.push({ id: 'merchant', icon: 'coin' });
  if (repos.some((r) => r.archetype === 'library') || languages >= 4) roles.push({ id: 'scholar', icon: 'book' });
  if (unlocked.has('boss_fight') || issuesClosed >= 10) roles.push({ id: 'slayer', icon: 'skull' });
  if (visitors >= 1) roles.push({ id: 'host', icon: 'flag' });
  return roles.slice(0, 4);
}
