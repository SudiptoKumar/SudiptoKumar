// Quests (V2). A quest is a real goal that comes from real GitHub numbers. Nothing is invented.
//
//   LOCKED    the next rung of a ladder. Visible, greyed out.
//   ACTIVE    the goal you are working on now.
//   COMPLETE  done. Shown for 48 hours, then it leaves the HUD (the record stays in data/quests.json).
//
// Ladders (streak, stars) give XP once per rung. Repeatable quests (clear the gate, fix the CI, ship a release,
// start a project) give NO XP, so nobody can farm XP by opening and closing issues.
// On the first run every goal that is already met is saved as "baseline": no XP, no celebration.
import { STAR_MILESTONES } from './rules.mjs';
import { hoursSince } from './util.mjs';
import { mk, plusHours } from './events.mjs';

export const STREAK_RUNGS = [3, 7, 14, 30, 60, 100];
export const QUEST_ORDER = ['recover', 'gate', 'streak', 'release', 'build', 'stars'];
export const rungXp = (i) => Math.min(100, 20 + i * 20); // 20, 40, 60, 80, 100, 100 ...
const RECENT_HOURS = 48;
const pctOf = (a, b) => (b > 0 ? Math.max(0, Math.min(100, Math.round((100 * a) / b))) : 0);

export const KINGDOM_QUEST = { id: 'kingdom:alive', track: 'kingdom', title: 'KEEP THE KINGDOM ALIVE', icon: 'flag', state: 'ACTIVE', progress: 0, target: 0, pct: 0, xp: 0, at: null, isNew: false };

/**
 * ctx: { streak, stars, issuesOpen, issuesClosed, failing, workflowHealth, lastReleaseAgeH, newestRepoAgeH, date }
 * stored: data/quests.json   Returns the list, the new records, the XP total and the quest to show on the hero.
 */
