import test from 'node:test';
import assert from 'node:assert/strict';
import { ESCORT, escortPlace, escortStep, reachesHome, homePlace } from '../game/escort.js';

test('a freed friend swims behind and above the fish, whichever way the fish travels', () => {
    assert.deepEqual({ ...escortPlace(1000, 500, 1) }, { x: 1000 - ESCORT.behind, y: 500 - ESCORT.above });
    assert.deepEqual({ ...escortPlace(1000, 500, -1) }, { x: 1000 + ESCORT.behind, y: 500 - ESCORT.above });
});

test('it keeps up with a swimming fish, trailing softly, and never jumps while it is near', () => {
    const p = { x: 0, y: 500 };
    let fx = 200, prev = { ...p };
    for (let i = 0; i < 60 * 20; i++) {
        fx += 330 / 60;
        const want = escortPlace(fx, 500, 1);
        escortStep(p, want.x, want.y, fx, 1, 1 / 60);
        assert.ok(Math.hypot(p.x - prev.x, p.y - prev.y) < 30, 'no jump');
        prev = { ...p };
    }
    const want = escortPlace(fx, 500, 1);
    assert.ok(Math.abs(p.x - want.x) < 330 * ESCORT.catchS * 1.2, `it trails by ${Math.round(want.x - p.x)} px`);
    assert.ok(p.x < fx, 'behind the fish');
    assert.ok(Math.abs(p.y - want.y) < 2);
});

test('left far behind (the fish was set somewhere else), it comes in again from just outside the view, never from nowhere on the spot', () => {
    const p = { x: 0, y: 300 }, fx = 50000, want = escortPlace(fx, 900, 1);
    escortStep(p, want.x, want.y, fx, 1, 1 / 60);
    assert.ok(fx - p.x > 960 && fx - p.x <= ESCORT.reenter, 'behind the fish, outside a 1920 px wide view');
    assert.ok(Math.abs(p.y - 830) < 5, 'at its own height');
});

test('at the next nest it goes home and circles over it', () => {
    assert.equal(reachesHome(4000, 5000), false);
    assert.equal(reachesHome(5000 - ESCORT.home + 1, 5000), true);
    assert.equal(reachesHome(9000, 5000), true, 'a nest already passed counts too');
    for (let t = 0; t < ESCORT.lapS; t += 0.25) {
        const h = homePlace(5000, 2000, t);
        assert.ok(Math.abs(h.x - 5000) <= ESCORT.circle[0] + 1e-9 && h.y < 2000 - ESCORT.over + ESCORT.circle[1] + 1e-9 && h.y < 2000 - 100, 'over the nest');
    }
    const a = homePlace(5000, 2000, 0), b = homePlace(5000, 2000, ESCORT.lapS);
    assert.ok(Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6);
});
