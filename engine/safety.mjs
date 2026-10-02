// Safety rules (plan section 24). Nothing a visitor types is ever drawn without passing through here.
import { esc } from './util.mjs';

export const LOGIN_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
export const isLogin = (s) => typeof s === 'string' && LOGIN_RE.test(s);

/** Returns a list of problems. An empty list means the picture is safe to publish. */
export function lintSvg(svg, { maxBytes = 600_000 } = {}) {
  const bad = [];
  const size = Buffer.byteLength(svg);
  if (size > maxBytes) bad.push(`too big (${size} bytes)`);
  if (!svg.startsWith('<svg ') || !svg.trimEnd().endsWith('</svg>')) bad.push('not a single <svg> document');
  const rules = [
    [/<script/i, 'script tag'], [/<foreignObject/i, 'foreignObject'], [/<iframe|<embed|<object/i, 'embedded content'],
    [/\son[a-z]+\s*=/i, 'event handler'], [/javascript:/i, 'javascript url'], [/@import/i, 'css import'],
    [/url\(\s*['"]?\s*(?!#)/i, 'external css url'], [/<!ENTITY|<!DOCTYPE/i, 'entity or doctype'], [/<link|<meta/i, 'link or meta tag'],
  ];
  for (const [re, name] of rules) if (re.test(svg)) bad.push(name);
  for (const m of svg.matchAll(/(?:xlink:)?href="([^"]*)"/g)) {
    const v = m[1];
    if (v.startsWith('#')) continue;
    if (/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(v)) continue;
    bad.push(`bad href: ${v.slice(0, 40)}`);
  }
  // tags must be balanced (cheap check, our pictures are simple)
  const stack = [];
  for (const m of svg.matchAll(/<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g)) {
    const [, close, name, , self] = m;
    if (self) continue;
    if (!close) stack.push(name);
    else if (stack.pop() !== name) { bad.push(`unbalanced tag </${name}>`); break; }
  }
  if (stack.length) bad.push(`unclosed tag <${stack[stack.length - 1]}>`);
  return bad;
}

const ALLOWED = /^[\p{L}\p{M}\p{N} .,!?'’:\-]+$/u;
const URLISH = /(https?:|www\.|\.com|\.net|\.org|\.io|\.ru|\.xyz|t\.me|bit\.ly|@[a-z0-9_]{2,})/i;
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
  if (letters.length > 10 && letters === letters.toUpperCase() && letters !== letters.toLowerCase()) return { ok: false, reason: 'LOOKS_LIKE_SPAM' };
  const low = t.toLowerCase();
  if (bannedWords.some((w) => w && low.includes(String(w).toLowerCase()))) return { ok: false, reason: 'LOOKS_LIKE_SPAM' };
  return { ok: true, text: t };
}

/** Check bytes of an avatar before we embed them: PNG or JPEG only, small. */
export function checkAvatarBytes(buf, maxBytes = 30_000) {
  if (!buf || buf.length < 8 || buf.length > maxBytes) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  return null;
}
export { esc };
