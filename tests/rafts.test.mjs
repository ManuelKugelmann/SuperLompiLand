import test from 'node:test';
import assert from 'node:assert/strict';
import { RAFTS, FLYERS, raftSpots, flyersAt, flyerAt } from '../game/level/rafts.js';
import { BIOMES, isSea } from '../game/level/biomes.js';
import { stormSpan } from '../game/level/weather.js';

test('sargassum rafts float again and again on both open seas, never under the storm', () => {
    const spots = raftSpots(), { x0, x1 } = stormSpan();
    assert.ok(spots.length >= 8, `${spots.length} rafts`);
    for (const id of RAFTS.seas) assert.ok(spots.filter(s => BIOMES.find(b => b.id === id).from < s.x && s.x < BIOMES.find(b => b.id === id).from + BIOMES.find(b => b.id === id).width).length >= 3, id);
    for (const s of spots) {
        assert.ok(isSea(s.x));
        assert.ok(s.x < x0 - RAFTS.keep || s.x > x1 + RAFTS.keep, 'not under the storm');
    }
    for (let i = 1; i < spots.length; i++) assert.ok(spots[i].x - spots[i - 1].x >= RAFTS.every - 1);
});

test('flying fish break the surface only out at sea', () => {
    assert.ok(flyersAt(BIOMES.find(b => b.id === 'blue').from + 20000));
    assert.ok(!flyersAt(0));
});

test('a burst: each fish leaves the water ahead of the skim, glides a long flat arc and dives back in', () => {
    for (const dir of [1, -1]) {
        for (let i = 0; i < FLYERS.count; i++) {
            let top = 0, far = 0, steps = 0, left = false;
            for (; steps < 400; steps++) {
                const p = flyerAt(i, 3.3, 1000, -10, dir, steps);
                if (!p.out) { assert.ok(!left, 'it waits its turn only before it flies'); continue; }
                left = true;
                if (p.done) break;
                assert.ok((p.x - 1000) * dir >= FLYERS.ahead[0] - 1, 'ahead of the skim, in its direction');
                top = Math.min(top, p.y + 10); far = Math.max(far, Math.abs(p.x - 1000));
            }
            assert.ok(steps < 400, 'it comes down again');
            assert.ok(top < -60 && top > -400, `height ${Math.round(-top)}`);
            assert.ok(far > 600, `a long glide: ${Math.round(far)}`);
        }
    }
    assert.notEqual(flyerAt(0, 3.3, 1000, -10, 1, 30).x, flyerAt(1, 3.3, 1000, -10, 1, 30).x, 'not in step');
});
