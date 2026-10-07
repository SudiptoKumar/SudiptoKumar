// sprites.mjs — reusable <defs> sprite library (spec §09.4, §15).
// Original rect-based pixel art, 3/4 billboard convention: every sprite is
// anchored at its foot point (bottom-center); callers place with <use x y>
// where (x, y) is the foot. Native sizes documented per sprite.
// Colors come from the resolved palette so seasons/weather re-skin the set.
import { R, C, P, E } from './svg.mjs';

// --- trees ---------------------------------------------------------------
function pine(pal, snow) {
  const leaf = pal.leaf, dark = pal.grassDark, trunk = '#5a3d24';
  const cap = snow ? `<rect x="6" y="6" width="12" height="4" fill="${pal.snow}"/>` : '';
  return `<g id="k-pine" aria-hidden="true">`
    + `<rect x="10" y="26" width="4" height="8" fill="${trunk}"/>`
    + `<rect x="4" y="18" width="16" height="10" fill="${dark}"/>`
    + `<rect x="6" y="10" width="12" height="10" fill="${leaf}"/>`
    + `<rect x="8" y="2" width="8" height="10" fill="${leaf}"/>`
    + `<rect x="8" y="2" width="3" height="18" fill="${dark}" opacity="0.45"/>`
    + cap + `</g>`;
}
function oak(pal, snow) {
  const leaf = pal.leaf, alt = pal.leafAlt, trunk = '#5a3d24';
  return `<g id="k-oak" aria-hidden="true">`
    + `<rect x="10" y="22" width="5" height="12" fill="${trunk}"/>`
    + `<rect x="2" y="10" width="20" height="14" fill="${leaf}"/>`
    + `<rect x="6" y="4" width="12" height="10" fill="${alt}"/>`
    + `<rect x="2" y="10" width="6" height="14" fill="${pal.grassDark}" opacity="0.5"/>`
    + (snow ? `<rect x="6" y="4" width="12" height="4" fill="${pal.snow}"/>` : '')
    + `<rect x="11" y="6" width="3" height="6" fill="${alt}"/>`
    + `</g>`;
}
function bare(pal) {
  const b = '#4c3826';
  return `<g id="k-bare" aria-hidden="true">`
    + `<rect x="11" y="14" width="3" height="20" fill="${b}"/>`
    + `<rect x="4" y="8" width="8" height="3" fill="${b}"/>`
    + `<rect x="13" y="4" width="8" height="3" fill="${b}"/>`
    + `<rect x="9" y="18" width="6" height="3" fill="${b}"/>`
    + `</g>`;
}

// --- small props ----------------------------------------------------------
function bush(pal) {
  return `<g id="k-bush" aria-hidden="true">`
    + `<rect x="0" y="4" width="14" height="8" fill="${pal.leaf}"/>`
    + `<rect x="3" y="1" width="8" height="6" fill="${pal.leafAlt}"/>`
    + `<rect x="0" y="4" width="4" height="8" fill="${pal.grassDark}" opacity="0.5"/></g>`;
}
function rock(pal) {
  return `<g id="k-rock" aria-hidden="true">`
    + `<polygon points="0,10 4,2 12,0 16,8 12,12 2,12" fill="${pal.stone}"/>`
    + `<polygon points="4,2 12,0 10,5 5,6" fill="${pal.stoneLight}"/></g>`;
}
function tuft(pal) {
  const g = pal.grassDark;
  return `<g id="k-tuft" aria-hidden="true">`
    + `<rect x="0" y="2" width="2" height="5" fill="${g}"/>`
    + `<rect x="3" y="0" width="2" height="7" fill="${g}"/>`
    + `<rect x="6" y="3" width="2" height="4" fill="${g}"/></g>`;
}
function flower(pal) {
  const c = pal.seasonAccent ?? '#f2a4c0';
  return `<g id="k-flower" aria-hidden="true">`
    + `<rect x="3" y="4" width="2" height="7" fill="${pal.grassDark}"/>`
    + `<rect x="1" y="0" width="3" height="3" fill="${c}"/>`
    + `<rect x="4" y="1" width="3" height="3" fill="${c}"/>`
    + `<rect x="2" y="3" width="4" height="2" fill="#ffffff" opacity="0.7"/></g>`;
}
function fence(pal) {
  const w = pal.wood, d = pal.woodDark;
  return `<g id="k-fence" aria-hidden="true">`
    + `<rect x="0" y="0" width="4" height="12" fill="${d}"/>`
    + `<rect x="28" y="0" width="4" height="12" fill="${d}"/>`
    + `<rect x="0" y="2" width="32" height="3" fill="${w}"/>`
    + `<rect x="0" y="7" width="32" height="3" fill="${w}"/></g>`;
}
function lampPost(pal) {
  return `<g id="k-lamp" aria-hidden="true">`
    + `<rect x="4" y="8" width="3" height="20" fill="#3a3f4a"/>`
    + `<rect x="1" y="0" width="9" height="9" fill="#20242e"/>`
    + `<rect x="3" y="2" width="5" height="5" fill="#f7d774" class="k-lampglass"/>`
    + `<rect x="0" y="8" width="11" height="2" fill="#3a3f4a"/></g>`;
}
function pennant() {
  // pennant string segment: 32u wide, caller tints via CSS vars — no, plain fill param impossible on use.
  // Instead three color variants are defined; caller picks.
  return '';
}

