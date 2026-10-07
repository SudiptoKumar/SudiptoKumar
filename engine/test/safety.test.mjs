// Safety: injection attempts are sanitized / rejected.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { lintSvg, sanitizeMessage, checkAvatarBytes, isLogin, esc } from '../validation/safety.mjs';

describe('safety', () => {
  it('lintSvg rejects script tags', () => {
    const bad = lintSvg('<svg ><script>alert(1)</script><rect/></svg>');
    assert.ok(bad.includes('script tag'));
  });

  it('lintSvg rejects event handlers and javascript: urls', () => {
    assert.ok(lintSvg('<svg ><rect onclick="x()"/></svg>').includes('event handler'));
    assert.ok(lintSvg('<svg ><a href="javascript:alert(1)"><rect/></a></svg>').includes('javascript url'));
    assert.ok(lintSvg('<svg ><a href="vbscript:x"><rect/></a></svg>').includes('vbscript url'));
  });

  it('lintSvg rejects foreignObject, iframes, and external hrefs', () => {
    assert.ok(lintSvg('<svg ><foreignObject><rect/></foreignObject></svg>').includes('foreignObject'));
    assert.ok(lintSvg('<svg ><iframe src="x"/><rect/></svg>').includes('embedded content'));
    const bad = lintSvg('<svg ><image href="https://evil.example/p.png"/></svg>');
    assert.ok(bad.some((m) => m.startsWith('bad href')));
  });

  it('lintSvg rejects html data uris but allows image data uris and # refs', () => {
    assert.ok(lintSvg('<svg ><image href="data:text/html,<script>"/></svg>').some((m) => m.includes('html data uri')));
    assert.deepEqual(lintSvg('<svg ><defs><rect id="a"/></defs><use href="#a"/></svg>'), []);
  });

  it('lintSvg catches unbalanced tags, duplicate ids, oversize', () => {
    assert.ok(lintSvg('<svg ><rect></svg>').some((m) => m.includes('unbalanced') || m.includes('unclosed')));
    assert.ok(lintSvg('<svg ><rect id="a"/><rect id="a"/></svg>').some((m) => m.includes('duplicate id')));
    assert.ok(lintSvg('<svg ></svg>', { maxBytes: 4 }).some((m) => m.includes('too big')));
  });

  it('a clean svg passes', () => {
    assert.deepEqual(lintSvg('<svg ><rect width="4" height="4"/></svg>'), []);
  });

  it('sanitizeMessage rejects hostile visitor text', () => {
    const hostile = [
      '<script>alert(1)</script>',
      '<img src=x onerror=alert(1)>',
      'hello https://evil.example',
      'buy now at bit.ly/xyz',
      'AAAAAABBBBBBCCCCCC',
      'x'.repeat(200),
    ];
    for (const h of hostile) {
      const r = sanitizeMessage(h);
      assert.equal(r.ok, false, JSON.stringify(h.slice(0, 30)));
    }
  });

  it('sanitizeMessage strips bidi overrides instead of passing them through', () => {
    const r = sanitizeMessage('\u202e reversed text');
    assert.equal(r.ok, true);
    assert.ok(!r.text.includes('\u202e'));
  });

  it('sanitizeMessage keeps friendly plain text', () => {
    const r = sanitizeMessage('Hello kingdom! Build on.');
    assert.equal(r.ok, true);
    assert.equal(r.text, 'Hello kingdom! Build on.');
  });

  it('banned words are rejected', () => {
    const r = sanitizeMessage('this is spammy', { bannedWords: ['spammy'] });
    assert.equal(r.ok, false);
  });

  it('checkAvatarBytes only allows small real images', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0]);
    assert.equal(checkAvatarBytes(png), 'image/png');
    assert.equal(checkAvatarBytes(Buffer.from('not an image at all....')), null);
    assert.equal(checkAvatarBytes(Buffer.alloc(40000)), null);
  });

  it('esc neutralizes markup in text', () => {
    assert.equal(esc('<b>&"'), '&lt;b&gt;&amp;&quot;');
  });

  it('isLogin follows GitHub login rules', () => {
    assert.ok(isLogin('sudipto-kumar'));
    assert.ok(!isLogin('-bad'));
    assert.ok(!isLogin('a'.repeat(40)));
  });
});
