// GitHub cause -> world-data effect (lock §7, spec §06).
// Every function here produces WORLD DATA (not visuals) and is pure +
// deterministic. `unknown` inputs are NEVER coerced to success/failure:
// they come out as {status:'unknown'} / neutral descriptors.
import { ARCHETYPES, BUILDING_LIFECYCLE } from '../world/constants.mjs';
import { hash32, truncate } from '../util.mjs';
import { sanitizeMessage } from '../validation/safety.mjs';

// ------------------------------------------------------------------
// repos -> building archetype (spec §06.3 order:
// 1. config mapping, 2. recognized keywords, 3. language/domain rules,
// 4. deterministic fallback). Stable for the same repo + config.
// ------------------------------------------------------------------
export const repoKey = (repo) =>
  String(repo.fullName ?? repo.name ?? repo.id ?? '').toLowerCase();

const KEYWORD_ARCHETYPES = [
  [/docs?|wiki|guide|handbook/i, 'library'],
  [/action|workflow|ci\b|bot|automat/i, 'fortress'],
  [/game|quest|rpg/i, 'guild_hall'],
  [/market|shop|store|commerce/i, 'market_hall'],
  [/data|science|ml\b|ai\b|model/i, 'laboratory'],
  [/api|server|backend|service/i, 'tower'],
  [/cli|tool|util|script|kit/i, 'workshop'],
  [/site|web|blog|portfolio|frontend/i, 'observatory'],
  [/farm|garden|crop|harvest/i, 'farmhouse'],
  [/bank|vault|treasury|coin/i, 'warehouse'],
  [/forge|craft|build/i, 'forge'],
  [/temple|shrine|chapel/i, 'shrine'],
];

const LANGUAGE_FLAVOR = {
  javascript: 'timber-frame', typescript: 'timber-frame', python: 'stone-cottage',
  go: 'steel-frame', rust: 'iron-hall', java: 'granite-tower', ruby: 'brick-house',
  php: 'plaster-house', 'c++': 'foundry', c: 'foundry', swift: 'glass-spire',
  kotlin: 'glass-spire', shell: 'shed', html: 'signpost', css: 'painted-facade',
};

export function archetypeOf(repo, config = {}) {
  const key = repoKey(repo);
  const overrides = config.archetypeOverrides ?? {};
  if (overrides[key] && ARCHETYPES.includes(overrides[key])) {
    return { archetype: overrides[key], reason: 'config' };
  }
  const text = `${repo.name ?? ''} ${repo.description ?? ''}`;
  for (const [re, arch] of KEYWORD_ARCHETYPES) {
    if (re.test(text)) return { archetype: arch, reason: 'keyword' };
  }
  const lang = String(repo.language ?? '').toLowerCase();
  // language drives *flavor* (spec §06.2), not the archetype itself
  const flavor = LANGUAGE_FLAVOR[lang] ?? 'local-style';
  const pool = ARCHETYPES.filter((a) => !['castle', 'monument', 'gate', 'wall', 'dock'].includes(a));
  const archetype = pool[hash32(key || 'unnamed') % pool.length];
  return { archetype, reason: 'fallback', flavor };
}

// ------------------------------------------------------------------
// issues -> dungeon pressure tiers (spec §06.5). Thresholds configurable.
// ------------------------------------------------------------------
export const DEFAULT_PRESSURE_THRESHOLDS = { watchful: 1, active: 4, crowded: 11, crisis: 21 };
export function dungeonPressure(openIssues, thresholds = DEFAULT_PRESSURE_THRESHOLDS) {
  if (openIssues === null || openIssues === undefined || Number.isNaN(Number(openIssues))) {
    return { tier: 'unknown', count: null, status: 'unknown', goblins: 0 };
  }
  const n = Math.max(0, Math.floor(Number(openIssues)));
  const tier =
    n >= thresholds.crisis ? 'crisis' :
    n >= thresholds.crowded ? 'crowded' :
    n >= thresholds.active ? 'active' :
    n >= thresholds.watchful ? 'watchful' : 'dormant';
  const goblins = tier === 'dormant' ? 0 : tier === 'watchful' ? 2 : tier === 'active' ? 5 : tier === 'crowded' ? 9 : 14;
  return { tier, count: n, status: 'known', goblins };
}

