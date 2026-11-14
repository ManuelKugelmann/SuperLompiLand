import test from 'node:test';
import assert from 'node:assert/strict';
import { depthMeters, DEPTH_SCALE } from '../game/level/depthMeters.js';

test('true to scale near the surface', () => {
    assert.equal(depthMeters(-50), 0);
    assert.equal(depthMeters(900), 9);
    assert.equal(depthMeters(2000), 20);
});

test('the trench floor reads about 1 000 m, rounded to tens past 100 m', () => {
    assert.equal(depthMeters(5600), 1000);
    assert.equal(depthMeters(4500) % 10, 0);
});

test('deeper always reads deeper', () => {
    let last = -1;
    for (let y = 0; y <= DEPTH_SCALE.at(-1)[0] + 2000; y += 25) {
        const m = depthMeters(y);
        assert.ok(m >= last, `y ${y}: ${m} < ${last}`);
        last = m;
    }
});
