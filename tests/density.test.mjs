import test from 'node:test';
import assert from 'node:assert/strict';
import { FIELD, createField, chunkGrids, gridRows, ROUTE, cruiseY } from '../game/level/density.js';
import { BIOMES, floorY, WORLD_WEST, WORLD_END, ABYSS, REEF_CREST, reefCrest, reefCrestX } from '../game/level/biomes.js';
import { detour } from '../game/level/weather.js';

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
        if (b.zone === 'sea') { const x0 = b.from + b.width * 0.9; assert.ok(Math.abs(cruiseY(x0 - 3200) - ROUTE.seaY) < 1 || detour(x0 - 3200).k > 0, `${b.id}: ${Math.round(y)}`); }      // storm and downwelling stretches: tests/weather.test.mjs
        else assert.ok(y > 800 && y < 1300, `${b.id}: ${Math.round(y)}`);
    }
    assert.ok(f.nests.every(n => n.grand || BIOMES[n.biome].zone === 'island'), 'nests lie on the coasts (and the grand nest at the end)');
    assert.equal(f.nests.length, BIOMES.filter(b => b.zone === 'island').length + 1);
});

test('the open sea is clear water: no rock hangs between the surface and just above the bottom', () => {
    for (const seed of [1337, 7, 4242]) {
        const f = createField(seed);
        for (const b of BIOMES) {
            if (b.zone !== 'sea') continue;
            // From just past the island's edge to just before the next; not at the abyss, whose shaft is narrower than its floor.
            for (let x = b.from + 320; x < b.from + b.width - 920; x += 170) {
                if (Math.abs(x - ABYSS.x) < ABYSS.halfWidth * 3) continue;
                const fy = floorY(x);
                for (let y = 60; y < fy - FIELD.seaBottom; y += 90) {
                    assert.ok(f.density(x, y) < FIELD.threshold, `seed ${seed}: rock in the ${b.id} sea at ${x}, ${y} (bottom ${Math.round(fy)})`);
                }
            }
        }
    }
});

test('the reef crest stands just under the surface at the reef\'s outer edge, lumpy and sloping, and the calm route has its channel through it', () => {
    const f = createField(1337), c = reefCrestX();
    const topAt = x => { let y = 40; while (y < 3000 && f.density(x, y) < FIELD.threshold) y += 10; return y; };
    const tops = [];
    for (let x = c - REEF_CREST.half + 40; x <= c + REEF_CREST.half - 40; x += 40) {
        const y = topAt(x);
        tops.push(y);
        assert.ok(y > REEF_CREST.top - REEF_CREST.lump - 80 && y < REEF_CREST.top + REEF_CREST.lump + REEF_CREST.groove.depth[1] + 140, `crest top at ${x}: ${y}`);
        assert.ok(f.density(x, f.routeY(x)) < FIELD.threshold, 'the channel');
    }
    assert.ok(Math.max(...tops) - Math.min(...tops) > 40, 'no flat table: the top rises and falls');
    assert.ok(tops.filter(y => y < REEF_CREST.top + 120).length > tops.length * 0.6, 'most of it stands just under the surface');
    // It slopes away on both sides instead of ending in a cut face.
    assert.ok(topAt(c + REEF_CREST.half + 200) > topAt(c + REEF_CREST.half - 100) + 100, 'the seaward slope');
    assert.ok(topAt(c - REEF_CREST.half - 150) > topAt(c - REEF_CREST.half + 100) + 100, 'the lagoon side slope');
    assert.ok(f.routeY(c) > REEF_CREST.top + ROUTE.halfWidth + 900, 'the pass lies far under the crest: a massive reef above it');
    // Solid from its top down to the pass: no shelf hanging over open water.
    for (let y = REEF_CREST.top + 250; y < f.routeY(c) - ROUTE.halfWidth * 2; y += 60) assert.ok(f.density(c + 100, y) > FIELD.threshold, `solid at ${y}`);
    assert.equal(reefCrest(c - 2000), 0);
});
