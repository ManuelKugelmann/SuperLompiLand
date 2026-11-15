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

test('a depth mark rings once going down, again only after coming back up well above it', async () => {
    const { createDepthBell, DEPTH_MARKS } = await import('../game/level/depthMeters.js');
    const bell = createDepthBell(), rings = [];
    for (const m of [0, 5, 9, 10, 11, 9, 10, 12, 15, 21, 19, 21, 6, 12, 120]) { const i = bell.step(m); if (i >= 0) rings.push(DEPTH_MARKS.at[i]); }
    // 10 at the first pass; not again at 9 -> 10; 20 once; back up to 6 m (above 0.7 x 10) re-arms 10;
    // a jump from 12 to 120 m passes 50 and 100: the deepest one rings.
    assert.deepEqual(rings, [10, 20, 10, 100]);
});

test('the water darkens with depth: as painted near the surface, clearly darker at 50 m, never brighter deeper', async () => {
    const { depthLight } = await import('../game/level/depthMeters.js');
    assert.equal(depthLight(5), 1);
    assert.ok(depthLight(17) > 0.9 && depthLight(17) < 1);
    assert.ok(depthLight(50) < 0.7, '50 m clearly darker');
    assert.ok(depthLight(17) - depthLight(50) > 0.25, '17 m and 50 m look different');
    let last = 1;
    for (let m = 0; m <= 3000; m += 5) { const b = depthLight(m); assert.ok(b <= last + 1e-12 && b > 0.1, String(m)); last = b; }
});
