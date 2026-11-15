import test from 'node:test';
import assert from 'node:assert/strict';
import { LONGLINE, longlineSpan, lineY, floats, branches, hookAt, hookTouched, stingCosts, longlineRescues } from '../game/level/longline.js';
import { rescueSpots, nibble, RESCUES } from '../game/rescues.js';
import { worldMap, LANDMARK_KINDS } from '../game/level/worldMap.js';
import { FIELD } from '../game/level/density.js';

const span = longlineSpan();

test('the line hangs off the kelp coast, held by floats at both ends, sagging between them', () => {
    assert.ok(span && span.x1 - span.x0 === LONGLINE.length);
    const f = floats(span);
    assert.equal(f[0], span.x0); assert.ok(Math.abs(f[f.length - 1] - span.x1) < 1);
    for (const x of f) assert.ok(Math.abs(lineY(x, span) - LONGLINE.depth) < 1e-6, 'just under a float');
    assert.ok(lineY(span.x0 + LONGLINE.floatEvery / 2, span) > LONGLINE.depth + LONGLINE.sag * 0.9, 'sags between');
});

test('branches: evenly along the line, of varied length, the same every time; one carries the turtle, near the middle', () => {
    const b = branches(span);
    assert.ok(b.length >= 10);
    assert.equal(b.filter(x => x.caught).length, 1);
    assert.ok(Math.abs(b.find(x => x.caught).x - span.mid) <= LONGLINE.branchEvery);
    assert.ok(new Set(b.map(x => Math.round(x.len))).size > b.length / 2, 'varied');
    assert.deepEqual(branches(span), b);
});

test('hooks sway within reach of their line, and between two there is always room for the biggest fish', () => {
    const b = branches(span), p = {}, fish = 2 * 75;
    for (const t of [0, 1.3, 2.6, 4.1]) {
        for (const br of b) {
            hookAt(br, t, LONGLINE, p);
            assert.ok(Math.abs(p.x - br.x) <= LONGLINE.sway + 1e-6);
            assert.ok(Math.abs(Math.hypot(p.x - br.x, p.y - br.top) - br.len) < 1e-6, 'on its line');
        }
    }
    assert.ok(LONGLINE.branchEvery - 2 * LONGLINE.sway - 2 * LONGLINE.hookR > fish, 'a gap wider than the biggest fish');
});

test('touching a hook stings (not the turtle\'s); one heart at most per visit, nothing when relaxed', () => {
    const b = branches(span), free = b.find(x => !x.caught), caught = b.find(x => x.caught), p = hookAt(free, 2, LONGLINE, {});
    assert.equal(hookTouched(b, p.x, p.y, 40, 2), free);
    assert.equal(hookTouched(b, p.x, p.y - LONGLINE.hookR - 200, 40, 2), null);
    const q = hookAt(caught, 2, LONGLINE, {});
    assert.equal(hookTouched([caught], q.x, q.y, 40, 2), null);
    assert.equal(stingCosts(0, false), true); assert.equal(stingCosts(LONGLINE.maxHits, false), false); assert.equal(stingCosts(0, true), false);
});

test('the turtle is a rescue to nibble free, and the line is the landmark of its gap', () => {
    const [r] = longlineRescues();
    assert.ok(r.hold > 0 && r.y > LONGLINE.depth);
    assert.ok(rescueSpots().some(s => s.id === 'longline'), 'among the rescues');
    assert.ok(!RESCUES.big.some(x => Math.abs(x - span.mid) < 9000), 'no big rescue on the same stretch');
    let held = 0;
    for (let i = 0; i < 5; i++) held = nibble(held, true, 0.1);
    held = nibble(held, false, 0.1);
    assert.ok(Math.abs(held - 0.3) < 1e-9, 'swimming off loses it twice as fast');
    assert.ok(LANDMARK_KINDS.includes('longline'));
    assert.ok(worldMap().features.some(f => f.kind === 'longline'));
});

test('no coin lies within reach of a swinging hook; elsewhere coins are left alone', async () => {
    const { coinNearHook } = await import('../game/level/longline.js');
    const b = branches(span).find(x => !x.caught);
    assert.equal(coinNearHook(b.x, b.top + b.len), true);
    assert.equal(coinNearHook(b.x + LONGLINE.sway + 60, b.top + b.len), true, 'its whole swing and a margin');
    assert.equal(coinNearHook(b.x, b.top - 100), false, 'over the main line');
    assert.equal(coinNearHook(span.x1 + 2000, 900), false, 'past the line');
});
