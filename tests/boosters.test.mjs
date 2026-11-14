import test from 'node:test';
import assert from 'node:assert/strict';
import { BOOST, boostersFor, touches, padBounce } from '../game/level/boosters.js';
import { createFlow, streamY } from '../game/level/flow.js';
import { WORLD_END } from '../game/level/biomes.js';

const streams = createFlow(1234).streamsIn(0, WORLD_END);

test('every stream gets one pad under its middle, and nothing that shoots the fish anywhere', () => {
    assert.ok(streams.length > 3);
    const ids = new Set();
    for (const s of streams) {
        const all = boostersFor(s);
        assert.deepEqual(all.map(b => b.kind), ['pad'], 'no bubble cannons (playtest)');
        const pad = all[0];
        assert.ok(!ids.has(pad.id)); ids.add(pad.id);
        assert.ok(pad.x > s.x0 && pad.x < s.x1 && pad.y > 0);
        assert.ok(pad.y > streamY(s, pad.x) && pad.dx === 0 && pad.dy === -1, 'the pad lies under the lane and throws upward');
    }
});

test('placement is deterministic', () => {
    assert.deepEqual(boostersFor(streams[0]), boostersFor(createFlow(1234).streamsIn(0, WORLD_END)[0]));
});

test('reach: touching depends on the body size', () => {
    const [pad] = boostersFor(streams[0]);
    assert.ok(touches(pad, pad.x, pad.y - BOOST.padRadius + 1, 0) && !touches(pad, pad.x, pad.y - BOOST.padRadius - 1, 0));
    assert.ok(touches(pad, pad.x, pad.y - BOOST.padRadius - 20, 60));
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
