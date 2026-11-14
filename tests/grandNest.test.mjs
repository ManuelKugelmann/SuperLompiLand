import test from 'node:test';
import assert from 'node:assert/strict';
import { GRAND_NEST, friendAt } from '../game/level/grandNest.js';

const nest = { x: 10000, y: 5600 }, fish = { x: 10300, y: 5200 };

test('the freed friends circle over the grand nest, evenly spaced, inside its warm pool', () => {
    const n = 4, at = [0, 1, 2, 3].map(i => friendAt(i, n, 3, nest, fish, 0, {}));
    for (const p of at) {
        assert.ok(Math.abs(p.x - nest.x) <= GRAND_NEST.radius[0] + 1, 'within the circle');
        assert.ok(Math.abs(p.y - (nest.y - GRAND_NEST.above)) <= GRAND_NEST.radius[1] + GRAND_NEST.bob + 1);
        assert.ok(p.y < nest.y - 100, 'over the nest, never in the sand');
    }
    assert.ok(Math.hypot(at[0].x - at[2].x, at[0].y - at[2].y) > GRAND_NEST.radius[1], 'opposite ones are far apart');
    const a = friendAt(0, n, 0, nest, fish, 0, {}), b = friendAt(0, n, GRAND_NEST.lap, nest, fish, 0, {});
    assert.ok(Math.abs(a.x - b.x) < 1e-6, 'one lap brings it round');
});

test('on arrival they gather round the fish', () => {
    for (let i = 0; i < 3; i++) {
        const p = friendAt(i, 3, 5, nest, fish, 1, {}), d = Math.hypot(p.x - fish.x, p.y - fish.y);
        assert.ok(d <= GRAND_NEST.gather[0] + GRAND_NEST.bob + 1, 'close to the fish');
        assert.ok(d >= GRAND_NEST.gather[1] - GRAND_NEST.bob - 1, 'but not on top of it');
    }
    const half = friendAt(0, 3, 5, nest, fish, 0.5, {}), from = friendAt(0, 3, 5, nest, fish, 0, {}), to = friendAt(0, 3, 5, nest, fish, 1, {});
    assert.ok(half.x > Math.min(from.x, to.x) - 1 && half.x < Math.max(from.x, to.x) + 1, 'half way it is in between');
});

test('one friend alone still circles', () => {
    const p = friendAt(0, 1, 2, nest, fish, 0, {});
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.vx));
});
