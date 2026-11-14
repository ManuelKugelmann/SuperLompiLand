import test from 'node:test';
import assert from 'node:assert/strict';
import { GHOST, DEMOS, cycleS, fingerAt, shouldShow } from '../game/ui/ghostDemo.js';

const taps = (scheme, from, to) => {
    let n = 0, was = false;
    for (let s = from; s < to; s += 0.01) { const d = fingerAt(s, scheme).down; if (d && !was) n++; was = d; }
    return n;
};

test('tap: in, press, hold and drag with a band from the fish, let go, double tap, out', () => {
    const at = s => fingerAt(s, 'tap');
    assert.ok(at(0).alpha < 0.1, 'fades in');
    assert.equal(at(0.6).down, true);
    assert.ok(at(0.6).ring >= 0, 'a ring marks the press');
    const drag = at(1.5);
    assert.equal(drag.band, 1);
    assert.deepEqual(drag.bandFrom, [0, 0], 'band from the fish');
    assert.equal(at(2.2).down, false, 'let go');
    assert.ok(at(2.2).band < 1 && at(2.2).band > 0, 'band snaps back');
    assert.equal(taps('tap', 2.9, 3.6), 2, 'double tap');
    assert.ok(at(cycleS('tap') - 0.05).alpha < 0.2, 'fades out');
});

test('every scheme has a script that teaches its own moves', () => {
    for (const id of ['tap', 'flap', 'tilt', 'stick']) assert.ok(DEMOS[id] && cycleS(id) > 2, id);
    assert.ok(taps('flap', 0.5, 1.9) >= 4, 'flap: quick taps');
    let grew = false;
    for (let s = 0; s < cycleS('flap'); s += 0.05) { const f = fingerAt(s, 'flap'); if (f.down && f.ring > 0.8) grew = true; }
    assert.ok(grew, 'flap: a long press with a growing ring');
    const stick = fingerAt(1.4, 'stick');
    assert.equal(stick.band, 1, 'stick: a band from the press point while dragging');
    assert.equal(taps('stick', 2.9, 3.4), 1, 'stick: one quick tap = special');
    let rocked = 0;
    for (let s = 0.5; s < 2.1; s += 0.05) rocked = Math.max(rocked, Math.abs(fingerAt(s, 'tilt').rot));
    assert.ok(rocked > 0.3, 'tilt: the hand rocks');
});

test('it plays a few cycles on the first starts only, then is done', () => {
    assert.equal(fingerAt(cycleS('tap') * GHOST.cycles + 0.1).done, true);
    assert.equal(fingerAt(cycleS('tap') + 1.5).band, 1, 'second cycle repeats');
    assert.equal(fingerAt(0, 'nonsense').done, false, 'unknown scheme falls back to tap');
    assert.equal(shouldShow(0), true);
    assert.equal(shouldShow(GHOST.runs), false);
});
