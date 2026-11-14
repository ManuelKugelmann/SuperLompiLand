import test from 'node:test';
import assert from 'node:assert/strict';
import { SURGE_CHANNEL, channelSpot, swell, channelShare, channelFlow, channelLean } from '../game/level/surgeChannel.js';
import { BIOMES } from '../game/level/biomes.js';
import { createField } from '../game/level/density.js';
import { worldMap, LANDMARK_KINDS } from '../game/level/worldMap.js';

test('the surge channel lies in the kelp forest after the side cave and is a landmark on the map', () => {
    const s = channelSpot(), b = BIOMES.find(bi => bi.id === 'kelp'), cave = createField(1337).cave;
    assert.ok(s.x0 > b.from && s.x1 < b.from + b.width);
    assert.ok(s.x0 > cave.x1 + 1000, 'clear of the cave and its own current');
    assert.ok(LANDMARK_KINDS.includes('surge'));
    assert.equal(worldMap().features.filter(f => f.kind === 'surge').length, 1);
});

test('the swell pushes east for most of its time, draws back for the rest, and never jumps', () => {
    const C = SURGE_CHANNEL;
    let east = 0, prev = swell(0), carried = 0;
    for (let t = 0; t < C.periodS; t += 0.01) {
        const w = swell(t);
        assert.ok(w >= -1 && w <= 1);
        assert.ok(Math.abs(w - prev) < 0.05, `smooth at ${t.toFixed(2)}`);
        if (w > 0) east += 0.01;
        carried += (w > 0 ? w * C.forward : w * C.back) * 0.01 * 60;
        prev = w;
    }
    assert.ok(Math.abs(east / C.periodS - C.pushShare) < 0.02);
    assert.ok(carried > 400, `on balance it carries the fish on east (${Math.round(carried)} px a round)`);
    assert.ok(Math.abs(swell(1.3) - swell(1.3 + C.periodS)) < 1e-9);
});

test('the pull is there along the route inside the channel, eases in at its ends and fades away above and below', () => {
    const C = SURGE_CHANNEL, s = channelSpot(), route = 1000, peak = C.periodS * C.pushShare / 2;
    assert.equal(channelShare(s.x0 - 1), 0);
    assert.equal(channelShare(s.x), 1);
    assert.ok(channelShare(s.x0 + C.ends / 2) > 0 && channelShare(s.x0 + C.ends / 2) < 1);
    assert.ok(Math.abs(channelFlow(s.x, route, peak, route).x - C.forward) < 1e-6, 'full push in the middle, on the route');
    assert.equal(channelFlow(s.x, route, peak, route).y, 0);
    assert.equal(channelFlow(s.x0 - 50, route, peak, route).x, 0);
    assert.equal(channelFlow(s.x, route - C.half - 10, peak, route).x, 0);
    assert.ok(channelFlow(s.x, route + C.half / 2, peak, route).x < C.forward);
    const back = C.periodS * (C.pushShare + (1 - C.pushShare) / 2);
    assert.ok(Math.abs(channelFlow(s.x, route, back, route).x + C.back) < 1e-6, 'and the draw back is weaker');
    assert.ok(channelLean(s.x, peak) > 0 && channelLean(s.x, back) < 0 && channelLean(s.x0 - 10, peak) === 0, 'the kelp leans with it');
});
