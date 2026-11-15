import test from 'node:test';
import assert from 'node:assert/strict';
import { FRIEND_POWERS, COIN_PULL, POWER_WORDS, powersOf, magnetStep, litDepth, coinTaken } from '../game/friendPowers.js';

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

test('the pull is by time: one call of four 60ths of a second moves as far as four calls of one', () => {
    const m = COIN_PULL;
    let x = -100, age = 1;
    for (let i = 0; i < 4; i++) { x = magnetStep(x, 0, 0, 0, m, age, 1).x; age += 1; }
    const once = magnetStep(-100, 0, 0, 0, m, 1, 4).x;
    assert.ok(Math.abs(once - x) < 12, `slow phone ${once.toFixed(1)} vs fast ${x.toFixed(1)}`);
});

test('every friend with a power says it, and the new powers come from the right friends', () => {
    for (const [id, p] of Object.entries(FRIEND_POWERS)) if (id !== 'enabled' && p.kind !== 'glide') assert.ok(POWER_WORDS[id], id);
    const all = powersOf(['jellyfish', 'firefish', 'shark']);
    assert.ok(all.light && all.spines && all.sense);
    assert.equal(powersOf([]).light, null);
});

test('Quallina gives back part of the light in the deep, never more than full light', () => {
    assert.equal(litDepth(0.42, null), 0.42);
    const lit = litDepth(0.42, FRIEND_POWERS.jellyfish);
    assert.ok(lit > 0.42 && lit < 1);
    assert.equal(litDepth(1, FRIEND_POWERS.jellyfish), 1);
});

test('a pulled coin counts when it arrives at Lompi, not when it starts to fly', () => {
    assert.equal(coinTaken(80, 60, 40, false), true, 'touched: taken');
    assert.equal(coinTaken(80, 60, 40, true), false, 'still flying');
    assert.equal(coinTaken(10, 60, 40, true), true, 'arrived');
    // and a pulled coin does arrive: the pull lands it on him
    let x = 140, age = 0;
    while (!coinTaken(Math.abs(x), 60, 40, true) && age < 200) { x = magnetStep(x, 0, 0, 0, COIN_PULL, age, 1).x; age++; }
    assert.ok(age < 200);
});
