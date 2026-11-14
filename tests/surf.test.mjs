import test from 'node:test';
import assert from 'node:assert/strict';
import { SURF, surgeShare, surgeWave, surgeAt, surgeCrestX, breakerX, breakerState, breakerAt, ripAt } from '../game/level/surf.js';
import { BIOMES, SHORE, floorY } from '../game/level/biomes.js';

// A place in the surf zone: the sand a little under the surface.
let surfX = SHORE;
while (floorY(surfX) < 120) surfX += 20;

test('the surge lives in the shallows at the surface and nowhere else', () => {
    assert.ok(surgeShare(surfX, 10) > 0.9);
    assert.equal(surgeShare(surfX, SURF.surge.depth + 1), 0, 'not below the surf zone');
    assert.equal(surgeShare(surfX, -5), 0, 'not in the air');
    assert.equal(surgeShare(0, 10), 0, 'not in the deeper lagoon');
    assert.equal(surgeShare(BIOMES.find(b => b.id === 'blue').from + 5000, 10), 0, 'not out at sea');
    assert.ok(surgeShare(surfX, 10) > surgeShare(surfX, 150), 'fades with depth');
});

test('a push carries shoreward and up, the backwash seaward and down, and they take turns', () => {
    let push = null, back = null;
    for (let p = 0; p < 1; p += 0.01) {
        const w = surgeWave(surfX, p), v = surgeAt(surfX, 20, p);
        if (w > 0.95) push = { ...v };
        if (w < -0.95) back = { ...v };
    }
    assert.ok(push.x < 0 && push.y < 0, 'push: west and up');
    assert.ok(back.x > 0 && back.y > 0, 'backwash: east and down');
    assert.ok(Math.abs(push.x) <= SURF.surge.speed + 1e-9);
    let mean = 0;
    for (let p = 0; p < 1; p += 0.01) mean += surgeAt(surfX, 20, p).x;
    assert.ok(Math.abs(mean / 100) < 0.05, 'over a whole wave the water goes nowhere');
});

test('the foam line of a push sits on its crest and runs toward the beach', () => {
    const a = surgeCrestX(3, 0.2), b = surgeCrestX(3, 0.4);
    assert.ok(b < a, 'moves west');
    assert.ok(Math.abs(surgeWave(a, 0.2) - 1) < 1e-9);
    assert.ok(Math.abs(surgeCrestX(4, 0.2) - a - SURF.surge.wavelength) < 1e-9);
});

test('the waves break just inside the outer edge of the reef', () => {
    const reef = BIOMES.find(b => b.id === 'reef'), x = breakerX();
    assert.ok(x > reef.from + reef.width / 2 && x < reef.from + reef.width);
});

test('breakers come in sets with a quiet gap; the sea draws back before a set', () => {
    const { set, gap } = SURF.breaker;
    let peaks = 0, last = 0, quiet = 0;
    for (let p = 0; p < set + gap; p += 0.01) {
        const s = breakerState(p);
        if (s.breaking > 0.95 && last <= 0.95) peaks++;
        last = s.breaking;
        if (s.breaking === 0) quiet += 0.01;
    }
    assert.equal(peaks, set);
    assert.ok(quiet > gap - 0.1, 'the gap is the moment to cross');
    assert.equal(breakerState(set + 0.5).drawback, 0, 'calm early in the gap');
    assert.ok(breakerState(set + gap - 0.1).drawback > 0.5, 'drawing back just before the set');
    assert.deepEqual(breakerState(0.5).wave, 0);
    assert.deepEqual(breakerState(set + 1).wave, -1);
});

test('a breaker tumbles whoever is in its foam toward the lagoon and down; under the foam it is calm', () => {
    const x = breakerX() - 200, v = breakerAt(x, 40, 0.5);
    assert.ok(v.x < -5 && v.y > 2, 'west and down');
    assert.ok(Math.abs(v.x) <= SURF.breaker.speed);
    assert.deepEqual({ ...breakerAt(x, SURF.breaker.depth + 20, 0.5) }, { x: 0, y: 0 });
    assert.deepEqual({ ...breakerAt(x, 40, SURF.breaker.set + 1) }, { x: 0, y: 0 }, 'nothing in the gap');
    assert.deepEqual({ ...breakerAt(x - SURF.breaker.reach - 300, 40, 0.5) }, { x: 0, y: 0 }, 'the lagoon behind is calm');
    assert.ok(breakerAt(x, 40, SURF.breaker.set + SURF.breaker.gap - 0.05).x > 0, 'the drawback pulls outward');
});

test('while the sea draws back, a mild rip runs out through the reef pass, and only there and then', () => {
    const x = breakerX(), passY = 1560, before = SURF.breaker.set + SURF.breaker.gap - 0.05;
    const v = ripAt(x, passY, before, passY);
    assert.ok(v.x > 1 && v.x <= SURF.breaker.rip && v.y === 0, 'out to sea, gently');
    assert.equal(ripAt(x, passY, 0.5, passY).x, 0, 'not while the waves break');
    assert.equal(ripAt(x, passY - SURF.breaker.ripHalf - 10, before, passY).x, 0, 'not above the pass');
    assert.equal(ripAt(x - 3000, passY, before, passY).x, 0, 'not in the lagoon');
});
