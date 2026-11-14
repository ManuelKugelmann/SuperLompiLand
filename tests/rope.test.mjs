import test from 'node:test';
import assert from 'node:assert/strict';
import { ROPE, createRope, stepRope } from '../game/level/rope.js';

const length = r => { let l = 0; for (let i = 1; i < r.n; i++) l += Math.hypot(r.x[i] - r.x[i - 1], r.y[i] - r.y[i - 1]); return l; };

test('a rope hangs straight between its ends, in even segments', () => {
    const r = createRope(500, 100, 900);
    assert.equal(r.x[0], 500); assert.equal(r.y[0], 100);
    assert.ok(Math.abs(r.y[r.n - 1] - 900) < 1e-3);
    assert.ok(Math.abs(r.seg - ROPE.segment) < ROPE.segment * 0.5);
    assert.equal(createRope(0, 0, 10).n, 2, 'even a stub has two ends');
});

test('at rest it stays put: the top is fixed, the length holds, the sway is small', () => {
    const r = createRope(500, 100, 900);
    for (let i = 0; i < 600; i++) stepRope(r, i / 60, null);
    assert.equal(r.x[0], 500); assert.equal(r.y[0], 100);
    assert.ok(Math.abs(length(r) - 800) < 800 * 0.05, `length ${length(r)}`);
    assert.ok(Math.abs(r.x[r.n - 1] - 500) < 60, `tip drifted ${r.x[r.n - 1] - 500}`);
    assert.ok(r.y[r.n - 1] > 850);
});

test('a swimmer passing shoves the links aside, and the chain swings back', () => {
    const r = createRope(500, 100, 900), mid = r.n >> 1;
    for (let i = 0; i < 12; i++) stepRope(r, i / 60, { x: 470 + i * 6, y: r.y[mid], vx: 12, vy: 0 });
    const pushed = r.x[mid] - 500;
    assert.ok(pushed > 12, `pushed ${pushed}`);
    assert.equal(r.x[0], 500, 'the top never moves');
    for (let i = 0; i < 900; i++) stepRope(r, i / 60, null);
    assert.ok(Math.abs(r.x[mid] - 500) < pushed * 0.5, `settled at ${r.x[mid] - 500}`);
    assert.ok(Math.abs(length(r) - 800) < 800 * 0.05);
});

test('a swimmer far away does nothing', () => {
    const a = createRope(500, 100, 900), b = createRope(500, 100, 900);
    for (let i = 0; i < 30; i++) { stepRope(a, i / 60, null); stepRope(b, i / 60, { x: 500 + ROPE.pushRadius + 50, y: 500, vx: 20, vy: 0 }); }
    assert.deepEqual([...a.x], [...b.x]);
});

test('the weighted end is moved less by a shove than a link in the middle', () => {
    const r = createRope(500, 100, 900), mid = r.n >> 1, tip = r.n - 1;
    for (let i = 0; i < 10; i++) stepRope(r, 0, { x: 500, y: r.y[mid], vx: 12, vy: 0 });
    const m = Math.abs(r.x[mid] - 500);
    const q = createRope(500, 100, 900);
    for (let i = 0; i < 10; i++) stepRope(q, 0, { x: 500, y: q.y[tip], vx: 12, vy: 0 });
    assert.ok(Number.isFinite(m) && Number.isFinite(q.x[tip]));
    assert.ok(Math.abs(length(q) - 800) < 800 * 0.08);
});
