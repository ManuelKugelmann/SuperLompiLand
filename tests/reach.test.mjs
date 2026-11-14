import test from 'node:test';
import assert from 'node:assert/strict';
import { REACH, createReach } from '../game/level/reach.js';
import { FIELD, ROUTE, createField } from '../game/level/density.js';

const T = 0.5;
// Solid rock everywhere below y = 400, with a round bubble of water (radius 200) at (2000, 2000)
// and a cave at (5000, 1200) joined to the sea above by a shaft.
const world = (x, y) => {
    if (y < 400) return 0;
    if (Math.hypot(x - 2000, y - 2000) < 200) return 0;
    if (Math.hypot(x - 5000, y - 1200) < 260) return 0;
    if (Math.abs(x - 5000) < 130 && y < 1200) return 0;
    return 1;
};

test('open sea is reachable, rock is not', () => {
    const reach = createReach(world, T);
    assert.equal(reach(100, 100), true);
    assert.equal(reach(100, 300), true, 'deeper open water joins the surface');
    assert.equal(reach(100, 900), false, 'inside the rock');
});

test('a sealed bubble of water inside the rock is not reachable', () => {
    const reach = createReach(world, T);
    assert.equal(reach(2000, 2000), false);
    assert.equal(reach(2100, 1950), false, 'anywhere in it');
});

test('a cave with a way out is reachable', () => {
    const reach = createReach(world, T);
    assert.equal(reach(5000, 1300), true);
    assert.equal(reach(5150, 1200), true);
});

test('the calm route counts as the open sea', () => {
    // Water only in a band around y = 3000, never touching the surface; the route runs through it.
    const band = (x, y) => (Math.abs(y - 3000) < 150 ? 0 : 1);
    assert.equal(createReach(band, T)(500, 3000), true, 'a region too big to be a pocket');
    const small = (x, y) => (Math.abs(y - 3000) < 150 && Math.abs(x) < 600 ? 0 : 1);
    assert.equal(createReach(small, T)(0, 3000), false, 'sealed');
    assert.equal(createReach(small, T, () => 3000, 200)(0, 3000), true, 'unless the route passes through');
});

test('answers are remembered: the second question costs nothing', () => {
    let calls = 0;
    const counted = (x, y) => { calls++; return world(x, y); };
    const reach = createReach(counted, T);
    reach(2000, 2000);
    const first = calls;
    assert.equal(reach(2040, 2060), false);
    assert.equal(calls, first, 'no new samples');
    assert.ok(first < REACH.budget * 6);
});

test('in the real world: the route and the start pool are reachable, and some pockets exist to be skipped', () => {
    const f = createField(1337), reach = createReach(f.density, FIELD.threshold, f.routeY, ROUTE.halfWidth * 0.75);
    assert.equal(reach(FIELD.spawn.x, FIELD.spawn.y), true);
    for (let x = 0; x < 60000; x += 3000) assert.equal(reach(x, f.routeY(x)), true, `route at ${x}`);
    let open = 0, sealed = 0, seed = 7;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 1500; i++) {
        const x = rnd() * 60000, y = 200 + rnd() * 4500;
        if (f.density(x, y) >= FIELD.threshold - 0.1) continue;
        open++;
        if (!reach(x, y)) sealed++;
    }
    assert.ok(open > 300, `open samples ${open}`);
    assert.ok(sealed / open < 0.15, `sealed share ${sealed}/${open}`);
    console.log(`reach: ${sealed} of ${open} random open spots are sealed pockets`);
});
