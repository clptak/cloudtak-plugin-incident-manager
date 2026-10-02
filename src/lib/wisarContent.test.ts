import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanStyle, cssVariableStyle, isSafeUrl } from './wisarContent.ts';

// sanitizeWisarHtml needs a DOM (DOMParser); it is exercised in the browser.
// These cover the pure rules it applies.

test('isSafeUrl allows http(s), mailto and fragments only', () => {
    for (const ok of ['https://sar.weleber.net', 'http://x', 'mailto:a@b.c', '#top']) assert.ok(isSafeUrl(ok), ok);
    for (const bad of ['javascript:alert(1)', ' JavaScript:x', 'data:text/html,x', 'vbscript:x', '//evil']) {
        assert.ok(!isSafeUrl(bad), bad);
    }
});

test('cleanStyle keeps layout/colour, drops resource loading', () => {
    assert.equal(cleanStyle('color:var(--accent);font-size:14px'), 'color:var(--accent);font-size:14px');
    assert.equal(cleanStyle('color:red;background:url(https://x/y.png);margin:0'), 'color:red;margin:0');
    assert.equal(cleanStyle('width:expression(alert(1))'), '');
});

test('cssVariableStyle keeps plain custom properties only', () => {
    assert.deepEqual(cssVariableStyle({ '--text-primary': '#e8e9ec', '--bg': 'rgba(0, 0, 0, 0.5)', color: 'red',
        '--x': 'url(https://evil)', '--y': 'red;}' }), { '--text-primary': '#e8e9ec', '--bg': 'rgba(0, 0, 0, 0.5)' });
    assert.deepEqual(cssVariableStyle(undefined), {});
});
