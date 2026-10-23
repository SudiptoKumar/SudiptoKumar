// Repository evolution (V2). One deterministic 0-100 score per repository, built only from data
// the collector already reads. Same repository data in = same level out. No randomness, no clock.
//
//   score = activity(30) + recency(20) + maturity(15) + depth(15) + release(10) + reputation(10)
//           - 15 when the workflow is failing, then capped by how quiet the project is.
//
//   activity    commits in the last 90 days x 1.5            (20 commits = full marks)
//   recency     pushed <=3d 20, <=14d 15, <=30d 10, <=90d 5, <=180d 2, older 0
//   maturity    age in days / 20                              (300 days = full marks)
//   depth       log2(1 + all commits) x 2.2                   (about 100 commits = full marks)
//   release     releases x 5                                  (2 releases = full marks)
//   reputation  stars x 2 + forks x 3                         (5 stars = full marks)
//
//   caps        archived 9, dusty 27, sleepy 47  (a quiet project can never be a landmark)
//   levels      1 FOUNDATION  <12   2 FRAME  <28   3 BUILDING  <48   4 SPECIALIZED  <72   5 LANDMARK
//   age rule    nothing skips construction: younger than 1 day = level 1, younger than 3 days = at most 2, younger than 7 = at most 3
export const EVOLUTION_LEVELS = [
  { level: 1, name: 'FOUNDATION', from: 0 },
  { level: 2, name: 'FRAME', from: 12 },
  { level: 3, name: 'BUILDING', from: 28 },
  { level: 4, name: 'SPECIALIZED', from: 48 },
  { level: 5, name: 'LANDMARK', from: 72 },
];
const CAPS = { abandoned: 9, dusty: 27, sleepy: 47 };
const AGE_CAPS = [[1, 1], [3, 2], [7, 3]]; // [younger than N days, highest level]

export function repoEvolution(r) {
  const c90 = Math.max(0, r.commits90 || 0);
  const total = Math.max(r.commits || 0, c90);
  const pd = r.pushedDays ?? 999;
  const parts = {
    activity: Math.min(30, c90 * 1.5),
    recency: pd <= 3 ? 20 : pd <= 14 ? 15 : pd <= 30 ? 10 : pd <= 90 ? 5 : pd <= 180 ? 2 : 0,
    maturity: Math.min(15, Math.max(0, r.ageDays || 0) / 20),
    depth: Math.min(15, Math.log2(1 + total) * 2.2),
    release: Math.min(10, (r.releases || 0) * 5),
    reputation: Math.min(10, (r.stars || 0) * 2 + (r.forks || 0) * 3),
  };
  let score = parts.activity + parts.recency + parts.maturity + parts.depth + parts.release + parts.reputation;
  if (r.workflow === 'failing' || r.state === 'failing') score -= 15;
  const cap = CAPS[r.state];
  if (cap !== undefined) score = Math.min(score, cap);
  score = Math.max(0, Math.min(100, Math.round(score)));
  let level = 1;
  for (const l of EVOLUTION_LEVELS) if (score >= l.from) level = l.level;
  let capped = cap !== undefined && score >= cap ? 'state' : null;
  const age = r.ageDays ?? 999;
  for (const [days, top] of AGE_CAPS) if (age < days) { if (level > top) capped = 'age'; level = Math.min(level, top); break; }
  const next = EVOLUTION_LEVELS.find((l) => l.level === level + 1);
  return { level, name: EVOLUTION_LEVELS[level - 1].name, score, toNext: next ? Math.max(0, next.from - score) : 0, capped, parts: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, Math.round(v)])) };
}
