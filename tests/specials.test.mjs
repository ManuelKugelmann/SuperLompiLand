import test from 'node:test';
import assert from 'node:assert/strict';
import { SPECIALS, canUse, chainStep } from '../game/specials.js';
import { CHARACTERS, MOTION, motionOf, glideLift, skim } from '../game/characters.js';

const still = { vx: 0, vy: 0, facing: 1, inAir: false, holding: false, canHold: false };

test('every character resolves to a registered special, and its pose exists', () => {
    for (const c of CHARACTERS) {
        const sp = SPECIALS[c.special];
        assert.ok(sp, `${c.id}: special ${c.special}`);
        const fx = sp.start(still);
        if (fx.pose) assert.ok(c.states[fx.pose], `${c.id}: state for pose ${fx.pose}`);
    }
});

test('no two characters share a special, and no special is left without a character', () => {
    const used = CHARACTERS.map(c => c.special);
    assert.equal(new Set(used).size, used.length, used.join(', '));
    assert.deepEqual(Object.keys(SPECIALS).sort(), [...used].sort());
});

test('every special has the full interface and returns a finite velocity', () => {
    for (const [name, sp] of Object.entries(SPECIALS)) {
        assert.ok(sp.cooldown >= 0 && typeof sp.air === 'boolean' && typeof sp.start === 'function', name);
        assert.ok(sp.label.de && sp.label.en && sp.label.de !== sp.label.en, `${name}: a name in both languages`);
        for (const ctx of [still, { ...still, vx: -6, vy: 3, facing: -1 }, { ...still, vx: 4, vy: -9, inAir: true }, { ...still, holding: true }, { ...still, canHold: true }]) {
            const fx = sp.start(ctx);
            assert.ok(Number.isFinite(fx.vx) && Number.isFinite(fx.vy), `${name}: velocity`);
        }
        const fx = sp.start(still);
        if (fx.pose) assert.ok(fx.poseMs > 0 && sp.endCooldown >= 0, `${name}: pose timing`);
        if (fx.mode) assert.ok(fx.mode.ms > 0 && fx.mode.ms < sp.cooldown, `${name}: the mode ends before the special is ready again`);
    }
});

test('each special has its own look and its own sound; only the puff uses the plain ring', () => {
    const sounds = new Set(), looks = {};
    for (const [name, sp] of Object.entries(SPECIALS)) {
        const fx = sp.start(still);
        assert.ok(fx.sound && !sounds.has(fx.sound), `${name}: sound ${fx.sound}`);
        sounds.add(fx.sound);
        looks[name] = fx.burst ?? 'ring';
    }
    assert.deepEqual(Object.entries(looks).filter(([, l]) => l === 'ring').map(([n]) => n), ['puff']);
    assert.equal(looks.fan, 'spines');
    assert.equal(looks.pulse, 'ripple');
});

test('cooldown blocks a special; only some may start in the air', () => {
    assert.equal(canUse(SPECIALS.sprint, { cooldown: 0, inAir: false }), true);
    assert.equal(canUse(SPECIALS.sprint, { cooldown: 120, inAir: false }), false);
    assert.equal(canUse(SPECIALS.sprint, { cooldown: 0, inAir: true }), false);
    assert.equal(canUse(SPECIALS.leap, { cooldown: 0, inAir: true }), false);
    assert.equal(canUse(SPECIALS.puff, { cooldown: 0, inAir: true }), true);
    assert.equal(canUse(SPECIALS.fan, { cooldown: 0, inAir: true }), true);
    assert.equal(canUse(undefined, { cooldown: 0, inAir: false }), false);
});

test('the puff is an air brake in the water and leaves a flight alone', () => {
    const wet = SPECIALS.puff.start({ ...still, vx: 20, vy: -10 });
    assert.ok(Math.hypot(wet.vx, wet.vy) < 3);
    const dry = SPECIALS.puff.start({ ...still, vx: 20, vy: -10, inAir: true });
    assert.deepEqual([dry.vx, dry.vy], [20, -10]);
    assert.ok(wet.guard > 0 && wet.pose === 'inflated');
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
    assert.deepEqual(chainStep(sp, chain), { count: 0, left: 0, cooldown: sp.chain.rest }, 'the fifth burst ends the chain with a rest');
    const two = chainStep(sp, chainStep(sp, { count: 0, left: 0 }));
    assert.equal(chainStep(sp, { count: two.count, left: 0 }).count, 1, 'letting the window pass starts again at one');
    assert.deepEqual(chainStep(SPECIALS.fan, { count: 3, left: 500 }), { count: 0, left: 0, cooldown: SPECIALS.fan.cooldown });
});

