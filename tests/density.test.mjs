import test from 'node:test';
import assert from 'node:assert/strict';
import { FIELD, createField, chunkGrids, gridRows } from '../game/level/density.js';
import { floorY, WORLD_WEST, WORLD_END, ABYSS } from '../game/level/biomes.js';

const field = createField(1337);

test('the same seed always gives the same world, another seed a different one', () => {
    const again = createField(1337), other = createField(42);
    let differs = false;
    for (const [x, y] of [[0, 700], [1234, 2100], [-4000, 900], [30000, 4000]]) {
        assert.equal(field.density(x, y), again.density(x, y));
        if (field.density(x, y) !== other.density(x, y)) differs = true;
    }
    assert.ok(differs);
});

test('the start pool and the water under the surface are open; deep below the seabed is rock', () => {
    assert.ok(field.density(FIELD.spawn.x, FIELD.spawn.y) < FIELD.threshold);
    for (let x = -2000; x < WORLD_END; x += 3000) {   // east of the beach, where the water is deep
        assert.ok(field.density(x, 80) < FIELD.threshold, `open near the surface at x=${x}`);
        assert.ok(field.density(x, floorY(x) + 1200) > FIELD.threshold, `rock under the seabed at x=${x}`);
    }
});

test('the world is closed off in the west and behind the grand nest', () => {
    assert.ok(field.density(WORLD_WEST - 1500, 1500) > FIELD.threshold);
    assert.ok(field.density(WORLD_END + 2500, 1500) > FIELD.threshold);
});

test('the abyss shaft is swimmable far below the regular seabed', () => {
    for (let y = 5000; y < FIELD.maxDepth + ABYSS.depth * 0.8; y += 400) {
        assert.ok(field.density(ABYSS.x, y) < FIELD.threshold, `open at depth ${y}`);
    }
});

test('every nest sits on the seabed with open water above it', () => {
    assert.ok(field.nests.length >= 5);
    assert.equal(field.nests.filter(n => n.grand).length, 1);
    for (const n of field.nests) {
        assert.ok(field.density(n.x, n.y + 60, false) > FIELD.threshold, `ground under nest ${n.index}`);
        assert.ok(field.density(n.x, n.y - 200) < FIELD.threshold, `water above nest ${n.index}`);
    }
});

test('chunk grids match direct sampling, and neighbouring chunks share their border', () => {
    const span = 960, n = 20;
    const a = chunkGrids(field, 1337, 0, 960, span, n), b = chunkGrids(field, 1337, 960, 960, span, n);
    const rowsA = gridRows(a.fine, n + 1), rowsB = gridRows(b.fine, n + 1);
    assert.ok(Math.abs(rowsA[5][7] - field.density(7 * 48, 960 + 5 * 48)) < 1e-6);
    for (let j = 0; j <= n; j++) assert.equal(rowsA[j][n], rowsB[j][0], `seam at row ${j}`);
    assert.equal(a.back.length, (n + 1) * (n + 1));
});
