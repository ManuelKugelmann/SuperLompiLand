import test from 'node:test';
import assert from 'node:assert/strict';
import { PERF_TOUR, createPerfTour, perfReport } from '../game/perfTour.js';

const biomeAt = x => (x < 5000 ? 'beach' : 'reef');

test('the tour hops along the route, stays a while at each stop and ends at the last one', () => {
    const t = createPerfTour(0, 7000, biomeAt);
    const stops = [t.x];
    for (let i = 0; i < 2000 && !t.done; i++) if (t.step(100)) stops.push(t.x);
    assert.deepEqual(stops, [0, 2400, 4800, 7000]);
    assert.ok(t.done);
    assert.equal(t.step(100), false);
});

test('it keeps the worst of each number per biome and skips the frames right after a hop', () => {
    const t = createPerfTour(0, 7000, biomeAt);
    t.sample({ logicMs: 99, chunkMs: 99, objects: 9999, tweens: 999 });      // right at the start: not counted
    t.step(PERF_TOUR.skipMs);
    t.sample({ logicMs: 1.5, chunkMs: 8, objects: 300, tweens: 40 });
    t.sample({ logicMs: 2.5, chunkMs: 3, objects: 280, tweens: 60 });
    const [r] = t.rows();
    assert.deepEqual([r.biome, r.logicMs, r.chunkMs, r.objects, r.tweens, r.frames], ['beach', 2.5, 8, 300, 60, 2]);
    assert.deepEqual(r.over, []);
});

test('a broken budget is named, per biome, and shows in the report', () => {
    const t = createPerfTour(0, 7000, biomeAt);
    for (let i = 0; i < 400 && !t.done; i++) {
        t.step(100);
        t.sample({ logicMs: t.x >= 5000 ? 6 : 1, chunkMs: 4, objects: t.x >= 5000 ? 700 : 200, tweens: 10 });
    }
    const rows = t.rows();
    assert.deepEqual(rows.map(r => r.biome), ['beach', 'reef']);
    assert.deepEqual(rows[0].over, []);
    assert.deepEqual(rows[1].over, ['logicMs', 'objects']);
    const text = perfReport(rows);
    assert.equal(text.length, 3);
    assert.ok(text[2].includes('OVER: logicMs, objects'));
    assert.ok(!text[1].includes('OVER'));
});
