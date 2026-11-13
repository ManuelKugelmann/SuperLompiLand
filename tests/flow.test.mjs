import test from 'node:test';
import assert from 'node:assert/strict';
import { FLOW, createFlow, streamInSlot, streamY, carry } from '../game/level/flow.js';
import { createField, FIELD } from '../game/level/density.js';
import { WORLD_WEST, WORLD_END } from '../game/level/biomes.js';

const SEED = 1337, flow = createFlow(SEED), v = { x: 0, y: 0 };
const all = flow.streamsIn(WORLD_WEST, WORLD_END);

test('the world has streams, inside its borders, the same for the same seed', () => {
    assert.ok(all.length >= 5, `${all.length} streams`);
    for (const s of all) {
        assert.ok(s.x0 > WORLD_WEST && s.x1 < WORLD_END);
        assert.deepEqual(s, streamInSlot(s.index, SEED));
    }
    assert.notDeepEqual(createFlow(7).streamsIn(WORLD_WEST, WORLD_END).map(s => s.x0 | 0), all.map(s => s.x0 | 0));
});

test('in the middle of a stream the water runs east at stream speed, along the lane', () => {
    for (const s of all) {
        const x = (s.x0 + s.x1) / 2, y = streamY(s, x);
        flow.at(x, y, 0, v);
        const swell = y < FLOW.swellDepth ? FLOW.swell * 1.5 : 0;
        assert.ok(v.x > FLOW.streamSpeed * 0.75 - swell, `stream ${s.index}: ${v.x}`);
        assert.ok(Math.hypot(v.x, v.y) < FLOW.streamSpeed + swell + 0.01);
    }
});

test('a stream is a lane: the pull drops off to the sides and fades in at its ends', () => {
    const s = all[0], x = (s.x0 + s.x1) / 2, y = streamY(s, x);
    const speed = (px, py) => { flow.at(px, py, 0, v); return Math.hypot(v.x, v.y); };
    assert.ok(speed(x, y + FLOW.streamWidth) < speed(x, y) * 0.55);
    assert.ok(speed(x, y + FLOW.streamWidth * 3) < FLOW.swell * 1.5 + 0.05, 'nothing three widths away');
    assert.ok(speed(s.x0 + 20, streamY(s, s.x0 + 20)) < speed(x, y) * 0.3, 'gentle entry');
});

test('the field has no jumps', () => {
    const s = all[1] || all[0];
    let worst = 0, last = null;
    for (let x = s.x0 - 300; x < s.x1 + 300; x += 8) {
        flow.at(x, streamY(s, Math.min(s.x1, Math.max(s.x0, x))), 3, v);
        if (last) worst = Math.max(worst, Math.hypot(v.x - last.x, v.y - last.y));
        last = { ...v };
    }
    assert.ok(worst < 1.2, `largest step between neighbours: ${worst}`);
});

test('the swell lives near the surface, deep water away from streams is still, air has no flow', () => {
    let top = 0;
    for (let t = 0; t < 20; t += 0.5) { flow.at(-3000, 80, t, v); top = Math.max(top, Math.hypot(v.x, v.y)); }
    assert.ok(top > 0.3 && top <= FLOW.swell * 1.5, `swell ${top}`);
    flow.at(-3000, FLOW.swellDepth + 2500, 4, v);
    assert.deepEqual(v, { x: 0, y: 0 });
    flow.at(1000, -50, 4, v);
    assert.deepEqual(v, { x: 0, y: 0 });
});

test('streams run through open water', () => {
    const field = createField(SEED);
    let open = 0, samples = 0;
    for (const s of all) {
        for (let x = s.x0 + 300; x < s.x1 - 300; x += 150) { samples++; if (field.density(x, streamY(s, x)) < FIELD.threshold) open++; }
    }
    assert.ok(open / samples > 0.8, `${open} of ${samples} stream points are in open water`);
});

test('water takes a body up to its speed and never slows it down', () => {
    const out = { x: 0, y: 0 };
    carry(10, 0, 0, 0, FLOW, out);
    assert.ok(out.x > 0 && out.y === 0, 'a resting body is taken along');
    carry(10, 0, 14, 3, FLOW, out);
    assert.deepEqual(out, { x: 0, y: 0 }, 'faster than the stream: left alone');
    carry(10, 0, -6, 0, FLOW, out);
    const against = out.x;
    carry(10, 0, 6, 0, FLOW, out);
    assert.ok(against > out.x && out.x > 0, 'the bigger the difference, the stronger the pull');
    carry(0, 0, 5, 5, FLOW, out);
    assert.deepEqual(out, { x: 0, y: 0 });
    // Carried from rest, a body reaches the stream's speed but does not pass it.
    let vx = 0;
    for (let i = 0; i < 400; i++) vx += carry(10, 0, vx, 0, FLOW, out).x;
    assert.ok(vx > 9.5 && vx <= 10.0001, `ends at ${vx}`);
});
