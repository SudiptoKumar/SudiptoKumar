// Construction: builder task lifecycle over real world buildings.
//   idle -> assigned -> collect-materials -> travel -> build
//        -> pause/event -> resume -> complete -> return   (spec §07 §13)
// Buildings in foundation/construction/upgrading/repairing lifecycle states
// get worker assignments + deterministic progress. Progress is a pure
// function of the bucket's day index, so the lifecycle visibly advances
// across buckets. Interruptions (storm/battle) pause tasks; the deterministic
// storm calendar surfaces pause -> resume transitions. War aftermath/repair
// phases add bounded repair tasks; damage never mutates the world.
import { subRng } from '../util.mjs';
import { dayIndex } from './clock.mjs';

const BUILDABLE = new Set(['foundation', 'construction', 'upgrading', 'repairing']);
const BUILDERS = ['builder-borin', 'builder-tilda', 'builder-okafor'];
const TASK_STATES = ['idle', 'assigned', 'collect-materials', 'travel', 'build', 'pause', 'resume', 'complete', 'return'];

const clamp01 = (n) => Math.min(1, Math.max(0, n));
const h01 = (seed, ...parts) => subRng(seed, ...parts)();
// Deterministic storm calendar: ~8% of days are stormy (task planning only;
// the bucket's own weather input always wins for "today").
const stormyDay = (seed, dayNum) => h01(seed, 'storm-day', dayNum) < 0.08;

/** Lifecycle state of a task from progress p and interrupt flags. Exported for tests. */
export function taskStateFor(p, { interrupted = false, resuming = false, daysSinceComplete = 0 } = {}) {
  if (p >= 1) return daysSinceComplete < 1 ? 'return' : 'complete';
  if (interrupted) return 'pause';
  if (resuming) return 'resume';
  if (p <= 0) return 'assigned';
  if (p < 0.2) return 'collect-materials';
  if (p < 0.32) return 'travel';
  return 'build';
}

function buildingTasks(world, clock, ctx, rules) {
  const seed = world.seed;
  const today = dayIndex(clock, 'construction');
  const battle = ['APPROACH', 'BATTLE', 'TURNING_POINT'].includes(ctx.warPhase);
  const stormToday = stormyDay(seed, today) || rules?.shelter === true;
  const interrupted = battle || stormToday || rules?.constructionAllowed === false;
  const resuming = !interrupted && stormyDay(seed, today - 1);
  const tasks = [];
  // Absolute schedule: tasks are anchored to 60-day work cycles so progress
  // advances monotonically as buckets advance. Each buildable building gets
  // a staggered offset so concurrent tasks sit in different lifecycle phases.
  const CYCLE = 60;
  const cycleStart = Math.floor(today / CYCLE) * CYCLE;
  let idx = 0;
  for (const b of world.buildings ?? []) {
    if (!BUILDABLE.has(b.lifecycle)) continue;
    if (tasks.length >= 10) break;
    const r = subRng(seed, 'construction', b.id);
    const offset = (Math.floor(h01(seed, 'construction-start', b.id) * 50) + idx * 17) % 50;
    idx++;
    const startDay = cycleStart + offset;
    const duration = 10 + Math.floor(r() * 15); // 10..24 days
    const p = clamp01((today - startDay) / duration);
    const daysSinceComplete = today - (startDay + duration);
    if (daysSinceComplete > 25) continue; // archived
    const state = taskStateFor(p, {
      interrupted: interrupted && p > 0.32 && p < 1,
      resuming: resuming && p > 0.32 && p < 1,
      daysSinceComplete,
    });
    tasks.push({
      id: `task-${b.id}`,
      type: b.lifecycle === 'repairing' ? 'repair' : 'build',
      state,
      assignee: BUILDERS[Math.floor(h01(seed, 'construction-crew', b.id) * BUILDERS.length)],
      plot: b.plot ?? b.district ?? null,
      anchor: b.district ?? null,
      progress: Math.round(p * 1000) / 1000,
      building: b.id,
      lifecycle: b.lifecycle,
    });
  }
  return tasks;
}

function warRepairTasks(ctx) {
  const warPhase = ctx.warPhase;
  if (!['AFTERMATH', 'REPAIR', 'RECOVERY'].includes(warPhase)) return [];
  const anchors = ['war_front', 'watch_north', 'east_gate'];
  const phaseProgress = { AFTERMATH: 0.08, REPAIR: 0.55, RECOVERY: 0.92 }[warPhase];
  return anchors.map((anchor, i) => ({
    id: `task-repair-${anchor}`,
    type: 'repair',
    state: taskStateFor(phaseProgress, {}),
    assignee: BUILDERS[i % BUILDERS.length],
    plot: null,
    anchor,
    progress: phaseProgress,
    building: null,
    lifecycle: 'repairing',
    cause: `war:${warPhase}`,
  }));
}

/**
 * All construction/repair tasks for the tick.
 * @returns {{ tasks: object[], hasConstruction: boolean }}
 */
export function constructionTasks(world, clock, ctx, rules) {
  const tasks = [
    ...buildingTasks(world, clock, ctx, rules),
    ...warRepairTasks(ctx),
  ];
  tasks.sort((a, b) => (a.id < b.id ? -1 : 1));
  const hasConstruction = tasks.some((t) => !['complete', 'return', 'idle'].includes(t.state));
  return { tasks, hasConstruction };
}

export { TASK_STATES };
