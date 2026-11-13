import test from 'node:test';
import assert from 'node:assert/strict';
import { ridge, layerGroundY, tileOffsetX, mix, layerTint } from '../game/level/backLayersMath.js';
import { BACK_LAYERS, BACK_KINDS, kindFor } from '../game/level/backLayersTable.js';
import { BIOMES } from '../game/level/biomes.js';

test('ridgelines tile seamlessly and stay in range', () => {
    for (let s = 1; s < 20; s++) {
        const r = ridge(512, s);
        for (const v of r) assert.ok(v >= 0 && v <= 1);
        const step = Math.abs(r[0] - r[511]);
        let maxStep = 0;
        for (let i = 1; i < 512; i++) maxStep = Math.max(maxStep, Math.abs(r[i] - r[i - 1]));
        assert.ok(step <= maxStep * 1.5 + 1e-6, `seed ${s}: wrap step ${step.toFixed(4)} vs inner ${maxStep.toFixed(4)}`);
    }
    assert.deepEqual(ridge(64, 3), ridge(64, 3));
});

test('far layers move less than near ones, vertically too', () => {
    const at = (camY, scroll) => layerGroundY({ camY, H: 1080, floor: 2000, scroll });
    const farMove = at(500, 0.08) - at(900, 0.08), nearMove = at(500, 0.45) - at(900, 0.45);
    assert.ok(nearMove > farMove && farMove > 0);
    assert.ok(tileOffsetX(1000, 0.45, 1) > tileOffsetX(1000, 0.08, 1));
});

test('a layer never rises above the water surface on screen', () => {
    const y = layerGroundY({ camY: -200, H: 1080, floor: 300, scroll: 0.25, rise: 2000 });
    assert.ok(y >= 200 + 140);
});

test('fog pulls the rock colour toward the water; deep pulls toward the deep colour', () => {
    assert.equal(mix(0x000000, 0xffffff, 0.5), 0x808080);
    assert.equal(layerTint(0x806040, 0x3fd0e8, 0), 0x806040);
    assert.equal(layerTint(0x806040, 0x3fd0e8, 1), 0x3fd0e8);
    assert.equal(layerTint(0x806040, 0x3fd0e8, 0, 0x04122e, 1), 0x04122e);
});

test('layer table: far to near, fog falls and scroll rises; every biome has a shape kind', () => {
    for (let i = 1; i < BACK_LAYERS.length; i++) {
        assert.ok(BACK_LAYERS[i].scroll > BACK_LAYERS[i - 1].scroll);
        assert.ok(BACK_LAYERS[i].fog < BACK_LAYERS[i - 1].fog);
        assert.ok(BACK_LAYERS[i].scroll < 1, 'background only');
    }
    for (const b of BIOMES) assert.ok(BACK_KINDS[kindFor(b.id)], `${b.id} has a kind`);
});

import { noise1, groundLine } from '../game/level/backLayersMath.js';

test('ground line is continuous across chunk borders and stays in range', () => {
    let maxStep = 0;
    for (let x = -5000; x < 5000; x += 1) {
        const a = groundLine(x, 3), b = groundLine(x + 1, 3);
        assert.ok(a >= 0 && a <= 1);
        maxStep = Math.max(maxStep, Math.abs(b - a));
    }
    assert.ok(maxStep < 0.02, `no jumps (${maxStep.toFixed(4)})`);
    assert.equal(noise1(1024, 5), noise1(1024, 5));
});
