// scenarios.mjs — the 20 deterministic demo scenarios (spec §21).
// Each scenario is a named { snap, inputs } pair; buildScenario() runs the
// full pipeline: normalized state -> world -> simulation snapshot.
// Nothing here touches the network; every scenario is reproducible.
import { buildNormalizedState } from '../domain/state.mjs';
import { buildWorld } from '../world/world.mjs';
import { simulate, assertValidSnapshot } from '../simulation/simulate.mjs';

const repo = (name, over = {}) => ({
  name, fullName: `demo/${name}`, description: `${name} project`,
  language: 'TypeScript', stars: 10, ageDays: 100, recentCommits: 2, ...over,
});

const baseSnap = (name, over = {}) => ({
  seed: `scenario-${name}`,
  kingdomName: 'Demo Kingdom',
  owner: 'demo-owner',
  powerTier: 'town',
  repos: [repo('alpha'), repo('beta', { language: 'Go' })],
  issues: { open: 4 },
  ci: { status: 'healthy' },
  releases: [],
  contributions: { activeDays: 60, streak: 5 },
  achievements: [],
  visitors: [],
  hero: { name: 'Ash', class: 'warden', gearTier: 3 },
  time: { phase: 'morning', season: 'summer', weather: 'clear' },
  war: { phase: 'PEACE' },
  ...over,
});

const manyRepos = (n) => Array.from({ length: n }, (_, i) => repo(`repo-${String(i).padStart(2, '0')}`, {
  language: ['TypeScript', 'Go', 'Rust', 'Python'][i % 4],
  stars: (i * 37) % 500, ageDays: 30 + (i * 13) % 800, recentCommits: i % 5,
  featured: i < 3,
}));

