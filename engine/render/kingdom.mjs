// The overworld (TRUE V2): the first camera of the one kingdom. It shows the whole surface and the dungeon below it.
// All drawing is done by the shared pipeline in camera.mjs; this file only decides the few words allowed on the map.
import { Pix, textW } from './pixel.mjs';
import { ICON } from './sprites.mjs';
import { T } from './ui.mjs';
import { GW, U } from '../world/constants.mjs';
import { ANCHORS } from '../world/layout.mjs';
import { renderCamera } from './camera.mjs';

/** The only words that may appear on the map, decided by the scene. Everything else is drawn, not written. */
export function mapLabels(S) {
  const lb = S.scene.labels, out = [];
  if (lb.ci) out.push({ id: 'ci', text: 'CI ALERT', color: T.red, at: [ANCHORS.ci.x, ANCHORS.ci.y - 24] });
  if (lb.issues) out.push({ id: 'issues', text: `ISSUES ${lb.issues}`, color: lb.issues > 5 ? T.red : T.orange, at: [116, 213] });
  if (lb.raid) out.push({ id: 'raid', text: `DEFENSE ${S.raid.defense}%`, color: S.raid.defense >= S.raid.attack ? T.green : T.orange, at: [ANCHORS.gate.x, 166], bar: S.raid.defense });
  if (lb.event) { const ev = S.events.active.find((e) => e.type === lb.event); if (ev) out.push({ id: 'event', text: ev.title, color: lb.event === 'release' ? T.gold : T.red, at: [GW / 2, 30], icon: ev.icon }); }
  return out;
}

/** Plaques on the map (screen space). The event title is not drawn here: the event camera owns it (one visual home). */
export function drawMapLabels(K, h, { skip = ['event'] } = {}) {
  const { S } = K, [rx, ry, rw, rh] = K.cam.rect;
  for (const lb of mapLabels(S)) {
    if (skip.includes(lb.id)) continue;
    if (lb.at[0] < rx - 20 || lb.at[0] > rx + rw + 20 || lb.at[1] < ry - 4 || lb.at[1] > ry + rh) continue;
    const s = 3, w = textW(lb.text, s) + (lb.icon ? 36 : 14), x = Math.round(K.sx(lb.at[0]) - w / 2), y = Math.round(K.sy(lb.at[1]));
    h.r(x, y, w, 7 * s + 12, '#14162b', 0.9).r(x, y, w, 3, lb.color);
    h.text(lb.text, x + 7, y + 8, s, lb.color === T.red ? '#ff9a9a' : lb.color);
    if (lb.bar != null) h.r(x + 6, y + 7 * s + 6, w - 12, 5, '#0e1024').r(x + 6, y + 7 * s + 6, Math.round(((w - 12) * lb.bar) / 100), 5, lb.color);
  }
}

export function renderKingdom(S, rctx = {}) {
  const sc = S.scene, wx = sc.weather, ph = S.time.phase;
  const sky = ph === 'day' ? 'It is day' : `It is ${ph}`;
  const desc = `${sky}, ${wx.kind}, ${S.time.season}. Scene: ${sc.mode.toLowerCase()}. The hero is ${sc.hero.state}. Level ${S.level} castle with ${S.totals.repos} repositories as buildings. ${S.goblins.count} open issues as goblins. ${S.treasure.stars} stars in the vault. ${S.visitors.total} visitor flags.`;
  return renderCamera(S, rctx, 'OVERWORLD', {
    title: 'The living kingdom', desc,
    overlay: (K, h) => {
      if (S.meta.demo) { const W = K.cam.outW; h.r(W - 196, 8, 188, 34, '#b13e53').text('DEMO DATA', W - 102, 17, 3, T.white, { align: 'c' }); }
      drawMapLabels(K, h);
    },
  });
}
