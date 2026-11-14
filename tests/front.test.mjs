import test from 'node:test';
import assert from 'node:assert/strict';
import { FRONT, frontSlot } from '../game/level/front.js';
import { BIOMES } from '../game/level/biomes.js';
import { FIELD, createField } from '../game/level/density.js';
import { rescueSpots } from '../game/rescues.js';
import { worldMap, SET_PIECE_KINDS } from '../game/level/worldMap.js';

const s = frontSlot(), f = createField(1337);

test('the ocean front has a clear stretch of the calm route in the mangroves', () => {
    const b = BIOMES.find(bi => bi.id === FRONT.biome);
    assert.ok(s && s.x1 - s.x0 === FRONT.length && s.x === (s.x0 + s.x1) / 2);
    assert.ok(s.x0 > b.from + 6000 && s.x1 < b.from + b.width - 6000, `${s.x0} .. ${s.x1}`);
    for (let x = s.x0; x <= s.x1; x += 250) {
        const y = f.routeY(x);
        assert.ok(f.density(x, y) < FIELD.threshold, 'the route is open');
        for (let yy = 80; yy < y; yy += 80) assert.ok(f.density(x, yy) < FIELD.threshold, `open water from the surface down to the route at ${x}, ${yy}`);
    }
});

test('no nest, rescue, friend or set piece lies in it, and it is on the world map', () => {
    const clear = (x0, x1, what) => assert.ok(x1 < s.x0 - FRONT.keep + 1 || x0 > s.x1 + FRONT.keep - 1, what);
    for (const n of f.nests) clear(n.x, n.x, `nest at ${Math.round(n.x)}`);
    for (const r of rescueSpots()) clear(r.x, r.x, r.id);
    const map = worldMap();
    assert.ok(map.features.some(ft => ft.kind === 'front' && ft.x0 === s.x0 && ft.x1 === s.x1));
    for (const ft of map.features) if (SET_PIECE_KINDS.includes(ft.kind) && ft.kind !== 'front') clear(ft.x0, ft.x1, ft.kind);
});
