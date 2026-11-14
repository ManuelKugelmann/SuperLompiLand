import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BAITBALL, baitBalls, ballCentre, fishAt, hiddenIn, plungeAt, plungeCoins } from '../game/level/baitballs.js';
import { BIOMES } from '../game/level/biomes.js';
import { busyStretches } from '../game/level/openSea.js';
import { bloomFields } from '../game/level/blooms.js';

test('bait balls lie in the open blue, clear of everything else in the sea', () => {
    const balls = baitBalls();
    assert.ok(balls.length >= 1);
    const taken = [...busyStretches(), ...bloomFields().map(f => [f.x0, f.x1])];
    for (const b of balls) {
        const sea = BIOMES.find(bi => bi.id === 'blue');
        assert.ok(b.x > sea.from && b.x < sea.from + sea.width, `${b.x}`);
        for (const [a, z] of taken) assert.ok(b.x < a - BAITBALL.radius || b.x > z + BAITBALL.radius, `${b.id} ${a} ${z}`);
    }
});

test('the fish swirl inside the ball and one way round', () => {
    const o = {};
    for (let i = 0; i < BAITBALL.count; i++) {
        for (const t of [0, 3.3, 17]) {
            fishAt(i, t, o);
            assert.ok(Math.hypot(o.x, o.y / BAITBALL.squash) <= BAITBALL.radius * 1.07);
            if (o.y < -BAITBALL.radius * 0.3) assert.equal(o.dir, 1);
            if (o.y > BAITBALL.radius * 0.3) assert.equal(o.dir, -1);
        }
    }
});

test('Lompi is hidden in the middle, not at the rim', () => {
    assert.ok(hiddenIn(0, 0));
    assert.ok(!hiddenIn(BAITBALL.radius, 0));
});

test('a plunge falls from the sky into the ball and leaves its coins between surface and ball', () => {
    const p = plungeAt(BAITBALL.plunge.every * 2 + 0.1);
    assert.equal(p.n, 2);
    assert.ok(p.u > 0 && p.u < 1);
    assert.ok(Math.abs(p.dx) <= BAITBALL.radius * BAITBALL.plunge.reach);
    const coins = plungeCoins(p, -400);
    assert.equal(coins.length, BAITBALL.plunge.coins);
    for (const c of coins) assert.ok(c.y > -400 && c.y < -BAITBALL.radius * BAITBALL.squash + 1);
    const c = ballCentre(baitBalls()[0], 5, () => 470);
    assert.ok(Math.abs(c.y - 470 - BAITBALL.below) <= BAITBALL.drift * 0.3 + 1);
});
