import test from 'node:test';
import assert from 'node:assert/strict';
import { worldMap, quietStretches, rhythm, moments, spotsOf, RHYTHM, SET_PIECE_KINDS } from '../game/level/worldMap.js';
import { isSea } from '../game/level/biomes.js';
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

test('even rhythm (spec 5.0l): something small every 2 000-4 000 px, a landmark every 13 000-20 000 px, never crowded, never empty', () => {
    const r = rhythm(map);
    assert.ok(r.small.max <= RHYTHM.small[1], `longest stretch with nothing at all: ${Math.round(r.small.max)} px`);
    assert.ok(r.small.median >= RHYTHM.small[0], `things are not crowded: median gap ${Math.round(r.small.median)} px`);
    assert.ok(r.landmark.max <= RHYTHM.landmark[1], `longest way between two landmarks: ${Math.round(r.landmark.max)} px (${Math.round(r.seconds(r.landmark.max))} s)`);
    assert.ok(r.landmark.min >= RHYTHM.merge, `shortest: ${Math.round(r.landmark.min)} px`);
    assert.ok(r.landmark.ratio < RHYTHM.ratio, `longest / shortest landmark gap: ${r.landmark.ratio.toFixed(2)}`);
    assert.ok(r.landmark.first <= RHYTHM.landmark[1] && r.landmark.last <= RHYTHM.landmark[1], 'the first landmark comes soon, the grand nest follows the last one soon');
    assert.ok(Math.abs(r.seconds(3300) - 10) < 1e-9);
});

test('the fillers stand where they belong: coral colonies along the islands, adult sharks out at sea, one every 40 000 px of the blue', () => {
    for (const c of spotsOf('colony', map)) assert.ok(!isSea(c.x0), `colony at ${Math.round(c.x0)}`);
    for (const s of spotsOf('bigshark', map)) assert.ok(isSea(s.x0), `shark at ${Math.round(s.x0)}`);
    const blue = map.zones.find(z => z.biome === 'blue');
    assert.ok(spotsOf('bigshark', map).filter(s => s.x0 > blue.x0 && s.x0 < blue.x1).length >= Math.floor((blue.x1 - blue.x0) / RHYTHM.sharks));
    assert.ok(spotsOf('colony', map).length >= 10 && spotsOf('treat', map).length >= 100);
    assert.ok(moments(map.features).length >= 45);
});
