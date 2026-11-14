import test from 'node:test';
import assert from 'node:assert/strict';
import { FOREGROUND, boxHitsCircle, fadeStep } from '../game/level/occluders.js';

test('box against circle: inside, touching an edge, clear', () => {
    const b = { x0: 0, y0: 0, x1: 100, y1: 200 };
    assert.equal(boxHitsCircle(b, 50, 50, 10), true);
    assert.equal(boxHitsCircle(b, 105, 50, 10), true);
    assert.equal(boxHitsCircle(b, 120, 50, 10), false);
    assert.equal(boxHitsCircle(b, 108, 208, 10), false, 'corner: distance counts, not the box');
});

test('a covering occluder fades to its share and comes back when clear', () => {
    let a = 0.9;
    for (let i = 0; i < 60; i++) a = fadeStep(a, 0.9, true, 1 / 60);
    assert.ok(Math.abs(a - 0.9 * FOREGROUND.alpha) < 1e-9, `faded to ${a}`);
    let b = a;
    b = fadeStep(b, 0.9, false, 1 / 60);
    assert.ok(b > a && b < 0.9, 'eases back, no jump');
    for (let i = 0; i < 60; i++) b = fadeStep(b, 0.9, false, 1 / 60);
    assert.equal(b, 0.9);
});

test('most of the fade happens within fadeS', () => {
    let a = 1;
    for (let t = 0; t < FOREGROUND.fadeS; t += 1 / 120) a = fadeStep(a, 1, true, 1 / 120);
    assert.ok(a < FOREGROUND.alpha + (1 - FOREGROUND.alpha) * 0.15, `alpha ${a} after fadeS`);
});
