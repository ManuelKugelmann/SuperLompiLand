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

test('neighbouring biomes differ by hue (>= 25 deg) or clearly by saturation', async () => {
    const { WATER_HUES } = await import('../game/level/biomes.js');
    const ids = BIOMES.map(b => b.id).filter(id => WATER_HUES[id]);
    for (let i = 1; i < ids.length; i++) {
        const [h0, s0] = WATER_HUES[ids[i - 1]], [h1, s1] = WATER_HUES[ids[i]];
        const dh = Math.min(Math.abs(h0 - h1), 360 - Math.abs(h0 - h1));
        assert.ok(dh >= 25 || Math.abs(s0 - s1) >= 0.25, `${ids[i - 1]} -> ${ids[i]}: ${dh} deg, sat ${s0} vs ${s1}`);
    }
});
