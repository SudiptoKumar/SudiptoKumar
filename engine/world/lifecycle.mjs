// Repository lifecycle (8 visual states) and kingdom power tier (5 visual levels). Pure functions of the saved state.
//
// repo.state (rules.mjs) answers "how fresh is the last push?"  The lifecycle adds the history of the building:
//   foundation   a young project, stones and scaffolds
//   building     pushed in the last 3 days, builders on site
//   active       pushed in the last 30 days
//   flourishing  a mature project (level 4+) with heavy recent work: annex, garden, banners
//   sleepy       quiet for 30+ days (dust and cobwebs after 120)
//   failing      CI is red: smoke, alarm
//   recovering   CI was just repaired: scaffolds and repair crews
//   abandoned    archived: ruins

export const LIFECYCLE = Object.freeze(['foundation', 'building', 'active', 'flourishing', 'sleepy', 'failing', 'recovering', 'abandoned']);

export function repoLifecycle(repo) {
  const level = repo.evolution?.level || 1;
  if (repo.state === 'abandoned') return 'abandoned';
  if (repo.state === 'failing' || repo.workflow === 'failing') return 'failing';
  if (repo.recovered) return 'recovering';
  if (repo.state === 'sleepy' || repo.state === 'dusty') return 'sleepy';
  if ((repo.ageDays ?? 9999) <= 21 && level <= 2) return 'foundation';
  if (level >= 4 && (repo.commits90 || 0) >= 30) return 'flourishing';
  return repo.state === 'building' ? 'building' : 'active';
}
/** 0 = fresh, 1 = sleepy (quiet), 2 = dusty (forgotten). Drives dust, cobwebs and vines. */
export const repoNeglect = (repo) => (repo.state === 'dusty' ? 2 : repo.state === 'sleepy' ? 1 : 0);

// ---------------------------------------------------------------- kingdom power tier
export const TIERS = Object.freeze([
  { index: 0, id: 'village',    name: 'STRUGGLING VILLAGE',  min: 0 },
  { index: 1, id: 'settlement', name: 'GROWING SETTLEMENT',  min: 21 },
  { index: 2, id: 'kingdom',    name: 'ESTABLISHED KINGDOM', min: 41 },
  { index: 3, id: 'prosperous', name: 'PROSPEROUS KINGDOM',  min: 61 },
  { index: 4, id: 'legendary',  name: 'LEGENDARY KINGDOM',   min: 81 },
]);

/** What each tier looks like. The map reads this table; nothing else decides what a richer kingdom looks like. */
export const TIER_STYLE = Object.freeze([
  { roads: 'dirt',   lamps: 0, banners: 0, flowers: 0,  plaza: 'well',     stalls: 0, villagers: 0.6,  crown: false, glow: 0 },
  { roads: 'dirt',   lamps: 2, banners: 0, flowers: 0,  plaza: 'well',     stalls: 1, villagers: 0.85, crown: false, glow: 0 },
  { roads: 'gravel', lamps: 4, banners: 2, flowers: 4,  plaza: 'well',     stalls: 2, villagers: 1,    crown: false, glow: 0 },
  { roads: 'cobble', lamps: 6, banners: 4, flowers: 8,  plaza: 'fountain', stalls: 3, villagers: 1.3,  crown: false, glow: 0.5 },
  { roads: 'paved',  lamps: 8, banners: 6, flowers: 12, plaza: 'statue',   stalls: 4, villagers: 1.6,  crown: true,  glow: 1 },
]);

export function kingdomTier(power) {
  const v = Math.max(0, Math.min(100, Math.round(Number.isFinite(power) ? power : 0)));
  let t = TIERS[0];
  for (const x of TIERS) if (v >= x.min) t = x;
  return { ...t, value: v, style: TIER_STYLE[t.index] };
}
