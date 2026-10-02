// Repository kingdom: each important repository is a building. Its health shows on the building.
import { Pix, svgDoc, textW } from './pixel.mjs';
import { T, card, box, chip, header } from './ui.mjs';
import { drawIcon } from './sprites.mjs';
import { drawBuilding } from './buildings.mjs';
import { SKY, SEASONS, lighten, darken } from './palette.mjs';
import { truncate, fmt } from '../util.mjs';

const STATE = {
  active: { label: 'ACTIVE', bg: '#1f4a34', fg: '#a7f070', border: '#2f6b45' },
  building: { label: 'BUILDING', bg: '#5a3a14', fg: '#ffcd75', border: '#b07a1c' },
  failing: { label: 'ON FIRE', bg: '#5a1f2a', fg: '#ff9a9a', border: '#b13e53' },
  sleepy: { label: 'SLEEPY', bg: '#2b2e4d', fg: '#94b0c2', border: '#3a3f66' },
  dusty: { label: 'DUSTY', bg: '#3a3a44', fg: '#b8c2d0', border: '#555566' },
  abandoned: { label: 'RUINS', bg: '#3a2a2a', fg: '#c9a0a0', border: '#5a3a3a' },
  repaired: { label: 'REPAIRED', bg: '#1f4a34', fg: '#fff0a0', border: '#e0a030' },
};
const KIND = { castle: 'CASTLE', tower: 'TOWER', guild: 'GUILD', library: 'LIBRARY', workshop: 'WORKSHOP', mine: 'MINE', house: 'HOUSE' };
const ago = (d) => (d < 1 ? 'TODAY' : d < 60 ? `${d}D` : d < 700 ? `${Math.round(d / 30)}MO` : `${Math.round(d / 365)}Y`);

export function renderRepos(state, rctx = {}) {
  const W = 640;
  const max = rctx.cfg?.repoCards ?? 6;
  const list = state.repos.slice(0, max);
  const rows = Math.max(1, Math.ceil(list.length / 2));
  const more = state.repos.length - list.length;
  const H = 92 + rows * 252 + (more > 0 ? 52 : 8);
  const p = new Pix(1);
  card(p, W, H);
  header(p, W, 'REPOSITORY KINGDOM', 'house', state.meta.demo ? null : `${state.repos.length} REPOS`, T.dim);
  const SE = SEASONS[state.time.season];
  const sky = SKY[state.time.phase][1];
  const ground = state.time.phase === 'night' ? darken(SE.grass, 0.45) : SE.grass;
  if (!list.length) p.text('NO PUBLIC REPOSITORIES YET', W / 2, 160, 3, T.dim, { align: 'c' });
  list.forEach((r, i) => {
    const x = 24 + (i % 2) * 304, y = 84 + Math.floor(i / 2) * 252;
    const key = r.recovered && r.state !== 'failing' ? 'repaired' : r.state;
    const st = STATE[key] || STATE.active;
    box(p, x, y, 288, 240, { fill: T.panel, border: st.border });
    // picture
    p.r(x + 8, y + 8, 272, 118, sky).r(x + 8, y + 100, 272, 26, ground).r(x + 8, y + 100, 272, 3, lighten(ground, 0.2));
    if (state.time.phase === 'night') for (let k = 0; k < 8; k++) p.r(x + 20 + ((k * 61) % 250), y + 14 + ((k * 23) % 50), 3, 3, '#ffffff', 0.8);
    const lit = state.time.phase === 'night' || state.time.phase === 'evening';
    drawBuilding(p, r.archetype, x + 136, y + 108, 2, { state: r.state, recovered: r.recovered, name: r.name, tier: state.castle.tier, lit: lit && ['active', 'building'].includes(r.state), snow: state.time.season === 'winter' });
    p.r(x + 8, y + 8, 272, 118, '#000000', state.time.phase === 'night' ? 0.28 : 0).frame(x + 8, y + 8, 272, 118, 3, '#0e1024');
    p.r(x + 10, y + 10, textW(KIND[r.archetype] || 'HOUSE', 2.5) + 10, 22, '#14162b', 0.8).text(KIND[r.archetype] || 'HOUSE', x + 15, y + 15, 2.5, '#94b0c2');
    // text
    p.text(truncate(r.name, 14).toUpperCase(), x + 16, y + 138, 3, T.white);
    chip(p, x + 14, y + 168, st.label, { bg: st.bg, fg: st.fg, border: st.border, s: 3 });
    drawIcon(p, 'star', x + 16, y + 212, 2.5);
    p.text(fmt(r.stars), x + 42, y + 212, 3, T.gold);
    drawIcon(p, 'skull', x + 104, y + 212, 2.5);
    p.text(String(r.issues), x + 130, y + 212, 3, r.issues > 0 ? '#ef7d57' : T.dim);
    p.text(ago(r.pushedDays), x + 276, y + 212, 3, T.dim, { align: 'r' });
  });
  if (more > 0) p.text(`+ ${more} MORE REPOSITORIES IN THE VILLAGE`, W / 2, H - 38, 3, T.dim, { align: 'c' });
  return svgDoc({
    w: W, h: H, title: 'Repository kingdom',
    desc: `Repositories as buildings. ${list.map((r) => `${r.name}: ${r.state}${r.workflow === 'failing' ? ', workflow failing' : ''}`).join('. ')}.`,
    body: p.toString(), defs: p.defs.join(''),
  });
}
