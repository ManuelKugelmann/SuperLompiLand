import test from 'node:test';
import assert from 'node:assert/strict';
import { MEET, meetSpot } from '../net/meet.js';

test('a newcomer far from the friend appears behind it', () => {
    const p = meetSpot(3, { x: 0, y: 0 }, { x: 90000, y: 400, vx: 300 });
    assert.deepEqual(p, { x: 90000 - MEET.beside, y: 400 });
    assert.equal(meetSpot(3, { x: 0, y: 0 }, { x: 90000, y: 400, vx: -300 }).x, 90000 + MEET.beside);
});

test('nobody moves when they are already close (both started in the lagoon)', () => {
    assert.equal(meetSpot(1, { x: 0, y: 0 }, { x: 500, y: 200 }), null);
});

test('a player who has been playing a while is never pulled to a friend arriving', () => {
    assert.equal(meetSpot(MEET.windowS + 1, { x: 0, y: 0 }, { x: 90000, y: 0 }), null);
    assert.equal(meetSpot(1, { x: 0, y: 0 }, null), null);
});
