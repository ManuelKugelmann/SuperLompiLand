import test from 'node:test';
import assert from 'node:assert/strict';
import { ESCORT, schoolPlace, escortStep } from '../game/escort.js';

test('the freed friends swim behind the fish as a school: the newest nearest, staggered, never on one spot', () => {
    const at = Array.from({ length: ESCORT.max }, (_, k) => ({ ...schoolPlace(k, 1000, 500, 1, 0) }));
    for (let k = 0; k < at.length; k++) {
        assert.ok(at[k].x < 1000 - ESCORT.behind + 1, 'behind the fish');
        if (k) assert.ok(at[k].x < at[k - 1].x, 'each next one further back');
        for (let j = 0; j < k; j++) assert.ok(Math.hypot(at[k].x - at[j].x, at[k].y - at[j].y) > 100, `friends ${j} and ${k} are apart`);
    }
    assert.ok(new Set(at.map(p => Math.round(p.y / 30))).size >= 4, 'at several heights');
    assert.ok(schoolPlace(0, 1000, 500, -1, 0).x > 1000, 'on the other side when the fish travels west');
});

test('each keeps up with a swimming fish, trailing softly, and never jumps while it is near', () => {
    for (const k of [0, 5]) {
        const p = { x: 0, y: 500 };
        let fx = 200, prev = { ...p };
        for (let i = 0; i < 60 * 20; i++) {
            fx += 330 / 60;
            const want = schoolPlace(k, fx, 500, 1, i / 60);
            escortStep(p, k, want.x, want.y, fx, 1, 1 / 60);
            assert.ok(Math.hypot(p.x - prev.x, p.y - prev.y) < 30, 'no jump');
            prev = { ...p };
        }
        const want = schoolPlace(k, fx, 500, 1, 20);
        assert.ok(p.x < fx && want.x - p.x < 330 * (ESCORT.catchS + k * ESCORT.lagS) * 1.3 + 5, `friend ${k} trails by ${Math.round(want.x - p.x)} px`);
        assert.ok(fx - p.x < 1300, 'still in the picture of a 1920 px wide view... or just behind its edge');
    }
});

test('left far behind (the fish was set somewhere else), a friend comes in again from just outside the view', () => {
    const p = { x: 0, y: 300 }, fx = 50000, want = schoolPlace(1, fx, 900, 1, 0);
    escortStep(p, 1, want.x, want.y, fx, 1, 1 / 60);
    assert.ok(fx - p.x > 960 && fx - p.x <= ESCORT.reenter + ESCORT.spacing, 'behind the fish, outside a 1920 px wide view');
    assert.ok(Math.abs(p.y - want.y) < 5, 'at its own height');
});

test('those who follow keep below the HUD band at the top of the view', async () => {
    const { belowHud, ESCORT } = await import('../game/escort.js');
    assert.equal(belowHud(500, 300), 500);
    assert.equal(belowHud(320, 300), 300 + ESCORT.hudClear);
});
