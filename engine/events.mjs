// World events. Some come straight from today's data, some are remembered in data/events.json.
import { hoursSince, daysSince, clamp } from './util.mjs';
import { STAR_MILESTONES } from './rules.mjs';

export const EVENT_INFO = {
  raid: { title: 'BOSS RAID', icon: 'skull', rank: 0 },
  emergency: { title: 'WORKFLOW EMERGENCY', icon: 'flame', rank: 1 },
  recovery: { title: 'WORKFLOW RECOVERED', icon: 'check', rank: 2 },
  release: { title: 'RELEASE DAY', icon: 'rocket', rank: 3 },
  milestone: { title: 'MILESTONE UNLOCKED', icon: 'trophy', rank: 4 },
  expansion: { title: 'KINGDOM EXPANSION', icon: 'crown', rank: 5 },
  harvest: { title: 'HARVEST FESTIVAL', icon: 'wheat', rank: 6 },
  nightstars: { title: 'NIGHT OF THE STARS', icon: 'star', rank: 7 },
};

/**
 * V2 event pipeline. An event is not a text line: it changes the scene.
 *   event detected -> world state (mode) -> scene (effects) -> hero state -> lighting -> shown in the HUD
 *   -> the event ends at its `until` time and the world goes back to normal by itself.
 * scene.mjs reads this table. Nothing here is random.
 */
export const EVENT_FX = {
  raid: { mode: 'RAID', hero: 'fighting', light: 'danger', fx: ['goblins', 'battle', 'guards'] },
  emergency: { mode: 'DANGER', hero: 'working', light: 'danger', fx: ['alarm', 'smoke', 'fire'] },
  recovery: { mode: 'RECOVERY', hero: 'working', light: 'repair', fx: ['firefighter', 'repair', 'sparkles'] },
  release: { mode: 'CELEBRATION', hero: 'celebrating', light: 'celebrate', fx: ['castleLights', 'banner', 'confetti', 'fireworks'] },
  milestone: { mode: 'CELEBRATION', hero: 'celebrating', light: 'gold', fx: ['shrineGlow', 'confetti'] },
  expansion: { mode: 'WORKING', hero: 'working', light: null, fx: ['construction'] },
  harvest: { mode: 'HARVEST', hero: 'celebrating', light: 'gold', fx: ['harvestFestival', 'sparkles'] },
  nightstars: { mode: 'NIGHT', hero: null, light: 'stars', fx: ['shootingStars'] },
};
export const mk = (type, id, detail, at, until, title = null) => ({ id, type, title: title || EVENT_INFO[type].title, icon: EVENT_INFO[type].icon, detail, at, until });
export const plusHours = (iso, h) => new Date(new Date(iso).getTime() + h * 3600000).toISOString();

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
  return [...map.values()].filter((e) => hoursSince(e.at, now) < 24 * 30).sort((a, b) => cmp(b.at, a.at) || cmp(a.id, b.id)).slice(0, 60);
}

/** Events that we can read directly from the data. Nothing to remember. */
export function derivedEvents({ items, own, streak, cfg, issuesOpen, time, raid, now, active }) {
  const out = [];
  for (const r of own) {
    const rel = (r.releases || []).filter((x) => !x.prerelease)[0];
    if (rel && hoursSince(rel.at, now) <= 48) out.push(mk('release', `release:${r.name}:${rel.tag}`, `${r.name} ${rel.tag}`, rel.at, plusHours(rel.at, 48)));
    if (daysSince(r.createdAt, now) <= 7 && !r.archived) out.push(mk('expansion', `expansion:${r.name}`, r.name, r.createdAt, plusHours(r.createdAt, 24 * 7)));
  }
  for (const it of items) if (it.recoveredAt && it.workflow !== 'failing' && hoursSince(it.recoveredAt, now) < 48) out.push(mk('recovery', `recovery:${it.name}`, it.name, it.recoveredAt, plusHours(it.recoveredAt, 48)));
  for (const it of items) if (it.workflow === 'failing') out.push(mk('emergency', `emergency:${it.name}`, it.name, it.lastFailAt || now.toISOString(), plusHours(now.toISOString(), 1)));
  const big = Math.max(streak.today, streak.yesterday);
  if (big >= cfg.activity.festivalPerDay && streak.anchor) out.push(mk('harvest', `harvest:${streak.anchor}`, `${big} CONTRIBUTIONS`, `${streak.anchor}T12:00:00.000Z`, plusHours(`${streak.anchor}T12:00:00.000Z`, 40)));
  if (issuesOpen > 10) out.push(mk('raid', 'raid:boss', `${issuesOpen} OPEN ISSUES`, now.toISOString(), plusHours(now.toISOString(), 1)));
  if (raid?.active) out.push(mk('raid', `raid:visitor:${raid.id}`, `SENT BY @${raid.by}`, raid.at, plusHours(raid.at, 6)));
  if (time.phase === 'night' && [...out, ...active].some((e) => ['release', 'milestone', 'harvest'].includes(e.type))) out.push(mk('nightstars', `nightstars:${time.date}`, 'THE SKY IS FULL OF STARS', now.toISOString(), plusHours(now.toISOString(), 1)));
  return out;
}
const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
/** Strongest kind first, then newest, then by id. Events from the same moment always come in the same order. */
export const byRank = (a, b) => EVENT_INFO[a.type].rank - EVENT_INFO[b.type].rank || cmp(b.at, a.at) || cmp(a.id, b.id);

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
export const RAID_ENTER_MINUTES = 15;
/**
 * What the map shows about raids.
 *   active:  phase 'enter' (goblins walk in) then 'battle' (guards fight). Ends by itself after minVisibleMinutes.
 *   done:    phase 'won' or 'lost' for 12 hours.
 *   idle:    `available` is true when a visitor could send one now, false while the goblins rest.
 */
export function raidView(raids, defense, now, cfg = {}) {
  const list = raids || [];
  const rc = cfg.raids || {};
  const active = list.find((r) => r.status === 'active');
  if (active) {
    const size = RAID_SIZES[active.size] || RAID_SIZES.small;
    const mins = (now.getTime() - new Date(active.at).getTime()) / 60000;
    return { active: true, id: active.id, by: active.by, at: active.at, size: active.size, goblins: size.goblins, defense, attack: size.power, phase: mins < RAID_ENTER_MINUTES ? 'enter' : 'battle', available: false };
  }
  const done = [...list].reverse().find((r) => r.status === 'done' && hoursSince(r.resolvedAt, now) < 12);
  const last = list.length ? list[list.length - 1] : null;
  const cooldownLeftH = last && rc.cooldownHours ? Math.max(0, Math.round((rc.cooldownHours - hoursSince(last.at, now)) * 10) / 10) : 0;
  const available = rc.enabled !== false && cooldownLeftH <= 0;
  if (done) return { active: false, done: true, id: done.id, by: done.by, at: done.at, size: done.size, goblins: 0, defense: done.defense, attack: done.attack, won: done.won, phase: done.won ? 'won' : 'lost', available, cooldownLeftH };
  return { active: false, done: false, phase: 'idle', available, cooldownLeftH };
}
