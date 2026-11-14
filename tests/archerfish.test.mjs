import test from 'node:test';
import assert from 'node:assert/strict';
import { ARCHER, archerX, archerBeat, jetPoint } from '../game/level/archerfish.js';
import { BIOMES } from '../game/level/biomes.js';
import { gardenSpot } from '../game/level/jellyGarden.js';

test('it lives in the mangrove, well after the jelly garden', () => {
    const b = BIOMES.find(x => x.id === 'mangrove'), x = archerX();
    assert.ok(x > b.from && x < b.from + b.width);
    assert.ok(x - gardenSpot().x1 > 20000);
});

test('a round goes aim, spit, fall, snap, wait, land and repeats', () => {
    const names = [];
    for (let u = 0; u < ARCHER.cycleS; u += 0.05) { const n = archerBeat(u).name; if (names.at(-1) !== n) names.push(n); }
    assert.deepEqual(names, ['aim', 'spit', 'fall', 'snap', 'wait', 'land']);
    assert.equal(archerBeat(0).name, archerBeat(ARCHER.cycleS).name);
});

test('the jet starts at the mouth, ends at the fly and bows up between', () => {
    const a = { x: 0, y: 100 }, b = { x: 200, y: -100 };
    assert.deepEqual(jetPoint(a, b, 0), a);
    assert.deepEqual(jetPoint(a, b, 1), b);
    assert.ok(jetPoint(a, b, 0.5).y < 0);
});
