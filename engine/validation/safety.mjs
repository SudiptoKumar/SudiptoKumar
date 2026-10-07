// Safety: SVG lint + visitor-text sanitization (adapted from prior safety.mjs).
// Nothing a visitor types is ever drawn without passing through here.
import { esc } from '../util.mjs';

export const LOGIN_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
export const isLogin = (s) => typeof s === 'string' && LOGIN_RE.test(s);

/**
 * Returns a list of problems. Empty list => safe to publish.
 * Extended vs prior: also rejects vbscript:, data:text/html, CSS expression(),
 * and non-image data URIs.
 */
export function lintSvg(svg, { maxBytes = 600_000 } = {}) {
  const bad = [];
  const size = Buffer.byteLength(svg);
  if (size > maxBytes) bad.push(`too big (${size} bytes)`);
  if (!svg.startsWith('<svg ') || !svg.trimEnd().endsWith('</svg>')) bad.push('not a single <svg> document');
  const rules = [
    [/<script/i, 'script tag'],
    [/<foreignObject/i, 'foreignObject'],
    [/<iframe|<embed|<object/i, 'embedded content'],
    [/\son[a-z]+\s*=/i, 'event handler'],
    [/javascript:/i, 'javascript url'],
    [/vbscript:/i, 'vbscript url'],
    [/@import/i, 'css import'],
    [/expression\s*\(/i, 'css expression'],
    [/url\(\s*['"]?\s*(?!#)/i, 'external css url'],
    [/<!ENTITY|<!DOCTYPE/i, 'entity or doctype'],
    [/<link|<meta/i, 'link or meta tag'],
  ];
  for (const [re, name] of rules) if (re.test(svg)) bad.push(name);
  for (const m of svg.matchAll(/(?:xlink:)?href="([^"]*)"/g)) {
    const v = m[1];
    if (v.startsWith('#')) continue;
    if (/^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(v)) continue;
    if (/^data:text\/html/i.test(v)) { bad.push('html data uri'); continue; }
    bad.push(`bad href: ${v.slice(0, 40)}`);
  }
  // tags must be balanced (cheap check)
  const stack = [];
  for (const m of svg.matchAll(/<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g)) {
    const [, close, name, , self] = m;
    if (self) continue;
    if (!close) stack.push(name);
    else if (stack.pop() !== name) { bad.push(`unbalanced tag </${name}>`); break; }
  }
  if (stack.length) bad.push(`unclosed tag <${stack[stack.length - 1]}>`);
  // every id must be unique
  const seen = new Set();
  for (const m of svg.matchAll(/\sid="([^"]+)"/g)) {
    if (seen.has(m[1])) { bad.push(`duplicate id ${m[1]}`); break; }
    seen.add(m[1]);
  }
  return bad;
}

const ALLOWED = /^[\p{L}\p{M}\p{N} .,!?'’:\-]+$/u;
// Reject link-ish text AND script-scheme text ("javascript:foo" is inert
// as rendered text, but it trips the SVG safety lint when published —
// a plantable publish blocker. Rejected at the boundary instead.)
const URLISH = /(https?:|www\.|\.com|\.net|\.org|\.io|\.ru|\.xyz|\.onion|t\.me|bit\.ly|@[a-z0-9_]{2,}|javascript:|vbscript:)/i;
/** Clean a visitor message. Only plain text is kept. */
export function sanitizeMessage(raw, { bannedWords = [], max = 32 } = {}) {
  let t = String(raw ?? '').normalize('NFKC');
  t = t.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return { ok: false, reason: 'EMPTY_MESSAGE' };
  if (t.length > max) return { ok: false, reason: 'MESSAGE_TOO_LONG' };
  if (URLISH.test(t)) return { ok: false, reason: 'LINKS_NOT_ALLOWED' };
  if (!ALLOWED.test(t)) return { ok: false, reason: 'BAD_CHARACTERS' };
  if (/(.)\1{5,}/u.test(t)) return { ok: false, reason: 'LOOKS_LIKE_SPAM' };
  const letters = t.replace(/[^\p{L}]/gu, '');
  if (letters.length > 10 && letters === letters.toUpperCase() && letters !== letters.toLowerCase()) {
    return { ok: false, reason: 'LOOKS_LIKE_SPAM' };
  }
  const low = t.toLowerCase();
  if (bannedWords.some((w) => w && low.includes(String(w).toLowerCase()))) {
    return { ok: false, reason: 'LOOKS_LIKE_SPAM' };
  }
  return { ok: true, text: t };
}

/** Check avatar bytes before embedding: PNG/JPEG/WebP/GIF only, small. */
export function checkAvatarBytes(buf, maxBytes = 30_000) {
  if (!buf || buf.length < 8 || buf.length > maxBytes) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return 'image/webp';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif';
  return null;
}
export { esc };
