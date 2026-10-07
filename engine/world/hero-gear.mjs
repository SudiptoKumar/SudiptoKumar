// TRUE V3 Hero equipment (V3 §8). Original equipment names and visuals,
// derived from level/achievements, not invented as GitHub facts.
//
// Equipment tiers unlock by level:
//   1+:  Traveler's Cloak
//   5+:  Kingdom Blade
//   10+: Git-forged Hammer
//   15+: Signal Bow
//   20+: Archive Staff
//   25+: Guardian Cloak (upgraded)
//   30+: Legendary Regalia

export const EQUIPMENT = [
  { minLevel: 1,  id: 'cloak',    name: "Traveler's Cloak",  visual: 'cloak' },
  { minLevel: 5,  id: 'blade',    name: 'Kingdom Blade',     visual: 'sword' },
  { minLevel: 10, id: 'hammer',   name: 'Git-forged Hammer', visual: 'hammer' },
  { minLevel: 15, id: 'bow',      name: 'Signal Bow',        visual: 'bow' },
  { minLevel: 20, id: 'staff',    name: 'Archive Staff',     visual: 'staff' },
  { minLevel: 25, id: 'gcloak',   name: 'Guardian Cloak',    visual: 'gcloak' },
  { minLevel: 30, id: 'regalia',  name: 'Legendary Regalia', visual: 'crown' },
];

/**
 * Equipment for a hero at given level.
 * Returns array of unlocked equipment items.
 */
export function equipmentFor(level = 1) {
  return EQUIPMENT.filter((e) => level >= e.minLevel);
}

/**
 * Companion for a hero. Deterministic by hero ID.
 * Types: fox, owl, raven, bot, spirit.
 */
export function companionFor(heroId = 'hero', level = 1) {
  if (level < 8) return null;  // companion unlocks at level 8
  const types = ['fox', 'owl', 'raven', 'bot', 'spirit'];
  // Deterministic: hash hero ID to pick type
  let h = 0;
  for (const c of String(heroId)) h = (h * 31 + c.charCodeAt(0)) % 997;
  const type = types[h % types.length];
  return {
    type,
    name: { fox: 'Ember', owl: 'Sage', raven: 'Ink', bot: 'Bolt', spirit: 'Wisp' }[type],
    // Follows hero with offset (deterministic)
    offsetX: 6, offsetY: 4,
  };
}
