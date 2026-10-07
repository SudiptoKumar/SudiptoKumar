// Canonical constants. EVERY numeric/enum fact comes from data/world-lock.json —
// modules must read from here, never re-type lock values.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const LOCK_PATH = join(HERE, '..', '..', 'data', 'world-lock.json');
export const LOCK = JSON.parse(readFileSync(LOCK_PATH, 'utf8'));

// --- geography ---
export const WORLD_W = LOCK.bounds.w; // 2048
export const WORLD_H = LOCK.bounds.h; // 1536
export const TILE = LOCK.tileUnits; // 16 svg units
export const PROJECTION = LOCK.projection; // three-quarter-orthographic

// --- versions (content hash covers all of these) ---
export const VERSIONS = { ...LOCK.versions };
export const WORLD_SCHEMA_VERSION = String(VERSIONS.WORLD_SCHEMA_VERSION);
export const SIM_VERSION = VERSIONS.SIM_VERSION;
export const RENDER_VERSION = VERSIONS.RENDER_VERSION;
export const ART_VERSION = VERSIONS.ART_VERSION;
export const CAMERA_VERSION = VERSIONS.CAMERA_VERSION;
export const ANIM_VERSION = VERSIONS.ANIM_VERSION;

// --- budgets (spec §09.15; enforced by engine/validation/visual-budget.mjs) ---
export const BUDGETS = { ...LOCK.budgets };
// BUDGETS: { svgHardCeilingKiB: 600, svgDesignTargetKiB: 450,
//            grandWorldMobileKiB: 200, readmeTotalMiB: 6 }

// --- enums from the lock ---
export const ARCHETYPES = [...LOCK.archetypes];
export const BUILDING_LIFECYCLE = [...LOCK.buildingLifecycle];
export const DAY_BANDS = [...LOCK.dayBands];
export const SEASONS = [...LOCK.seasons];
export const WEATHER = [...LOCK.weather];
export const WAR_PHASES = [...LOCK.warPhases];
export const EVENT_PHASES = [...LOCK.eventPhases];
export const DISTRICTS = LOCK.districts.map((d) => ({ ...d }));
export const ROAD_NODES = LOCK.roadNodes.map((n) => ({ ...n }));
export const ROAD_EDGES = LOCK.roadEdges.map((e) => ({ ...e }));
export const CAMERAS = LOCK.cameras.map((c) => ({ ...c }));
export const ACTOR_ROLES = LOCK.actorRoles.map((r) => ({ ...r }));
export const EXPANSION_RESERVES = LOCK.expansionReserves.map((r) => ({ ...r }));
export const TERRAIN = JSON.parse(JSON.stringify(LOCK.terrain));
export const PLOT_RULES = JSON.parse(JSON.stringify(LOCK.plotRules));

// --- power tiers -> district density tiers (lock §3 density notes) ---
// low: hamlet/village · normal: town/city · prosperous: stronghold/kingdom/grand-kingdom/legendary
// 'event' overrides everything when a celebration/war event is active.
export const POWER_TIERS = [
  'hamlet', 'village', 'town', 'city',
  'stronghold', 'kingdom', 'grand-kingdom', 'legendary',
];
export const DENSITY_TIERS = ['low', 'normal', 'prosperous', 'event'];
export function densityTier(powerTier, eventActive = false) {
  if (eventActive) return 'event';
  if (powerTier === 'hamlet' || powerTier === 'village') return 'low';
  if (powerTier === 'town' || powerTier === 'city') return 'normal';
  return 'prosperous';
}

// --- hero states (lock §6) and generic actor states (spec §14.7) ---
export const HERO_STATES = [
  'idle', 'walking', 'working', 'traveling', 'inspecting', 'training',
  'fighting', 'defending', 'repairing', 'celebrating', 'sleeping', 'recovering',
];
export const ACTOR_STATES = [
  'idle', 'walking', 'working', 'carrying', 'patrolling', 'fighting', 'repairing',
  'celebrating', 'sleeping', 'sheltering', 'trading', 'studying', 'scouting',
  'traveling', 'following', 'waiting',
];

// --- hero destination priority (lock §6): war > CI failure > release > achievement > visitor > routine ---
export const HERO_DESTINATION_PRIORITY = [
  { kind: 'war', node: 'war_front' },
  { kind: 'ci-failure', node: 'automation_fortress' },
  { kind: 'release', node: 'royal_plaza' },
  { kind: 'achievement', node: 'hall_of_heroes' },
  { kind: 'visitor', node: 'visitor_camp' },
  { kind: 'routine', node: 'market_square' },
];

// --- geometry helpers ---
export const inBounds = (x, y, w = 0, h = 0) =>
  x >= 0 && y >= 0 && x + w <= WORLD_W && y + h <= WORLD_H;
export const rectOf = (x, y, w, h) => ({ x, y, w, h });
export const rectsOverlap = (a, b) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
export const clampToBounds = (x, y) => [
  Math.min(Math.max(x, 0), WORLD_W),
  Math.min(Math.max(y, 0), WORLD_H),
];
