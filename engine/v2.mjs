// The V2 layer. Takes a world state and adds everything V2 needs to draw it:
// repository levels, kingdom power, hero title, roles, quests (for old saves) and the scene.
// It only READS the state, so it can run again after the clock or the weather changes (render, demo, tests).
import { repoEvolution } from './evolution.mjs';
import { kingdomPower, heroTitle, heroRoles } from './power.mjs';
import { buildScene } from './scene.mjs';
import { evaluateQuests } from './quests.mjs';
import { buildWorld, WORLD_VERSION, RENDER_VERSION } from './world/index.mjs';
import { buildSimulation } from './world/simulation.mjs';
import { buildAnimationPlan } from './world/animation.mjs';
import { SIM_VERSION, ANIM_VERSION } from './world/constants.mjs';
import { daysSince, hoursSince, normName } from './util.mjs';

/** Old saves (V1) never stored commit counts. This guess is the importance formula run backwards. */
export function estimateCommits(r) {
  const guess = Math.max(0, Math.round(((r.importance || 0) - r.stars * 4 - (r.forks || 0) * 3 - (r.issues || 0) - ((r.pushedDays ?? 99) <= 30 ? 5 : 0)) / 1.5));
  return { commits90: guess, commits: guess };
}

/** Pick the repositories shown in the project districts. Your own list wins; otherwise the strongest buildings. */
export function pickFeatured(S, cfg = {}) {
  const wanted = Array.isArray(cfg.featured) ? cfg.featured.filter((n) => typeof n === 'string') : [];   // a wrong type in the config is ignored
  const live = S.repos.filter((r) => r.state !== 'abandoned' && normName(r.name) !== normName(S.profile?.login));
  const byName = new Map(live.map((r) => [normName(r.name), r]));
  const chosen = wanted.map((n) => byName.get(normName(n))).filter(Boolean);
  const rest = live.filter((r) => !chosen.includes(r) && r.archetype !== 'castle').sort((a, b) => b.evolution.score - a.evolution.score || b.importance - a.importance || (a.name < b.name ? -1 : 1));
  const n = Math.max(1, Math.min(8, Math.round(+cfg.featuredCount) || 5)), per = {}, out = [...chosen];
  chosen.forEach((r) => { per[r.archetype] = (per[r.archetype] || 0) + 1; });
  for (const r of rest) { if (out.length >= n) break; if ((per[r.archetype] || 0) < 2) { out.push(r); per[r.archetype] = (per[r.archetype] || 0) + 1; } }   // variety: at most two of a kind
  for (const r of rest) { if (out.length >= n) break; if (!out.includes(r)) out.push(r); }
  return out.slice(0, n).map((r) => r.name);
}

export function finalizeV2(S, { cfg = {}, store = null, now = new Date(S.generatedAt || 0) } = {}) {
  S.v = 2;
  // ---- repositories: one deterministic level each
  for (const r of S.repos) {
    if (r.commits90 === undefined) Object.assign(r, estimateCommits(r), { estimated: true });
    const age = daysSince(r.createdAt, now);       // exact age feeds the level ...
    r.ageDays = Math.floor(age);                   // ... but only whole days are saved, so the save file stays stable between runs
    r.releases = r.releases ?? 0;
    r.evolution = repoEvolution({ commits90: r.commits90, commits: r.commits, pushedDays: r.pushedDays, ageDays: age, releases: r.releases, stars: r.stars, forks: r.forks, state: r.state, workflow: r.workflow });
  }
  S.featured = pickFeatured(S, cfg);

  // ---- quests: normally evaluated while the state is built. Old saves get them here (not saved).
  if (!S.quests) {
    const rel = (S.events?.active || []).filter((e) => e.type === 'release').map((e) => hoursSince(e.at, now));
    const ctx = {
      streak: S.streak, stars: S.stars, issuesOpen: S.totals.issuesOpen, issuesClosed: S.totals.issuesClosed, failing: S.totals.failingRepos.length,
      workflowHealth: S.workflowHealth, lastReleaseAgeH: rel.length ? Math.min(...rel) : null,
      newestRepoAgeH: S.repos.length ? Math.min(...S.repos.map((r) => hoursSince(r.createdAt, now))) : null, date: S.time.date,
    };
    const q = evaluateQuests({ ctx, stored: JSON.parse(JSON.stringify(store?.quests || { init: true, done: {}, active: [] })), now });
    S.quests = { list: q.list, rows: q.rows, current: q.current, counts: q.counts, xp: q.xp };
  }

  // ---- power, title, roles
  const t = S.totals;
  S.power = kingdomPower({ level: S.level, streak: S.streak, workflowHealth: S.workflowHealth, stars: t.stars, forks: t.forks, followers: t.followers, activeRepos: t.activeRepos, repos: t.repos, issues: t.issuesOpen });
  const unlocked = new Set((S.achievements?.list || []).filter((a) => a.unlocked).map((a) => a.id));
  S.hero.title = heroTitle({ level: S.level, unlocked });
  S.hero.roles = heroRoles({ repos: S.repos, streak: S.streak, reliability: S.hero.stats.reliability, stars: t.stars, languages: (S.languages || []).length, issuesClosed: t.issuesClosed, visitors: S.visitors?.total || 0, unlocked, commits: t.commits });

  // ---- the scene decides the hero state
  S.scene = buildScene(S, now);
  S.hero.state = S.scene.hero.state;
  S.hero.spot = S.scene.hero.spot;
  S.hero.status = S.scene.hero.label;

  // ---- TRUE V2: the one authoritative world. Derived, never persisted.
  // Version stamps ride along so the content hash and --only safety can see them.
  S.worldVersion = WORLD_VERSION;
  S.renderVersion = RENDER_VERSION;
  S.world = buildWorld(S, { cfg, now });
  // ---- TRUE V3: the authoritative simulation. Derived from world + tick, never persisted.
  S.simVersion = SIM_VERSION;
  S.simulation = buildSimulation(S.world, { tick: now.getHours(), now });
  // ---- TRUE V3: the animation plan. Derived from world + simulation, never persisted.
  S.animVersion = ANIM_VERSION;
  S.animation = buildAnimationPlan(S.world, S.simulation);
  return S;
}
