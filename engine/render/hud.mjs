// The two compact strips (TRUE V2): the EVENT camera and the quest / power strip.
//
//  EVENT   a camera aimed at the place where the most important story is happening (the castle for a release, the gate for a raid, the failing
//          building for a CI alarm ...), so the picture shows the event in the world instead of describing it. Only exists while there is one.
//  QUEST   the kingdom's power and up to three quests, each with the icon of the object it points at. No stat tiles: stars, streak, CI and
//          activity already have their home in the world (RULE C), they are not repeated here.
import { Pix, svgDoc, textW } from './pixel.mjs';
import { T, TONE, card, box, bar, pctColor, demoRibbon } from './ui.mjs';
import { drawIcon } from './sprites.mjs';
import { fmt } from '../util.mjs';
import { renderCamera } from './camera.mjs';
import { pill, fitText } from './overlays.mjs';
import { buildWorld } from '../world/index.mjs';
import { aimCamera } from '../world/cameras.mjs';
import { ANCHORS } from '../world/layout.mjs';
import { kingdomTier } from '../world/lifecycle.mjs';
import { QUEST_TARGET } from '../world/homes.mjs';
import { TARGET_ICON, TRACK_COLOR } from '../world/quests.mjs';

// ---------------------------------------------------------------- the event camera
const PHASE_WORD = { start: 'STARTING', peak: 'NOW', aftermath: 'AFTERMATH' };

export function renderEvents(S, rctx = {}) {
  const chips = S.scene.hud;
  if (!chips.length) return null;
  const W = buildWorld(S, { cfg: rctx.cfg || {} }), ev = W.events[0];
  const at = ev?.at || { x: ANCHORS.castle.x, y: ANCHORS.castle.y };
  const cam = aimCamera('EVENT', { outW: 720, lod: 'far' }, at.x, at.y - 16, 96, 48);
  const desc = chips.map((c) => `${c.kind}: ${c.text}`).join('. ');
  return renderCamera(S, rctx, cam, {
    world: W, title: 'World events', desc: `${desc}. The picture shows the place where it happens.`,
    overlay: (K, h) => {
      const [main, ...rest] = chips, col = TONE[main.tone] || T.gold;
      const w = pill(h, 12, 12, main.icon, fitText(main.text, 470, 3), { color: col === T.red ? '#ff9a9a' : T.white, border: col });
      if (ev && PHASE_WORD[ev.phase]) pill(h, 12 + w + 8, 12, null, PHASE_WORD[ev.phase], { color: T.dim, border: '#3a3f66' });
      let x = 12; const y = K.cam.outH - 12 - 40;
      for (const c of rest.slice(0, 2)) x += pill(h, x, y, c.icon, c.kind, { color: T.white, border: TONE[c.tone] || T.gold }) + 8;
      if (S.meta.demo) demoRibbon(h, K.cam.outW);
    },
  });
}

// ---------------------------------------------------------------- quests and the kingdom's power
const STATE_ICON = { COMPLETE: 'check', LOCKED: 'lock' };

export function renderQuest(S, rctx = {}) {
  const W = 720, p = new Pix(1), rows = S.quests.rows, tier = kingdomTier(S.power.value), demo = S.meta.demo;
  const RH = 44, H = 106 + rows.length * RH + 14;
  card(p, W, H);
  // ---- kingdom power: a crown, the name of the tier, the number, one bar
  drawIcon(p, 'crown', 28, 22, 4);
  p.text(tier.name, 72, 28, 3, T.gold, { shadow: T.dark });
  p.text(String(S.power.value), demo ? W - 220 : W - 28, 14, 6, T.white, { align: 'r', shadow: T.dark });
  bar(p, 28, 66, W - 56, 24, S.power.value, { fill: pctColor(S.power.value) });
  // ---- the quests: the icon says WHERE in the kingdom the quest is (the same icon as the marker in the world)
  rows.forEach((q, i) => {
    const y = 106 + i * RH, done = q.state === 'COMPLETE', locked = q.state === 'LOCKED', active = q.state === 'ACTIVE';
    const track = TRACK_COLOR[q.track] || T.goldD;
    box(p, 28, y, W - 56, 40, { fill: done ? '#1c3a2c' : T.panel, border: done ? '#2e6b4a' : locked ? '#2b2e4d' : track, t: 3, n: 3 });
    const icon = active ? TARGET_ICON[QUEST_TARGET[q.track] || 'castle'] : STATE_ICON[q.state];
    p.raw(active ? '<g class="bob">' : '<g>');
    drawIcon(p, icon, 42, y + 8, 3, locked ? { A: '#566c86' } : undefined);
    p.raw('</g>');
    const col = locked ? '#566c86' : done ? T.green : T.white, tx = 82;
    const right = active && q.target > 1 ? 560 : W - 150;
    p.text(fitText(q.title, right - tx - 12, 3), tx, y + 10, 3, col);
    if (active && q.target > 1) {
      bar(p, 492, y + 9, 100, 22, q.pct, { fill: T.cyan });
      p.text(`${fmt(q.progress)}/${fmt(q.target)}`, W - 36, y + 10, 3, T.dim, { align: 'r' });
    } else if (done) p.text(q.xp ? `+${q.xp}` : 'OK', W - 40, y + 10, 3, T.green, { align: 'r' });
    else if (locked) drawIcon(p, 'lock', W - 70, y + 8, 3);
  });
  if (demo) demoRibbon(p, W);
  return svgDoc({
    w: W, h: H, title: 'Kingdom power and quests',
    desc: `Kingdom power ${S.power.value} of 100, ${tier.name.toLowerCase()}. Quests: ${rows.map((q) => `${q.state.toLowerCase()} ${q.title.toLowerCase()}`).join('; ')}.`,
    body: p.toString(), defs: p.defs.join(''),
  });
}
