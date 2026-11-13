import test from 'node:test';
import assert from 'node:assert/strict';
import { edgeMarker } from '../net/edgeMarker.js';

const view = { x: 1000, y: 500, width: 1920, height: 1080 };

test('no marker while the friend is on screen', () => {
    assert.equal(edgeMarker(view, { x: 1500, y: 900 }), null);
    assert.equal(edgeMarker(view, { x: 1000, y: 500 }), null);
});

test('a friend far below shows at the bottom edge, pointing down', () => {
    const m = edgeMarker(view, { x: 1960, y: 5000 });
    assert.ok(Math.abs(m.y - (1080 - 70)) < 1e-6, `y ${m.y}`);
    assert.ok(Math.abs(m.x - 960) < 20);
    assert.ok(Math.abs(m.angle - Math.PI / 2) < 0.05);
});

test('markers stay inside the margin for any direction', () => {
    for (let a = 0; a < Math.PI * 2; a += 0.1) {
        const m = edgeMarker(view, { x: 1960 + Math.cos(a) * 5000, y: 1040 + Math.sin(a) * 5000 }, 70);
        assert.ok(m.x >= 70 - 1e-6 && m.x <= 1920 - 70 + 1e-6, `x ${m.x} at ${a}`);
        assert.ok(m.y >= 70 - 1e-6 && m.y <= 1080 - 70 + 1e-6, `y ${m.y} at ${a}`);
        assert.ok(Math.abs(Math.atan2(Math.sin(m.angle - a), Math.cos(m.angle - a))) < 0.01);
    }
});
