import test from 'node:test';
import assert from 'node:assert/strict';
import { ROCK_LAYERS, SUPPORT, enclosure, wallShare, layerField, lowPass, layerChunkRect, fogLayer, LAYER_CHUNK } from '../game/level/rockLayerTable.js';
import { BIOMES, BLEND } from '../game/level/biomes.js';
import { FIELD, createField } from '../game/level/density.js';

const T = FIELD.threshold;
const biome = id => BIOMES.find(b => b.id === id);

test('two rock layers at different depths, nearer ones less fogged', () => {
    assert.ok(ROCK_LAYERS.length >= 2);
    const [a, b] = ROCK_LAYERS;
    assert.ok(a.s < b.s && a.fog > b.fog && a.depth < b.depth);
});

test('every biome has a closed share; the open ocean is all open', () => {
    for (const b of BIOMES) assert.ok(b.rockWall >= 0 && b.rockWall <= 1, b.id);
    const blue = biome('blue'), x = blue.from + blue.width / 2;
    assert.equal(wallShare(x), 0);
    for (const L of ROCK_LAYERS) {
        assert.equal(enclosure(x, L), -1);
        const f = layerField(createField(1337 + L.seed), L);
        for (let y = 0; y < 5000; y += 250) assert.ok(f.density(x, y) < T);
    }
});

test('closed share per biome: islands stand in front of their rock socket, the open sea is clear, the trench walled', () => {
    const closed = id => {
        const b = biome(id);
        let n = 0, k = 0;
        for (let x = b.from + BLEND + 600; x < b.from + b.width - BLEND - 600; x += 97) { if (enclosure(x, ROCK_LAYERS[0]) > 0) k++; n++; }
        return k / n;
    };
    for (const id of ['beach', 'mangrove', 'reef']) assert.ok(closed(id) > 0.6, `${id} ${closed(id)}`);
    assert.ok(closed('trench') > 0.4, `trench ${closed('trench')}`);
    // An island's flank stands in front of its rock socket (no far view); the open sea has none (spec 5.0c).
    assert.ok(closed('kelp') > 0.5);
    assert.equal(closed('blue'), 0);
    assert.equal(closed('wreck'), 0);
});

test('near walls are rarer than mid walls', () => {
    let mid = 0, near = 0;
    for (let x = BIOMES[0].from; x < BIOMES.at(-1).from + BIOMES.at(-1).width; x += 97) {
        if (enclosure(x, ROCK_LAYERS[0]) > 0) mid++;
        if (enclosure(x, ROCK_LAYERS[1]) > 0) near++;
    }
    assert.ok(near <= mid, `${near} ${mid}`);
});

test('the low pass keeps the field continuous and smooth', () => {
    const f = lowPass(createField(1337), SUPPORT.grid);
    for (let x = 1000; x < 3000; x += 37) {
        const a = f.density(x, 1500), b = f.density(x + 1, 1500);
        assert.ok(Math.abs(a - b) < 0.05);
    }
});

test('background rock never floats: it reaches the seabed in most columns', () => {
    const L = ROCK_LAYERS[0], f = layerField(createField(1337 + L.seed), L);
    let edges = 0;
    for (let x = 0; x < 20000; x += 700) {
        for (let y = 400; y < 4000; y += 40) if (f.density(x, y) > T && f.density(x, y + 40) < T) edges++;
    }
    assert.ok(edges < 40, `bottom edges ${edges}`);
});

test('fog lifts the darkest values toward the water and keeps the alpha', () => {
    const S = 4, rgba = new Uint8ClampedArray(S * S * 4);
    for (let i = 0; i < S * S; i++) rgba.set([0, 0, 0, 255], i * 4);
    fogLayer(rgba, S, 2000, 1000, 1000, ROCK_LAYERS[0]);
    assert.ok(rgba[0] + rgba[1] + rgba[2] > 30);
    assert.equal(rgba[3], 255);
});

test('layer chunks map to a larger virtual world (farther = smaller)', () => {
    const r = layerChunkRect(ROCK_LAYERS[0], 2, 1);
    assert.equal(r.span, LAYER_CHUNK / ROCK_LAYERS[0].s);
    assert.equal(r.ox, 2 * r.span);
});

test('the near layer keeps the calm route free', () => {
    const main = createField(1337), near = ROCK_LAYERS.find(l => l.clearRoute);
    const f = layerField(createField(1337 + near.seed), near, { route: x => main.routeY(x) });
    for (let x = 0; x < 60000; x += 900) {
        const y = main.routeY(x);
        for (const dy of [-200, 0, 200]) assert.ok(f.density(x, y + dy) < T, `rock on the route at ${x},${y + dy}`);
    }
});

test('no stacks of chips: below rock the carried foot is one piece (no gaps on the way down)', () => {
    for (const L of ROCK_LAYERS) {
        const f = layerField(createField(1337 + L.seed), L);
        // A stack of chips shows as short water gaps under rock in a column (real caves are taller).
        let chips = 0;
        for (let x = -6000; x < 64000; x += 410) {
            let seen = false, gapAt = -1;
            for (let y = 300; y < 5200; y += 30) {
                const solid = f.density(x, y) > T;
                if (solid && gapAt >= 0 && y - gapAt < 300) chips++;
                if (solid) { seen = true; gapAt = -1; } else if (seen && gapAt < 0) gapAt = y;
            }
        }
        assert.ok(chips < 12, `${L.id}: ${chips} short gaps under rock`);
    }
});

test('no layer rock at the water surface (it would be cut straight at the water line)', () => {
    for (const L of ROCK_LAYERS) {
        const f = layerField(createField(1337 + L.seed), L);
        for (let x = -6000; x < 64000; x += 300) assert.ok(f.density(x, 60) < T, `${L.id} at ${x}`);
    }
});

test('nothing hangs below the cleared bands: rock always reaches down to more rock or the seabed', () => {
    const main = createField(1337);
    for (const L of ROCK_LAYERS) {
        const f = layerField(createField(1337 + L.seed), L, { route: x => main.routeY(x) });
        let floating = 0;
        for (let x = -6000; x < 64000; x += 470) {
            for (let y = 300; y < 4600; y += 40) {
                if (!(f.density(x, y) > T && f.density(x, y + 40) < T)) continue;      // a rock bottom edge
                // water below it: does rock come again further down (a real cave), or never (floating)?
                let again = false;
                for (let yy = y + 80; yy < 6000; yy += 80) if (f.density(x, yy) > T) { again = true; break; }
                if (!again) floating++;
            }
        }
        assert.ok(floating < 6, `${L.id}: ${floating} rock bottoms with only water below`);
    }
});
