import test from 'node:test';
import assert from 'node:assert/strict';
import { GARDEN_EELS, eelSpot, eelAt, scared, stepEel } from '../game/level/gardenEels.js';
import { BIOMES } from '../game/level/biomes.js';

test('the colony lies on the rocky shore, eels inside it in order', () => {
    const b = BIOMES.find(x => x.id === GARDEN_EELS.biome), s = eelSpot();
    assert.ok(s.x0 >= b.from && s.x1 <= b.from + b.width);
    let last = -Infinity;
    for (let i = 0; i < GARDEN_EELS.count; i++) { const e = eelAt(i); assert.ok(e.x > last && e.x >= s.x0 && e.x <= s.x1); last = e.x; }
});

test('only a fish close by and low over the sand frightens an eel', () => {
    assert.ok(scared(100, 1000, 150, 800));
    assert.ok(!scared(100, 1000, 100 + GARDEN_EELS.shy + 10, 800));
    assert.ok(!scared(100, 1000, 120, 1000 - GARDEN_EELS.above - 10));
});

test('an eel dives in fast, waits, then rises slowly back out', () => {
    const e = eelAt(0);
    for (let k = 0; k < 10; k++) stepEel(e, true, 1 / 60);
    assert.ok(e.out < 0.1);
    stepEel(e, false, GARDEN_EELS.calm / 2);
    const waiting = e.out;
    stepEel(e, false, 0.1);
    assert.equal(e.out, waiting);
    for (let k = 0; k < 200; k++) stepEel(e, false, 1 / 60);
    assert.ok(e.out > 0.5);
    for (let k = 0; k < 200; k++) stepEel(e, false, 1 / 60);
    assert.equal(e.out, 1);
});
