import test from 'node:test';
import assert from 'node:assert/strict';
import { SPECIALS, canUse, chainStep } from '../game/specials.js';
import { motionOf } from '../game/characters.js';
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

test('the sprint chains: up to five bursts in a row, then a rest', () => {
    const sp = SPECIALS.sprint;
    let chain = { count: 0, left: 0 };
    for (let tap = 1; tap <= 4; tap++) {
        const step = chainStep(sp, chain);
        assert.equal(step.count, tap);
        assert.equal(step.cooldown, sp.cooldown, 'a short pause between bursts');
        assert.equal(step.left, sp.chain.window);
        chain = step;
    }
    const fifth = chainStep(sp, chain);
    assert.deepEqual(fifth, { count: 0, left: 0, cooldown: sp.chain.rest }, 'the fifth burst ends the chain with a rest');
});

test('letting the window pass starts the chain again at one', () => {
    const sp = SPECIALS.sprint;
    const two = chainStep(sp, chainStep(sp, { count: 0, left: 0 }));
    assert.equal(two.count, 2);
    assert.equal(chainStep(sp, { count: two.count, left: 0 }).count, 1);
});

test('specials without a chain just use their cooldown', () => {
    assert.deepEqual(chainStep(SPECIALS.shield, { count: 3, left: 500 }), { count: 0, left: 0, cooldown: SPECIALS.shield.cooldown });
});

test('every sprint burst adds speed along the nose and draws no ring', () => {
    const fx = SPECIALS.sprint.start({ vx: 6, vy: 0, facing: 1, inAir: false });
    assert.ok(fx.vx > 12 && fx.vy === 0 && fx.ring === 0);
    const back = SPECIALS.sprint.start({ vx: 0, vy: 0, facing: -1, inAir: false });
    assert.ok(back.vx < -7);
});

test('motion numbers per character match the physics rules', () => {
    const lompi = CHARACTERS[0], m = motionOf(lompi), puffed = motionOf(lompi, 'inflated');
    assert.ok(Math.abs(m.keepWater - 0.982) < 1e-9, `Lompi keeps ${m.keepWater}`);
    assert.ok(puffed.keepWater < m.keepWater, 'the puffed ball is slowed more');
    assert.ok(Math.abs(m.keepAir - 0.9985) < 1e-9);
    assert.ok(m.gravityAir > m.gravityWater * 5, 'air pulls down much harder than water');
    const jelly = CHARACTERS.find(c => c.id === 'jellyfish'), flyer = CHARACTERS.find(c => c.id === 'flyingfish');
    assert.ok(motionOf(jelly).gravityWater < m.gravityWater, 'light swimmers sink less');
    assert.ok(motionOf(flyer).gravityAir < m.gravityAir, 'the flying fish glides');
    assert.equal(motionOf(lompi, 'no such state').keepWater, m.keepWater);
});