test('every sprint burst adds speed along the nose', () => {
    const fx = SPECIALS.sprint.start({ ...still, vx: 6 });
    assert.ok(fx.vx > 12 && fx.vy === 0);
    assert.ok(SPECIALS.sprint.start({ ...still, facing: -1 }).vx < -7);
});

test('leap and pulse always go up; the leap is flat: more forward than up', () => {
    for (const name of ['leap', 'pulse']) {
        assert.ok(SPECIALS[name].start({ ...still, vx: 3, vy: 8 }).vy < -6, name);
    }
    const leap = SPECIALS.leap.start(still);
    assert.ok(leap.vx > -leap.vy, `forward ${leap.vx}, up ${-leap.vy}`);
});

test('the fan is a parachute: it slows down, protects, pushes others away and catches the current', () => {
    const fx = SPECIALS.fan.start({ ...still, vx: 14, vy: 4 });
    assert.ok(Math.hypot(fx.vx, fx.vy) < Math.hypot(14, 4) * 0.6);
    assert.ok(fx.shield > 0 && fx.shove && fx.mode.drag > 2 && fx.mode.flow > 1);
});

test('the shell is a heavy bouncy stone: it keeps its speed, sinks, bounces and protects', () => {
    const fx = SPECIALS.shell.start({ ...still, vx: 9, vy: -2 });
    assert.deepEqual([fx.vx, fx.vy], [9, -2]);
    assert.ok(fx.shield >= fx.mode.ms && fx.mode.sink > 1 && fx.mode.drag < 1 && fx.mode.bounce > 0.8 && fx.mode.tuck > 0);
});

test('the anchor holds on when rock is in reach, lets go with a hop, and is a hop when there is nothing to hold', () => {
    const grab = SPECIALS.anchor.start({ ...still, vx: 7, vy: 2, canHold: true });
    assert.ok(grab.hold && grab.vx === 0 && grab.vy === 0);
    const letGo = SPECIALS.anchor.start({ ...still, facing: -1, holding: true, canHold: true });
    assert.ok(letGo.release && letGo.vx < 0 && letGo.vy < 0 && !letGo.hold);
    const free = SPECIALS.anchor.start({ ...still, vx: 2 });
    assert.ok(!free.hold && !free.release && free.vx > 2);
    assert.ok(SPECIALS.anchor.reach > 100);
});

test('wings carry a fast glider and do nothing for anyone else', () => {
    const flyer = CHARACTERS.find(c => c.id === 'flyingfish'), lompi = CHARACTERS[0];
    assert.equal(glideLift(lompi, 20), 0);
    assert.equal(glideLift(flyer, 0), 0);
    assert.ok(glideLift(flyer, 4) > 0 && glideLift(flyer, 4) < glideLift(flyer, 9));
    assert.equal(glideLift(flyer, 30), flyer.glide.lift);
    assert.ok(flyer.glide.lift < 1, 'it still comes down in the end');
});

test('a glider skips off wave tops: only on the way down, close to the water, fast, and a few times', () => {
    const flyer = CHARACTERS.find(c => c.id === 'flyingfish');
    const down = { vx: 12, vy: 3, height: 10, skips: 0 };
    const hop = skim(flyer, down);
    assert.ok(hop && hop.vy < 0 && hop.vx > 12, JSON.stringify(hop));
    assert.equal(skim(flyer, { ...down, vy: -2 }), null, 'not while rising');
    assert.equal(skim(flyer, { ...down, height: 200 }), null, 'not high up');
    assert.equal(skim(flyer, { ...down, vx: 2 }), null, 'not when slow');
    assert.equal(skim(flyer, { ...down, skips: flyer.glide.skips }), null, 'not for ever');
    assert.equal(skim(CHARACTERS[0], down), null, 'Lompi has no wings');
});

test('motion numbers per character match the physics rules', () => {
    const lompi = CHARACTERS[0], m = motionOf(lompi), puffed = motionOf(lompi, 'inflated');
    assert.ok(Math.abs(m.keepWater - (1 - 0.03 * MOTION.waterDrag)) < 1e-9, `Lompi keeps ${m.keepWater}`);
    assert.ok(puffed.keepWater < m.keepWater, 'the puffed ball is slowed more');
    assert.ok(Math.abs(m.keepAir - 0.9985) < 1e-9);
    assert.ok(m.gravityAir > m.gravityWater * 5, 'air pulls down much harder than water');
    const jelly = CHARACTERS.find(c => c.id === 'jellyfish'), flyer = CHARACTERS.find(c => c.id === 'flyingfish');
    assert.ok(motionOf(jelly).gravityWater < m.gravityWater, 'light swimmers sink less');
    assert.ok(motionOf(flyer).gravityAir < m.gravityAir, 'the flying fish glides');
    assert.equal(motionOf(lompi, 'no such state').keepWater, m.keepWater);
});
