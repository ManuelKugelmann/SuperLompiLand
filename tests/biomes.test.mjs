import test from 'node:test';
import assert from 'node:assert/strict';
import {
    BIOMES, WORLD_WEST, WORLD_END, ABYSS, SHORE, surfAt, biomeIndexAt, biomeBlendAt, mixColor, floorY, pickWeighted, spotFor
} from '../game/level/biomes.js';

test('biomes are ordered west to east and every table is complete', () => {
    for (let i = 1; i < BIOMES.length; i++) assert.ok(BIOMES[i].from > BIOMES[i - 1].from);
    assert.equal(BIOMES[0].from, WORLD_WEST);
    assert.equal(WORLD_END, BIOMES.at(-1).from + BIOMES.at(-1).width);
    for (let i = 1; i < BIOMES.length; i++) assert.equal(BIOMES[i].from, BIOMES[i - 1].from + BIOMES[i - 1].width, 'no gaps');
    assert.ok(WORLD_END - WORLD_WEST >= 80000, 'a big world');
    for (const b of BIOMES) {
        assert.equal(b.rock.length, 5, `${b.id}: five rock bands`);
        assert.equal(b.water.length, 2, `${b.id}: water tint`);
        assert.ok(b.name.de && b.name.en, `${b.id}: both languages`);
        for (const key of ['open', 'coral', 'kelp', 'coins', 'friendRate', 'hazardRate']) assert.equal(typeof b[key], 'number', `${b.id}.${key}`);
    }
});

test('friends are never listed as hazards', () => {
    for (const b of BIOMES) {
        for (const key of Object.keys(b.friends)) assert.ok(!(key in b.hazards), `${b.id}: ${key} is both`);
        assert.ok(!('urchin' in b.hazards) && !('enemy_angler' in b.hazards), `${b.id}: urchin/angler are friends`);
    }
    assert.equal(BIOMES[0].hazardRate, 0, 'the beach is safe');
    for (const b of BIOMES) for (const key of Object.keys(b.hazards)) assert.ok(!/barrel|claw|robot/.test(key), `${b.id}: no machine characters (${key})`);
    assert.ok(ABYSS.x > BIOMES.at(-1).from && ABYSS.x < WORLD_END, 'the abyss lies in the last biome');
});

test('biomeIndexAt picks the biome containing x', () => {
    assert.equal(biomeIndexAt(WORLD_WEST - 5000), 0);
    assert.equal(biomeIndexAt(0), BIOMES.findIndex(b => b.id === 'reef'));
    assert.equal(biomeIndexAt(WORLD_END + 5000), BIOMES.length - 1);
});

test('biome blending is continuous across a border', () => {
    const border = BIOMES[2].from;
    let prev = null;
    for (let x = border - 900; x <= border + 900; x += 25) {
        const { a, b, t } = biomeBlendAt(x);
        assert.ok(t >= 0 && t <= 1);
        const open = a.open + (b.open - a.open) * t;
        if (prev !== null) assert.ok(Math.abs(open - prev) < 0.02, `jump at x=${x}`);
        prev = open;
    }
});

test('mixColor interpolates per channel and clamps t', () => {
    assert.equal(mixColor(0x000000, 0xffffff, 0), 0x000000);
    assert.equal(mixColor(0x000000, 0xffffff, 1), 0xffffff);
    assert.equal(mixColor(0x000000, 0xffffff, 2), 0xffffff);
    assert.equal(mixColor(0x102030, 0x304050, 0.5), 0x203040);
});

test('the seabed never rises toward the east, and the abyss is by far the deepest place', () => {
    let prev = floorY(WORLD_WEST);
    for (let x = WORLD_WEST; x < ABYSS.x - ABYSS.halfWidth * 3; x += 200) {
        assert.ok(floorY(x) >= prev - 1e-6);
        prev = floorY(x);
    }
    assert.ok(floorY(ABYSS.x) > floorY(ABYSS.x - 5000) + ABYSS.depth * 0.9);
});

test('the beach rises out of the water in the west and the surf runs higher there', () => {
    assert.ok(floorY(SHORE - 200) < 0, 'dry sand west of the shore line');
    assert.ok(floorY(BIOMES[1].from) > 1000, 'deep again where the reef begins');
    assert.equal(surfAt(BIOMES[1].from + 500), 1);
    assert.ok(surfAt(SHORE) > 2);
});

test('pickWeighted respects weights, skips missing art and handles empty tables', () => {
    const rng = { frac: () => 0.999 };
    assert.equal(pickWeighted(rng, { a: 1, b: 3 }, () => true), 'b');
    assert.equal(pickWeighted({ frac: () => 0 }, { a: 1, b: 3 }, () => true), 'a');
    assert.equal(pickWeighted(rng, { a: 1, b: 3 }, key => key === 'a'), 'a');
    assert.equal(pickWeighted(rng, {}, () => true), null);
    assert.equal(pickWeighted(rng, { a: 1 }, () => false), null);
});

test('named spots for screenshots: biome ids, the abyss, plain coordinates', () => {
    assert.deepEqual(spotFor('1200,-340'), { x: 1200, y: -340 });
    assert.equal(spotFor('nowhere'), null);
    assert.equal(spotFor(undefined), null);
    for (const b of BIOMES) {
        const p = spotFor(b.id);
        assert.equal(biomeIndexAt(p.x), BIOMES.indexOf(b), b.id);
        assert.ok(p.y >= 400 && p.y < floorY(p.x), `${b.id}: above the seabed`);
    }
    const deep = spotFor('abyss');
    assert.ok(Math.abs(deep.x - ABYSS.x) < 1 && deep.y > 6000);
});
