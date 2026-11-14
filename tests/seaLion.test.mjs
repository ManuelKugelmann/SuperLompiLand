import test from 'node:test';
import assert from 'node:assert/strict';
import { SEA_LION, seaLionSpot, seaLionAt, visitS } from '../game/level/seaLion.js';
import { BIOMES } from '../game/level/biomes.js';
import { worldMap, LANDMARK_KINDS } from '../game/level/worldMap.js';

test('the sea lion pup plays on the rocky shore and is a landmark on the map', () => {
    const s = seaLionSpot(), b = BIOMES.find(bi => bi.id === 'shore');
    assert.ok(s.x0 > b.from && s.x1 < b.from + b.width);
    assert.ok(LANDMARK_KINDS.includes('sealion'));
    assert.equal(worldMap().features.filter(f => f.kind === 'sealion').length, 1);
});

test('a visit: it shoots in from ahead and above, loops round the fish, and leaves for the surface', () => {
    const fx = 5000, fy = 900, surface = 0, total = visitS();
    const first = seaLionAt(0, fx, fy, 1, surface), last = seaLionAt(total - 1e-6, fx, fy, 1, surface);
    assert.equal(first.part, 'pass');
    assert.ok(first.x > fx + 1000 && first.y < fy - 300, 'from ahead and above');
    assert.equal(last.part, 'leave');
    assert.ok(Math.abs(last.y - (surface + 10)) < 1 && last.x > fx + 600, 'up at the surface, ahead');
    assert.equal(seaLionAt(total, fx, fy, 1, surface).done, true);
    assert.equal(seaLionAt(total - 0.1, fx, fy, 1, surface).done, false);
    assert.ok(seaLionAt(0, fx, fy, -1, surface).x < fx - 1000, 'mirrored when the fish travels west');
});

test('it never touches the fish and never jumps from one place to another', () => {
    const fx = 5000, fy = 900, total = visitS(), step = 1 / 60;
    let prev = null, loops = 0, lastSide = null;
    for (let u = 0; u < total; u += step) {
        const p = seaLionAt(u, fx, fy, 1, 0, {});
        assert.ok(Math.hypot(p.x - fx, p.y - fy) >= Math.min(...SEA_LION.radius) - 1e-6, `not nearer than its loop at ${u.toFixed(2)}`);
        if (prev) assert.ok(Math.hypot(p.x - prev.x, p.y - prev.y) < 40, `no jump at ${u.toFixed(2)} (${p.part})`);
        if (p.part === 'loop') { const side = p.y > fy; if (lastSide === true && !side) loops++; lastSide = side; }
        prev = { x: p.x, y: p.y };
    }
    assert.equal(loops, SEA_LION.laps, 'it comes up from under the fish once per loop');
});

test('near the surface it stays in the water while it comes in', () => {
    const p = seaLionAt(0, 5000, 200, 1, 0);
    assert.ok(p.y >= 30);
});
