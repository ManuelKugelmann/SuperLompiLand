import test from 'node:test';
import assert from 'node:assert/strict';
import { GANNETS, gannetSpot, volley, volleyS, gannetAt } from '../game/level/gannets.js';
import { seaArch } from '../game/level/seaArch.js';
import { createField } from '../game/level/density.js';
import { worldMap, LANDMARK_KINDS } from '../game/level/worldMap.js';

test('the gannets fish just behind the sea arch, where the route is shallow enough for their plunges to be in the picture', () => {
    const s = gannetSpot(), f = createField(1337);
    assert.ok(s.x > seaArch().x1 && s.x < seaArch().x1 + 3000);
    assert.ok(LANDMARK_KINDS.includes('gannets'));
    assert.equal(worldMap().features.filter(ft => ft.kind === 'gannets').length, 1);
    const route = f.routeY(s.x);
    assert.ok(route - 540 < GANNETS.depth[0], `a fish on the route (y ${Math.round(route)}) sees down to where the shallowest plunge ends`);
    for (const x of [s.x + GANNETS.ahead[0], s.x + GANNETS.ahead[0] + GANNETS.ahead[1] * (GANNETS.birds - 1)]) for (let y = 60; y <= GANNETS.depth[1]; y += 40) assert.ok(f.density(x, y) < 0.53, `open water at ${x}, ${y}`);
});

test('a volley: the birds come down one after the other, ahead of the fish, never onto it', () => {
    const v = volley(5000, 1, 3);
    assert.equal(v.length, GANNETS.birds);
    for (let k = 0; k < v.length; k++) {
        assert.ok(v[k].x - 5000 >= GANNETS.ahead[0], 'ahead of the fish');
        assert.ok(v[k].depth >= GANNETS.depth[0] && v[k].depth <= GANNETS.depth[1]);
        if (k) assert.ok(v[k].at > v[k - 1].at && v[k].x > v[k - 1].x);
    }
    assert.ok(volley(5000, -1)[0].x < 5000, 'the other way when the fish travels west');
    assert.ok(Math.abs(volleyS() - (v.at(-1).at + GANNETS.plungeS + GANNETS.turnS + GANNETS.riseS)) < 1e-9);
});

test('a plunge: straight down fast, a turn at the bottom, up again with a fish in its bill', () => {
    const p = volley(5000, 1)[0], surface = 0, parts = [];
    let prev = null;
    for (let u = -0.2; u < GANNETS.plungeS + GANNETS.turnS + GANNETS.riseS + 0.2; u += 1 / 60) {
        const g = gannetAt(p, u, surface, {});
        if (parts.at(-1) !== g.part) parts.push(g.part);
        if (g.part !== 'wait' && g.part !== 'gone') {
            assert.ok(g.y >= surface - 1e-9 && g.y <= surface + p.depth + 1e-9);
            if (prev) assert.ok(Math.hypot(g.x - prev.x, g.y - prev.y) < 60, `no jump at ${u.toFixed(2)}`);
            prev = { x: g.x, y: g.y };
        }
        if (g.part === 'plunge') { assert.equal(g.x, p.x); assert.equal(g.fish, false); assert.ok(Math.abs(g.angle - Math.PI / 2) < 1e-9, 'bill down'); }
        if (g.part === 'rise') { assert.equal(g.fish, true); assert.ok(Math.sin(g.angle) < 0, 'bill up'); }
    }
    assert.deepEqual(parts, ['wait', 'plunge', 'turn', 'rise', 'gone']);
    const half = gannetAt(p, GANNETS.plungeS / 2, surface, {});
    assert.ok(half.y > surface + p.depth / 2, 'most of the way is covered in the first half: it hits the water fast');
});
