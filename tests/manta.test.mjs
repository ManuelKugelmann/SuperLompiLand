import test from 'node:test';
import assert from 'node:assert/strict';
import { MANTA, mantaSpan, mantaAt } from '../game/ai/manta.js';
import { BIOMES } from '../game/level/biomes.js';
import { createField, ROUTE } from '../game/level/density.js';

const f = createField(1337), { x0, x1 } = mantaSpan();

test('the manta patrols inside the reef, well away from its ends', () => {
    const reef = BIOMES.find(b => b.id === 'reef');
    assert.ok(x0 > reef.from && x1 < reef.from + reef.width && x1 - x0 > 3000);
});

test('it glides to and fro above the lane, never stops dead, never snaps round, never faster than its speed', () => {
    let prev = mantaAt(0, f.routeY), minX = Infinity, maxX = -Infinity, turns = 0, top = 0;
    for (let t = 0.1; t < 400; t += 0.1) {
        const m = { ...mantaAt(t, f.routeY) };
        assert.ok(m.x >= x0 - 1e-6 && m.x <= x1 + 1e-6);
        assert.ok(f.routeY(m.x) - m.y > ROUTE.halfWidth, 'above the lane');
        assert.ok(m.y > 80, 'under the surface');
        assert.ok(Math.abs(m.x - prev.x) <= MANTA.speed * 0.1 + 1e-6, 'no jump');
        assert.ok(Math.abs(m.vx * 60 - (m.x - prev.x) / 0.1) < 12, 'its velocity is its movement');
        if (m.dir !== prev.dir) turns++;
        top = Math.max(top, Math.abs(m.vx) * 60);
        minX = Math.min(minX, m.x); maxX = Math.max(maxX, m.x); prev = m;
    }
    assert.ok(minX < x0 + 50 && maxX > x1 - 50, 'it uses its whole stretch');
    assert.ok(turns >= 2, 'it comes about at the ends');
    assert.ok(Math.abs(top - MANTA.speed) < 1, `top speed ${top.toFixed(1)}`);
});
