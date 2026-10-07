// Achievements derived deterministically from a GitHub snapshot
// (spec §06.10). Pure: same snapshot => same list. Only *unlocked*
// achievements reach the world; locked ones stay abstract (no leaked
// details). Titles are plain strings; they are sanitized by the
// mapping layer before they ever touch the world.
const RULES = [
  { id: 'first-hall', title: 'First Hall Raised', test: (s) => s.repos.length >= 1 },
  { id: 'builder-5', title: 'Five Halls', test: (s) => s.repos.length >= 5 },
  { id: 'builder-25', title: 'Quarter Century of Halls', test: (s) => s.repos.length >= 25 },
  { id: 'hundred-stars', title: 'Hundred Stars', test: (s) => s.totalStars >= 100 },
  { id: 'thousand-stars', title: 'Thousand Stars', test: (s) => s.totalStars >= 1000 },
  { id: 'polyglot', title: 'Polyglot', test: (s) => s.languages >= 5 },
  { id: 'week-warrior', title: 'Week Warrior', test: (s) => s.streak >= 7 },
  { id: 'month-warrior', title: 'Month Warrior', test: (s) => s.streak >= 30 },
  { id: 'shipper', title: 'Royal Shipper', test: (s) => s.releases >= 1 },
  { id: 'veteran', title: 'Old Stone Veteran', test: (s) => s.oldestAgeDays >= 365 * 3 },
  { id: 'dungeon-keeper', title: 'Dungeon Keeper', test: (s) => s.openIssues >= 10 },
  { id: 'green-fields', title: 'Green Fields', test: (s) => s.activeDays >= 200 },
];

/** @param {object} snap collected snapshot (repos, contributions, releases, issues) */
export function deriveAchievements(snap = {}) {
  const repos = snap.repos ?? [];
  const signals = {
    repos,
    totalStars: repos.reduce((a, r) => a + (Number(r.stars) || 0), 0),
    languages: [...new Set(repos.map((r) => String(r.language ?? '').toLowerCase()))].filter(Boolean).length,
    streak: Number(snap.contributions?.streak) || 0,
    releases: (snap.releases ?? []).length,
    oldestAgeDays: repos.reduce((m, r) => Math.max(m, Number(r.ageDays) || 0), 0),
    openIssues: Number(snap.issues?.open) || 0,
    activeDays: Number(snap.contributions?.activeDays) || 0,
  };
  return RULES.filter((rule) => {
    try { return !!rule.test(signals); } catch { return false; }
  }).map((rule) => ({ id: rule.id, title: rule.title, unlocked: true }));
}
