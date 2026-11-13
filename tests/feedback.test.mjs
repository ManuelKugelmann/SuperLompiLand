import test from 'node:test';
import assert from 'node:assert/strict';
import { LIMITS, sanitize, hourBucket, placeAllowed, originAllowed, buildIssue } from '../worker/feedback/lib.js';

test('the hourly limit is 42', () => {
    assert.equal(LIMITS.perHour, 42);
});

test('sanitize trims, caps, defuses mentions and markup, drops control characters', () => {
    assert.equal(sanitize('  hi  '), 'hi');
    assert.equal(sanitize('x'.repeat(5000)).length, LIMITS.textMax);
    assert.ok(!sanitize('ping @someone').includes('@someone'));
    assert.ok(!sanitize('<img src=x>').includes('<'));
    assert.equal(sanitize('a\u0000b\u0007c'), 'abc');
    assert.equal(sanitize(null), '');
    assert.equal(sanitize('line1\nline2'), 'line1\nline2');
});

test('hourBucket changes exactly on the hour', () => {
    const t = Date.UTC(2026, 10, 13, 20, 59, 59);
    assert.equal(hourBucket(t), hourBucket(t - 59 * 60 * 1000));
    assert.notEqual(hourBucket(t), hourBucket(t + 1000));
});

test('placeAllowed checks only the fields that are configured', () => {
    const cf = { country: 'DE', region: 'Bavaria', city: 'Munich' };
    assert.ok(placeAllowed(cf, {}));
    assert.ok(placeAllowed(cf, { country: 'de' }));
    assert.ok(placeAllowed(cf, { country: 'DE', city: 'munich' }));
    assert.ok(!placeAllowed(cf, { country: 'FR' }));
    assert.ok(!placeAllowed(cf, { country: 'DE', city: 'Berlin' }));
    assert.ok(!placeAllowed(undefined, { country: 'DE' }));
});

test('originAllowed needs an exact match', () => {
    const list = ['https://example.github.io', 'http://localhost:8080'];
    assert.ok(originAllowed('http://localhost:8080', list));
    assert.ok(!originAllowed('https://example.github.io.evil.test', list));
    assert.ok(!originAllowed(null, list));
});

test('buildIssue makes a labelled issue with context and no raw mentions', () => {
    const issue = buildIssue('The shark is too fast\nplease slow it @team', { version: 'v0.2.0', biome: 'reef', '<b>': 'x' });
    assert.equal(issue.title, 'Feedback: The shark is too fast');
    assert.deepEqual(issue.labels, ['player-feedback']);
    assert.ok(issue.body.includes('- version: v0.2.0'));
    assert.ok(!issue.body.includes('@team'));
    assert.ok(!issue.body.includes('<b>'));
    assert.equal(buildIssue('', null).title, 'Feedback: Feedback');
});
