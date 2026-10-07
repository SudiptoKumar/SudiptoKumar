// readme.mjs — README composer (spec §10).
// The README is a journey through one place, not a card dashboard:
// identity -> GRAND KINGDOM -> current story (conditional) -> hero journey ->
// districts -> history -> social/guild. Quiet states show daily life only —
// no invented drama. All user text escaped; alt text truthful, no metric dumps.
import { esc } from '../util.mjs';
import { isQuiet, activeStory } from './camera.mjs';

const img = (file, width, alt) =>
  `<img src="${esc(file)}" width="${width}" alt="${esc(alt)}"/>`;
const responsive = (desktop, mobile, alt) =>
  `<picture>\n  <source media="(max-width: 480px)" srcset="${esc(mobile)}"/>\n  ${img(desktop, 960, alt)}\n</picture>`;

function identitySection(world, snap) {
  const k = world.kingdom ?? {};
  const hero = (snap.actors ?? []).find((a) => a.id === 'hero');
  const clock = snap.clock ?? {};
  const heroLine = hero
    ? `**${esc(String(hero.name ?? 'Hero'))}** · ${esc(String(hero.class ?? (world.hero?.class ?? 'wanderer')))}`
    : 'No hero walks the roads today.';
  return `<!-- KINGDOM:START -->\n# ${esc(String(k.name ?? 'Kingdom'))}\n\n`
    + `${heroLine} · ${esc(clock.band ?? '')} ${esc(clock.season ?? '')} · ${esc(String(k.powerTier ?? ''))}\n\n`
    + `<sub><a href="#kingdom">Kingdom</a> · <a href="#story">Story</a> · <a href="#capital">Capital</a> ·`
    + ` <a href="#projects">Projects</a> · <a href="#farm">Farm</a> · <a href="#war">War</a> ·`
    + ` <a href="#history">History</a> · <a href="#guild">Guild</a></sub>\n`;
}

function grandSection(files, world, snap) {
  const clock = snap.clock ?? {};
  const alt = `The living kingdom of ${world.kingdom?.name ?? 'the realm'} at ${clock.band ?? 'day'}: `
    + `castle and capital at the heart, farms to the south, workshops and project halls to the east, the war front to the north.`;
  return `\n## <a id="kingdom"></a>Grand Kingdom\n\n${responsive(files.grand, files.grandMobile, alt)}\n`;
}

function storySection(world, snap, files) {
  const story = activeStory(world, snap);
  if (!story) return ''; // quiet: omit the dramatic panel (spec §10.9)
  const anchor = story.anchor ? ` near ${esc(String(story.anchor).replace(/_/g, ' '))}` : '';
  const phase = story.phase ? ` — ${esc(String(story.phase)).toLowerCase().replace(/_/g, ' ')}` : '';
  let s = `\n## <a id="story"></a>Current Story\n\n**${esc(String(story.title))}**${phase}${anchor}.\n`;
  if (files.event) {
    s += `\n${img(files.event, 640, `Close view of the current story: ${story.title}`)}\n`;
  }
  return s + '\n';
}

function heroSection(world, snap, files) {
  const hero = (snap.actors ?? []).find((a) => a.id === 'hero');
  if (!hero) return '';
  const dest = hero.destinationReason ?? hero.destinationKind ?? 'daily rounds';
  let s = `\n## Hero Journey\n\n**${esc(String(hero.name ?? 'Hero'))}** is ${esc(String(hero.state ?? 'idle').replace(/-/g, ' '))}`;
  s += ` — ${esc(String(hero.task ?? dest).slice(0, 90))}.\n`;
  if (files.hero) s += `\n${img(files.hero, 480, `${hero.name ?? 'The hero'} close view: ${hero.state ?? ''}`)}\n`;
  return s;
}

const DISTRICT_CAMERAS = [
  ['capital', 'Capital', 'The castle, royal plaza and hall of heroes.'],
  ['projects', 'Projects', 'Repository halls and workshops rising in the east.'],
  ['farm', 'Farm', 'Contribution fields, orchard and mill.'],
  ['guild', 'Guild', 'The hero guild and training ground.'],
  ['harbor', 'Harbor', 'Docks, ships and the visitor camp.'],
];

