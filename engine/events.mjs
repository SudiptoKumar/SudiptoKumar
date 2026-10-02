// World events. Some come straight from today's data, some are remembered in data/events.json.
import { hoursSince, daysSince, clamp } from './util.mjs';
import { STAR_MILESTONES } from './rules.mjs';

export const EVENT_INFO = {
  raid: { title: 'BOSS RAID', icon: 'skull', rank: 0 },
  emergency: { title: 'WORKFLOW EMERGENCY', icon: 'flame', rank: 1 },
  release: { title: 'RELEASE DAY', icon: 'rocket', rank: 2 },
  milestone: { title: 'MILESTONE UNLOCKED', icon: 'trophy', rank: 3 },
  expansion: { title: 'KINGDOM EXPANSION', icon: 'crown', rank: 4 },
  harvest: { title: 'HARVEST FESTIVAL', icon: 'wheat', rank: 5 },
  nightstars: { title: 'NIGHT OF THE STARS', icon: 'star', rank: 6 },
};
const mk = (type, id, detail, at, until) => ({ id, type, title: EVENT_INFO[type].title, icon: EVENT_INFO[type].icon, detail, at, until });
const plusHours = (iso, h) => new Date(new Date(iso).getTime() + h * 3600000).toISOString();

/** One-time events found by comparing with the last run. */
export function newMilestones({ prev, level, stars, fresh, names, now }) {
  const out = [];
  const at = now.toISOString();
  const until = plusHours(at, 48);
  if (prev) {
    if (level > (prev.level || 0)) out.push(mk('milestone', `levelup:${level}`, `LEVEL ${level}`, at, until));
    for (const m of STAR_MILESTONES) if ((prev.stars ?? 0) < m && stars >= m) out.push(mk('milestone', `stars:${m}`, `${m} STARS`, at, until));
  }
  for (const id of fresh) out.push(mk('milestone', `ach:${id}`, names[id] || id, at, until));
  return out;
}
export function mergeEvents(list, add, now) {
  const map = new Map((list || []).map((e) => [e.id, e]));
  for (const e of add) if (!map.has(e.id)) map.set(e.id, e);
  return [...map.values()].filter((e) => hoursSince(e.at, now) < 24 * 30).sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 60);
}

/** Events that we can read directly from the data. Nothing to remember. */
export function derivedEvents({ items, own, streak, cfg, issuesOpen, time, raid, now, active }) {
  const out = [];
  for (const r of own) {
    const rel = (r.releases || []).filter((x) => !x.prerelease)[0];
    if (rel && hoursSince(rel.at, now) <= 48) out.push(mk('release', `release:${r.name}:${rel.tag}`, `${r.name} ${rel.tag}`, rel.at, plusHours(rel.at, 48)));
    if (daysSince(r.createdAt, now) <= 7 && !r.archived) out.push(mk('expansion', `expansion:${r.name}`, r.name, r.createdAt, plusHours(r.createdAt, 24 * 7)));
  }
  for (const it of items) if (it.workflow === 'failing') out.push(mk('emergency', `emergency:${it.name}`, it.name, it.lastFailAt || now.toISOString(), plusHours(now.toISOString(), 1)));
  const big = Math.max(streak.today, streak.yesterday);
  if (big >= cfg.activity.festivalPerDay && streak.anchor) out.push(mk('harvest', `harvest:${streak.anchor}`, `${big} CONTRIBUTIONS`, `${streak.anchor}T12:00:00.000Z`, plusHours(`${streak.anchor}T12:00:00.000Z`, 40)));
  if (issuesOpen > 10) out.push(mk('raid', 'raid:boss', `${issuesOpen} OPEN ISSUES`, now.toISOString(), plusHours(now.toISOString(), 1)));
  if (raid?.active) out.push(mk('raid', `raid:visitor:${raid.id}`, `SENT BY @${raid.by}`, raid.at, plusHours(raid.at, 6)));
  if (time.phase === 'night' && [...out, ...active].some((e) => ['release', 'milestone', 'harvest'].includes(e.type))) out.push(mk('nightstars', `nightstars:${time.date}`, 'THE SKY IS FULL OF STARS', now.toISOString(), plusHours(now.toISOString(), 1)));
  return out;
}
export const byRank = (a, b) => EVENT_INFO[a.type].rank - EVENT_INFO[b.type].rank || (a.at < b.at ? 1 : -1);

// ---------------------------------------------------------------- visitor raids
export const RAID_SIZES = { small: { goblins: 3, power: 30 }, medium: { goblins: 6, power: 55 }, large: { goblins: 9, power: 80 } };
export const kingdomDefense = ({ level, reliability, streak }) => clamp(Math.round(40 + level * 2 + reliability * 0.3 + Math.min(streak, 30)), 0, 100);

/** A raid is shown for at least a few minutes. The next update after that ends it. */
export function resolveRaids(raids, defense, cfg, now) {
  return (raids || []).map((r) => {
    if (r.status === 'active' && (now.getTime() - new Date(r.at).getTime()) / 60000 >= cfg.raids.minVisibleMinutes) {
      const power = RAID_SIZES[r.size]?.power ?? 40;
      return { ...r, status: 'done', resolvedAt: now.toISOString(), defense, attack: power, won: defense >= power };
    }
    return r;
  }).slice(-20);
}
export function raidView(raids, defense, now) {
  const active = (raids || []).find((r) => r.status === 'active');
  if (active) {
    const size = RAID_SIZES[active.size] || RAID_SIZES.small;
    return { active: true, id: active.id, by: active.by, at: active.at, size: active.size, goblins: size.goblins, defense, attack: size.power };
  }
  const done = [...(raids || [])].reverse().find((r) => r.status === 'done' && hoursSince(r.resolvedAt, now) < 12);
  if (done) return { active: false, done: true, id: done.id, by: done.by, at: done.at, size: done.size, goblins: 0, defense: done.defense, attack: done.attack, won: done.won };
  return { active: false, done: false };
}
