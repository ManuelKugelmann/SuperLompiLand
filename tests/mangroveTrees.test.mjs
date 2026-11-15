import test from 'node:test';
import assert from 'node:assert/strict';
import { MANGROVE_TREES, mangroveTrees, fitTree } from '../game/level/mangroveTrees.js';
import { BIOMES } from '../game/level/biomes.js';

test('the mangrove has its trees, inside the biome, spaced as asked, the same every time', () => {
    const b = BIOMES.find(bm => bm.id === 'mangrove'), trees = mangroveTrees(1337);
    assert.ok(trees.length > 10, `${trees.length} trees`);
    for (const t of trees) {
        assert.ok(t.x >= b.from + MANGROVE_TREES.edge && t.x < b.from + b.width - MANGROVE_TREES.edge);
        assert.ok(t.art >= 1 && t.art <= MANGROVE_TREES.arts);
    }
    for (let i = 1; i < trees.length; i++) {
        const d = trees[i].x - trees[i - 1].x;
        assert.ok(d >= MANGROVE_TREES.gap[0] - 1e-6 && d <= MANGROVE_TREES.gap[1] + 1e-6);
    }
    assert.deepEqual(mangroveTrees(1337), trees);
    assert.ok(new Set(trees.map(t => t.art)).size > 1 && new Set(trees.map(t => t.flip)).size > 1, 'varied');
});

test('a tree is fitted so its waterline lies on the surface and its roots reach into the mud', () => {
    const anchors = { size: [2048, 1518], waterline: 566, trunk: 1047, mud: 1499 };
    const f = fitTree(anchors, 1050);
    assert.ok(Math.abs(f.originY - 566 / 1518) < 1e-9 && Math.abs(f.originX - 1047 / 2048) < 1e-9);
    assert.ok(Math.abs((anchors.mud - anchors.waterline) * f.scale - (1050 + MANGROVE_TREES.bury)) < 1e-6, 'the mud row lands in the ground');
});