function districtSection(world, snap, files) {
  const warHot = snap.war && !['PEACE', 'RESOLVED'].includes(snap.war.state);
  const dungeonHot = (world.dungeon?.tier ?? 'dormant') !== 'dormant';
  const cams = [...DISTRICT_CAMERAS];
  if (warHot) cams.splice(3, 0, ['warfront', 'War', 'The northern war front.']);
  if (dungeonHot || warHot) cams.push(['dungeon', 'Dungeon', 'Issue pressure stirs below.']);
  // Quiet states: fewer cameras, daily life only.
  const pick = isQuiet(world, snap) ? cams.filter(([id]) => ['capital', 'farm', 'projects'].includes(id)) : cams;
  let s = '\n## World Districts\n';
  for (const [id, title, blurb] of pick) {
    if (!files.cameras[id]) continue;
    const anchor = id === 'warfront' ? 'war' : id;
    s += `\n### <a id="${anchor}"></a>${title}\n\n${blurb}\n\n${img(files.cameras[id], 640, `${title} district view`)}\n`;
  }
  return s;
}

function historySection(world, snap, files, state) {
  const repos = state?.repos?.list ?? [];
  const oldest = repos.length ? Math.max(...repos.map((r) => r.ageDays ?? 0)) : 0;
  const k = world.kingdom ?? {};
  let s = '\n## <a id="history"></a>History\n\n';
  s += `From a lone outpost to a **${esc(String(k.powerTier ?? 'town'))}**. `;
  if (oldest > 0) s += `The oldest halls have stood ${oldest} days. `;
  const hall = world.hall?.entries ?? [];
  if (hall.length) s += `${hall.length} ${hall.length === 1 ? 'trophy stands' : 'trophies stand'} in the Hall of Heroes. `;
  s += '\n';
  if (files.cameras.capital) {
    s += `\n${img(files.cameras.capital, 640, 'The capital today, seat of the evolving kingdom')}\n`;
  }
  return s;
}

function guildSection(world, snap) {
  const visitors = world.visitors?.entries ?? [];
  let s = '\n## <a id="guild"></a>Guild & Visitors\n\n';
  if (visitors.length) {
    s += 'Travelers at the harbor:\n\n';
    for (const v of visitors.slice(0, 8)) {
      const msg = v.message ? ` — “${esc(String(v.message).slice(0, 60))}”` : '';
      s += `- **${esc(String(v.login ?? 'traveler'))}** planted a ${v.kind === 'raid' ? 'raid banner' : 'flag'}${msg}\n`;
    }
    s += '\n';
  } else {
    s += 'No travelers at the harbor today. The roads are quiet.\n\n';
  }
  return s;
}

function linksSection(config) {
  const links = config?.links ?? {};
  const order = [['website', 'Kingdom status'], ['linkedin', 'LinkedIn'], ['x', 'X'], ['instagram', 'Instagram'], ['telegram', 'Telegram'], ['email', 'Email']];
  const items = order.filter(([k]) => links[k]).map(([k, label]) => `<a href="${esc(String(links[k]))}">${label}</a>`);
  const owner = config?.owner;
  if (owner) {
    items.push(`<a href="https://github.com/${esc(owner)}/${esc(owner)}/issues/new?title=Plant%20a%20flag">Plant a Flag</a>`);
    items.push(`<a href="https://github.com/${esc(owner)}/${esc(owner)}/issues/new?title=Send%20a%20raid">Send a Raid</a>`);
  }
  if (!items.length) return '';
  return `\n---\n\n<sub>${items.join(' · ')}</sub>\n`;
}

/**
 * @param {object} args.world, args.snap
 * @param {object} args.scenario { name, title }
 * @param {object} args.files { grand, grandMobile, cameras:{}, event?, hero? }
 * @param {object} args.config kingdom config (links/owner)
 * @param {object} args.state normalized state (optional, for history detail)
 * @param {string} args.provenance 'live' | 'offline-demo' | 'demo' — how the data was sourced
 * @returns markdown string
 */
export function composeReadme({ world, snap, scenario, files, config, state, provenance = 'live' }) {
  const provLine = provenance === 'offline-demo'
    ? '\n<sub>Offline demo snapshot — set <code>GH_TOKEN</code> and re-run <code>update</code> for live GitHub data.</sub>\n'
    : provenance === 'demo'
      ? '\n<sub>Deterministic demo scenario — no live data.</sub>\n'
      : '';
  const parts = [
    identitySection(world, snap),
    grandSection(files, world, snap),
    storySection(world, snap, files),
    heroSection(world, snap, files),
    districtSection(world, snap, files),
    historySection(world, snap, files, state),
    guildSection(world, snap),
    linksSection(config),
    `\n<sub>Scenario: ${esc(scenario?.name ?? 'live')} · rendered deterministically by Kingdom V3</sub>\n${provLine}\n<!-- KINGDOM:END -->\n`,
  ];
  return parts.join('\n');
}
