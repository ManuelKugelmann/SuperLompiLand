import test from 'node:test';
import assert from 'node:assert/strict';
import { GHOST, fingerAt, shouldShow } from '../game/ui/ghostDemo.js';

test('one cycle: in, press, hold and drag with the band, let go, double tap, out', () => {
    const at = s => fingerAt(s);
    assert.ok(at(0).alpha < 0.1, 'fades in');
    assert.equal(at(0.6).down, true);
    assert.ok(at(0.6).ring >= 0, 'a ring marks the press');
    const drag = at(1.5);
    assert.equal(drag.band, 1);
    assert.ok(drag.x > GHOST.hold[0], 'drags away from the fish');
    assert.equal(at(2.2).down, false, 'let go');
    assert.ok(at(2.2).band < 1 && at(2.2).band > 0, 'band snaps back');
    let taps = 0, was = false;
    for (let s = 2.9; s < 3.6; s += 0.01) { const d = at(s).down; if (d && !was) taps++; was = d; }
    assert.equal(taps, 2, 'double tap');
    assert.ok(at(4.1).alpha < 0.3, 'fades out');
});

test('it plays a few cycles on the first starts only, then is done', () => {
    assert.equal(fingerAt(GHOST.cycleS * GHOST.cycles + 0.1).done, true);
    assert.equal(fingerAt(GHOST.cycleS + 1.5).band, 1, 'second cycle repeats');
    assert.equal(shouldShow(0), true);
    assert.equal(shouldShow(undefined), true);
    assert.equal(shouldShow(GHOST.runs), false);
});
