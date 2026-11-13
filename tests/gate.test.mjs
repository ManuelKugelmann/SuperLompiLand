import test from 'node:test';
import assert from 'node:assert/strict';
import { gateQuestion, gatePassed, rememberGate } from '../net/gate.js';

test('the question has one right answer among four distinct positive choices', () => {
    for (let i = 0; i < 500; i++) {
        const q = gateQuestion();
        assert.equal(q.answer, q.a * q.b);
        assert.ok(q.a >= 12 && q.a <= 19 && q.b >= 3 && q.b <= 8);
        assert.equal(q.choices.length, 4);
        assert.equal(new Set(q.choices).size, 4);
        assert.equal(q.choices.filter(c => c === q.answer).length, 1);
        for (const c of q.choices) assert.ok(c > 0);
    }
});

test('the answer is not always in the same place', () => {
    const where = new Set();
    for (let i = 0; i < 200; i++) { const q = gateQuestion(); where.add(q.choices.indexOf(q.answer)); }
    assert.equal(where.size, 4);
});

test('passing is remembered; blocked storage just asks again', () => {
    const mem = new Map();
    const store = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
    assert.equal(gatePassed(store), false);
    rememberGate(store);
    assert.equal(gatePassed(store), true);
    const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    assert.equal(gatePassed(blocked), false);
    rememberGate(blocked); // must not throw
    assert.equal(gatePassed(undefined), false);
});
