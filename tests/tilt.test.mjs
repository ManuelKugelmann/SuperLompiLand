import test from 'node:test';
import assert from 'node:assert/strict';
import { TILT, gravityFromAngles, gravityFromMotion, screenAxes, tiltDir } from '../game/controls/tilt.js';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

test('gravity in the device’s axes: flat it points into the back, a lowered edge pulls toward that edge', () => {
    const flat = gravityFromAngles(0, 0);
    assert.ok(near(flat.x, 0) && near(flat.y, 0) && near(flat.z, -1));
    assert.ok(gravityFromAngles(0, 20).x > 0.3, 'right edge down: toward the right');
    assert.ok(gravityFromAngles(20, 0).y < -0.3, 'top edge up: toward the bottom edge');
    const upright = gravityFromAngles(90, 0);
    assert.ok(near(upright.y, -1) && near(upright.z, 0, 1e-9), 'held upright: straight toward the bottom edge');
    for (const [b, g] of [[10, 30], [-70, 15], [120, -40]]) { const v = gravityFromAngles(b, g); assert.ok(near(Math.hypot(v.x, v.y, v.z), 1), 'a unit vector'); }
    // The same pose from the motion sensor: Android reports the opposite sign of iOS.
    const m = gravityFromMotion(0, 0, 9.81, false), i = gravityFromMotion(0, 0, -9.81, true);
    assert.ok(near(m.z, -1) && near(i.z, -1));
});

test('the screen’s right and down in the device’s axes, for every way the page and the game can be turned', () => {
    assert.deepEqual(screenAxes(0), { right: { x: 1, y: 0 }, down: { x: 0, y: -1 } }, 'portrait: right is the device’s right, down its bottom edge');
    assert.deepEqual(screenAxes(90), { right: { x: 0, y: -1 }, down: { x: -1, y: 0 } });
    assert.deepEqual(screenAxes(270), { right: { x: 0, y: 1 }, down: { x: 1, y: 0 } });
    assert.deepEqual(screenAxes(-90), screenAxes(270));
    assert.deepEqual(screenAxes(180), { right: { x: -1, y: 0 }, down: { x: 0, y: 1 } });
    // A portrait page showing the landscape game sideways: the game's right is the page's down.
    assert.deepEqual(screenAxes(0, true), { right: { x: 0, y: -1 }, down: { x: -1, y: 0 } });
    for (const a of [0, 90, 180, 270]) for (const rot of [false, true]) {
        const { right, down } = screenAxes(a, rot);
        assert.ok(near(right.x * down.x + right.y * down.y, 0) && near(Math.hypot(right.x, right.y), 1) && near(Math.hypot(down.x, down.y), 1), 'at right angles, unit length');
        assert.ok(near(right.x * down.y - right.y * down.x, -1), 'never mirrored: down is a quarter turn clockwise from right on the screen');
    }
});

test('a flat phone: the fish goes toward the edge that is lowered, in every screen orientation', () => {
    const g0 = gravityFromAngles(0, 0);
    // Portrait page: right edge down = gamma up; bottom edge down = beta up.
    let d = tiltDir(gravityFromAngles(0, TILT.fullDeg), g0, screenAxes(0));
    assert.ok(near(d.x, 1, 1e-6) && near(d.y, 0, 1e-6), 'right edge down: full right');
    d = tiltDir(gravityFromAngles(TILT.fullDeg, 0), g0, screenAxes(0));
    assert.ok(near(d.x, 0, 1e-6) && near(d.y, 1, 1e-6), 'bottom edge down: full down');
    // Landscape page (angle 90): the screen's right edge is the device's bottom edge.
    d = tiltDir(gravityFromAngles(TILT.fullDeg, 0), g0, screenAxes(90));
    assert.ok(d.x > 0.99 && Math.abs(d.y) < 1e-6, 'device bottom edge down = screen right edge down: right');
    d = tiltDir(gravityFromAngles(0, -TILT.fullDeg), g0, screenAxes(90));
    assert.ok(d.y > 0.99 && Math.abs(d.x) < 1e-6, 'device left edge down = screen bottom edge down: down');
    // The other landscape (angle 270) is the mirror of that.
    d = tiltDir(gravityFromAngles(TILT.fullDeg, 0), g0, screenAxes(270));
    assert.ok(d.x < -0.99);
    // A portrait page with the game drawn sideways steers like the landscape page.
    d = tiltDir(gravityFromAngles(TILT.fullDeg, 0), g0, screenAxes(0, true));
    assert.ok(d.x > 0.99, 'game turned on a portrait page: device bottom edge down is the game’s right');
});

test('measured from the neutral pose, with a dead zone, never more than full', () => {
    const g0 = gravityFromAngles(35, 5), axes = screenAxes(0);
    assert.deepEqual({ ...tiltDir(g0, g0, axes) }, { x: 0, y: 0 }, 'as it was held: nothing');
    assert.deepEqual({ ...tiltDir(gravityFromAngles(36, 5), g0, axes) }, { x: 0, y: 0 }, 'a degree: inside the dead zone');
    const far = tiltDir(gravityFromAngles(35, 60), g0, axes);
    assert.ok(Math.hypot(far.x, far.y) <= 1 + 1e-9 && far.x > 0.9);
    const half = tiltDir(gravityFromAngles(35, 5 + TILT.fullDeg / 2), g0, axes);
    assert.ok(half.x > 0.2 && half.x < 0.8);
});

test('a phone held upright in landscape steers too: rolling it like a wheel is left and right, tipping its top is up and down', () => {
    // Upright in landscape (angle 90): the device's left edge points down, so gravity lies along -x.
    const g0 = gravityFromAngles(0, -90), axes = screenAxes(90);
    assert.ok(near(g0.x, -1));
    const wheel = tiltDir(gravityFromAngles(15, -90), g0, axes);
    assert.ok(Math.abs(wheel.x) > 0.5 && Math.abs(wheel.y) < 0.2, `rolled like a wheel: sideways (${wheel.x.toFixed(2)}, ${wheel.y.toFixed(2)})`);
    const tip = tiltDir(gravityFromAngles(0, -70), g0, axes), back = tiltDir(gravityFromAngles(180, -70), g0, axes);
    assert.ok(Math.abs(tip.y) > 0.5 && Math.abs(tip.x) < 0.2, `top tipped: up or down (${tip.x.toFixed(2)}, ${tip.y.toFixed(2)})`);
    assert.ok(Math.sign(tip.y) === -Math.sign(back.y), 'tipping the other way steers the other way');
    for (const d of [wheel, tip, back]) assert.ok(Number.isFinite(d.x) && Number.isFinite(d.y));
});
