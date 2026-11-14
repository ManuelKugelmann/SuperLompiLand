import test from 'node:test';
import assert from 'node:assert/strict';
import { EDGE, edgeAim, inEdge } from '../game/controls/edgeAim.js';

const W = 1600, H = 900, MID = (H * 0.2 + H) / 2, near = (a, b) => Math.abs(a - b) < 1e-9;

test('the side decides left or right, the middle swims level at full speed', () => {
    const r = edgeAim(W - 10, MID, W, H), l = edgeAim(10, MID, W, H);
    assert.ok(near(r.x, 1) && near(r.y, 0));
    assert.ok(near(l.x, -1) && near(l.y, 0));
});

test('a little off the middle still swims level (easy to follow a coin line)', () => {
    const a = edgeAim(W - 10, MID + H * 0.05, W, H);
    assert.ok(near(a.y, 0));
});

test('the corners are fully up or fully down', () => {
    const up = edgeAim(W - 10, H * 0.2, W, H), down = edgeAim(10, H, W, H);
    assert.ok(Math.abs(up.x) < 1e-9 && near(up.y, -1));
    assert.ok(Math.abs(down.x) < 1e-9 && near(down.y, 1));
});

test('the turn grows steadily from the middle to the corner, and the direction has length 1', () => {
    let last = 0;
    for (let y = MID; y >= H * 0.2; y -= 10) {
        const a = edgeAim(W - 10, y, W, H);
        assert.ok(Math.abs(Math.hypot(a.x, a.y) - 1) < 1e-9);
        assert.ok(-a.y >= last - 1e-12);
        last = -a.y;
    }
});

test('a touch belongs to an edge only inside the strips and below the HUD line', () => {
    assert.equal(inEdge(10, H / 2, W, H), true);
    assert.equal(inEdge(W - 10, H * 0.9, W, H), true);
    assert.equal(inEdge(W / 2, H / 2, W, H), false, 'the picture is rubber band');
    assert.equal(inEdge(W * EDGE.gauge + 5, H / 2, W, H), false);
    assert.equal(inEdge(10, H * EDGE.top - 5, W, H), false, 'the HUD line is not an edge');
});
