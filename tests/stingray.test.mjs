import test from 'node:test';
import assert from 'node:assert/strict';
import { STINGRAY, rayStart, rayGlide } from '../game/level/stingray.js';
import { BIOMES } from '../game/level/biomes.js';

test('it first lies in the lagoon, and all its glides stay there', () => {
    const b = BIOMES.find(x => x.id === STINGRAY.biome), x = rayStart();
    assert.ok(x > b.from && x + STINGRAY.glide * STINGRAY.rests < b.from + b.width);
});

test('a glide goes forward, rises and lands, then the ray settles under the sand', () => {
    const x0 = 1000;
    assert.equal(rayGlide(x0, 0).x, x0);
    assert.equal(rayGlide(x0, 0).lift, 0);
    assert.ok(rayGlide(x0, STINGRAY.glideS / 2).lift > STINGRAY.lift * 0.9);
    const end = rayGlide(x0, STINGRAY.glideS);
    assert.equal(end.x, x0 + STINGRAY.glide);
    assert.ok(end.lift < 1e-6 && !end.done);
    const settled = rayGlide(x0, STINGRAY.glideS + STINGRAY.settleS);
    assert.ok(settled.done && settled.buried > 0.5);
});
