import test from 'node:test';
import assert from 'node:assert/strict';
import { SUBZONES, zoneEdges, zoneMix, zoneValue, zoneKind, zonedBiome } from '../game/level/subzones.js';
import { BIOMES, floorY, zoneOpen, zonedBiomeAt } from '../game/level/biomes.js';
import { FIELD, createField } from '../game/level/density.js';

const islands = BIOMES.filter(b => b.zones);

test('every long island biome runs through several sub-zones of 15 000 to 25 000 px, neighbours of different kinds', () => {
    assert.ok(islands.length >= 6);
    for (const b of islands) {
        const edges = zoneEdges(b);
        assert.ok(edges.length >= 4, `${b.id}: ${edges.length} sub-zones`);
        let prev = 0, last = null;
        edges.forEach((e, k) => {
            if (k < edges.length - 1) assert.ok(e - prev >= SUBZONES.length[0] && e - prev <= SUBZONES.length[1], `${b.id} zone ${k}: ${Math.round(e - prev)}`);
            if (Math.min(e, b.width) - prev < SUBZONES.blend) return;      // a sliver left over at the biome's end
            const kind = zoneMix(b, b.from + (prev + Math.min(e, b.width)) / 2, {}).a;
            assert.ok(SUBZONES.kinds[kind], kind);
            assert.notEqual(kind, last, `${b.id}: two ${kind} in a row`);
            last = kind; prev = e;
        });
    }
    for (const b of BIOMES.filter(bi => !bi.zones)) assert.equal(zoneMix(b, b.from + b.width / 2), null);
});

test('the lagoon no longer looks the same for 80 000 px: seabed depth and growth change along it', () => {
    const beach = BIOMES.find(b => b.id === 'beach'), floors = new Set(), kinds = new Set();
    for (let x = 13500; x <= 93500; x += 4000) { floors.add(Math.round(floorY(x) / 40)); kinds.add(zonedBiomeAt(beach, x).subzone); }
    assert.ok(kinds.size >= 3, `kinds: ${[...kinds].join(', ')}`);
    assert.ok(floors.size >= 4, `distinct seabed depths: ${floors.size}`);
});

test('sub-zones blend: the seabed never steps, and nothing changes at a biome\'s ends or in the start lagoon', () => {
    for (const b of islands) {
        for (let x = b.from + 500; x < b.from + b.width - 500; x += 250) assert.ok(Math.abs(floorY(x + 250) - floorY(x)) < 120, `${b.id}: step at ${x}`);
        for (const x of [b.from + 1000, b.from + b.width - 1000]) assert.equal(zoneValue(zoneMix(b, x, {}), 'floor'), 0, `${b.id}: none at its end`);
    }
    for (const x of [-3000, 0, 4000, 9000]) { assert.equal(zoneOpen(x), 0); assert.equal(zonedBiomeAt(BIOMES[0], x), BIOMES[0]); }
    // In the middle of a blend both kinds count half.
    const b = islands[1], e = zoneEdges(b)[0], m = zoneMix(b, b.from + e, {});
    assert.notEqual(m.a, m.b);
    assert.ok(Math.abs(m.t - 0.5) < 1e-9);
});

test('a sub-zone changes what grows and lies there, within the biome\'s own things', () => {
    const beach = BIOMES.find(b => b.id === 'beach'), meadow = zonedBiome(beach, 'meadow'), flats = zonedBiome(beach, 'flats');
    assert.ok(meadow.props.seagrass > beach.props.seagrass && meadow.propRate > beach.propRate);
    assert.ok(flats.propRate < beach.propRate && flats.coral < beach.coral);
    assert.deepEqual(Object.keys(meadow.props).sort(), Object.keys(beach.props).sort(), 'no prop group a biome does not have');
    assert.equal(zonedBiome(beach, null), beach);
    assert.equal(zoneKind({ a: 'flats', b: 'meadow', t: 0.7, w: 1 }), 'meadow');
    assert.equal(zoneKind({ a: 'flats', b: 'meadow', t: 0.7, w: 0.2 }), null);
    for (const k of Object.values(SUBZONES.kinds)) assert.ok(Math.abs(k.floor) <= 350 && Math.abs(k.open) <= 0.12);
});

test('the calm route stays open through every sub-zone, and no nest sits on top of an outcrop', () => {
    const f = createField(1337);
    for (const b of islands) {
        for (let x = Math.max(0, b.from + 2000); x < b.from + b.width - 2000; x += 1500) assert.ok(f.density(x, f.routeY(x)) < FIELD.threshold, `${b.id}: route closed at ${x}`);
    }
    for (const n of f.nests) if (!n.grand && n.index > 0) assert.ok(floorY(n.x) - n.y < 700, `nest at ${Math.round(n.x)} lies high: ${Math.round(n.y)} over a seabed at ${Math.round(floorY(n.x))}`);
});