// ------------------------------------------------------------------
// CI -> Automation Fortress state (spec §06.7).
// ------------------------------------------------------------------
const CI_STATES = ['healthy', 'warning', 'failing', 'recovering', 'unknown'];
export function fortressState(ciStatus) {
  const s = CI_STATES.includes(ciStatus) ? ciStatus : 'unknown';
  const physical = {
    healthy: { beacon: 'steady-green', smoke: 'light', alarm: false, engineers: 0 },
    warning: { beacon: 'amber-pulse', smoke: 'light', alarm: false, engineers: 1 },
    failing: { beacon: 'red-alarm', smoke: 'heavy', alarm: true, engineers: 3 },
    recovering: { beacon: 'amber-steady', smoke: 'none', alarm: false, engineers: 2, scaffolding: true },
    unknown: { beacon: 'neutral-dim', smoke: 'none', alarm: false, engineers: 0 },
  }[s];
  return { state: s, status: s === 'unknown' ? 'unknown' : 'known', ...physical };
}

// ------------------------------------------------------------------
// pullRequests -> courier intensity (spec §06.2: "Pull requests | courier
// network"). QUALITATIVE ONLY: none / trickle / active / surge. The
// precise PR count never reaches visuals — the courier network has one
// physical vocabulary (routine runs / occasional runs / document runs /
// surge) driven by this tier. Unknown input stays neutral: intensity
// 'unknown' (messengers fall back to their quiet routine, never fake
// activity). Last-known ('stale') still drives, per failure policy.
// ------------------------------------------------------------------
// Formula (documented in docs/WORLD.md — no fake data rule):
//   active = open + merged-within-30d
//   0 -> none, 1-2 -> trickle, 3-7 -> active, 8+ -> surge
export const PR_INTENSITY_LEVELS = ['none', 'trickle', 'active', 'surge'];
const PR_INTENSITY_THRESHOLDS = { trickle: 1, active: 3, surge: 8 };
export function courierIntensity(pullRequests, thresholds = PR_INTENSITY_THRESHOLDS) {
  const status = pullRequests?.status;
  if (status !== 'known' && status !== 'stale') {
    return { intensity: 'unknown', status: 'unknown', provenance: 'neutral' };
  }
  const active =
    Math.max(0, Math.floor(Number(pullRequests.open ?? 0))) +
    Math.max(0, Math.floor(Number(pullRequests.recentlyMerged ?? 0)));
  const intensity =
    active >= thresholds.surge ? 'surge' :
    active >= thresholds.active ? 'active' :
    active >= thresholds.trickle ? 'trickle' : 'none';
  return {
    intensity, status,
    provenance: status === 'stale' ? 'last-known' : 'github-api',
  };
}

// ------------------------------------------------------------------
// releases -> royal announcement descriptors (spec §06.8).
// ------------------------------------------------------------------
export function releaseEvents(releases) {
  if (!Array.isArray(releases)) return { events: [], status: 'unknown' };
  const events = releases.slice(0, 5).map((r, i) => ({
    id: `release-${truncate(String(r.tag ?? r.id ?? i), 24)}`,
    type: 'release',
    title: sanitizeTitle(r.name ?? r.tag ?? 'release'),
    anchor: 'royal_plaza',
    secondaryAnchor: 'castle',
    phase: 'ANNOUNCED',
    severity: 'celebration',
    status: 'known',
  }));
  return { events, status: 'known' };
}

// ------------------------------------------------------------------
// contributions -> farm state (spec §06.9).
// ------------------------------------------------------------------
export function farmState(contributions) {
  if (!contributions || typeof contributions !== 'object') {
    return { maturity: 'unknown', activeFields: 0, status: 'unknown' };
  }
  const activeDays = Math.max(0, Math.floor(Number(contributions.activeDays ?? 0)));
  const streak = Math.max(0, Math.floor(Number(contributions.streak ?? 0)));
  const maturity =
    activeDays >= 200 ? 'harvest' :
    activeDays >= 90 ? 'mature' :
    activeDays >= 30 ? 'growing' :
    activeDays >= 7 ? 'sprouting' : 'fallow';
  return {
    maturity,
    activeFields: Math.min(12, Math.floor(activeDays / 14)),
    streakMarker: streak >= 7, // glowing maintained-field marker (lock §7; C5)
    status: 'known',
  };
}

