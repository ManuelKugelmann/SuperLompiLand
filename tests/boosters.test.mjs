import test from 'node:test';
import assert from 'node:assert/strict';
import { BOOST, boostersFor, touches, cannonShot, padBounce } from '../game/level/boosters.js';
import { createFlow, streamY } from '../game/level/flow.js';
import { WORLD_END } from '../game/level/biomes.js';

const streams = createFlow(1234).streamsIn(0, WORLD_END);

test('every stream gets a cannon at each end and a pad under its middle', () => {
    assert.ok(streams.length > 3);
    const ids = new Set();
    for (const s of streams) {
        const [first, last, pad] = boostersFor(s);
        for (const b of [first, last, pad]) {
            assert.ok(Math.abs(Math.hypot(b.dx, b.dy) - 1) < 1e-9, `${b.id}: unit direction`);
            assert.ok(!ids.has(b.id)); ids.add(b.id);
            assert.ok(b.y > 0, `${b.id}: under water`);
        }
        assert.deepEqual([first.kind, last.kind, pad.kind], ['cannon', 'cannon', 'pad']);
        assert.ok(first.x > s.x0 && first.x < last.x && last.x < s.x1);
        assert.ok(Math.abs(first.y - streamY(s, first.x)) < 1e-9, 'the mouth cannon sits on the lane');
        assert.ok(first.dx > 0.8, 'and fires along it');
        assert.ok(last.dx > 0.5 && last.dy < -0.25, 'the end cannon fires up and forward');
        assert.ok(pad.y > streamY(s, pad.x) && pad.dy === -1, 'the pad lies under the lane and throws upward');
    }
});

test('placement is deterministic', () => {
    assert.deepEqual(boostersFor(streams[0]), boostersFor(createFlow(1234).streamsIn(0, WORLD_END)[0]));
});

test('reach: touching depends on the kind and the body size', () => {
    const [cannon, , pad] = boostersFor(streams[0]);
    assert.ok(touches(cannon, cannon.x + BOOST.cannonRadius - 1, cannon.y, 0));
    assert.ok(!touches(cannon, cannon.x + BOOST.cannonRadius + 1, cannon.y, 0));
    assert.ok(touches(cannon, cannon.x + BOOST.cannonRadius + 20, cannon.y, 60));
    assert.ok(touches(pad, pad.x, pad.y - BOOST.padRadius + 1, 0) && !touches(pad, pad.x, pad.y - BOOST.padRadius - 1, 0));
});

test('a cannon adds to the speed along its direction and never replaces it', () => {
    const b = { kind: 'cannon', dx: 1, dy: 0 };
    assert.deepEqual(cannonShot(0, 0, b), { x: BOOST.cannonMin, y: 0 }, 'from rest: the least speed');
    assert.equal(cannonShot(12, 0, b).x, 12 + BOOST.cannonKick, 'entering fast leaves faster');
    assert.equal(cannonShot(-20, 0, b).x, BOOST.cannonMin, 'even against the shot');
    const skew = cannonShot(10, 8, b);
    assert.ok(skew.x === 20 && Math.abs(skew.y - 8 * BOOST.cannonSide) < 1e-9, 'the path straightens');
    const fast = cannonShot(30, 0, b);
    assert.ok(Math.abs(Math.hypot(fast.x, fast.y) - BOOST.maxSpeed) < 1e-9, 'capped');
    const up = cannonShot(0, 0, { kind: 'cannon', dx: 0.6, dy: -0.8 });
    assert.ok(up.y < 0 && Math.abs(Math.hypot(up.x, up.y) - BOOST.cannonMin) < 1e-9);
});

test('a pad returns the speed at the angle it was hit, a little springier', () => {
    const pad = { kind: 'pad', dx: 0, dy: -1 };
    const out = padBounce(9, 12, pad);
    assert.equal(out.x, 9, 'speed along the pad is kept');
    assert.ok(Math.abs(out.y + 12 * BOOST.padBounce) < 1e-9, 'speed into it comes back out');
    assert.equal(padBounce(3, 2, pad).y, -BOOST.padMin, 'a soft touch still bounces');
    assert.equal(padBounce(3, -2, pad), null, 'moving away: nothing happens');
    const hard = padBounce(20, 30, pad);
    assert.ok(Math.hypot(hard.x, hard.y) <= BOOST.maxSpeed + 1e-9);
});
