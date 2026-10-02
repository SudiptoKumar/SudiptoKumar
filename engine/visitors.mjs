// Visitor flags and goblin raids. Visitors only create controlled data, never code or pictures.
import { sanitizeMessage, isLogin, checkAvatarBytes } from './safety.mjs';
import { RAID_SIZES } from './events.mjs';
import { daysSince, hoursSince, pad3 } from './util.mjs';

export const AVATAR_KEY = { 'my github avatar': 'github', 'pixel knight': 'knight', 'pixel mage': 'mage', 'pixel ranger': 'ranger', 'pixel rogue': 'rogue', 'generated pixel face': 'identicon' };
export const COLOR_KEY = ['red', 'blue', 'green', 'gold', 'purple', 'orange'];
export const RAID_KEY = { 'small raid (3 goblins)': 'small', 'medium raid (6 goblins)': 'medium', 'large raid (9 goblins)': 'large' };

export const REASONS = {
  NOT_A_USER: 'Only normal GitHub user accounts can join.',
  BLOCKED: 'This account cannot join.',
  DISABLED: 'This feature is turned off right now.',
  USERNAME_MISMATCH: 'The username must be your own GitHub name.',
  ACCOUNT_TOO_NEW: 'Your GitHub account is too new. Please come back in a few days.',
  DUPLICATE: 'You already planted a flag.',
  RATE_LIMIT: 'Too many flags today. Please try again tomorrow.',
  CAMP_FULL: 'The camp is full for now.',
  EMPTY_MESSAGE: 'Please write a short message.',
  MESSAGE_TOO_LONG: 'The message is too long (32 characters is the limit).',
  BAD_CHARACTERS: 'Use only letters, numbers, spaces and . , ! ? - characters.',
  LINKS_NOT_ALLOWED: 'Links and @names are not allowed in the message.',
  LOOKS_LIKE_SPAM: 'The message looks like spam.',
  BAD_AVATAR: 'Please pick one of the avatar choices.',
  BAD_COLOR: 'Please pick one of the flag colours.',
  BAD_SIZE: 'Please pick one of the raid sizes.',
  RAID_ACTIVE: 'A raid is already happening. Please wait for it to end.',
  COOLDOWN: 'The goblins are resting. Please try again later.',
  USER_LIMIT: 'You already sent a raid today.',
  NO_ACCOUNT: 'We could not check your GitHub account. Please try again later.',
};

