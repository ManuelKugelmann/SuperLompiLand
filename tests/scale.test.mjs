import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sizeFor, SIZES, SCALE } from '../game/scale.js';

test('Lompi is the yardstick and small things are true to scale', () => {
    assert.equal(sizeFor(SCALE.lompi.m), SCALE.lompi.px);
    assert.equal(sizeFor(0.6), SCALE.lompi.px * 2);
});

test('bigger is always drawn bigger, and the curve is continuous at a metre', () => {
    let last = 0;
    for (let m = 0.1; m < 40; m += 0.1) { const s = sizeFor(m); assert.ok(s >= last, `${m}`); last = s; }
    assert.ok(Math.abs(sizeFor(1.001) - sizeFor(0.999)) < 3);
});

test('ships and wrecks feel huge (spec 5.0j)', () => {
    assert.ok(SIZES.fishingBoat[0] >= 2400, `${SIZES.fishingBoat}`);
    assert.ok(SIZES.sailingWreck[0] >= 3500, `${SIZES.sailingWreck}`);
    assert.ok(SIZES.ghostShip > SIZES.sailingWreck[1]);
    assert.ok(SIZES.whale > SIZES.manta && SIZES.manta > SIZES.reefShark && SIZES.reefShark > SIZES.turtle);
});
