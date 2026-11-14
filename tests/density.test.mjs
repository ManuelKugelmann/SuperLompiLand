import test from 'node:test';
import assert from 'node:assert/strict';
import { FIELD, createField, chunkGrids, gridRows, ROUTE, cruiseY } from '../game/level/density.js';
import { BIOMES, floorY, WORLD_WEST, WORLD_END, ABYSS } from '../game/level/biomes.js';

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

test('a nest lies in a level sand basin with a raised rim, whatever the slope around it', () => {
    for (const n of field.nests) {
        for (const dx of [-150, -60, 0, 60, 150]) {
            assert.ok(field.density(n.x + dx, n.y + 30) > FIELD.threshold, `sand under nest ${n.index} at ${dx}`);
            assert.ok(field.density(n.x + dx, n.y - 40) < FIELD.threshold, `water over nest ${n.index} at ${dx}`);
        }
        // The middle is lower than the rim: at the same height the rim is sand, the middle is water.
        const y = n.y - FIELD.nestRim * 0.5;
        assert.ok(field.density(n.x, y) < field.density(n.x + FIELD.nestRadius, y), `rim of nest ${n.index}`);
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

test('the calm main route is open water from the start pool to the grand nest', () => {
    for (const seed of [1337, 7, 4242]) {
        const f = createField(seed);
        let steepest = 0;
        for (let x = FIELD.spawn.x; x <= f.nests[f.nests.length - 1].x; x += 40) {
            const y = f.routeY(x);
            for (const dy of [-ROUTE.halfWidth * 0.75, 0, ROUTE.halfWidth * 0.75]) {
                assert.ok(f.density(x, y + dy) < FIELD.threshold, `seed ${seed}: rock on the route at ${x}, ${Math.round(y + dy)}`);
            }
            assert.ok(y > 100, 'under water');
            steepest = Math.max(steepest, Math.abs(f.routeY(x + 40) - y) / 40);
        }
        assert.ok(steepest < 1.3, `seed ${seed}: gentle slopes, steepest ${steepest.toFixed(2)}`);
    }
});

test('the calm route passes just above every nest', () => {
    const f = createField(1337);
    for (const nest of f.nests) {
        assert.ok(Math.abs(f.routeY(nest.x) - (nest.y - ROUTE.aboveNest)) < 1, `nest ${nest.index}`);
        assert.ok(f.density(nest.x, nest.y + 60) > FIELD.threshold, `nest ${nest.index} still lies on solid ground`);
    }
});

test('the calm route crosses the open sea just under the surface and runs half way down along the coasts', () => {
    const f = createField(1337);
    for (const b of BIOMES) {
        if (b.id === 'beach' || b.id === 'trench') continue;
        const x = b.from + b.width / 2, y = cruiseY(x);
        if (b.zone === 'sea') assert.ok(Math.abs(y - ROUTE.seaY) < 1, `${b.id}: ${Math.round(y)}`);
        else assert.ok(y > 800 && y < 1300, `${b.id}: ${Math.round(y)}`);
    }
    assert.ok(f.nests.every(n => n.grand || BIOMES[n.biome].zone === 'island'), 'nests lie on the coasts (and the grand nest at the end)');
    assert.equal(f.nests.length, BIOMES.filter(b => b.zone === 'island').length + 1);
});
