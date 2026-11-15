import test from 'node:test';
import assert from 'node:assert/strict';
import { SPLASH, splashSize, splashShape, dropVelocity } from '../game/fx/splash.js';

const seq = (s = 7) => () => (s = (s * 16807) % 2147483647) / 2147483647;

test('a splash grows with the speed: none for a bob, bigger in every part up to full speed, no bigger after', () => {
    assert.equal(splashShape(SPLASH.calm - 0.1, true), null);
    let last = null;
    for (const v of [SPLASH.calm, 5, 9, 14, SPLASH.full]) {
        const s = splashShape(v, true);
        if (last) for (const k of ['drops', 'up', 'dent', 'bubbles', 'deep']) assert.ok(s[k] >= last[k], `${k} at ${v}`);
        if (last) assert.ok(s.foam.w > last.foam.w);
        last = s;
    }
    assert.deepEqual(splashShape(40, true), splashShape(SPLASH.full, true));
    assert.equal(splashSize(SPLASH.full), 1);
    assert.equal(splashSize(SPLASH.calm), 0);
});

test('going in dents the water, pulls bubbles under and throws a crown; a leap out lifts it, no crown, no bubbles', () => {
    const inn = splashShape(12, true), out = splashShape(12, false);
    assert.ok(inn.dent > 0 && out.dent < 0);
    assert.ok(inn.crown > 0 && inn.crown < inn.drops && inn.bubbles > 0);
    assert.equal(out.crown, 0); assert.equal(out.bubbles, 0);
});

test('crown drops fly up and out on both sides; column drops go up and follow the fish', () => {
    const s = splashShape(SPLASH.full, true), rnd = seq(), v = {};
    let left = 0, right = 0;
    for (let i = 0; i < s.crown; i++) {
        dropVelocity(s, i, 0, rnd, v);
        assert.ok(v.vy < 0, 'up');
        if (v.vx < 0) left++; else right++;
        assert.ok(Math.abs(v.vx) > 0.3 * -v.vy, 'leans out');
    }
    assert.ok(left > 0 && right > 0 && Math.abs(left - right) <= 1);
    const leap = splashShape(SPLASH.full, false);
    let sum = 0;
    for (let i = 0; i < leap.drops; i++) { dropVelocity(leap, i, 600, rnd, v); assert.ok(v.vy < 0); sum += v.vx; }
    assert.ok(sum / leap.drops > 0, 'carried along with the fish');
});
