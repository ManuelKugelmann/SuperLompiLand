import test from 'node:test';
import assert from 'node:assert/strict';
import { BLOOM, bloomFields, jellyAt, bumpAside } from '../game/level/blooms.js';
import { isSea } from '../game/level/biomes.js';
import { createField } from '../game/level/density.js';
import { weatherZones } from '../game/level/weather.js';
import { chapters } from '../game/journey.js';
import { rescueSpots } from '../game/rescues.js';

const fields = bloomFields(), f = createField(1337);

test('bloom fields come again and again in both open seas, across the calm route', () => {
    assert.ok(fields.length >= 5, `${fields.length} fields`);
    for (let i = 1; i < fields.length; i++) assert.ok(fields[i].x0 > fields[i - 1].x1, 'west to east, apart');
    for (const fl of fields) {
        assert.ok(isSea(fl.x0) && isSea(fl.x1));
        const ry = f.routeY((fl.x0 + fl.x1) / 2);
        assert.ok(ry > fl.top && ry < fl.bottom, `the route runs through it (${Math.round(ry)})`);
    }
});

test('none lies at the storm, a current, a friend, the whale or a small rescue', () => {
    const w = weatherZones();
    for (const fl of fields) {
        for (const [a, z] of [w.storm, ...w.downs]) assert.ok(fl.x1 < a || fl.x0 > z);
        for (const c of chapters()) {
            assert.ok(c.x < fl.x0 - BLOOM.keep || c.x > fl.x1 + BLOOM.keep, c.id);
            if (c.event) assert.ok(c.event.endX < fl.x0 || c.event.x > fl.x1);
        }
        for (const r of rescueSpots()) assert.ok(r.x < fl.x0 - BLOOM.keep || r.x > fl.x1 + BLOOM.keep, r.id);
    }
});

test('jellies stay in their field, drift slowly, and come in two sizes', () => {
    const fl = fields[0];
    let small = 0;
    for (let i = 0; i < BLOOM.count; i++) {
        const a = { ...jellyAt(fl, i, 10) }, b = { ...jellyAt(fl, i, 10.1) };
        assert.ok(a.x > fl.x0 - BLOOM.drift[0] - 1 && a.x < fl.x1 + BLOOM.drift[0] + 1 && a.y > fl.top - BLOOM.drift[1] - 1 && a.y < fl.bottom + BLOOM.drift[1] + 1);
        assert.ok(Math.hypot(b.x - a.x, b.y - a.y) < 3, 'a slow drift');
        assert.equal(a.small, jellyAt(fl, i, 99).small, 'its size does not change');
        if (a.small) small++;
    }
    assert.ok(small > 5 && small < BLOOM.count - 5);
});

test('a fish close by pushes a jelly straight away, gently; from further off not at all', () => {
    const p = bumpAside(100, 0, 0, 0);
    assert.ok(p.x > 0 && p.x < BLOOM.shove && p.y === 0);
    assert.ok(bumpAside(20, 0, 0, 0).x > p.x, 'the closer, the further');
    assert.deepEqual({ ...bumpAside(BLOOM.bump + 1, 0, 0, 0) }, { x: 0, y: 0 });
    assert.ok(bumpAside(0, -60, 0, 0).y < 0, 'upward when the fish is below');
});
