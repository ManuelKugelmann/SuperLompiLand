import test from 'node:test';
import assert from 'node:assert/strict';
import { worldMap, quietStretches, rhythm, moments, spotsOf, RHYTHM, SET_PIECE_KINDS, LANDMARK_KINDS, SCENERY_KINDS } from '../game/level/worldMap.js';
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

test('small beats (spec 5.0l): something every 2 000-4 000 px, never crowded, never empty', () => {
    const r = rhythm(map);
    assert.ok(r.small.max <= RHYTHM.small[1], `longest stretch with nothing at all: ${Math.round(r.small.max)} px`);
    assert.ok(r.small.median >= RHYTHM.small[0], `things are not crowded: median gap ${Math.round(r.small.median)} px`);
    assert.ok(Math.abs(r.seconds(3300) - 10) < 1e-9);
});

test('still scenery is a small beat, not a landmark (spec 5.0n)', () => {
    for (const k of SCENERY_KINDS) assert.ok(!LANDMARK_KINDS.includes(k), k);
    assert.ok(moments(map.features).every(m => !m.kinds.includes('colony')));
    const two = [{ kind: 'manta', x0: 0, x1: 100 }, { kind: 'manta', x0: 20000, x1: 20100 }, { kind: 'bloom', x0: 40000, x1: 40100 }, { kind: 'colony', x0: 50000, x1: 50000 }];
    const r = rhythm({ start: 0, to: 60000, features: two });
    assert.deepEqual(r.landmark.repeats, [{ kind: 'manta', x0: 20000 }], 'the same kind twice in a row is reported; scenery in between or after is not a landmark');
});

// Expected to fail until the mangrove's new set pieces (5.0n: jellyfish garden, root nursery) and the
// reef's cleaner station are on the map: without the coral colonies the mangrove has gaps of 2.4 and
// 3.4 minutes, and the reef passes the manta three times in a row.
test('landmarks (spec 5.0l, 5.0n): one every 13 000-20 000 px, evenly, never the same kind twice in a row', { todo: 'waits for the 5.0n set pieces' }, () => {
    const r = rhythm(map);
    assert.ok(r.landmark.max <= RHYTHM.landmark[1], `longest way between two landmarks: ${Math.round(r.landmark.max)} px (${Math.round(r.seconds(r.landmark.max))} s)`);
    assert.ok(r.landmark.ratio < RHYTHM.ratio, `longest / shortest landmark gap: ${r.landmark.ratio.toFixed(2)}`);
    assert.deepEqual(r.landmark.repeats, [], 'no kind twice in a row');
});

test('landmarks are never crowded, and the journey begins and ends with one soon', () => {
    const r = rhythm(map);
    assert.ok(r.landmark.min >= RHYTHM.merge, `shortest: ${Math.round(r.landmark.min)} px`);
    assert.ok(r.landmark.first <= RHYTHM.landmark[1] && r.landmark.last <= RHYTHM.landmark[1], 'the first landmark comes soon, the grand nest follows the last one soon');
});

test('the fillers stand where they belong: coral colonies along the islands, adult sharks out at sea, one every 40 000 px of the blue', () => {
    for (const c of spotsOf('colony', map)) assert.ok(!isSea(c.x0), `colony at ${Math.round(c.x0)}`);
    for (const s of spotsOf('bigshark', map)) assert.ok(isSea(s.x0), `shark at ${Math.round(s.x0)}`);
    const blue = map.zones.find(z => z.biome === 'blue');
    assert.ok(spotsOf('bigshark', map).filter(s => s.x0 > blue.x0 && s.x0 < blue.x1).length >= Math.floor((blue.x1 - blue.x0) / RHYTHM.sharks));
    assert.ok(spotsOf('colony', map).length >= 10 && spotsOf('treat', map).length >= 100);
    assert.ok(moments(map.features, RHYTHM, [...LANDMARK_KINDS, ...SCENERY_KINDS]).length >= 45, 'sights of any kind');
});
