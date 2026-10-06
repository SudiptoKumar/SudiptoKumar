// Builds the README block (between two markers). Everything else in README.md stays yours.
// V2: no navigation, no intro text, no legend, no lists. The page is a walk through the kingdom:
//   hero -> world -> event -> quests and power -> project districts -> trophies -> harvest -> history -> camp -> guild
import { esc } from './util.mjs';
import { rawUrl, repoUrl } from './config.mjs';
import { guildKind } from './render/guild.mjs';

export const START = '<!-- KINGDOM:START (generated: do not edit between these lines) -->';
export const END = '<!-- KINGDOM:END -->';

/** Only https links and mailto links from the config become guild banners. */
export const safeLink = (u) => (/^(https:\/\/[^\s"'<>]+|mailto:[^\s"'<>]+)$/i.test(String(u || '')) ? String(u) : null);

/** The guild links that are allowed: objects with a plain id and an https or mailto address. Anything else is ignored. */
export const linkList = (cfg) => (Array.isArray(cfg?.links) ? cfg.links : []).filter((l) => l && typeof l === 'object' && /^[a-z0-9-]{1,20}$/i.test(l.id || '') && safeLink(l.url));

export function buildBlock(state, cfg, now = new Date()) {
  const S = state, t = S.totals, base = rawUrl(cfg, 'renderer');
  const files = S.status?.assets || {};
  const has = (key) => files[key] !== 'empty';               // a picture that said "nothing to show" is left out
  const img = (file, alt, width = 720) => `<p align="center"><img src="${base}/${file}" width="${width}" alt="${esc(alt)}"></p>`;
  const issuesUrl = `${repoUrl(cfg)}/issues/new?template=`;
  const sc = S.scene, L = [START];
  const powerTier = S.world.power.tierName || '';

  // A. hero, B. world
  L.push(img('hero.svg', `Hero: ${S.profile.name}, level ${S.level} ${S.hero.class.title}. Title ${S.hero.title}. ${S.hero.status.toLowerCase()}. Quest: ${S.quests.current.title.toLowerCase()}.`));
  L.push(img('world.svg', `The living kingdom. It is ${S.time.phase}, the weather is ${S.weather}, the season is ${S.time.season}. The hero is ${sc.hero.state}. ${t.repos} repositories stand as buildings, ${t.issuesOpen} open issues wait as goblins, ${S.visitors.total} visitor flags.`));
  // C. world event, D. quests and power
  if (has('events') && S.world.events.length) { const ev = S.world.events[0]; L.push(img('events.svg', `World event: ${ev.title}${ev.detail ? ` — ${ev.detail}` : ''}. Phase: ${ev.phase}.`, 720)); }
  L.push(img('quest.svg', `Kingdom power ${S.power.value} of 100 (${powerTier}). Quests: ${S.quests.rows.map((q) => `${q.state.toLowerCase()} ${q.title.toLowerCase()}`).join(', ')}.`));
  // E. project districts: a skyline of the featured projects, then their links in one line
  if (has('districts') && S.featured.length) {
    L.push(img('districts.svg', `Project districts. Featured: ${S.featured.join(', ')}.`));
    const links = S.featured.map((n) => S.repos.find((r) => r.name === n)).filter((r) => r && /^https:\/\/[^\s"'<>]+$/i.test(String(r.url || ''))).map((r) => `<a href="${esc(r.url)}">${esc(r.name)}</a>`);   // only real https links
    if (links.length) L.push(`<p align="center"><sub>${links.join(' &nbsp;·&nbsp; ')}</sub></p>`);
  }
  // E2. castle and dungeon: the heart of the kingdom and its depths
  if (has('castle')) L.push(img('castle.svg', `The castle: heart of the ${powerTier.toLowerCase()}.`, 720));
  if (has('dungeon')) L.push(img('dungeon.svg', `The dungeon beneath the gate: where open issues wait as goblins.`, 720));
  // E3. V3 districts: war front, builder's yard, hero guild
  if (has('warfront')) L.push(img('warfront.svg', `The war front: defenses south of the gate.`, 720));
  if (has('builderyard')) L.push(img('builderyard.svg', `The builder's yard: where the kingdom grows.`, 720));
  if (has('heroguild')) L.push(img('heroguild.svg', `The hero guild: home base of ${S.hero.class.title}.`, 720));
  // F. trophy hall, G. harvest, H. history
  L.push(img('trophies.svg', `Trophy hall: ${S.achievements.count} of ${S.achievements.total} trophies unlocked.`));
  L.push(img('harvest.svg', `Harvest field: the last 26 weeks of contributions as crops. Streak ${S.streak} days.`));
  L.push(img('history.svg', `Kingdom history: the castle and the settlement over time. Level ${S.level} today.`));
  // I. visitor camp, with two small signposts for the actions
  L.push(img('visitors.svg', `Visitor camp: where visitors plant their flags.`));
  L.push('<p align="center">');
  L.push(`<a href="${issuesUrl}plant-your-flag.yml"><img src="${base}/ui/post-flag.svg" width="300" alt="Plant your flag"></a>&nbsp;`);
  L.push(`<a href="${issuesUrl}send-goblin-raid.yml"><img src="${base}/ui/post-raid.svg" width="300" alt="Send a goblin raid"></a>`);
  L.push('</p>');
  // J. guild
  const links = linkList(cfg);
  if (links.length) {
    L.push('<p align="center">');
    links.forEach((l, i) => L.push(`<a href="${esc(safeLink(l.url))}"><img src="${base}/ui/guild-${l.id.toLowerCase()}.svg" width="56" alt="${esc(l.label || guildKind(l.id).label)}"></a>${i < links.length - 1 ? '&nbsp;' : ''}`));
    L.push('</p>');
  }
  // a tiny light, linked to the technical notes
  L.push(`<p align="center"><a href="${repoUrl(cfg)}/blob/${cfg.branch}/KINGDOM.md"><img src="${base}/status.svg" height="22" alt="Kingdom status"></a></p>`);
  L.push(END);
  return L.join('\n');
}

export function injectBlock(readme, block) {
  const a = readme.indexOf('<!-- KINGDOM:START'), b = readme.indexOf(END);
  if (a === -1 || b === -1 || b < a) return null;
  return readme.slice(0, a) + block + readme.slice(b + END.length);
}
