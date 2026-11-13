import test from 'node:test';
import assert from 'node:assert/strict';
import { FLIGHT, fly, grip } from '../game/flight.js';

const G = 0.34;
const speedOf = o => Math.hypot(o.vx, o.vy);

/** Fly `steps` steps with a fixed input; returns the path's end state. */
function flight(vx, vy, input, steps, extra = {}) {
    let x = 0, y = 0;
    for (let i = 0; i < steps; i++) {
        const o = fly({ vx, vy, ix: input.x, iy: input.y, gravity: G, ...extra });
        vx = o.vx + o.ax; vy = o.vy + o.ay + G;
        x += vx; y += vy;
    }
    return { x, y, vx, vy };
}

test('wings work fully when fast and not at all when stalled', () => {
    assert.equal(grip(FLIGHT.stall), 0);
    assert.equal(grip(FLIGHT.speed), 1);
    assert.equal(grip(100), 1);
    assert.ok(grip((FLIGHT.stall + FLIGHT.speed) / 2) > 0.4);
    const o = fly({ vx: 2, vy: 0, ix: 0, iy: -1, gravity: G });
    assert.deepEqual([o.vx, o.vy, o.ax, o.ay], [2, 0, 0, 0], 'a stalled flyer just falls');
});

test('steering turns the heading and never adds speed', () => {
    for (const [ix, iy] of [[0, -1], [0, 1], [-1, 0], [1, 0], [0.7, -0.7]]) {
        const o = fly({ vx: 14, vy: 0, ix, iy, gravity: G });
        assert.ok(speedOf(o) <= 14 + 1e-9, `input ${ix},${iy}`);
    }
    const up = fly({ vx: 14, vy: 0, ix: 0, iy: -1, gravity: G });
    assert.ok(up.vy < 0 && Math.abs(Math.atan2(up.vy, up.vx)) <= FLIGHT.turn + 1e-9);
    const same = fly({ vx: 14, vy: 0, ix: 1, iy: 0, gravity: G });
    assert.ok(Math.abs(speedOf(same) - 14) < 1e-9, 'holding the heading costs nothing');
});

test('in fast level flight the wings carry their share of the weight, straight up', () => {
    const o = fly({ vx: 14, vy: 0, gravity: G });
    assert.ok(Math.abs(o.ax) < 1e-9 && Math.abs(o.ay + G * FLIGHT.lift) < 1e-9);
    const strong = fly({ vx: 14, vy: 0, gravity: G, lift: 0.85 });
    assert.ok(strong.ay < o.ay);
    const mirrored = fly({ vx: -14, vy: 0, gravity: G });
    assert.ok(Math.abs(mirrored.ay - o.ay) < 1e-9, 'the same flying left');
});

test('lift acts across the path only: none in a straight dive or climb', () => {
    for (const vy of [14, -14]) {
        const o = fly({ vx: 0, vy, gravity: G });
        assert.ok(Math.hypot(o.ax, o.ay) < 1e-9);
    }
    const o = fly({ vx: 10, vy: 10, gravity: G });
    assert.ok(Math.abs(o.ax * 10 + o.ay * 10) < 1e-9, 'never along the path');
});

test('a dive gains speed, a climb spends it', () => {
    const dive = flight(12, 0, { x: 0.5, y: 1 }, 40);
    assert.ok(Math.hypot(dive.vx, dive.vy) > 16, `dive ${Math.hypot(dive.vx, dive.vy)}`);
    const climb = flight(12, 0, { x: 0.5, y: -1 }, 40);
    assert.ok(Math.hypot(climb.vx, climb.vy) < 9, `climb ${Math.hypot(climb.vx, climb.vy)}`);
    assert.ok(climb.y < 0 && dive.y > 0);
});

test('a glide carries much further than a throw, and still comes down', () => {
    const drop = steps => { let vy = 0, y = 0; for (let i = 0; i < steps; i++) { vy += G; y += vy; } return y; };
    const glide = flight(14, 0, { x: 0, y: 0 }, 60);
    assert.ok(glide.y > 0, 'it sinks');
    assert.ok(glide.y < drop(60) * 0.6, `glide ${glide.y} vs fall ${drop(60)}`);
});

test('an agile character turns faster; tight turns cost speed', () => {
    const slow = fly({ vx: 14, vy: 0, ix: 0, iy: -1, gravity: G });
    const quick = fly({ vx: 14, vy: 0, ix: 0, iy: -1, gravity: G, agility: 2.4 });
    assert.ok(Math.atan2(-quick.vy, quick.vx) > Math.atan2(-slow.vy, slow.vx) * 2);
    assert.ok(speedOf(quick) < speedOf(slow) && speedOf(slow) < 14);
});
