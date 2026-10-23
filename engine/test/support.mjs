// Shared helpers for the TRUE V2 tests: build any demo world, plus a few readers for generated pictures.
import { mockSnapshot, demoScenarios, seedDemoStore } from '../mock.mjs';
import { DEFAULTS } from '../config.mjs';
import { buildState } from '../state.mjs';
import { EMPTY } from '../store.mjs';
import { finalizeV2 } from '../v2.mjs';

export const cfg = { ...structuredClone(DEFAULTS), owner: 'SudiptoKumar', repo: 'SudiptoKumar', timezone: 'UTC' };
export const scenarioNames = () => Object.keys(demoScenarios());
export function world(name, { tweak } = {}) {
  const sc = demoScenarios()[name];
  const store = seedDemoStore(sc);
  const state = buildState({ snap: mockSnapshot({ now: sc.now, scenario: sc.scenario }), cfg, now: sc.now, store, demo: true });
  if (tweak) tweak(state);
  return state;
}
export const inside = (x, y, [rx, ry, rw, rh]) => x >= rx && x <= rx + rw && y >= ry && y <= ry + rh;
export const overlap = ([ax, ay, aw, ah], [bx, by, bw, bh]) => ax < bx + bw && bx < ax + aw && ay < by + bh && by < ay + ah;

export const freshStore = () => { const s = Object.fromEntries(Object.entries(EMPTY).map(([k, f]) => [k, f()])); s.prev = null; return s; };

/**
 * A demo world with one story set to a given age in minutes (the rest of the world is unchanged), scene recomputed.
 * type: release | milestone | harvest | raid | emergency | recovery
 */
export function atAge(name, type, minutes, tweak, id) {
  const state = world(name), now = new Date(state.generatedAt), iso = new Date(now.getTime() - minutes * 60000).toISOString();
  if (type === 'raid') { state.raid = { ...state.raid, at: iso, phase: minutes < 15 ? 'enter' : 'battle', active: true, done: false, won: undefined }; for (const e of state.events.active) if (e.type === 'raid') e.at = iso; }
  else if (type === 'emergency') { for (const r of state.repos) if (r.workflow === 'failing') r.lastFailAt = iso; for (const e of state.events.active) if (e.type === 'emergency') e.at = iso; }
  else if (type === 'recovery') { for (const r of state.repos) if (r.recoveredAt) r.recoveredAt = iso; for (const e of state.events.active) if (e.type === 'recovery') e.at = iso; }
  else {
    let e = state.events.active.find((x) => x.type === type);
    if (!e) { e = { id: `${type}:test`, type, title: type.toUpperCase(), icon: 'trophy', detail: 'TEST', at: iso, until: iso }; state.events.active.push(e); }
    if (id) e.id = id;
    e.at = iso; e.until = new Date(now.getTime() + 86400000).toISOString();
  }
  if (tweak) tweak(state);
  finalizeV2(state, { cfg, store: freshStore(), now });
  return state;
}
