import test from 'node:test';
import assert from 'node:assert/strict';
import { RENDER_SCALE, canvasSize } from '../game/renderScale.js';
import { QUALITY } from '../game/quality.js';

test('the canvas is a share of the game\u2019s px, whole numbers, same shape, never under the least share or over the whole', () => {
    assert.deepEqual(canvasSize(2336, 1080, 1), { width: 2336, height: 1080 });
    assert.deepEqual(canvasSize(2336, 1080, 0.75), { width: 1752, height: 810 });
    assert.deepEqual(canvasSize(1920, 1080, 0.1), { width: 1920 * RENDER_SCALE.min, height: 1080 * RENDER_SCALE.min });
    assert.deepEqual(canvasSize(1920, 1080, 3), { width: 1920, height: 1080 });
    assert.deepEqual(canvasSize(1920, 1080, NaN), { width: 1920, height: 1080 });
});

test('every quality tier names its share; a lower tier never draws more points', () => {
    const shares = QUALITY.tiers.map(t => QUALITY[t].resolution);
    assert.ok(shares.every(k => k >= RENDER_SCALE.min && k <= 1));
    assert.equal(QUALITY.high.resolution, 1);
    for (let i = 1; i < shares.length; i++) assert.ok(shares[i] >= shares[i - 1]);
});
