import test from 'node:test';
import assert from 'node:assert/strict';
import { twoBone, fabrik, makeFoot, stepFoot } from '../game/rig/ik.js';

const near = (a, b, eps = 1e-3) => Math.abs(a - b) < eps;

test('two-bone leg reaches a target in range and keeps both bone lengths', () => {
    const r = twoBone(10, 20, 40, 50, 30, 25);
    assert.ok(r.reached);
    assert.ok(near(r.ex, 40) && near(r.ey, 50));
    assert.ok(near(Math.hypot(r.jx - 10, r.jy - 20), 30));
    assert.ok(near(Math.hypot(r.ex - r.jx, r.ey - r.jy), 25));
});

test('the bend side mirrors the knee across the hip-foot line', () => {
    const a = twoBone(0, 0, 40, 0, 30, 30, 1), b = twoBone(0, 0, 40, 0, 30, 30, -1);
    assert.ok(a.jy > 1 && b.jy < -1 && near(a.jx, b.jx) && near(a.jy, -b.jy));
});

test('an unreachable target stretches the leg toward it; a too-close one folds it', () => {
    const far = twoBone(0, 0, 500, 0, 30, 25);
    assert.equal(far.reached, false);
    assert.ok(near(far.ex, 55, 1e-2) && near(far.ey, 0, 1e-2));
    const close = twoBone(0, 0, 1, 0, 30, 25);
    assert.equal(close.reached, false);
    assert.ok(near(Math.hypot(close.ex, close.ey), 5, 1e-2));
    const same = twoBone(3, 4, 3, 4, 30, 30);
    assert.ok(Number.isFinite(same.jx) && Number.isFinite(same.jy));
});

const chain = () => ({ xs: Float32Array.from([0, 10, 20, 30, 40]), ys: new Float32Array(5) });
const lengths = ({ xs, ys }) => Array.from({ length: xs.length - 1 }, (_, i) => Math.hypot(xs[i + 1] - xs[i], ys[i + 1] - ys[i]));

test('FABRIK: the tip reaches a target in range, root fixed, links keep their length', () => {
    const c = chain();
    assert.equal(fabrik(c.xs, c.ys, 18, 22, 12, 0.2), true);
    assert.ok(Math.hypot(c.xs[4] - 18, c.ys[4] - 22) < 0.2);
    assert.ok(c.xs[0] === 0 && c.ys[0] === 0);
    for (const l of lengths(c)) assert.ok(near(l, 10, 1e-2), `link ${l}`);
});

test('FABRIK: an unreachable target gives a straight chain toward it', () => {
    const c = chain();
    assert.equal(fabrik(c.xs, c.ys, 0, 300), false);
    assert.ok(near(c.xs[4], 0, 1e-3) && near(c.ys[4], 40, 1e-3));
    for (const l of lengths(c)) assert.ok(near(l, 10, 1e-3));
});

const flat = (x) => ({ x, y: 100 });                       // level ground at y = 100
const walk = { reach: 20, stepTime: 0.2, lift: 10, dt: 0.05, probe: flat };

test('a foot stays planted while the body is near, steps once it has moved too far', () => {
    const foot = makeFoot(0, 100);
    assert.equal(stepFoot(foot, { x: 12, y: 100 }, walk), false);
    assert.deepEqual([foot.x, foot.y], [0, 100]);
    assert.equal(stepFoot(foot, { x: 30, y: 100 }, { ...walk, lead: { x: 8, y: 0 } }), true);
    let top = 100;
    for (let i = 0; i < 10 && !foot.planted; i++) { stepFoot(foot, { x: 30, y: 100 }, walk); top = Math.min(top, foot.y); }
    assert.ok(foot.planted && near(foot.x, 38) && near(foot.y, 100), `landed at ${foot.x},${foot.y}`);
    assert.ok(top < 95, `the foot arcs: ${top}`);
});

test('a foot waits while the other leg group is in the air, or when there is no ground', () => {
    const foot = makeFoot(0, 100);
    assert.equal(stepFoot(foot, { x: 50, y: 100 }, { ...walk, mayStep: false }), false);
    assert.equal(stepFoot(foot, { x: 50, y: 100 }, { ...walk, probe: () => null }), false);
    assert.ok(foot.planted && foot.x === 0);
});

test('feet tolerate less height error than length error (reach ellipse)', () => {
    const foot = makeFoot(0, 100);
    assert.equal(stepFoot(foot, { x: 0, y: 112 }, { ...walk, reachY: 30 }), false);
    assert.equal(stepFoot(foot, { x: 0, y: 112 }, { ...walk, reachY: 8 }), true);
});