/** Reads an issue form body: "### Label" then the answer. */
export function parseIssueForm(body) {
  const out = {};
  for (const part of String(body || '').slice(0, 4000).split(/^###\s+/m).slice(1)) {
    const nl = part.indexOf('\n');
    const label = (nl < 0 ? part : part.slice(0, nl)).trim().toLowerCase();
    let val = nl < 0 ? '' : part.slice(nl + 1).trim();
    if (val === '_No response_') val = '';
    out[label] = val;
  }
  return out;
}
export function issueKind(issue) {
  const names = (issue.labels || []).map((l) => (typeof l === 'string' ? l : l.name));
  if (names.includes('flag-request')) return 'flag';
  if (names.includes('raid-request')) return 'raid';
  return null;
}

const lc = (s) => String(s || '').toLowerCase();
const fail = (reason) => ({ ok: false, reason });
function common({ issue, account, cfg, section }) {
  if (!account || !isLogin(account.login)) return fail('NO_ACCOUNT');
  if (issue.user?.type !== 'User' || account.type !== 'User') return fail('NOT_A_USER');
  if (cfg.visitors.blocked.map(lc).includes(lc(account.login))) return fail('BLOCKED');
  if (daysSince(account.created_at, cfg._now) < cfg[section].minAccountAgeDays) return fail('ACCOUNT_TOO_NEW');
  return null;
}

export function validateFlag({ issue, fields, account, store, cfg, now }) {
  const c = { ...cfg, _now: now };
  if (!cfg.visitors.enabled) return fail('DISABLED');
  const bad = common({ issue, account, cfg: c, section: 'visitors' });
  if (bad) return bad;
  const claimed = String(fields['github username'] || '').trim().replace(/^@/, '');
  if (!isLogin(claimed) || lc(claimed) !== lc(issue.user.login) || lc(account.login) !== lc(claimed)) return fail('USERNAME_MISMATCH');
  const flags = store.visitors.flags;
  if (flags.some((f) => lc(f.login) === lc(account.login))) return fail('DUPLICATE');
  if (flags.filter((f) => hoursSince(f.at, now) < 24).length >= cfg.visitors.maxPerDay) return fail('RATE_LIMIT');
  if (flags.length >= cfg.visitors.maxTotal) return fail('CAMP_FULL');
  const msg = sanitizeMessage(fields.message, { bannedWords: cfg.visitors.bannedWords });
  if (!msg.ok) return fail(msg.reason);
  const avatar = AVATAR_KEY[lc(fields.avatar)] || (fields.avatar ? null : 'identicon');
  if (!avatar) return fail('BAD_AVATAR');
  const color = lc(fields['flag colour'] || fields['flag color'] || 'green');
  if (!COLOR_KEY.includes(color)) return fail('BAD_COLOR');
  return { ok: true, entry: { n: store.visitors.next, login: account.login, message: msg.text, avatar, color, issue: issue.number, at: now.toISOString() } };
}
export function validateRaid({ issue, fields, account, store, cfg, now }) {
  const c = { ...cfg, _now: now };
  if (!cfg.raids.enabled) return fail('DISABLED');
  const bad = common({ issue, account, cfg: c, section: 'raids' });
  if (bad) return bad;
  const size = RAID_KEY[lc(fields['raid size'])];
  if (!size || !RAID_SIZES[size]) return fail('BAD_SIZE');
  const raids = store.events.raids;
  if (raids.some((r) => r.status === 'active')) return fail('RAID_ACTIVE');
  if (raids.some((r) => hoursSince(r.at, now) < cfg.raids.cooldownHours)) return fail('COOLDOWN');
  if (raids.filter((r) => lc(r.by) === lc(account.login) && hoursSince(r.at, now) < 24).length >= cfg.raids.perUserPerDay) return fail('USER_LIMIT');
  return { ok: true, entry: { id: issue.number, by: account.login, size, status: 'active', at: now.toISOString() } };
}

export function applyFlag(store, entry) {
  store.visitors.flags.push(entry);
  store.visitors.next = Math.max(store.visitors.next, entry.n) + 1;
}
export function applyRaid(store, entry) { store.events.raids.push(entry); }

export async function fetchAvatar(io, store, login) {
  try {
    const res = await io.bytes(`https://avatars.githubusercontent.com/${encodeURIComponent(login)}?s=64`);
    const mime = res && checkAvatarBytes(res.buf);
    if (!mime) return false;
    store.avatars.items[login] = { mime, b64: res.buf.toString('base64') };
    const keep = new Set(store.visitors.flags.map((f) => f.login));
    for (const k of Object.keys(store.avatars.items)) if (!keep.has(k)) delete store.avatars.items[k];
    return true;
  } catch { return false; }
}

const replyOk = { flag: (e) => `Your flag **#${pad3(e.n)}** is planted. The map will show it after the next update (a few minutes). Thank you for visiting!`, raid: () => 'The goblins are on the march! The raid shows on the next map update and ends by itself. Nothing is harmed.' };
export const replyFor = (kind, result) => (result.ok ? replyOk[kind](result.entry) : `Sorry, this request was not accepted. ${REASONS[result.reason] || 'Please try again later.'}`);

/** Handles one issue end to end. io is the GitHub helper. Returns the result. */
export async function processIssue({ issue, io, store, cfg, now }) {
  const kind = issueKind(issue);
  if (!kind || issue.pull_request) return { skipped: true };
  if (store.visitors.processed[issue.number]) return { skipped: true };
  const fields = parseIssueForm(issue.body);
  let account = null;
  try { const r = await io.rest(`/users/${encodeURIComponent(issue.user.login)}`); if (r.ok) account = r.json; } catch { /* handled below */ }
  const result = (kind === 'flag' ? validateFlag : validateRaid)({ issue, fields, account, store, cfg, now });
  if (result.ok) {
    if (kind === 'flag') { applyFlag(store, result.entry); if (result.entry.avatar === 'github') await fetchAvatar(io, store, result.entry.login); }
    else applyRaid(store, result.entry);
  }
  store.visitors.processed[issue.number] = result.ok ? 'ok' : result.reason;
  const keys = Object.keys(store.visitors.processed).map(Number).sort((a, b) => a - b);
  for (const k of keys.slice(0, Math.max(0, keys.length - 300))) delete store.visitors.processed[k];
  return { kind, ...result };
}
