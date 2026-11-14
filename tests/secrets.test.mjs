import test from 'node:test';
import assert from 'node:assert/strict';
import { SECRETS, secretSpots, countIn, placeSecret } from '../game/level/secrets.js';
import { BIOMES } from '../game/level/biomes.js';

test('three pearls in every area, each inside its area, ids unique', () => {
    const s = secretSpots();
    assert.equal(s.length, BIOMES.length * SECRETS.at.length);
    assert.equal(new Set(s.map(p => p.id)).size, s.length);
    for (const p of s) { const b = BIOMES.find(x => x.id === p.biome); assert.ok(p.x > b.from && p.x < b.from + b.width); }
    assert.equal(secretSpots({ ...SECRETS, enabled: false }).length, 0);
});

test('the count per area', () => {
    assert.deepEqual(countIn('reef', new Set(['reef:0', 'reef:2', 'kelp:1'])), { found: 2, total: 3 });
});

test('a pearl lies on seabed within reach, searching outward when the seabed right there is too deep', () => {
    const route = () => 500;
    assert.deepEqual(placeSecret(1000, () => 1200, route), { x: 1000, y: 1200 });
    const deepHere = x => (Math.abs(x - 1000) < 400 ? 3000 : 1300);
    const p = placeSecret(1000, deepHere, route);
    assert.ok(p && Math.abs(p.x - 1000) >= 400 && p.y === 1300);
    assert.equal(placeSecret(1000, () => null, route), null);
});
