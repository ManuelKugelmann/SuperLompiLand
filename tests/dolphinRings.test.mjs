import test from 'node:test';
import assert from 'node:assert/strict';
import { DOLPHIN_RINGS, dolphinSpot, dolphinAt, blowRing, stepRing, ringRadius, throughRing, spotInBiome } from '../game/level/dolphinRings.js';

test('the play spot lies in the lagoon; the two dolphins circle opposite each other', () => {
    assert.ok(spotInBiome());
    const a = dolphinAt(0, 0, 0, 0), b = dolphinAt(1, 0, 0, 0);
    assert.ok(Math.abs(a.x + b.x) < 1e-6 && a.dir !== b.dir);
    const s = dolphinSpot();
    for (let t = 0; t < DOLPHIN_RINGS.lap; t += 0.5) { const d = dolphinAt(0, t, s.x, 0); assert.ok(d.x > s.x0 && d.x < s.x1); }
});

test('a ring rises, drifts its dolphin\'s way, grows, and bursts when old', () => {
    const r = blowRing({ x: 0, y: 0, dir: 1 }), y0 = r.y, x0 = r.x, r0 = ringRadius(r);
    let alive = true, n = 0;
    while (alive && n < 1000) { alive = stepRing(r, 0.1); n++; }
    assert.ok(r.y < y0 && r.x > x0 && ringRadius(r) > r0);
    assert.ok(Math.abs(n * 0.1 - DOLPHIN_RINGS.life) < 0.2);
});

test('swimming through the hoop counts; passing above or below does not', () => {
    const r = { x: 100, y: 500, dir: 1, age: 0 };
    assert.ok(throughRing(r, { x: 60, y: 500 }, { x: 140, y: 505 }));
    assert.ok(throughRing(r, { x: 140, y: 495 }, { x: 60, y: 500 }), 'either way');
    assert.ok(!throughRing(r, { x: 60, y: 500 - 80 }, { x: 140, y: 500 - 80 }), 'over it');
    assert.ok(!throughRing(r, { x: 60, y: 500 }, { x: 90, y: 500 }), 'not across yet');
});
