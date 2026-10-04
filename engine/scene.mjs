// The scene (V2). world state in -> one small, plain, deterministic description of what the world looks like now out.
// No random numbers and no wall clock: the only "time" is state.time and the ages of events in the state.
// The same state always gives the same scene, so the same SVG. A new frame appears only when the world changes.
import { hoursSince, hash32, clamp, truncate } from './util.mjs';
import { EVENT_FX, EVENT_INFO, byRank } from './events.mjs';

/** Highest priority first. The first one that applies is the mood of the whole kingdom. */
export const SCENE_MODES = ['RAID', 'DANGER', 'STORM', 'RECOVERY', 'CELEBRATION', 'HARVEST', 'RAIN', 'SLEEP', 'NIGHT', 'WORKING', 'ACTIVE', 'IDLE'];
export const HERO_STATES = ['idle', 'working', 'walking', 'sleeping', 'celebrating', 'fighting', 'traveling'];
export const FRAME_SLOTS = 8;

// ---------------------------------------------------------------- sequences (what the beat is, by age)
export const failStage = (h) => (h < 2 ? 'warning' : h < 8 ? 'alarm' : h < 24 ? 'smoke' : 'fire');
export const repairStage = (h) => (h < 6 ? 'firefighter' : h < 18 ? 'repair' : h < 36 ? 'fade' : null);
export const buildStage = (h) => (h < 24 ? 'foundation' : h < 72 ? 'builders' : h < 168 ? 'construction' : null);
export const visitorStage = (h) => (h < 6 ? 'arriving' : h < 48 ? 'camping' : 'settled');
export const releaseStage = (h) => (h < 12 ? 'peak' : 'afterglow');

// ---------------------------------------------------------------- hero
function pickHero({ S, has, failing, flags, victory }) {
  const phase = S.time.phase, H = S.hero, R = S.raid || {};
  if (R.active) return { state: 'fighting', spot: 'gate', why: 'raid', label: 'DEFENDING THE GATE' };
  if (failing.length) return { state: 'working', spot: 'ci', why: 'emergency', label: 'FIXING THE CI' };
  if (flags.RECOVERY) return { state: 'working', spot: 'ci', why: 'recovery', label: 'REPAIRING THE CI' };
  if (has('release')) return { state: 'celebrating', spot: 'plaza', why: 'release', label: 'CELEBRATING A RELEASE' };
  if (has('harvest')) return { state: 'celebrating', spot: 'farm', why: 'harvest', label: 'HARVEST FESTIVAL' };
  if (victory) return { state: 'celebrating', spot: 'gate', why: 'victory', label: 'VICTORY AT THE GATE' };
  if (has('milestone')) return { state: 'celebrating', spot: 'plaza', why: 'milestone', label: 'CELEBRATING A MILESTONE' };
  if (phase === 'night') return { state: 'sleeping', spot: 'home', why: 'night', label: 'RESTING FOR THE NIGHT' };
  if (H.sleeping) return { state: 'sleeping', spot: 'home', why: 'quiet', label: 'SLEEPING IN' };
  if (phase === 'evening') return { state: 'traveling', spot: 'road', why: 'evening', label: 'WALKING HOME' };
  if (phase === 'dawn') return { state: 'traveling', spot: 'road', why: 'dawn', label: 'HEADING TO WORK' };
  if (H.activity === 'high') return { state: 'working', spot: 'castle', why: 'busy', label: 'BUILDING THE KINGDOM' };
  if (H.activity === 'normal') return { state: 'working', spot: 'farm', why: 'tending', label: 'TENDING THE FARM' };
  return { state: 'idle', spot: 'plaza', why: 'idle', label: 'WAITING FOR A QUEST' };
}

// ---------------------------------------------------------------- people (counts only; the renderer places them)
/**
 * Role rules. All deterministic, all from real numbers:
 *   builders     one for each building that was pushed in the last 3 days (at most 6)
 *   farmers      commits of the last 7 days / 25, rounded up (at most 5); none while the hero sleeps
 *   miners       1 + number of data repositories (at most 3)
 *   guards       2 at the gate + open issues (at most 4 more) + 2 during a raid
 *   merchants    stars / 8, rounded up (at most 4)
 *   librarians   knowledge repositories (at most 3)
 *   researchers  research repositories, +1 when you write 4 or more languages (at most 2)
 *   messengers   open pull requests + 1 for a fresh release + 1 for forks (at most 3)
 *   villagers    population / 220 (2 to 8)
 */
