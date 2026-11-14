import test from 'node:test';
import assert from 'node:assert/strict';
import { SIPHON, siphonSpots, stringAt, beadAt, beadGlow } from '../game/level/siphonophore.js';
import { bloomFields } from '../game/level/blooms.js';
import { ventSpot } from '../game/level/ventField.js';
import { BIOMES } from '../game/level/biomes.js';

test('the strings drift in the trench, between its glowing jelly fields and before the vent field', () => {
    const spots = siphonSpots(), trench = BIOMES.find(b => b.id === 'trench'), deep = bloomFields().filter(f => f.deep);
    assert.ok(spots.length >= 2);
    for (const s of spots) {
        assert.ok(s.x0 > trench.from && s.x1 < ventSpot().x0 - SIPHON.keep + 1);
        for (const f of deep) assert.ok(s.x1 < f.x0 - 1500 || s.x0 > f.x1 + 1500, `clear of the jelly field at ${f.x0}`);
    }
    // West to east the trench's sights alternate: never two jelly fields in a row.
    const order = [...deep.map(f => ({ x: f.x0, kind: 'bloom' })), ...spots.map(s => ({ x: s.x0, kind: 'siphon' }))].sort((a, b) => a.x - b.x);
    for (let i = 1; i < order.length; i++) assert.notEqual(order[i].kind === 'bloom' && order[i - 1].kind === 'bloom', true, `two jelly fields in a row at ${order[i].x}`);
});

test('a string is a long chain across the route, its beads in order from top to bottom', () => {
    const spot = siphonSpots()[0];
    for (let k = 0; k < SIPHON.strings; k++) {
        const str = stringAt(spot, k);
        assert.ok(str.x > spot.x0 && str.x < spot.x1);
        assert.ok(str.length >= SIPHON.length[0] && str.length <= SIPHON.length[1]);
        let prev = -Infinity;
        for (let j = 0; j < SIPHON.beads; j++) {
            const p = beadAt(str, j, 12.5, 4000);
            assert.ok(p.y > prev, 'each bead lies below the one before');
            assert.ok(Math.abs(p.x - str.x) <= str.length * SIPHON.lean / 2 + SIPHON.sway[0] + 1);
            prev = p.y;
        }
        const top = beadAt(str, 0, 0, 4000), bottom = beadAt(str, SIPHON.beads - 1, 0, 4000);
        assert.ok(bottom.y - top.y > str.length * 0.8, 'mostly upright');
        assert.ok(top.y < 4000 + SIPHON.spread && bottom.y > 4000 - SIPHON.spread, 'it crosses the lane');
    }
});

test('a wave of light runs along the string from where the fish passed, and fades', () => {
    assert.equal(beadGlow(5, 10, null), SIPHON.dim, 'at rest');
    assert.equal(beadGlow(10, 10, 0), 1, 'it starts as the brightest bead');
    const after = 0.3, crest = 10 + after * SIPHON.run;
    assert.ok(beadGlow(Math.round(crest), 10, after) > beadGlow(10, 10, after), 'the crest has moved on');
    assert.ok(Math.abs(beadGlow(Math.round(crest), 10, after) - beadGlow(20 - Math.round(crest), 10, after)) < 1e-9, 'both ways alike');
    assert.ok(beadGlow(Math.round(crest), 10, after) < 1, 'fading as it goes');
    assert.equal(beadGlow(3, 10, 60), SIPHON.dim, 'long after: at rest again');
    for (let j = 0; j < SIPHON.beads; j++) for (const s of [0, 0.2, 0.7, 1.5]) { const g = beadGlow(j, 12, s); assert.ok(g >= SIPHON.dim && g <= 1); }
});