export function evaluateQuests({ ctx, stored, now }) {
  const firstRun = !stored?.init;
  const done = { ...(stored?.done || {}) };
  const prevActive = new Set(stored?.active || []);
  const stamp = now.toISOString();
  const fresh = [];
  const list = [];
  const finish = (q) => {
    if (done[q.id]) return;
    done[q.id] = firstRun ? { at: stamp, baseline: true } : { at: stamp, xp: q.xp || 0 };
    if (!firstRun) fresh.push({ ...q, state: 'COMPLETE', isNew: true, at: stamp });
  };
  const recent = (id) => { const d = done[id]; return d && !d.baseline && hoursSince(d.at, now) < RECENT_HOURS ? d : null; };

  // ---- ladders: streak and stars
  const ladder = (track, rungs, value, titleOf, icon, unit) => {
    const make = (i, state) => {
      const t = rungs[i], id = `${track}:${t}`;
      return { id, track, title: titleOf(t), icon, state, progress: Math.min(value, t), target: t, pct: pctOf(value, t), xp: rungXp(i), unit, at: done[id]?.at || null, isNew: false };
    };
    rungs.forEach((t, i) => { if (value >= t) finish(make(i, 'COMPLETE')); });
    const next = rungs.findIndex((t, i) => !done[`${track}:${t}`]);
    // newest finished rung stays visible for 48 hours
    for (let i = rungs.length - 1; i >= 0; i--) {
      const d = recent(`${track}:${rungs[i]}`);
      if (d) { list.push({ ...make(i, 'COMPLETE'), progress: rungs[i], pct: 100, isNew: true }); break; }
    }
    if (next >= 0) {
      list.push(make(next, 'ACTIVE'));
      if (next + 1 < rungs.length) list.push({ ...make(next + 1, 'LOCKED'), progress: 0, pct: 0 });
    }
  };
  ladder('streak', STREAK_RUNGS, ctx.streak, (t) => `HOLD A ${t} DAY STREAK`, 'wheat', 'DAYS');
  ladder('stars', STAR_MILESTONES.slice(0, 8), ctx.stars, (t) => `EARN ${t} ${t === 1 ? 'STAR' : 'STARS'}`, 'star', 'STARS');

  // ---- repeatable: clear the gate (open issues) and fix the CI (failing workflows)
  const repeat = (track, openNow, makeActive, doneTitle, icon) => {
    const id = `${track}:open`;
    if (openNow) { list.push({ ...makeActive, id, track, icon, state: 'ACTIVE', xp: 0, at: null, isNew: false }); return id; }
    if (prevActive.has(id)) {
      const key = `${track}:${ctx.date}`;
      done[key] = firstRun ? { at: stamp, baseline: true } : { at: stamp, xp: 0 };
      if (!firstRun) fresh.push({ id: key, track, title: doneTitle, icon, state: 'COMPLETE', progress: 1, target: 1, pct: 100, xp: 0, at: stamp, isNew: true });
    }
    const hit = Object.keys(done).filter((k) => k.startsWith(`${track}:2`)).map((k) => [k, done[k]]).find(([, d]) => !d.baseline && hoursSince(d.at, now) < RECENT_HOURS);
    if (hit) list.push({ id: hit[0], track, title: doneTitle, icon, state: 'COMPLETE', progress: 1, target: 1, pct: 100, xp: 0, at: hit[1].at, isNew: true });
    return null;
  };
  const active = [];
  const g = repeat('gate', ctx.issuesOpen > 0, { title: `CLEAR ${ctx.issuesOpen} OPEN ${ctx.issuesOpen === 1 ? 'ISSUE' : 'ISSUES'}`, progress: ctx.issuesClosed, target: ctx.issuesClosed + ctx.issuesOpen, pct: pctOf(ctx.issuesClosed, ctx.issuesClosed + ctx.issuesOpen) }, 'THE GATE IS CLEAR', 'skull');
  const r = repeat('recover', ctx.failing > 0, { title: 'FIX THE FAILING CI', progress: ctx.workflowHealth ?? 0, target: 100, pct: ctx.workflowHealth ?? 0 }, 'THE CI IS FIXED', 'flame');
  if (g) active.push(g);
  if (r) active.push(r);

  // ---- silent ones: the release and the new project already have their own world events
  const quiet = (track, id, ageH, title, icon) => {
    if (ageH === null || ageH > 24 * 30) list.push({ id, track, title, icon, state: 'ACTIVE', progress: 0, target: 1, pct: 0, xp: 0, at: null, isNew: false });
    else if (ageH <= RECENT_HOURS) list.push({ id, track, title, icon, state: 'COMPLETE', progress: 1, target: 1, pct: 100, xp: 0, at: null, isNew: true });
  };
  quiet('release', 'release:month', ctx.lastReleaseAgeH, 'SHIP A RELEASE', 'rocket');
  quiet('build', 'build:month', ctx.newestRepoAgeH, 'START A NEW PROJECT', 'hammer');

  list.sort((a, b) => QUEST_ORDER.indexOf(a.track) - QUEST_ORDER.indexOf(b.track) || (a.state === b.state ? 0 : a.state === 'ACTIVE' ? -1 : a.state === 'COMPLETE' ? 1 : 2));
  const current = list.find((q) => q.state === 'ACTIVE') || KINGDOM_QUEST;

  // what the HUD shows: the goals in play, the newest win, the next rung. Three rows at most.
  const act = list.filter((q) => q.state === 'ACTIVE'), won = list.filter((q) => q.state === 'COMPLETE'), lock = list.filter((q) => q.state === 'LOCKED');
  const rows = [...act.slice(0, 2), ...won.slice(0, 1), ...lock.slice(0, 1), ...act.slice(2), ...won.slice(1)].slice(0, 3);

  // keep the save file small: old repeat records can go, ladder rungs stay forever
  const keys = Object.keys(done);
  if (keys.length > 120) for (const k of keys.sort((a, b) => (done[a].at < done[b].at ? -1 : 1))) { if (keys.length <= 100) break; if (!/^(streak|stars):/.test(k)) { delete done[k]; keys.splice(keys.indexOf(k), 1); } }

  const xp = Object.values(done).reduce((a, d) => a + (d.baseline ? 0 : d.xp || 0), 0);
  return {
    store: { version: 1, init: true, done, active },
    list, rows, current, fresh, xp,
    counts: { active: act.length, complete: Object.keys(done).length },
  };
}

/** World events for quests that were finished in this run. */
export const questEvents = (fresh, now) => fresh.filter((q) => q.xp > 0 || q.track === 'gate' || q.track === 'recover')
  .map((q) => mk('milestone', `quest:${q.id}`, q.title, now.toISOString(), plusHours(now.toISOString(), 48), 'QUEST COMPLETE'));
