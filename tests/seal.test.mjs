import test from 'node:test';
import assert from 'node:assert/strict';
import { SEAL, sealSpot, createSeal, stepSeal, sealBob } from '../game/level/seal.js';
import { BIOMES } from '../game/level/biomes.js';
import { createField, ROUTE } from '../game/level/density.js';
import { worldMap, LANDMARK_KINDS } from '../game/level/worldMap.js';

test('the seal sleeps in the harbour, in open water just over the lane, and is a landmark on the map', () => {
    const s = sealSpot(), b = BIOMES.find(bi => bi.id === 'harbour'), f = createField(1337), route = f.routeY(s.x);
    assert.ok(s.x0 > b.from && s.x1 < b.from + b.width);
    assert.ok(LANDMARK_KINDS.includes('seal'));
    assert.equal(worldMap().features.filter(ft => ft.kind === 'seal').length, 1);
    for (let y = route - SEAL.above - SEAL.height / 2 - SEAL.bob; y <= route - SEAL.above + SEAL.height / 2 + SEAL.bob; y += 30) assert.ok(f.density(s.x, y) < 0.53, `open water at ${Math.round(y)}`);
    assert.ok(SEAL.above - SEAL.height / 2 < ROUTE.halfWidth, 'it hangs into the picture of a fish on the lane');
    assert.ok(SEAL.above - SEAL.height / 2 > 40, 'but its tail stays clear of the lane\'s middle');
});

test('it wakes when the fish comes near and sleeps again a while after the fish has gone', () => {
    const seal = createSeal();
    stepSeal(seal, 900, 0, 0.1);
    assert.equal(seal.awake, false, 'far away: asleep');
    stepSeal(seal, SEAL.wake - 10, 0, 0.1);
    assert.equal(seal.awake, true);
    stepSeal(seal, 900, 0, SEAL.sleepS * 0.5);
    assert.equal(seal.awake, true, 'it looks after the fish for a moment');
    stepSeal(seal, 900, 0, SEAL.sleepS * 0.6);
    assert.equal(seal.awake, false);
    stepSeal(seal, 100, 50, 0.1); stepSeal(seal, 900, 0, 1); stepSeal(seal, 100, 50, 0.1); stepSeal(seal, 900, 0, SEAL.sleepS - 0.5);
    assert.equal(seal.awake, true, 'coming back starts the wait again');
});

test('awake, its head follows the fish, up and down and to either side, never further than it can turn', () => {
    const seal = createSeal();
    for (let i = 0; i < 60; i++) stepSeal(seal, 200, 200, 1 / 60);
    assert.ok(seal.head > 0.3 && seal.head <= SEAL.turn + 1e-9, 'down toward a fish below');
    assert.equal(seal.side, 1);
    for (let i = 0; i < 60; i++) stepSeal(seal, -200, -300, 1 / 60);
    assert.ok(seal.head < -0.3 && seal.head >= -SEAL.turn - 1e-9, 'up toward a fish above');
    assert.equal(seal.side, -1, 'and it looks the other way');
    for (let i = 0; i < 300; i++) stepSeal(seal, 2000, 0, 1 / 60);
    assert.ok(Math.abs(seal.head) < 0.01, 'asleep again: head straight');
    assert.ok(Math.abs(sealBob(1.3)) <= SEAL.bob);
});
