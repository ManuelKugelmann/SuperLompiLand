import test from 'node:test';
import assert from 'node:assert/strict';
import { DEPTH, bandOf, behindSurface } from '../game/depths.js';
import { NEAR_COAST } from '../game/level/skyline.js';

test('the bands follow one another without a gap, back to front', () => {
    for (let i = 1; i < DEPTH.bands.length; i++) assert.equal(DEPTH.bands[i].from, DEPTH.bands[i - 1].to, DEPTH.bands[i].id);
    assert.equal(new Set(DEPTH.bands.map(b => b.id)).size, DEPTH.bands.length);
    assert.equal(bandOf(-31), null);
    assert.equal(bandOf(1e6), 'overlay');
});

test('the waterline: land is sky behind the sea fill, its rock foot shows through the water, the wave line is in front of the play plane', () => {
    assert.equal(bandOf(DEPTH.coast), 'sky');
    assert.equal(bandOf(DEPTH.seaFill), 'seaFill');
    assert.equal(bandOf(DEPTH.socket), 'sockets');
    assert.equal(bandOf(DEPTH.surfaceLine), 'surfaceLine');
    assert.ok(DEPTH.coast < DEPTH.seaFill && DEPTH.seaFill < DEPTH.socket && DEPTH.socket < DEPTH.surfaceLine);
    assert.ok(NEAR_COAST.scroll < 1, 'a coast moves slower than the play plane');
});

test('what stands in the water keeps behind the surface line; surf and weather may be in front', () => {
    for (const d of [2, 2.4, 3, 4.3, 4.5, 4.8]) assert.equal(behindSurface(d), true);      // arch, containers, quay, seal, gannets, raft
    assert.equal(behindSurface(6.05), false);
    assert.equal(bandOf(4.6), 'player');
    assert.equal(bandOf(3.6), 'creatures');
    assert.equal(bandOf(40), 'light');
});
