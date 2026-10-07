// Achievements stay unlocked forever. Secret ones only show their name after they unlock.
import { hoursSince, partsIn } from './util.mjs';

export const ACHIEVEMENTS = [
  { id: 'first_blood', name: 'FIRST BLOOD', desc: 'First public repo', icon: 'sword', test: (c) => c.repoCount >= 1 },
  { id: 'builder', name: 'BUILDER', desc: '100 commits', icon: 'hammer', test: (c) => c.commits >= 100 },
  { id: 'master_builder', name: 'MASTER BUILDER', desc: '1,000 commits', icon: 'castle', major: true, test: (c) => c.commits >= 1000 },
  { id: 'streakkeeper', name: 'STREAKKEEPER', desc: '7 day streak', icon: 'wheat', test: (c) => c.longest >= 7 },
  { id: 'iron_streak', name: 'IRON STREAK', desc: '30 day streak', icon: 'shield', major: true, test: (c) => c.longest >= 30 },
  { id: 'night_coder', name: 'NIGHT CODER', desc: 'Code at night', icon: 'moon', test: (c) => c.nightPush },
  { id: 'ship_it', name: 'SHIP IT', desc: 'Publish a release', icon: 'rocket', test: (c) => c.releases >= 1 },
  { id: 'open_gate', name: 'OPEN GATE', desc: 'First issue talk', icon: 'flag', test: (c) => c.issueTalk },
  { id: 'architect', name: 'ARCHITECT', desc: '3 active repos', icon: 'house', test: (c) => c.activeRepos >= 3 },
  { id: 'boss_fight', name: 'BOSS FIGHT', desc: 'Solve a hard issue', icon: 'skull', major: true, test: (c) => c.hardIssue },
  { id: 'fire_fighter', name: 'FIRE FIGHTER', desc: 'Fix a failed workflow', icon: 'flame', test: (c) => c.fireFighter },
  { id: 'gold_rush', name: 'GOLD RUSH', desc: '10 stars', icon: 'coin', test: (c) => c.stars >= 10 },
  // secrets: the rules are not shown in the README
  { id: 'trifecta', name: 'THE TRIFECTA', desc: '100 commits, 7 streak, release', icon: 'crown', secret: true, major: true, test: (c) => c.commits >= 100 && c.longest >= 7 && c.releases >= 1 },
  { id: 'dawn_patrol', name: 'DAWN PATROL', desc: 'Code at sunrise', icon: 'sun', secret: true, test: (c) => c.dawnPush },
  { id: 'polyglot', name: 'POLYGLOT', desc: '8 languages', icon: 'book', secret: true, test: (c) => c.languages >= 8 },
  { id: 'centurion', name: 'CENTURION', desc: '100 day streak', icon: 'trophy', secret: true, major: true, test: (c) => c.longest >= 100 },
];

/** Looks at push times (UTC) in the owner's time zone. */
export function timeOfDayFlags(pushTimes, tz) {
  let nightPush = false, dawnPush = false;
  for (const t of pushTimes || []) {
    const h = partsIn(new Date(t), tz).h;
    if (h >= 22 || h < 5) nightPush = true;
    if (h >= 4 && h < 7) dawnPush = true;
  }
  return { nightPush, dawnPush };
}

export function evaluateAchievements({ ctx, stored, now, firstRun }) {
  const unlocked = { ...(stored?.unlocked || {}) };
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (unlocked[a.id] || !a.test(ctx)) continue;
    unlocked[a.id] = firstRun ? { at: now.toISOString(), baseline: true } : { at: now.toISOString() };
    if (!firstRun) fresh.push(a.id);
  }
  const list = ACHIEVEMENTS.map((a) => {
    const u = unlocked[a.id];
    const on = !!u;
    return {
      id: a.id,
      name: a.secret && !on ? '???' : a.name,
      desc: a.secret && !on ? 'SECRET' : a.desc,
      icon: a.icon, secret: !!a.secret, major: !!a.major, unlocked: on, at: u?.at || null,
      isNew: on && !u.baseline && hoursSince(u.at, now) < 48,
    };
  });
  const open = list.filter((a) => !a.secret);
  return {
    unlocked, fresh, list,
    count: list.filter((a) => a.unlocked).length, total: list.length,
    visibleUnlocked: open.filter((a) => a.unlocked).length, visibleTotal: open.length,
    secretUnlocked: list.filter((a) => a.secret && a.unlocked).length, secretTotal: list.length - open.length,
  };
}
