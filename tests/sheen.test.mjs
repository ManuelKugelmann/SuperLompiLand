import test from 'node:test';
import assert from 'node:assert/strict';
import { SHEEN, sheenTint, sheenHue, sheenFor } from '../game/rig/sheen.js';

const rgb = c => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

test('no sheen leaves the shading grey; a strong sheen colours but stays pastel', () => {
    assert.deepEqual(rgb(sheenTint(0.8, 0.3, 0)), [204, 204, 204]);
    for (let h = 0; h < 1; h += 0.05) {
        const c = rgb(sheenTint(1, h, 1));
        assert.ok(Math.min(...c) >= Math.floor(255 * SHEEN.floor) && Math.max(...c) - Math.min(...c) > 40, `pastel rainbow at ${h}: ${c}`);
    }
});

test('the colour runs through the rainbow as the card turns', () => {
    const at = nx => rgb(sheenTint(1, sheenHue(nx, 0, 0, 0, 0), 1));
    const dominant = c => c.indexOf(Math.max(...c));
    const seen = new Set();
    for (let nx = -1; nx <= 1; nx += 0.05) seen.add(dominant(at(nx)));
    assert.equal(seen.size, 3, 'red, green and blue each lead somewhere across a turn');
});

test('fins shimmer more than the body; heads stay clean', () => {
    assert.ok(sheenFor('pectoral') > sheenFor(null) * 4);
    assert.equal(sheenFor('head'), 0);
});
