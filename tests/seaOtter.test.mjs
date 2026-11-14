import test from 'node:test';
import assert from 'node:assert/strict';
import { SEA_OTTER, otterSpot, otterAt, roundS } from '../game/level/seaOtter.js';
import { BIOMES } from '../game/level/biomes.js';
import { createField, ROUTE } from '../game/level/density.js';
import { worldMap, LANDMARK_KINDS } from '../game/level/worldMap.js';

test('the otter floats in the kelp forest, on the map as a landmark, and its dive is open water', () => {
    const s = otterSpot(), b = BIOMES.find(bi => bi.id === 'kelp'), f = createField(1337);
    assert.ok(s.x0 > b.from && s.x1 < b.from + b.width);
    assert.ok(LANDMARK_KINDS.includes('otter'));
    assert.equal(worldMap().features.filter(ft => ft.kind === 'otter').length, 1);
    const route = f.routeY(s.x);
    for (let t = 0; t < roundS(); t += 0.2) {
        const p = otterAt(t, s.x, 0, route);
        if (p.y > 60) assert.ok(f.density(p.x, p.y) < 0.53, `open water at ${Math.round(p.x)}, ${Math.round(p.y)} (${p.part})`);
    }
});

test('a round: it floats and taps its shell, dives to just over the lane, looks round and comes up again', () => {
    const x0 = 1000, surface = 0, route = 900, parts = new Set();
    let prev = null, taps = 0, wasTap = false, deepest = 0;
    for (let t = 0; t < roundS(); t += 1 / 60) {
        const p = otterAt(t, x0, surface, route, {});
        parts.add(p.part);
        if (prev && prev.part !== 'float' && p.part !== 'float') assert.ok(Math.hypot(p.x - prev.x, p.y - prev.y) < 20, `no jump at ${t.toFixed(2)}`);
        if (p.tap && !wasTap) taps++;
        wasTap = p.tap;
        deepest = Math.max(deepest, p.y);
        if (p.part === 'float') assert.ok(Math.abs(p.y - surface) <= SEA_OTTER.bob + 1e-9 && p.x === x0);
        else assert.equal(p.tap, false);
        prev = { ...p };
    }
    assert.deepEqual([...parts], ['float', 'dive', 'linger', 'rise']);
    assert.ok(taps >= SEA_OTTER.taps, `it taps ${taps} times`);
    assert.equal(deepest, route - SEA_OTTER.over, 'down to just over the lane');
    assert.ok(route - SEA_OTTER.over < route - 100 && SEA_OTTER.over < ROUTE.halfWidth, 'in the picture of a fish on the route, above its middle');
    const again = otterAt(roundS() + 1, x0, surface, route, {}), first = otterAt(1, x0, surface, route, {});
    assert.equal(again.part, first.part);
});

test('where the route runs just under the surface the dive stays shallow but still goes under', () => {
    const p = otterAt(SEA_OTTER.floatS + SEA_OTTER.diveS + 0.1, 0, 0, 200, {});
    assert.ok(p.y >= 120);
});
