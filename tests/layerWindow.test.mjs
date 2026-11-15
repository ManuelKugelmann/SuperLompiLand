import test from 'node:test';
import assert from 'node:assert/strict';
import { LAYER_LEAD, layerWindow } from '../game/level/layerWindow.js';

const L = 960, MOST = 25;
const size = ([x0, x1, y0, y1]) => (x1 - x0 + 1) * (y1 - y0 + 1);

test('at rest: the screen and a margin, nothing ahead', () => {
    const w = layerWindow(L * 10 + 500, L * 3 + 500, 2400, 1080, 0, 0, L, MOST);
    assert.ok(w[0] * L <= L * 10 + 500 - LAYER_LEAD.margin * L + L && w[1] * L + L >= L * 10 + 500 + 2400);
    assert.ok(size(w) <= MOST);
});

test('moving: the lead lies ahead only, and the window never outgrows the atlas (20:9 phone, fast diagonal)', () => {
    const rest = layerWindow(L * 10 + 900, L * 3 + 900, 2400, 1080, 0, 0, L, MOST);
    for (const [vx, vy] of [[3000, 0], [-3000, 0], [3000, 3000], [-3000, -3000], [200, 2500]]) {
        const w = layerWindow(L * 10 + 900, L * 3 + 900, 2400, 1080, vx, vy, L, MOST);
        assert.ok(size(w) <= MOST, `${vx},${vy}: ${size(w)} chunks`);
        if (vx > 0) { assert.equal(w[0], rest[0]); assert.ok(w[1] >= rest[1]); }      // (the slower axis may give its lead up)
        if (vx < 0) { assert.equal(w[1], rest[1]); assert.ok(w[0] < rest[0]); }
    }
    const fast = layerWindow(L * 10 + 900, L * 3 + 900, 2400, 1080, 3000, 200, L, MOST);
    assert.equal(fast[1] - rest[1], LAYER_LEAD.leadMax, 'the faster axis keeps its whole lead');
});

test('rows never go above the surface', () => {
    assert.equal(layerWindow(0, 0, 2400, 1080, 0, -3000, L, MOST)[2], 0);
});
