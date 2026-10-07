// TRUE V3 Resource economy (V3 §5). Visual RPG resources derived from REAL GitHub
// signals. Never invented, always documented.
//
// RESOURCE FORMULAS (all 0-100):
//   GOLD:        stars + forks + followers (recognition)
//     formula: 100 * (1 - exp(-(stars + 2*forks + followers) / 100))
//   MATERIALS:   commits + active repos (building activity)
//     formula: 100 * (activeRepos / max(1, repos)) * min(1, commits/500)
//   KNOWLEDGE:   language diversity + docs repos (learning)
//     formula: 100 * min(1, languages/8) * 0.5 + 100 * (docsRepos / max(1, repos)) * 0.5
//   REPUTATION:  achievements + releases + streak (honor)
//     formula: 100 * min(1, (achievements + 2*releases + streak/30) / 20)
//   WAR_SUPPLIES: issues + failing workflows (problem pressure)
//     formula: 100 * min(1, (issues + 3*failing) / 30)
//
// Visual levels: 0-20: empty, 21-40: low, 41-60: medium, 61-80: high, 81-100: full.

/**
 * Compute resource levels from state totals.
 * Returns { gold, materials, knowledge, reputation, warSupplies } (0-100).
 */
export function resourcesFor(totals = {}) {
  const stars = totals.stars || 0;
  const forks = totals.forks || 0;
  const followers = totals.followers || 0;
  const repos = totals.repos || 1;
  const activeRepos = totals.activeRepos || 0;
  const commits = totals.commits || 0;
  const languages = totals.languages || 1;
  const docsRepos = totals.docsRepos || 0;
  const achievements = totals.achievements || 0;
  const releases = totals.releases || 0;
  const streak = totals.streak || 0;
  const issues = totals.issuesOpen || 0;
  const failing = (totals.failingRepos || []).length;

  const gold = Math.round(100 * (1 - Math.exp(-(stars + 2 * forks + followers) / 100)));
  const materials = Math.round(100 * (activeRepos / Math.max(1, repos)) * Math.min(1, commits / 500));
  const knowledge = Math.round(50 * Math.min(1, languages / 8) + 50 * (docsRepos / Math.max(1, repos)));
  const reputation = Math.round(100 * Math.min(1, (achievements + 2 * releases + streak / 30) / 20));
  const warSupplies = Math.round(100 * Math.min(1, (issues + 3 * failing) / 30));

  return {
    gold: Math.min(100, Math.max(0, gold)),
    materials: Math.min(100, Math.max(0, materials)),
    knowledge: Math.min(100, Math.max(0, knowledge)),
    reputation: Math.min(100, Math.max(0, reputation)),
    warSupplies: Math.min(100, Math.max(0, warSupplies)),
  };
}

/** Visual level name for a resource value. */
export function resourceLevel(value = 0) {
  if (value <= 20) return 'empty';
  if (value <= 40) return 'low';
  if (value <= 60) return 'medium';
  if (value <= 80) return 'high';
  return 'full';
}
