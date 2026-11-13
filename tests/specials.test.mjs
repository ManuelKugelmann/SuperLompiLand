import test from 'node:test';
import assert from 'node:assert/strict';
import { SPECIALS, canUse } from '../game/specials.js';
import { CHARACTERS } from '../game/characters.js';

const still = { vx: 0, vy: 0, facing: 1, inAir: false };

test('every character resolves to a registered special, and its pose exists', () => {
    for (const c of CHARACTERS) {
        const sp = SPECIALS[c.special];
        assert.ok(sp, `${c.id}: special ${c.special}`);
        const fx = sp.start(still);
        if (fx.pose) assert.ok(c.states[fx.pose], `${c.id}: state for pose ${fx.pose}`);
    }
});

test('every special has the full interface and returns a finite velocity', () => {
    for (const [name, sp] of Object.entries(SPECIALS)) {
        assert.ok(sp.cooldown >= 0 && typeof sp.air === 'boolean' && typeof sp.start === 'function', name);
        for (const ctx of [still, { vx: -6, vy: 3, facing: -1, inAir: false }, { vx: 4, vy: -9, facing: 1, inAir: true }]) {
            const fx = sp.start(ctx);
            assert.ok(Number.isFinite(fx.vx) && Number.isFinite(fx.vy), `${name}: velocity`);
        }
        if (sp.start(still).pose) assert.ok(sp.start(still).poseMs > 0 && sp.endCooldown >= 0, `${name}: pose timing`);
    }
});

test('cooldown blocks a special; only some may start in the air', () => {
    assert.equal(canUse(SPECIALS.dash, { cooldown: 0, inAir: false }), true);
    assert.equal(canUse(SPECIALS.dash, { cooldown: 120, inAir: false }), false);
    assert.equal(canUse(SPECIALS.dash, { cooldown: 0, inAir: true }), false);
    assert.equal(canUse(SPECIALS.leap, { cooldown: 0, inAir: true }), false);
    assert.equal(canUse(SPECIALS.puff, { cooldown: 0, inAir: true }), true);
    assert.equal(canUse(SPECIALS.shield, { cooldown: 0, inAir: true }), true);
    assert.equal(canUse(undefined, { cooldown: 0, inAir: false }), false);
});

test('the puff is an air brake in the water and leaves a flight alone', () => {
    const wet = SPECIALS.puff.start({ vx: 20, vy: -10, facing: 1, inAir: false });
    assert.ok(Math.hypot(wet.vx, wet.vy) < 3);
    const dry = SPECIALS.puff.start({ vx: 20, vy: -10, facing: 1, inAir: true });
    assert.deepEqual([dry.vx, dry.vy], [20, -10]);
    assert.ok(wet.guard > 0 && wet.pose === 'inflated');
});

test('dash goes where the character is heading, or where it faces when resting', () => {
    const left = SPECIALS.dash.start({ vx: 0, vy: 0, facing: -1, inAir: false });
    assert.ok(left.vx < -10 && left.vy === 0);
    const down = SPECIALS.dash.start({ vx: 0, vy: 5, facing: 1, inAir: false });
    assert.ok(down.vy > 15 && Math.abs(down.vx) < 1e-9);
});

test('leap and pulse always go up', () => {
    for (const name of ['leap', 'pulse']) {
        assert.ok(SPECIALS[name].start({ vx: 3, vy: 8, facing: 1, inAir: false }).vy < -10, name);
    }
});
