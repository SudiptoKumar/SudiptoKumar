// Offline fixture for `update` when no GH_TOKEN is present (spec §25:
// update must work fully OFFLINE with fixtures). Deterministic demo
// state, clearly marked: snap.offline === true and provenance
// 'demo-fixture'. Never presented as live data — the README footer and
// the CLI summary both say so.
import { deriveAchievements } from './achievements.mjs';

const repo = (name, over = {}) => ({
  id: name, name, fullName: `sample/${name}`,
  description: `${name} sample project`,
  language: 'TypeScript', stars: 12, forks: 2,
  ageDays: 200, recentCommits: 4, pushedDaysAgo: 3,
  archived: false, featured: false, url: null,
  ...over,
});

export function offlineSnap({ owner = 'sample-owner', kingdomName = 'Sample Kingdom' } = {}) {
  const snap = {
    seed: 'offline-demo-fixture',
    kingdomName,
    owner,
    powerTier: 'city',
    offline: true,
    provenance: 'demo-fixture',
    repos: [
      repo('starship-docs', { description: 'documentation site', language: 'TypeScript', stars: 240, ageDays: 420, recentCommits: 18, pushedDaysAgo: 1 }),
      repo('cargo-cli', { description: 'command line tool', language: 'Go', stars: 64, ageDays: 300, recentCommits: 9, pushedDaysAgo: 4 }),
      repo('ember-engine', { description: 'game engine', language: 'Rust', stars: 1500, ageDays: 900, recentCommits: 0, pushedDaysAgo: 400, featured: true }),
      repo('harvest-data', { description: 'data pipeline', language: 'Python', stars: 88, ageDays: 150, recentCommits: 22, pushedDaysAgo: 0 }),
      repo('lantern-ui', { description: 'web frontend', language: 'JavaScript', stars: 31, ageDays: 95, recentCommits: 0, pushedDaysAgo: 120 }),
      repo('old-keep', { description: 'legacy service', language: 'Java', stars: 7, ageDays: 700, recentCommits: 0, pushedDaysAgo: 500, archived: true }),
    ],
    issues: { open: 7, closed: 41 },
    ci: { status: 'healthy' },
    releases: [{ tag: 'v1.4.0', name: 'Harvest release' }],
    contributions: { activeDays: 120, streak: 9 },
    achievements: [],
    visitors: [
      { login: 'traveler-jo', kind: 'flag', message: 'greetings from the north road' },
    ],
    hero: { name: 'Sample Hero', class: 'warden', gearTier: 3, present: true },
    time: { phase: 'morning', season: 'summer', weather: 'clear' },
    war: { phase: 'PEACE' },
    events: [],
  };
  snap.achievements = deriveAchievements(snap);
  return snap;
}
