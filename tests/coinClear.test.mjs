import test from 'node:test';
import assert from 'node:assert/strict';
import { COIN_CLEAR, coinTooNear } from '../game/level/coinClear.js';

test('no coin within reach of a hazard', () => {
    assert.ok(coinTooNear(100, 100, 100 + COIN_CLEAR.radius - 1, 100));
    assert.ok(!coinTooNear(100, 100, 100 + COIN_CLEAR.radius + 1, 100));
    assert.ok(coinTooNear(0, 0, 120, 120), 'diagonally too');
});

test('no coin along the chain above a hanging hazard; beside it and below it coins are fine', () => {
    assert.ok(coinTooNear(500, 300, 520, 1200, true), 'on the chain, far above the anchor');
    assert.ok(!coinTooNear(500 - COIN_CLEAR.chainHalf - 30, 300, 520, 1200, true), 'beside the chain');
    assert.ok(!coinTooNear(520, 1200 + COIN_CLEAR.radius + 20, 520, 1200, true), 'under the anchor');
    assert.ok(!coinTooNear(500, 300, 520, 1200, false), 'a hazard without a chain has nothing above it');
});
