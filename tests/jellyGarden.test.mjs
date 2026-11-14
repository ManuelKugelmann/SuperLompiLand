import test from 'node:test';
import assert from 'node:assert/strict';
import { JELLY_GARDEN, gardenSpot, jellyAt, pulseAt, gardenLift, gardenCoins } from '../game/level/jellyGarden.js';
import { BIOMES } from '../game/level/biomes.js';

const jellies = Array.from({ length: JELLY_GARDEN.count }, (_, i) => jellyAt(i));

test('the garden lies inside the mangrove', () => {
    const b = BIOMES.find(x => x.id === 'mangrove'), s = gardenSpot();
    assert.ok(s.x0 >= b.from && s.x1 <= b.from + b.width);
});

test('every jelly lies in the garden, thickest round the patch', () => {
    const s = gardenSpot(), mid = s.x0 + JELLY_GARDEN.patch * (s.x1 - s.x0), quarter = (s.x1 - s.x0) / 4;
    for (const j of jellies) assert.ok(j.x >= s.x0 && j.x <= s.x1);
    const near = jellies.filter(j => Math.abs(j.x - mid) < quarter / 2).length, edge = jellies.filter(j => j.x < s.x0 + quarter / 2).length;
    assert.ok(near > edge, `patch ${near} vs edge ${edge}`);
});

test('a pulse squeezes, fades and rests', () => {
    const j = { phase: 0 };
    assert.equal(pulseAt(j, 0), 1);
    assert.ok(pulseAt(j, JELLY_GARDEN.periodS * 0.2) < 1);
    assert.equal(pulseAt(j, JELLY_GARDEN.periodS * 0.8), 0);
});

test('the lift is upward, gentle, near the mud only, and nothing outside the garden', () => {
    const j = jellies[Math.floor(jellies.length / 2)], ground = 2000;
    const t = (1 - j.phase) * JELLY_GARDEN.periodS;          // the moment this jelly squeezes
    const low = gardenLift(j.x, ground - 20, ground, t, jellies).y;
    assert.ok(low < 0 && low >= -JELLY_GARDEN.lift);
    assert.equal(gardenLift(j.x, ground - JELLY_GARDEN.reach - 10, ground, t, jellies).y, 0);
    assert.equal(gardenLift(gardenSpot().x0 - 1000, ground - 20, ground, t, jellies).y, 0);
});

test('coins hang over the patch, lowest first, above the mud', () => {
    const c = gardenCoins(2000);
    assert.equal(c.length, JELLY_GARDEN.coins);
    for (let k = 1; k < c.length; k++) assert.ok(c[k].y < c[k - 1].y);
    assert.ok(c[0].y < 2000);
});
