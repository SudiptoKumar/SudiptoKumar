// TRUE V2 world constants. Version stamps and shared tiers.
//
//   WORLD_VERSION   bump when the shape of the World object changes
//                   (a new field, a removed field, a changed meaning).
//   RENDER_VERSION  bump when any renderer changes its output bytes
//                   (new art, moved pixels, changed text). The content hash
//                   includes it, so a renderer change always regenerates
//                   the pictures instead of reporting "nothing changed".
export const WORLD_VERSION = 1;
export const RENDER_VERSION = 2;   // Phase 3: renderers became world cameras (hero/event/camp/castle/dungeon), quest strip slimmed

/** Kingdom power tiers (TRUE V2 §7/§12). The tier must change the visible world, not just a number. */
export const POWER_TIERS = [
  { max: 20, id: 'village', name: 'STRUGGLING VILLAGE' },
  { max: 40, id: 'settlement', name: 'GROWING SETTLEMENT' },
  { max: 60, id: 'kingdom', name: 'ESTABLISHED KINGDOM' },
  { max: 80, id: 'prosperous', name: 'PROSPEROUS KINGDOM' },
  { max: 100, id: 'legendary', name: 'LEGENDARY KINGDOM' },
];
export const powerTier = (value) => POWER_TIERS.find((t) => (value ?? 0) <= t.max) || POWER_TIERS[POWER_TIERS.length - 1];

/** Visitor camp states (TRUE V2 §15/§20). Driven by the approved visitor count. */
export const CAMP_STATES = ['EMPTY', 'CAMP', 'VILLAGE', 'FESTIVAL'];
export const campStateFor = (total) => (total <= 0 ? 'EMPTY' : total < 5 ? 'CAMP' : total < 12 ? 'VILLAGE' : 'FESTIVAL');

/** Event choreography phases (TRUE V2 §15). Every major event moves through these. */
export const EVENT_PHASES = ['START', 'PEAK', 'AFTERMATH', 'EXPIRED'];
