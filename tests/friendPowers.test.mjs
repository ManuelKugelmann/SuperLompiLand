import test from 'node:test';
import assert from 'node:assert/strict';
import { FRIEND_POWERS, powersOf, magnetStep } from '../game/friendPowers.js';

test('powers come from the friends in the school, and the switch turns them off', () => {
    assert.equal(powersOf([]).magnet, null);
    assert.ok(powersOf(['seahorse']).magnet);
    assert.ok(powersOf(['turtle', 'seahorse']).shell);
    assert.equal(powersOf(['seahorse'], { ...FRIEND_POWERS, enabled: false }).magnet, null);
});

test('the magnet pulls coins in reach toward Lompi, never past him, and leaves the rest', () => {
    const m = FRIEND_POWERS.seahorse;
    assert.equal(magnetStep(1000, 0, 0, 0, m), null);
    const p = magnetStep(200, 0, 0, 0, m);
    assert.ok(p.x < 200 && p.x >= 0 && p.y === 0);
    const close = magnetStep(3, 0, 0, 0, m);
    assert.ok(close.x >= 0);
    let x = m.reach - 1, steps = 0;
    while (x > 0.5 && steps < 500) { x = magnetStep(x, 0, 0, 0, m).x; steps++; }
    assert.ok(steps < 120, `took ${steps} steps`);
});