// --- patterns --------------------------------------------------------------
function patterns(pal) {
  return `<pattern id="k-grass" width="16" height="16" patternUnits="userSpaceOnUse">`
    + `<rect width="16" height="16" fill="${pal.grass}"/>`
    + `<rect x="3" y="4" width="2" height="2" fill="${pal.grassDark}"/>`
    + `<rect x="11" y="9" width="2" height="2" fill="${pal.grassDark}"/>`
    + `<rect x="7" y="12" width="2" height="2" fill="${pal.grassLight}"/>`
    + `<rect x="13" y="2" width="2" height="2" fill="${pal.grassLight}"/></pattern>`
    + `<pattern id="k-cobble" width="24" height="24" patternUnits="userSpaceOnUse">`
    + `<rect width="24" height="24" fill="#a89a7e"/>`
    + `<rect x="1" y="1" width="10" height="10" fill="#bcad8b"/>`
    + `<rect x="13" y="1" width="10" height="10" fill="#b3a482"/>`
    + `<rect x="1" y="13" width="10" height="10" fill="#b7a986"/>`
    + `<rect x="13" y="13" width="10" height="10" fill="#bcad8b"/>`
    + `<rect x="1" y="1" width="10" height="2" fill="#cbbd97"/></pattern>`
    + `<pattern id="k-water" width="32" height="16" patternUnits="userSpaceOnUse">`
    + `<rect width="32" height="16" fill="${pal.water}"/>`
    + `<rect x="4" y="4" width="8" height="2" fill="${pal.waterFoam}" opacity="0.6"/>`
    + `<rect x="20" y="10" width="8" height="2" fill="${pal.waterFoam}" opacity="0.6"/></pattern>`
    + `<pattern id="k-till" width="16" height="16" patternUnits="userSpaceOnUse">`
    + `<rect width="16" height="16" fill="${pal.dirt}"/>`
    + `<rect x="0" y="6" width="16" height="3" fill="${pal.dirtDark}"/>`
    + `<rect x="0" y="14" width="16" height="2" fill="${pal.dirtDark}" opacity="0.7"/></pattern>`;
}

// --- gradients (per-render; colors come from lighting) ----------------------
export function gradientDefs(light) {
  const [s0, s1, s2] = light.sky;
  return `<linearGradient id="k-sky" x1="0" y1="0" x2="0" y2="1">`
    + `<stop offset="0" stop-color="${s0}"/><stop offset="0.55" stop-color="${s1}"/>`
    + `<stop offset="1" stop-color="${s2}"/></linearGradient>`
    + `<linearGradient id="k-waterg" x1="0" y1="0" x2="0" y2="1">`
    + `<stop offset="0" stop-color="${light.waterTop}"/><stop offset="1" stop-color="${light.waterDeep}"/></linearGradient>`
    + `<radialGradient id="k-lampg">`
    + `<stop offset="0" stop-color="#ffd98a" stop-opacity="0.55"/>`
    + `<stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient>`
    + `<radialGradient id="k-fireg">`
    + `<stop offset="0" stop-color="#ffe9a0"/><stop offset="0.5" stop-color="#ff9e3c"/>`
    + `<stop offset="1" stop-color="#e0523c" stop-opacity="0"/></radialGradient>`
    + `<radialGradient id="k-smokeg">`
    + `<stop offset="0" stop-color="#5a5f6a" stop-opacity="0.75"/>`
    + `<stop offset="1" stop-color="#5a5f6a" stop-opacity="0"/></radialGradient>`
    + `<linearGradient id="k-aurora" x1="0" y1="0" x2="0" y2="1">`
    + `<stop offset="0" stop-color="#4fe0c0" stop-opacity="0.0"/>`
    + `<stop offset="0.5" stop-color="#4fe0c0" stop-opacity="0.5"/>`
    + `<stop offset="1" stop-color="#9a6ff0" stop-opacity="0.0"/></linearGradient>`;
}

/** Full <defs> block for one render. `light` from lighting.mjs, `pal` resolved palette. */
export function buildDefs(pal, light) {
  const snow = pal.season === 'winter';
  return `<defs>${patterns(pal)}${gradientDefs(light)}`
    + pine(pal, snow) + oak(pal, snow) + bare(pal)
    + bush(pal) + rock(pal) + tuft(pal) + flower(pal) + fence(pal) + lampPost(pal)
    + `</defs>`;
}

// Sprite foot offsets (height above the <use> foot point) for culling bounds.
export const SPRITE_H = { 'k-pine': 34, 'k-oak': 34, 'k-bare': 34, 'k-bush': 12, 'k-rock': 12, 'k-tuft': 7, 'k-flower': 11, 'k-fence': 12, 'k-lamp': 28 };
export { R, C, P, E };
