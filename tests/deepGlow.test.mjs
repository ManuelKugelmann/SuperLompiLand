import test from 'node:test';
import assert from 'node:assert/strict';
import { DEEP_GLOW, glowShare, glowCell } from '../game/level/deepGlow.js';

const cellOf = y => Math.floor(y / DEEP_GLOW.cell);

test('nothing glows in the sunlit water; the deep is fully alive', () => {
    assert.equal(glowShare(0), 0);
    assert.equal(glowShare(DEEP_GLOW.startY - 1), 0);
    assert.equal(glowShare(DEEP_GLOW.fullY + 10), 1);
    let shallow = 0, deep = 0;
    for (let cx = 0; cx < 200; cx++) {
        shallow += glowCell(cx, cellOf(800)).length;
        deep += glowCell(cx, cellOf(5000)).length;
    }
    assert.equal(shallow, 0);
    assert.ok(deep > 200 * DEEP_GLOW.perCell * 0.8 && deep < 200 * DEEP_GLOW.perCell * 1.2, `deep ${deep}`);
});

test('placement is deterministic, inside its cell, and stays out of rock', () => {
    const a = glowCell(17, 8, 99), b = glowCell(17, 8, 99);
    assert.deepEqual(a, b);
    for (const g of glowCell(40, 9)) {
        assert.ok(g.x >= 40 * DEEP_GLOW.cell && g.x < 41 * DEEP_GLOW.cell);
        assert.ok(['jelly', 'string', 'sparks'].includes(g.kind));
    }
    let all = 0;
    for (let cx = 0; cx < 100; cx++) all += glowCell(cx, 8, 1337, () => false).length;
    assert.equal(all, 0, 'nothing placed in rock');
});

test('at night a little glow lives in shallow water too, by day none', () => {
    let day = 0, night = 0;
    for (let cx = 0; cx < 200; cx++) { day += glowCell(cx, 0, 1337, null, DEEP_GLOW, 0).length; night += glowCell(cx, 0, 1337, null, DEEP_GLOW, 1).length; }
    assert.equal(day, 0);
    assert.ok(night > 20, `${night}`);
});