export function npcRoster(S, has) {
  const repos = S.repos || [], t = S.totals || {};
  const live = repos.filter((r) => r.state !== 'abandoned');
  const week = (S.calendar || []).slice(-7).reduce((a, d) => a + (d.count || 0), 0);
  const kind = (k) => live.filter((r) => r.archetype === k).length;
  return {
    builder: clamp(repos.filter((r) => r.state === 'building').length, 0, 6),
    farmer: S.hero?.sleeping ? 0 : clamp(Math.ceil(week / 25), 0, 5),
    miner: clamp(1 + kind('mine'), 1, 3),
    guard: clamp(2 + Math.min(4, t.issuesOpen || 0) + (S.raid?.active ? 2 : 0), 2, 8),
    merchant: clamp(Math.ceil((t.stars || 0) / 8), 0, 4),
    librarian: clamp(kind('library'), 0, 3),
    researcher: clamp(kind('lab') + ((S.languages || []).length >= 4 ? 1 : 0), 0, 2),
    messenger: clamp((t.openPRs || 0) + (has('release') ? 1 : 0) + ((t.forks || 0) > 0 ? 1 : 0), 0, 3),
    villager: clamp(Math.round((S.population?.total || 0) / 220), 2, 8),
  };
}

// ---------------------------------------------------------------- the scene
export function buildScene(S, now = new Date(S.generatedAt || 0)) {
  const T = S.time, H = S.hero, R = S.raid || { active: false }, repos = S.repos || [];
  const ev = (S.events?.active || []).slice().sort(byRank);
  const has = (t) => ev.some((e) => e.type === t);
  const phase = T.phase, weather = S.weather, season = T.season;
  const failing = repos.filter((r) => r.workflow === 'failing');
  const recovering = repos.filter((r) => r.workflow !== 'failing' && r.recoveredAt && hoursSince(r.recoveredAt, now) < 48);
  const victory = !!(R.done && R.won);
  const stormy = weather === 'storm' || weather === 'thunderstorm';

  const flags = {
    RAID: !!R.active,
    DANGER: failing.length > 0 || S.goblins?.tier === 'boss' || !!(R.done && !R.won),
    STORM: stormy,
    RECOVERY: recovering.length > 0 && failing.length === 0,
    CELEBRATION: has('release') || has('milestone') || victory,
    HARVEST: has('harvest'),
    RAIN: weather === 'rain',
    SLEEP: !!H.sleeping,
    NIGHT: phase === 'night',
    WORKING: H.activity !== 'low' || repos.some((r) => r.state === 'building'),
    ACTIVE: (H.streak?.idleDays ?? 99) <= 7,
  };
  const modes = SCENE_MODES.filter((m) => flags[m]);
  if (!modes.length) modes.push('IDLE');

  const hero = pickHero({ S, has, failing, flags, victory });
  const npcs = npcRoster(S, has);

  // events -> effects (the table lives in events.mjs)
  const fx = new Set();
  let accent = null;
  for (const e of ev) {
    const f = EVENT_FX[e.type];
    if (!f) continue;
    f.fx.forEach((x) => fx.add(x));
    if (!accent && f.light) accent = f.light;
  }
  if (victory) { fx.add('banner'); fx.add('confetti'); accent = accent || 'gold'; }
  if (R.active) accent = 'danger';

  // light
  const dark = phase === 'night' || phase === 'evening' || stormy;
  const light = {
    phase, windows: dark || phase === 'dawn', torches: phase !== 'day' || stormy,
    moon: phase === 'night', accent, danger: failing.map((r) => r.name), gate: !!R.active || S.goblins?.tier === 'boss',
    repair: recovering.map((r) => r.name), gold: has('milestone') || has('harvest') || (S.achievements?.list || []).some((a) => a.isNew),
  };

  // weather as a world layer
  const wx = {
    kind: weather, rain: weather === 'rain' ? 1 : weather === 'storm' ? 2 : weather === 'thunderstorm' ? 3 : 0,
    lightning: weather === 'thunderstorm', snow: season === 'winter' && weather !== 'rain' && !stormy,
    aurora: weather === 'aurora' ? (phase === 'night' ? 1 : phase === 'day' ? 0.25 : 0.6) : 0,
    sunrise: weather === 'sunrise', wet: weather === 'rain' || stormy, frozen: season === 'winter', season,
  };

  // behaviour of people
  const behavior = {
    home: phase === 'night' || !!H.sleeping, returning: phase === 'evening', shelter: wx.rain > 0,
    patrol: phase === 'night' || !!R.active, farmersIn: !!H.sleeping || phase === 'night' || wx.rain > 0,
  };

  // sequences: what beat each story is in, from the age of the thing that started it
  const age = (iso) => hoursSince(iso || now.toISOString(), now);
  const stages = {
    fail: Object.fromEntries(failing.map((r) => [r.name, failStage(age(r.lastFailAt))])),
    repair: Object.fromEntries(recovering.map((r) => [r.name, repairStage(age(r.recoveredAt))]).filter(([, v]) => v)),
    build: Object.fromEntries(repos.filter((r) => r.state !== 'abandoned' && r.createdAt && buildStage(age(r.createdAt))).map((r) => [r.name, buildStage(age(r.createdAt))])),
    release: has('release') ? releaseStage(age(ev.find((e) => e.type === 'release').at)) : null,
    visitor: S.visitors?.flags?.length ? { n: S.visitors.flags[0].n, stage: visitorStage(age(S.visitors.flags[0].at)) } : null,
    raid: R.phase || 'idle',
  };

  // a release is a story too: the first 12 hours are the party (fireworks, confetti), after that the castle just keeps its lights and banners
  if (stages.release === 'afterglow') { fx.delete('fireworks'); if (!has('milestone') && !victory) fx.delete('confetti'); }
  // the hero holds an umbrella in the rain (unless asleep or fighting)
  hero.umbrella = wx.rain > 0 && hero.state !== 'sleeping' && hero.state !== 'fighting';

  // labels: the only words allowed on the map. Everything else is drawn, not written.
  const top = ev[0];
  const labels = {
    ci: failing.length > 0,
    issues: (S.totals?.issuesOpen || 0) > 0 ? S.totals.issuesOpen : 0,
    raid: !!R.active,
    event: top && ['emergency', 'release'].includes(top.type) ? top.type : null,        // a raid already has its defense plaque
  };

  const frame = hash32([T.date, phase, modes[0], hero.state, ev.map((e) => e.id).sort().join(',')].join('|')) % FRAME_SLOTS;
  return { mode: modes[0], modes, frame, hero, npcs, light, weather: wx, behavior, stages, fx: [...fx], labels, hud: worldEventHud(S, ev) };
}

