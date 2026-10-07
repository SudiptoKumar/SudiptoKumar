// Event engine: domain events become short visual stories.
// Generic phases (lock §8): ANNOUNCED -> APPROACH -> PEAK -> AFTERMATH ->
// RECOVERY -> RESOLVED. fxIntensity follows the lock: APPROACH 0.45,
// PEAK 1.0, AFTERMATH 0.25 (ANNOUNCED 0, RECOVERY 0.1, RESOLVED 0).
// Priority: war > severe CI failure > major release > achievement >
// visitor arrival > harvest > routine. Quiet state: no invented drama.
import { EVENT_PHASES } from '../world/constants.mjs';

export const FX_FOR_PHASE = {
  ANNOUNCED: 0, APPROACH: 0.45, PEAK: 1.0, AFTERMATH: 0.25, RECOVERY: 0.1, RESOLVED: 0,
};

const RANK = { war: 100, 'ci-failure': 90, release: 80, achievement: 70, visitor: 60, harvest: 55 };
export const eventRank = (type) => RANK[type] ?? 0;

const STORIES = {
  release: {
    anchor: 'royal_plaza', route: ['project_quarter', 'royal_plaza'],
    participants: ['messenger-hollis', 'messenger-ivy', 'hero'],
    consequences: ['herald announcement at the plaza', 'banners raised over the castle', 'crowd gathers'],
    resolution: 'celebration fades; banners remain until next release',
  },
  'ci-failure': {
    anchor: 'automation_fortress', route: ['project_quarter', 'automation_fortress'],
    participants: ['engineer-fenn', 'engineer-gale', 'smith-quinn'],
    consequences: ['fortress beacon switches to red alarm', 'smoke from the workshops', 'engineers dispatched'],
    resolution: 'repair crew restores the fortress; beacon returns to green',
  },
  achievement: {
    anchor: 'hall_of_heroes', route: ['courier_station', 'hall_of_heroes'],
    participants: ['messenger-hollis', 'hero'],
    consequences: ['new trophy raised in the hall', 'hero visits to pay honor'],
    resolution: 'trophy remains as a permanent monument',
  },
  visitor: {
    anchor: 'visitor_camp', route: ['harbor_docks', 'visitor_camp'],
    participants: ['visitor-sable', 'visitor-tobin', 'merchant-joren'],
    consequences: ['boat docks at the harbor', 'caravan moves to the camp', 'tent raised on a camp plot'],
    resolution: 'visitors settle; some join the market crowd',
  },
  harvest: {
    anchor: 'farm_entrance', route: ['farm_entrance', 'mill'],
    participants: ['farmer-elsa', 'farmer-bram', 'farmer-yuki'],
    consequences: ['fields worked at full crew', 'grain carts run to the mill'],
    resolution: 'fields return to the next cycle',
  },
};

function fxForEvent(type, phase, fxIntensity) {
  const fx = [];
  const push = (t, extra = {}) => fx.push({ type: t, anchor: STORIES[type].anchor, intensity: fxIntensity, ttl: 1, ...extra });
  if (fxIntensity <= 0) return fx;
  if (type === 'release') {
    if (phase === 'PEAK') { push('banners'); push('confetti'); push('fireworks'); }
    else if (phase === 'APPROACH') push('banners');
    else if (phase === 'AFTERMATH') push('confetti');
  } else if (type === 'ci-failure') {
    if (['ANNOUNCED', 'APPROACH', 'PEAK'].includes(phase)) { push('alarm'); push('smoke'); }
    else if (phase === 'RECOVERY') push('scaffolding');
  } else if (type === 'achievement') {
    if (phase === 'PEAK') { push('banners'); push('confetti'); }
  } else if (type === 'visitor') {
    if (phase === 'APPROACH' || phase === 'PEAK') push('lanterns');
  }
  return fx;
}

