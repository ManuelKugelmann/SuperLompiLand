import test from 'node:test';
import assert from 'node:assert/strict';
import { FERRY, ferrySpot, passage, hullX, washY, washAt } from '../game/level/ferry.js';
import { BIOMES } from '../game/level/biomes.js';
import { worldMap, LANDMARK_KINDS } from '../game/level/worldMap.js';

test('the ferry crosses in the harbour and is a landmark on the map', () => {
    const s = ferrySpot(), b = BIOMES.find(bi => bi.id === 'harbour');
    assert.ok(s.x0 > b.from && s.x1 < b.from + b.width);
    assert.ok(LANDMARK_KINDS.includes('ferry'));
    assert.equal(worldMap().features.filter(f => f.kind === 'ferry').length, 1);
});

test('a passage: it comes up from behind, overtakes the fish and is gone ahead', () => {
    const p = passage(10000, 1);
    assert.ok(hullX(p, 0) < 10000 - 1500, 'starts behind');
    assert.ok(Math.abs(hullX(p, p.seconds) - p.x1) < 1e-6 && p.x1 > 10000 + 2500, 'ends far ahead');
    assert.ok(FERRY.speed > 330, 'faster than a cruising fish');
    const west = passage(10000, -1);
    assert.ok(hullX(west, 0) > 10000 && hullX(west, west.seconds) < 10000, 'the other way when the fish travels west');
});

test('the wash runs from the stern down to the lane and carries along, strongest at the stern', () => {
    const surface = 0, route = 900, hx = 5000, stern = hx - FERRY.hull[0] / 2;
    assert.equal(washY(0, surface, route), surface + FERRY.hull[1], 'it starts under the stern');
    assert.equal(washY(FERRY.wash.length, surface, route), route + FERRY.wash.under, 'and reaches the lane');
    const at = s => washAt(stern - s, washY(s, surface, route), hx, 1, surface, route, {});
    assert.ok(at(100).x > at(700).x && at(700).x > at(1400).x && at(1400).x > 0, 'fading out behind');
    assert.ok(at(100).x <= FERRY.wash.carry && at(100).x > FERRY.wash.carry * 0.8);
    assert.equal(at(100).y, 0);
    assert.equal(washAt(stern + 50, 200, hx, 1, surface, route, {}).x, 0, 'nothing ahead of the stern');
    assert.equal(washAt(stern - FERRY.wash.length - 10, route, hx, 1, surface, route, {}).x, 0, 'nothing far behind');
    assert.equal(washAt(stern - 1400, washY(1400, surface, route) - FERRY.wash.half - 5, hx, 1, surface, route, {}).x, 0, 'nothing outside the band');
    // A fish on the lane is carried for a few seconds as the band sweeps over it.
    let carried = 0;
    for (let u = 0; u < 12; u += 1 / 60) if (washAt(6000, route, 4000 + FERRY.speed * u, 1, surface, route, {}).x > 0.5) carried += 1 / 60;
    assert.ok(carried > 1 && carried < 6, `carried for ${carried.toFixed(1)} s`);
    assert.ok(washAt(hx + FERRY.hull[0] / 2 + 700, washY(700, surface, route), hx, -1, surface, route, {}).x < -1, 'a westward passage carries west');
});
