import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrail } from '../game/followTrail.js';

test('a point d px back lies on the path the head swam, not on a straight line to it', () => {
    const tr = createTrail();
    // East 1000 px, then up 1000 px: 500 px back from the end is on the vertical leg, 1500 px back on the horizontal one.
    for (let x = 0; x <= 1000; x += 10) tr.push(x, 0);
    for (let y = 0; y >= -1000; y -= 10) tr.push(1000, y);
    const a = tr.at(500), b = tr.at(1500);
    assert.ok(Math.abs(a.x - 1000) < 1 && Math.abs(a.y + 500) < 45, `on the climb: ${a.x},${a.y}`);
    assert.ok(Math.abs(b.y) < 1 && Math.abs(b.x - 500) < 45, `on the swim east: ${b.x},${b.y}`);
});

test('a short path gives its oldest point; no path gives the head', () => {
    const tr = createTrail();
    const none = tr.at(300);
    assert.deepEqual([none.x, none.y], [0, 0]);
    tr.push(100, 50); tr.push(200, 50);
    const far = tr.at(5000);
    assert.deepEqual([far.x, far.y], [100, 50]);
});

test('standing still keeps the chain where it is, and the memory is bounded', () => {
    const tr = createTrail({ spacing: 40, keep: 10 });
    for (let x = 0; x <= 2000; x += 5) tr.push(x, 0);
    assert.equal(tr.length, 10);
    for (let i = 0; i < 100; i++) tr.push(2000, 0);
    assert.ok(Math.abs(tr.at(200).x - 1800) < 41);
});

test('neighbours in the chain are further apart than a friend is wide', async () => {
    const { createTrail, chainAt } = await import('../game/followTrail.js');
    const t = createTrail();
    for (let x = 0; x <= 4000; x += 10) t.push(x, 500);
    const at = k => chainAt(t, k, { x: 0, y: 0 });
    for (let k = 0; k < 5; k++) {
        const a = at(k), b = at(k + 1), c = at(k + 2);
        assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 250, `slots ${k},${k + 1}`);
        assert.ok(Math.hypot(a.x - c.x, a.y - c.y) >= 250, `slots ${k},${k + 2}`);
    }
});

test('in a U-turn every friend keeps its side of the path (above or below)', async () => {
    const { createTrail, chainAt } = await import('../game/followTrail.js');
    const east = createTrail(), west = createTrail();
    for (let x = 0; x <= 4000; x += 10) { east.push(x, 500); west.push(4000 - x, 500); }
    for (let k = 0; k < 6; k++) {
        const a = chainAt(east, k, { x: 0, y: 0 }), b = chainAt(west, k, { x: 0, y: 0 });
        assert.equal(Math.sign(a.y - 500), Math.sign(b.y - 500), `slot ${k}`);
    }
});
