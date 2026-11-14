import test from 'node:test';
import assert from 'node:assert/strict';
import { RESCUES, rescueSpots, freesRescue } from '../game/rescues.js';
import { BIOMES, WORLD_END } from '../game/level/biomes.js';
import { createField } from '../game/level/density.js';
import { chapters } from '../game/journey.js';
import { weatherZones } from '../game/level/weather.js';
import { seaArch } from '../game/level/seaArch.js';

const spots = rescueSpots(), f = createField(1337);

test('a small rescue waits every so often along the whole journey, in every biome', () => {
    assert.ok(spots.length >= Math.floor(WORLD_END / RESCUES.every) - 2, `${spots.length} spots`);
    for (let i = 1; i < spots.length; i++) {
        const gap = spots[i].x - spots[i - 1].x;
        assert.ok(gap > RESCUES.every * 0.4 && gap < RESCUES.every * 1.7, `gap ${Math.round(gap)} at ${Math.round(spots[i].x)}`);
    }
    for (const b of BIOMES) assert.ok(spots.some(s => s.biome === b.id), `one in ${b.id}`);
    assert.equal(new Set(spots.map(s => s.id)).size, spots.length, 'ids are unique');
    for (const s of spots) assert.ok(RESCUES.kinds[s.biome].includes(s.kind), `${s.kind} lives in ${s.biome}`);
});

test('none stands near a chapter\'s friend, a big event, a nest, the storm or the sea arch', () => {
    const w = weatherZones(), a = seaArch();
    for (const s of spots) {
        for (const c of chapters()) {
            assert.ok(Math.abs(s.x - c.x) > RESCUES.keep, `chapter ${c.id}`);
            if (c.event) assert.ok(s.x < c.event.x - RESCUES.keep || s.x > c.event.endX + RESCUES.keep, `event ${c.event.id}`);
        }
        for (const n of f.nests) assert.ok(Math.abs(s.x - n.x) > RESCUES.keep * 0.9, `nest at ${Math.round(n.x)} vs ${Math.round(s.x)}`);
        assert.ok(s.x < w.storm[0] || s.x > w.storm[1], 'not under the storm');
        assert.ok(s.x < a.x0 || s.x > a.x1, 'not in the sea arch');
    }
});

test('a touch frees it, a special from further away too, neither from far off', () => {
    assert.ok(freesRescue(0, 0, 100, 60));
    assert.ok(!freesRescue(0, 0, 200, 60));
    assert.ok(freesRescue(0, 0, 300, 200, true));
    assert.ok(!freesRescue(0, 0, 500, 0, true));
});
