import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sizeFor, fitWidth, SIZES, SCALE, LENGTHS } from '../game/scale.js';

test('Lompi is the yardstick and small things are true to scale', () => {
    assert.equal(sizeFor(SCALE.lompi.m), SCALE.lompi.px);
    assert.equal(sizeFor(0.6), SCALE.lompi.px * 2);
});

test('bigger is always drawn bigger, and the curve is continuous at a metre', () => {
    let last = 0;
    for (let m = 0.1; m < 40; m += 0.1) { const s = sizeFor(m); assert.ok(s >= last, `${m}`); last = s; }
    assert.ok(Math.abs(sizeFor(1.001) - sizeFor(0.999)) < 3);
});

test('the biggest thing fills the view and nothing is larger (fill and fit)', () => {
    const all = Object.values(SIZES).flat(), max = Math.max(...all), view = SCALE.fill * SCALE.view.w;
    assert.ok(Math.abs(max - view) <= 1, `${max} ${view}`);
    assert.ok(all.every(s => s <= view + 1));
    assert.ok(SIZES.whale > SIZES.manta && SIZES.manta > SIZES.reefShark && SIZES.reefShark > SIZES.turtle);
    assert.ok(SIZES.sailingWreck[0] > SIZES.fishingBoat[1] && SIZES.fishingBoat[0] > SIZES.rowboat[1]);
});

test('a tall picture is narrowed until it fits the view height too', () => {
    const w = fitWidth(LENGTHS.ghostShip, 0.88);
    assert.ok(w * 0.88 <= SCALE.fill * SCALE.view.h + 1);
    assert.equal(fitWidth(LENGTHS.ghostShip, 0.3), SIZES.ghostShip);
});
