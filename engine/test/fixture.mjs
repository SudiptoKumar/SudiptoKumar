// Shared test fixture: a representative normalized state.
import { buildNormalizedState } from '../domain/state.mjs';

export function sampleSnap(overrides = {}) {
  return {
    seed: 'test-seed-1',
    powerTier: 'kingdom',
    repos: [
      { name: 'alpha', fullName: 'u/alpha', description: 'docs site', language: 'TypeScript', stars: 120, ageDays: 400, recentCommits: 12 },
      { name: 'beta', fullName: 'u/beta', description: 'cli tool', language: 'Go', stars: 5, ageDays: 10, recentCommits: 3 },
      { name: 'gamma', fullName: 'u/gamma', description: 'game engine', language: 'Rust', stars: 2000, ageDays: 900, recentCommits: 0, featured: true },
      { name: 'delta', fullName: 'u/delta', description: 'data pipeline', language: 'Python', stars: 45, ageDays: 200, recentCommits: 0, archived: true },
    ],
    issues: { open: 7 },
    ci: { status: 'healthy' },
    releases: [{ tag: 'v3.0.0', name: 'V3 launch' }],
    contributions: { activeDays: 120, streak: 9 },
    achievements: [{ id: 'a1', title: 'First commit', unlocked: true }],
    visitors: [
      { login: 'friend1', kind: 'flag', message: 'hello kingdom' },
      { login: 'raider1', kind: 'raid', message: 'for glory' },
    ],
    hero: { name: 'Sudipto', class: 'builder', gearTier: 3 },
    time: { phase: 'morning', season: 'autumn', weather: 'clear' },
    ...overrides,
  };
}

export const sampleState = (overrides = {}) => buildNormalizedState({ snap: sampleSnap(overrides) });
