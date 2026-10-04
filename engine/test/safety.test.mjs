import test from 'node:test';
import assert from 'node:assert/strict';
import { lintSvg, sanitizeMessage, isLogin, checkAvatarBytes } from '../safety.mjs';
import { parseIssueForm, validateFlag, validateRaid, issueKind, REASONS } from '../visitors.mjs';
import { DEFAULTS } from '../config.mjs';
import { EMPTY } from '../store.mjs';
import { esc } from '../util.mjs';

const NOW = new Date('2026-09-30T12:00:00Z');
const wrap = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1">${inner}</svg>\n`;

test('svg lint blocks scripts, handlers, external links and broken tags', () => {
  assert.deepEqual(lintSvg(wrap('<rect/>')), []);
  assert.ok(lintSvg(wrap('<script>alert(1)</script>')).includes('script tag'));
  assert.ok(lintSvg(wrap('<g id="a"/><g id="a"/>')).some((x) => x.startsWith('duplicate id')));
  assert.deepEqual(lintSvg(wrap('<g id="a"/><g id="b"/>')), []);
  assert.ok(lintSvg(wrap('<rect onload="x()"/>')).includes('event handler'));
  assert.ok(lintSvg(wrap('<image href="https://evil.example/x.png"/>')).some((x) => x.startsWith('bad href')));
  assert.ok(lintSvg(wrap('<rect style="fill:url(https://x)"/>')).includes('external css url'));
  assert.ok(lintSvg(wrap('<foreignObject/>')).includes('foreignObject'));
  assert.ok(lintSvg(wrap('<g><rect/>')).some((x) => x.startsWith('unclosed')));
  assert.deepEqual(lintSvg(wrap('<use xlink:href="#a"/>')), []);
  assert.deepEqual(lintSvg(wrap('<image href="data:image/png;base64,iVBORw0KGgo="/>')), []);
  assert.ok(lintSvg(wrap('<image href="data:image/svg+xml;base64,AAAA"/>')).length > 0, 'svg inside svg is blocked');
});

