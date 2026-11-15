import test from 'node:test';
import assert from 'node:assert/strict';
import { TILE_TERRAIN, texelAt, texelStep, encodeDensity, tileDensity, densityTile, chunkLook } from '../game/level/tileTerrain.js';
import { createField, FIELD } from '../game/level/density.js';

test('density keeps 16 bits round the threshold: the outline sits where the field puts it', () => {
    for (const d of [FIELD.threshold, FIELD.threshold + 0.0003, FIELD.threshold - 0.4, FIELD.threshold + 0.9]) {
        const [hi, lo] = encodeDensity(d);
        assert.ok(Math.abs(tileDensity(hi, lo) - d) < 1e-4, String(d));
    }
    assert.equal(tileDensity(...encodeDensity(FIELD.threshold + 5)), FIELD.threshold + TILE_TERRAIN.range, 'beyond the range: held at its end');
});

test('the tile reaches past the chunk on every side; its first and last inner texels lie on the chunk edges', () => {
    const span = 960, b = TILE_TERRAIN.border, n = TILE_TERRAIN.size;
    assert.equal(texelAt(1000, b, span), 1000);
    assert.ok(Math.abs(texelAt(1000, n - 1 - b, span) - (1000 + span)) < 1e-9);
    assert.ok(texelStep(span) < 20, 'finer than the collision grid');
});

test('neighbouring chunks share their edge: the same density on both sides, no seam', () => {
    const field = createField(1337, 'own'), span = 960, n = TILE_TERRAIN.size, b = TILE_TERRAIN.border;
    const ox = 240 * span, oy = span;
    const a = densityTile(field, ox, oy, span), c = densityTile(field, ox + span, oy, span);
    for (let j = 0; j < n; j += 7) {
        const right = (j * n + (n - 1 - b)) * 4, left = (j * n + b) * 4;
        assert.equal(a[right], c[left]); assert.equal(a[right + 1], c[left + 1]);
    }
    let solid = 0;
    for (let k = 0; k < n * n; k++) if (tileDensity(a[k * 4], a[k * 4 + 1]) > FIELD.threshold) solid++;
    assert.ok(solid > 0 && solid < n * n, 'the reef chunk has rock and water');
});

test('what the shader is told about a chunk: palettes rim to core in 0..1, sand, fog and two materials per side', () => {
    const k = chunkLook(240 * 960, 960);
    assert.equal(k.palL.length, 15); assert.equal(k.palR.length, 15);
    assert.ok([...k.palL, ...k.palR].every(v => v >= 0 && v <= 1));
    assert.equal(k.sandL.length, 4); assert.ok(k.sandL[3] > 0, 'the reef has a sand skin');
    assert.equal(k.mats.length, 4); assert.ok(k.mats.every(m => m >= 0));
    const next = chunkLook(241 * 960, 960);
    assert.deepEqual([...k.palR], [...next.palL], 'neighbours agree at their shared edge');
});
