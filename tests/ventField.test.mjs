import test from 'node:test';
import assert from 'node:assert/strict';
import { VENT_FIELD, ventSpot, chimneyAt, chimneyHeight, ventLift, ventCoins } from '../game/level/ventField.js';
import { BIOMES } from '../game/level/biomes.js';
import { nestSpots } from '../game/level/density.js';

test('the field lies at the trench end, before the grand nest, chimneys inside it in order', () => {
    const s = ventSpot(), trench = BIOMES.find(b => b.id === 'trench'), grand = Math.max(...nestSpots());
    assert.ok(s.x0 > trench.from && s.x1 < trench.from + trench.width);
    assert.ok(s.x1 < grand - 2000, 'the grand nest has its own screen');
    let prev = s.x0;
    for (let i = 0; i < VENT_FIELD.chimneys; i++) { const c = chimneyAt(i); assert.ok(c.x > prev && c.x < s.x1); prev = c.x; }
});

test('a chimney stands its full height unless its mouth would rise past the limit over the calm route', () => {
    const c = { height: 640 };
    assert.equal(chimneyHeight(c, 6000, 5000), 640);
    assert.equal(chimneyHeight(c, 5300, 5000), 5300 - 5000 - VENT_FIELD.clear);
    assert.equal(chimneyHeight(c, 5000 + VENT_FIELD.clear - 10, 5000), 0);
});

test('warm water lifts over a mouth, not beside it, not below it, and fades above the route', () => {
    const mouths = [{ x: 1000, y: 5600 }], route = 5000, o = { x: 0, y: 0 };
    assert.ok(ventLift(1000, 5300, mouths, route, o).y < -VENT_FIELD.lift * 0.9);
    assert.equal(ventLift(1000 + VENT_FIELD.halfWidth + 1, 5300, mouths, route, o).y, 0);
    assert.equal(ventLift(1000, 5700, mouths, route, o).y, 0);
    assert.equal(ventLift(1000, route - VENT_FIELD.reach - 1, mouths, route, o).y, 0);
    assert.ok(Math.abs(ventLift(1000, route - VENT_FIELD.reach + 50, mouths, route, o).y) < VENT_FIELD.lift * 0.4, 'gentle at its top');
});

test('coins hang in the column, lowest first, never above the lift', () => {
    const route = 5000, coins = ventCoins({ x: 1000, y: 5600 }, route);
    assert.equal(coins.length, VENT_FIELD.coins);
    for (let k = 1; k < coins.length; k++) assert.ok(coins[k].y < coins[k - 1].y);
    assert.ok(coins.every(c => c.y > route - VENT_FIELD.reach && c.x === 1000));
    assert.ok(ventCoins({ x: 0, y: route - 200 }, route).length < VENT_FIELD.coins, 'a short column holds fewer');
});