/**
 * Resolve the event list for a tick.
 * @param {object} world read-only world (world.events carry domain phases)
 * @param {object} inputs live-ish signals { events, warPhase, ciStatus, releases }
 * @param {object} clock
 * @returns {{ list, primary, eventTypes: Map, effects }}
 */
export function resolveEvents(world, inputs, clock) {
  const byId = new Map();
  const add = (e) => { if (e && e.id && !byId.has(e.id)) byId.set(e.id, e); };
  for (const e of world.events ?? []) add(normalizeWorldEvent(e));
  for (const e of inputs?.events ?? []) add(normalizeInputEvent(e));
  // Live signal synthesis (never invents: only from explicit inputs).
  const warPhase = inputs?.warPhase ?? world.war?.phase ?? 'PEACE';
  if (warPhase !== 'PEACE' && warPhase !== 'RESOLVED') {
    add({ id: 'war', type: 'war', phase: 'PEAK', severity: 'war', anchor: 'war_front', warPhase, fxIntensity: 1 });
  }
  const ciStatus = inputs?.ciStatus ?? world.fortress?.state ?? 'unknown';
  if (ciStatus === 'failing') {
    add({ id: 'ci-failure', type: 'ci-failure', phase: 'APPROACH', severity: 'critical', anchor: 'automation_fortress', fxIntensity: FX_FOR_PHASE.APPROACH });
  } else if (ciStatus === 'recovering') {
    add({ id: 'ci-recovery', type: 'ci-failure', phase: 'RECOVERY', severity: 'notice', anchor: 'automation_fortress', fxIntensity: FX_FOR_PHASE.RECOVERY });
  }
  for (const r of inputs?.releases ?? []) {
    const id = `release-${String(r.tag ?? r.id ?? 'live')}`;
    add({ id, type: 'release', phase: 'ANNOUNCED', severity: 'celebration', anchor: 'royal_plaza', fxIntensity: 0, title: r.name ?? r.tag ?? null });
  }

  const list = [];
  const eventTypes = new Map();
  for (const e of byId.values()) {
    if (e.phase === 'RESOLVED') continue;
    const story = STORIES[e.type];
    const fxIntensity = FX_FOR_PHASE[e.phase] ?? 0;
    const prev = eventTypes.get(e.type);
    if (!prev || eventRank(e.type) >= 0) eventTypes.set(e.type, e.phase);
    list.push({
      id: e.id, type: e.type, phase: e.phase, severity: e.severity ?? 'routine',
      anchor: e.anchor ?? story?.anchor ?? 'royal_plaza',
      routeId: story ? `${story.route[0]}>${story.route[1]}` : null,
      participants: story?.participants ?? [],
      consequences: story?.consequences ?? [],
      resolution: story?.resolution ?? null,
      fxIntensity,
      ...(e.warPhase ? { warPhase: e.warPhase } : {}),
    });
  }
  list.sort((a, b) => eventRank(b.type) - eventRank(a.type) || (a.id < b.id ? -1 : 1));
  const primary = list[0] ?? null;
  const effects = list.flatMap((e) => e.type === 'war' ? [] : fxForEvent(e.type, e.phase, e.fxIntensity));
  return { list, primary, eventTypes, effects };
}

function normalizeWorldEvent(e) {
  const phase = EVENT_PHASES.includes(e.phase) ? e.phase : 'ANNOUNCED';
  return { id: String(e.id), type: String(e.type), phase, severity: e.severity ?? 'routine', anchor: e.anchor ?? null, warPhase: e.warPhase, fxIntensity: e.fxIntensity ?? FX_FOR_PHASE[phase] ?? 0 };
}

function normalizeInputEvent(e) {
  if (!e || typeof e !== 'object') return null;
  const phase = EVENT_PHASES.includes(e.phase) ? e.phase : 'ANNOUNCED';
  return { id: String(e.id ?? `${e.type ?? 'event'}-input`), type: String(e.type ?? 'routine'), phase, severity: e.severity ?? 'routine', anchor: e.anchor ?? null };
}
