// Helper for simulation.test.mjs (not a test itself): prints the canonical
// hash of a snapshot for the bucket given in argv[2]. Run in two processes
// to prove cross-process determinism.
import { buildWorld } from '../world/world.mjs';
import { sampleState } from './fixture.mjs';
import { simulate, serializeSnapshot } from '../simulation/simulate.mjs';
import { sha } from '../util.mjs';

const bucket = process.argv[2] ?? '2026-10-07T06:00:06+06:00';
const world = buildWorld(sampleState());
const snap = simulate(world, {
  timeBucket: bucket,
  inputs: { events: [], warPhase: 'PEACE', ciStatus: 'healthy', releases: [] },
});
process.stdout.write(sha(serializeSnapshot(snap), 16));
