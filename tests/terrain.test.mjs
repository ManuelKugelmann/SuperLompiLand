import test from 'node:test';
import assert from 'node:assert/strict';
import { hash, vnoise, marchCell, eachCell } from '../game/level/terrain.js';

test('hash is deterministic, seed-dependent and within [0, 1)', () => {
    assert.equal(hash(3, -7, 42), hash(3, -7, 42));
    assert.notEqual(hash(3, -7, 42), hash(3, -7, 43));
    for (let i = -50; i < 50; i++) {
        const h = hash(i, i * 13, 1337);
        assert.ok(h >= 0 && h < 1);
    }
});

test('vnoise equals the lattice hash at integer points and is continuous', () => {
    assert.equal(vnoise(5, 9, 7), hash(5, 9, 7));
    const a = vnoise(2.5, 3.5, 7), b = vnoise(2.5001, 3.5, 7);
    assert.ok(Math.abs(a - b) < 0.001);
});

test('marchCell: empty and full cells have no outline', () => {
    assert.deepEqual(marchCell(0, 0, 10, [0, 0, 0, 0], 0.5), { poly: [], edges: [] });
    const full = marchCell(0, 0, 10, [1, 1, 1, 1], 0.5);
    assert.equal(full.poly.length, 4);
    assert.equal(full.edges.length, 0);
});

test('marchCell: a half-solid cell is cut exactly where the density crosses the threshold', () => {
    // left side solid (1), right side water (0), threshold 0.25 -> cut at 75 % of the width
    const { poly, edges } = marchCell(100, 200, 40, [1, 0, 0, 1], 0.25);
    assert.equal(edges.length, 1);
    for (const pt of edges[0]) assert.ok(Math.abs(pt.x - 130) < 1e-9);
    assert.deepEqual(edges[0].map(pt => pt.y).sort((a, b) => a - b), [200, 240]);
    assert.equal(poly.length, 4);
});

test('marchCell: opposite solid corners (saddle) give two outline segments', () => {
    assert.equal(marchCell(0, 0, 10, [1, 0, 1, 0], 0.5).edges.length, 2);
});

test('neighbouring cells share their outline points (no seams)', () => {
    const left = marchCell(0, 0, 10, [1, 0.2, 0.8, 1], 0.5);
    const right = marchCell(10, 0, 10, [0.2, 0, 0, 0.8], 0.5);
    const onSharedEdge = shape => shape.edges.flat().filter(pt => Math.abs(pt.x - 10) < 1e-9).map(pt => pt.y);
    const l = onSharedEdge(left), r = onSharedEdge(right);
    assert.equal(l.length, 1);
    assert.equal(r.length, 1);
    assert.ok(Math.abs(l[0] - r[0]) < 1e-9, `${l[0]} vs ${r[0]}`);
});

test('eachCell visits every cell of the grid once', () => {
    const grid = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
    let n = 0;
    eachCell(grid, 0, 0, 300, 0.5, () => n++);
    assert.equal(n, 9);
});
