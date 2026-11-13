import test from 'node:test';
import assert from 'node:assert/strict';
import { EYES, Gaze } from '../game/rig/eyes.js';

const DT = 1 / 60;
const run = (g, seconds, target, opts) => { for (let i = 0; i < seconds * 60; i++) g.update(DT, typeof target === 'function' ? target(i * DT) : target, opts); return g; };

test('the eye settles on what it looks at', () => {
    const g = run(new Gaze(3), 1, { x: 0.4, y: -0.3 });
    assert.ok(Math.hypot(g.x - 0.4, g.y + 0.3) < 0.05, `at ${g.x},${g.y}`);
});

test('the iris never leaves the eye, however far away the target is', () => {
    const g = new Gaze(5);
    for (let i = 0; i < 600; i++) {
        g.update(DT, { x: Math.cos(i * 0.05) * 40, y: Math.sin(i * 0.07) * 40 });
        assert.ok(Math.hypot(g.x, g.y) <= EYES.reach + 0.03, `iris at ${Math.hypot(g.x, g.y)}`);
    }
});

test('a far change of gaze is a quick jump, not a glide', () => {
    const g = run(new Gaze(7), 1, { x: -0.6, y: 0 });
    g.blink = -1; g.nextBlink = 99;
    run(g, 0.1, { x: 0.6, y: 0 });                    // 6 frames
    assert.ok(g.x > 0.35, `after 0.1 s the eye is at ${g.x}`);
});

test('a slowly moving target is followed closely', () => {
    const g = new Gaze(9);
    let worst = 0;
    for (let i = 0; i < 600; i++) {
        const t = i * DT, target = { x: Math.cos(t * 0.8) * 0.5, y: Math.sin(t * 0.8) * 0.5 };
        g.update(DT, target);
        if (i > 60) worst = Math.max(worst, Math.hypot(g.x - target.x, g.y - target.y));
    }
    assert.ok(worst < 0.3, `largest lag ${worst}`);
});

test('it blinks now and then: closes fully and opens again', () => {
    const g = new Gaze(11);
    let blinks = 0, closed = 0, wasClosed = false;
    for (let i = 0; i < 60 * 30; i++) {
        g.update(DT, { x: 0, y: 0 });
        const shut = g.lid > 0.9;
        if (shut && !wasClosed) blinks++;
        if (shut) closed++;
        wasClosed = shut;
    }
    assert.ok(blinks >= 4 && blinks <= 14, `${blinks} blinks in 30 s`);
    assert.ok(closed / (60 * 30) < 0.05, 'the eye is open nearly all the time');
    assert.ok(Math.abs(g.lid - EYES.restLid) < 0.2 || g.blink >= 0, 'back to the resting lid');
});

test('the same seed gives the same eye, another seed blinks at other times', () => {
    const a = run(new Gaze(42), 8, { x: 0.1, y: 0 }), b = run(new Gaze(42), 8, { x: 0.1, y: 0 }), c = run(new Gaze(43), 8, { x: 0.1, y: 0 });
    assert.equal(a.nextBlink, b.nextBlink);
    assert.notEqual(a.nextBlink, c.nextBlink);
});

test('the pupil widens in the dark and when scared, narrows in bright light', () => {
    const still = { x: 0, y: 0 };
    const normal = run(new Gaze(1), 2, still).pupil;
    assert.ok(run(new Gaze(1), 2, still, { light: 0 }).pupil > normal * 1.2);
    assert.ok(run(new Gaze(1), 2, still, { light: 1 }).pupil < normal * 0.85);
    assert.ok(run(new Gaze(1), 2, still, { scared: 1 }).pupil > normal * 1.3);
});

test('expressions move the resting lid: sleepy droops, scared opens wide', () => {
    const still = { x: 0, y: 0 };
    const lidOf = opts => { const g = new Gaze(1); g.nextBlink = 99; return run(g, 0.5, still, opts).lid; };
    assert.ok(lidOf({ lid: 0.4 }) > lidOf({}) + 0.3);
    assert.ok(lidOf({ scared: 1 }) < lidOf({}));
});

test('two eyes looking at one near point converge', () => {
    // Eyes 2 radii apart, a point close in front between them.
    const left = run(new Gaze(1), 1, { x: 1 - 0, y: 0 }), right = run(new Gaze(2), 1, { x: -1, y: 0 });
    assert.ok(left.x > 0.5 && right.x < -0.5, 'each eye turns inward');
});
