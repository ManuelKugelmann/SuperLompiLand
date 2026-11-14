import test from 'node:test';
import assert from 'node:assert/strict';
import {
    BIOMES, WORLD_WEST, WORLD_END, ABYSS, SHORE, SEABED, isSea, dropOffView, surfAt, biomeIndexAt, biomeBlendAt, mixColor, floorY, pickWeighted, spotFor, landmarkGroup, LANDMARK, dropOffShare, wallLifeAt
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
    assert.equal(BIOMES[biomeIndexAt(0)].id, 'beach', 'the journey starts in the shallow lagoon');
    assert.deepEqual(BIOMES.slice(1, 3).map(b => b.id), ['mangrove', 'reef'], 'then mangroves and the coral reef');
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

test('an island chain: coasts are shallow, the open sea between them is deep, and the abyss is by far the deepest place', () => {
    const zones = BIOMES.map(b => b.zone);
    assert.deepEqual(zones.slice(0, 3), ['island', 'island', 'island'], 'the home island: lagoon, mangroves, reef');
    assert.equal(zones.at(-1), 'sea');
    for (let i = 3; i < zones.length - 1; i++) assert.ok(zones[i] !== zones[i + 1] || zones[i] === 'island', 'two seas never touch: there is always an island between');
    for (const b of BIOMES) {
        const mid = floorY(b.from + b.width / 2);
        if (b.id === 'beach' || b.id === 'trench') continue;      // the lagoon rises to the shore; the trench holds the abyss
        assert.ok(b.zone === 'sea' ? mid > 4000 : mid < 2400, `${b.id}: ${Math.round(mid)}`);
        assert.equal(isSea(b.from + b.width / 2), b.zone === 'sea');
    }
    assert.ok(floorY(ABYSS.x) > floorY(ABYSS.x - 5000) + ABYSS.depth * 0.9);
});

test('leaving an island the seabed falls away as a wall; toward the next one it climbs gently; a coast keeps its depth to its edge', () => {
    for (let i = 1; i < BIOMES.length; i++) {
        const a = BIOMES[i - 1], b = BIOMES[i];
        if (a.zone === b.zone) continue;
        const island = a.zone === 'island' ? a : b, sea = a.zone === 'sea' ? a : b;
        assert.ok(Math.abs(floorY(b.from - 1) - floorY(b.from + 1)) < 20, `${a.id} -> ${b.id}: no step at the border`);
        assert.ok(Math.abs(floorY(island === a ? b.from - 50 : b.from + 50) - island.floor) < 60, `${island.id}: full depth at its edge`);
        if (sea === b) assert.ok(floorY(b.from + SEABED.dropOff) - floorY(b.from) > 2000, `${a.id}: the drop-off`);
        else {
            let steepest = 0;
            for (let x = b.from - SEABED.rise; x < b.from; x += 100) steepest = Math.max(steepest, Math.abs(floorY(x + 100) - floorY(x)) / 100);
            assert.ok(steepest < 2.2, `${b.id}: the climb, steepest ${steepest.toFixed(2)}`);
        }
    }
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
        assert.ok(p.y >= 200 && p.y < floorY(p.x), `${b.id}: under water, above the seabed`);
    }
    const deep = spotFor('abyss');
    assert.ok(Math.abs(deep.x - ABYSS.x) < 1 && deep.y > 6000);
});

test('a biome with a landmark shows it where the player arrives: at its entry and at its spot', () => {
    const CH = 960;
    const wreck = BIOMES.find(b => b.id === 'wreck'), harbour = BIOMES.find(b => b.id === 'harbour');
    for (const b of [wreck, harbour]) {
        const spot = spotFor(b.id);
        assert.equal(landmarkGroup(Math.floor(spot.x / CH), CH), b.landmark, `${b.id}: spot`);
        assert.equal(landmarkGroup(Math.floor((b.from + LANDMARK.entry) / CH), CH), b.landmark, `${b.id}: entry`);
        // A seabed landmark (wreck) is met beside the seabed; a surface one (pier) at the waterline.
        if (b.spot === 'surface') assert.ok(spot.y > 0 && spot.y <= 380, `${b.id}: the spot is just under the surface`);
        else assert.ok(Math.abs(spot.y - (floorY(spot.x) - LANDMARK.above)) < 1e-9, `${b.id}: the spot is beside the seabed`);
    }
    assert.equal(landmarkGroup(Math.floor(BIOMES.find(b => b.id === 'reef').from / CH) + 2, CH), null);
    let columns = 0;
    for (let cx = 0; cx < WORLD_END / CH; cx++) if (landmarkGroup(cx, CH)) columns++;
    assert.equal(columns, 4, 'two columns per landmark biome, no more');
});

test('the mangrove spot is under the roots at the surface', () => {
    assert.ok(spotFor('mangrove').y < 500);
});

test('the view tips down at every drop-off and nowhere else', () => {
    const drops = BIOMES.filter((b, i) => i > 0 && b.zone === 'sea' && BIOMES[i - 1].zone === 'island');
    assert.ok(drops.length >= 3);
    for (const b of drops) {
        assert.ok(dropOffView(b.from + SEABED.dropOff * 0.4) > 0.99, `${b.id}: full at the wall`);
        assert.ok(dropOffView(b.from - 200) > 0.5, 'already tipping as you come to the edge');
        assert.equal(dropOffView(b.from + SEABED.dropOff * 0.4 + SEABED.dropView + 10), 0);
        assert.equal(dropOffView(b.from + b.width / 2), 0, 'not out at sea');
    }
    assert.equal(dropOffView(0), 0);
});

test('growth on rock faces thickens toward the drop-off of an island into the open sea', () => {
    const reef = BIOMES.find(b => b.id === 'reef'), end = reef.from + reef.width;
    assert.equal(BIOMES[BIOMES.indexOf(reef) + 1].zone, 'sea');
    assert.ok(dropOffShare(end - 50) > 0.9);
    assert.equal(dropOffShare(end - 5000), 0);
    assert.equal(dropOffShare(end + 500), 1, 'all over the wall itself');
    assert.equal(dropOffShare(end + 5000), 0, 'none out at sea');
    assert.deepEqual(wallLifeAt(end + 300)?.life, reef.wallLife, 'the reef grows down its wall');
    assert.equal(wallLifeAt(end + 5000), null);
    for (const b of BIOMES) if (b.wallLife) assert.ok(b.wallRate > 0 && b.wallRate < 1, b.id);
});