// ------------------------------------------------------------------
// achievements -> Hall of Heroes entries (spec §06.10).
// Locked achievements stay abstract: no secret detail leaks.
// ------------------------------------------------------------------
export function hallEntries(achievements) {
  if (!Array.isArray(achievements)) return { entries: [], status: 'unknown' };
  const kinds = ['statue', 'banner', 'plaque', 'trophy', 'monument'];
  const entries = achievements
    .filter((a) => a && a.unlocked)
    .map((a, i) => ({
      id: `achievement-${truncate(String(a.id ?? i), 24)}`,
      kind: kinds[hash32(String(a.id ?? i)) % kinds.length],
      title: sanitizeTitle(a.title ?? 'achievement'),
      anchor: 'hall_of_heroes',
      status: 'known',
    }));
  return { entries, status: 'known' };
}

// ------------------------------------------------------------------
// visitors -> harbor / visitor-camp entries (spec §06.11).
// Hostile or malicious visitor text is sanitized; rejected text never
// reaches the world, but the visitor's *presence* is still recorded.
// ------------------------------------------------------------------
export function visitorEntries(visitors, { bannedWords = [] } = {}) {
  if (!Array.isArray(visitors)) return { entries: [], status: 'unknown' };
  const entries = visitors.map((v, i) => {
    const clean = sanitizeMessage(v?.message, { bannedWords, max: 48 });
    const login = safeLogin(v?.login) || `traveler-${i}`;
    return {
      id: `visitor-${truncate(login, 24)}`,
      login,
      kind: v?.kind === 'raid' ? 'raid' : 'flag',
      message: clean.ok ? clean.text : null,
      messageRejected: clean.ok ? null : clean.reason,
      anchor: 'harbor_docks',
      campAnchor: 'visitor_camp',
      status: 'known',
    };
  });
  return { entries, status: 'known' };
}

/** Defense in depth: world-data logins are GitHub-login-shaped, always. */
function safeLogin(raw) {
  const s = String(raw ?? 'traveler').toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '').slice(0, 39);
  return s || 'traveler';
}

// ------------------------------------------------------------------
// repo -> building lifecycle (lock §5 / §14 C4, 11 states).
// ------------------------------------------------------------------
export function buildingLifecycleFor(repo, signals = {}) {
  if (!repo) return 'empty';
  // archived repo with fresh pushes is under repair (lock recovery story:
  // scaffolding + repair crews); an untouched archive sleeps.
  if (repo.archived) return signals.recentPush ? 'repairing' : 'sleepy';
  if (repo.isNew || (repo.ageDays ?? 9999) < 30) return 'foundation';
  if (signals.recentPush || (repo.recentCommits ?? 0) > 0) return 'construction';
  if (signals.upgrading) return 'upgrading';
  if ((repo.stars ?? 0) >= 100 || signals.featured) return 'flourishing';
  if (signals.damaged) return 'damaged';
  if (signals.repairing) return 'repairing';
  if ((repo.recentCommits ?? 0) === 0 && (repo.ageDays ?? 0) > 365) return 'abandoned';
  if ((repo.recentCommits ?? 0) === 0 && (repo.ageDays ?? 0) > 90) return 'sleepy';
  return 'active';
}
export function assertLifecycle(s) {
  if (!BUILDING_LIFECYCLE.includes(s)) throw new Error(`unknown lifecycle state: ${s}`);
  return s;
}

// ------------------------------------------------------------------
// partial API failure: per-section isolation. A failed section keeps its
// last known value when policy allows, otherwise goes visibly neutral.
// ------------------------------------------------------------------
export function applyPartialFailure(section, { lastKnown = null, allowLastKnown = true } = {}) {
  if (allowLastKnown && lastKnown !== null && lastKnown !== undefined) {
    return { ...lastKnown, status: 'stale', provenance: 'last-known' };
  }
  return { status: 'unknown', provenance: 'neutral' };
}

/** Visitor/hostile text never reaches world data raw. */
export function sanitizeTitle(raw) {
  const clean = sanitizeMessage(raw, { max: 64 });
  return clean.ok ? clean.text : 'untitled';
}
