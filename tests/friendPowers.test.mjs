import test from 'node:test';
import assert from 'node:assert/strict';
import { FRIEND_POWERS, COIN_PULL, powersOf, magnetStep } from '../game/friendPowers.js';

test('powers come from the friends in the school, and the switch turns them off', () => {
    assert.equal(powersOf([]).magnet, COIN_PULL, 'everyone catches coins close by');
    assert.ok(powersOf(['seahorse']).magnet.reach > COIN_PULL.reach, 'Hüpfi reaches further');
    assert.ok(powersOf(['turtle', 'seahorse']).shell);
    assert.equal(powersOf(['seahorse'], { ...FRIEND_POWERS, enabled: false }).magnet, COIN_PULL);
    assert.equal(powersOf(['turtle'], { ...FRIEND_POWERS, enabled: false }).shell, null);
});

test('the magnet pulls coins in reach toward Lompi, never past him, and leaves the rest', () => {
    const m = FRIEND_POWERS.seahorse;
    assert.equal(magnetStep(1000, 0, 0, 0, m), null);
    const p = magnetStep(200, 0, 0, 0, m);
    assert.ok(p.x < 200 && p.x >= 0 && p.y === 0);
    const close = magnetStep(3, 0, 0, 0, m);
    assert.ok(close.x >= 0);
    let x = m.reach - 1, steps = 0;
    while (x > 0.5 && steps < 500) { x = magnetStep(x, 0, 0, 0, m, steps).x; steps++; }
    assert.ok(steps < 40, `took ${steps} steps`);
});

test('a caught coin always arrives, also behind a fast swimmer, and never hovers at the edge of the reach', () => {
    const m = COIN_PULL;
    let cx = -(m.reach - 5), fx = 0, age = 1, steps = 0;      // caught a step ago, in reach
    assert.equal(magnetStep(-(m.reach + 5), 0, 0, 0, m), null, 'not caught yet: left alone');
    while (Math.abs(fx - cx) > 1 && steps < 300) {
        fx += 14;      // Lompi sprints away
        const s = magnetStep(cx, 0, fx, 0, m, age);
        assert.ok(s, 'once caught it keeps coming, also out of reach');
        assert.ok(s.x > cx && s.x <= fx);
        cx = s.x; age++; steps++;
    }
    assert.ok(steps < 120, `took ${steps} steps`);
});
