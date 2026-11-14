import test from 'node:test';
import assert from 'node:assert/strict';
import { ROCK_LAYERS, SUPPORT, enclosure, wallShare, layerField, lowPass, layerChunkRect, fogLayer, LAYER_CHUNK, lipLayer, LIP } from '../game/level/rockLayerTable.js';
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

test('the rock behind the play plane gets a top skin on its upward edges, in the biome\'s top colour', () => {
    const S = 16, rgba = new Uint8ClampedArray(S * S * 4);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const o = (y * S + x) * 4; if (y >= 6) { rgba[o] = rgba[o + 1] = rgba[o + 2] = 60; rgba[o + 3] = 255; } }
    const reef = BIOMES.find(b => b.id === 'reef');
    lipLayer(rgba, S, reef.from + reef.width / 2, 0, 160, { ...LIP, texels: [3, 4], ao: [1, 0], strata: [0, 300], specks: 0, patches: 0 });
    const at = (x, y) => rgba[(y * S + x) * 4 + 1];
    assert.ok(at(8, 6) > 120, `edge ${at(8, 6)}`);           // the edge takes on the moss green
    assert.equal(at(8, 15), 60);                               // deep inside unchanged
    assert.equal(rgba[(2 * S + 8) * 4 + 3], 0);                // open water stays open
});

test('the trench wall stands behind the descent below its rim, has windows, and opens before the grand nest', async () => {
    const { trenchWallAt, TRENCH_WALL } = await import('../game/level/rockLayerTable.js');
    const { WORLD_END } = await import('../game/level/biomes.js');
    const { descentStart } = await import('../game/level/setPieces.js');
    const route = x => 1000 + (x - descentStart()) / 30;
    const x0 = descentStart() + TRENCH_WALL.fadeIn, x1 = WORLD_END - TRENCH_WALL.reveal[0];
    let solid = 0, open = 0, n = 0;
    for (let x = x0; x < x1; x += 211) {
        const below = trenchWallAt(x, route(x) + 600, route);
        if (below > 0.99) solid++; else if (below < 0.01) open++;
        n++;
        assert.equal(trenchWallAt(x, route(x) - TRENCH_WALL.above[1] - TRENCH_WALL.rough - TRENCH_WALL.edge, route), 0);   // open water above the rim
    }
    assert.ok(solid / n > 0.55, `mostly wall (${solid}/${n})`);
    assert.ok(open > 0, 'some windows');
    for (const x of [descentStart() - 10, WORLD_END - TRENCH_WALL.reveal[1] + 10, WORLD_END - 100]) assert.equal(trenchWallAt(x, route(x) + 600, route), 0);
    // Only the layer that carries it shows it, as rock.
    const L = ROCK_LAYERS.find(l => l.trenchWall), f = layerField(createField(1337 + L.seed), L, { route });
    let x = x0; while (trenchWallAt(x, route(x) + 600, route) < 0.99) x += 97;
    assert.ok(f.density(x, route(x) + 600) > T);
});

test('layer chunks meet without a seam: baked with their neighbours\' rock, edge columns continue', async () => {
    const { layerPicture, LAYER_SHADE } = await import('../game/level/rockLayerTable.js');
    const L = ROCK_LAYERS[0], f = layerField(createField(1337 + L.seed), L), S = LAYER_SHADE.rockSize;
    // A chunk of the lagoon's back rock (x about 37 000) and its right and lower neighbours: without the margin its borders stepped by 25.
    const cx = 23, cy = 0, a = layerPicture(f, 1337 + L.seed, L, cx, cy), r = layerPicture(f, 1337 + L.seed, L, cx + 1, cy), d = layerPicture(f, 1337 + L.seed, L, cx, cy + 1);
    const px = (img, x, y) => [0, 1, 2, 3].map(c => img[(y * S + x) * 4 + c]);
    let worst = 0, n = 0;
    for (let i = 0; i < S; i++) {
        for (const [p, q, p2] of [[px(a, S - 1, i), px(r, 0, i), px(a, S - 2, i)], [px(a, i, S - 1), px(d, i, 0), px(a, i, S - 2)]]) {
            if (p[3] < 255 || q[3] < 255 || p2[3] < 255) continue;
            // The step across the border is no bigger than a step inside the chunk (plus a little).
            for (let c = 0; c < 3; c++) worst = Math.max(worst, Math.abs(p[c] - q[c]) - Math.abs(p[c] - p2[c]));
            n++;
        }
    }
    assert.ok(n > 40, `border texels with rock (${n})`);
    assert.ok(worst < 14, `largest extra step at a chunk border: ${worst}`);
});

test('no rock floats in a layer: small pieces that touch no edge are dropped, rock reaching an edge stays', async () => {
    const { dropLooseRock, LOOSE_ROCK } = await import('../game/level/rockLayerTable.js');
    const S = 100, img = new Uint8ClampedArray(S * S * 4);
    const fill = (x0, y0, x1, y1) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) img[(y * S + x) * 4 + 3] = 255; };
    fill(10, 60, 90, 100);      // ground, reaching the bottom edge
    fill(40, 20, 52, 26);       // a small slab hanging in the water
    dropLooseRock(img, S);
    assert.equal(img[(23 * S + 45) * 4 + 3], 0, 'the floating slab is gone');
    assert.equal(img[(80 * S + 50) * 4 + 3], 255, 'the ground stays');
    assert.ok(LOOSE_ROCK.minArea > 72);
    // Over a stretch of trench and lagoon, every remaining piece in the layer pictures reaches an edge or is big.
    const { layerPicture, LAYER_SHADE } = await import('../game/level/rockLayerTable.js');
    const L = ROCK_LAYERS[0], f = layerField(createField(1337 + L.seed), L, { route: x => createField(1337).routeY(x) }), P = LAYER_SHADE.rockSize;
    for (const [cx, cy] of [[23, 0], [538, 1], [538, 2]]) {
        const pic = layerPicture(f, 1337 + L.seed, L, cx, cy), copy = pic.slice();
        dropLooseRock(copy, P, { ...LOOSE_ROCK, minArea: LOOSE_ROCK.minArea });
        // (Inside a cropped picture a piece may touch its border because it goes on in the neighbour: only fully enclosed small ones would be loose.)
        let changed = 0; for (let i = 3; i < pic.length; i += 4) if (pic[i] !== copy[i]) changed++;
        assert.ok(changed < 40, `chunk ${cx},${cy}: ${changed} texels of loose rock left`);
    }
});
