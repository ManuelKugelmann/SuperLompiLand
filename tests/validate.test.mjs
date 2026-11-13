import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanState, cleanEvent, Strikes } from '../net/validate.js';

const ok = { n: 3, t: 12345, x: 100.5, y: -40, vx: 2.5, vy: -1, s: 'normal', f: -1, c: 'shark' };

test('a good snapshot passes, extra fields are dropped', () => {
    assert.deepEqual(cleanState({ ...ok, extra: 'x', __proto__: { evil: 1 } }), ok);
});

test('bad snapshots are rejected', () => {
    const bad = [null, 'x', [], {}, { ...ok, x: 'far' }, { ...ok, x: NaN }, { ...ok, y: Infinity }, { ...ok, x: 1e9 },
        { ...ok, vx: 10000 }, { ...ok, f: 0 }, { ...ok, f: 2 }, { ...ok, s: '' }, { ...ok, c: 'x'.repeat(40) },
        { ...ok, n: undefined }, { ...ok, t: '1' }];
    for (const b of bad) assert.equal(cleanState(b), null, JSON.stringify(b));
});

test('events: down needs a position, revive needs an id, nothing else gets through', () => {
    assert.deepEqual(cleanEvent({ t: 'down', x: 1, y: 2, junk: 1 }), { t: 'down', x: 1, y: 2 });
    assert.deepEqual(cleanEvent({ t: 'revive', id: 'abc' }), { t: 'revive', id: 'abc' });
    for (const b of [{ t: 'down', x: 'a', y: 1 }, { t: 'revive' }, { t: 'revive', id: '' }, { t: 'revive', id: 'x'.repeat(99) },
        { t: 'chat', text: 'hi' }, null, 'down']) assert.equal(cleanEvent(b), null);
});

test('a peer that keeps sending garbage is ignored', () => {
    const s = new Strikes(3);
    assert.equal(s.blocked('p'), false);
    s.bad('p'); s.bad('p');
    assert.equal(s.blocked('p'), false);
    assert.equal(s.bad('p'), true);
    assert.equal(s.blocked('p'), true);
    assert.equal(s.blocked('q'), false);
});