// ---------------------------------------------------------------- the World Event HUD (at most three short chips)
const nice = (s, n) => truncate(String(s || '').toUpperCase(), n);
export function worldEventHud(S, ev = (S.events?.active || []).slice().sort(byRank)) {
  const chips = [];
  const R = S.raid || {};
  const first = (t) => ev.find((e) => e.type === t);
  if (R.active) chips.push({ kind: 'RAID', text: R.phase === 'enter' ? 'GOBLINS MARCH' : 'BATTLE AT THE GATE', icon: 'skull', tone: 'danger' });
  else if (R.done) chips.push({ kind: 'RAID', text: R.won ? 'DEFEATED' : 'GATE BREACHED', icon: 'skull', tone: R.won ? 'good' : 'danger' });
  const em = first('emergency');
  if (em) chips.push({ kind: 'ALERT', text: `${nice(em.detail, 12)} CI DOWN`, icon: 'flame', tone: 'danger' });
  const rc = first('recovery');
  if (rc) chips.push({ kind: 'REPAIR', text: 'CI IS FIXED', icon: 'check', tone: 'good' });
  const rel = first('release');
  if (rel) chips.push({ kind: 'RELEASE', text: nice(rel.detail, 18), icon: 'rocket', tone: 'gold' });
  const ms = ev.find((e) => e.type === 'milestone');
  if (ms) {
    const id = String(ms.id || '');
    const text = id.startsWith('levelup:') ? `${nice(ms.detail, 12)} REACHED` : id.startsWith('stars:') ? `${nice(ms.detail, 12)} EARNED` : id.startsWith('quest:') ? nice(ms.detail, 22) : `${nice(ms.detail, 16)} UNLOCKED`;
    chips.push({ kind: id.startsWith('quest:') ? 'QUEST' : 'EVENT', text, icon: 'trophy', tone: 'gold' });
  }
  const hv = first('harvest');
  if (hv) chips.push({ kind: 'HARVEST', text: nice(hv.detail, 20), icon: 'wheat', tone: 'gold' });
  const ex = ev.filter((e) => e.type === 'expansion');
  if (ex.length) chips.push({ kind: 'BUILD', text: ex.length > 1 ? `${ex.length} NEW PROJECTS` : nice(ex[0].detail, 18), icon: 'house', tone: 'info' });
  if (first('nightstars')) chips.push({ kind: 'NIGHT', text: 'A SKY FULL OF STARS', icon: 'star', tone: 'info' });
  return chips.slice(0, 3);
}
export { EVENT_INFO };
