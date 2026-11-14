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

import { WORLD_KINDS, bitsOf, syncBatches } from '../net/validate.js';
import { KINDS } from '../systems/worldState.js';
import WorldState from '../systems/worldState.js';
import { roomStorageKey } from '../net/keys.js';

test('claims: chunk, kind and index are checked', () => {
    assert.deepEqual(cleanEvent({ t: 'claim', c: '3,-2', k: 'coin', i: 17, x: 1 }), { t: 'claim', c: '3,-2', k: 'coin', i: 17 });
    for (const b of [{ t: 'claim', c: '3;2', k: 'coin', i: 1 }, { t: 'claim', c: '3,2', k: 'gold', i: 1 }, { t: 'claim', c: '3,2', k: 'coin', i: 64 },
        { t: 'claim', c: '3,2', k: 'friend', i: 16 }, { t: 'claim', c: '3,2', k: 'coin', i: 1.5 }, { t: 'claim', c: '3,2', k: 'coin', i: -1 }]) {
        assert.equal(cleanEvent(b), null, JSON.stringify(b));
    }
});

test('kinds stay in step with the world save', () => {
    assert.deepEqual(WORLD_KINDS, KINDS);
});

test('sync: a world round-trips through batches into another world (OR-merge, idempotent)', () => {
    const mem = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
    const a = new WorldState(mem(), 'a', 1), b = new WorldState(mem(), 'b', 1);
    const marks = [['0,0', 'coin', 0], ['0,0', 'coin', 63], ['5,-3', 'coin', 17], ['5,-3', 'friend', 2]];
    for (let x = 0; x < 30; x++) marks.push([`${x},1`, 'coin', x]);
    for (const m of marks) a.set(...m);
    b.set('9,9', 'coin', 1); // b has its own progress
    const batches = syncBatches(a.chunks);
    assert.ok(batches.length > 1, 'split into several frames');
    for (const ev of batches) {
        assert.ok(JSON.stringify({ k: 'v', d: ev }).length < 1024, 'fits a relay frame');
        const clean = cleanEvent(ev);
        assert.ok(clean);
        for (const [c, k, b64] of clean.e) for (const i of bitsOf(b64, KINDS[k])) b.set(c, k, i);
        for (const [c, k, b64] of clean.e) for (const i of bitsOf(b64, KINDS[k])) b.set(c, k, i); // twice: no change
    }
    for (const m of marks) assert.ok(b.has(...m), m.join(' '));
    assert.ok(b.has('9,9', 'coin', 1), 'own progress kept');
    assert.equal(b.count('coin'), a.count('coin') + 1);
});

test('bad sync batches are rejected', () => {
    for (const b of [{ t: 'sync', e: [] }, { t: 'sync', e: [['0,0', 'coin']] }, { t: 'sync', e: [['0,0', 'coin', 'not base64!']] },
        { t: 'sync', e: Array.from({ length: 17 }, () => ['0,0', 'coin', 'AQ==']) }, { t: 'sync', e: [['x', 'coin', 'AQ==']] }]) {
        assert.equal(cleanEvent(b), null, JSON.stringify(b).slice(0, 80));
    }
});

test('room save key: stable per room, different per room, never contains the name', () => {
    assert.equal(roomStorageKey('korallewalmond'), roomStorageKey('korallewalmond'));
    assert.notEqual(roomStorageKey('korallewalmond'), roomStorageKey('korallewalmont'));
    assert.match(roomStorageKey('korallewalmond'), /^sll_room_[0-9a-f]{16}$/);
    assert.ok(!roomStorageKey('korallewalmond').includes('koralle'));
});

test('alarm events (a special went off) carry a position and nothing else', () => {
    assert.deepEqual(cleanEvent({ t: 'alarm', x: 1200, y: 800, extra: 'x' }), { t: 'alarm', x: 1200, y: 800 });
    assert.equal(cleanEvent({ t: 'alarm', x: 'far', y: 800 }), null);
    assert.equal(cleanEvent({ t: 'alarm', x: 1e12, y: 0 }), null);
    assert.equal(cleanEvent({ t: 'alarm' }), null);
});
