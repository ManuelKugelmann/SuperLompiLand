import test from 'node:test';
import assert from 'node:assert/strict';
import { NUDI_GARDEN, nudiSpot, nudiAt, nudiPos, dragonPos } from '../game/level/nudiGarden.js';
import { BIOMES } from '../game/level/biomes.js';

test('the garden lies on the reef, every kind appears', () => {
    const b = BIOMES.find(x => x.id === 'reef'), s = nudiSpot();
    assert.ok(s.x0 >= b.from && s.x1 <= b.from + b.width);
    const kinds = new Set(Array.from({ length: NUDI_GARDEN.crawlers }, (_, i) => nudiAt(i).key));
    assert.equal(kinds.size, NUDI_GARDEN.kinds.length);
});

test('a slug creeps slowly to and fro round its home and turns at the ends', () => {
    const n = nudiAt(0);
    let minX = Infinity, maxX = -Infinity, turns = 0, last = null;
    for (let t = 0; t < 120; t += 0.1) {
        const p = nudiPos(n, t);
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        if (last !== null && p.facing !== last) turns++;
        last = p.facing;
    }
    assert.ok(maxX - n.home <= NUDI_GARDEN.range + 1e-6 && n.home - minX <= NUDI_GARDEN.range + 1e-6);
    assert.ok(turns >= 2);
    assert.ok(Math.abs(nudiPos(n, 1).x - nudiPos(n, 0).x) <= NUDI_GARDEN.creep[1] + 1e-6);
});

test('the blue dragon drifts across the garden and back', () => {
    const s = nudiSpot();
    const xs = Array.from({ length: 300 }, (_, i) => dragonPos(i * NUDI_GARDEN.swimS / 300).x);
    assert.ok(Math.min(...xs) >= s.x0 - 1e-6 && Math.max(...xs) <= s.x1 + 1e-6);
    assert.ok(Math.max(...xs) - Math.min(...xs) > (s.x1 - s.x0) * 0.9);
});
