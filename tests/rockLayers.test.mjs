import test from 'node:test';
import assert from 'node:assert/strict';
import { ROCK_LAYERS, SUPPORT, enclosure, layerField, layerChunkRect, LAYER_CHUNK } from '../game/level/rockLayerTable.js';
import { BIOMES } from '../game/level/biomes.js';
import { FIELD, createField } from '../game/level/density.js';

const T = FIELD.threshold;

test('two rock layers at different depths, nearer ones less fogged', () => {
    assert.ok(ROCK_LAYERS.length >= 2);
    const [a, b] = ROCK_LAYERS;
    assert.ok(a.s < b.s && a.fog > b.fog && a.depth < b.depth);
});

test('the open ocean has no rock behind it', () => {
    const blue = BIOMES.find(b => b.id === 'blue'), x = blue.from + blue.width / 2;
    for (const L of ROCK_LAYERS) {
        assert.equal(enclosure(x, L), -1);
        const f = layerField(createField(1337 + L.seed), L);
        for (let y = 0; y < 5000; y += 250) assert.ok(f.density(x, y) < T);
    }
});

test('enclosure varies: some stretches open, some closed', () => {
    for (const L of ROCK_LAYERS) {
        let lo = 0, hi = 0;
        for (let x = -8000; x < 70000; x += 400) { const e = enclosure(x, L); if (e < -0.3) lo++; if (e > 0.3) hi++; }
        assert.ok(lo > 5 && hi > 5, `${L.id}: open ${lo}, closed ${hi}`);
    }
});

test('background rock never floats: under rock it stays rock for the whole support reach', () => {
    const L = ROCK_LAYERS[1], f = layerField(createField(1337 + L.seed), L);
    let edges = 0;
    for (let x = 0; x < 20000; x += 700) {
        for (let y = 400; y < 4000; y += 40) {
            if (f.density(x, y) > T && f.density(x, y + 40) < T) {
                edges++;
            }
        }
    }
    // carried-down rock reaches the seabed in most columns: few bottom edges remain
    assert.ok(edges < 40, `bottom edges ${edges}`);
});

test('layer chunks map to a larger virtual world (farther = smaller)', () => {
    const r = layerChunkRect(ROCK_LAYERS[0], 2, 1);
    assert.equal(r.span, LAYER_CHUNK / ROCK_LAYERS[0].s);
    assert.equal(r.ox, 2 * r.span);
});
