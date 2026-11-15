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

