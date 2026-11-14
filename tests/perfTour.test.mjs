import test from 'node:test';
import assert from 'node:assert/strict';
import { PERF_TOUR, createPerfTour, perfReport, slowSteps } from '../game/perfTour.js';

const biomeAt = x => (x < 5000 ? 'beach' : 'reef');

test('the tour hops along the route, stays a while at each stop and ends at the last one', () => {
    const t = createPerfTour(0, 7000, biomeAt, { ...PERF_TOUR, hop: 2400, warmMs: 0 });
    const stops = [t.x];
    for (let i = 0; i < 2000 && !t.done; i++) if (t.step(100)) stops.push(t.x);
    assert.deepEqual(stops, [0, 2400, 4800, 7000]);
    assert.ok(t.done);
    assert.equal(t.step(100), false);
});

test('it keeps the worst of each number per biome and skips the frames right after a hop', () => {
    const t = createPerfTour(0, 7000, biomeAt, { ...PERF_TOUR, hop: 2400, warmMs: 0 });
    t.sample({ logicMs: 99, chunkMs: 99, objects: 9999, tweens: 999 });      // right at the start: not counted
    t.step(PERF_TOUR.skipMs);
    t.sample({ logicMs: 1.5, chunkMs: 8, objects: 300, tweens: 40 });
    t.sample({ logicMs: 2.5, chunkMs: 3, objects: 280, tweens: 60 });
    const [r] = t.rows();
    assert.deepEqual([r.biome, r.logicMs, r.worstMs, r.chunkMs, r.objects, r.tweens, r.frames], ['beach', 2, 2.5, 8, 300, 60, 2]);
    assert.deepEqual(r.over, []);
    assert.deepEqual([r.p50Ms, r.p95Ms], [2.5, 2.5]);
});

test('a broken budget is named, per biome, and shows in the report', () => {
    const t = createPerfTour(0, 7000, biomeAt, { ...PERF_TOUR, hop: 2400, warmMs: 0 });
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

test('the first seconds of the tour do not count (start-up)', () => {
    const t = createPerfTour(0, 7000, biomeAt, { ...PERF_TOUR, hop: 2400 });
    t.step(PERF_TOUR.skipMs + 100);
    t.sample({ logicMs: 50, chunkMs: 50, objects: 1, tweens: 1 });
    assert.equal(t.rows().length, 0);
});

test('frames after a hop, while the view is not complete, are the hop\'s cost: kept apart, and the stop\'s time waits', () => {
    const t = createPerfTour(0, 50000, () => 'reef');
    t.step(PERF_TOUR.warmMs);      // past the warm-up (this hops once)
    t.step(PERF_TOUR.skipMs);
    assert.equal(t.step(PERF_TOUR.stayMs, true), false, 'no hop while the view is still being built');
    t.sample({ logicMs: 5, chunkMs: 120, renderMs: 300, objects: 100, tweens: 5, settling: true });
    t.sample({ logicMs: 2, chunkMs: 6, renderMs: 7, objects: 100, tweens: 5 });
    const r = t.rows()[0];
    assert.equal(r.hopMs, 125);
    assert.equal(r.hopRenderMs, 300, 'what drawing took during the hop is kept apart too');
    assert.equal(r.renderMs, 7);
    assert.equal(r.chunkMs, 6, 'the steady numbers do not include it');
    assert.equal(r.frames, 1);
    let hopped = false;
    for (let ms = 0; ms <= PERF_TOUR.settleMaxMs + PERF_TOUR.stayMs && !hopped; ms += 100) hopped = t.step(100, true);
    assert.ok(hopped, 'a view that never completes does not stop the tour');
});

test('build steps over the limit are named, slowest first, with the biome they happened in', () => {
    const steps = new Map([['paint rock', { ms: 12.4, x: 5000 }], ['strips', { ms: 3, x: 100 }], ['props', { ms: 30, x: 9000 }]]);
    const lines = slowSteps(steps, x => (x > 6000 ? 'blue' : 'reef'));
    assert.equal(lines.length, 2);
    assert.match(lines[0], /props.*30\.0 ms.*blue/);
    assert.match(lines[1], /paint rock.*12\.4 ms.*reef/);
});
