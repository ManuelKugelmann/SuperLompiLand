import test from 'node:test';
import assert from 'node:assert/strict';
import { NURSERY, nurserySpot, fryHome, fryDrift, fryPart, pupAt, pupBeside } from '../game/level/nursery.js';
import { BIOMES } from '../game/level/biomes.js';
import { nestSpots } from '../game/level/density.js';
import { worldMap, LANDMARK_KINDS } from '../game/level/worldMap.js';

test('the nursery lies in the mangrove, clear of nests and of the other sights', () => {
    const s = nurserySpot(), b = BIOMES.find(bi => bi.id === 'mangrove');
    assert.ok(s.x0 > b.from && s.x1 < b.from + b.width);
    for (const x of nestSpots()) assert.ok(x < s.x0 - 600 || x > s.x1 + 600, `nest at ${x}`);
    assert.ok(LANDMARK_KINDS.includes('nursery'));
    const others = worldMap().features.filter(f => LANDMARK_KINDS.includes(f.kind) && f.kind !== 'nursery' && f.x1 > s.x0 && f.x0 < s.x1);
    assert.deepEqual(others.map(f => f.kind), []);
    assert.equal(worldMap().features.filter(f => f.kind === 'nursery').length, 1);
});

test('every fry has its own place inside the cloud and drifts only a little', () => {
    const seen = new Set();
    for (let i = 0; i < NURSERY.fry; i++) {
        const h = fryHome(i);
        assert.ok((h.x / NURSERY.cloud[0]) ** 2 + (h.y / NURSERY.cloud[1]) ** 2 <= 1 + 1e-9);
        seen.add(`${Math.round(h.x)},${Math.round(h.y)}`);
        for (const t of [0, 3.3, 17]) { const d = fryDrift(i, t); assert.ok(Math.abs(d.x) <= NURSERY.wander && Math.abs(d.y) <= NURSERY.wander); }
    }
    assert.ok(seen.size > NURSERY.fry * 0.9, 'no pile of fry on one spot');
});

test('the cloud parts round the fish: no fry stays within the open ring, far ones do not move', () => {
    const fx = 40, fy = -20;
    for (let i = 0; i < NURSERY.fry; i++) {
        const h = fryHome(i), p = fryPart(h.x, h.y, fx, fy), d0 = Math.hypot(h.x - fx, h.y - fy), d1 = Math.hypot(h.x + p.x - fx, h.y + p.y - fy);
        if (d0 >= NURSERY.part) assert.deepEqual({ x: p.x, y: p.y }, { x: 0, y: 0 });
        else assert.ok(Math.abs(d1 - NURSERY.part) < 1e-6, `fry ${i} ends on the ring`);
    }
    const under = fryPart(5, 5, 5, 5);
    assert.ok(Math.hypot(under.x, under.y) > NURSERY.part - 1, 'a fry right under the fish gets out too');
});

test('the pups patrol slowly under the cloud, apart from each other', () => {
    const a = pupAt(0, 0, 1000, 800), b = pupAt(1, 0, 1000, 800);
    assert.ok(Math.abs(a.x - b.x) > NURSERY.roam[0], 'on opposite sides of the round');
    for (let t = 0; t < NURSERY.lap; t += 0.5) {
        const p = pupAt(0, t, 1000, 800);
        assert.ok(Math.abs(p.x - 1000) <= NURSERY.roam[0] + 1e-6 && Math.abs(p.y - 800) <= NURSERY.roam[1] + 1e-6);
        assert.ok(Math.hypot(p.vx, p.vy) < 330, 'slower than a cruising fish');
    }
    const back = pupAt(0, NURSERY.lap, 1000, 800), start = pupAt(0, 0, 1000, 800);
    assert.ok(Math.abs(back.x - start.x) < 1e-6 && Math.abs(back.y - start.y) < 1e-6);
});

test('with Sharky they swim along behind him, one to each side', () => {
    const a = pupBeside(0, 500, 300, 1), b = pupBeside(1, 500, 300, 1), west = pupBeside(0, 500, 300, -1);
    assert.ok(a.x < 500 && b.x < 500, 'behind when he swims east');
    assert.ok(west.x > 500, 'and behind when he swims west');
    assert.ok(a.y < 300 && b.y > 300, 'one above, one below');
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 100, 'not on top of each other');
});
