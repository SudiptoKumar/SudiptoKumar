// Normalized state builder (adapted from prior state.mjs).
// GitHub snapshot (+ persisted store for last-known values) -> the canonical
// domain state that buildWorld consumes. Per-section failure isolation:
// a failed API section never poisons the rest (spec §06.12).
import { DAY_BANDS, SEASONS, WEATHER } from '../world/constants.mjs';
import { applyPartialFailure, sanitizeTitle } from './mapping.mjs';

const inEnum = (v, list, fallback) => (list.includes(v) ? v : fallback);

/**
 * @param {object} args
 * @param {object} args.snap  raw collected snapshot: {user, repos, issues, ci, releases,
 *                            contributions, achievements, visitors, hero, events, time, failedSections?}
 * @param {object} args.config kingdom config (defaults applied by engine/config.mjs)
 * @param {object} args.prev  previous normalized state (for last-known values)
 * @param {string|number} args.now ISO timestamp or Date; only used to stamp, never inside RNG
 */
export function buildNormalizedState({ snap = {}, config = {}, prev = null, now = null } = {}) {
  const failed = new Set(snap.failedSections ?? []);
  const keep = (key, build) => {
    if (failed.has(key)) return applyPartialFailure(key, { lastKnown: prev?.[key] ?? null });
    try {
      const v = build();
      return { ...v, status: v.status ?? 'known' };
    } catch {
      return applyPartialFailure(key, { lastKnown: prev?.[key] ?? null });
    }
  };

  const state = {
    version: '3',
    seed: String(snap.seed ?? config.worldSeed ?? 'kingdom'),
    generatedAt: now ? new Date(now).toISOString() : null,
    kingdom: {
      name: String(snap.kingdomName ?? config.displayName ?? 'Kingdom'),
      powerTier: String(snap.powerTier ?? 'town'),
      owner: String(snap.owner ?? config.owner ?? ''),
    },
    repos: keep('repos', () => ({
      list: (snap.repos ?? []).map(normalizeRepo),
    })),
    issues: keep('issues', () => ({
      open: num(snap.issues?.open), closed: num(snap.issues?.closed),
    })),
    ci: keep('ci', () => ({ status: String(snap.ci?.status ?? 'unknown') })),
    releases: keep('releases', () => ({
      list: (snap.releases ?? []).map((r) => ({ tag: String(r.tag ?? ''), name: String(r.name ?? '') })),
    })),
    pullRequests: keep('pullRequests', () => {
      const p = snap.pullRequests;
      // No PR data at all (offline fixture, old snapshot) or a malformed
      // section without an explicit 'known': honest unknown — never
      // fabricated as "no PRs" (INV-07). Failed section => neutral via keep().
      if (!p || typeof p !== 'object' || p.status !== 'known') {
        return { list: [], open: null, recentlyMerged: null, status: 'unknown' };
      }
      return {
        list: (p.list ?? []).map((x) => ({
          number: Math.max(0, Math.floor(Number(x.number ?? 0))),
          title: sanitizeTitle(x.title ?? ''),
          state: x.state === 'open' ? 'open' : 'merged',
          repo: String(x.repo ?? ''),
        })),
        open: num(p.open),
        recentlyMerged: num(p.recentlyMerged),
        status: 'known',
      };
    }),
    contributions: keep('contributions', () => ({
      activeDays: num(snap.contributions?.activeDays),
      streak: num(snap.contributions?.streak),
    })),
    achievements: keep('achievements', () => ({
      list: (snap.achievements ?? []).map((a) => ({ id: String(a.id ?? ''), title: String(a.title ?? ''), unlocked: !!a.unlocked })),
    })),
    visitors: keep('visitors', () => ({
      list: (snap.visitors ?? []).map((v) => ({ login: String(v.login ?? ''), kind: v.kind === 'raid' ? 'raid' : 'flag', message: v.message ?? null })),
    })),
    hero: snap.hero
      ? {
        name: String(snap.hero.name ?? 'Hero'),
        class: String(snap.hero.class ?? 'wanderer'),
        gearTier: Math.max(1, Math.min(7, Math.floor(Number(snap.hero.gearTier ?? 1)))),
        present: true,
      }
      : { present: false },
    events: {
      list: (snap.events ?? []).map((e) => ({
        id: String(e.id ?? ''), type: String(e.type ?? 'routine'),
        phase: inEnum(e.phase, ['ANNOUNCED', 'APPROACH', 'PEAK', 'AFTERMATH', 'RECOVERY', 'RESOLVED'], 'ANNOUNCED'),
        anchor: e.anchor ?? null,
      })),
    },
    time: {
      phase: inEnum(snap.time?.phase, DAY_BANDS, 'morning'),
      season: inEnum(snap.time?.season, SEASONS, 'spring'),
      weather: inEnum(snap.time?.weather, WEATHER, 'clear'),
    },
    war: { phase: snap.war?.phase ?? 'PEACE' },
  };
  return state;
}

const num = (v) => (v === null || v === undefined || Number.isNaN(Number(v)) ? null : Math.max(0, Math.floor(Number(v))));

function normalizeRepo(r) {
  return {
    id: String(r.id ?? r.name ?? ''),
    name: String(r.name ?? ''),
    fullName: String(r.fullName ?? r.name ?? ''),
    description: r.description ?? null,
    language: r.language ?? null,
    stars: num(r.stars) ?? 0,
    forks: num(r.forks) ?? 0,
    ageDays: num(r.ageDays),
    recentCommits: num(r.recentCommits) ?? 0,
    pushedDaysAgo: num(r.pushedDaysAgo),
    archived: !!r.archived,
    featured: !!r.featured,
    url: r.url ?? null,
  };
}
