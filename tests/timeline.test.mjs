import test from 'node:test';
import assert from 'node:assert/strict';
import { createTimeline } from '../game/timeline.js';

const make = () => { const ran = []; return { ran, t: createTimeline([1000, 2000, 2000, 5000].map((at, k) => ({ at, run: () => ran.push(k) }))) }; };

test('beats play by themselves when their time has come, in order', () => {
    const { ran, t } = make();
    t.step(999); assert.deepEqual(ran, []);
    t.step(1); assert.deepEqual(ran, [0]);
    t.step(1500); assert.deepEqual(ran, [0, 1, 2], 'two beats at the same time both run');
    assert.ok(!t.done);
    t.step(5000); assert.deepEqual(ran, [0, 1, 2, 3]);
    assert.ok(t.done);
});

test('a tap goes on by one beat, never to the end, and the rest keeps its rhythm from there', () => {
    const { ran, t } = make();
    assert.ok(t.next()); assert.deepEqual(ran, [0], 'the first tap plays the first beat only');
    assert.equal(t.clock, 1000);
    assert.ok(t.next()); assert.deepEqual(ran, [0, 1, 2], 'beats that share a moment come together');
    t.step(2999); assert.deepEqual(ran, [0, 1, 2]);
    t.step(1); assert.deepEqual(ran, [0, 1, 2, 3], 'the last one still comes at its own distance after the one before');
    assert.equal(t.next(), false, 'nothing left');
});

test('a tap never turns time back', () => {
    const { ran, t } = make();
    t.step(1500); t.next();
    assert.deepEqual(ran, [0, 1, 2]);
    assert.equal(t.clock, 2000);
});
