import test from 'node:test';
import assert from 'node:assert/strict';
import { MAT, MATERIALS, BIOME_MATERIALS, BIOME_INDEX, prepareTile, setMaterials, materialTiles } from '../game/level/materials.js';
import { BIOMES } from '../game/level/biomes.js';
import { shadeChunk } from '../game/level/shade.js';
import { createField } from '../game/level/density.js';

const N = 16;
const rgba = f => { const a = new Uint8ClampedArray(N * N * 4); for (let i = 0; i < N * N; i++) { const v = f(i); a.set([v[0], v[1], v[2], 255], i * 4); } return a; };

test('every biome has two known materials', () => {
    for (const b of BIOMES) {
        const m = BIOME_MATERIALS[b.id];
        assert.ok(m && m.length === 2, b.id);
        for (const k of BIOME_INDEX[b.id]) assert.ok(k >= 0 && k < MATERIALS.length, `${b.id}: ${m}`);
    }
});

test('tile colour is relative to the mean, height is kept', () => {
    const t = prepareTile(rgba(i => (i % 2 ? [200, 100, 50] : [100, 50, 25])), rgba(i => [i % 256, 0, 0]), N);
    assert.equal(t.length, N * N * 4);
    // mean is 150/75/37.5 -> the bright pixel is 4/3 of it, the dark one 2/3
    assert.deepEqual([...t.subarray(4, 7)], [171, 171, 171]);
    assert.deepEqual([...t.subarray(0, 3)], [85, 85, 85]);
    assert.equal(t[7], 1);
});

test('very dark stone does not blow up noise', () => {
    const t = prepareTile(rgba(i => (i % 2 ? [8, 8, 8] : [4, 4, 4])), rgba(() => [0, 0, 0]), N);
    assert.ok(t[4] < 64, `dark stays dark (${t[4]})`);
});

test('shading with materials stays seamless and opaque', () => {
    const S = MAT.size, tile = new Uint8Array(S * S * 4);
    for (let i = 0; i < S * S; i++) tile.set([128 + (i * 7) % 60, 128, 128 - (i * 3) % 40, (i * 13) % 256], i * 4);
    setMaterials(MATERIALS.map(() => tile));
    assert.ok(materialTiles());
    const field = createField(1337);
    const a = shadeChunk(field, 1337, 0, 960, 960), b = shadeChunk(field, 1337, 960, 960, 960);
    setMaterials(null);
    let rock = 0;
    for (let i = 3; i < a.rock.length; i += 4) if (a.rock[i] === 255) rock++;
    assert.ok(rock > 1000, 'chunk has rock');
    // Left column of the right chunk continues the right column of the left one.
    const S2 = 640;
    let diff = 0, n = 0;
    for (let y = 0; y < S2; y++) {
        const p = (y * S2 + S2 - 1) * 4, q = y * S2 * 4;
        if (a.rock[p + 3] === 255 && b.rock[q + 3] === 255) { diff += Math.abs(a.rock[p] - b.rock[q]); n++; }
    }
    if (n) assert.ok(diff / n < 40, `seam step ${diff / n}`);
});
