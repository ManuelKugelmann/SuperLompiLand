import test from 'node:test';
import assert from 'node:assert/strict';
import { worldMap, quietStretches, SET_PIECE_KINDS } from '../game/level/worldMap.js';
import { BIOMES, WORLD_END } from '../game/level/biomes.js';

const map = worldMap();

test('the coarse map covers the whole world: every biome, its sub-zones end to end, and what is met along the way', () => {
    for (const b of BIOMES) {
        const mine = map.zones.filter(z => z.biome === b.id);
        assert.ok(mine.length >= 1 && mine[0].x0 === b.from && Math.abs(mine.at(-1).x1 - (b.from + b.width)) < 1e-6, b.id);
        for (let i = 1; i < mine.length; i++) assert.equal(mine[i].x0, mine[i - 1].x1, `${b.id}: no hole between sub-zones`);
        assert.equal(mine.length > 1, !!b.zones);
    }
    for (let i = 1; i < map.features.length; i++) assert.ok(map.features[i].x0 >= map.features[i - 1].x0, 'west to east');
    for (const kind of ['nest', 'rescue', 'friend', 'crest', 'cave', 'docks', 'arch', 'ship', 'storm', 'current', 'bloom', 'raft', 'manta', 'whale']) assert.ok(map.features.some(f => f.kind === kind), kind);
    assert.equal(worldMap(), map, 'made once');
});

test('never two set pieces on one screen (spec 5.0i)', () => {
    const big = map.features.filter(f => SET_PIECE_KINDS.includes(f.kind));
    for (let i = 1; i < big.length; i++) assert.ok(big[i].x0 - big[i - 1].x1 > 2600, `${big[i - 1].kind} and ${big[i].kind} are ${Math.round(big[i].x0 - big[i - 1].x1)} px apart`);
});

test('no long stretch of the route without anything on the map', () => {
    const quiet = quietStretches(map, 3);
    for (const q of quiet) assert.ok(q.x1 - q.x0 <= 20000, `nothing from ${Math.round(q.x0)} to ${Math.round(q.x1)}`);
    assert.ok(quiet[0].x1 <= WORLD_END);
});