export const SCENARIOS = [
  {
    name: 'peaceful-medium-day', title: 'Peaceful Medium Day',
    blurb: 'A medium kingdom at morning: workers active, market open, hero on routine rounds.',
    closeCameras: ['capital'],
    snap: baseSnap('peaceful-medium-day', { powerTier: 'city', time: { phase: 'morning', season: 'summer', weather: 'clear' } }),
  },
  {
    name: 'prosperous-kingdom', title: 'Prosperous Kingdom',
    blurb: 'A grand kingdom at noon: dense project quarter, mature farms, rich decorations.',
    closeCameras: ['projects'],
    snap: baseSnap('prosperous-kingdom', {
      powerTier: 'grand-kingdom', time: { phase: 'noon', season: 'summer', weather: 'clear' },
      repos: manyRepos(14),
      releases: [{ tag: 'v2.0.0', name: 'Second age' }],
      achievements: [{ id: 'a1', title: 'First commit', unlocked: true }, { id: 'a2', title: 'Hundred stars', unlocked: true }],
      contributions: { activeDays: 300, streak: 21 },
    }),
  },
  {
    name: 'quiet-night', title: 'Quiet Night',
    blurb: 'Night, no events: homes lit, guards on patrol, no fake drama.',
    closeCameras: ['capital'],
    snap: baseSnap('quiet-night', { powerTier: 'town', time: { phase: 'night', season: 'autumn', weather: 'clear' }, visitors: [] }),
  },
  {
    name: 'release-peak', title: 'Release Peak',
    blurb: 'A major release at peak celebration: banners, fireworks, hero at the plaza.',
    closeCameras: ['capital'],
    snap: baseSnap('release-peak', {
      powerTier: 'kingdom', time: { phase: 'noon', season: 'autumn', weather: 'clear' },
      releases: [{ tag: 'v3.0.0', name: 'V3 launch' }],
    }),
    inputs: { events: [{ id: 'rel-v3', type: 'release', phase: 'PEAK', anchor: 'royal_plaza' }] },
  },
  {
    name: 'fortress-failure', title: 'Fortress Failure',
    blurb: 'CI failing: fortress alarm and smoke, engineers dispatched.',
    closeCameras: ['warfront'],
    snap: baseSnap('fortress-failure', {
      powerTier: 'city', time: { phase: 'afternoon', season: 'spring', weather: 'rain' },
      ci: { status: 'failing' },
    }),
    inputs: { ciStatus: 'failing', events: [{ id: 'ci-1', type: 'ci-failure', phase: 'PEAK', anchor: 'automation_fortress' }] },
  },
  {
    name: 'fortress-recovery', title: 'Fortress Recovery',
    blurb: 'CI recovering: scaffolds up, normal activity returning.',
    closeCameras: ['warfront'],
    snap: baseSnap('fortress-recovery', {
      powerTier: 'city', time: { phase: 'morning', season: 'spring', weather: 'clear' },
      ci: { status: 'recovering' },
    }),
    inputs: { ciStatus: 'recovering', events: [{ id: 'ci-1', type: 'ci-failure', phase: 'RECOVERY', anchor: 'automation_fortress' }] },
  },
  {
    name: 'major-project-build', title: 'Major Project Build',
    blurb: 'An active construction site: scaffolding, workers, material deliveries.',
    closeCameras: ['projects'],
    snap: baseSnap('major-project-build', {
      powerTier: 'kingdom', time: { phase: 'morning', season: 'summer', weather: 'clear' },
      repos: [repo('alpha', { recentCommits: 40 }), repo('beta', { recentCommits: 25 }), repo('newport', { ageDays: 4, recentCommits: 30 })],
    }),
  },
  {
    name: 'visitor-arrival', title: 'Visitor Arrival',
    blurb: 'Travelers land at the harbor and make for the camp.',
    closeCameras: ['harbor'],
    snap: baseSnap('visitor-arrival', {
      powerTier: 'town', time: { phase: 'afternoon', season: 'summer', weather: 'clear' },
      visitors: [
        { login: 'traveler-jo', kind: 'flag', message: 'greetings from the north road' },
        { login: 'sailor-mae', kind: 'flag', message: 'fine harbor you have here' },
      ],
    }),
    inputs: { events: [{ id: 'vis-1', type: 'visitor', phase: 'APPROACH', anchor: 'visitor_camp' }] },
  },
  {
    name: 'achievement-unlocked', title: 'Achievement Unlocked',
    blurb: 'A new trophy rises in the Hall of Heroes.',
    closeCameras: ['capital'],
    snap: baseSnap('achievement-unlocked', {
      powerTier: 'city', time: { phase: 'evening', season: 'autumn', weather: 'clear' },
      achievements: [{ id: 'a9', title: 'Thousand commits', unlocked: true }],
    }),
    inputs: { events: [{ id: 'ach-1', type: 'achievement', phase: 'PEAK', anchor: 'hall_of_heroes' }] },
  },
  {
    name: 'war-scouting', title: 'War Scouting',
    blurb: 'Scouts range the frontier; the watch prepares.',
    closeCameras: ['warfront'],
    snap: baseSnap('war-scouting', {
      powerTier: 'kingdom', time: { phase: 'dawn', season: 'autumn', weather: 'clear' },
      war: { phase: 'SCOUTING' },
    }),
    inputs: { warPhase: 'SCOUTING' },
  },
  {
    name: 'war-battle', title: 'War Battle',
    blurb: 'Battle at the front: defenders, hero, enemy cohort, smoke and fire.',
    closeCameras: ['warfront'],
    snap: baseSnap('war-battle', {
      powerTier: 'stronghold', time: { phase: 'sunset', season: 'winter', weather: 'clear' },
      war: { phase: 'BATTLE' }, issues: { open: 25 },
    }),
    inputs: { warPhase: 'BATTLE' },
  },
  {
    name: 'war-aftermath', title: 'War Aftermath',
    blurb: 'After the battle: damage, smoke, debris, repair crews moving in.',
    closeCameras: ['warfront'],
    snap: baseSnap('war-aftermath', {
      powerTier: 'stronghold', time: { phase: 'morning', season: 'winter', weather: 'clear' },
      war: { phase: 'AFTERMATH' },
    }),
    inputs: { warPhase: 'AFTERMATH' },
  },
  {
    name: 'war-recovery', title: 'War Recovery',
    blurb: 'Repair and rebuilding: defenses restored, calm returning.',
    closeCameras: ['warfront'],
    snap: baseSnap('war-recovery', {
      powerTier: 'kingdom', time: { phase: 'afternoon', season: 'spring', weather: 'clear' },
      war: { phase: 'RECOVERY' },
    }),
    inputs: { warPhase: 'RECOVERY' },
  },
  {
    name: 'winter-day', title: 'Winter Day',
    blurb: 'Snow cover, bare trees, warm windows, fallow fields.',
    closeCameras: ['farm'],
    snap: baseSnap('winter-day', { powerTier: 'city', time: { phase: 'morning', season: 'winter', weather: 'snow' } }),
  },
  {
    name: 'rainy-day', title: 'Rainy Day',
    blurb: 'Rain: wet roads, covered work, darker clouds.',
    closeCameras: ['farm'],
    snap: baseSnap('rainy-day', { powerTier: 'town', time: { phase: 'afternoon', season: 'autumn', weather: 'rain' } }),
  },
  {
    name: 'aurora-night', title: 'Aurora Night',
    blurb: 'Night with a restrained aurora band; same world geometry as day.',
    closeCameras: ['capital'],
    snap: baseSnap('aurora-night', { powerTier: 'kingdom', time: { phase: 'night', season: 'winter', weather: 'aurora' } }),
  },
  {
    name: 'empty-account', title: 'Empty Account',
    blurb: 'No repositories: the core civilization stands on its own.',
    closeCameras: ['capital'],
    snap: baseSnap('empty-account', {
      powerTier: 'hamlet', repos: [], issues: { open: 0 }, contributions: { activeDays: 0, streak: 0 },
      hero: { name: 'Ash', class: 'settler', gearTier: 1 },
    }),
  },
  {
    name: '90-repositories', title: 'Ninety Repositories',
    blurb: 'A huge account: the project quarter scales without overlap.',
    closeCameras: ['projects'],
    snap: baseSnap('90-repositories', {
      powerTier: 'legendary', time: { phase: 'noon', season: 'summer', weather: 'clear' },
      repos: manyRepos(90), contributions: { activeDays: 900, streak: 60 },
    }),
  },
  {
    name: 'hostile-text', title: 'Hostile Text',
    blurb: 'Adversarial input is escaped: no markup escapes, no broken layout.',
    closeCameras: ['harbor'],
    snap: baseSnap('hostile-text', {
      visitors: [
        { login: 'nice-try', kind: 'flag', message: '<script>alert(1)</script>' },
        { login: 'xss2', kind: 'raid', message: '"><img src=x onerror=alert(2)>' },
      ],
      repos: [repo('alpha"><svg onload=alert(3)>', { description: '<b>bold</b> & "quoted"' })],
      hero: { name: 'Ash"><img src=x>', class: 'warden', gearTier: 3 },
    }),
  },
  {
    name: 'partial-github-failure', title: 'Partial GitHub Failure',
    blurb: 'CI and issues APIs failed: unaffected systems continue, unknowns stay neutral.',
    closeCameras: ['projects'],
    snap: baseSnap('partial-github-failure', {
      failedSections: ['ci', 'issues'],
      ci: { status: 'failing' }, // must be ignored: section failed
      issues: { open: 999 },     // must be ignored: section failed
    }),
  },
];

export const scenarioNames = () => SCENARIOS.map((s) => s.name);
export const getScenario = (name) => SCENARIOS.find((s) => s.name === name) ?? null;

/**
 * Full deterministic pipeline for one scenario.
 * @returns { scenario, state, world, snap, timeBucket }
 */
export function buildScenario(name) {
  const scenario = getScenario(name);
  if (!scenario) throw new Error(`unknown scenario: ${name}`);
  const state = buildNormalizedState({ snap: scenario.snap });
  const world = buildWorld(state);
  const t = scenario.snap.time;
  const timeBucket = `${t.phase}-${t.season}-${t.weather}-${name}`;
  const snap = simulate(world, { timeBucket, inputs: scenario.inputs ?? {} });
  assertValidSnapshot(snap);
  return { scenario, state, world, snap, timeBucket };
}