test('messages: plain short text only', () => {
  assert.equal(sanitizeMessage('Hello from India!').ok, true);
  assert.equal(sanitizeMessage('  Keep   building  ').text, 'Keep building');
  for (const [txt, why] of [['', 'EMPTY_MESSAGE'], ['x'.repeat(33), 'MESSAGE_TOO_LONG'], ['<b>hi</b>', 'BAD_CHARACTERS'], ['visit www.spam.com', 'LINKS_NOT_ALLOWED'], ['hello @someone', 'LINKS_NOT_ALLOWED'], ['aaaaaaaa', 'LOOKS_LIKE_SPAM'], ['BUY CHEAP STUFF NOW', 'LOOKS_LIKE_SPAM'], ['</svg><script>', 'BAD_CHARACTERS']]) {
    const r = sanitizeMessage(txt);
    assert.equal(r.ok, false, txt); assert.equal(r.reason, why, txt);
  }
  assert.equal(sanitizeMessage('bad word here', { bannedWords: ['bad word'] }).ok, false);
  assert.equal(sanitizeMessage('नमस्ते दोस्त').ok, true, 'other languages are fine');
  assert.equal(sanitizeMessage('hi\u202e there').ok, true, 'hidden direction marks are removed');
  assert.ok(!/\u202e/.test(sanitizeMessage('hi\u202e there').text));
});
test('logins and avatar bytes', () => {
  assert.ok(isLogin('octocat') && isLogin('a-b-c') && !isLogin('-bad') && !isLogin('a b') && !isLogin('x'.repeat(40)) && !isLogin('a"b'));
  assert.equal(checkAvatarBytes(Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4, 5])), 'image/png');
  assert.equal(checkAvatarBytes(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])), 'image/jpeg');
  assert.equal(checkAvatarBytes(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')), null);
  assert.equal(checkAvatarBytes(Buffer.alloc(40_000, 0xff)), null, 'too big');
  assert.equal(esc('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
});

const body = (o) => `### GitHub username\n\n${o.u ?? 'visitor'}\n\n### Message\n\n${o.m ?? 'Hello there'}\n\n### Avatar\n\n${o.a ?? 'Pixel mage'}\n\n### Flag colour\n\n${o.c ?? 'Gold'}\n`;
const ctx = (over = {}) => {
  const store = Object.fromEntries(Object.entries(EMPTY).map(([k, f]) => [k, f()]));
  const issue = { number: 5, user: { login: 'visitor', type: 'User' }, labels: [{ name: 'flag-request' }], body: body({}), ...over.issue };
  return { issue, fields: parseIssueForm(issue.body), account: { login: 'visitor', type: 'User', created_at: '2024-01-01T00:00:00Z', ...over.account }, store, cfg: structuredClone(DEFAULTS), now: NOW };
};
test('issue form parsing', () => {
  const f = parseIssueForm(body({ m: 'Hi' }));
  assert.equal(f['github username'], 'visitor'); assert.equal(f.message, 'Hi'); assert.equal(f['flag colour'], 'Gold');
  assert.equal(parseIssueForm('### Message\n\n_No response_').message, '');
  assert.equal(issueKind({ labels: [{ name: 'flag-request' }] }), 'flag');
  assert.equal(issueKind({ labels: ['raid-request'] }), 'raid');
  assert.equal(issueKind({ labels: [] }), null);
});
test('flag: a good request is accepted', () => {
  const r = validateFlag(ctx());
  assert.equal(r.ok, true);
  assert.deepEqual({ ...r.entry, at: 0 }, { n: 1, login: 'visitor', message: 'Hello there', avatar: 'mage', color: 'gold', issue: 5, at: 0 });
});
test('flag: every safety rule rejects', () => {
  const bad = (over, reason, edit) => { const c = ctx(over); edit?.(c); const r = validateFlag(c); assert.equal(r.ok, false, reason); assert.equal(r.reason, reason); assert.ok(REASONS[reason], 'has a friendly text'); };
  bad({ issue: { body: body({ u: 'someone-else' }) } }, 'USERNAME_MISMATCH');
  bad({ issue: { body: body({ u: '' }) } }, 'USERNAME_MISMATCH');
  bad({ account: { type: 'Bot' } }, 'NOT_A_USER');
  bad({ issue: { user: { login: 'visitor', type: 'Bot' } } }, 'NOT_A_USER');
  bad({ account: { created_at: '2026-09-29T00:00:00Z' } }, 'ACCOUNT_TOO_NEW');
  bad({ issue: { body: body({ m: 'see http://x.io' }) } }, 'LINKS_NOT_ALLOWED');
  bad({ issue: { body: body({ a: 'Evil <img>' }) } }, 'BAD_AVATAR');
  bad({ issue: { body: body({ c: 'Pink' }) } }, 'BAD_COLOR');
  bad({}, 'DUPLICATE', (c) => c.store.visitors.flags.push({ login: 'Visitor', at: '2026-01-01T00:00:00Z' }));
  bad({}, 'BLOCKED', (c) => c.cfg.visitors.blocked.push('VISITOR'));
  bad({}, 'RATE_LIMIT', (c) => { for (let i = 0; i < 15; i++) c.store.visitors.flags.push({ login: 'u' + i, at: '2026-09-30T11:00:00Z' }); });
  bad({}, 'CAMP_FULL', (c) => { c.cfg.visitors.maxTotal = 1; c.store.visitors.flags.push({ login: 'other', at: '2020-01-01T00:00:00Z' }); });
  bad({}, 'DISABLED', (c) => { c.cfg.visitors.enabled = false; });
  bad({ account: null }, 'NO_ACCOUNT', (c) => { c.account = null; });
});
test('raid: size, cooldown, one at a time, per user limit', () => {
  const raidCtx = (over = {}, size = 'Medium raid (6 goblins)') => ctx({ ...over, issue: { labels: [{ name: 'raid-request' }], body: `### Raid size\n\n${size}\n`, ...over.issue } });
  const ok = validateRaid(raidCtx());
  assert.equal(ok.ok, true); assert.equal(ok.entry.size, 'medium'); assert.equal(ok.entry.status, 'active');
  assert.equal(validateRaid(raidCtx({}, 'Huge raid (99 goblins)')).reason, 'BAD_SIZE');
  const a = raidCtx(); a.store.events.raids.push({ by: 'x', status: 'active', at: '2026-09-30T11:59:00Z' });
  assert.equal(validateRaid(a).reason, 'RAID_ACTIVE');
  const b = raidCtx(); b.store.events.raids.push({ by: 'x', status: 'done', at: '2026-09-30T09:00:00Z' });
  assert.equal(validateRaid(b).reason, 'COOLDOWN');
  const c = raidCtx(); c.store.events.raids.push({ by: 'visitor', status: 'done', at: '2026-09-29T20:00:00Z' }); c.cfg.raids.cooldownHours = 1;
  assert.equal(validateRaid(c).reason, 'USER_LIMIT');
  const d = raidCtx(); d.cfg.raids.enabled = false;
  assert.equal(validateRaid(d).reason, 'DISABLED');
});
