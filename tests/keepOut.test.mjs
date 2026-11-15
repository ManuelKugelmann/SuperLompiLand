import test from 'node:test';
import assert from 'node:assert/strict';
import { KEEP_OUT, keepOut } from '../game/ai/keepOut.js';
import { createField, FIELD } from '../game/level/density.js';

// A flat seabed at y = 1000: rock below, water above (density rises with depth).
const floor = (x, y) => (y - 1000) / 380;

test('in open water, well clear of rock, a thing stays where it is', () => {
    assert.deepEqual(keepOut(500, 700, 40, floor), { x: 500, y: 700 });
});

test('in rock or with its rim in it, it is moved out the shortest way, to where its rim is clear', () => {
    const p = keepOut(500, 1060, 40, floor);
    assert.ok(Math.abs(p.x - 500) < 1e-6, 'straight up out of a flat floor');
    assert.ok(p.y <= 960 + 1e-6 && p.y > 960 - KEEP_OUT.step - 1e-6, `just clear: ${p.y}`);
    const rim = keepOut(500, 980, 40, floor);
    assert.ok(rim.y <= 960 + 1e-6, 'its rim touched the floor');
});

test('on the real terrain: whatever starts in rock ends in open water within a few frames', () => {
    const field = createField(1337, 'own'), rock = (x, y) => field.density(x, y) - FIELD.threshold;
    let stuck = 0, tried = 0;
    for (let x = 60000; x < 700000; x += 9973) {
        for (const y of [1500, 2500, 3500]) {
            if (rock(x, y) <= 0) continue;
            tried++;
            let p = { x, y };
            for (let f = 0; f < 12 && rock(p.x, p.y) > 0; f++) p = keepOut(p.x, p.y, 30, rock);
            if (rock(p.x, p.y) > 0) stuck++;
        }
    }
    assert.ok(tried > 20, `${tried} starts in rock`);
    assert.ok(stuck / tried < 0.1, `${stuck} of ${tried} still in rock`);
});
