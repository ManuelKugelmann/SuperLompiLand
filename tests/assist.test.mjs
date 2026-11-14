import test from 'node:test';
import assert from 'node:assert/strict';
import { ASSIST, slideDir, climbForce, holdLift, restDepth, steersDown, levelThrust, easing, easeRest, easingDown, easeRestDown } from '../game/controls/assist.js';

// A seabed step: rock below y 1000 west of x 500, and below y 800 east of it (a 200 px step up).
const step = (x, y) => y < (x < 500 ? 1000 : 800);
const east = { x: 1, y: 0 };

test('open water ahead: the pull stays exactly where the player points', () => {
    const d = slideDir({ x: 100, y: 900 }, east, step);
    assert.deepEqual({ x: d.x, y: d.y, climbing: d.climbing }, { x: 1, y: 0, climbing: false });
});

test('a step in the way is climbed: the pull turns up along its face, still a little forward', () => {
    const d = slideDir({ x: 400, y: 950 }, east, step);
    assert.ok(d.climbing);
    assert.ok(d.y < -0.8 && d.x > 0, `up and on: ${d.x.toFixed(2)}, ${d.y.toFixed(2)}`);
    assert.ok(Math.abs(Math.hypot(d.x, d.y) - 1) < 1e-9, 'still a unit pull');
    const w = slideDir({ x: 600, y: 950 }, { x: -1, y: 0 }, (x, y) => y < (x > 500 ? 1000 : 800));
    assert.ok(w.climbing && w.x < 0, 'the same going west');
});

test('following the pull, the fish gets over the step that held it', () => {
    const p = { x: 300, y: 960 };
    for (let i = 0; i < 400 && p.x < 700; i++) {
        const d = slideDir(p, east, step), nx = p.x + d.x * 6, ny = p.y + d.y * 6;
        if (step(nx, ny)) { p.x = nx; p.y = ny; }      // it can only move through open water
    }
    assert.ok(p.x >= 700, `stuck at ${Math.round(p.x)}, ${Math.round(p.y)}`);
    assert.ok(p.y < 800, 'it is up on the step');
});

test('a real wall is not climbed, and a pull straight up or down is left alone', () => {
    const wall = (x, y) => x < 500;
    assert.equal(slideDir({ x: 400, y: 900 }, east, wall).climbing, false);
    assert.equal(slideDir({ x: 400, y: 950 }, { x: 0.1, y: 0.995 }, step).climbing, false);
});

test('let go, and the fish is held where it was: nothing within the slack, then a gentle lift, never more than its full strength', () => {
    const H = ASSIST.hold;
    assert.equal(holdLift(1000, 1000), 0);
    assert.equal(holdLift(1000 + H.slack, 1000), 0);
    assert.equal(holdLift(900, 1000), 0, 'above where it was let go: left alone');
    const half = holdLift(1000 + H.slack + H.full / 2, 1000);
    assert.ok(Math.abs(half - H.lift / 2) < 1e-9);
    assert.equal(holdLift(3000, 1000), H.lift);
    assert.ok(H.lift < 1, 'gentler than a full stroke');
});

test('nothing is climbed right under the surface: the help never throws the fish out of the water', () => {
    const shallow = (x, y) => y < (x < 500 ? 400 : 200);      // a step whose top lies 200 px under the surface
    assert.equal(slideDir({ x: 400, y: 350 }, east, shallow).climbing, false);
    assert.ok(ASSIST.slide.surface > 100);
});

test('a climb is a steady pull, not a launch: a fish that already rises fast gets no more lift', () => {
    const S = ASSIST.slide;
    assert.equal(climbForce(0), S.force);
    assert.equal(climbForce(3), S.force, 'sinking: full climbing pull');
    assert.equal(climbForce(-S.maxRise), 0);
    assert.equal(climbForce(-12), 0);
    assert.ok(S.force < 1);
});

test('tap after tap does not ratchet the fish down: the shallower depth is held, unless the player dived on purpose', () => {
    assert.equal(restDepth(800, null, false), 800, 'the first release');
    assert.equal(restDepth(860, 800, false), 800, 'it sagged: still the old depth');
    assert.equal(restDepth(1400, 800, false), 800, 'however far it sagged while the taps were level');
    assert.equal(restDepth(1400, 800, true), 1400, 'the player dived: the new depth');
    assert.equal(restDepth(700, 800, false), 700, 'it was taken up: the new depth');
    let rest = null, y = 800;
    for (let i = 0; i < 40; i++) { rest = restDepth(y, rest, false); y = rest + 40; }      // forty level taps, sagging 40 px after each
    assert.equal(rest, 800);
    assert.ok(steersDown(1000 + ASSIST.hold.dive + 1, 1000) && !steersDown(1000 + ASSIST.hold.dive - 1, 1000) && !steersDown(900, 1000));
});

test('a sideways pull damps speed up or down the player did not ask for; a pull up or down is left alone', () => {
    const L = ASSIST.level;
    assert.ok(levelThrust(0, -8) > 0, 'rising after a slope: pushed down');
    assert.ok(levelThrust(0, 6) < 0, 'sinking: pushed up');
    assert.equal(levelThrust(0, 0), 0);
    assert.equal(levelThrust(-0.7, -8), 0, 'the player steers up: nothing');
    assert.equal(levelThrust(-0.2, -8), 0, 'a little up, and it goes up: that is what was asked');
    assert.ok(levelThrust(-0.2, 8) < 0, 'a little up, but it sinks: helped');
    assert.equal(levelThrust(0, -100), L.max, 'never more than its cap');
});

test('a depth the player did not choose, far below the lane, is eased back to the lane edge; a dive is kept', () => {
    const A = ASSIST.lane, laneBottom = 1085;
    assert.equal(easing(1800, laneBottom, true, false), false, 'chosen by a dive: kept');
    assert.equal(easing(1800, laneBottom, true, true), false, 'a dive ends an easing');
    assert.equal(easing(laneBottom + A.below - 50, laneBottom, false, false), false, 'near the lane anyway: left alone');
    assert.equal(easing(null, laneBottom, false, true), false);
    assert.equal(easeRest(1800, laneBottom, 1), 1800 - A.rise, 'one second: up by the rise');
    let rest = 1800, on = false;
    for (let i = 0; i < 60 * 60; i++) {
        on = easing(rest, laneBottom, false, on);
        if (on) rest = easeRest(rest, laneBottom, 1 / 60);
    }
    assert.equal(rest, laneBottom + A.stop, 'once started it goes on to the lane edge, not only back within the start distance');
    assert.equal(on, false, 'and then it is over');
});

test('the mirror: a depth far above the lane that the player did not choose sinks gently to the upper edge of the lane', () => {
    const A = ASSIST.lane, laneTop = 900;
    assert.equal(easingDown(200, laneTop, true, false), false, 'chosen by steering up: kept');
    assert.equal(easingDown(laneTop - A.above + 50, laneTop, false, false), false, 'near the lane anyway: left alone');
    assert.equal(easingDown(null, laneTop, false, true), false);
    assert.equal(easeRestDown(200, laneTop, 1), 200 + A.sink);
    let rest = 150, on = false;
    for (let i = 0; i < 60 * 60; i++) { on = easingDown(rest, laneTop, false, on); if (on) rest = easeRestDown(rest, laneTop, 1 / 60); }
    assert.equal(rest, laneTop - A.stop, 'once started it goes on to the lane edge');
    assert.equal(on, false);
});
