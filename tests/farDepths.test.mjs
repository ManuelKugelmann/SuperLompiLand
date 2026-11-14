import test from 'node:test';
import assert from 'node:assert/strict';
import { FAR, FAR_KINDS, farCell, farBaseY, farLook, worldXFor } from '../game/level/farDepths.js';
import { BIOMES, floorY } from '../game/level/biomes.js';
import { rng, mix } from '../game/level/layerMath.js';

const W = 1920, H = 1080;

test('every biome has far scenery; the open ocean stays empty', () => {
    for (const b of BIOMES) assert.ok(FAR_KINDS[b.id], b.id);
    assert.equal(FAR_KINDS.blue.per, 0);
    const blue = BIOMES.find(b => b.id === 'blue');
    for (let di = 0; di < FAR.depths.length; di++) {
        const s = FAR.depths[di], ci = Math.floor(((blue.from + blue.width / 2 - W / 2) * s + W / 2) / FAR.cell);
        assert.equal(farCell(di, ci, W).length, 0, `depth ${s}`);
    }
});

test('many individual depths, far ones smaller, softer and hazier', () => {
    assert.ok(FAR.depths.length >= 6);
    for (let i = 1; i < FAR.depths.length; i++) assert.ok(FAR.depths[i] > FAR.depths[i - 1]);
    const reef = BIOMES.find(b => b.id === 'reef');
    const near = farLook(FAR.depths.at(-1), reef), far = farLook(FAR.depths[0], reef);
    assert.ok(far.alpha < near.alpha);
});

test('cells are deterministic and objects stay inside their cell', () => {
    for (let ci = 0; ci < 40; ci++) {
        const a = farCell(3, ci, W), b = farCell(3, ci, W);
        assert.deepEqual(a.map(o => [o.key, o.lx, o.w]), b.map(o => [o.key, o.lx, o.w]));
        for (const o of a) assert.ok(o.lx >= ci * FAR.cell && o.lx <= (ci + 1) * FAR.cell);
    }
});

test('only loaded textures are used', () => {
    for (let ci = 0; ci < 40; ci++) for (const o of farCell(5, ci, W, 1337, k => k.startsWith('boulder'))) assert.ok(o.key.startsWith('boulder'));
});

test('the far seabed follows the real one at depth 1 and the horizon at depth 0', () => {
    assert.equal(farBaseY(5000, 1, H), floorY(5000));
    assert.equal(farBaseY(5000, 0, H), H * FAR.horizon);
    assert.equal(worldXFor(W / 2, 0.5, W), W / 2);
});

test('rng is deterministic and mix blends colours', () => {
    const a = rng(7), b = rng(7);
    assert.equal(a(), b());
    assert.equal(mix(0x000000, 0xffffff, 0.5), 0x808080);
    assert.equal(mix(0x123456, 0xabcdef, 0), 0x123456);
});
