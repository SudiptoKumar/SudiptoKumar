// Builds the README block (between two markers). Everything else in README.md stays yours.
import { esc, fmt, hoursSince } from './util.mjs';
import { rawUrl, repoUrl } from './config.mjs';
import { NAV, ACTIONS } from './render/buttons.mjs';

export const START = '<!-- KINGDOM:START (generated: do not edit between these lines) -->';
export const END = '<!-- KINGDOM:END -->';
const EMOJI = { raid: '⚔️', emergency: '🔥', release: '🚀', milestone: '🏆', expansion: '👑', harvest: '🌾', nightstars: '🌌' };
const REPO_EMOJI = { building: '🚧', active: '🟢', failing: '🔥', sleepy: '💤', dusty: '🕸️', abandoned: '🏚️' };

export function timeAgo(iso, now) {
  const h = hoursSince(iso, now);
  if (h < 1) return 'just now';
  if (h < 48) return `${Math.round(h)}h ago`;
  const d = Math.round(h / 24);
  return d < 60 ? `${d}d ago` : `${Math.round(d / 30)}mo ago`;
}

export function buildBlock(state, cfg, now = new Date()) {
  const base = rawUrl(cfg, 'renderer');
  const img = (file, alt, width = 720) => `<p align="center"><img src="${base}/${file}" width="${width}" alt="${esc(alt)}"></p>`;
  const S = state, t = S.totals;
  const issuesUrl = `${repoUrl(cfg)}/issues/new?template=`;
  const L = [];
  L.push(START);
  // navigation
  L.push('<table align="center"><tr>');
  NAV.forEach(([id, label], i) => {
    L.push(`<td align="center"><a href="#${id}"><img src="${base}/ui/nav-${id}.svg" width="250" alt="${esc(label)}"></a></td>`);
    if (i % 2 === 1 && i < NAV.length - 1) L.push('</tr><tr>');
  });
  L.push('</tr></table>', '');
  L.push('<p align="center"><b>This is my kingdom.</b> GitHub activity keeps it alive.</p>', '');
  // hero
  L.push('<a id="character"></a>', img('hero.svg', `Character sheet: level ${S.level} ${S.hero.class.title}. ${S.hero.xpPct} percent to the next level. Streak ${S.streak} days, ${t.stars} stars.`), '');
  // world
  L.push('<a id="kingdom"></a>', img('world.svg', `The kingdom map. It is ${S.time.phase}, the weather is ${S.weather} and the season is ${S.season}. ${t.issuesOpen} open issues, ${t.stars} stars, level ${S.level}.`), '');
  L.push('<p align="center"><b>Today in the kingdom</b></p>', '');
  const ev = S.events.recent.slice(0, 5);
  if (ev.length) for (const e of ev) L.push(`- ${EMOJI[e.type] || '⭐'} **${e.title}**${e.detail ? ` · ${esc(e.detail)}` : ''} · ${timeAgo(e.at, now)}`);
  else L.push('- 🌤️ A quiet day in the kingdom.');
  L.push('', '<details>', '<summary><b>Map legend</b>: what every place means</summary>', '',
    '| Place | What it shows | Now |', '| --- | --- | --- |',
    `| Castle | Your level and your main repository | Level ${S.level} |`,
    `| Tower | Followers | ${fmt(t.followers)} |`,
    `| CI tower | Workflow health. Red lamp and fire mean a failed workflow | ${t.workflowHealth === null ? 'no workflows' : t.workflowHealth + '%'} |`,
    `| Shop | Commits. The workshop grows with them | ${fmt(t.commits)} |`,
    `| Library | Knowledge and docs repositories | ${S.repos.filter((r) => r.archetype === 'library').length} |`,
    `| Mine | Data repositories | ${S.repos.filter((r) => r.archetype === 'mine').length} |`,
    `| Vault | Stars become gold | ${fmt(t.stars)} stars |`,
    `| Shrine | Achievements | ${S.achievements.count}/${S.achievements.total} |`,
    `| Training grounds | Open pull requests | ${t.openPRs} |`,
    `| Farm | Contribution streak and recent work | ${S.streak} days |`,
    `| Forest | One tree for every language | ${S.languages.length} |`,
    `| Issue gate | Open issues are goblins | ${t.issuesOpen} |`,
    `| Dungeon | Archived repositories | ${t.archivedRepos} |`,
    `| Village | One house for each repository | ${t.repos} |`,
    `| Camp | Visitor flags | ${S.visitors.total} |`, '',
    '**What changes the map**', '',
    '| On GitHub | In the kingdom |', '| --- | --- |',
    '| A commit | The builder works. More commits make the workshop bigger |',
    '| Long quiet time | The builder sleeps, then rain comes |',
    '| A new repository | A new building appears |',
    '| An archived repository | The building becomes a ruin |',
    '| A star | More gold in the vault |', '| A fork | A traveler walks the road |',
    '| An open issue | A goblin waits at the gate. Ten or more bring a boss |', '| A closed issue | The goblin goes away |',
    '| A pull request | A courier runs between buildings |', '| A failed workflow | Fire and smoke. When fixed, the fire goes out |',
    '| A release | Fireworks, confetti and a banner |', '| A contribution streak | Golden crops grow on the farm |', '',
    '</details>', '');
  // stats
  L.push(img('stats.svg', `Kingdom statistics: population ${fmt(S.population.total)}, ${t.stars} stars, ${fmt(t.commits)} commits, ${t.issuesOpen} open issues, ${t.prs} pull requests.`), '');
  // achievements
  L.push('<a id="achievements"></a>', img('achievements.svg', `Achievement hall: ${S.achievements.visibleUnlocked} of ${S.achievements.visibleTotal} unlocked.`), '');
  // repositories
  L.push('<a id="repositories"></a>', img('repos.svg', 'Repository kingdom: each repository is a building.'), '');
  if (S.repos.length) {
    for (const r of S.repos.slice(0, 12)) L.push(`- ${REPO_EMOJI[r.state] || '🟢'} [${r.name}](${r.url}) · ⭐ ${fmt(r.stars)}${r.issues ? ` · 👹 ${r.issues}` : ''}${r.workflow === 'failing' ? ' · 🔥 workflow failing' : ''}`);
    L.push('');
  }
  // harvest + history
  L.push('<a id="harvest"></a>', img('harvest.svg', `Harvest field: the last 26 weeks of contributions as a farm. Current streak ${S.streak} days.`), '');
  L.push(img('history.svg', 'Kingdom history: level over time.'), '');
  // visit
  L.push('<a id="visit"></a>', img('visitors.svg', `Visitor camp: ${S.visitors.total} flags.`), '');
  L.push('<p align="center">');
  L.push(`<a href="${issuesUrl}plant-your-flag.yml"><img src="${base}/ui/action-flag.svg" width="340" alt="Plant your flag"></a><br>`);
  L.push(`<a href="${issuesUrl}send-goblin-raid.yml"><img src="${base}/ui/action-raid.svg" width="340" alt="Send a goblin raid"></a>`);
  L.push('</p>', '<p align="center"><sub>A bot checks every request. Only short plain text is shown. No links. Raids are harmless fun.</sub></p>', '');
  // status
  L.push(img('status.svg', 'Technical status of the kingdom engine.', 560), '');
  L.push(`<p align="center"><sub>Built by <a href="${repoUrl(cfg)}/blob/${cfg.branch}/KINGDOM.md">a GitHub Action</a>. The map is rebuilt from real GitHub activity.</sub></p>`);
  L.push(END);
  return L.join('\n');
}

export function injectBlock(readme, block) {
  const a = readme.indexOf('<!-- KINGDOM:START'), b = readme.indexOf(END);
  if (a === -1 || b === -1 || b < a) return null;
  return readme.slice(0, a) + block + readme.slice(b + END.length);
}
