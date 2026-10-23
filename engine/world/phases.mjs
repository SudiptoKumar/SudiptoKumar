// Event choreography (TRUE V2 phase 4). Every story of the kingdom has the same four phases:
//   START      the world reacts: the hero sets off, people head for the place
//   PEAK       the event itself: crowd, fireworks, battle, alarm, repair
//   AFTERMATH  what is left: confetti on the ground, golden glow, victory chest, a quiet crew
//   EXPIRED    gone, the kingdom is back to its routine
// The phase is computed from the real age of the thing that started the story, so it is deterministic: same state, same phase.
import { EVENT_INFO, RAID_ENTER_MINUTES } from '../events.mjs';

export const PHASES = Object.freeze(['start', 'peak', 'aftermath', 'expired']);

/** Events that have no stages of their own: [end of START, end of PEAK, end of AFTERMATH] in minutes since they began. */
export const TIMELINE = Object.freeze({
  release: [30, 720, 2880],       // 30 min of arriving, 12 h of party (as before), then two days of afterglow
  milestone: [30, 720, 2880],
  harvest: [60, 1200, 2400],
  nightstars: [10, 50, 60],
});

/** Stories that already have named stages (scene.mjs): which phase each stage is. */
export const STAGE_PHASE = Object.freeze({
  fail: { warning: 'start', alarm: 'peak', smoke: 'peak', fire: 'peak' },
  repair: { firefighter: 'start', repair: 'peak', fade: 'aftermath' },
  build: { foundation: 'start', builders: 'peak', construction: 'aftermath' },
  visitor: { arriving: 'start', camping: 'peak', settled: 'aftermath' },
  raid: { enter: 'start', battle: 'peak', won: 'aftermath', lost: 'aftermath' },
});

/** Minutes the hero needs to walk to the place when the event starts (the whole START phase). */
export const WALK_MINUTES = Object.freeze({ release: 30, milestone: 30, harvest: 60, raid: RAID_ENTER_MINUTES });

export function phaseOf(type, ageMinutes) {
  const t = TIMELINE[type];
  if (!t) return 'peak';
  return ageMinutes < t[0] ? 'start' : ageMinutes < t[1] ? 'peak' : ageMinutes < t[2] ? 'aftermath' : 'expired';
}

/** A finished quest celebrates at the object it pointed at (the same table the quest markers use). */
export const QUEST_ANCHOR = Object.freeze({ streak: 'farm', stars: 'vault', gate: 'gate', recover: 'ci', release: 'castle', build: 'castle', kingdom: 'castle' });
const milestoneAnchor = (id) => (String(id || '').startsWith('ach:') ? 'hall' : String(id || '').startsWith('quest:') ? QUEST_ANCHOR[String(id).split(':')[1]] || 'castle' : 'castle');
const whereOf = (e) => (e.type === 'release' ? { anchor: 'castle' } : e.type === 'milestone' ? { anchor: milestoneAnchor(e.id) } : e.type === 'harvest' ? { anchor: 'farm' } : null);

/**
 * Every running story as { id, type, phase, ageMinutes, stage, where }, most important first.
 *   where: { anchor: 'castle' | 'hall' | 'farm' | 'gate' | 'ci' | 'camp' } or { repo: name }
 */
export function eventPhases({ S, ev, stages, now }) {
  const mins = (iso) => (iso ? Math.max(0, Math.round((now - new Date(iso)) / 60000)) : 0);
  const out = [];
  const repo = (n) => (S.repos || []).find((r) => r.name === n);
  for (const e of ev) {
    if (!TIMELINE[e.type]) continue;
    const a = mins(e.at), phase = phaseOf(e.type, a);
    if (phase !== 'expired') out.push({ id: e.id, type: e.type, phase, ageMinutes: a, stage: e.type === 'release' ? stages.release : null, where: whereOf(e) });
  }
  const R = S.raid || {};
  if (R.active || R.done) out.push({ id: `raid:${R.id}`, type: 'raid', phase: STAGE_PHASE.raid[R.phase] || 'peak', ageMinutes: mins(R.at), stage: R.phase, where: { anchor: 'gate' } });
  for (const [name, st] of Object.entries(stages.fail || {})) out.push({ id: `emergency:${name}`, type: 'emergency', phase: STAGE_PHASE.fail[st], ageMinutes: mins(repo(name)?.lastFailAt), stage: st, where: { repo: name, anchor: 'ci' } });
  for (const [name, st] of Object.entries(stages.repair || {})) out.push({ id: `recovery:${name}`, type: 'recovery', phase: STAGE_PHASE.repair[st], ageMinutes: mins(repo(name)?.recoveredAt), stage: st, where: { repo: name, anchor: 'ci' } });
  for (const [name, st] of Object.entries(stages.build || {})) out.push({ id: `expansion:${name}`, type: 'expansion', phase: STAGE_PHASE.build[st], ageMinutes: mins(repo(name)?.createdAt), stage: st, where: { repo: name } });
  const v = stages.visitor;
  if (v) out.push({ id: `visitor:${v.n}`, type: 'visitor', phase: STAGE_PHASE.visitor[v.stage], ageMinutes: mins(S.visitors?.flags?.[0]?.at), stage: v.stage, where: { anchor: 'camp' } });
  const rank = (t) => (EVENT_INFO[t]?.rank ?? 50);
  return out.sort((a, b) => rank(a.type) - rank(b.type) || a.ageMinutes - b.ageMinutes || (a.id < b.id ? -1 : 1));
}

/** One short string for the manifest: what every camera must agree about. */
export const phaseSignature = (phases) => (phases || []).map((p) => `${p.type}:${p.phase}`).join(',') || '-';
