import test from 'node:test';
import assert from 'node:assert/strict';
import { FLAP, strokeSpeed } from '../game/controls/flap.js';
import { FLIGHT, heightPull } from '../game/flight.js';

test('a stroke adds its kick at rest, nothing beyond the top speed that way, and still turns at full speed', () => {
    const right = { x: 1, y: 0 }, up = { x: 0, y: -1 };
    assert.equal(strokeSpeed({ x: 0, y: 0 }, right, 1), FLAP.kick);
    assert.equal(strokeSpeed({ x: 0, y: 0 }, right, 0.5), FLAP.kick / 2);
    assert.equal(strokeSpeed({ x: FLAP.maxSpeed, y: 0 }, right, 1), 0, 'already at the top speed');
    assert.equal(strokeSpeed({ x: FLAP.maxSpeed - 3, y: 0 }, right, 1), 3, 'only up to it');
    assert.equal(strokeSpeed({ x: FLAP.maxSpeed, y: 0 }, up, 1), FLAP.kick, 'a stroke across the movement still steers');
    let v = 0; for (let i = 0; i < 50; i++) v += strokeSpeed({ x: v, y: 0 }, right, 1);
    assert.ok(v <= FLAP.maxSpeed + 1e-9, 'fast tapping never passes the top speed');
});

test('flying high: no pull low down, a growing pull higher up, no wall anywhere', () => {
    const C = FLIGHT.ceiling;
    assert.equal(heightPull(0), 0);
    assert.equal(heightPull(C.from), 0);
    assert.ok(Math.abs(heightPull(C.from + C.span) - C.pull) < 1e-9);
    assert.ok(heightPull(C.from + C.span / 2) < heightPull(C.from + C.span), 'it grows');
    assert.ok(Number.isFinite(heightPull(5000)), 'never infinite: a pull, not a ceiling');
});
