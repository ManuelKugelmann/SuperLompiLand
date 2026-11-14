import test from 'node:test';
import assert from 'node:assert/strict';
import { SANDBAR, sandbarSpot, sandbarCoins, jumpedOver } from '../game/level/sandbar.js';
import { FIELD, createField } from '../game/level/density.js';
import { rescueSpots } from '../game/rescues.js';
import { worldMap } from '../game/level/worldMap.js';

const s = sandbarSpot(), f = createField(1337), coins = sandbarCoins(f.routeY);

test('the sandbar lies in the lagoon\'s quiet stretch between two nests, over open water, with the calm route passing underneath', () => {
    assert.ok(s.x0 > 66000 && s.x1 < 78000, `${Math.round(s.x0)} .. ${Math.round(s.x1)}`);
    for (const n of f.nests) assert.ok(n.x < s.x0 - 1500 || n.x > s.x1 + 1500, `nest at ${Math.round(n.x)}`);
    for (const r of rescueSpots()) assert.ok(r.x < s.x0 - 1000 || r.x > s.x1 + 1000, r.id);
    for (let x = s.x0; x <= s.x1; x += 150) {
        assert.ok(f.routeY(x) > SANDBAR.height + 200, 'the route runs well under the bar');
        for (let y = 60; y < f.routeY(x); y += 80) assert.ok(f.density(x, y) < FIELD.threshold, `open water at ${x}, ${y}`);
    }
    assert.ok(worldMap().features.some(ft => ft.kind === 'sandbar' && ft.x0 === s.x0));
});

test('coins lead up from the route to the bar and arc through the air over its crown', () => {
    assert.equal(coins.length, SANDBAR.trail + SANDBAR.arc);
    const trail = coins.slice(0, SANDBAR.trail), arc = coins.slice(SANDBAR.trail);
    assert.ok(Math.abs(trail[0].y - f.routeY(trail[0].x)) < 200);
    for (let i = 1; i < trail.length; i++) assert.ok(trail[i].y < trail[i - 1].y && trail[i].x > trail[i - 1].x);
    for (const c of trail) assert.ok(c.y > 40 && f.density(c.x, c.y) < FIELD.threshold);
    const top = arc[(SANDBAR.arc - 1) / 2];
    assert.ok(Math.abs(top.x - s.x) < 1 && Math.abs(top.y + SANDBAR.arcTop) < 1, 'the arc peaks over the crown');
    assert.ok(arc[0].y > 0 && arc.at(-1).y > 0, 'it begins and ends in the water');
    assert.ok(arc.filter(c => c.y < 0).length >= 5, 'most of it is in the air');
});

test('a jump counts when the fish crosses the crown in the air, either way; swimming under it does not', () => {
    assert.ok(jumpedOver({ x: s.x - 30, y: -200 }, { x: s.x + 30, y: -190 }));
    assert.ok(jumpedOver({ x: s.x + 30, y: -120 }, { x: s.x - 30, y: -130 }), 'westward too');
    assert.ok(!jumpedOver({ x: s.x - 30, y: 300 }, { x: s.x + 30, y: 300 }), 'under water');
    assert.ok(!jumpedOver({ x: s.x - 30, y: -10 }, { x: s.x + 30, y: -10 }), 'not clear of the crown');
    assert.ok(!jumpedOver({ x: s.x + 10, y: -200 }, { x: s.x + 60, y: -200 }), 'no crossing');
});
