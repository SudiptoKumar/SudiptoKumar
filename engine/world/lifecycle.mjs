// TRUE V2 repository lifecycle (TRUE V2 §11). A repository's lifecycle state is
// one key drawn from real signals — evolution level, repo state, and the event
// stages. The key must visibly affect the building (Phase 3/6 renderers read it).
//
//   foundation -> building -> active -> flourishing      (growth)
//   active -> sleepy -> abandoned                        (quiet)
//   any    -> failing -> recovering -> active            (trouble and repair)
export const LIFECYCLE_KEYS = ['foundation', 'building', 'active', 'flourishing', 'sleepy', 'failing', 'recovering', 'abandoned'];

/**
 * lifecycleFor(repo, stages) -> { key, level, detail }
 * `stages` is scene.stages ({ fail, repair, build } maps of repo name -> stage).
 * Pure and deterministic.
 */
export function lifecycleFor(repo, stages = {}) {
  const name = repo.name;
  const level = repo.evolution?.level || 1;
  if (repo.state === 'abandoned') return { key: 'abandoned', level, detail: null };
  if (stages.fail?.[name]) return { key: 'failing', level, detail: stages.fail[name] };
  if (stages.repair?.[name]) return { key: 'recovering', level, detail: stages.repair[name] };
  if (stages.build?.[name] || repo.state === 'building') return { key: 'building', level, detail: stages.build?.[name] || null };
  if (repo.state === 'sleepy' || repo.state === 'dusty') return { key: 'sleepy', level, detail: repo.state };
  if (level >= 5) return { key: 'flourishing', level, detail: null };
  if (level <= 2) return { key: 'foundation', level, detail: null };
  return { key: 'active', level, detail: null };
}
