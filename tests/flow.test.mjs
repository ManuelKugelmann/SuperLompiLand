import test from 'node:test';
import assert from 'node:assert/strict';
import { FLOW, createFlow, streamInSlot, streamY, streamDir, carry, inStreamPath } from '../game/level/flow.js';
import { createField, FIELD } from '../game/level/density.js';
import { WORLD_WEST, WORLD_END } from '../game/level/biomes.js';

const SEED = 1337, flow = createFlow(SEED), v = { x: 0, y: 0 };
const all = flow.streamsIn(WORLD_WEST, WORLD_END);

test('the world has streams, inside its borders, the same for the same seed', () => {
    assert.ok(all.length >= 5, `${all.length} streams`);
    for (const s of all) {
        assert.ok(s.x0 > WORLD_WEST && s.x1 < WORLD_END);
        const { dir, ...plain } = s;
        assert.deepEqual(plain, streamInSlot(s.index, SEED));
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

test('streams lose their pull at the calm route and keep it away from it', () => {
    const s = flow.streamsIn(WORLD_WEST, WORLD_END)[0], x = (s.x0 + s.x1) / 2, y = streamY(s, x);
    const plain = createFlow(SEED).at(x, y, 3, { x: 0, y: 0 });
    assert.ok(Math.hypot(plain.x, plain.y) > FLOW.streamSpeed * 0.7);
    const onRoute = createFlow(SEED, FLOW, () => y).at(x, y, 3, { x: 0, y: 0 });
    assert.ok(Math.hypot(onRoute.x, onRoute.y) < 1.2, `the route runs through the stream: ${Math.hypot(onRoute.x, onRoute.y)}`);
    const farRoute = createFlow(SEED, FLOW, () => y + 900).at(x, y, 3, { x: 0, y: 0 });
    assert.deepEqual(farRoute, plain, 'a route far away changes nothing');
    const edge = createFlow(SEED, FLOW, () => y + (FLOW.calm[0] + FLOW.calm[1]) / 2).at(x, y, 3, { x: 0, y: 0 });
    assert.ok(Math.hypot(edge.x, edge.y) > 2 && Math.hypot(edge.x, edge.y) < Math.hypot(plain.x, plain.y) - 2, 'a soft edge');
});


test('streams are big straight slanting lanes leading east, in open water at both ends, still past their ends', () => {
    const all = flow.streamsIn(WORLD_WEST, WORLD_END), calm = { ...FLOW, swell: 0 }, f = createFlow(SEED, calm);
    assert.ok(all.length > 20);
    assert.equal(flow.eddiesIn, undefined, 'no eddies');
    let slanted = 0;
    for (const s of all) {
        assert.ok(s.x1 - s.x0 >= FLOW.streamLength[0] - 1e-6, 'long');
        const d = streamDir(s), slope = d.y / d.x;
        assert.ok(Math.abs(slope) <= FLOW.streamSlope[1] + 1e-9, 'never steep');
        if (Math.abs(slope) >= FLOW.streamSlope[0] * 0.5) slanted++;
        for (const y of [s.y0, s.y1]) assert.ok(y >= FLOW.streamBand[0] - 1e-6, 'under the surface band');
        for (let x = s.x0 + 300; x <= s.x1 - 300; x += 400) {
            const v = f.at(x, streamY(s, x), 0, { x: 0, y: 0 });
            assert.ok(v.x > 0, 'always east');
            assert.ok(Math.abs(v.y / v.x - slope) < 1e-6, 'straight: the same direction all along');
        }
        assert.deepEqual(f.at(s.x1 + 300, streamY(s, s.x1), 0, { x: 0, y: 0 }), { x: 0, y: 0 });
    }
    assert.ok(slanted / all.length > 0.6, `most of them clearly slanting (${slanted} of ${all.length})`);
});

test('no hazard in a stream\'s way: its lane and the stretch beyond its end count as its path', () => {
    const s = flow.streamsIn(WORLD_WEST, WORLD_END)[3], mid = (s.x0 + s.x1) / 2, y = streamY(s, mid);
    assert.equal(inStreamPath(mid, y, [s]), true);
    assert.equal(inStreamPath(mid, y + FLOW.clear.side - 5, [s]), true);
    assert.equal(inStreamPath(mid, y + FLOW.clear.side + 5, [s]), false);
    assert.equal(inStreamPath(s.x1 + FLOW.clear.ahead - 10, streamY(s, s.x1), [s]), true, 'where it lets a swimmer go');
    assert.equal(inStreamPath(s.x1 + FLOW.clear.ahead + 10, streamY(s, s.x1), [s]), false);
    assert.equal(inStreamPath(s.x0 - 400, y, [s]), false);
    assert.equal(inStreamPath(mid, y, []), false);
});

test('a stream shows where it pulls: none of its pull is left on the calm route', () => {
    const f = createFlow(SEED, FLOW, () => 1000);
    assert.equal(f.pullAt(5000, 1000), 0);
    assert.equal(f.pullAt(5000, 1000 + FLOW.calm[1] + 10), 1);
    assert.equal(createFlow(SEED).pullAt(5000, 1000), 1, 'no route: everywhere');
});
