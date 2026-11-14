import test from 'node:test';
import assert from 'node:assert/strict';
import { BIOMES, WATER_LIGHT, atLuma, waterHue } from '../game/level/biomes.js';

const luma = c => 0.299 * ((c >> 16) & 255) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255);

test('every biome water hue has the same brightness (darkness only by depth)', () => {
    for (const b of BIOMES) {
        const c = waterHue(b.from + b.width / 2);
        assert.ok(Math.abs(luma(c) - WATER_LIGHT.luma) < 4, `${b.id}: ${luma(c).toFixed(1)}`);
    }
});

test('the hue is kept: a dark violet stays violet, a green stays green', () => {
    const v = atLuma(0x1a0f4a), g = atLuma(0x2f9a5c);
    assert.ok((v & 255) > ((v >> 8) & 255), 'violet: more blue than green');
    assert.ok(((g >> 8) & 255) > ((g >> 16) & 255), 'green: more green than red');
});
