#!/usr/bin/env node
// Contact sheets for visual review of the 20 demo scenarios.
// Reads ~/workspace/kingdom-v3/build/demos/<scenario>/ and writes five HTML
// sheets next to them. All SVGs scale via viewBox; text stays vector.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const DEMOS = path.join(ROOT, 'demos');
const SCENARIOS = [
  'peaceful-medium-day', 'prosperous-kingdom', 'quiet-night', 'release-peak',
  'fortress-failure', 'fortress-recovery', 'major-project-build', 'visitor-arrival',
  'achievement-unlocked', 'war-scouting', 'war-battle', 'war-aftermath',
  'war-recovery', 'winter-day', 'rainy-day', 'aurora-night', 'empty-account',
  '90-repositories', 'hostile-text', 'partial-github-failure',
];

const css = `body{font-family:monospace;background:#10141d;color:#dfe6f2;margin:0;padding:24px}
h1{font-size:20px}h2{font-size:15px;color:#e8b93c;margin:28px 0 8px}
.grid{display:flex;flex-wrap:wrap;gap:16px}
.card{background:#1a2130;border:1px solid #2c3a52;border-radius:8px;padding:10px;max-width:100%}
.card img{display:block;max-width:100%;height:auto;background:#0a0d14}
.card .t{font-size:12px;margin-top:6px;color:#9fb4cc}
.note{font-size:12px;color:#7a8ba0;max-width:900px}`;

const card = (scenario, file, width, label) => {
  const src = `${scenario}/${file}`;
  const full = path.join(DEMOS, src);
  if (!fs.existsSync(full)) return '';
  const kb = Math.round(fs.statSync(full).size / 1024);
  return `<div class="card"><img src="${src}" width="${width}" alt="${scenario} ${label}"/>`
    + `<div class="t">${scenario} · ${label} · ${kb} KiB</div></div>`;
};

const sheet = (title, note, body) =>
  `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>`
  + `<title>${title}</title><style>${css}</style></head><body><h1>${title}</h1>`
  + `<p class="note">${note}</p>${body}</body></html>`;

function build() {
  if (!fs.existsSync(DEMOS)) throw new Error(`demos dir missing: ${DEMOS} (run: node engine/cli.mjs demo)`);
  const have = SCENARIOS.filter((s) => fs.existsSync(path.join(DEMOS, s, 'grand.svg')));
  if (!have.length) throw new Error('no rendered scenarios found');

  // 1. contact-sheet.html — grand views across all scenarios.
  const contact = sheet('Kingdom V3 — Grand Views',
    'Whole-kingdom view (2048×1536 world) for every scenario. Castle → town → farm → projects → frontier should read at a glance.',
    `<div class="grid">${have.map((s) => card(s, 'grand.svg', 640, 'grand')).join('')}</div>`);
  fs.writeFileSync(path.join(DEMOS, 'contact-sheet.html'), contact);

  // 2. event-sheet.html — event cameras where the kingdom is loud.
  const loud = have.filter((s) => fs.existsSync(path.join(DEMOS, s, 'event.svg')));
  const event = sheet('Kingdom V3 — Event Cameras',
    '640×480 close views on the active story. Quiet scenarios correctly produce no event view.',
    `<div class="grid">${loud.map((s) => card(s, 'event.svg', 480, 'event')).join('')}</div>`
    + `<h2>Quiet scenarios (no event view — by design)</h2><p class="note">${have.filter((s) => !loud.includes(s)).join(', ')}</p>`);
  fs.writeFileSync(path.join(DEMOS, 'event-sheet.html'), event);

  // 3. day-night-sheet.html — lighting across bands.
  const bands = ['peaceful-medium-day', 'quiet-night', 'aurora-night', 'winter-day', 'rainy-day'];
  const daynight = sheet('Kingdom V3 — Day / Night / Weather',
    'Same world geometry under different light: morning, night (lit windows, lamp pools), aurora (night only), snow, rain.',
    ['grand', 'capital'].map((cam) =>
      `<h2>${cam}</h2><div class="grid">${bands.map((s) => card(s, `${s === 'peaceful-medium-day' || s === 'quiet-night' || s === 'aurora-night' ? cam : 'grand'}.svg`, 480, cam)).join('')}</div>`).join(''));
  fs.writeFileSync(path.join(DEMOS, 'day-night-sheet.html'), daynight);

  // 4. war-sheet.html — the war arc.
  const war = ['war-scouting', 'war-battle', 'war-aftermath', 'war-recovery'];
  const warSheet = sheet('Kingdom V3 — War Arc',
    'Same locations across war phases: scouting → battle → aftermath → recovery.',
    `<h2>warfront camera</h2><div class="grid">${war.map((s) => card(s, 'warfront.svg', 480, 'warfront')).join('')}</div>`
    + `<h2>grand</h2><div class="grid">${war.map((s) => card(s, 'grand.svg', 480, 'grand')).join('')}</div>`);
  fs.writeFileSync(path.join(DEMOS, 'war-sheet.html'), warSheet);

  // 5. mobile-sheet.html — grand world at 360 / 390 / 430 px widths.
  const widths = [360, 390, 430];
  const mobile = sheet('Kingdom V3 — Mobile',
    'Grand world at phone widths. The mobile variant targets ≤200 KiB; castle → town → farm → projects → frontier must stay legible.',
    widths.map((w) =>
      `<h2>${w}px</h2><div class="grid">${['peaceful-medium-day', 'release-peak', 'war-battle', 'aurora-night'].map((s) => card(s, 'grand-mobile.svg', w, `grand-mobile @${w}px`)).join('')}</div>`).join(''));
  fs.writeFileSync(path.join(DEMOS, 'mobile-sheet.html'), mobile);

  console.log(`contact sheets written to ${DEMOS}: contact-sheet.html, event-sheet.html, day-night-sheet.html, war-sheet.html, mobile-sheet.html`);
}

build();
