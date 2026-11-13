import test from 'node:test';
import assert from 'node:assert/strict';
import WorldState, { KINDS } from '../systems/worldState.js';

const memory = () => {
    const data = new Map();
    return { getItem: k => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), data };
};

test('a fresh world has nothing collected', () => {
    const w = new WorldState(memory(), 'w', 1);
    assert.equal(w.has('0,0', 'coin', 0), false);
    assert.equal(w.count('coin'), 0);
});

test('set and has work per chunk, kind and index', () => {
    const w = new WorldState(memory(), 'w', 1);
    assert.ok(w.set('3,2', 'coin', 17));
    assert.ok(w.has('3,2', 'coin', 17));
    assert.ok(!w.has('3,2', 'coin', 16));
    assert.ok(!w.has('3,3', 'coin', 17));
    assert.ok(!w.has('3,2', 'friend', 1));
    w.set('3,2', 'coin', 17);
    assert.equal(w.count('coin'), 1, 'setting twice counts once');
});

test('out-of-range indices and unknown kinds are refused', () => {
    const w = new WorldState(memory(), 'w', 1);
    assert.equal(w.set('0,0', 'coin', KINDS.coin), false);
    assert.equal(w.set('0,0', 'coin', -1), false);
    assert.equal(w.set('0,0', 'treasure', 0), false);
    assert.equal(w.has('0,0', 'coin', KINDS.coin), false);
});

test('state survives a save and reload', () => {
    const store = memory();
    const a = new WorldState(store, 'w', 1);
    a.set('-4,7', 'coin', 0); a.set('-4,7', 'coin', 63); a.set('9,1', 'friend', 5);
    a.save();
    const b = new WorldState(store, 'w', 1);
    assert.ok(b.has('-4,7', 'coin', 0) && b.has('-4,7', 'coin', 63) && b.has('9,1', 'friend', 5));
    assert.ok(!b.has('-4,7', 'coin', 1));
});

test('a different generator version starts fresh', () => {
    const store = memory();
    const a = new WorldState(store, 'w', 1);
    a.set('0,0', 'coin', 3); a.save();
    assert.equal(new WorldState(store, 'w', 2).has('0,0', 'coin', 3), false);
});

test('corrupt storage is treated as empty', () => {
    const store = memory();
    store.setItem('w', '{not json');
    assert.equal(new WorldState(store, 'w', 1).count('coin'), 0);
    store.setItem('w', JSON.stringify({ v: '1', chunks: { '0,0': { coin: '%%%' } } }));
    assert.equal(new WorldState(store, 'w', 1).has('0,0', 'coin', 0), false);
});

test('a million collected coins round-trip and stay small', () => {
    const store = memory();
    const a = new WorldState(store, 'w', 1);
    const chunks = Math.ceil(1_000_000 / KINDS.coin);
    for (let c = 0; c < chunks; c++) for (let i = 0; i < KINDS.coin; i++) a.set(`${c},0`, 'coin', i);
    a.save();
    assert.ok(a.count('coin') >= 1_000_000);
    const size = store.getItem('w').length;
    assert.ok(size < 700_000, `stored size ${size}`);   // well inside the ~5 MB localStorage budget
    const b = new WorldState(store, 'w', 1);
    assert.ok(b.has('0,0', 'coin', 0) && b.has(`${chunks - 1},0`, 'coin', KINDS.coin - 1));
    assert.equal(b.count('coin'), a.count('coin'));
});

test('reset forgets everything', () => {
    const store = memory();
    const a = new WorldState(store, 'w', 1);
    a.set('1,1', 'coin', 2); a.save(); a.reset();
    assert.equal(new WorldState(store, 'w', 1).count('coin'), 0);
});
