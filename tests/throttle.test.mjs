import test from 'node:test';
import assert from 'node:assert/strict';
import { THINK, everyOf, due, createStagger, createTurns } from '../game/throttle.js';

test('a lower tier decides more slowly, never faster than every frame', () => {
    for (const kind of Object.keys(THINK.every)) {
        assert.ok(everyOf(kind, 'basic') >= everyOf(kind, 'low') && everyOf(kind, 'low') >= everyOf(kind, 'medium') && everyOf(kind, 'medium') >= everyOf(kind, 'high'));
        assert.ok(everyOf(kind, 'high') >= 1 && Number.isInteger(everyOf(kind, 'low')));
    }
    assert.equal(everyOf('idle'), THINK.every.idle);
});

test('askers with their own offsets take turns: the same number of them in every frame', () => {
    const offset = createStagger(), askers = Array.from({ length: 12 }, () => offset());
    for (let frame = 0; frame < 20; frame++) assert.equal(askers.filter(o => due(frame, 4, o)).length, 3);
    assert.equal(due(7, 1, 3), true, 'every frame is always due');
});

test('a turn hands over all the time since the last one', () => {
    const t = createTurns(1);
    let sum = 0, turns = 0;
    for (let frame = 0; frame < 30; frame++) { const dt = t.turn(frame, 0.016, 3); if (dt) { sum += dt; turns++; } }
    assert.equal(turns, 10);
    assert.ok(Math.abs(sum - 30 * 0.016) < 1e-9);
});
