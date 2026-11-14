import test from 'node:test';
import assert from 'node:assert/strict';
import { POSE, rigProfile, poseOf } from '../game/ai/pose.js';

const body = () => ({ x: 10, y: 20, dir: 1, lean: 0.3, lift: 12, bob: 20 });

test('a species row becomes a Rig profile with one look', () => {
    const p = rigProfile('friend_turtle', { size: 240, anim: 'paddle', soft: 0.35, facesLeft: true });
    assert.equal(p.states.normal.key, 'friend_turtle');
    assert.equal(p.states.normal.width, 240);
    assert.equal(p.anim, 'paddle');
    assert.equal(p.facesLeft, true);
    assert.equal(p.upright, false);
    assert.ok(p.alignFull > p.alignFrom && p.pitch < 1);
});

test('a creature without a mind stays where it was put, as it was put', () => {
    const p = poseOf({}, body(), 1, {});
    assert.deepEqual([p.x, p.y, p.dir, p.lean, p.size, p.effort], [10, 20, 1, 0.3, 1, 0]);
});

test('a swimmer faces where it heads, but does not flip while swimming straight up', () => {
    const a = { x: 100, y: 200, heading: Math.PI, v: 1, speed: 1, seed: 0 };
    const p = poseOf({ brain: a }, body(), 0, {});
    assert.equal(p.dir, -1);
    assert.ok(p.vx < -0.99 && Math.abs(p.vy) < 1e-9);
    assert.ok(p.effort > 0 && p.effort <= 1);
    a.heading = -Math.PI / 2;
    assert.equal(poseOf({ brain: a }, { ...body(), dir: -1 }, 0, {}).dir, -1, 'keeps its side');
});

test('a swimmer drifts up and down by a share of its bob', () => {
    const a = { x: 0, y: 0, heading: 0, v: 0, speed: 1, seed: 0 };
    const ys = [0, 0.4, 0.8, 1.2, 1.6, 2.4].map(t => poseOf({ brain: a }, body(), t, {}).y);
    assert.ok(Math.max(...ys.map(Math.abs)) <= 20 * POSE.bob + 1e-9);
    assert.ok(Math.max(...ys) - Math.min(...ys) > 1);
});

test('a crawler lies on the rock along its normal and pulls in when curled', () => {
    const c = { x: 50, y: 60, nx: 0, ny: -1, state: 'crawl', dir: -1 };
    const p = poseOf({ crawler: c }, body(), 0, {});
    assert.deepEqual([p.x, p.y], [50, 48]);
    assert.ok(Math.abs(p.lean) < 1e-9, 'flat ground: upright');
    assert.equal(p.dir, -1);
    c.state = 'curl';
    const q = poseOf({ crawler: c }, body(), 0, {});
    assert.equal(q.size, POSE.curl);
    assert.equal(q.dir, 1, 'a curled one keeps its facing');
});

test('a warning grumpy puffs up and works hard; its shove sets the facing', () => {
    const g = { x: 0, y: 0, vx: 0, vy: 0, state: 'warn', heading: -1, seed: 0, shoveSpeed: 600 };
    const p = poseOf({ grumpy: g }, body(), 0.01, {});
    assert.equal(p.size, POSE.puff);
    assert.equal(p.dir, -1);
    assert.ok(p.effort >= 0.6);
    g.state = 'shove'; g.vx = 600;
    const q = poseOf({ grumpy: g }, body(), 0.01, {});
    assert.equal(q.size, 1);
    assert.equal(q.vx, 10);
    assert.equal(q.effort, 1);
});
