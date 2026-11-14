import test from 'node:test';
import assert from 'node:assert/strict';
import { createSlots, gridFor } from '../game/level/atlasSlots.js';

test('places are handed out once each, lie on a grid inside the atlas, and come back when given', () => {
    const s = createSlots(3, 2, 100), seen = new Set();
    assert.deepEqual(s.size, { w: 300, h: 200 });
    for (let k = 0; k < 6; k++) {
        const i = s.take(), p = s.at(i);
        assert.ok(i !== null && !seen.has(i));
        seen.add(i);
        assert.ok(p.x % 100 === 0 && p.y % 100 === 0 && p.x < 300 && p.y < 200);
    }
    assert.equal(new Set([...seen].map(i => `${s.at(i).x},${s.at(i).y}`)).size, 6, 'no two share a place');
    assert.equal(s.take(), null, 'full');
    s.give(4); s.give(4); s.give(99); s.give(null);
    assert.equal(s.free, 1, 'given back once, whatever is given twice or was never taken');
    assert.equal(s.take(), 4);
    s.reset();
    assert.equal(s.free, 6);
    assert.equal(s.take(), 0, 'the first place first');
});

test('the smallest square grid that holds the pictures', () => {
    assert.equal(gridFor(36), 6);
    assert.equal(gridFor(37), 7);
    assert.equal(gridFor(1), 1);
});
