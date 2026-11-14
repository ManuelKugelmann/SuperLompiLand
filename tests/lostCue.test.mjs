import test from 'node:test';
import assert from 'node:assert/strict';
import { LOST, createLostCue, nextGoal } from '../game/lostCue.js';

const run = (cue, s, vx, speed, dx) => { let a = 0; for (let t = 0; t < s; t += 0.1) a = cue.step(0.1, vx, speed, dx); return a; };

test('the next goal is the nearest friend or nest ahead; none when everything lies behind', () => {
    assert.equal(nextGoal(1000, [500, 7600, 15960, 3000]), 3000);
    assert.equal(nextGoal(20000, [500, 7600, 15960]), null);
});

test('standing still for ten seconds brings the cue, not sooner; swimming on never does', () => {
    const cue = createLostCue();
    assert.equal(run(cue, LOST.idleS - 1, 0, 0.2, 5000), 0);
    assert.ok(run(cue, 2.5, 0, 0.2, 5000) > 0.9, 'it has faded in');
    const busy = createLostCue();
    assert.equal(run(busy, 60, 6, 6, 5000), 0, 'swimming east: never');
});

test('swimming west for eight seconds brings it; a short look back does not', () => {
    const cue = createLostCue();
    assert.equal(run(cue, LOST.westS - 1, -5, 5, 5000), 0);
    assert.ok(run(cue, 2.5, -5, 5, 5000) > 0.9);
    const peek = createLostCue();
    run(peek, 4, -5, 5, 5000); run(peek, 1, 5, 5, 5000);
    assert.equal(run(peek, 5, -5, 5, 5000), 0, 'the count starts again');
});

test('it fades once the fish heads for the goal, and is not shown with the goal on screen or with no goal', () => {
    const cue = createLostCue();
    run(cue, LOST.idleS + 2, 0, 0, 5000);
    assert.ok(cue.on);
    run(cue, LOST.headS + 0.2, 5, 5, 5000);
    assert.ok(!cue.on, 'heading for it');
    assert.equal(run(cue, 2, 5, 5, 5000), 0, 'faded out');
    const near = createLostCue();
    assert.equal(run(near, 30, 0, 0, LOST.near - 100), 0, 'the goal is on screen');
    assert.equal(run(createLostCue(), 30, 0, 0, null), 0, 'nothing ahead');
    // West of the goal's far side it points back: a goal behind (negative dx) counts when heading west.
    const back = createLostCue();
    run(back, LOST.idleS + 2, 0, 0, -5000);
    run(back, LOST.headS + 0.2, -5, 5, -5000);
    assert.ok(!back.on);
});
